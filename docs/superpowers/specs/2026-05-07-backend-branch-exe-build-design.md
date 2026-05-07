# Backend Branch Selection for EXE Builds

## Goal

The local EXE generator should build Shinden Client against a selected backend branch. The primary backend source for the build must be a fresh copy downloaded from the selected branch, while the existing local `../shinden-pl-api-rs` checkout is only a fallback when downloading the selected branch fails.

## Current State

`scripts/build_exe.py` builds the Tauri app and expects `src-tauri/Cargo.toml` to resolve `shinden-pl-api` from `../../shinden-pl-api-rs`. If the local backend checkout is missing, the script clones or downloads the backend repository into that path. This makes the local checkout both the normal build source and the fallback source.

## Proposed Behavior

`generator_exe.bat` will let the user choose the backend branch before the actual build unless `--backend-branch` is already supplied. It will try to detect remote backend branches with `git ls-remote --heads`. If detection fails or returns no usable choices, it will offer `Main` and `dev`. The `Main` choice resolves to `main` when available and otherwise falls back to `master`, because the existing backend repository currently exposes `master`.

`scripts/build_exe.py` will accept `--backend-branch <branch>`. During a normal build it will prepare an isolated backend source in a temporary build area under the ignored `cache/backend-source` directory. The script will first try `git clone --branch <branch> --single-branch`. If git is unavailable or the clone fails, it will try the GitHub branch archive for the same branch. If both remote download paths fail, the script will use the local `../shinden-pl-api-rs` checkout when it is a valid Cargo repository.

The build should use the selected backend source without permanently editing `src-tauri/Cargo.toml`. Because the current dependency is an explicit Cargo path dependency, the script will temporarily rewrite only the `shinden-pl-api = { path = ... }` entry to point at the prepared backend source, keep a short-lived backup of the original manifest, and restore the original manifest in a `finally` cleanup path. After the build attempt finishes, temporary backend files and temporary manifest backup files will be removed, whether the build succeeds or fails.

## Data Flow

1. The launcher detects or falls back to a list of backend branch choices.
2. The user selects a branch, or an explicit `--backend-branch` is passed through automation.
3. `build_exe.py` prepares a remote backend source for that branch.
4. If remote preparation fails, `build_exe.py` uses the local backend checkout as a fallback.
5. The script temporarily points `src-tauri/Cargo.toml` at the selected backend source.
6. The Tauri build runs with Cargo using that selected backend source.
7. The original Cargo manifest is restored.
8. Temporary backend sources and generated build files are cleaned up.

## Error Handling

Branch detection failures are non-fatal and fall back to `Main` and `dev`. Remote backend download failures are logged and then fall back to the local backend checkout. If neither the selected remote branch nor the local fallback provides a valid Cargo repository, the build fails with a clear message explaining which branch was requested and which fallback path was checked.

## Testing

Python unit tests will cover branch selection planning, remote clone commands, archive URL generation for selected branches, fallback to local backend when remote preparation fails, temporary Cargo manifest rewriting and restoration, and cleanup of temporary backend files. Existing tests for preflight, bootstrapping, command planning, and artifact collection should continue to pass.
