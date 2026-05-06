from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import traceback
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable


class BuildError(RuntimeError):
    pass


@dataclass(frozen=True)
class BuildTool:
    name: str
    label: str
    package_id: str


@dataclass(frozen=True)
class WingetPackage:
    package_id: str
    override: str | None = None


@dataclass(frozen=True)
class PreflightResult:
    required_tools: list[BuildTool]
    found_paths: dict[str, str]

    @property
    def missing_required(self) -> list[BuildTool]:
        return [tool for tool in self.required_tools if tool.name not in self.found_paths]

    @property
    def ok(self) -> bool:
        return not self.missing_required

    def summary(self) -> str:
        if self.ok:
            lines = [
                "Preflight OK. Required build tools are available:",
                f"- Python: {sys.version.split()[0]} ({sys.executable})",
            ]
            lines.extend(
                f"- {tool.label}: {self.found_paths[tool.name]}" for tool in self.required_tools
            )
            return "\n".join(lines)

        lines = [
            "Preflight found missing build tools:",
            f"- Python: {sys.version.split()[0]} ({sys.executable})",
        ]
        for tool in self.missing_required:
            lines.append(f"- {tool.label}: missing; winget package: {tool.package_id}")
        lines.extend(
            [
                "",
                "Install missing system tools automatically by running:",
                "  generator_exe.bat",
                "or run the Python bootstrap directly:",
                "  python scripts\\build_exe.py --bootstrap",
                "",
                "The bootstrap mode uses winget for Node.js, Rust, Visual Studio Build Tools, and WebView2 Runtime.",
            ]
        )
        return "\n".join(lines)


@dataclass(frozen=True)
class BackendSourcePlan:
    local_path: Path
    git_url: str
    archive_url: str
    needs_clone: bool


REQUIRED_TOOLS = [
    BuildTool("npm", "Node.js/npm", "OpenJS.NodeJS.LTS"),
    BuildTool("cargo", "Rust/Cargo", "Rustlang.Rustup"),
]

SHINDEN_API_GIT_URL = "https://github.com/NefilimPL/shinden-pl-api-rs.git"
SHINDEN_API_ARCHIVE_URL = "https://github.com/NefilimPL/shinden-pl-api-rs/archive/refs/heads/master.zip"
SHINDEN_API_REPO_DIR = "shinden-pl-api-rs"

WINDOWS_TOOL_ALIASES = {
    "npm": ("npm", "npm.cmd"),
    "cargo": ("cargo", "cargo.exe"),
    "git": ("git", "git.exe"),
}

WINDOWS_BUILD_PACKAGES = [
    WingetPackage(
        "Microsoft.VisualStudio.2022.BuildTools",
        "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended",
    ),
    WingetPackage("Microsoft.EdgeWebView2Runtime"),
]

WINGET_ALREADY_SATISFIED_MESSAGES = (
    "No available upgrade found.",
    "No newer package versions are available",
)


def find_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def build_environment(root: Path, base_env: dict[str, str] | None = None) -> dict[str, str]:
    env = dict(base_env or os.environ)
    env["SHINDEN_CLIENT_LOG_DIR"] = str(root / "logs")
    env["SHINDEN_BUILD_PROJECT_ROOT"] = str(root)
    env.setdefault("CARGO_TARGET_DIR", str(default_cargo_target_dir(root)))
    return env


def default_cargo_target_dir(root: Path) -> Path:
    if os.name == "nt" and (local_app_data := os.environ.get("LOCALAPPDATA")):
        return Path(local_app_data) / "ShindenClient" / "cargo-target"
    return root / "src-tauri" / "target"


def default_backend_repo_path(root: Path) -> Path:
    return root.parent / SHINDEN_API_REPO_DIR


def backend_repo_exists(path: Path) -> bool:
    return (path / "Cargo.toml").is_file()


def plan_backend_source(
    root: Path,
    *,
    local_path: Path | None = None,
    git_url: str = SHINDEN_API_GIT_URL,
    archive_url: str = SHINDEN_API_ARCHIVE_URL,
) -> BackendSourcePlan:
    backend_path = local_path or default_backend_repo_path(root)
    return BackendSourcePlan(
        local_path=backend_path,
        git_url=git_url,
        archive_url=archive_url,
        needs_clone=not backend_repo_exists(backend_path),
    )


def backend_source_log_lines(plan: BackendSourcePlan) -> list[str]:
    if plan.needs_clone:
        return [
            f"Backend source: GitHub fallback {plan.git_url}",
            f"Local backend repo not found at: {plan.local_path}",
            f"Will fetch backend repo into: {plan.local_path}",
        ]

    return [
        f"Backend source: local repo {plan.local_path}",
        f"GitHub fallback if missing: {plan.git_url}",
    ]


def ensure_backend_source(
    plan: BackendSourcePlan,
    *,
    cwd: Path,
    env: dict[str, str],
    log_file,
    command_runner: Callable[..., None] | None = None,
    git_command: str | None = None,
    tool_lookup: Callable[[str], str | None] = shutil.which,
    archive_downloader: Callable[[str, Path], None] | None = None,
) -> None:
    if not plan.needs_clone:
        return

    if plan.local_path.exists():
        raise BuildError(
            f"Backend path exists but is not a Cargo repo: {plan.local_path}. "
            "Remove it, add a Cargo.toml there, or set up shinden-pl-api-rs manually."
        )

    git = git_command if git_command is not None else resolve_tool("git", tool_lookup=tool_lookup)

    plan.local_path.parent.mkdir(parents=True, exist_ok=True)
    if git is not None:
        runner = command_runner or run_command
        runner(
            [git, "clone", plan.git_url, str(plan.local_path)],
            cwd=cwd,
            env=env,
            log_file=log_file,
        )
    else:
        write_log(log_file, f"Git not found in PATH; downloading backend archive: {plan.archive_url}")
        fetch_backend_archive(
            plan,
            archive_downloader=archive_downloader or download_backend_archive,
            log_file=log_file,
        )

    if not backend_repo_exists(plan.local_path):
        raise BuildError(f"Fetched backend repo is missing Cargo.toml: {plan.local_path}")


def download_backend_archive(url: str, destination: Path) -> None:
    with urllib.request.urlopen(url) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def fetch_backend_archive(
    plan: BackendSourcePlan,
    *,
    archive_downloader: Callable[[str, Path], None],
    log_file,
) -> None:
    with tempfile.TemporaryDirectory(prefix="shinden-api-", dir=plan.local_path.parent) as temp_dir:
        temp_path = Path(temp_dir)
        archive_path = temp_path / "shinden-pl-api-rs.zip"
        archive_downloader(plan.archive_url, archive_path)
        extract_backend_archive(archive_path, plan.local_path, temp_path / "extract")
        write_log(log_file, f"Downloaded backend archive into: {plan.local_path}")


def extract_backend_archive(archive_path: Path, destination: Path, extract_dir: Path) -> None:
    with zipfile.ZipFile(archive_path) as archive:
        validate_archive_members(archive)
        archive.extractall(extract_dir)

    candidates = [
        child
        for child in extract_dir.iterdir()
        if child.is_dir() and (child / "Cargo.toml").is_file()
    ]
    if not candidates:
        raise BuildError(f"Backend archive did not contain a Cargo repo: {archive_path}")
    if len(candidates) > 1:
        raise BuildError(f"Backend archive contained multiple Cargo repos: {archive_path}")

    shutil.move(str(candidates[0]), str(destination))


def validate_archive_members(archive: zipfile.ZipFile) -> None:
    for member in archive.infolist():
        parts = Path(member.filename).parts
        if not parts or Path(member.filename).is_absolute() or ".." in parts:
            raise BuildError(f"Refusing to extract unsafe backend archive path: {member.filename}")


def plan_commands(
    root: Path,
    *,
    node_modules_exists: bool | None = None,
    skip_install: bool = False,
    npm_command: str = "npm",
    tauri_config: Path | None = None,
) -> list[list[str]]:
    if node_modules_exists is None:
        node_modules_exists = (root / "node_modules").exists()

    commands: list[list[str]] = []
    if not skip_install and not node_modules_exists:
        commands.append([npm_command, "install"])

    build_command = [npm_command, "run", "tauri", "--", "build"]
    if tauri_config is not None:
        build_command.extend(["--config", str(tauri_config)])
    commands.append(build_command)
    return commands


def write_local_tauri_config(root: Path) -> Path:
    config_path = root / "logs" / "tauri-local-build.conf.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config = {
        "bundle": {
            "createUpdaterArtifacts": False,
        },
    }
    config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
    return config_path


def resolve_tool(
    name: str,
    *,
    tool_lookup: Callable[[str], str | None] = shutil.which,
) -> str | None:
    for candidate in WINDOWS_TOOL_ALIASES.get(name, (name,)):
        if path := tool_lookup(candidate):
            return path
    return None


def ensure_tool(name: str, *, tool_lookup: Callable[[str], str | None] = shutil.which) -> str:
    path = resolve_tool(name, tool_lookup=tool_lookup)
    if path is None:
        raise BuildError(
            f"Could not find '{name}' in PATH. Install Node.js/npm and Rust/Tauri requirements, "
            "then run this generator again."
        )
    return path


def preflight(
    tool_lookup: Callable[[str], str | None] = shutil.which,
) -> PreflightResult:
    found_paths = {
        tool.name: path
        for tool in REQUIRED_TOOLS
        if (path := resolve_tool(tool.name, tool_lookup=tool_lookup)) is not None
    }
    return PreflightResult(required_tools=REQUIRED_TOOLS, found_paths=found_paths)


def winget_install_commands(
    result: PreflightResult,
    *,
    accept_agreements: bool = False,
) -> list[list[str]]:
    packages: list[WingetPackage] = [
        WingetPackage(tool.package_id) for tool in result.missing_required
    ]
    packages.extend(WINDOWS_BUILD_PACKAGES)

    commands: list[list[str]] = []
    seen: set[str] = set()
    for package in packages:
        if package.package_id in seen:
            continue
        seen.add(package.package_id)

        command = ["winget", "install", "--id", package.package_id, "-e"]
        if package.override:
            command.extend(["--override", package.override])
        if accept_agreements:
            command.extend(["--accept-source-agreements", "--accept-package-agreements"])
        commands.append(command)
    return commands


def run_command(
    command: list[str],
    *,
    cwd: Path,
    env: dict[str, str],
    log_file,
    accepted_failure_fragments: tuple[str, ...] = (),
) -> None:
    write_log(log_file, f"$ {' '.join(command)}")
    process = subprocess.Popen(
        command,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    assert process.stdout is not None
    output_lines: list[str] = []
    for line in process.stdout:
        output_lines.append(line)
        write_console(line)
        log_file.write(line)
        log_file.flush()
    process.stdout.close()

    exit_code = process.wait()
    if exit_code != 0:
        output = "".join(output_lines)
        if any(fragment in output for fragment in accepted_failure_fragments):
            write_log(
                log_file,
                f"Command returned exit code {exit_code}, but output indicates the command is already satisfied; continuing.",
            )
            return
        raise BuildError(f"Command failed with exit code {exit_code}: {' '.join(command)}")


def collect_exe_artifacts(root: Path, cargo_target_dir: Path | None = None) -> list[Path]:
    target_dirs: list[Path] = []
    if cargo_target_dir is not None:
        target_dirs.append(cargo_target_dir)
    project_target_dir = root / "src-tauri" / "target"
    if project_target_dir not in target_dirs:
        target_dirs.append(project_target_dir)

    artifacts: list[Path] = []

    for target_dir in target_dirs:
        release_dir = target_dir / "release"
        standalone = release_dir / "ShindenClient.exe"
        if standalone.exists():
            artifacts.append(standalone)

        bundle_dir = release_dir / "bundle"
        if bundle_dir.exists():
            artifacts.extend(sorted(bundle_dir.rglob("*.exe")))

    return artifacts


def copy_artifacts(artifacts: Iterable[Path], dist_dir: Path) -> list[Path]:
    dist_dir.mkdir(parents=True, exist_ok=True)
    copied: list[Path] = []

    for artifact in artifacts:
        destination = dist_dir / artifact.name
        counter = 2
        while destination.exists():
            destination = dist_dir / f"{artifact.stem}-{counter}{artifact.suffix}"
            counter += 1
        shutil.copy2(artifact, destination)
        copied.append(destination)

    return copied


def clean_dist(root: Path, dist_dir: Path) -> None:
    resolved_root = root.resolve()
    resolved_dist = dist_dir.resolve()
    if resolved_dist == resolved_root or resolved_root not in resolved_dist.parents:
        raise BuildError(f"Refusing to clean a directory outside the project: {resolved_dist}")
    if dist_dir.exists():
        shutil.rmtree(dist_dir)


def write_log(log_file, message: str) -> None:
    line = f"[{datetime.now().isoformat(timespec='seconds')}] {message}\n"
    write_console(line)
    log_file.write(line)
    log_file.flush()


def write_console(text: str) -> None:
    encoding = sys.stdout.encoding or "utf-8"
    safe_text = text.encode(encoding, errors="replace").decode(encoding, errors="replace")
    sys.stdout.write(safe_text)
    sys.stdout.flush()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a local Shinden Client Windows EXE.")
    parser.add_argument("--skip-install", action="store_true", help="Do not run npm install when node_modules is missing.")
    parser.add_argument("--clean", action="store_true", help="Remove dist-exe before copying new artifacts.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned commands without running the build.")
    parser.add_argument("--no-copy", action="store_true", help="Leave artifacts in src-tauri/target/release only.")
    parser.add_argument("--preflight", action="store_true", help="Check system build requirements and exit.")
    parser.add_argument("--bootstrap", action="store_true", help="Install missing system build tools with winget and exit.")
    parser.add_argument("--yes", action="store_true", help="Accept winget source/package agreements during bootstrap.")
    parser.add_argument(
        "--updater-artifacts",
        action="store_true",
        help="Create signed updater artifacts. Requires TAURI_SIGNING_PRIVATE_KEY.",
    )
    parser.add_argument("--dist", default="dist-exe", help="Output directory for copied EXE artifacts.")
    return parser.parse_args(argv)


def main(
    argv: list[str] | None = None,
    *,
    root_override: Path | None = None,
    tool_lookup: Callable[[str], str | None] = shutil.which,
) -> int:
    args = parse_args(argv)
    root = root_override or find_project_root()
    log_dir = root / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "build-exe.log"
    dist_dir = root / args.dist

    with log_path.open("a", encoding="utf-8") as log_file:
        write_log(log_file, "Starting local EXE build")
        write_log(log_file, f"Project root: {root}")
        write_log(log_file, f"Runtime app logs: {log_dir / 'shinden-client.log'}")

        preflight_result = preflight(tool_lookup=tool_lookup)
        write_log(log_file, preflight_result.summary())
        backend_plan = plan_backend_source(root)
        for line in backend_source_log_lines(backend_plan):
            write_log(log_file, line)

        if args.preflight:
            return 0 if preflight_result.ok else 1

        if args.bootstrap:
            if tool_lookup("winget") is None:
                raise BuildError("Could not find 'winget' in PATH. Install missing tools manually or enable App Installer.")
            commands = winget_install_commands(preflight_result, accept_agreements=args.yes)
            if not commands:
                write_log(log_file, "Bootstrap skipped. Required tools are already available.")
                return 0
            for command in commands:
                run_command(
                    command,
                    cwd=root,
                    env=os.environ.copy(),
                    log_file=log_file,
                    accepted_failure_fragments=WINGET_ALREADY_SATISFIED_MESSAGES,
                )
            write_log(log_file, "Bootstrap finished. Reopen your terminal before building so PATH refreshes.")
            return 0

        if not args.dry_run and not preflight_result.ok:
            raise BuildError(preflight_result.summary())

        npm_command = (resolve_tool("npm", tool_lookup=tool_lookup) or "npm") if args.dry_run else ensure_tool("npm", tool_lookup=tool_lookup)
        tauri_config = None if args.updater_artifacts else write_local_tauri_config(root)
        env = build_environment(root)
        write_log(log_file, f"Cargo target dir: {env['CARGO_TARGET_DIR']}")
        commands = plan_commands(
            root,
            skip_install=args.skip_install,
            npm_command=npm_command,
            tauri_config=tauri_config,
        )

        if args.dry_run:
            write_log(log_file, "Dry run only. Planned commands:")
            if backend_plan.needs_clone:
                if git := resolve_tool("git", tool_lookup=tool_lookup):
                    write_log(log_file, f"  {git} clone {backend_plan.git_url} {backend_plan.local_path}")
                else:
                    write_log(log_file, f"  download {backend_plan.archive_url} -> {backend_plan.local_path}")
            for command in commands:
                write_log(log_file, f"  {' '.join(command)}")
            return 0

        if args.clean:
            clean_dist(root, dist_dir)

        ensure_backend_source(backend_plan, cwd=root, env=env, log_file=log_file, tool_lookup=tool_lookup)

        for command in commands:
            run_command(command, cwd=root, env=env, log_file=log_file)

        artifacts = collect_exe_artifacts(root, Path(env["CARGO_TARGET_DIR"]))
        if not artifacts:
            raise BuildError("Build finished, but no EXE artifacts were found in src-tauri/target/release.")

        if args.no_copy:
            write_log(log_file, "EXE artifacts left in place:")
            for artifact in artifacts:
                write_log(log_file, f"  {artifact}")
            return 0

        copied = copy_artifacts(artifacts, dist_dir)
        write_log(log_file, "Copied EXE artifacts:")
        for artifact in copied:
            write_log(log_file, f"  {artifact}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        root = find_project_root()
        log_dir = root / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        with (log_dir / "build-exe.log").open("a", encoding="utf-8") as log_file:
            write_log(log_file, f"Build failed: {error}")
            log_file.write(traceback.format_exc())
            log_file.flush()
        print(f"Build failed. See {log_dir / 'build-exe.log'}", file=sys.stderr)
        raise SystemExit(1)
