import type { AnimeWatchStatus, EpisodeProgress } from "./types";

export type TitleView = "episodes" | "players" | "watching";
export type BaseViewId = "watchlist" | "user-lists" | "search" | "seasons";
export type BaseViewContext = {
    id: BaseViewId;
    scrollY: number;
    state: Record<string, unknown>;
};

export type WorkspaceActiveTab =
    | { kind: "base" }
    | { kind: "title"; titleId: number };

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
    recentlyViewedTitleIds: number[];
    activeTab: WorkspaceActiveTab;
};

export type TitleSessionOpenResult = {
    state: TitleWorkspaceState;
    created: boolean;
};

export type TitleSessionCloseResult = {
    state: TitleWorkspaceState;
    closed: boolean;
    wasActive: boolean;
    nextSession: TitleSession | null;
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


export function createTitleWorkspaceState(
    preferences: Partial<TitleWorkspacePreferences> = {},
): TitleWorkspaceState {
    return {
        tabs: [],
        recentlyViewedTitleIds: [],
        baseView: { id: "watchlist", scrollY: 0, state: {} },
        activeTab: { kind: "base" },
        layout: isWorkspaceLayout(preferences.layout) ? preferences.layout : defaultPreferences.layout,
        fullscreenPresentation: isFullscreenPresentation(preferences.fullscreenPresentation)
            ? preferences.fullscreenPresentation
            : defaultPreferences.fullscreenPresentation,
    };
}

export function openTitleSession(
    state: TitleWorkspaceState,
    input: TitleOpenInput,
    activate = true,
): TitleSessionOpenResult {
    if (state.layout === "none") {
        return { state, created: false };
    }

    const existing = state.tabs.find((tab) => tab.titleId === input.titleId);
    if (existing) {
        return {
            state: activate
                ? {
                    ...state,
                    activeTab: { kind: "title", titleId: existing.titleId },
                    recentlyViewedTitleIds: touchRecentlyViewed(state.recentlyViewedTitleIds, existing.titleId),
                }
                : state,
            created: false,
        };
    }

    const session = createTitleSession(input);
    return {
        state: {
            ...state,
            tabs: [...state.tabs, session],
            activeTab: activate ? { kind: "title", titleId: session.titleId } : state.activeTab,
            recentlyViewedTitleIds: activate
                ? touchRecentlyViewed(state.recentlyViewedTitleIds, session.titleId)
                : state.recentlyViewedTitleIds,
        },
        created: true,
    };
}

export function activateTitleSession(state: TitleWorkspaceState, titleId: number): TitleWorkspaceState {
    if (!state.tabs.some((tab) => tab.titleId === titleId)) {
        return state;
    }

    return {
        ...state,
        activeTab: { kind: "title", titleId },
        recentlyViewedTitleIds: touchRecentlyViewed(state.recentlyViewedTitleIds, titleId),
    };
}

export function activateBaseSession(state: TitleWorkspaceState): TitleWorkspaceState {
    return { ...state, activeTab: { kind: "base" } };
}

export function saveBaseViewContext(
    state: TitleWorkspaceState,
    baseView: BaseViewContext,
): TitleWorkspaceState {
    return { ...state, baseView };
}
export function closeTitleSession(state: TitleWorkspaceState, titleId: number): TitleSessionCloseResult {
    const tabExists = state.tabs.some((tab) => tab.titleId === titleId);
    if (!tabExists) {
        return {
            state,
            closed: false,
            wasActive: false,
            nextSession: activeTitleSession(state),
        };
    }

    const wasActive = state.activeTab.kind === "title" && state.activeTab.titleId === titleId;
    const tabs = state.tabs.filter((tab) => tab.titleId !== titleId);
    const recentlyViewedTitleIds = state.recentlyViewedTitleIds.filter((id) => id !== titleId);
    const nextTitleId = wasActive
        ? availableRecentlyViewedTitleId(recentlyViewedTitleIds, tabs)
        : null;
    const nextState: TitleWorkspaceState = {
        ...state,
        tabs,
        recentlyViewedTitleIds,
        activeTab: wasActive
            ? nextTitleId === null ? { kind: "base" } : { kind: "title", titleId: nextTitleId }
            : state.activeTab,
    };

    return {
        state: nextState,
        closed: true,
        wasActive,
        nextSession: activeTitleSession(nextState),
    };
}

export function updateActiveTitleSession(
    state: TitleWorkspaceState,
    update: Partial<Omit<TitleSession, "titleId">>,
): TitleWorkspaceState {
    if (state.activeTab.kind !== "title") {
        return state;
    }

    const activeTitleId = state.activeTab.titleId;

    return {
        ...state,
        tabs: state.tabs.map((tab) => tab.titleId === activeTitleId
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

    return {
        ...state,
        layout,
        tabs: [],
        recentlyViewedTitleIds: [],
        activeTab: { kind: "base" },
    };
}

export function setFullscreenPresentation(
    state: TitleWorkspaceState,
    fullscreenPresentation: FullscreenPresentation,
): TitleWorkspaceState {
    return { ...state, fullscreenPresentation };
}

export function activeTitleSession(state: TitleWorkspaceState): TitleSession | null {
    if (state.activeTab.kind !== "title") {
        return null;
    }

    const activeTitleId = state.activeTab.titleId;
    return state.tabs.find((tab) => tab.titleId === activeTitleId) ?? null;
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

function touchRecentlyViewed(titleIds: number[], titleId: number): number[] {
    return [titleId, ...titleIds.filter((id) => id !== titleId)];
}

function availableRecentlyViewedTitleId(
    recentlyViewedTitleIds: number[],
    tabs: TitleSession[],
): number | null {
    return recentlyViewedTitleIds.find((titleId) => tabs.some((tab) => tab.titleId === titleId)) ?? null;
}

function isWorkspaceLayout(value: unknown): value is TitleWorkspaceLayout {
    return value === "vertical" || value === "horizontal" || value === "none";
}

function isFullscreenPresentation(value: unknown): value is FullscreenPresentation {
    return value === "immersive" || value === "taskbar";
}
