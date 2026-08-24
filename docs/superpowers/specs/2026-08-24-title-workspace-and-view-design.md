# Title Workspace and View Design

## Goal

Let users keep several anime open in one in-memory workspace, switch between them without duplicates, and choose how that workspace is displayed. The application must also offer a fullscreen presentation preference that either hides or leaves the Windows taskbar visible.

## Scope

This design covers only the first requested stage:

- title cards (tabs) and their vertical, horizontal, and hidden layouts;
- returning from an episode player to the active anime's main card;
- presentation preferences for cards and window fullscreen;
- migration of existing title-opening entry points to the shared workspace.

It explicitly excludes the episode-address/API repair, failed-watchlist reporting, additional filters, player classification and iframe fixes, episode availability indicators, and filtered discovery search. Those are separate follow-up stages.

## Current State

The frontend keeps one mutable global `params` object. Search, premieres, seasons, watchlist, user lists, and related-series buttons overwrite it and navigate to `/episodes`. The `/episodes`, `/players`, and `/watching` routes therefore represent only one title at a time.

The window header has a single fullscreen button which always uses the Tauri native fullscreen state. The player route restores that native fullscreen state after an embedded player exits element fullscreen. There is no shared visual-preferences menu.

## Workspace Model

Create a frontend-only title workspace store. Its state contains:

- `tabs`: ordered, open title sessions;
- `activeTitleId`: the selected session, if any;
- `layout`: `vertical`, `horizontal`, or `none`;
- `fullscreenPresentation`: `immersive` or `taskbar`.

Each title session is keyed by `titleId` and contains the existing navigation context needed by the title routes: canonical series URL, title name and image where available, current view (`episodes`, `players`, or `watching`), player URL/id, watch-status metadata, episode progress, and selected episode index.

`openTitle(context)` is the only public way to open a title. It saves the currently active session, finds the requested `titleId`, and either activates it or appends a new session. It then restores the selected session into the active route context. A title can therefore occur only once.

When `layout` is `none`, the workspace retains only the active session: opening another title replaces it. This is the old single-view behavior. In vertical and horizontal layouts, opening another title creates another session.

Open sessions are never written to local storage, restored at startup, or encoded in a URL. On application startup, the workspace contains no tabs. The two display preferences are stored locally and restored on startup.

## Card Presentation

The workspace chrome appears only while a title route is active and is placed beneath the global header.

### Vertical layout

The card rail is on the left. Each card displays only a small title image. Every image has a tooltip and accessible label containing the complete anime name. An always-visible small `×` closes the card.

### Horizontal layout

The card rail is above the title content. Cards show both image and name while space allows. When space becomes insufficient, labels are hidden from inactive cards first; the active card always retains its name. Cards keep their image and always-visible `×`, and the rail scrolls horizontally when needed.

### Shared behavior

The active card is visually distinct. Clicking it or opening the same title from any list selects it rather than creating a duplicate. Closing the active card selects the nearest remaining card. Closing the final card navigates to the home page. Non-title routes remain unchanged.

## Navigation Flow

All title-opening sources call the shared `openTitle` action: search results, main premieres, seasonal results, watching list, account lists, and related series. They do not assign `params` directly.

The active card owns its subview:

1. Opening a title selects its `episodes` subview.
2. Choosing an episode selects the `players` subview for that same title.
3. Choosing a player selects the `watching` subview for that same title.
4. The player UI has an `Anime` action which returns to its session's `episodes` subview.

Before a route transition or tab activation, changes made to the current title context are copied to the active session. When a session is activated, its saved context is restored and the title route is remounted so it loads data for the selected title rather than the previously visible one.

## View Preferences and Fullscreen

Add a `Widok` menu to the global header. It exposes the card layout and fullscreen presentation controls independently.

- `Ukryj pasek zadan` (`immersive`) keeps the current behavior: the fullscreen button uses Tauri native fullscreen.
- `Pokaz pasek zadan` (`taskbar`) produces a fullscreen-like maximized window without Tauri native fullscreen, so the Windows taskbar remains available.

The fullscreen button respects the chosen presentation. Player element-fullscreen exit may restore native window fullscreen only when the selected presentation is `immersive` and the user had intentionally entered it. It must never switch a `taskbar` presentation into native fullscreen.

## Error Handling

A missing or invalid `titleId` cannot create a tab; the caller keeps its existing disabled/error behavior. Closing or activating a non-existent tab is a no-op. If a session has incomplete transient player data, returning to `episodes` remains valid and uses its canonical title URL.

Invalid persisted display-preference values fall back to `vertical` for cards and `immersive` for fullscreen presentation. No title session is persisted, so stale or invalid session data cannot affect a subsequent application launch.

## Testing

Add focused Node tests for the workspace store covering:

- opening a new title adds and activates one card;
- opening an existing title activates it without a duplicate;
- card order and selection after closing active, inactive, and final cards;
- `none` layout replacing the previous session;
- session context save/restore across tab activation;
- invalid preferences falling back safely and sessions never being serialized.

Extend fullscreen tests to verify the selected presentation maps to native fullscreen versus maximize behavior, and that player fullscreen exit restores native fullscreen only for `immersive` mode.

Run `npm run check`, the complete Node test suite, and the relevant Tauri/Rust tests after implementation.
