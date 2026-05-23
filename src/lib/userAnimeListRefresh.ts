import { invoke } from "@tauri-apps/api/core";
import type { UserAnimeListRefreshSummary } from "$lib/types";

let resumePromise: Promise<UserAnimeListRefreshSummary | null> | null = null;

export function resumeUserAnimeListRefresh() {
    if (resumePromise) {
        return resumePromise;
    }

    resumePromise = invoke<UserAnimeListRefreshSummary>("resume_user_anime_list_cache_refresh")
        .catch(() => null)
        .finally(() => {
            resumePromise = null;
        });

    return resumePromise;
}
