import type { TitleSession, TitleSessionCloseResult } from "$lib/titleWorkspace";

export type CloseNavigationTarget =
    | { kind: "none" }
    | { kind: "base" }
    | { kind: "title"; session: TitleSession };

export function closeNavigationTarget(
    result: Pick<TitleSessionCloseResult, "closed" | "wasActive" | "nextSession">,
): CloseNavigationTarget {
    if (!result.closed || !result.wasActive) {
        return { kind: "none" };
    }

    return result.nextSession
        ? { kind: "title", session: result.nextSession }
        : { kind: "base" };
}
