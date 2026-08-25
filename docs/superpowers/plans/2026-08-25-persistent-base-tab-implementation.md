# Persistent Base Tab Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Keep one non-closeable base tab for list views while title tabs open in the foreground on left click and in the background on middle click.

**Architecture:** The pure title workspace gains a typed base-view context and an active-tab discriminator. Navigation snapshots the active title or base view before changing state, then restores the selected title or base context after routing.

**Tech Stack:** Svelte 5, SvelteKit, TypeScript, Node built-in test runner, Tauri.

**Spec:** docs/superpowers/specs/2026-08-25-persistent-base-tab-design.md

## Global Constraints

- The base tab is always first and cannot be closed.
- Left click opens and activates a title tab; middle click creates or retains a background tab.
- Bez kart clears title sessions, creates no new sessions, and ignores middle click.
- Preserve inputs and actual scroll containers for watchlist, user lists, search, and seasons.
- A restored title context must include animeName.

---

## File Structure

| File | Responsibility |
| --- | --- |
| src/lib/titleWorkspace.ts | Pure workspace state, title transitions, and base context. |
| src/lib/baseViewState.ts | Base IDs, paths, labels, validation, and scroll-safe state. |
| src/lib/titleWorkspace.svelte.ts | Reactive store facade and title context conversion. |
| src/lib/titleNavigation.ts | Foreground/background opening and restoration coordinator. |
| src/lib/titleOpenInteraction.ts | Middle-click intent helper. |
| src/lib/TitleTabs.svelte | Base-tab and title-tab rendering. |
| Base routes | Publish and restore their filter/selection/view-mode/scroll state. |
| tests/titleWorkspace.test.mjs | Workspace behavior. |
| tests/baseViewState.test.mjs | Base route state behavior. |
| tests/titleOpenInteraction.test.mjs | Mouse intent behavior. |

### Task 1: Model the permanent base tab

**Files:**
- Modify: src/lib/titleWorkspace.ts
- Modify: tests/titleWorkspace.test.mjs

**Interfaces:**
- Produces: WorkspaceActiveTab, BaseViewContext, activateBaseSession, and openTitleSession(state, input, activate).

- [ ] **Step 1: Add failing state-transition tests**

    test("opens a background title without leaving the base tab", () => {
      const state = openTitleSession(createTitleWorkspaceState(), kokoore, false).state;
      assert.deepEqual(state.activeTab, { kind: "base" });
      assert.deepEqual(state.tabs.map((tab) => tab.titleId), [71632]);
    });

    test("returns to base after closing the final title", () => {
      const opened = openTitleSession(createTitleWorkspaceState(), kokoore, true).state;
      const closed = closeTitleSession(opened, kokoore.titleId);
      assert.deepEqual(closed.activeTab, { kind: "base" });
      assert.deepEqual(closed.tabs, []);
    });

    test("none layout clears title tabs and cannot reopen them", () => {
      const opened = openTitleSession(createTitleWorkspaceState(), kokoore, true).state;
      const hidden = setWorkspaceLayout(opened, "none");
      assert.deepEqual(openTitleSession(hidden, enen, true).state.tabs, []);
    });

- [ ] **Step 2: Run the test to verify it fails**

Run: node --test tests/titleWorkspace.test.mjs

Expected: FAIL because activeTab and the activate argument are absent.

- [ ] **Step 3: Implement the typed transitions**

    export type WorkspaceActiveTab =
        | { kind: "base" }
        | { kind: "title"; titleId: number };

    export type BaseViewContext = {
        id: "watchlist" | "user-lists" | "search" | "seasons";
        scrollY: number;
        state: Record<string, unknown>;
    };

    export function openTitleSession(state: TitleWorkspaceState, input: TitleOpenInput, activate: boolean) {
        if (state.layout === "none") return { state, created: false };
        const existing = state.tabs.find((tab) => tab.titleId === input.titleId);
        if (existing) {
            return { state: activate ? { ...state, activeTab: { kind: "title", titleId: existing.titleId } } : state, created: false };
        }
        const session = createTitleSession(input);
        return {
            state: { ...state, tabs: [...state.tabs, session], activeTab: activate ? { kind: "title", titleId: session.titleId } : state.activeTab },
            created: true,
        };
    }

Replace stored activeTitleId with activeTab; expose a getter that returns a title ID only for an active title. Initialize the base context with watchlist defaults. Make final close and setWorkspaceLayout(state, "none") activate the base tab.

- [ ] **Step 4: Run the focused tests**

Run: node --test tests/titleWorkspace.test.mjs

Expected: PASS.

- [ ] **Step 5: Commit the state model**

    git add -- src/lib/titleWorkspace.ts tests/titleWorkspace.test.mjs
    git commit -m "feat: model persistent base workspace tab"

### Task 2: Add validated base-view contexts

**Files:**
- Create: src/lib/baseViewState.ts
- Create: tests/baseViewState.test.mjs
- Modify: src/lib/titleWorkspace.svelte.ts

**Interfaces:**
- Produces: baseViewForPath, baseViewPath, baseViewLabel, and normalizedBaseViewContext.

- [ ] **Step 1: Write failing context tests**

    test("maps seasons state and scroll to a restorable base context", () => {
      const context = baseViewForPath("/seasons", { year: 2026, season: "spring" }, 720);
      assert.deepEqual(context, { id: "seasons", scrollY: 720, state: { year: 2026, season: "spring" } });
      assert.equal(baseViewPath(context), "/seasons");
      assert.equal(baseViewLabel(context), "Sezony");
    });

    test("normalizes invalid base context", () => {
      assert.deepEqual(normalizedBaseViewContext({ id: "invalid", scrollY: -1, state: null }), {
        id: "watchlist", scrollY: 0, state: {},
      });
    });

- [ ] **Step 2: Run the test to verify it fails**

Run: node --test tests/baseViewState.test.mjs

Expected: FAIL because baseViewState.ts does not exist.

- [ ] **Step 3: Implement the mapping and validation**

    const definitions = {
        "/watchlist": { id: "watchlist", label: "Oglądam" },
        "/account/lists": { id: "user-lists", label: "Moje listy anime" },
        "/search": { id: "search", label: "Wyszukiwanie" },
        "/seasons": { id: "seasons", label: "Sezony" },
    } as const;

    export function baseViewForPath(path: string, state: Record<string, unknown>, scrollY: number): BaseViewContext {
        const definition = definitions[path as keyof typeof definitions] ?? definitions["/watchlist"];
        return { id: definition.id, state, scrollY: Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0 };
    }

Implement the inverse path and label functions from the same table. Reject unknown IDs and non-object state in normalizedBaseViewContext. Make the reactive store normalize all saved base contexts and expose activateBase().

- [ ] **Step 4: Run focused tests**

Run: node --test tests/baseViewState.test.mjs tests/titleWorkspace.test.mjs

Expected: PASS.

- [ ] **Step 5: Commit base context helpers**

    git add -- src/lib/baseViewState.ts src/lib/titleWorkspace.svelte.ts tests/baseViewState.test.mjs
    git commit -m "feat: persist base view contexts"

### Task 3: Implement click intent and title navigation

**Files:**
- Modify: src/lib/global.svelte.ts
- Modify: src/lib/titleWorkspace.svelte.ts
- Modify: src/lib/titleNavigation.ts
- Modify: src/lib/titleOpenInteraction.ts
- Modify: tests/titleOpenInteraction.test.mjs
- Modify: tests/titleWorkspace.test.mjs

**Interfaces:**
- Produces: openAnimeTitle, openAnimeTitleInBackground, activateBaseTab, and openTitleOnAuxClick.

- [ ] **Step 1: Add failing interaction and title-name tests**

    test("middle click prevents default and requests a background open", () => {
      let prevented = false;
      let opened = 0;
      assert.equal(openTitleOnAuxClick({ button: 1, preventDefault() { prevented = true; } }, () => opened += 1), true);
      assert.equal(prevented, true);
      assert.equal(opened, 1);
    });

    test("restored title context includes the stored anime name", () => {
      const session = openTitleSession(createTitleWorkspaceState(), kokoore, true).state.tabs[0];
      assert.equal(titleSessionNavigationContext(session).animeName, "Kokoore");
    });

- [ ] **Step 2: Run tests to verify the title-name test fails**

Run: node --test tests/titleOpenInteraction.test.mjs tests/titleWorkspace.test.mjs

Expected: FAIL because title context omits animeName.

- [ ] **Step 3: Implement the two navigation paths**

    export async function openAnimeTitleInBackground(input: OpenAnimeTitleInput) {
        saveCurrentWorkspaceContext();
        titleWorkspace.open(input, false);
    }

    export async function openAnimeTitle(input: OpenAnimeTitleInput) {
        saveCurrentWorkspaceContext();
        const opened = titleWorkspace.open(input, true);
        if (!opened.session) return;
        restoreTitleNavigationContext(titleSessionNavigationContext(opened.session));
        await goto(titleRouteForView(opened.session.view));
    }

Remove openTitleOnMouseDown. Keep openTitleOnAuxClick for button 1 only. Add animeName to global title snapshots and set it from session.name. Make activateBaseTab save the active title, activate the base session, route to baseViewPath, wait for tick, then restore the base scroll container.

- [ ] **Step 4: Run focused tests**

Run: node --test tests/titleOpenInteraction.test.mjs tests/titleWorkspace.test.mjs

Expected: PASS.

- [ ] **Step 5: Commit navigation intent**

    git add -- src/lib/global.svelte.ts src/lib/titleWorkspace.svelte.ts src/lib/titleNavigation.ts src/lib/titleOpenInteraction.ts tests/titleOpenInteraction.test.mjs tests/titleWorkspace.test.mjs
    git commit -m "fix: distinguish foreground and background title opens"

### Task 4: Render the base tab and wire route state

**Files:**
- Modify: src/lib/TitleTabs.svelte
- Modify: src/routes/+layout.svelte
- Modify: src/lib/DiscoveryAnimeList.svelte
- Modify: src/routes/search/+page.svelte
- Modify: src/routes/watchlist/+page.svelte
- Modify: src/routes/account/lists/+page.svelte
- Modify: src/routes/seasons/+page.svelte
- Create: tests/titleCardBindings.test.mjs
- Create: tests/watchingCopy.test.mjs
- Modify: src/routes/watching/+page.svelte

**Interfaces:**
- Consumes: Task 2 context helpers and Task 3 title opening functions.
- Produces: a base tab rendered first; saved and restored local state for all base pages; uniform card click bindings.

- [ ] **Step 1: Write failing source-level regressions**

    test("title cards use click and auxclick instead of mousedown", () => {
      for (const source of titleCardSources) {
        const text = readFileSync(source, "utf8");
        assert.match(text, /onauxclick={(event) => handleTitleAuxClick/);
        assert.doesNotMatch(text, /onmousedown={(event) => handleTitle/);
      }
    });

    test("player return button contains corrected copy", () => {
      const text = readFileSync("src/routes/watching/+page.svelte", "utf8");
      assert.match(text, />s*Wróć do animes*</);
    });

- [ ] **Step 2: Run the regressions to verify they fail**

Run: node --test tests/titleCardBindings.test.mjs tests/watchingCopy.test.mjs

Expected: FAIL because cards still bind onmousedown and the player has broken copy.

- [ ] **Step 3: Implement the visible workspace behavior**

    <button
        type="button"
        class:btn-active={titleWorkspace.activeTab.kind === "base"}
        onclick={() => { void activateBaseTab(); }}
    >
        {baseViewLabel(titleWorkspace.baseView)}
    </button>

Render that button before title tabs and do not render a close control for it. Replace every title-card onmousedown with onauxclick; its handler calls openAnimeTitleInBackground, while existing onclick calls openAnimeTitle.

In the base pages save and restore: seasons { year, season }; search { animeName, searchFilters, viewMode }; user lists { filters, viewMode }; watchlist { viewMode, onlyAvailableUnwatched, subtitleLanguage, checkSubtitleAvailabilityOnline, excludeAiSubtitles }. Mark each page's true result scroller with data-base-view-scroll. Replace the player text with Wróć do anime.

- [ ] **Step 4: Run focused verification**

Run: node --test tests/titleWorkspace.test.mjs tests/baseViewState.test.mjs tests/titleOpenInteraction.test.mjs tests/titleCardBindings.test.mjs tests/watchingCopy.test.mjs && npm run check

Expected: PASS.

- [ ] **Step 5: Commit base-tab UI and routes**

    git add -- src/lib/TitleTabs.svelte src/routes/+layout.svelte src/lib/DiscoveryAnimeList.svelte src/routes/search/+page.svelte src/routes/watchlist/+page.svelte src/routes/account/lists/+page.svelte src/routes/seasons/+page.svelte src/routes/watching/+page.svelte tests/titleCardBindings.test.mjs tests/watchingCopy.test.mjs
    git commit -m "feat: restore persistent base tab views"

