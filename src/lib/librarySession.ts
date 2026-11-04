export type LibraryProfile = { id: string; name: string; publicProfileId: number | null };
export type LibraryState = {
    activeProfile: LibraryProfile;
    profiles: LibraryProfile[];
    networkEnabled: boolean;
    importEnabled: boolean;
    authenticated: boolean;
    databasePath: string;
};

let epoch = 0;
export function currentProfileEpoch() { return epoch; }
export function advanceProfileEpoch() { epoch += 1; }
export function profileChanged(previous: string, next: string) { return previous !== next; }

export function resetProfileContext(context: {
    animeName: string; seriesUrl: string; playersUrl: string; playerId: string;
    titleId: number | null; animeWatchStatus: string; animeIsFavourite: number;
    animeTotalEpisodes: number | null; episodeProgress: unknown[]; currentEpisodeIndex: number;
}, resetTabs: () => void) {
    Object.assign(context, {
        animeName: "", seriesUrl: "", playersUrl: "", playerId: "", titleId: null,
        animeWatchStatus: "no", animeIsFavourite: 0, animeTotalEpisodes: null,
        episodeProgress: [], currentEpisodeIndex: -1,
    });
    resetTabs();
}
