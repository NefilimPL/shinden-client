export type Anime = {
    name: string,
    url: string,
    image_url: string,
    anime_type: string,
    rating: string,
    episodes: string,
    description: string,
}

export type User = {
    name: string | null,
    image_url: string | null,
}

export type Episode = {
    title: string,
    link: string,
}

export type Player = {
    player: string,
    max_res: string,
    lang_audio: string,
    lang_subs: string,
    online_id: string,
}

export type AnimeWatchStatus =
    | "in progress"
    | "completed"
    | "skip"
    | "hold"
    | "dropped"
    | "plan"
    | "no";

export type WatchingAnime = Anime & {
    titleId: number;
    watchStatus: AnimeWatchStatus;
    isFavourite: number;
    watchedEpisodesCount: number;
    totalEpisodes: number | null;
};

export type EpisodeProgress = Episode & {
    episodeId: number | null;
    episodeNo: number;
    watched: boolean;
    viewCount: number;
    totalEpisodes: number | null;
    isTrueFinalEpisode: boolean;
};
