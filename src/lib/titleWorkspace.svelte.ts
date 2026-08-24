import {
    activeTitleSession,
    activateTitleSession,
    closeTitleSession,
    createTitleWorkspaceState,
    openTitleSession,
    parseWorkspacePreferences,
    setFullscreenPresentation,
    setWorkspaceLayout,
    updateActiveTitleSession,
    type FullscreenPresentation,
    type TitleOpenInput,
    type TitleSession,
    type TitleView,
    type TitleWorkspaceLayout,
    type TitleWorkspaceState,
} from "$lib/titleWorkspace";
import type { TitleNavigationContext } from "$lib/global.svelte";

const preferencesStorageKey = "shinden:title-workspace-preferences";

let state = $state<TitleWorkspaceState>(
    createTitleWorkspaceState(loadStoredPreferences()),
);

export const titleWorkspace = {
    get tabs() {
        return state.tabs;
    },

    get activeTitleId() {
        return state.activeTitleId;
    },

    get activeSession() {
        return activeTitleSession(state);
    },

    get layout() {
        return state.layout;
    },

    get fullscreenPresentation() {
        return state.fullscreenPresentation;
    },

    open(input: TitleOpenInput) {
        const result = openTitleSession(state, input);
        state = result.state;
        return {
            ...result,
            session: activeTitleSession(state),
        };
    },

    activate(titleId: number) {
        state = activateTitleSession(state, titleId);
        return activeTitleSession(state);
    },

    close(titleId: number) {
        state = closeTitleSession(state, titleId);
        return activeTitleSession(state);
    },

    saveActiveContext(context: TitleNavigationContext, view?: TitleView) {
        state = updateActiveTitleSession(state, {
            ...context,
            ...(view ? { view } : {}),
        });
        return activeTitleSession(state);
    },

    setLayout(layout: TitleWorkspaceLayout) {
        state = setWorkspaceLayout(state, layout);
        savePreferences();
    },

    setFullscreenPresentation(presentation: FullscreenPresentation) {
        state = setFullscreenPresentation(state, presentation);
        savePreferences();
    },
};

export function titleSessionNavigationContext(session: TitleSession): TitleNavigationContext {
    return {
        seriesUrl: session.seriesUrl,
        playersUrl: session.playersUrl,
        playerId: session.playerId,
        titleId: session.titleId,
        animeWatchStatus: session.watchStatus,
        animeIsFavourite: session.isFavourite,
        animeTotalEpisodes: session.totalEpisodes,
        episodeProgress: [...session.episodeProgress],
        currentEpisodeIndex: session.currentEpisodeIndex,
    };
}

function loadStoredPreferences() {
    if (typeof localStorage === "undefined") {
        return undefined;
    }

    return parseWorkspacePreferences(localStorage.getItem(preferencesStorageKey));
}

function savePreferences() {
    if (typeof localStorage === "undefined") {
        return;
    }

    localStorage.setItem(preferencesStorageKey, JSON.stringify({
        layout: state.layout,
        fullscreenPresentation: state.fullscreenPresentation,
    }));
}
