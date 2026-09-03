import { invoke } from "@tauri-apps/api/core";
import {
    emptyPlannedNotificationState,
    loadPlannedNotificationState,
    markNotificationsRead,
    nextCheckableTitle,
    plannedEpisodeCheckIntervalMs,
    plannedEpisodeNotificationsStorageKey,
    recordCheckFailure,
    recordEpisodeSnapshot,
    reconcilePlannedTitles,
    savePlannedNotificationState,
    type PlannedEpisode,
    type PlannedNotificationState,
    type PlannedTitle,
} from "$lib/plannedEpisodeNotifications";
import { shouldRunPlannedCheck } from "$lib/plannedEpisodeNotificationRunner";
import type { EpisodeProgress, UserAnimeListRefreshStatus, UserAnimeListsPayload } from "$lib/types";
import type { WatchingCacheRefreshStatus } from "$lib/watchlistRefresh";

const userListRefreshIntervalMs = 30 * 60_000;

let state = $state(loadStoredState());
let plannedTitles: PlannedTitle[] = [];
let lastUserListLoadedAtMs = 0;
let timer: ReturnType<typeof window.setTimeout> | null = null;
let active = false;
let tickInProgress = false;

export const plannedEpisodeNotificationStore = {
    get state(): PlannedNotificationState {
        return state;
    },
    start,
    stop,
    refreshNow,
    markRead,
};

function loadStoredState() {
    if (typeof localStorage === "undefined") {
        return emptyPlannedNotificationState();
    }
    return loadPlannedNotificationState(localStorage.getItem(plannedEpisodeNotificationsStorageKey));
}

function persist() {
    savePlannedNotificationState(state);
}

function start() {
    if (active) {
        return;
    }
    active = true;
    void refreshNow();
}

function stop() {
    active = false;
    if (timer) {
        window.clearTimeout(timer);
        timer = null;
    }
}

async function refreshNow() {
    if (!active) {
        return;
    }

    try {
        const payload = await invoke<UserAnimeListsPayload>("get_user_anime_lists", { forceRefresh: false });
        if (!active) {
            return;
        }
        plannedTitles = payload.items.map((item) => ({
            titleId: item.titleId,
            name: item.name,
            url: item.url,
            image_url: item.image_url,
            watchStatus: item.watchStatus,
            active: item.active,
            releaseDate: item.releaseDate ?? null,
        }));
        state = reconcilePlannedTitles(state, plannedTitles, Date.now());
        lastUserListLoadedAtMs = Date.now();
        persist();
    } catch {
        // The next scheduled tick retries loading the cached list without affecting history.
    }

    scheduleNext(0);
}

async function tick() {
    timer = null;
    if (!active || tickInProgress) {
        return;
    }

    tickInProgress = true;
    try {
        if (Date.now() - lastUserListLoadedAtMs >= userListRefreshIntervalMs || plannedTitles.length === 0) {
            await refreshTitles();
        }

        const [watchingStatus, userListStatus] = await Promise.all([
            invoke<WatchingCacheRefreshStatus>("get_watching_cache_refresh_status"),
            invoke<UserAnimeListRefreshStatus>("get_user_anime_list_refresh_status"),
        ]);
        if (!active || !shouldRunPlannedCheck({
            watchingRefreshRunning: watchingStatus.running,
            userListRefreshRunning: userListStatus.running,
            userLoggedIn: true,
        })) {
            return;
        }

        const title = nextCheckableTitle(state, plannedTitles, Date.now());
        persist();
        if (!title) {
            return;
        }

        try {
            const episodes = await invoke<EpisodeProgress[]>("get_episodes_with_progress", {
                url: title.url,
                titleId: title.titleId,
                totalEpisodes: null,
                titleName: title.name,
            });
            if (active) {
                state = recordEpisodeSnapshot(state, title, firstUnwatchedEpisode(episodes), Date.now());
                persist();
            }
        } catch {
            if (active) {
                state = recordCheckFailure(state, title.titleId, Date.now());
                persist();
            }
        }
    } finally {
        tickInProgress = false;
        if (active) {
            scheduleNext(plannedEpisodeCheckIntervalMs);
        }
    }
}

async function refreshTitles() {
    try {
        const payload = await invoke<UserAnimeListsPayload>("get_user_anime_lists", { forceRefresh: false });
        plannedTitles = payload.items.map((item) => ({
            titleId: item.titleId,
            name: item.name,
            url: item.url,
            image_url: item.image_url,
            watchStatus: item.watchStatus,
            active: item.active,
            releaseDate: item.releaseDate ?? null,
        }));
        state = reconcilePlannedTitles(state, plannedTitles, Date.now());
        lastUserListLoadedAtMs = Date.now();
        persist();
    } catch {
        // A transient user-list error should not discard the currently persisted queue.
    }
}

function firstUnwatchedEpisode(episodes: EpisodeProgress[]): PlannedEpisode | null {
    const episode = episodes.find((candidate) => !candidate.watched);
    if (!episode) {
        return null;
    }
    return {
        title: episode.title,
        link: episode.link,
        episodeNo: episode.episodeNo,
        watched: episode.watched,
    };
}

function markRead() {
    state = markNotificationsRead(state);
    persist();
}

function scheduleNext(delayMs: number) {
    if (!active || timer) {
        return;
    }
    timer = window.setTimeout(() => {
        void tick();
    }, delayMs);
}
