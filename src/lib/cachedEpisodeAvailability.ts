import type { WatchlistRefreshFilter } from "$lib/watchlistRefresh";

export type CachedEpisodeAvailability = {
    hasPlayers: boolean;
    subtitleAvailability: Record<string, boolean>;
};

export type CachedEpisodeAvailabilityState = "available" | "unavailable" | "unknown";

export function cachedEpisodeAvailabilityForFilter(
    snapshot: Record<string, CachedEpisodeAvailability> | null,
    episodeLink: string,
    watched: boolean,
    filter: WatchlistRefreshFilter,
): CachedEpisodeAvailabilityState {
    const availability = snapshot?.[episodeLink];
    if (!availability) {
        return "unknown";
    }

    if (filter.onlyAvailableUnwatched && watched) {
        return "unavailable";
    }

    if (!availability.hasPlayers) {
        return "unavailable";
    }

    if (!filter.checkSubtitleAvailabilityOnline) {
        return "available";
    }

    const languageKey = subtitleLanguageKey(filter.subtitleLanguage);
    if (!languageKey) {
        return "available";
    }

    const cacheKey = filter.excludeAiSubtitles ? `${languageKey}:human` : languageKey;
    return availability.subtitleAvailability[cacheKey] ? "available" : "unavailable";
}

function subtitleLanguageKey(value: string): string {
    const normalized = value.trim().toLowerCase().replaceAll(" ", "");
    if (normalized === "pl" || normalized === "polski" || normalized === "ipl") return "pl";
    if (normalized === "en" || normalized === "english" || normalized === "angielski") return "en";
    if (normalized === "jp" || normalized === "japanese" || normalized === "japonski") return "jp";
    if (normalized === "" || normalized === "any" || normalized === "dowolny") return "";
    return normalized;
}
