# Home Discovery and Title Tab Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display reliable premiere ratings, provide Shinden-backed advanced discovery filters, correct the Polish details-button label, and make title-card closing reliable.

**Architecture:** `shinden-pl-api-rs` parses the current search form, validates selections by option ID, submits the matching fields, and enriches results with user status. Tauri bridges typed commands. Svelte preserves selection state in `SearchFilters`, lazily renders catalog-driven tabs, and keeps the local minimum-rating check. A small close-event helper prevents the card activator from consuming the X click.

**Tech Stack:** Rust 2024, reqwest, scraper, serde, Tauri 2, Svelte 5, TypeScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-26-home-discovery-and-title-tab-reliability-design.md`

## Global Constraints

- Keep title-only search working if the filter catalog fails to load.
- Never hard-code Shinden groups or controls in Svelte; API data supplies labels, option IDs and selection capability.
- Accept only client selections containing `optionId` and `mode`; backend reloads its catalog before using technical form fields.
- Normalize dot and comma decimal ratings; keep a missing rating empty for the existing client fallback `-`.
- The X control calls `preventDefault` and `stopPropagation` before exactly one close callback.
- HTML parser tests use inline fixtures and make no network request.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `F:/_Github/shinden-pl-api-rs/src/models.rs` | Filter catalog, option, selection and request JSON models. |
| `F:/_Github/shinden-pl-api-rs/src/search.rs` | Filter-form parser, validated form encoder and filtered search execution. |
| `F:/_Github/shinden-pl-api-rs/src/client_backend.rs` | Tauri-facing catalog/search methods and card-scoped premiere ratings. |
| `F:/_Github/shinden-pl-api-rs/tests/client_backend_contract.rs` | CamelCase contract regression tests. |
| `src-tauri/src/lib.rs` | Catalog and filtered-search command bridges. |
| `src/lib/types.ts`, `src/lib/searchFilters.ts` | Client contract mirrors, persisted selection helpers and local rating filtering. |
| `src/routes/+page.svelte`, `src/routes/search/+page.svelte` | Lazy tabbed filter panel and conditional search command. |
| `src/lib/titleTabCloseInteraction.ts`, `src/lib/TitleTabs.svelte` | Close-button event handling and stacking. |
| `src/lib/AnimeDetailsPanel.svelte` | Correct UTF-8 label. |
| `tests/searchFilters.test.mjs`, `tests/titleTabCloseInteraction.test.mjs`, `tests/titleCardBindings.test.mjs` | Client regressions. |

### Task 1: Parse ratings from each discovery card

**Files:**
- Modify: `F:/_Github/shinden-pl-api-rs/src/client_backend.rs:2336-2623,4020-4087`

**Interfaces:**
- Produces: `parse_main_premieres_html(html) -> Vec<DiscoveryAnimeBase>` with a rating sourced only from the same card.

- [ ] **Step 1: Write the failing test**

```rust
#[test]
fn parses_card_ratings_without_leaking_between_cards() {
    let html = r#"
      <article data-rate="8.25"><a href="/series/60001-alpha"><img alt="Alpha"></a></article>
      <article><a href="/series/60002-beta"><img alt="Beta"></a><span class="rate-top">7,4</span></article>
      <article><a href="/series/60003-gamma"><img alt="Gamma"></a></article>
    "#;
    let rows = parse_main_premieres_html(html);
    assert_eq!(rows.iter().map(|row| row.rating.as_str()).collect::<Vec<_>>(), vec!["8,25", "7,4", ""]);
}
```

- [ ] **Step 2: Verify RED**

Run: `cargo test --manifest-path F:/_Github/shinden-pl-api-rs/Cargo.toml parses_card_ratings_without_leaking_between_cards`

Expected: FAIL because the current extractor accepts only a comma token from generic nearby markup.

- [ ] **Step 3: Implement the smallest parser change**

```rust
fn normalize_rating(value: &str) -> Option<String> {
    let value = value.trim().replace('.', ",");
    let (whole, fraction) = value.split_once(',')?;
    (whole.parse::<u8>().ok()? <= 10
        && !fraction.is_empty()
        && fraction.len() <= 2
        && fraction.chars().all(|c| c.is_ascii_digit()))
        .then_some(value)
}
fn extract_rating_from_card(card: &str) -> String {
    extract_attr(card, "data-rate").and_then(|value| normalize_rating(&value))
        .or_else(|| compact_text(card).split_whitespace().find_map(normalize_rating))
        .unwrap_or_default()
}
```

Identify the enclosing discovery-card markup before calling this helper. Preserve existing nearby-context fallbacks for image, type, episode count and source label.

- [ ] **Step 4: Verify GREEN**

Run: `cargo test --manifest-path F:/_Github/shinden-pl-api-rs/Cargo.toml parse_main_premieres`

Expected: PASS, including current fixtures and the new three-card fixture.

- [ ] **Step 5: Commit**

```powershell
git -C F:/_Github/shinden-pl-api-rs add -- src/client_backend.rs
git -C F:/_Github/shinden-pl-api-rs commit -m "fix: parse ratings on discovery cards"
```

### Task 2: Add the catalog and validated request models

**Files:**
- Modify: `F:/_Github/shinden-pl-api-rs/src/models.rs`
- Modify: `F:/_Github/shinden-pl-api-rs/src/search.rs`
- Test: `F:/_Github/shinden-pl-api-rs/src/search.rs`

**Interfaces:**
- Produces: `SearchFilterCatalog`, `SearchFilterGroup`, `SearchFilterOption`, `SearchFilterRequest`, and `SearchFilterSelection` in camelCase JSON.
- Produces: `parse_search_filter_catalog_html(html)` and `encode_search_filter_form(catalog, request)`.

- [ ] **Step 1: Write failing parser and validation tests**

```rust
#[test]
fn parses_a_tri_state_group_and_pairs_its_option_controls() {
    let html = r#"<form id="series-filter"><section data-filter-group="genres" data-label="Gatunki">
      <input name="genre[action]" value="include" data-option-id="genre-action"><label>Akcja</label>
      <input name="genre[action]" value="exclude" data-option-id="genre-action"><label>Akcja</label>
    </section></form>"#;
    let catalog = parse_search_filter_catalog_html(html).unwrap();
    assert_eq!(catalog.groups[0].id, "genres");
    assert_eq!(catalog.groups[0].options[0].id, "genre-action");
    assert_eq!(catalog.groups[0].selection_mode, SearchFilterSelectionMode::TriState);
}
#[test]
fn encoder_rejects_an_unknown_option_id() {
    assert!(encode_search_filter_form(&sample_catalog(), &SearchFilterRequest {
        query: String::new(), selections: vec![SearchFilterSelection::include("unknown")]
    }).is_err());
}
```

- [ ] **Step 2: Verify RED**

Run: `cargo test --manifest-path F:/_Github/shinden-pl-api-rs/Cargo.toml search_filter`

Expected: FAIL because the catalog types and functions do not exist.

- [ ] **Step 3: Implement models, parser, and encoder**

```rust
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilterSelection { pub option_id: String, pub mode: SearchFilterSelectionMode }

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SearchFilterSelectionMode { Include, Exclude, Neutral }

pub fn encode_search_filter_form(catalog: &SearchFilterCatalog, request: &SearchFilterRequest) -> Result<Vec<(String, String)>> {
    let mut form = vec![("search".to_string(), request.query.trim().to_string())];
    for selected in request.selections.iter().filter(|item| item.mode != SearchFilterSelectionMode::Neutral) {
        let option = catalog.option(&selected.option_id).ok_or_else(|| anyhow!("unknown filter option"))?;
        form.push((option.form_name_for(selected.mode)?.to_string(), option.form_value_for(selected.mode)?.to_string()));
    }
    Ok(form)
}
```

Parse controls only inside Shinden’s search form. The serialized option exposes id and label, while the internal parsed entry retains the exact include/exclude form names and values. Pair matching controls into a single tri-state option and reject an unsupported mode.

- [ ] **Step 4: Verify GREEN**

Run: `cargo test --manifest-path F:/_Github/shinden-pl-api-rs/Cargo.toml search_filter`

Expected: PASS with parser grouping, control pairing and unknown-option rejection.

- [ ] **Step 5: Commit**

```powershell
git -C F:/_Github/shinden-pl-api-rs add -- src/models.rs src/search.rs
git -C F:/_Github/shinden-pl-api-rs commit -m "feat: parse Shinden search filter catalog"
```

### Task 3: Execute filtered searches and expose the contract through Tauri

**Files:**
- Modify: `F:/_Github/shinden-pl-api-rs/src/search.rs`
- Modify: `F:/_Github/shinden-pl-api-rs/src/client_backend.rs:491-503`
- Modify: `F:/_Github/shinden-pl-api-rs/tests/client_backend_contract.rs`
- Modify: `src-tauri/src/lib.rs:1-45,307-312`

**Interfaces:**
- Produces: `ShindenClientBackend::get_search_filter_catalog()`, `ShindenClientBackend::search_with_filters(request)`.
- Produces Tauri commands `get_search_filter_catalog` and `search_with_filters`.

- [ ] **Step 1: Write failing JSON and command-registration tests**

```rust
#[test]
fn filter_request_hides_backend_form_fields() {
    let json = serde_json::to_value(SearchFilterRequest {
        query: "Cowboy Bebop".into(),
        selections: vec![SearchFilterSelection::include("genre-action")],
    }).unwrap();
    assert_eq!(json["selections"][0]["optionId"], "genre-action");
    assert_eq!(json["selections"][0]["mode"], "include");
    assert!(json["selections"][0].get("formName").is_none());
}
```

Add a Node source assertion that both command names occur in `src-tauri/src/lib.rs` and the `generate_handler!` registration.

- [ ] **Step 2: Verify RED**

Run: `cargo test --manifest-path F:/_Github/shinden-pl-api-rs/Cargo.toml --test client_backend_contract filter_request_hides_backend_form_fields`

Expected: FAIL until the public types and command paths exist.

- [ ] **Step 3: Implement API and bridge methods**

```rust
pub async fn search_with_filters(&self, request: SearchFilterRequest) -> Result<Vec<SearchAnime>, String> {
    let results = self.api.search_anime_with_filters(&request)
        .await.map_err(|error| command_error("search_with_filters", error))?;
    let watching = fetch_all_userlist_items(&self.api, &self.user_id_cache).await.unwrap_or_default();
    Ok(map_search_anime_results(results, watching))
}
#[tauri::command]
async fn search_with_filters(state: tauri::State<'_, ShindenClientBackend>, request: SearchFilterRequest) -> Result<Vec<SearchAnime>, String> {
    state.search_with_filters(request).await
}
```

The API method fetches and parses the catalog, validates the request with Task 2, posts the encoded form with the existing authenticated client, and sends the HTML through the existing search-result parser. Add the matching catalog command and register both commands.

- [ ] **Step 4: Verify GREEN**

Run: `cargo test --manifest-path F:/_Github/shinden-pl-api-rs/Cargo.toml --test client_backend_contract`

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: both commands exit 0 and use matching camelCase request fields.

- [ ] **Step 5: Commit**

```powershell
git -C F:/_Github/shinden-pl-api-rs add -- src/search.rs src/client_backend.rs tests/client_backend_contract.rs
git -C F:/_Github/shinden-pl-api-rs commit -m "feat: add filtered Shinden title search"
git add -- src-tauri/src/lib.rs
git commit -m "feat: expose advanced title search commands"
```

### Task 4: Persist filter selections and select the search command

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/searchFilters.ts`
- Modify: `src/routes/search/+page.svelte:1-70`
- Test: `tests/searchFilters.test.mjs`

**Interfaces:**
- Produces: `hasAdvancedSearchFilters(filters)`, `searchFilterRequest(filters, query)`, and `setSearchFilterSelection(selections, optionId, mode)`.
- Consumes: persisted `params.searchFilters` and Tauri request JSON.

- [ ] **Step 1: Write failing selection-state tests**

```js
test("builds a filtered request only from active selections", () => {
  const filters = { ...defaultSearchFilters, selections: [
    { optionId: "genre-action", mode: "include" }, { optionId: "genre-drama", mode: "neutral" },
  ]};
  assert.equal(hasAdvancedSearchFilters(filters), true);
  assert.deepEqual(searchFilterRequest(filters, "Alpha"), {
    query: "Alpha", selections: [{ optionId: "genre-action", mode: "include" }],
  });
});
test("replaces an existing selection instead of duplicating it", () => {
  assert.deepEqual(setSearchFilterSelection([{ optionId: "genre-action", mode: "include" }], "genre-action", "exclude"),
    [{ optionId: "genre-action", mode: "exclude" }]);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/searchFilters.test.mjs`

Expected: FAIL because selection helpers and request types are absent.

- [ ] **Step 3: Implement the client contract and conditional invocation**

```ts
export const defaultSearchFilters: SearchFilters = { minimumRating: null, selections: [] };
export function searchFilterRequest(filters: SearchFilters, query: string): SearchFilterRequest {
    return { query: query.trim(), selections: filters.selections.filter((item) => item.mode !== "neutral") };
}
const searchResults = hasAdvancedSearchFilters(params.searchFilters)
    ? await invoke<SearchAnime[]>("search_with_filters", { request: searchFilterRequest(params.searchFilters, params.animeName) })
    : await invoke<SearchAnime[]>("search", { query: params.animeName });
```

Remove `animeType` from `SearchFilters`; production type now comes from the catalog. `filterSearchAnime` retains only the minimum-rating predicate and accepts empty ratings. Normalize restored legacy state by using the default empty selection array unless `selections` is an array.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/searchFilters.test.mjs`

Run: `npm run check`

Expected: PASS and base-view restore remains compatible with old stored state.

- [ ] **Step 5: Commit**

```powershell
git add -- src/lib/types.ts src/lib/searchFilters.ts src/routes/search/+page.svelte tests/searchFilters.test.mjs
git commit -m "feat: route searches through selected filters"
```

### Task 5: Render the lazy, catalog-driven homepage filter panel

**Files:**
- Modify: `src/routes/+page.svelte:1-151`
- Modify: `src/lib/searchFilters.ts`
- Test: `tests/searchFilters.test.mjs`

**Interfaces:**
- Consumes: `get_search_filter_catalog -> SearchFilterCatalog`.
- Produces: accessible group tabs, tri-state `Chcę / Nie chcę / Obojętne` options, simple checkboxes, lazy loading, and a non-blocking error state.

- [ ] **Step 1: Write failing lazy-load source assertion**

```js
test("homepage loads the filter catalog only while opening filters", () => {
  const source = readFileSync("src/routes/+page.svelte", "utf8");
  assert.match(source, /invoke<SearchFilterCatalog>\("get_search_filter_catalog"\)/);
  assert.doesNotMatch(source, /onMount[\s\S]*get_search_filter_catalog/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/searchFilters.test.mjs`

Expected: FAIL because the catalog command is not present in the homepage.

- [ ] **Step 3: Implement the panel**

```ts
async function showFilters() {
    showSearchFilters = !showSearchFilters;
    if (showSearchFilters && filterCatalog === null && !filterCatalogLoading) {
        filterCatalogLoading = true;
        try { filterCatalog = await invoke<SearchFilterCatalog>("get_search_filter_catalog"); }
        catch (error) { filterCatalogError = `Nie udało się pobrać filtrów Shinden: ${error}`; }
        finally { filterCatalogLoading = false; }
    }
}
```

Render group buttons with `aria-selected`, render selected-group options from the returned catalog, and update selections only with `setSearchFilterSelection`. Keep the existing minimum-rating select outside catalog groups. On catalog error, show an alert but leave title-only search enabled.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/searchFilters.test.mjs`

Run: `npm run check`

Expected: PASS with no Svelte or accessibility type errors.

- [ ] **Step 5: Commit**

```powershell
git add -- src/routes/+page.svelte src/lib/searchFilters.ts tests/searchFilters.test.mjs
git commit -m "feat: add Shinden catalog search filters"
```

### Task 6: Fix the details label and title-card X control

**Files:**
- Create: `src/lib/titleTabCloseInteraction.ts`
- Modify: `src/lib/TitleTabs.svelte:1-90`
- Modify: `src/lib/AnimeDetailsPanel.svelte:89-94`
- Create: `tests/titleTabCloseInteraction.test.mjs`
- Modify: `tests/titleCardBindings.test.mjs`

**Interfaces:**
- Produces: `closeTitleTabFromControl(event, close): boolean`.
- Guarantees: consumes default and bubbling before exactly one close action.

- [ ] **Step 1: Write failing close and binding tests**

```js
test("close control consumes the click and closes its title", () => {
  let prevented = false, stopped = false, closed = 0;
  assert.equal(closeTitleTabFromControl(
    { preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } },
    () => closed += 1,
  ), true);
  assert.equal(prevented, true); assert.equal(stopped, true); assert.equal(closed, 1);
});
```

Also assert source includes `Otwórz w Shinden`, `closeTitleTabFromControl`, and close-button class `z-10`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/titleTabCloseInteraction.test.mjs tests/titleCardBindings.test.mjs`

Expected: FAIL because the helper, layering and correct label are absent.

- [ ] **Step 3: Implement the isolated event handler and bindings**

```ts
export function closeTitleTabFromControl(
    event: Pick<MouseEvent, "preventDefault" | "stopPropagation">,
    close: () => void,
): boolean {
    event.preventDefault();
    event.stopPropagation();
    close();
    return true;
}
```

Import this helper in `TitleTabs.svelte`; set `z-10` on the absolute X button; call it with `() => { void closeTitleTab(tab.titleId); }`. Replace `Otw?rz w Shinden` with `Otwórz w Shinden`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/titleTabCloseInteraction.test.mjs tests/titleCardBindings.test.mjs tests/titleWorkspace.test.mjs`

Run: `npm run check`

Expected: PASS; current workspace tests continue to prove neighbor and base-tab selection.

- [ ] **Step 5: Commit**

```powershell
git add -- src/lib/titleTabCloseInteraction.ts src/lib/TitleTabs.svelte src/lib/AnimeDetailsPanel.svelte tests/titleTabCloseInteraction.test.mjs tests/titleCardBindings.test.mjs
git commit -m "fix: reliably close title tabs"
```

### Task 7: Verify the integrated change

**Files:**
- Modify only if a concrete verification command exposes a failure in Tasks 1-6.

**Interfaces:**
- Consumes: all completed task interfaces.
- Produces: fresh evidence for the two Rust projects and client tests.

- [ ] **Step 1: Run the full API suite**

Run: `cargo test --manifest-path F:/_Github/shinden-pl-api-rs/Cargo.toml`

Expected: PASS without network access.

- [ ] **Step 2: Run all client Node tests**

Run: `node --test tests/*.test.mjs`

Expected: PASS, including workspace and filter coverage.

- [ ] **Step 3: Run static and Rust integration checks**

Run: `npm run check`

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: both exit 0.

- [ ] **Step 4: Inspect final scope**

```powershell
git diff --check
git status --short
git log --oneline -8
```

Expected: no whitespace errors and only task-scoped source changes.

- [ ] **Step 5: Handle a failing verification by returning to its owning task**

If a command fails, keep its full output, identify the task that owns the
failing interface, and repeat that task's red-green cycle with one new focused
test. Do not add an unscoped integration commit. If all commands pass, make no
additional commit in this task.
