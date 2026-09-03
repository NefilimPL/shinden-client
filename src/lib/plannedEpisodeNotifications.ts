export const plannedEpisodeNotificationsStorageKey = "shinden:planned-episode-notifications:v1";
export const plannedEpisodeCheckIntervalMs = 5_000;
const maxNotificationHistory = 20;
const maxFailureDelayMs = 30 * 60_000;

export type PlannedTitle = {
    titleId: number;
    name: string;
    url: string;
    image_url: string;
    watchStatus: string;
    active: boolean;
    releaseDate: string | null;
};

export type PlannedEpisode = {
    title: string;
    link: string;
    episodeNo: number;
    watched: boolean;
};

export type PlannedEpisodeNotification = {
    id: string;
    titleId: number;
    animeName: string;
    seriesUrl: string;
    imageUrl: string;
    episodeLink: string;
    episodeTitle: string;
    episodeNo: number;
    detectedAtMs: number;
    read: boolean;
};

export type PlannedNotificationEntry = {
    lastEpisodeLink: string | null;
    initialized: boolean;
    nextCheckAtMs: number;
    failures: number;
};

export type PlannedNotificationState = {
    entries: Record<number, PlannedNotificationEntry>;
    cursor: number;
    notifications: PlannedEpisodeNotification[];
};

export function emptyPlannedNotificationState(): PlannedNotificationState {
    return {
        entries: {},
        cursor: 0,
        notifications: [],
    };
}

export function loadPlannedNotificationState(raw: string | null): PlannedNotificationState {
    if (!raw) {
        return emptyPlannedNotificationState();
    }

    try {
        const parsed = JSON.parse(raw);
        if (!isPlannedNotificationState(parsed)) {
            return emptyPlannedNotificationState();
        }
        return parsed;
    } catch {
        return emptyPlannedNotificationState();
    }
}

export function savePlannedNotificationState(state: PlannedNotificationState) {
    if (typeof localStorage === "undefined") {
        return;
    }
    localStorage.setItem(plannedEpisodeNotificationsStorageKey, JSON.stringify(state));
}

export function reconcilePlannedTitles(
    state: PlannedNotificationState,
    titles: PlannedTitle[],
    nowMs: number,
): PlannedNotificationState {
    const plannedTitles = titles.filter((title) => title.active && title.watchStatus === "plan");
    const plannedIds = new Set(plannedTitles.map((title) => title.titleId));
    const entries: Record<number, PlannedNotificationEntry> = {};

    for (const title of plannedTitles) {
        const existing = state.entries[title.titleId];
        const releaseDayMs = localReleaseDayMs(title.releaseDate);
        const nextCheckAtMs = releaseDayMs !== null && releaseDayMs > nowMs
            ? releaseDayMs
            : existing?.nextCheckAtMs ?? nowMs;

        entries[title.titleId] = {
            lastEpisodeLink: existing?.lastEpisodeLink ?? null,
            initialized: existing?.initialized ?? false,
            nextCheckAtMs,
            failures: existing?.failures ?? 0,
        };
    }

    return {
        entries,
        cursor: plannedIds.has(state.cursor) ? state.cursor : 0,
        notifications: state.notifications.filter((notification) => plannedIds.has(notification.titleId)),
    };
}

export function nextCheckableTitle(
    state: PlannedNotificationState,
    titles: PlannedTitle[],
    nowMs: number,
): PlannedTitle | null {
    const plannedTitles = titles.filter((title) => title.active && title.watchStatus === "plan");
    if (plannedTitles.length === 0) {
        return null;
    }

    const cursorIndex = Math.max(0, plannedTitles.findIndex((title) => title.titleId === state.cursor));
    for (let offset = 0; offset < plannedTitles.length; offset += 1) {
        const index = (cursorIndex + offset) % plannedTitles.length;
        const title = plannedTitles[index];
        const entry = state.entries[title.titleId];
        if (!entry || entry.nextCheckAtMs > nowMs) {
            continue;
        }

        state.cursor = plannedTitles[(index + 1) % plannedTitles.length].titleId;
        return title;
    }

    return null;
}

export function recordEpisodeSnapshot(
    state: PlannedNotificationState,
    title: PlannedTitle,
    episode: PlannedEpisode | null,
    nowMs: number,
): PlannedNotificationState {
    const entry = state.entries[title.titleId] ?? {
        lastEpisodeLink: null,
        initialized: false,
        nextCheckAtMs: nowMs,
        failures: 0,
    };
    const previousEpisodeLink = entry.lastEpisodeLink;
    const nextEpisodeLink = episode?.link ?? null;
    const isNewEpisode = entry.initialized
        && nextEpisodeLink !== null
        && nextEpisodeLink !== previousEpisodeLink;
    const notifications = isNewEpisode && episode
        ? [{
            id: `${title.titleId}:${episode.link}`,
            titleId: title.titleId,
            animeName: title.name,
            seriesUrl: title.url,
            imageUrl: title.image_url,
            episodeLink: episode.link,
            episodeTitle: episode.title,
            episodeNo: episode.episodeNo,
            detectedAtMs: nowMs,
            read: false,
        }, ...state.notifications.filter((notification) => notification.id !== `${title.titleId}:${episode.link}`)].slice(0, maxNotificationHistory)
        : state.notifications;

    return {
        ...state,
        entries: {
            ...state.entries,
            [title.titleId]: {
                lastEpisodeLink: nextEpisodeLink,
                initialized: true,
                nextCheckAtMs: nowMs + plannedEpisodeCheckIntervalMs,
                failures: 0,
            },
        },
        notifications,
    };
}

export function recordCheckFailure(
    state: PlannedNotificationState,
    titleId: number,
    nowMs: number,
): PlannedNotificationState {
    const entry = state.entries[titleId];
    if (!entry) {
        return state;
    }

    const delayMs = Math.min(maxFailureDelayMs, plannedEpisodeCheckIntervalMs * 2 ** entry.failures);
    return {
        ...state,
        entries: {
            ...state.entries,
            [titleId]: {
                ...entry,
                failures: entry.failures + 1,
                nextCheckAtMs: nowMs + delayMs,
            },
        },
    };
}

export function markNotificationsRead(state: PlannedNotificationState): PlannedNotificationState {
    return {
        ...state,
        notifications: state.notifications.map((notification) => ({ ...notification, read: true })),
    };
}

function localReleaseDayMs(value: string | null): number | null {
    if (!value) {
        return null;
    }

    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const polishMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    const [year, month, day] = isoMatch
        ? [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])]
        : polishMatch
            ? [Number(polishMatch[3]), Number(polishMatch[2]), Number(polishMatch[1])]
            : [NaN, NaN, NaN];
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date.getTime();
}

function isPlannedNotificationState(value: unknown): value is PlannedNotificationState {
    if (!value || typeof value !== "object") {
        return false;
    }
    const state = value as Partial<PlannedNotificationState>;
    return typeof state.cursor === "number"
        && Array.isArray(state.notifications)
        && state.entries !== null
        && typeof state.entries === "object";
}
