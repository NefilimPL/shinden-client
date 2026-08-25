export type EpisodePlayerAvailability = {
    lang_subs: string;
};

export type EpisodeAvailabilityFilter = {
    checkSubtitleAvailabilityOnline: boolean;
    subtitleLanguage: string;
    excludeAiSubtitles: boolean;
};

export function episodeIsAvailableForFilter(
    players: EpisodePlayerAvailability[],
    filter: EpisodeAvailabilityFilter,
): boolean {
    if (players.length === 0) {
        return false;
    }

    if (!filter.checkSubtitleAvailabilityOnline) {
        return true;
    }

    const selectedLanguage = subtitleLanguageKey(filter.subtitleLanguage);
    if (!selectedLanguage) {
        return true;
    }

    return players.some((player) =>
        subtitleLanguageKey(player.lang_subs) === selectedLanguage
        && (!filter.excludeAiSubtitles || !isAiSubtitle(player.lang_subs)),
    );
}

function subtitleLanguageKey(value: string): string {
    const normalized = value.trim().toLowerCase().replaceAll(" ", "");
    if (normalized === "pl" || normalized === "polski" || normalized === "ipl") return "pl";
    if (normalized === "en" || normalized === "english" || normalized === "angielski") return "en";
    if (normalized === "jp" || normalized === "japanese" || normalized === "japonski") return "jp";
    return normalized;
}

function isAiSubtitle(value: string): boolean {
    return value.trim().toLowerCase() === "ipl";
}
