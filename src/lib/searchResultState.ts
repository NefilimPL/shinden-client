export type SearchResultState<T> = {
    result: T[];
    currentPage: number;
    totalPages: number;
};

export function searchResultState<T>(
    result: T[],
    currentPage: number,
    totalPages: number,
): SearchResultState<T> {
    return {
        result: [...result],
        currentPage: normalizedPage(currentPage),
        totalPages: Math.max(1, normalizedPage(totalPages)),
    };
}

export function restoreSearchResultState<T>(value: unknown): SearchResultState<T> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null;
    }

    const state = value as Partial<SearchResultState<T>>;
    if (!Array.isArray(state.result)
        || typeof state.currentPage !== "number"
        || typeof state.totalPages !== "number") {
        return null;
    }

    return searchResultState(state.result, state.currentPage, state.totalPages);
}

function normalizedPage(value: number): number {
    return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}
