# Title Workspace and View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add non-persistent, duplicate-free anime cards with selectable presentation and a fullscreen mode that may retain the Windows taskbar.

**Architecture:** Keep routing through the existing SvelteKit title pages, but introduce one in-memory workspace which owns the tab list and snapshots of the existing `params` title context. A pure workspace reducer is unit-tested independently; a Svelte adapter synchronizes the active snapshot with `params` and drives route transitions. A lightweight layout component renders the selected card rail, while the header owns persistent visual preferences and applies the selected window behavior.

**Tech Stack:** Svelte 5 runes, SvelteKit 2, TypeScript, Tauri 2 Window API, Node built-in test runner, Tailwind/DaisyUI.

**Spec:** `docs/superpowers/specs/2026-08-24-title-workspace-and-view-design.md`

## Global Constraints

- This plan does not change the Rust API, episode addresses, watchlist failure reporting, filters, player classification, iframe handling, availability indicators, or discovery search.
- A title card is identified exclusively by a valid numeric `titleId`; opening that title again activates the existing session and never creates a duplicate.
- Open sessions are in-memory only: never store, restore, or encode them in local storage or URLs.
- Persist only `vertical`/`horizontal`/`none` card layout and `immersive`/`taskbar` fullscreen presentation; invalid persisted values fall back to `vertical` and `immersive`.
- In vertical layout show title image only (with accessible full name); in horizontal layout show image and name until space requires hiding inactive labels. The close `×` is always visible.
- `none` retains the existing single-title behavior: opening another title replaces the active session.
- Fullscreen `immersive` uses Tauri native fullscreen and `taskbar` uses maximized window mode. Exiting embedded player fullscreen restores only intended `immersive` window fullscreen.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/titleWorkspace.ts` | Pure data types, state transitions, preference parsing, and route mapping; no Svelte runes or browser calls. |
| `src/lib/titleWorkspace.svelte.ts` | Reactive singleton around the pure transitions and synchronization with the legacy `params` context. |
| `src/lib/titleNavigation.ts` | Single high-level API for opening a title, activating/closing a card, and moving an active title between episodes, sources, and player routes. |
| `src/lib/TitleTabs.svelte` | Accessible vertical/horizontal card rails, active-card handling, persistent close controls, and compact labels. |
| `src/lib/ViewMenu.svelte` | Header dropdown for card layout and fullscreen presentation choices. |
| `src/lib/windowFullscreenIntent.ts` | Tauri window-mode behavior and embedded-player restoration rules. |
| `src/lib/global.svelte.ts` | Defines the title-context shape and exposes snapshot/restore helpers used by the workspace adapter. |
| `src/routes/+layout.svelte` | Mounts card chrome only for title routes and keys route content when active title/view changes. |
| `src/lib/Navbar.svelte` | Replaces the bare fullscreen toggle with `ViewMenu`; retains minimize/back/close controls. |
| `src/lib/DiscoveryAnimeList.svelte`, `src/routes/search/+page.svelte`, `src/routes/watchlist/+page.svelte`, `src/routes/account/lists/+page.svelte` | Use the common title-opening action rather than writing `params` directly. |
| `src/routes/episodes/+page.svelte`, `src/routes/players/+page.svelte`, `src/lib/PlayerListElement.svelte`, `src/routes/watching/+page.svelte` | Keep source/player navigation within the active title session and add the player-to-anime action. |
| `tests/titleWorkspace.test.mjs` | Unit tests for workspace transitions and preference parsing. |
| `tests/fullscreenIntent.test.mjs` | Unit tests for immersive/maximized window mode and player-fullscreen restoration. |

### Task 1: Pure workspace state and regression tests

**Files:**
- Create: `src/lib/titleWorkspace.ts`
- Create: `tests/titleWorkspace.test.mjs`

**Interfaces:**
- Consumes: `EpisodeProgress`-compatible JSON data only; this module must not import Svelte, Tauri, or browser APIs.
- Produces: `TitleWorkspaceState`, `TitleSession`, `TitleOpenInput`, `openTitleSession`, `activateTitleSession`, `closeTitleSession`, `setWorkspaceLayout`, `parseWorkspacePreferences`, and `titleRouteForView`.

- [ ] **Step 1: Write the failing workspace tests**

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createTitleWorkspaceState,
  openTitleSession,
  closeTitleSession,
  parseWorkspacePreferences,
} from "../src/lib/titleWorkspace.ts";

const kokoore = { titleId: 71632, name: "Kokoore", imageUrl: "/71632.jpg", seriesUrl: "https://shinden.pl/series/71632-kokoore", watchStatus: "in progress", isFavourite: 0, totalEpisodes: 12 };
const other = { ...kokoore, titleId: 59922, name: "Enen", seriesUrl: "https://shinden.pl/series/59922-enen" };

test("activates an already open title without duplicating its card", () => {
  const first = openTitleSession(createTitleWorkspaceState(), kokoore).state;
  const second = openTitleSession(first, other).state;
  const reopened = openTitleSession(second, kokoore);

  assert.equal(reopened.created, false);
  assert.deepEqual(reopened.state.tabs.map((tab) => tab.titleId), [71632, 59922]);
  assert.equal(reopened.state.activeTitleId, 71632);
});

test("none layout replaces the active title session", () => {
  const vertical = openTitleSession(createTitleWorkspaceState(), kokoore).state;
  const hidden = { ...vertical, layout: "none" };
  const result = openTitleSession(hidden, other).state;

  assert.deepEqual(result.tabs.map((tab) => tab.titleId), [59922]);
  assert.equal(result.activeTitleId, 59922);
});

test("closing the active card selects its nearest neighbor and final close empties the workspace", () => {
  const twoTabs = openTitleSession(openTitleSession(createTitleWorkspaceState(), kokoore).state, other).state;
  const afterFirstClose = closeTitleSession({ ...twoTabs, activeTitleId: 71632 }, 71632);
  const afterFinalClose = closeTitleSession(afterFirstClose, 59922);

  assert.equal(afterFirstClose.activeTitleId, 59922);
  assert.deepEqual(afterFinalClose.tabs, []);
  assert.equal(afterFinalClose.activeTitleId, null);
});

test("invalid persisted view preferences use the documented defaults", () => {
  assert.deepEqual(parseWorkspacePreferences('{"layout":"diagonal","fullscreenPresentation":"borderless"}'), {
    layout: "vertical",
    fullscreenPresentation: "immersive",
  });
});
```

- [ ] **Step 2: Run the new tests and verify they fail because the module is missing**

Run: `node --test tests/titleWorkspace.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/titleWorkspace.ts`.

- [ ] **Step 3: Implement immutable workspace transitions**

```ts
export type TitleView = "episodes" | "players" | "watching";
export type TitleWorkspaceLayout = "vertical" | "horizontal" | "none";
export type FullscreenPresentation = "immersive" | "taskbar";

export type TitleSession = TitleOpenInput & {
    view: TitleView;
    playersUrl: string;
    playerId: string;
    episodeProgress: EpisodeProgress[];
    currentEpisodeIndex: number;
};

export type TitleWorkspaceState = {
    tabs: TitleSession[];
    activeTitleId: number | null;
    layout: TitleWorkspaceLayout;
    fullscreenPresentation: FullscreenPresentation;
};

export function openTitleSession(state: TitleWorkspaceState, input: TitleOpenInput) {
    const existing = state.tabs.find((tab) => tab.titleId === input.titleId);
    if (existing) return { state: { ...state, activeTitleId: existing.titleId }, created: false };
    const session = createTitleSession(input);
    const tabs = state.layout === "none" ? [session] : [...state.tabs, session];
    return { state: { ...state, tabs, activeTitleId: session.titleId }, created: true };
}
```

Implement `activateTitleSession` as an unchanged-state no-op for an absent ID, and `closeTitleSession` so an inactive close keeps the active ID while an active close chooses the tab now at the removed index or the preceding tab. `parseWorkspacePreferences` must use `JSON.parse` in a `try` block and validate both literal unions before returning defaults.

- [ ] **Step 4: Run the workspace tests and verify they pass**

Run: `node --test tests/titleWorkspace.test.mjs`

Expected: PASS with all workspace transition tests green.

- [ ] **Step 5: Commit the pure workspace layer**

```bash
git add src/lib/titleWorkspace.ts tests/titleWorkspace.test.mjs
git commit -m "feat: add in-memory title workspace"
```

### Task 2: Reactive adapter and one title-opening API

**Files:**
- Modify: `src/lib/global.svelte.ts:23-48`
- Create: `src/lib/titleWorkspace.svelte.ts`
- Create: `src/lib/titleNavigation.ts`
- Modify: `src/lib/DiscoveryAnimeList.svelte:1-85`
- Modify: `src/routes/search/+page.svelte:1-104`
- Modify: `src/routes/watchlist/+page.svelte:1-319`
- Modify: `src/routes/account/lists/+page.svelte:1-298`

**Interfaces:**
- Consumes: the pure `TitleWorkspaceState` actions from Task 1 and existing `params` values.
- Produces: `titleWorkspace.open`, `titleWorkspace.activate`, `titleWorkspace.close`, `titleWorkspace.updateActiveContext`, `openAnimeTitle`, `openRelatedAnimeTitle`, `openActiveTitleView`, and `closeActiveTitle`.

- [ ] **Step 1: Extend the failing workspace test with context save/restore expectations**

```js
import { activateTitleSession, updateActiveTitleSession } from "../src/lib/titleWorkspace.ts";

test("restores the selected title session including its player subview", () => {
  const opened = openTitleSession(createTitleWorkspaceState(), kokoore).state;
  const player = updateActiveTitleSession(opened, { view: "watching", playerId: "online-77", currentEpisodeIndex: 3 });
  const withOther = openTitleSession(player, other).state;
  const restored = activateTitleSession(withOther, 71632);

  assert.equal(restored.activeTitleId, 71632);
  assert.equal(restored.tabs[0].view, "watching");
  assert.equal(restored.tabs[0].playerId, "online-77");
  assert.equal(restored.tabs[0].currentEpisodeIndex, 3);
});
```

- [ ] **Step 2: Run the workspace test and verify it fails on the missing update API**

Run: `node --test tests/titleWorkspace.test.mjs`

Expected: FAIL because `updateActiveTitleSession` is not exported.

- [ ] **Step 3: Implement context helpers and navigation helpers**

In `global.svelte.ts`, extract the title-specific fields into an exported `TitleNavigationContext` and add explicit snapshot/restore helpers. Keep `animeName` outside that type because search state is not a tab state.

```ts
export type TitleNavigationContext = Pick<typeof params,
    "seriesUrl" | "playersUrl" | "playerId" | "titleId" |
    "animeWatchStatus" | "animeIsFavourite" | "animeTotalEpisodes" |
    "episodeProgress" | "currentEpisodeIndex"
>;

export function snapshotTitleNavigationContext(): TitleNavigationContext {
    return {
        seriesUrl: params.seriesUrl,
        playersUrl: params.playersUrl,
        playerId: params.playerId,
        titleId: params.titleId,
        animeWatchStatus: params.animeWatchStatus,
        animeIsFavourite: params.animeIsFavourite,
        animeTotalEpisodes: params.animeTotalEpisodes,
        episodeProgress: [...params.episodeProgress],
        currentEpisodeIndex: params.currentEpisodeIndex,
    };
}

export function restoreTitleNavigationContext(context: TitleNavigationContext) {
    params.seriesUrl = context.seriesUrl;
    params.playersUrl = context.playersUrl;
    params.playerId = context.playerId;
    params.titleId = context.titleId;
    params.animeWatchStatus = context.animeWatchStatus;
    params.animeIsFavourite = context.animeIsFavourite;
    params.animeTotalEpisodes = context.animeTotalEpisodes;
    params.episodeProgress = [...context.episodeProgress];
    params.currentEpisodeIndex = context.currentEpisodeIndex;
}
```

`titleWorkspace.svelte.ts` owns a `$state<TitleWorkspaceState>` initialized with `parseWorkspacePreferences(localStorage.getItem("shinden:title-workspace-preferences"))` only when `localStorage` exists. It must expose getters plus methods that always return the newly active session. Before switching/closing, `saveActiveContext(snapshotTitleNavigationContext())` updates the active pure session.

`titleNavigation.ts` must be the only place that imports both `goto` and the workspace adapter. `openAnimeTitle` accepts `{ titleId, name, imageUrl, seriesUrl, watchStatus, isFavourite, totalEpisodes }`; it snapshots the current active session, calls `open`, restores the returned session, and navigates to `/episodes` only for a new session. For an existing session it navigates to `titleRouteForView(session.view)` so the existing card retains its current subview.

`openActiveTitleView(view, patch)` must merge the supplied patch into `params`, update the active session with the snapshot and requested view, then `goto(titleRouteForView(view))`. `closeActiveTitle` routes to the replacement session's stored view or `/` when none remains.

Replace every direct block assigning title fields in the four list sources with `await openAnimeTitle(...)`. Preserve their current title-ID fallback and status-update logic.

- [ ] **Step 4: Run the workspace tests and type-check the new call sites**

Run: `node --test tests/titleWorkspace.test.mjs; npm run check`

Expected: all Node tests pass and `svelte-check` reports zero errors.

- [ ] **Step 5: Commit unified title navigation**

```bash
git add src/lib/global.svelte.ts src/lib/titleWorkspace.svelte.ts src/lib/titleNavigation.ts src/lib/DiscoveryAnimeList.svelte src/routes/search/+page.svelte src/routes/watchlist/+page.svelte src/routes/account/lists/+page.svelte tests/titleWorkspace.test.mjs
git commit -m "feat: open titles through workspace sessions"
```

### Task 3: Card rails and title-layout integration

**Files:**
- Create: `src/lib/TitleTabs.svelte`
- Modify: `src/routes/+layout.svelte:1-37`
- Create: `src/lib/titleTabPresentation.ts`
- Modify: `src/app.css` only if a responsive horizontal-label rule cannot be expressed with existing Tailwind utilities

**Interfaces:**
- Consumes: `titleWorkspace.tabs`, `titleWorkspace.activeTitleId`, `titleWorkspace.layout`, `activateTitleSession`, and `closeActiveTitle` from Task 2.
- Produces: a title-only workspace chrome that is absent for layout `none`, vertical cards with image-only presentation, and horizontal cards with compactable labels.

- [ ] **Step 1: Add a failing presentation-behavior test**

```js
import { titleTabPresentation } from "../src/lib/titleTabPresentation.ts";

test("keeps accessible names while compacting only inactive horizontal labels", () => {
  assert.deepEqual(titleTabPresentation("vertical", false, true), { showVisualName: false, showAccessibleName: true });
  assert.deepEqual(titleTabPresentation("horizontal", false, true), { showVisualName: false, showAccessibleName: true });
  assert.deepEqual(titleTabPresentation("horizontal", true, true), { showVisualName: true, showAccessibleName: true });
  // TitleTabs consumes this model; Svelte type-check validates the rendered component.


});
```

- [ ] **Step 2: Run the test and verify it fails because the presentation helper is missing**

Run: `node --test tests/titleWorkspace.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/titleTabPresentation.ts`.

- [ ] **Step 3: Implement `TitleTabs` and mount it around title routes**

`TitleTabs.svelte` renders no markup for `layout === "none"`. For `vertical`, use a left `aside` rail, square card buttons, the title image with `alt={tab.name}` and `title={tab.name}`, and an always-visible close button whose click calls `event.stopPropagation()` before `closeActiveTitle(tab.titleId)`.
Implement `titleTabPresentation(layout, isActive, labelsCompacted)` as a pure function returning `{ showVisualName, showAccessibleName }`. A vertical card never has a visual name; a compact horizontal inactive card has no visual name; all other cards do. The accessible name is always true.


For `horizontal`, use a horizontally scrollable flex rail. Render image, `span` name, and close button for every card. Use CSS container queries or a media/query-free class strategy that hides `.title-tab-label` for inactive cards at constrained width while never applying that class to the active card. Do not remove labels from the DOM; use `sr-only` when hidden so the full name remains available to assistive technology.

In `+layout.svelte`, import `TitleTabs` and the workspace adapter. Render the rail only when an active title session exists. Wrap `{@render children()}` in a `{#key}` keyed by `activeTitleId` and active session `view`, so selecting a different tab while remaining on the same route remounts the current page with its restored `params` context. Keep the header and non-title pages functional when no session exists.

- [ ] **Step 4: Run presentation-behavior test and Svelte type-check**

Run: `node --test tests/titleWorkspace.test.mjs; npm run check`

Expected: the presentation-behavior check and all existing workspace tests pass; `svelte-check` has zero errors.

- [ ] **Step 5: Commit the title-card presentation**

```bash
git add src/lib/TitleTabs.svelte src/lib/titleTabPresentation.ts src/routes/+layout.svelte src/app.css tests/titleWorkspace.test.mjs
git commit -m "feat: add title card layouts"
```

### Task 4: Keep episode, source, and player navigation within one card

**Files:**
- Modify: `src/routes/episodes/+page.svelte:31-197`
- Modify: `src/routes/players/+page.svelte:1-118`
- Modify: `src/lib/PlayerListElement.svelte:1-23`
- Modify: `src/routes/watching/+page.svelte:1-292`

**Interfaces:**
- Consumes: `openAnimeTitle` and `openActiveTitleView` from Task 2.
- Produces: source and player transitions that update only the active session, related-series opening that creates/activates a title session, and an `Anime` action returning to `/episodes`.

- [ ] **Step 1: Add a failing active-session navigation test**

```js
test("returns a player session to episodes without changing its title context", () => {
  const opened = openTitleSession(createTitleWorkspaceState(), kokoore).state;
  const player = updateActiveTitleSession(opened, { view: "watching", playerId: "online-77", currentEpisodeIndex: 3 });
  const episodes = updateActiveTitleSession(player, { view: "episodes" });

  assert.equal(episodes.tabs[0].view, "episodes");
  assert.equal(episodes.tabs[0].titleId, 71632);
  assert.equal(episodes.tabs[0].seriesUrl, kokoore.seriesUrl);
  assert.equal(episodes.tabs[0].currentEpisodeIndex, 3);
});
```

- [ ] **Step 2: Run the test and verify it fails before the active-session transition exists**

Run: `node --test tests/titleWorkspace.test.mjs`

Expected: FAIL because `updateActiveTitleSession` cannot yet preserve the requested session update.

- [ ] **Step 3: Migrate each title subview**

In `/episodes`, replace the related-series parameter reset with `openRelatedAnimeTitle({ titleId, name: series.name, imageUrl: series.imageUrl, seriesUrl: series.url, watchStatus: "no", isFavourite: 0, totalEpisodes: null })`. Replace episode selection with `openActiveTitleView("players", { playersUrl: episode.link, episodeProgress: episodes, currentEpisodeIndex: index, playerId: "" })`.

In `/players`, keep the missing-player-URL guard, but route failures to the active title's `episodes` subview before the home fallback. In `PlayerListElement`, replace `params.playerId = playerId; goto("/watching")` with `openActiveTitleView("watching", { playerId })`.

In `/watching`, replace next/previous episode transitions with `openActiveTitleView("players", { playersUrl: episode.link, playerId: "", episodeProgress: params.episodeProgress, currentEpisodeIndex: index })`. Add a visible `Anime` button in the fixed control bar that calls `openActiveTitleView("episodes", {})`; it must not modify title ID, series URL, or episode progress. When watched progress mutates, call `titleWorkspace.saveActiveContext(snapshotTitleNavigationContext())` so a tab activation restores the current state.

- [ ] **Step 4: Run the focused suite and type-check**

Run: `node --test tests/titleWorkspace.test.mjs; npm run check`

Expected: all active-session behavior tests pass; no Svelte/TypeScript errors.

- [ ] **Step 5: Commit card-local title navigation**

```bash
git add src/routes/episodes/+page.svelte src/routes/players/+page.svelte src/lib/PlayerListElement.svelte src/routes/watching/+page.svelte tests/titleWorkspace.test.mjs
git commit -m "feat: preserve player navigation in title cards"
```

### Task 5: View menu and fullscreen presentation behavior

**Files:**
- Modify: `src/lib/windowFullscreenIntent.ts:1-34`
- Modify: `tests/fullscreenIntent.test.mjs:1-70`
- Create: `src/lib/ViewMenu.svelte`
- Modify: `src/lib/Navbar.svelte:1-78`
- Modify: `src/routes/watching/+page.svelte:110-210`

**Interfaces:**
- Consumes: `FullscreenPresentation`, reactive preference setters from Task 2, and Tauri window methods `isFullscreen`, `setFullscreen`, `isMaximized`, `maximize`, and `unmaximize`.
- Produces: `toggleWindowPresentation`, `restoreAfterElementFullscreenExit(appWindow, fullscreenElement, presentation)`, and a header menu controlling persisted layout and fullscreen presentation.

- [ ] **Step 1: Write failing fullscreen-mode tests**

```js
test("taskbar presentation maximizes without entering native fullscreen", async () => {
  const intent = createWindowFullscreenIntent();
  const mockWindow = createMockWindow({ fullscreen: false, maximized: false });

  await intent.toggleWindowPresentation(mockWindow.window, "taskbar");

  assert.deepEqual(mockWindow.calls, ["maximize"]);
});

test("player fullscreen exit does not restore native fullscreen for taskbar presentation", async () => {
  const intent = createWindowFullscreenIntent();
  const mockWindow = createMockWindow({ fullscreen: false, maximized: true });
  intent.setIntendedFullscreen(true);

  const restored = await intent.restoreAfterElementFullscreenExit(mockWindow.window, null, "taskbar");

  assert.equal(restored, false);
  assert.deepEqual(mockWindow.calls, []);
});
```

Expand `createMockWindow` to record `"fullscreen:true"`, `"fullscreen:false"`, `"maximize"`, and `"unmaximize"`, and to expose all required async query methods.

- [ ] **Step 2: Run the fullscreen test and verify it fails on the missing presentation API**

Run: `node --test tests/fullscreenIntent.test.mjs`

Expected: FAIL because `toggleWindowPresentation` is not implemented.

- [ ] **Step 3: Implement Tauri presentation modes and the header menu**

```ts
export type PresentationWindow = FullscreenWindow & {
    isMaximized(): Promise<boolean>;
    maximize(): Promise<void>;
    unmaximize(): Promise<void>;
};

async function toggleWindowPresentation(window: PresentationWindow, presentation: FullscreenPresentation) {
    if (presentation === "immersive") {
        return toggleWindowFullscreen(window);
    }
    if (await window.isFullscreen()) await window.setFullscreen(false);
    if (await window.isMaximized()) return window.unmaximize();
    return window.maximize();
}
```

Pass the selected presentation into `restoreAfterElementFullscreenExit`; it returns `false` without calling `setFullscreen` whenever the presentation is `taskbar`.

`ViewMenu.svelte` is a DaisyUI dropdown with radio-style controls for all three card layouts and both fullscreen presentations. It invokes the workspace setter that writes only the two preferences to `localStorage`. Place it in `Navbar.svelte` before window-management buttons. Replace the previous fullscreen callback with `toggleWindowPresentation(getCurrentWindow(), titleWorkspace.fullscreenPresentation)`. In `/watching`, pass `titleWorkspace.fullscreenPresentation` to fullscreen restoration.

- [ ] **Step 4: Run fullscreen tests and Svelte type-check**

Run: `node --test tests/fullscreenIntent.test.mjs; npm run check`

Expected: all fullscreen tests pass, including legacy immersive-restoration tests; `svelte-check` reports zero errors.

- [ ] **Step 5: Commit view preferences and fullscreen modes**

```bash
git add src/lib/windowFullscreenIntent.ts tests/fullscreenIntent.test.mjs src/lib/ViewMenu.svelte src/lib/Navbar.svelte src/routes/watching/+page.svelte
git commit -m "feat: add configurable title and fullscreen views"
```

### Task 6: End-to-end verification and scope review

**Files:**
- Modify only if a verification failure identifies a defect in one of the files above.

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: verified first-stage title workspace implementation with no API changes.

- [ ] **Step 1: Run every frontend Node regression test**

Run: `node --test tests/*.test.mjs`

Expected: PASS with zero failed tests.

- [ ] **Step 2: Run the full Svelte type-check**

Run: `npm run check`

Expected: exit code 0 and zero `svelte-check` errors.

- [ ] **Step 3: Build the frontend bundle**

Run: `npm run build`

Expected: exit code 0 and generated static frontend output.

- [ ] **Step 4: Verify the final diff against the approved scope**

Run: `git diff --check HEAD~5..HEAD; git log --oneline -5; git status --short`

Expected: no whitespace errors, five focused feature commits, and no unexpected files. Confirm there are no changes in `F:\_Github\shinden-pl-api-rs` and no episode-address parsing changes.

- [ ] **Step 5: If verification exposes a defect, return to its responsible task and use that task's exact commit command**

```bash
# Repair only the named files in the task whose check failed.
# Use that task's Step 5 command; do not create a generic verification commit.
```
