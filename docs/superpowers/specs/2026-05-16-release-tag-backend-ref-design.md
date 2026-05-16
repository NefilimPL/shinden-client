# Release Tag Backend Ref Design

## Goal

GitHub release tags should be able to carry both the application version and the backend API branch used for the EXE build. A tag such as `v4.0.7-dev` should build app version `4.0.7` against backend branch `dev`, while the full tag text remains visible in the update version list in the client GUI.

## Current State

The release workflow strips `v` or `app-v` from the tag and writes the remaining text directly into `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`. This means a tag like `v4.0.7-dev` becomes app version `4.0.7-dev`. That can break the Windows EXE/installer build path, and it also makes the updater compare against the suffixed version.

Backend selection already exists through `BACKEND_REF`. For published GitHub releases, the workflow currently uses the repository variable `SHINDEN_BACKEND_REF` or `Main`. `Main` means the workflow tries `main` first and then `master`.

The GUI update list is built from GitHub releases with a `latest.json` asset. It currently parses the tag into a version and renders `v{version}`, so a branch suffix is not guaranteed to be shown clearly as release identity.

## Proposed Behavior

Release tags keep the existing accepted prefixes:

- `v4.0.7`
- `V4.0.7`
- `app-v4.0.7`
- `app-v4.0.7-dev`

The workflow parses each tag into:

- `APP_VERSION`: the numeric semantic version core, for example `4.0.7`.
- `RELEASE_BACKEND_REF`: the suffix after the numeric version, for example `dev`.
- `RELEASE_DISPLAY_VERSION`: the full tag text or normalized display text used by the client update list.

If the tag has no suffix after the version, the backend ref defaults to the existing `BACKEND_REF` value. For release builds, that means `SHINDEN_BACKEND_REF` when configured, otherwise `Main`. `Main` keeps the current fallback behavior of trying `main` and then `master`.

If the tag has a suffix after the version, that suffix wins over the default backend ref. Examples:

- `v4.0.7` builds app version `4.0.7` with backend `Main`, resolving to `main` or `master`.
- `v4.0.7-dev` builds app version `4.0.7` with backend branch `dev`.
- `v4.0.7-preview` builds app version `4.0.7` with backend branch `preview`.

Only safe branch suffixes are accepted: ASCII letters, digits, dots, underscores, and hyphens. The suffix is trimmed of the single separator after the version, so `v4.0.7-dev` maps to `dev`, not `-dev`.

## Data Flow

1. The release workflow receives the GitHub release tag.
2. The version parser extracts the numeric app version and optional backend suffix.
3. The workflow writes only the numeric app version to Tauri and Cargo manifests.
4. The backend checkout step uses the suffix as the requested backend ref when present.
5. The Tauri updater assets are uploaded under the original GitHub release tag.
6. The client fetches GitHub releases, keeps the full tag as the visible label, and still uses the numeric version core for sorting and updater compatibility.
7. When a user installs a selected release, Rust downloads `latest.json` from the full tag URL but compares the remote manifest version to the numeric version core.

## GUI Behavior

The update dropdown should show the full release identity so users can tell which backend branch was used. For example:

- `v4.0.7`
- `v4.0.7-dev`
- `v4.0.7-preview`

The existing `obecna` marker should still compare against the numeric app version. This means `v4.0.7-dev` can show as current when the installed app version is `4.0.7`; the visible tag still makes the backend branch clear.

## Error Handling

Malformed tags fail early in the release workflow with a clear message. Tags must contain a numeric `major.minor.patch` version after the optional `v` or `app-v` prefix.

If a suffix exists but the backend checkout fails, the workflow fails with the existing backend checkout error. It should not silently fall back to `Main`, because the tag explicitly requested a backend branch.

If no suffix exists, the workflow keeps the current `Main` fallback behavior: try `main`, then `master`.

## Testing

Tests should cover:

- Tag parsing in the workflow-compatible logic: `v4.0.7`, `app-v4.0.7`, `v4.0.7-dev`, and invalid tags.
- GitHub release mapping in TypeScript preserves a visible display label equal to the full tag.
- Update version sorting continues to use the numeric version core.
- Rust updater tag parsing accepts suffixed tags for manifest URLs while returning the numeric version core for update comparison.
- Existing invalid tag rejection still blocks unsafe paths such as `../V4.0.5`.
