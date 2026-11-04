import type {AnimeWatchStatus, EpisodeProgress, User} from "$lib/types";
import {invoke} from "./shindenInvoke.ts";
import { advanceProfileEpoch, profileChanged, resetProfileContext, type LibraryState } from "./librarySession";
import { titleWorkspace } from "./titleWorkspace.svelte";
import { plannedEpisodeNotificationStore } from "./plannedEpisodeNotificationStore.svelte";

import {
    defaultSearchFilters,
    type SearchFilters,
} from "$lib/searchFilters";
export enum LoadingState {
    LOADING,
    WARNING,
    ERROR,
    OK
}

export const globalStates: {
    loadingState: LoadingState;
    consoleState: boolean;
    user: User;
    library: LibraryState;
    libraryReady: boolean;
    profileRevision: number;
} = $state({
    loadingState: LoadingState.OK,
    consoleState: false,
    libraryReady: false,
    profileRevision: 0,
    library: {
        activeProfile: { id: "guest", name: "Guest", publicProfileId: null },
        profiles: [{ id: "guest", name: "Guest", publicProfileId: null }],
        networkEnabled: false, importEnabled: false, authenticated: false, databasePath: "",
    },
    user: {
        name: null,
        image_url: null
    }
});

export type TitleNavigationContext = {
    animeName: string;
    seriesUrl: string;
    playersUrl: string;
    playerId: string;
    titleId: number | null;
    animeWatchStatus: AnimeWatchStatus;
    animeIsFavourite: number;
    animeTotalEpisodes: number | null;
    episodeProgress: EpisodeProgress[];
    currentEpisodeIndex: number;
};
export const params: {

    animeName: string;
    seriesUrl: string;
    searchFilters: SearchFilters;
    playersUrl: string;
    playerId: string;
    titleId: number | null;
    animeWatchStatus: AnimeWatchStatus;
    animeIsFavourite: number;
    animeTotalEpisodes: number | null;
    episodeProgress: EpisodeProgress[];
    currentEpisodeIndex: number;
} = $state({
    animeName: "",
    seriesUrl: "",
    searchFilters: { ...defaultSearchFilters },
    playersUrl: "",
    playerId: "",
    titleId: null,
    animeWatchStatus: "no",
    animeIsFavourite: 0,
    animeTotalEpisodes: null,
    episodeProgress: [],
    currentEpisodeIndex: -1,
})

export function snapshotTitleNavigationContext(): TitleNavigationContext {
    return {
        animeName: params.animeName,
        seriesUrl: params.seriesUrl,
        playersUrl: params.playersUrl,
        playerId: params.playerId,
        titleId: params.titleId,
        animeWatchStatus: params.animeWatchStatus,
        animeIsFavourite: params.animeIsFavourite,
        animeTotalEpisodes: params.animeTotalEpisodes,
        episodeProgress: [...params.episodeProgress],
        currentEpisodeIndex: params.currentEpisodeIndex,
    };
}

export function restoreTitleNavigationContext(context: TitleNavigationContext) {
    params.animeName = context.animeName;
    params.seriesUrl = context.seriesUrl;
    params.playersUrl = context.playersUrl;
    params.playerId = context.playerId;
    params.titleId = context.titleId;
    params.animeWatchStatus = context.animeWatchStatus;
    params.animeIsFavourite = context.animeIsFavourite;
    params.animeTotalEpisodes = context.animeTotalEpisodes;
    params.episodeProgress = [...context.episodeProgress];
    params.currentEpisodeIndex = context.currentEpisodeIndex;
}
export async function getUserData(): Promise<boolean> {
    applyLibraryState(await invoke<LibraryState>("get_library_state"));
    return globalStates.library.authenticated;
}

export function applyLibraryState(state: LibraryState) {
    if (!globalStates.libraryReady || profileChanged(globalStates.library.activeProfile.id, state.activeProfile.id)) {
        advanceProfileEpoch();
        resetProfileContext(params, () => titleWorkspace.resetForProfile());
        plannedEpisodeNotificationStore.resetForProfile();
        globalStates.profileRevision += 1;
    }
    globalStates.library = state;
    globalStates.libraryReady = true;
    globalStates.user.name = state.authenticated ? state.activeProfile.name : null;
    globalStates.user.image_url = null;
}
