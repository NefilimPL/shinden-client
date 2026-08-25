export type SearchFilters = {
    animeType: string;
    minimumRating: number | null;
};

type SearchFilterItem = {
    anime_type: string;
    rating: string;
};

export const defaultSearchFilters: SearchFilters = {
    animeType: "",
    minimumRating: null,
};

export function filterSearchAnime<T extends SearchFilterItem>(
    results: T[],
    filters: SearchFilters,
): T[] {
    const selectedType = filters.animeType.trim().toLocaleLowerCase();

    return results.filter((anime) => {
        const typeMatches = !selectedType
            || anime.anime_type.trim().toLocaleLowerCase() === selectedType;
        const rating = Number(anime.rating.replace(",", "."));
        const ratingMatches = filters.minimumRating === null
            || (!Number.isNaN(rating) && rating >= filters.minimumRating);

        return typeMatches && ratingMatches;
    });
}
