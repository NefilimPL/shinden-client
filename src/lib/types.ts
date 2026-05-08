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

export type AnimeInfoRow = {
    label: string;
    value: string;
};

export type AnimeCategoryGroup = {
    label: string;
    items: string[];
};

export type RelatedSeries = {
    name: string;
    url: string;
    imageUrl: string;
    titleType: string;
    relation: string;
};

export type AnimeCommunityRating = {
    overall: string;
    votes: string;
    story: string;
    graphics: string;
    music: string;
    characters: string;
};

export type AnimeUserRatings = {
    story: number;
    graphics: number;
    music: number;
    characters: number;
    overall: number;
};

export type AnimeDetails = {
    titleId: number | null;
    titleType: string;
    name: string;
    alternativeTitles: string[];
    imageUrl: string;
    description: string;
    information: AnimeInfoRow[];
    categories: AnimeCategoryGroup[];
    relatedSeries: RelatedSeries[];
    communityRating: AnimeCommunityRating;
    userRatings: AnimeUserRatings;
};

export type AnimeRatingKey = keyof AnimeUserRatings;

export type AnimeRatingUpdate = {
    titleId: number;
    titleType: string;
    ratingType: AnimeRatingKey;
    value: number;
};

export type AnimeListViewMode = "list" | "grid";

export type WatchingAnime = Anime & {
    titleId: number;
    watchStatus: AnimeWatchStatus;
    isFavourite: number;
    watchedEpisodesCount: number;
    totalEpisodes: number | null;
};

export type SearchAnime = Anime & {
    titleId: number | null;
    watchStatus: AnimeWatchStatus;
    isFavourite: number;
    totalEpisodes: number | null;
};

export type DiscoveryAnime = Anime & {
    titleId: number | null;
    watchStatus: AnimeWatchStatus;
    isFavourite: number;
    totalEpisodes: number | null;
    sourceLabel: string | null;
};

export type SeasonSlug = "current" | "winter" | "spring" | "summer" | "fall";

export type SeasonOption = {
    value: SeasonSlug;
    label: string;
};

export type EpisodeProgress = Episode & {
    episodeId: number | null;
    episodeNo: number;
    watched: boolean;
    viewCount: number;
    totalEpisodes: number | null;
    isTrueFinalEpisode: boolean;
};
