# Execution ledger — plan: 2026-11-04-local-library.md

Ruling: Work in the explicitly named repositories on their existing dev branches, preserving the user's path dependency; no worktree or automatic commits.

Ruling: SQLite selection confirms the proposed local-library approach. Implement the authorized feature without another permission round. Add explicit network and import toggles to make the privacy boundary visible.

Pre-flight: Task 1 exports local storage and profile state consumed by Task 2; Task 2 exports commands consumed by Task 3. Capture profile IDs before awaits; profile names are display-only.

Baseline: 156 Node tests pass. API baseline test requires an alternate target directory because the API repository is outside the writable root. Use npm.cmd because PowerShell disables npm.ps1.

Task 1: complete — profile isolation, Guest versus an account called Guest, persistence, unknown totals, episode idempotency, import preservation and transaction rollback verified in Rust. SQLite is bundled.

Task 2: complete — anonymous and account clients separated; no remote writes from application progress/status/rating methods; public search and paginated atomic import implemented; per-request network permission, account-session revocation and import cancellation generation verified. Legacy remote backend helpers are compiled only for their existing compatibility tests.

Task 3: complete — Tauri commands and private remote windows compile; settings expose profile selection, database path, network and import toggles, nick/URL import; Guest editing enabled; background scans removed; profile revisions clear tabs/notifications and reject late IPC results. Frontend production build and svelte-check pass (one existing video-caption warning).

Final review: independent read-only review across both repositories identified five Important findings and no Critical findings. All five were reproduced and fixed:

- Partial import responses: `review_partial_import_pages_do_not_succeed` and `review_unmappable_import_rows_are_rejected` RED→GREEN; malformed/incomplete pages cannot reach the database transaction.
- Cross-profile refresh state: `review_refresh_status_is_scoped_to_the_profile` RED→GREEN; status maps are keyed by stable profile ID.
- Delayed playback after logout/network disable: `review_revoked_client_cannot_issue_later_requests` RED→GREEN; shared network permission and revocation are checked for subsequent requests and redirects.
- Permanent playback cache: `review_empty_cached_playback_is_retryable` and `review_expired_players_are_refreshed_online_but_remain_available_offline` RED→GREEN; online iframe resolution is fresh and player-list cache expires.
- Metadata loss during search: `review_metadata_refresh_preserves_release_dates_and_loaded_details` RED→GREEN.

Additional regressions fixed with RED→GREEN checks: late image-proxy token/startup IPC and stale profile snapshots, blocked HTML returned from a JSON endpoint, cancelled imports after fast network re-enabling, and cached availability filtering for unwatched episodes.

Validation: 161 Node tests; 142 API Rust tests; 10 native Tauri tests; svelte-check with zero errors; production frontend build; git diff --check in both repositories. No remote login or live Shinden import was attempted. Public-user parser and remote response handling were tested against fixtures/local HTTP servers; live site compatibility remains unverified. `fresh_application_session_starts_as_guest_without_reusing_a_previous_account` also verified RED→GREEN: each fresh application session starts in Guest; account data is preserved for explicit profile selection.

Task 4: complete — documentation updated in both repositories, independent review addressed, working changes preserved in the requested repositories without commits, merge, publication or deployment. No deferred review findings.
