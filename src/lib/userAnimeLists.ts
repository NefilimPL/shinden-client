import type {
    UserAnimeListCounts,
    UserAnimeListFilters,
    UserAnimeListItem,
    UserAnimeListStatusFilter,
} from "$lib/types";

export const userAnimeListStatusOptions: Array<{
    value: UserAnimeListStatusFilter;
    label: string;
}> = [
    { value: "all", label: "Wszystkie" },
    { value: "in progress", label: "Ogladam" },
    { value: "completed", label: "Obejrzane" },
    { value: "skip", label: "Pomijam" },
    { value: "hold", label: "Wstrzymane" },
    { value: "dropped", label: "Porzucone" },
    { value: "plan", label: "Planuje" },
];

export function statusCountKey(status: UserAnimeListStatusFilter): keyof UserAnimeListCounts {
    switch (status) {
        case "in progress":
            return "inProgress";
        case "completed":
            return "completed";
        case "skip":
            return "skip";
        case "hold":
            return "hold";
        case "dropped":
            return "dropped";
        case "plan":
            return "plan";
        case "all":
        default:
            return "all";
    }
}

export function applyUserAnimeListFilters(
    items: UserAnimeListItem[],
    filters: UserAnimeListFilters,
): UserAnimeListItem[] {
    const query = filters.query.trim().toLocaleLowerCase();
    const animeType = filters.animeType.trim().toLocaleLowerCase();
    const tag = filters.tag.trim().toLocaleLowerCase();
    const ageRating = filters.ageRating.trim().toLocaleLowerCase();

    return [...items]
        .filter((item) => item.active)
        .filter((item) => !query || item.name.toLocaleLowerCase().includes(query))
        .filter((item) => filters.status === "all" || item.watchStatus === filters.status)
        .filter((item) => !animeType || item.anime_type.toLocaleLowerCase() === animeType)
        .filter((item) => tagMatches(item, tag, filters.excludeTag))
        .filter((item) => !ageRating || item.ageRating?.toLocaleLowerCase() === ageRating)
        .filter((item) => releaseYearMatches(item, filters))
        .sort((a, b) => compareUserAnimeListItems(a, b, filters.sortKey));
}

export function userAnimeListTypes(items: UserAnimeListItem[]): string[] {
    return Array.from(
        new Set(
            items
                .map((item) => item.anime_type.trim())
                .filter((value) => value.length > 0),
        ),
    ).sort((a, b) => a.localeCompare(b));
}

export function userAnimeListTags(items: UserAnimeListItem[]): string[] {
    return Array.from(
        new Set(
            items
                .flatMap((item) => item.tags)
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0),
        ),
    ).sort((a, b) => a.localeCompare(b));
}

export function userAnimeListAgeRatings(items: UserAnimeListItem[]): string[] {
    return Array.from(
        new Set(
            items
                .map((item) => item.ageRating?.trim() ?? "")
                .filter((ageRating) => ageRating.length > 0),
        ),
    ).sort((a, b) => a.localeCompare(b));
}

export function countUserAnimeListStatuses(items: UserAnimeListItem[]): UserAnimeListCounts {
    const counts: UserAnimeListCounts = {
        inProgress: 0,
        completed: 0,
        skip: 0,
        hold: 0,
        dropped: 0,
        plan: 0,
        all: 0,
    };

    for (const item of items) {
        if (!item.active) {
            continue;
        }

        const key = statusCountKey(item.watchStatus);
        if (key !== "all") {
            counts[key] += 1;
        }
        counts.all += 1;
    }

    return counts;
}

function tagMatches(item: UserAnimeListItem, selectedTag: string, excludeTag: boolean) {
    if (!selectedTag) {
        return true;
    }

    const hasTag = item.tags.some((tag) => tag.toLocaleLowerCase() === selectedTag);
    return excludeTag ? !hasTag : hasTag;
}

function releaseYearMatches(item: UserAnimeListItem, filters: UserAnimeListFilters) {
    if (filters.releaseYearFrom === null && filters.releaseYearTo === null) {
        return true;
    }

    if (item.releaseYear === null) {
        return false;
    }

    if (filters.releaseYearFrom !== null && item.releaseYear < filters.releaseYearFrom) {
        return false;
    }

    if (filters.releaseYearTo !== null && item.releaseYear > filters.releaseYearTo) {
        return false;
    }

    return true;
}

function compareUserAnimeListItems(
    a: UserAnimeListItem,
    b: UserAnimeListItem,
    sortKey: UserAnimeListFilters["sortKey"],
) {
    switch (sortKey) {
        case "rating":
            return compareNumbersDesc(numericRating(a.rating), numericRating(b.rating))
                || a.name.localeCompare(b.name);
        case "progress":
            return compareNumbersDesc(unwatchedEpisodes(a), unwatchedEpisodes(b))
                || a.name.localeCompare(b.name);
        case "updated":
            return compareNumbersDesc(a.updatedAtMs, b.updatedAtMs)
                || a.name.localeCompare(b.name);
        case "releaseYear":
            return compareNumbersDesc(a.releaseYear ?? -1, b.releaseYear ?? -1)
                || a.name.localeCompare(b.name);
        case "title":
        default:
            return a.name.localeCompare(b.name);
    }
}

function compareNumbersDesc(a: number, b: number) {
    return b - a;
}

function numericRating(value: string) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : -1;
}

function unwatchedEpisodes(item: UserAnimeListItem) {
    if (item.totalEpisodes === null) {
        return -1;
    }

    return Math.max(item.totalEpisodes - item.watchedEpisodesCount, 0);
}
