import type { BaseViewContext, BaseViewId } from "./titleWorkspace";

const definitions = {
    "/watchlist": { id: "watchlist", label: "Oglądam" },
    "/account/lists": { id: "user-lists", label: "Moje listy anime" },
    "/search": { id: "search", label: "Wyszukiwanie" },
    "/seasons": { id: "seasons", label: "Sezony" },
} as const satisfies Record<string, { id: BaseViewId; label: string }>;

const definitionsById = Object.values(definitions).reduce((result, definition) => {
    result[definition.id] = definition;
    return result;
}, {} as Record<BaseViewId, { id: BaseViewId; label: string }>);

export function baseViewForPath(
    path: string,
    state: Record<string, unknown>,
    scrollY: number,
): BaseViewContext {
    const definition = definitions[path as keyof typeof definitions] ?? definitions["/watchlist"];
    return {
        id: definition.id,
        state: isStateRecord(state) ? state : {},
        scrollY: normalizedScrollY(scrollY),
    };
}

export function isBaseViewPath(path: string): path is keyof typeof definitions {
    return path in definitions;
}

export function baseViewPath(context: BaseViewContext): keyof typeof definitions {
    return (Object.entries(definitions).find(([, definition]) => definition.id === context.id)?.[0]
        ?? "/watchlist") as keyof typeof definitions;
}

export function baseViewLabel(context: BaseViewContext): string {
    return definitionsById[context.id]?.label ?? definitions["/watchlist"].label;
}

export function normalizedBaseViewContext(value: unknown): BaseViewContext {
    if (!isBaseViewContext(value)) {
        return { id: "watchlist", scrollY: 0, state: {} };
    }

    return {
        id: value.id,
        scrollY: normalizedScrollY(value.scrollY),
        state: value.state,
    };
}

function isBaseViewContext(value: unknown): value is BaseViewContext {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as Record<string, unknown>;
    return isBaseViewId(candidate.id)
        && isStateRecord(candidate.state)
        && typeof candidate.scrollY === "number";
}

function isBaseViewId(value: unknown): value is BaseViewId {
    return value === "watchlist" || value === "user-lists" || value === "search" || value === "seasons";
}

function isStateRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedScrollY(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}
