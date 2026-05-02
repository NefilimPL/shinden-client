# Shinden Watching List Design

## Goal

Add an in-app entry point to the Shinden `Ogladam` anime list so logged-in users do not need to search each currently watched title manually.

## Scope

- Show a button in the navbar to the left of the account/nickname area.
- Show the button only after the app knows the user is logged in.
- Load all titles from the user's Shinden `Ogladam` list.
- Display every returned `Ogladam` title for the first version, without filtering by episode availability.
- Let users click a title and continue through the existing `/episodes` flow.

## Non-Goals

- Do not change the Shinden website.
- Do not require any special Shinden-side permissions or commands.
- Do not filter titles by available episodes yet.
- Do not support manga, novels, completed, planned, or custom lists in this first version.

## Architecture

The app will add a local Tauri command, not a Shinden-side command. That command will call Shinden's existing list API:

`https://lista.shinden.pl/api/userlist/{userId}/anime/in-progress?limit={limit}&offset={offset}`

The user id will be derived from the authenticated Shinden profile page that the app can already access through the existing session cookies. The command will return a compact list model suitable for the frontend.

## Data Flow

1. `AccountButton` continues loading user data after startup.
2. When `globalStates.user.name` is present, `Navbar` shows a new "Ogladam" button before the account button.
3. The button opens a new route for the watching list.
4. The route calls the local Tauri command.
5. The command reads the logged-in user profile, extracts user id, fetches all `in-progress` anime list pages, and maps list items to frontend data.
6. Clicking a title sets `params.seriesUrl` and navigates to `/episodes`.

## Error Handling

- If the user is not logged in, the route should show an empty or login-oriented state instead of crashing.
- If the list API fails, set the global loading state to error and log the failure.
- If Shinden returns zero titles, show the existing empty-state component.
- If a title lacks an expected id or title, skip it rather than rendering a broken row.

## UI

The first version should reuse the current list styling from search results: title image, title, type, rating/progress detail where useful, and a play/open button. This keeps the feature visually consistent and avoids introducing a new design language.

## Testing

- Add backend unit tests for extracting the Shinden user id from profile links.
- Add backend unit tests for mapping list API items into the returned frontend model.
- Run Svelte checks and Rust tests after implementation.

