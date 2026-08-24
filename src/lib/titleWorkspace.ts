import type { AnimeWatchStatus, EpisodeProgress } from "./types";

export type TitleView = "episodes" | "players" | "watching";
export type BaseViewPath = "/" | "/watchlist";
export type BaseViewContext = {
    path: BaseViewPath;
    scrollY: number;
};

export type TitleWorkspaceLayout = "vertical" | "horizontal" | "none";
export type FullscreenPresentation = "immersive" | "taskbar";

export type TitleWorkspacePreferences = {
    layout: TitleWorkspaceLayout;
    fullscreenPresentation: FullscreenPresentation;
};

export type TitleOpenInput = {
    titleId: number;
    name: string;
    imageUrl: string;
    seriesUrl: string;
    watchStatus: AnimeWatchStatus;
    isFavourite: number;
    totalEpisodes: number | null;
};

export type TitleSession = TitleOpenInput & {
    view: TitleView;
    playersUrl: string;
    playerId: string;
    episodeProgress: EpisodeProgress[];
    currentEpisodeIndex: number;
};

export type TitleWorkspaceState = TitleWorkspacePreferences & {
    baseView: BaseViewContext;
    tabs: TitleSession[];
    activeTitleId: number | null;
};

const defaultPreferences: TitleWorkspacePreferences = {
    layout: "vertical",
    fullscreenPresentation: "immersive",
};

export function parseWorkspacePreferences(value: string | null | undefined): TitleWorkspacePreferences {
    if (!value) {
        return { ...defaultPreferences };
    }

    try {
        const parsed = JSON.parse(value) as Partial<TitleWorkspacePreferences>;
        return {
            layout: isWorkspaceLayout(parsed.layout) ? parsed.layout : defaultPreferences.layout,
            fullscreenPresentation: isFullscreenPresentation(parsed.fullscreenPresentation)
                ? parsed.fullscreenPresentation
                : defaultPreferences.fullscreenPresentation,
        };
    } catch {
        return { ...defaultPreferences };
    }
}

export function workspacePreferencesForStorage(
    state: TitleWorkspaceState,
): TitleWorkspacePreferences {
    return {
        layout: state.layout,
        fullscreenPresentation: state.fullscreenPresentation,
    };
}


export function baseViewContextForRoute(path: string, scrollY: number): BaseViewContext | null {
    if (path !== "/" && path !== "/watchlist") {
        return null;
    }

    return {
        path,
        scrollY: Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0,
    };
}

export function createTitleWorkspaceState(
    preferences: Partial<TitleWorkspacePreferences> = {},
): TitleWorkspaceState {
    return {
        tabs: [],
        baseView: { path: "/", scrollY: 0 },
        activeTitleId: null,
        layout: isWorkspaceLayout(preferences.layout) ? preferences.layout : defaultPreferences.layout,
        fullscreenPresentation: isFullscreenPresentation(preferences.fullscreenPresentation)
            ? preferences.fullscreenPresentation
            : defaultPreferences.fullscreenPresentation,
    };
}

export function openTitleSession(state: TitleWorkspaceState, input: TitleOpenInput) {
    const existing = state.tabs.find((tab) => tab.titleId === input.titleId);
    if (existing) {
        return {
            state: { ...state, activeTitleId: existing.titleId },
            created: false,
        };
    }

    const session = createTitleSession(input);
    const tabs = state.layout === "none" ? [session] : [...state.tabs, session];
    return {
        state: { ...state, tabs, activeTitleId: session.titleId },
        created: true,
    };
}

export function activateTitleSession(state: TitleWorkspaceState, titleId: number): TitleWorkspaceState {
    if (!state.tabs.some((tab) => tab.titleId === titleId)) {
        return state;
    }

    return { ...state, activeTitleId: titleId };
}


export function saveBaseViewContext(
    state: TitleWorkspaceState,
    baseView: BaseViewContext,
): TitleWorkspaceState {
    return { ...state, baseView };
}
export function closeTitleSession(state: TitleWorkspaceState, titleId: number): TitleWorkspaceState {
    const index = state.tabs.findIndex((tab) => tab.titleId === titleId);
    if (index < 0) {
        return state;
    }

    const tabs = state.tabs.filter((tab) => tab.titleId !== titleId);
    if (state.activeTitleId !== titleId) {
        return { ...state, tabs };
    }

    const nextActive = tabs[index] ?? tabs[index - 1] ?? null;
    return {
        ...state,
        tabs,
        activeTitleId: nextActive?.titleId ?? null,
    };
}

export function updateActiveTitleSession(
    state: TitleWorkspaceState,
    update: Partial<Omit<TitleSession, "titleId">>,
): TitleWorkspaceState {
    if (state.activeTitleId === null) {
        return state;
    }

    return {
        ...state,
        tabs: state.tabs.map((tab) => tab.titleId === state.activeTitleId
            ? { ...tab, ...update }
            : tab),
    };
}

export function setWorkspaceLayout(
    state: TitleWorkspaceState,
    layout: TitleWorkspaceLayout,
): TitleWorkspaceState {
    if (layout !== "none") {
        return { ...state, layout };
    }

    const active = activeTitleSession(state);
    return {
        ...state,
        layout,
        tabs: active ? [active] : [],
        activeTitleId: active?.titleId ?? null,
    };
}

export function setFullscreenPresentation(
    state: TitleWorkspaceState,
    fullscreenPresentation: FullscreenPresentation,
): TitleWorkspaceState {
    return { ...state, fullscreenPresentation };
}

export function activeTitleSession(state: TitleWorkspaceState): TitleSession | null {
    return state.tabs.find((tab) => tab.titleId === state.activeTitleId) ?? null;
}

export function titleRouteForView(view: TitleView) {
    switch (view) {
        case "players":
            return "/players";
        case "watching":
            return "/watching";
        case "episodes":
        default:
            return "/episodes";
    }
}

function createTitleSession(input: TitleOpenInput): TitleSession {
    return {
        ...input,
        view: "episodes",
        playersUrl: "",
        playerId: "",
        episodeProgress: [],
        currentEpisodeIndex: -1,
    };
}

function isWorkspaceLayout(value: unknown): value is TitleWorkspaceLayout {
    return value === "vertical" || value === "horizontal" || value === "none";
}

function isFullscreenPresentation(value: unknown): value is FullscreenPresentation {
    return value === "immersive" || value === "taskbar";
}
