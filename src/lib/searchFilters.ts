import type {
    SearchFilterRequest,
    SearchTagSelection,
    SearchTagSelectionMode,
} from "$lib/types";

export type SearchFilters = {
    minimumRating: number | null;
    tags: SearchTagSelection[];
    genresType: "all" | "one";
    letter: string | null;
};

type SearchFilterItem = {
    rating: string;
};

export const defaultSearchFilters: SearchFilters = {
    minimumRating: null,
    tags: [],
    genresType: "all",
    letter: null,
};

export function filterSearchAnime<T extends SearchFilterItem>(
    results: T[],
    filters: SearchFilters,
): T[] {
    return results.filter((anime) => {
        const ratingText = anime.rating.trim();
        const rating = Number(ratingText.replace(",", "."));
        const ratingMatches = filters.minimumRating === null
            || !ratingText
            || Number.isNaN(rating)
            || rating >= filters.minimumRating;

        return ratingMatches;
    });
}

export function hasAdvancedSearchFilters(filters: SearchFilters): boolean {
    return filters.tags.length > 0 || filters.letter !== null;
}

export function searchFilterRequest(
    filters: SearchFilters,
    query: string,
): SearchFilterRequest {
    return {
        query: query.trim(),
        tags: filters.tags,
        genresType: filters.genresType,
        letter: filters.letter,
    };
}

export function setSearchTagSelection(
    selections: SearchTagSelection[],
    tagId: number,
    mode: SearchTagSelectionMode | null,
): SearchTagSelection[] {
    const remaining = selections.filter((selection) => selection.tagId !== tagId);
    return mode === null ? remaining : [...remaining, { tagId, mode }];
}
