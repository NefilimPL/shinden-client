import {
    activeTitleSession,
    activateBaseSession,
    activateTitleSession,
    closeTitleSession,
    createTitleWorkspaceState,
    openTitleSession,
    parseWorkspacePreferences,
    saveBaseViewContext,
    setFullscreenPresentation,
    setWorkspaceLayout,
    updateActiveTitleSession,
    workspacePreferencesForStorage,
    type BaseViewContext,
    type FullscreenPresentation,
    type TitleOpenInput,
    type TitleSession,
    type TitleView,
    type TitleWorkspaceLayout,
    type TitleWorkspaceState,
} from "$lib/titleWorkspace";
import { normalizedBaseViewContext } from "$lib/baseViewState";
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
        return state.activeTab.kind === "title" ? state.activeTab.titleId : null;
    },

    get activeTab() {
        return state.activeTab;
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
    get baseView() {
        return state.baseView;
    },


    open(input: TitleOpenInput, activate = true) {
        const result = openTitleSession(state, input, activate);
        state = result.state;
        return {
            ...result,
            session: state.tabs.find((tab) => tab.titleId === input.titleId) ?? null,
        };
    },

    activate(titleId: number) {
        state = activateTitleSession(state, titleId);
        return activeTitleSession(state);
    },

    close(titleId: number) {
        const result = closeTitleSession(state, titleId);
        state = result.state;
        return result;
    },

    activateBase() {
        state = activateBaseSession(state);
        return state.baseView;
    },

    saveBaseView(context: BaseViewContext) {
        state = saveBaseViewContext(state, normalizedBaseViewContext(context));
        return state.baseView;
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
        animeName: session.name,
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

    localStorage.setItem(preferencesStorageKey, JSON.stringify(workspacePreferencesForStorage(state)));
}
