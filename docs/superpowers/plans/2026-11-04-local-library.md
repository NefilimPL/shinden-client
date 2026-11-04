# Local library implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Persist an isolated offline library for Guest and named profiles, with optional login and explicit public import.

**Architecture:** SQLite is the source of truth. The Rust backend captures a profile before each operation; public networking and account sessions are separate. Tauri forwards commands; Svelte displays local profile state independently of remote authentication.

**Tech stack:** Rust, rusqlite with bundled SQLite, serde, reqwest, Tauri 2, Svelte 5.

**Spec:** `../specs/2026-11-04-local-library-design.md`

## Global constraints

- One local database file; no MySQL service.
- No remote writes for user progress, status or ratings.
- Network disabled by default; no automatic import or background requests.
- Profile nicknames are labels; database queries are parameterized.
- Changes stay in the two user-specified repositories; do not publish or commit automatically.

## Review focus

- Switching profiles while a request is in progress must retain the original database target.
- Account cookies must never enter public requests or startup checks.
- Unknown episode totals must remain unknown, not become zero/completed.
- Failed/partial imports must not erase or partially overwrite a library.
- UI title tabs, list state and notification state must not leak across profiles.

## Task 1: Local storage

Files: API `src/local_library.rs`, `src/lib.rs`, `Cargo.toml`, tests `tests/local_library.rs`.

- [x] Write and run failing tests for profile isolation, persistence, progress, import merge and invalid URLs.
- [x] Implement SQLite profiles, metadata/resources and per-title episode progress with transactions.
- [x] Run the storage tests; expect all to pass.

## Task 2: Backend privacy and imports

Files: API `src/client.rs`, `src/client_backend.rs`, `src/public_users.rs`; tests in the same modules and integration tests.

Interfaces: `LibraryState`, `LibraryProfile`, `LocalLibrary::open`; commands `get_library_state`, `select_library_profile`, `set_library_preferences`, `search_public_users`, `import_public_user`.

- [x] Write and run failing tests proving offline operations do not request the network and imports validate origins.
- [x] Route reads and writes through SQLite. Add an ephemeral anonymous API session, explicit account activation and public user search/import.
- [x] Retain reusable metadata parsers; remove automatic remote list/progress paths from the application backend.
- [x] Run API tests and resolve regressions.

## Task 3: Tauri and Svelte

Files: client `src-tauri/src/lib.rs`, `browser_verification.rs`; new settings page and local-library state module; account, navbar, lists, episodes, layout.

- [x] Add behavior tests for Guest access, startup and profile reset.
- [x] Expose the Rust commands and settings; display the active local profile, allow Guest editing and remove automatic refresh/session checks.
- [x] Reset transient title/list state on profile change. Explain network/login visibility in the settings.
- [x] Run Node tests, svelte-check and production build.

## Task 4: Review and documentation

- [x] Document database location, import behavior, existing JSON and offline limitations.
- [x] Run complete Rust and client checks. Review both working diffs, including profile races and cookie separation.
- [x] Request independent review, fix material findings, record actual validation results.
