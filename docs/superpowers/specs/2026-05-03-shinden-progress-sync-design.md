# Shinden Progress Sync Design

## Goal

Let logged-in users manage their Shinden anime status and watched episode progress directly from Shinden Client.

## Scope

- Change an anime list status from the in-app watching list.
- Show whether each episode is watched on the episode list.
- Let users mark a single episode as watched from the episode list.
- Add episode navigation actions on the player screen:
  - Mark watched and go to the next episode.
  - Go to the next episode.
  - Go to the previous episode.
- For the true final episode of a completed-length anime, replace "mark watched and go next" with "mark watched" and complete the anime on Shinden.

## Non-Goals

- Do not create offline progress storage or delayed sync.
- Do not mark all earlier episodes automatically when marking one episode watched.
- Do not treat the last currently available stream as the final episode.
- Do not implement manga, novels, custom lists, ratings, notes, favourites, or bulk updates.

## Shinden Endpoints

The app will keep Shinden as the source of truth. The Tauri backend will call the same public list API used by `lista.shinden.pl`, using the authenticated session cookies already managed by `shinden-pl-api`.

- Read list items:
  `GET https://lista.shinden.pl/api/userlist/{userId}/anime/{status}?limit={limit}&offset={offset}`
- Read list episode watch state:
  `GET https://lista.shinden.pl/api/title-episodes/{titleId}/{userId}`
- Change title status:
  `POST https://lista.shinden.pl/api/title-status-change`
- Change watched episodes:
  `POST https://lista.shinden.pl/api/title-watched-episodes-change`

The status payload will use Shinden values: `in progress`, `completed`, `skip`, `hold`, `dropped`, `plan`, or `null`.

## Backend Model

The existing watchlist model will be extended or complemented with a richer Shinden list item model that includes:

- `titleId`
- `seriesUrl`
- `name`
- `watchStatus`
- `watchedEpisodesCount`
- `totalEpisodes`
- existing display fields such as cover, rating, type, and description

The episode watch model will include:

- existing Shinden playback episode link and title
- `episodeId`
- `episodeNo`
- `watched`
- `viewCnt`
- `totalEpisodes`
- `isTrueFinalEpisode`

`isTrueFinalEpisode` is true only when Shinden provides a known `totalEpisodes` value and `episodeNo === totalEpisodes`. If `totalEpisodes` is missing, unknown, or greater than the loaded episode number, the app must not auto-complete the anime.

## Data Flow

1. The watchlist route loads Shinden list items with title ids and current statuses.
2. Changing the status calls a Tauri command that sends `title-status-change`, then refreshes the row or list.
3. Opening an anime stores title context in `params`: series URL, title id, title name, current status, watched count, and total episodes.
4. The episodes route loads playback episodes from `get_episodes` and watch-state episodes from `title-episodes`.
5. The route merges both lists by episode number so each row can show watched status while still using the existing playback link.
6. Opening an episode stores current episode context: title id, total episodes, episode id, episode number, episode link, previous/next episode links, and whether it is the true final episode.
7. The player route uses that context for navigation actions.

## Player Actions

For non-final episodes:

- `Mark watched and go next`: mark the current episode watched, then navigate to the next episode.
- `Go next`: navigate to the next episode without changing watched state.
- `Previous episode`: navigate to the previous episode when one exists.

If the current episode is non-final but no next playback episode is loaded, the primary action becomes `Mark watched`. It marks only the current episode and leaves the anime status unchanged.

For the true final episode:

- Replace `Mark watched and go next` with `Mark watched`.
- `Mark watched` marks the current episode watched and changes the anime status to `completed`.
- Do not show or enable a next-episode action when no next episode exists.

This final-episode behavior must be based on the title's full episode count, not on availability. For example, episode 10 of a 12-episode anime is not final even if only 10 episodes currently have streams.

## Error Handling

- If the user is not logged in, show an error or empty state instead of sending update commands.
- If a Shinden write fails, keep the current route visible, log the error, and do not optimistically mark the UI as synced.
- If the list episode API cannot be merged with playback episodes, fall back to showing playback episodes without watched badges and log a warning.
- If a status update succeeds but refresh fails, show the local status change only after the command confirms success.

## UI

- The watchlist row gets a compact status select next to the existing open button.
- Episode rows show a small watched/not-watched badge and a compact action button for marking watched.
- The player action bar reuses the current built-in player footer style and keeps actions below the video or iframe.
- Buttons should be disabled while a write command is running to prevent duplicate writes.

## Testing

- Add Rust unit tests for Shinden status slug/value mapping.
- Add Rust unit tests for final-episode detection.
- Add Rust unit tests for merging playback episodes with watch-state episodes by episode number.
- Add frontend type checks with `npm run check`.
- Run Rust tests with `cargo test --manifest-path src-tauri/Cargo.toml` when Cargo is available.
