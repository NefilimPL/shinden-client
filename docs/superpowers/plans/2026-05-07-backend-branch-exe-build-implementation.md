# Backend Branch EXE Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the EXE generator detect backend branches at startup, prompt the user to choose one, build against a freshly downloaded copy of that branch, and fall back to the local backend checkout only when remote download fails.

**Architecture:** `generator_exe.bat` owns the interactive branch prompt and passes `--backend-branch` into `scripts/build_exe.py`. `scripts/build_exe.py` owns backend source preparation, temporary Cargo manifest rewriting, local fallback, and cleanup. Existing Python unit tests cover the build planning and source preparation behavior without running a real Tauri build.

**Tech Stack:** Windows batch, Python `unittest`, Git CLI, Tauri/Cargo path dependency.

---

### Task 1: Add Backend Branch Helpers

**Files:**
- Modify: `tests/test_build_exe.py`
- Modify: `scripts/build_exe.py`

- [ ] **Step 1: Write failing tests**

Add tests that expect:

```python
branches = build_exe.normalize_backend_branches(["origin/main", "origin/dev", "origin/HEAD -> origin/main"])
self.assertEqual(branches, ["main", "dev"])
self.assertEqual(build_exe.resolve_backend_branch_choice("Main", ["master"]), "master")
self.assertEqual(build_exe.backend_archive_url_for_branch("dev"), "https://github.com/NefilimPL/shinden-pl-api-rs/archive/refs/heads/dev.zip")
```

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m unittest tests.test_build_exe.BuildExePlanTests.test_backend_branch_helpers -v`

Expected: fail because helper functions do not exist.

- [ ] **Step 3: Implement minimal helpers**

Add `DEFAULT_BACKEND_BRANCH_CHOICES`, `normalize_backend_branches`, `resolve_backend_branch_choice`, and `backend_archive_url_for_branch` in `scripts/build_exe.py`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python -m unittest tests.test_build_exe.BuildExePlanTests.test_backend_branch_helpers -v`

Expected: pass.

### Task 2: Download Selected Backend Branch with Local Fallback

**Files:**
- Modify: `tests/test_build_exe.py`
- Modify: `scripts/build_exe.py`

- [ ] **Step 1: Write failing tests**

Add tests that expect:

```python
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
```

Also add a test where the fake remote clone raises `BuildError` and the local fallback repo is used.

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m unittest tests.test_build_exe.BuildExePlanTests.test_prepare_backend_source_downloads_selected_branch tests.test_build_exe.BuildExePlanTests.test_prepare_backend_source_uses_local_fallback_when_remote_fails -v`

Expected: fail because `prepare_backend_source` does not exist.

- [ ] **Step 3: Implement minimal source preparation**

Add a `PreparedBackendSource` dataclass and `prepare_backend_source`. Remote source goes under `cache/backend-source/shinden-pl-api-rs`, gets cleaned before reuse, first tries `git clone --branch <branch> --single-branch`, then archive download, then local fallback.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python -m unittest tests.test_build_exe.BuildExePlanTests.test_prepare_backend_source_downloads_selected_branch tests.test_build_exe.BuildExePlanTests.test_prepare_backend_source_uses_local_fallback_when_remote_fails -v`

Expected: pass.

### Task 3: Temporarily Point Cargo at Prepared Backend

**Files:**
- Modify: `tests/test_build_exe.py`
- Modify: `scripts/build_exe.py`

- [ ] **Step 1: Write failing tests**

Add tests that expect `rewrite_backend_dependency_path` to rewrite only:

```toml
shinden-pl-api = { path = "../../shinden-pl-api-rs" }
```

to the prepared backend path, and `restore_backend_manifest` to restore the original content and remove the backup.

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m unittest tests.test_build_exe.BuildExePlanTests.test_backend_manifest_rewrite_and_restore -v`

Expected: fail because manifest rewrite helpers do not exist.

- [ ] **Step 3: Implement minimal manifest rewrite and restore**

Add `rewrite_backend_dependency_path` and `restore_backend_manifest`, with a backup path under `logs/Cargo.toml.build-exe.bak`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python -m unittest tests.test_build_exe.BuildExePlanTests.test_backend_manifest_rewrite_and_restore -v`

Expected: pass.

### Task 4: Wire Build Flow and Launcher Prompt

**Files:**
- Modify: `tests/test_build_exe.py`
- Modify: `scripts/build_exe.py`
- Modify: `generator_exe.bat`

- [ ] **Step 1: Write failing tests**

Add tests that expect `parse_args(["--backend-branch", "dev"])` to expose `backend_branch == "dev"` and `generator_exe.bat` to include `:select_backend_branch`, `git ls-remote --heads`, `--backend-branch`, `Main`, and `dev`.

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m unittest tests.test_build_exe.BuildExePlanTests.test_parse_args_accepts_backend_branch tests.test_build_exe.BuildExePlanTests.test_launcher_prompts_for_backend_branch -v`

Expected: fail because the argument and launcher prompt do not exist.

- [ ] **Step 3: Implement wiring**

Add `--backend-branch` to Python args, use `prepare_backend_source` before build commands, rewrite the Cargo manifest for the selected source, and restore/clean in `finally`. Add a batch `:select_backend_branch` routine that detects remote branches before build and appends `--backend-branch <choice>` to `BUILD_ARGS`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python -m unittest tests.test_build_exe.BuildExePlanTests.test_parse_args_accepts_backend_branch tests.test_build_exe.BuildExePlanTests.test_launcher_prompts_for_backend_branch -v`

Expected: pass.

### Task 5: Full Verification

**Files:**
- Verify: `scripts/build_exe.py`
- Verify: `tests/test_build_exe.py`
- Verify: `generator_exe.bat`

- [ ] **Step 1: Run full build script test suite**

Run: `python -m unittest tests.test_build_exe -v`

Expected: all tests pass.

- [ ] **Step 2: Run dry-run smoke test**

Run: `python scripts/build_exe.py --dry-run --backend-branch dev --skip-install --no-copy`

Expected: exit code 0, planned build logs include backend branch information and no real Tauri build runs.

- [ ] **Step 3: Inspect diff**

Run: `git diff --stat`

Expected: changes are limited to the implementation plan, tests, Python build script, and launcher batch file.
