# Title Workspace and Availability Design

## Goal

Make title tabs predictable and safe to use, restore a stable base view after closing titles, and make title URLs and episode-availability labels reliable across the client and Rust API.

## Scope

This design covers the regressions reported after the title-workspace feature:

- visible Polish labels and icons in the title-view menu and tab controls;
- tab close/selection behavior, middle-click opening, and console layering;
- taskbar-visible window presentation;
- canonical Shinden URLs from user-list data;
- cached per-episode availability used consistently by the watchlist and episode list;
- availability of age-rating filtering after metadata refresh.

Open tabs remain in memory only. They are never written to local storage and are empty after application restart.

## Navigation Model

The workspace owns two kinds of session:

1. A single non-closeable base session, which is either `/` or `/watchlist`.
2. Zero or more closeable title sessions, keyed by title ID.

The base session is the last of those two routes used before a title is opened. It records its route and vertical scroll offset in memory. Opening a title records that base context, then activates an existing matching title tab or appends one. The workspace never creates duplicate title tabs.

When a closeable tab is closed:

- closing an inactive tab leaves the active view unchanged;
- closing the active tab activates the nearest remaining title tab;
- closing the final title tab restores the recorded base route and scroll offset;
- the base session itself cannot be closed or replaced by a title selection.

With the `none` layout selected, a newly opened title replaces the active title session as before, but the base session remains available for the final close. It does not persist to disk.

Middle-clicking an anime result follows the same open operation as a primary click but prevents the browser's default auxiliary-click behavior. If the title is already open it activates that tab; otherwise it creates one. This applies to list, grid, search, discovery, and user-list item controls that open a title.

## Tab Presentation and Window Controls

The view menu uses an inline SVG gear icon. Tab close buttons use a literal inline SVG `X`, not text fallbacks. All Polish visible strings in changed title-workspace controls use UTF-8 text such as `Pełny ekran`, `Pokaż pasek zadań`, `Ukryj pasek zadań`, and `Otwórz`.

Vertical tabs show the close button only for the active tab to avoid accidental closure during switching. Horizontal tabs show the small close button for every tab. Horizontal labels appear while the rail has room and compact only inactive tabs when space is insufficient. The console overlay has a strictly higher z-index than either rail so no tab can cover it.

`immersive` presentation toggles native fullscreen. `taskbar` presentation exits native fullscreen first, then toggles maximization. The Tauri capability grants the specific `maximize` and `unmaximize` window commands in addition to the existing state-query permissions.

## Canonical Shinden URLs

The Shinden user-list response supplies a title ID but not a durable canonical page URL. Synthesizing `/series/{titleId}` is invalid for titles requiring a slug and caused the reported 404s.

The API resolves a user-list item to the canonical search/detail result for the matching title ID, then stores that returned URL in the user-list cache. Watchlist rows, cached user lists, detail refreshes, title cards, episode loading, and the external WWW action use this stored canonical URL.

Existing cached short URLs are treated as unresolved on the next list refresh. Resolution failures retain the most recent known URL when available and surface a named failure with an open-in-web action; they never silently substitute a different title ID. Episode loading accepts both `/series/` and `/titles/` inputs while resolving short links before appending `/episodes`.

## Episode Availability Cache

The availability cache stores a snapshot per title, including an entry for every episode URL. Each cached episode records whether it has any playable player and which subtitle-language variants are present, including the non-AI variant. The title summary (`has_available_unwatched_episode`) is derived from those same entries and current watched progress.

Refreshing the watchlist scans and saves the full episode snapshot for every eligible in-progress title. Refreshing a single title after marking an episode watched updates that title's snapshot. The user-list refresh reuses the same snapshot data for its in-progress titles so availability is current when the list finishes refreshing.

The episode page reads this stored snapshot and derives each badge from the selected watchlist filters. It does not independently call `get_players` for every episode when a valid snapshot exists. If a title has no snapshot, opening its episode list starts one title refresh and displays `Nie sprawdzono` until the saved result arrives. A failed or incomplete scan also remains `Nie sprawdzono`; only a completed cached check can produce `Dostępny` or `Niedostępny`. Values remain stable until a deliberate, scheduled, or progress-triggered refresh updates the snapshot.

## Metadata Filters

The Rust metadata parser recognizes age ratings labeled `MPAA` as well as existing age labels. The user-list refresh writes this value into each item, which populates the age-rating select. The select stays disabled only while the cache truly contains no age ratings; it becomes usable after a completed refresh that returns `MPAA` data.

## Error Handling

- Canonical URL lookup failures are reported with title name, original known URL if any, and the underlying reason.
- Episode cache failures do not turn into a false negative availability badge.
- A failed maximization call is surfaced through the existing client logging mechanism rather than leaving the selected presentation ambiguous.
- Scroll restoration is best-effort: a missing scroll container restores to the base route at its normal initial position.

## Testing

Client tests will cover:

- base-session selection, final-close return, and no persisted title tabs;
- tab close visibility/presentation and middle-click behavior;
- gear/X controls and console-layer ordering through component-level behavior where practical;
- taskbar presentation calling fullscreen exit followed by maximize/unmaximize;
- cache-backed episode badge derivation and the unknown-state display.

Rust tests will cover:

- canonical URL selection for an item whose title ID is `68581`;
- handling short `/titles/` and `/series/` URLs before the episode suffix is appended;
- a complete per-episode availability snapshot and filter-derived summary;
- cache miss/failure semantics distinct from unavailable;
- extracting an age rating from an `MPAA` information row.

Verification includes the focused Node and Cargo tests, the full client checks, API test suite, and a local Tauri build with both repositories on `dev`.
