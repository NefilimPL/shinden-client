# Shinden User Anime Lists Design

## Goal

Add an in-app browser for the logged-in user's main Shinden anime lists, reachable from the account profile page, with local filters and persistent cached anime metadata.

## Scope

- Add an account-page entry point below the existing logged-in profile controls.
- Add a dedicated route for user anime lists.
- Support the six main Shinden anime list statuses: watching, completed, skipped, held, dropped, and planned.
- Provide an "all" view that combines the six statuses.
- Show list counts and anime cards or rows similar to the Shinden list layout.
- Add local filters for title search, sorting, status, type, and release-year range when data is present.
- Keep tag and age-category filtering out of the first version unless the list API exposes those fields without per-title detail fetches.
- Persist list anime metadata in a local backend cache.
- On normal load, only sync Shinden for title membership/status and add titles not already in the cache.
- Refresh existing anime metadata only when the user clicks a refresh button.
- Reuse the existing episode-opening flow.

## Non-Goals

- Do not implement custom Shinden lists in this version.
- Do not fetch details for every cached anime automatically.
- Do not add server-side filtering for the first version.
- Do not change Shinden account data except through existing status-update flows.

## Architecture

The backend owns persistent list data because it already knows the cache directory and has access to the authenticated Shinden session. It will add a cache file under the existing project cache directory, for example `user-anime-lists-cache.json`.

The frontend receives one compact payload containing all cached items, counts per status, and cache metadata. Filtering and sorting happen locally in TypeScript so switching filters does not call the network.

## Backend Data Flow

1. Resolve the current Shinden user id with the existing cached profile helper.
2. Load `user-anime-lists-cache.json`; missing or invalid cache means an empty cache.
3. Fetch the six main list-status pages from `lista.shinden.pl`.
4. For each returned title:
   - If it is new, map the list item into cached anime metadata and store it.
   - If it exists, update status, favourite flag, watched count, total episodes, and list membership.
   - Do not overwrite stable metadata such as title, cover, type, rating, description, or release year during normal sync.
5. Return cached items after applying the latest membership/status updates.
6. On explicit refresh, fetch all list statuses and overwrite metadata for all returned titles.

Titles that disappear from all six status lists should stay in cache but be excluded from the active payload unless they reappear. This preserves metadata without showing removed items.

## Frontend Data Flow

1. `/account` shows a button or compact action below the logged-in account block.
2. Clicking it navigates to `/account/lists`.
3. `/account/lists` calls the new Tauri command on mount.
4. The page stores the returned items locally and applies filters in memory.
5. The refresh button calls the same command with `forceRefresh: true`.
6. Clicking an anime sets `params.seriesUrl`, `params.titleId`, `params.animeWatchStatus`, `params.animeIsFavourite`, `params.animeTotalEpisodes`, clears episode progress, and navigates to `/episodes`.

## UI

The page should use the existing dark DaisyUI/Tailwind style. The first screen is the usable list browser, not a landing page.

The left side contains:

- Search input.
- Main list/status buttons with counts.
- Sort select.
- Filter controls for status, type, and release year when available.
- Disabled or absent controls for unavailable data such as tags or age category.

The main area contains:

- Header with current list label, total visible item count, view toggle, and refresh button.
- Grid view as the default because it matches the screenshot and is good for visual browsing.
- List view using the existing row style for dense scanning.
- Empty and loading states.

## Error Handling

- If the user is not logged in, show the existing account/login flow rather than crashing.
- If the Shinden list sync fails but cache exists, return cached data with an error message so the UI can still render.
- If the cache is corrupt, ignore it and recreate it on the next successful sync.
- If full refresh fails, keep the old cache intact.

## Testing

- Backend unit tests cover cache merge behavior:
  - normal sync updates status/progress but preserves existing metadata;
  - new titles are inserted;
  - full refresh overwrites metadata;
  - removed titles are hidden from active output.
- Backend contract tests cover JSON field names for the new frontend payload.
- Frontend tests cover local filtering and sorting helpers.
- Final verification uses `npm.cmd run check` and backend unit tests. The local Windows App Control policy may block the backend integration test executable; if so, report that separately.

