# Shinden Premieres And Seasons Design

## Goal

Help logged-in users quickly find currently promoted or seasonal anime and mark them with Shinden watch statuses without manually searching every title.

## Scope

- Show a compact `Nowosci` section on the home page below the search form.
- Load the home-page list from `https://shinden.pl/main`.
- Let users change a listed anime status with the same Shinden status control used by search results.
- Add a direct link or button from each listed anime to its Shinden anime page.
- Add a small `Sezony` button next to the search form.
- Add a new seasons route where users can choose a year and season and browse titles from Shinden season pages.
- Let users change statuses and open Shinden anime links from the seasons route too.

## Non-Goals

- Do not replace the existing search flow.
- Do not build a full Shinden web clone inside the app.
- Do not add manga, novels, rankings, genres, or advanced filtering in the first version.
- Do not store custom local premiere lists.
- Do not auto-mark episodes as watched from these discovery lists.

## Sources

The backend will scrape or parse the existing Shinden pages through the authenticated client session where possible:

- Home premieres/currently promoted anime:
  `https://shinden.pl/main`
- Current season shortcut:
  `https://shinden.pl/series/season/current`
- Explicit season pages:
  `https://shinden.pl/series/season/{year}/{season}`

Season slugs will follow Shinden paths:

- `winter`
- `spring`
- `summer`
- `fall`

The first implementation should prefer the current Shinden HTML structure and keep parsing helpers isolated so future page changes are easier to repair.

## Backend Model

Add a shared discovery anime model compatible with the existing `SearchAnime` frontend shape:

- `name`
- `url`
- `image_url`
- `anime_type`
- `rating`
- `episodes`
- `description`
- `titleId`
- `watchStatus`
- `isFavourite`
- `totalEpisodes`
- optional source metadata such as `sourceLabel` or `episodeLabel` if it is useful for `/main`

The model should be close enough to `SearchAnime` that the frontend can reuse the existing status update behavior and navigation context.

## Commands

Add two Tauri commands:

- `get_main_premieres`
  - Fetches `https://shinden.pl/main`.
  - Extracts the anime entries from the home-page premieres/currently-added area.
  - Enriches rows with Shinden list status when the user is logged in.

- `get_season_anime`
  - Accepts `year` and `season`.
  - Fetches `https://shinden.pl/series/season/{year}/{season}` or the current season shortcut when requested by the UI.
  - Extracts season entries and enriches them with Shinden list status when possible.

Both commands should tolerate anonymous users. If the user is not logged in, rows still render but status controls stay hidden or disabled according to the existing app pattern.

## Data Flow

1. The home route still tests the Shinden connection on mount.
2. After the connection succeeds, it requests `get_main_premieres`.
3. The backend fetches `/main`, parses anime links, ids, titles, covers, and available metadata, then merges status details from the user's Shinden list when available.
4. The home route renders the discovery rows below the search form.
5. Changing a status calls the existing `update_anime_status` command.
6. Opening an anime in the app sets `params.seriesUrl`, `params.titleId`, current status, favourite value, and total episode count, then navigates to `/episodes`.
7. Opening the Shinden link launches or links to the Shinden anime page directly.
8. The `Sezony` button opens `/seasons`.
9. The seasons route lets the user select a year and season, then calls `get_season_anime`.

## UI

The home page should keep the search experience as the primary focus. The `Nowosci` section should sit below the form as a compact list, not a large landing-page replacement.

Each discovery row should reuse the visual language from search and watchlist rows:

- rating or fallback placeholder
- small cover image
- title
- type and episode count/episode label when known
- status select for logged-in users
- app-open button for the existing episode flow
- Shinden-link button or text link

The `Sezony` button should be visually small and close to the search form. It should not compete with the primary `Szukaj` action.

The seasons route should be practical and scannable:

- header with year input/select and season selector
- reload/load action
- list of season anime rows
- same status and link actions as the home discovery list

## Error Handling

- If `/main` cannot be fetched or parsed, log the error and keep the search form usable.
- If a season page cannot be fetched or parsed, show an empty state or warning on the seasons route.
- If status enrichment fails because the user is anonymous or Shinden profile lookup fails, still return discovery rows without status data.
- If a status write fails, keep the previous status selected and log the failure.
- If a row lacks a valid title id, hide status controls and app episode navigation for that row, but still allow opening the Shinden link when a URL exists.

## Testing

- Add Rust unit tests for extracting title ids and basic row data from representative `/main` snippets.
- Add Rust unit tests for extracting season rows from representative season-page snippets.
- Add Rust unit tests for season URL building.
- Add Svelte type checks with `npm run check`.
- Run Rust tests with `cargo test --manifest-path src-tauri/Cargo.toml` when Cargo is available.
