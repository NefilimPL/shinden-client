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
    watchStatus: AnimeWatchStatus;
    isFavourite: number;
    userStatusLoaded: boolean;
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

export type UserAnimeListItem = Anime & {
    titleId: number;
    watchStatus: AnimeWatchStatus;
    isFavourite: number;
    watchedEpisodesCount: number;
    totalEpisodes: number | null;
    releaseYear: number | null;
    tags: string[];
    ageRating: string | null;
    active: boolean;
    updatedAtMs: number;
};

export type UserAnimeListCounts = {
    inProgress: number;
    completed: number;
    skip: number;
    hold: number;
    dropped: number;
    plan: number;
    all: number;
};

export type UserAnimeListsPayload = {
    items: UserAnimeListItem[];
    counts: UserAnimeListCounts;
    refreshedAtMs: number | null;
    syncError: string | null;
};

export type UserAnimeListRefreshStatus = {
    running: boolean;
    current: number;
    total: number;
    remaining: number;
    refreshed: number;
    failed: number;
    currentTitle: string;
    lastFinishedAtMs: number | null;
    lastError: string | null;
};

export type UserAnimeListRefreshSummary = {
    status: UserAnimeListRefreshStatus;
    alreadyRunning: boolean;
};

export type UserAnimeListStatusFilter = AnimeWatchStatus | "all";

export type UserAnimeListSortKey =
    | "title"
    | "rating"
    | "progress"
    | "updated"
    | "releaseYear";

export type UserAnimeListFilters = {
    query: string;
    status: UserAnimeListStatusFilter;
    animeType: string;
    releaseYearFrom: number | null;
    releaseYearTo: number | null;
    tag: string;
    excludeTag: boolean;
    ageRating: string;
    sortKey: UserAnimeListSortKey;
};

export type SearchAnime = Anime & {
    titleId: number | null;
    watchStatus: AnimeWatchStatus;
    isFavourite: number;
    totalEpisodes: number | null;
};

export type SearchAnimePage = {
    items: SearchAnime[];
    currentPage: number;
    totalPages: number;
};

export type SearchTagSelectionMode = "include" | "exclude";

export type SearchTagSelection = {
    tagId: number;
    mode: SearchTagSelectionMode;
};

export type SearchTagOption = {
    id: number;
    label: string;
};

export type SearchTagGroup = {
    id: string;
    label: string;
    options: SearchTagOption[];
};

export type SearchFilterCatalog = {
    groups: SearchTagGroup[];
    letters: string[];
};

export type SearchFilterRequest = {
    query: string;
    tags: SearchTagSelection[];
    genresType: "all" | "one";
    letter: string | null;
    page: number;
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
