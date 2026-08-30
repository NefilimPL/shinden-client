# Reliable Title Tab Closing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every close-control activation remove its target title tab exactly once and choose the most recently viewed remaining tab.

**Architecture:** `titleWorkspace.ts` owns an MRU list and returns an atomic close transition that includes the selected destination. The Svelte store commits that transition before `titleNavigation.ts` restores context and routes. `TitleTabs.svelte` delegates its X control to a small, testable controller that consumes the event and rejects concurrent close requests for the same tab.

**Tech Stack:** Svelte 5, TypeScript, SvelteKit navigation, Node.js test runner, Node strict assertions.

**Spec:** `docs/superpowers/specs/2026-08-30-reliable-title-tab-closing-design.md`

## Global Constraints

- The MRU list contains every currently open title at most once and never contains a closed title.
- Opening or activating a title as the active view updates MRU; opening in the background does not.
- Closing an active title selects the first available title from MRU; closing the final title selects the base tab.
- Closing an inactive or already-closed title never changes the active view.
- The close control consumes the event before starting one close request and rejects repeated in-flight requests for its `titleId`.
- Open tabs and MRU are transient; neither is written to local storage.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/titleWorkspace.ts` | Workspace data model, MRU invariants, and atomic close transition. |
| `src/lib/titleWorkspace.svelte.ts` | Reactive state owner that commits and returns the close transition. |
| `src/lib/titleNavigation.ts` | Uses a close transition's explicit destination to restore state and navigate. |
| `src/lib/titleTabCloseInteraction.ts` | Event consumption and per-tab in-flight close guard. |
| `src/lib/TitleTabs.svelte` | Connects each accessible X button to the close controller. |
| `tests/titleWorkspace.test.mjs` | Pure state tests for MRU and transition selection. |
| `tests/titleTabCloseInteraction.test.mjs` | Event and duplicate-click regression tests. |
| `tests/titleCardBindings.test.mjs` | Source-level integration binding regression. |

### Task 1: Add MRU state and an atomic workspace close transition

**Files:**
- Modify: `src/lib/titleWorkspace.ts:1-222`
- Modify: `tests/titleWorkspace.test.mjs:1-140`
- Modify: `tests/persistentBaseTab.test.mjs:1-55`

**Interfaces:**
- Produces `recentlyViewedTitleIds: number[]` on `TitleWorkspaceState`, newest first.
- Produces `TitleSessionCloseResult` with `state`, `closed`, `wasActive`, and `nextSession`.
- Changes `closeTitleSession(state, titleId)` to return `TitleSessionCloseResult`.

- [ ] **Step 1: Write failing MRU and close-selection tests**

  Add these tests after the existing title-workspace tests:

  ```js
  test("closing the active title restores the most recently viewed available title", () => {
    const first = openTitleSession(createTitleWorkspaceState(), kokoore).state;
    const second = openTitleSession(first, enen).state;
    const revisitedFirst = activateTitleSession(second, kokoore.titleId);

    const result = closeTitleSession(revisitedFirst, kokoore.titleId);

    assert.equal(result.closed, true);
    assert.equal(result.wasActive, true);
    assert.equal(result.nextSession?.titleId, enen.titleId);
    assert.deepEqual(result.state.recentlyViewedTitleIds, [enen.titleId]);
  });

  test("closing an inactive or absent title leaves the active title unchanged", () => {
    const first = openTitleSession(createTitleWorkspaceState(), kokoore).state;
    const twoTabs = openTitleSession(first, enen).state;

    const inactive = closeTitleSession(twoTabs, kokoore.titleId);
    const absent = closeTitleSession(inactive.state, kokoore.titleId);

    assert.deepEqual(inactive.state.activeTab, { kind: "title", titleId: enen.titleId });
    assert.equal(absent.closed, false);
    assert.deepEqual(absent.state, inactive.state);
  });
  ```

  Update existing close assertions to read `result.state.activeTab`, `result.state.tabs`, and `result.nextSession`.

- [ ] **Step 2: Run the focused tests to verify RED**

  Run: `node --test tests/titleWorkspace.test.mjs tests/persistentBaseTab.test.mjs`

  Expected: FAIL because `closeTitleSession` returns only state and no MRU property or transition fields exist.

- [ ] **Step 3: Implement the MRU helpers and transition**

  In `titleWorkspace.ts`, add the fields and type:

  ```ts
  export type TitleSessionCloseResult = {
      state: TitleWorkspaceState;
      closed: boolean;
      wasActive: boolean;
      nextSession: TitleSession | null;
  };

  function touchRecentlyViewed(titleIds: number[], titleId: number): number[] {
      return [titleId, ...titleIds.filter((id) => id !== titleId)];
  }

  function availableRecentlyViewedTitleId(
      recentlyViewedTitleIds: number[],
      tabs: TitleSession[],
  ): number | null {
      return recentlyViewedTitleIds.find((titleId) => tabs.some((tab) => tab.titleId === titleId)) ?? null;
  }
  ```

  Initialize `recentlyViewedTitleIds` to `[]`. Update it in `openTitleSession` only when `activate` is true and in `activateTitleSession`. Clear it in `setWorkspaceLayout(..., "none")`.

  Replace `closeTitleSession` with a function that first computes `wasActive`, removes the requested ID from both arrays, selects an MRU candidate only when `wasActive`, and returns `nextSession` from the newly selected state. For an absent tab, return `{ state, closed: false, wasActive: false, nextSession: activeTitleSession(state) }` without allocating a new state.

- [ ] **Step 4: Run the focused tests to verify GREEN**

  Run: `node --test tests/titleWorkspace.test.mjs tests/persistentBaseTab.test.mjs`

  Expected: PASS, including existing base-view preservation and new MRU behavior.

- [ ] **Step 5: Commit the state transition**

  ```powershell
  git add -- src/lib/titleWorkspace.ts tests/titleWorkspace.test.mjs tests/persistentBaseTab.test.mjs
  git commit -m "feat: choose recently viewed title after tab close"
  ```

### Task 2: Commit the transition before routing

**Files:**
- Modify: `src/lib/titleWorkspace.svelte.ts:1-115`
- Modify: `src/lib/titleNavigation.ts:1-125`
- Test: `tests/titleNavigationClose.test.mjs`

**Interfaces:**
- Consumes `TitleSessionCloseResult` from `closeTitleSession`.
- Changes `titleWorkspace.close(titleId)` to return `TitleSessionCloseResult` after assigning `state = result.state`.
- `closeTitleTab(titleId): Promise<void>` routes only when `result.closed && result.wasActive`.

- [ ] **Step 1: Write the failing navigation-contract test**

  Create `tests/titleNavigationClose.test.mjs` with source assertions that prevent a regression to rereading the destination from the store:

  ```js
  import assert from "node:assert/strict";
  import { readFileSync } from "node:fs";
  import test from "node:test";

  test("title closing navigates from its atomic transition", () => {
    const store = readFileSync("src/lib/titleWorkspace.svelte.ts", "utf8");
    const navigation = readFileSync("src/lib/titleNavigation.ts", "utf8");

    assert.match(store, /const result = closeTitleSession\(state, titleId\);\s*state = result\.state;\s*return result;/);
    assert.match(navigation, /const result = titleWorkspace\.close\(titleId\);/);
    assert.match(navigation, /if \(!result\.closed \|\| !result\.wasActive\) \{\s*return;/);
    assert.match(navigation, /if \(!result\.nextSession\) \{/);
    assert.match(navigation, /titleSessionNavigationContext\(result\.nextSession\)/);
  });
  ```

- [ ] **Step 2: Run the focused test to verify RED**

  Run: `node --test tests/titleNavigationClose.test.mjs`

  Expected: FAIL because the store returns `activeTitleSession(state)` and navigation rereads `session` after closing.

- [ ] **Step 3: Implement transition-driven navigation**

  Replace the store method with:

  ```ts
  close(titleId: number) {
      const result = closeTitleSession(state, titleId);
      state = result.state;
      return result;
  },
  ```

  In `closeTitleTab`, use `const result = titleWorkspace.close(titleId)`. Return immediately unless both `result.closed` and `result.wasActive` are true. For a null `result.nextSession`, call `restoreBaseView(titleWorkspace.baseView)`; otherwise pass `result.nextSession` to `titleSessionNavigationContext` and navigate to its saved view. Keep `saveCurrentWorkspaceContext()` before creating the transition when the closing tab is active.

- [ ] **Step 4: Run the focused test and the state suite to verify GREEN**

  Run: `node --test tests/titleNavigationClose.test.mjs tests/titleWorkspace.test.mjs tests/persistentBaseTab.test.mjs`

  Expected: PASS, demonstrating that routing has one immutable transition target.

- [ ] **Step 5: Commit the navigation integration**

  ```powershell
  git add -- src/lib/titleWorkspace.svelte.ts src/lib/titleNavigation.ts tests/titleNavigationClose.test.mjs
  git commit -m "fix: navigate from title tab close transition"
  ```

### Task 3: Make the X control single-shot and independently testable

**Files:**
- Modify: `src/lib/titleTabCloseInteraction.ts:1-11`
- Modify: `src/lib/TitleTabs.svelte:1-95`
- Modify: `tests/titleTabCloseInteraction.test.mjs:1-35`
- Modify: `tests/titleCardBindings.test.mjs:25-40`

**Interfaces:**
- Produces `createTitleTabCloseController()` returning `close(event, titleId, requestClose): Promise<boolean>`.
- `requestClose` has type `() => Promise<void>` and is called at most once for an in-flight `titleId`.
- The controller invokes `preventDefault()` and `stopPropagation()` for every received close-control event.

- [ ] **Step 1: Write the failing repeated-click test**

  Replace the existing helper-only test with the existing event assertions plus:

  ```js
  test("suppresses a second close request while the first request is pending", async () => {
    const controller = closeInteraction.createTitleTabCloseController();
    let calls = 0;
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    const event = { preventDefault() {}, stopPropagation() {} };

    const first = controller.close(event, 71632, async () => {
      calls += 1;
      await pending;
    });
    const second = await controller.close(event, 71632, async () => { calls += 1; });
    finish();
    const firstHandled = await first;

    assert.equal(firstHandled, true);
    assert.equal(second, false);
    assert.equal(calls, 1);
  });
  ```

- [ ] **Step 2: Run the focused test to verify RED**

  Run: `node --test tests/titleTabCloseInteraction.test.mjs`

  Expected: FAIL because the controller factory does not exist.

- [ ] **Step 3: Implement the close controller and wire it to the button**

  Replace the helper with:

  ```ts
  type CloseControlEvent = Pick<MouseEvent, "preventDefault" | "stopPropagation">;

  export function createTitleTabCloseController() {
      const closingTitleIds = new Set<number>();

      return {
          async close(
              event: CloseControlEvent,
              titleId: number,
              requestClose: () => Promise<void>,
          ): Promise<boolean> {
              event.preventDefault();
              event.stopPropagation();
              if (closingTitleIds.has(titleId)) return false;
              closingTitleIds.add(titleId);
              try {
                  await requestClose();
                  return true;
              } finally {
                  closingTitleIds.delete(titleId);
              }
          },
      };
  }
  ```

  In `TitleTabs.svelte`, create one controller instance in the component script and call it from the X button as `void titleTabCloseController.close(event, tab.titleId, () => closeTitleTab(tab.titleId))`. Keep the control as a sibling of the tab activator, retain its `aria-label` and `z-10`, and increase its visual hit area without changing the tab activator's handler.

- [ ] **Step 4: Run interaction and binding tests to verify GREEN**

  Run: `node --test tests/titleTabCloseInteraction.test.mjs tests/titleCardBindings.test.mjs`

  Expected: PASS, including one request during a pending close and the independent X binding.

- [ ] **Step 5: Commit the reliable control**

  ```powershell
  git add -- src/lib/titleTabCloseInteraction.ts src/lib/TitleTabs.svelte tests/titleTabCloseInteraction.test.mjs tests/titleCardBindings.test.mjs
  git commit -m "fix: make title tab close control single-shot"
  ```

### Task 4: Verify the complete tab-closing flow

**Files:**
- Modify only files owned by Tasks 1-3 if a verification command exposes a concrete defect.

**Interfaces:**
- Consumes the MRU transition, transition-driven routing, and close controller.
- Produces fresh verification evidence for all client checks.

- [ ] **Step 1: Run every Node regression test**

  Run: `node --test tests/*.test.mjs`

  Expected: PASS, including workspace, navigation-close, interaction, and title-card binding tests.

- [ ] **Step 2: Run the Svelte type and accessibility check**

  Run: `npm run check`

  Expected: exit code 0 with no Svelte or TypeScript errors.

- [ ] **Step 3: Inspect final scope and whitespace**

  Run: `git diff --check; git status --short; git log --oneline -5`

  Expected: no whitespace errors and only the planned source, test, specification, and plan changes.

- [ ] **Step 4: Return a failing verification to its owning task**

  If Steps 1 or 2 fail, return to Task 1, 2, or 3, add a narrowly targeted
  regression test when the failure is not already covered, and repeat that
  task's test and commit steps. Do not make an unscoped verification commit.
