import unittest
import io
import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

from scripts import build_exe


class BuildExePlanTests(unittest.TestCase):
    def test_single_file_launcher_runs_preflight_bootstrap_and_build(self):
        launcher = Path(__file__).resolve().parents[1] / "generator_exe.bat"

        contents = launcher.read_text(encoding="utf-8")

        self.assertIn("setlocal EnableExtensions EnableDelayedExpansion", contents)
        self.assertIn("scripts\\build_exe.py --preflight", contents)
        self.assertIn("scripts\\build_exe.py --bootstrap --yes", contents)
        self.assertIn("scripts\\build_exe.py %BUILD_ARGS%", contents)
        self.assertIn("exit /b !ERRORLEVEL!", contents)
        self.assertIn("BOOTSTRAP_UNAVAILABLE", contents)
        self.assertIn(":refresh_path", contents)
        self.assertIn(":log_tool_lookup", contents)
        self.assertIn(":has_py3", contents)
        self.assertIn(":has_python", contents)
        self.assertIn("Preflight exit code:", contents)
        self.assertIn('start "" "%ROOT%dist-exe"', contents)

    def test_launcher_prefers_valid_py_launcher_over_windowsapps_python_alias(self):
        launcher = Path(__file__).resolve().parents[1] / "generator_exe.bat"

        contents = launcher.read_text(encoding="utf-8")

        self.assertIn("py -3 --version >nul 2>nul", contents)
        self.assertIn("python --version >nul 2>nul", contents)
        self.assertLess(contents.index("call :has_py3"), contents.index("call :has_python"))
        self.assertLess(contents.index("py -3 %*"), contents.index("python %*"))

    def test_launcher_does_not_force_winget_bootstrap_from_missing_stamp(self):
        launcher = Path(__file__).resolve().parents[1] / "generator_exe.bat"

        contents = launcher.read_text(encoding="utf-8")

        self.assertIn('if not "%PREFLIGHT_EXIT%"=="0" set "NEED_BOOTSTRAP=1"', contents)
        self.assertNotIn("BOOTSTRAP_STAMP", contents)
        self.assertNotIn(".generator-exe-bootstrap-ok", contents)

    def test_launcher_prompts_for_backend_branch(self):
        launcher = Path(__file__).resolve().parents[1] / "generator_exe.bat"

        contents = launcher.read_text(encoding="utf-8")

        self.assertIn("call :select_backend_branch", contents)
        self.assertIn(":select_backend_branch", contents)
        self.assertIn("--list-backend-branches", contents)
        self.assertNotIn("git ls-remote --heads", contents)
        self.assertIn("--backend-branch", contents)
        self.assertIn("Main", contents)
        self.assertIn("dev", contents)

    def test_bootstrap_wrapper_can_force_bootstrap_explicitly(self):
        launcher = Path(__file__).resolve().parents[1] / "bootstrap-exe.bat"

        contents = launcher.read_text(encoding="utf-8")

        self.assertIn("call generator_exe.bat --force-bootstrap %*", contents)

    def test_plan_skips_install_when_node_modules_exist(self):
        root = Path("C:/project")

        steps = build_exe.plan_commands(root, node_modules_exists=True, skip_install=False)

        self.assertEqual(steps, [["npm", "run", "tauri", "--", "build"]])

    def test_plan_installs_dependencies_when_node_modules_are_missing(self):
        root = Path("C:/project")

        steps = build_exe.plan_commands(root, node_modules_exists=False, skip_install=False)

        self.assertEqual(
            steps,
            [
                ["npm", "install"],
                ["npm", "run", "tauri", "--", "build"],
            ],
        )

    def test_plan_passes_local_tauri_config_to_build(self):
        root = Path("C:/project")
        config_path = root / "logs" / "tauri-local-build.conf.json"

        steps = build_exe.plan_commands(
            root,
            node_modules_exists=True,
            skip_install=False,
            tauri_config=config_path,
        )

        self.assertEqual(
            steps,
            [
                [
                    "npm",
                    "run",
                    "tauri",
                    "--",
                    "build",
                    "--config",
                    str(config_path),
                ],
            ],
        )

    def test_local_tauri_config_disables_updater_artifacts(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)

            config_path = build_exe.write_local_tauri_config(root)

            self.assertEqual(config_path, root / "logs" / "tauri-local-build.conf.json")
            contents = json.loads(config_path.read_text(encoding="utf-8"))
            self.assertEqual(contents["bundle"]["createUpdaterArtifacts"], False)

    def test_project_environment_points_logs_at_project_root(self):
        root = Path("C:/project")

        env = build_exe.build_environment(root, base_env={"PATH": "example"})

        self.assertEqual(env["SHINDEN_CLIENT_LOG_DIR"], str(root / "logs"))
        self.assertEqual(env["SHINDEN_BUILD_PROJECT_ROOT"], str(root))
        self.assertEqual(env["PATH"], "example")

    def test_preflight_reports_missing_build_tools(self):
        result = build_exe.preflight(tool_lookup=lambda name: None)

        self.assertFalse(result.ok)
        self.assertEqual(
            [tool.name for tool in result.missing_required],
            ["npm", "cargo"],
        )
        self.assertIn("Node.js", result.summary())
        self.assertIn("--bootstrap", result.summary())

    def test_preflight_passes_when_required_tools_exist(self):
        result = build_exe.preflight(tool_lookup=lambda name: f"C:/tools/{name}.exe")

        self.assertTrue(result.ok)
        self.assertEqual(result.missing_required, [])

    def test_preflight_accepts_windows_command_shims(self):
        paths = {
            "npm.cmd": "C:/Program Files/nodejs/npm.cmd",
            "cargo.exe": "C:/Users/Kompilator/.cargo/bin/cargo.exe",
        }

        result = build_exe.preflight(tool_lookup=paths.get)

        self.assertTrue(result.ok)
        self.assertEqual(result.found_paths["npm"], paths["npm.cmd"])
        self.assertEqual(result.found_paths["cargo"], paths["cargo.exe"])

    def test_resolve_tool_accepts_windows_command_shim(self):
        paths = {"npm.cmd": "C:/Program Files/nodejs/npm.cmd"}

        self.assertEqual(
            build_exe.resolve_tool("npm", tool_lookup=paths.get),
            paths["npm.cmd"],
        )

    def test_parse_args_accepts_backend_branch(self):
        args = build_exe.parse_args(["--backend-branch", "dev"])

        self.assertEqual(args.backend_branch, "dev")

    def test_backend_branch_helpers(self):
        branches = build_exe.normalize_backend_branches(
            [
                "origin/main",
                "origin/dev",
                "origin/HEAD -> origin/main",
                "feature/local-cache",
                "main",
            ]
        )

        self.assertEqual(branches, ["main", "dev", "feature/local-cache"])
        self.assertEqual(build_exe.resolve_backend_branch_choice("Main", ["master"]), "master")
        self.assertEqual(build_exe.resolve_backend_branch_choice("Main", ["main"]), "main")
        self.assertEqual(build_exe.resolve_backend_branch_choice("dev", ["main", "dev"]), "dev")
        self.assertEqual(build_exe.backend_branch_download_candidates("Main"), ["main", "master"])
        self.assertEqual(build_exe.backend_branch_download_candidates("dev"), ["dev"])
        self.assertEqual(
            build_exe.backend_archive_url_for_branch("dev"),
            "https://github.com/NefilimPL/shinden-pl-api-rs/archive/refs/heads/dev.zip",
        )

    def test_backend_source_temp_root_does_not_use_frontend_build_output(self):
        root = Path("C:/project")

        temp_root = build_exe.backend_source_temp_root(root)

        self.assertEqual(temp_root, root / "cache" / "backend-source")
        self.assertNotEqual(temp_root.parts[len(root.parts)], "build")

    def test_fetch_remote_backend_branches_uses_github_api_without_git(self):
        payload = json.dumps(
            [
                {"name": "master"},
                {"name": "dev"},
                {"name": "feature/api"},
            ]
        ).encode("utf-8")
        requested_urls = []

        def fake_json_downloader(url):
            requested_urls.append(url)
            return payload

        branches = build_exe.fetch_remote_backend_branches(json_downloader=fake_json_downloader)

        self.assertEqual(branches, ["master", "dev", "feature/api"])
        self.assertEqual(
            requested_urls,
            ["https://api.github.com/repos/NefilimPL/shinden-pl-api-rs/branches?per_page=100"],
        )

    def test_winget_bootstrap_commands_install_missing_packages(self):
        result = build_exe.preflight(tool_lookup=lambda name: None)

        commands = build_exe.winget_install_commands(result, accept_agreements=True)

        self.assertEqual(
            commands,
            [
                [
                    "winget",
                    "install",
                    "--id",
                    "OpenJS.NodeJS.LTS",
                    "-e",
                    "--accept-source-agreements",
                    "--accept-package-agreements",
                ],
                [
                    "winget",
                    "install",
                    "--id",
                    "Rustlang.Rustup",
                    "-e",
                    "--accept-source-agreements",
                    "--accept-package-agreements",
                ],
                [
                    "winget",
                    "install",
                    "--id",
                    "Microsoft.VisualStudio.2022.BuildTools",
                    "-e",
                    "--override",
                    "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended",
                    "--accept-source-agreements",
                    "--accept-package-agreements",
                ],
                [
                    "winget",
                    "install",
                    "--id",
                    "Microsoft.EdgeWebView2Runtime",
                    "-e",
                    "--accept-source-agreements",
                    "--accept-package-agreements",
                ],
            ],
        )

    def test_winget_bootstrap_still_installs_windows_build_prerequisites(self):
        result = build_exe.preflight(tool_lookup=lambda name: f"C:/tools/{name}.exe")

        commands = build_exe.winget_install_commands(result)

        self.assertEqual(
            commands,
            [
                [
                    "winget",
                    "install",
                    "--id",
                    "Microsoft.VisualStudio.2022.BuildTools",
                    "-e",
                    "--override",
                    "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended",
                ],
                [
                    "winget",
                    "install",
                    "--id",
                    "Microsoft.EdgeWebView2Runtime",
                    "-e",
                ],
            ],
        )

    def test_backend_source_prefers_local_repo_when_cargo_toml_exists(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "shinden-client"
            local_backend = root.parent / "shinden-pl-api-rs"
            local_backend.mkdir(parents=True)
            (local_backend / "Cargo.toml").write_text("[package]\nname = \"shinden-pl-api\"\n", encoding="utf-8")

            plan = build_exe.plan_backend_source(root)

            self.assertFalse(plan.needs_clone)
            self.assertEqual(plan.local_path, local_backend)
            self.assertIn("local repo", "\n".join(build_exe.backend_source_log_lines(plan)))

    def test_backend_source_falls_back_to_github_when_local_repo_is_missing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "shinden-client"

            plan = build_exe.plan_backend_source(root)

            self.assertTrue(plan.needs_clone)
            self.assertEqual(plan.git_url, "https://github.com/NefilimPL/shinden-pl-api-rs.git")
            log_text = "\n".join(build_exe.backend_source_log_lines(plan))
            self.assertIn("GitHub fallback", log_text)
            self.assertIn(str(root.parent / "shinden-pl-api-rs"), log_text)

    def test_backend_source_clone_populates_missing_local_repo(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "shinden-client"
            root.mkdir()
            plan = build_exe.plan_backend_source(root)
            commands = []

            def fake_runner(command, *, cwd, env, log_file):
                commands.append((command, cwd, env))
                plan.local_path.mkdir()
                (plan.local_path / "Cargo.toml").write_text("[package]\nname = \"shinden-pl-api\"\n", encoding="utf-8")

            build_exe.ensure_backend_source(
                plan,
                cwd=root,
                env={"PATH": "example"},
                log_file=io.StringIO(),
                command_runner=fake_runner,
                git_command="git",
            )

            self.assertEqual(
                commands,
                [
                    (
                        ["git", "clone", "https://github.com/NefilimPL/shinden-pl-api-rs.git", str(plan.local_path)],
                        root,
                        {"PATH": "example"},
                    )
                ],
            )

    def test_backend_source_downloads_github_archive_when_git_is_missing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "shinden-client"
            root.mkdir()
            plan = build_exe.plan_backend_source(root)
            downloads = []

            def fake_downloader(url, destination):
                downloads.append((url, destination))
                with zipfile.ZipFile(destination, "w") as archive:
                    archive.writestr("shinden-pl-api-rs-master/Cargo.toml", "[package]\nname = \"shinden-pl-api\"\n")
                    archive.writestr("shinden-pl-api-rs-master/src/lib.rs", "")

            build_exe.ensure_backend_source(
                plan,
                cwd=root,
                env={"PATH": "example"},
                log_file=io.StringIO(),
                tool_lookup=lambda name: None,
                archive_downloader=fake_downloader,
            )

            self.assertEqual(downloads[0][0], "https://github.com/NefilimPL/shinden-pl-api-rs/archive/refs/heads/master.zip")
            self.assertTrue((plan.local_path / "Cargo.toml").is_file())

    def test_prepare_backend_source_downloads_selected_branch(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "shinden-client"
            root.mkdir()
            commands = []

            def fake_runner(command, *, cwd, env, log_file):
                commands.append((command, cwd, env))
                backend_path = root / "cache" / "backend-source" / "shinden-pl-api-rs"
                backend_path.mkdir(parents=True)
                (backend_path / "Cargo.toml").write_text("[package]\nname = \"shinden-pl-api\"\n", encoding="utf-8")

            source = build_exe.prepare_backend_source(
                root,
                branch="dev",
                log_file=io.StringIO(),
                command_runner=fake_runner,
                git_command="git",
            )

            self.assertEqual(source.path, root / "cache" / "backend-source" / "shinden-pl-api-rs")
            self.assertEqual(source.branch, "dev")
            self.assertFalse(source.is_local_fallback)
            self.assertEqual(
                commands,
                [
                    (
                        [
                            "git",
                            "clone",
                            "--branch",
                            "dev",
                            "--single-branch",
                            "https://github.com/NefilimPL/shinden-pl-api-rs.git",
                            str(source.path),
                        ],
                        root,
                        os.environ.copy(),
                    )
                ],
            )

    def test_prepare_backend_source_uses_local_fallback_when_remote_fails(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "shinden-client"
            root.mkdir()
            local_backend = root.parent / "shinden-pl-api-rs"
            local_backend.mkdir()
            (local_backend / "Cargo.toml").write_text("[package]\nname = \"shinden-pl-api\"\n", encoding="utf-8")

            def failing_runner(command, *, cwd, env, log_file):
                raise build_exe.BuildError("clone failed")

            def failing_downloader(url, destination):
                raise OSError("archive failed")

            source = build_exe.prepare_backend_source(
                root,
                branch="dev",
                log_file=io.StringIO(),
                command_runner=failing_runner,
                git_command="git",
                archive_downloader=failing_downloader,
            )

            self.assertEqual(source.path, local_backend)
            self.assertEqual(source.branch, "dev")
            self.assertTrue(source.is_local_fallback)

    def test_backend_manifest_rewrite_and_restore(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "shinden-client"
            manifest = root / "src-tauri" / "Cargo.toml"
            backend_path = root / "cache" / "backend-source" / "shinden-pl-api-rs"
            manifest.parent.mkdir(parents=True)
            backend_path.mkdir(parents=True)
            original = "\n".join(
                [
                    "[dependencies]",
                    'tauri = { version = "2" }',
                    'shinden-pl-api = { path = "../../shinden-pl-api-rs" }',
                    'serde_json = "1"',
                    "",
                ]
            )
            manifest.write_text(original, encoding="utf-8")

            backup_path = build_exe.rewrite_backend_dependency_path(root, backend_path)

            rewritten = manifest.read_text(encoding="utf-8")
            self.assertIn(f'shinden-pl-api = {{ path = "{backend_path.as_posix()}" }}', rewritten)
            self.assertIn('serde_json = "1"', rewritten)
            self.assertEqual(backup_path, root / "logs" / "Cargo.toml.build-exe.bak")
            self.assertEqual(backup_path.read_text(encoding="utf-8"), original)

            build_exe.restore_backend_manifest(root, backup_path)

            self.assertEqual(manifest.read_text(encoding="utf-8"), original)
            self.assertFalse(backup_path.exists())

    def test_preflight_does_not_fail_when_backend_needs_github_archive_fallback(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "shinden-client"

            exit_code = build_exe.main(
                ["--preflight"],
                root_override=root,
                tool_lookup=lambda name: f"C:/tools/{name}.exe" if name in {"npm.cmd", "cargo.exe"} else None,
            )

            self.assertEqual(exit_code, 0)

    def test_dry_run_logs_selected_backend_branch(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "shinden-client"
            root.mkdir()

            exit_code = build_exe.main(
                ["--dry-run", "--backend-branch", "dev", "--skip-install", "--no-copy"],
                root_override=root,
                tool_lookup=lambda name: f"C:/tools/{name}.exe",
            )

            log_text = (root / "logs" / "build-exe.log").read_text(encoding="utf-8")
            self.assertEqual(exit_code, 0)
            self.assertIn("Backend branch: dev", log_text)
            self.assertIn("git clone --branch dev --single-branch", log_text)

    def test_run_command_can_accept_winget_existing_package_exit(self):
        log = io.StringIO()

        build_exe.run_command(
            [
                sys.executable,
                "-c",
                "print('No available upgrade found.'); raise SystemExit(42)",
            ],
            cwd=Path.cwd(),
            env=os.environ.copy(),
            log_file=log,
            accepted_failure_fragments=("No available upgrade found.",),
        )

        self.assertIn("output indicates the command is already satisfied", log.getvalue())


if __name__ == "__main__":
    unittest.main()
