# User Anime List Refresh Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible, persistent progress for user anime list cache refresh and resume unfinished detail metadata refreshes after restart.

**Architecture:** The backend keeps a separate user-list refresh status and persisted queue in `user-anime-lists-refresh.json`, independent from the existing watching cache refresh status. Tauri exposes status, start, and resume commands; the Svelte list page polls status and reloads cached payload when a refresh finishes.

**Tech Stack:** Rust, serde, Tauri commands, Svelte 5, TypeScript, Tailwind/DaisyUI.

---

### Task 1: Backend Status Model

**Files:**
- Modify: `F:/_Github/shinden-pl-api-rs/src/client_backend.rs`
- Modify: `F:/_Github/shinden-pl-api-rs/tests/client_backend_contract.rs`

- [ ] Add tests for `UserAnimeListRefreshState` serialization and resume queue selection.
- [ ] Implement `UserAnimeListRefreshStatus`, `UserAnimeListRefreshState`, load/save helpers, and a dedicated mutex in `ShindenClientBackend`.
- [ ] Verify with `cargo test user_anime_list_refresh --lib`.

### Task 2: Backend Refresh Execution

**Files:**
- Modify: `F:/_Github/shinden-pl-api-rs/src/client_backend.rs`

- [ ] Change manual list refresh to create a persisted detail queue and process it while updating `current`, `total`, `refreshed`, `failed`, `currentTitle`, and `lastFinishedAtMs`.
- [ ] Add `get_user_anime_list_refresh_status`, `refresh_user_anime_list_cache`, and `resume_user_anime_list_cache_refresh`.
- [ ] Keep this refresh completely separate from `WatchingCacheRefreshStatus` and existing `refresh_watching_anime_cache`.

### Task 3: Tauri and Frontend

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/types.ts`
- Modify: `src/routes/account/lists/+page.svelte`

- [ ] Expose the three new Tauri commands.
- [ ] Add TypeScript refresh status/summary types.
- [ ] Poll status on `/account/lists`, start resume on mount, show progress counts and current title, and reload cached data when a refresh finishes.

### Task 4: Verification

**Files:**
- All changed files.

- [ ] Run `cargo test --lib` in backend.
- [ ] Run `cargo test --test client_backend_contract --no-run` in backend.
- [ ] Run `npm.cmd run check`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.

