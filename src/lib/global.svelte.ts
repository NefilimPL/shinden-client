import type {AnimeWatchStatus, EpisodeProgress, User} from "$lib/types";
import {invoke} from "@tauri-apps/api/core";

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
} = $state({
    loadingState: LoadingState.OK,
    consoleState: false,
    user: {
        name: null,
        image_url: null
    }
});

export type TitleNavigationContext = {
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
    const username = await invoke("get_user_name");
    const user_profile_image_url = await invoke("get_user_profile_image");

    const is_user_img_valid = new URL(user_profile_image_url as string).host == "shinden.pl";

    if(user_profile_image_url && username) {
        globalStates.user.name = username as string;
        globalStates.user.image_url = is_user_img_valid ? user_profile_image_url as string : "";
        return true;
    }

    return false;
}
