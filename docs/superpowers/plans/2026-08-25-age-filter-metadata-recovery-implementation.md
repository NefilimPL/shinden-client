# Age Filter Metadata Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make the age-rating filter recoverable when user-list cache has not yet fetched age metadata.

**Architecture:** Keep the existing backend parser and user-list cache refresh unchanged. Add a pure client predicate for missing active age ratings, then render a contextual refresh action beside the disabled selector.

**Tech Stack:** Svelte 5, TypeScript, Node built-in test runner, existing Tauri refresh_user_anime_list_cache command.

**Spec:** docs/superpowers/specs/2026-08-25-age-filter-data-correction.md

## Global Constraints

- Do not modify shinden-pl-api-rs; its MPAA parser already has a Rust test.
- Do not create a second refresh command or parallel refresh request.
- Show the recovery action only when active list data has no ageRating values.
- Reuse the page's existing refresh progress and disable the action while it runs.

---

## File Structure

| File | Responsibility |
| --- | --- |
| src/lib/userAnimeLists.ts | Pure predicate for absent age metadata. |
| src/routes/account/lists/+page.svelte | Contextual refresh action next to the age selector. |
| tests/userAnimeLists.test.mjs | Predicate and source-level route regression tests. |

### Task 1: Identify an active list with no age metadata

**Files:**
- Modify: src/lib/userAnimeLists.ts
- Modify: tests/userAnimeLists.test.mjs

**Interfaces:**
- Produces: userAnimeListNeedsAgeMetadataRefresh(items): boolean.

- [ ] **Step 1: Add failing predicate tests**

    test("requests metadata refresh when active items have no age ratings", () => {
      assert.equal(userAnimeListNeedsAgeMetadataRefresh([
        item({ active: true, ageRating: null }),
        item({ titleId: 2, active: false, ageRating: null }),
      ]), true);
    });

    test("does not request metadata refresh once an active rating is cached", () => {
      assert.equal(userAnimeListNeedsAgeMetadataRefresh([
        item({ active: true, ageRating: "PG-13" }),
      ]), false);
    });

Import userAnimeListNeedsAgeMetadataRefresh from src/lib/userAnimeLists.ts in the existing test file.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: node --test tests/userAnimeLists.test.mjs

Expected: FAIL because the helper is not exported.

- [ ] **Step 3: Implement the predicate beside userAnimeListAgeRatings**

    export function userAnimeListNeedsAgeMetadataRefresh(items: UserAnimeListItem[]): boolean {
        return items.some((item) => item.active)
            && userAnimeListAgeRatings(items).length === 0;
    }

- [ ] **Step 4: Run the focused test to verify it passes**

Run: node --test tests/userAnimeLists.test.mjs

Expected: PASS.

- [ ] **Step 5: Commit the predicate**

    git add -- src/lib/userAnimeLists.ts tests/userAnimeLists.test.mjs
    git commit -m "feat: detect missing age filter metadata"

### Task 2: Offer contextual age-metadata recovery

**Files:**
- Modify: src/routes/account/lists/+page.svelte
- Modify: tests/userAnimeLists.test.mjs

**Interfaces:**
- Consumes: userAnimeListNeedsAgeMetadataRefresh(items) and existing refreshUserAnimeListCache().
- Produces: a visible Pobierz kategorie wiekowe action.

- [ ] **Step 1: Write a failing route-source regression test**

    test("user lists expose an in-context age metadata refresh action", () => {
      const source = readFileSync("src/routes/account/lists/+page.svelte", "utf8");
      assert.match(source, /userAnimeListNeedsAgeMetadataRefresh/);
      assert.match(source, /Pobierz kategorie wiekowe/);
      assert.match(source, /onclick={() => { void refreshUserAnimeListCache(); }}/);
    });

Add import { readFileSync } from node:fs to tests/userAnimeLists.test.mjs.

- [ ] **Step 2: Run the regression test to verify it fails**

Run: node --test tests/userAnimeLists.test.mjs

Expected: FAIL because the filter panel has no in-context action.

- [ ] **Step 3: Render the action directly after the age selector**

    {#if needsAgeMetadataRefresh}
        <button
            class="btn btn-outline btn-sm w-full"
            type="button"
            disabled={refreshInProgress}
            onclick={() => { void refreshUserAnimeListCache(); }}
        >
            Pobierz kategorie wiekowe
        </button>
    {/if}

Import the helper and derive needsAgeMetadataRefresh from items. Keep the age selector disabled until ageRatingOptions has values. The existing refresh completion reloads items, so the same derived values remove the action and enable the selector without another request.

- [ ] **Step 4: Run focused tests and type checking**

Run: node --test tests/userAnimeLists.test.mjs && npm run check

Expected: PASS.

- [ ] **Step 5: Verify the backend contract and commit the UI**

Run: cargo test --manifest-path F:\_Github\shinden-pl-api-rs\Cargo.toml anime_detail_age_rating_reads_mpaa_label

Expected: PASS, confirming the existing list refresh can populate the UI data.

    git add -- src/lib/userAnimeLists.ts src/routes/account/lists/+page.svelte tests/userAnimeLists.test.mjs
    git commit -m "fix: expose age metadata refresh in user lists"

