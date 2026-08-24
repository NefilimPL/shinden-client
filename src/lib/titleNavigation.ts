import { goto } from "$app/navigation";
import { tick } from "svelte";
import {
    restoreTitleNavigationContext,
    snapshotTitleNavigationContext,
    type TitleNavigationContext,
} from "$lib/global.svelte";
import { baseViewContextForRoute, titleRouteForView, type TitleOpenInput, type TitleView } from "$lib/titleWorkspace";
import { titleSessionNavigationContext, titleWorkspace } from "$lib/titleWorkspace.svelte";

export type OpenAnimeTitleInput = TitleOpenInput;

export async function openAnimeTitle(input: OpenAnimeTitleInput) {
    saveCurrentBaseView();
    saveCurrentTitleNavigation();
    const opened = titleWorkspace.open(input);
    if (!opened.session) {
        return;
    }

    restoreTitleNavigationContext(titleSessionNavigationContext(opened.session));
    await goto(titleRouteForView(opened.session.view));
}

export async function openRelatedAnimeTitle(input: OpenAnimeTitleInput) {
    await openAnimeTitle(input);
}

export async function activateTitleTab(titleId: number) {
    saveCurrentTitleNavigation();
    const session = titleWorkspace.activate(titleId);
    if (!session) {
        return;
    }

    restoreTitleNavigationContext(titleSessionNavigationContext(session));
    await goto(titleRouteForView(session.view));
}

export async function closeTitleTab(titleId: number) {
    if (titleWorkspace.activeTitleId === titleId) {
        saveCurrentTitleNavigation();
    }

    const baseView = titleWorkspace.baseView;
    const session = titleWorkspace.close(titleId);
    if (!session) {
        await restoreBaseView(baseView.path, baseView.scrollY);
        return;
    }

    restoreTitleNavigationContext(titleSessionNavigationContext(session));
    await goto(titleRouteForView(session.view));
}

export async function openActiveTitleView(
    view: TitleView,
    patch: Partial<TitleNavigationContext> = {},
) {
    const context = {
        ...snapshotTitleNavigationContext(),
        ...patch,
    };
    restoreTitleNavigationContext(context);
    titleWorkspace.saveActiveContext(context, view);
    await goto(titleRouteForView(view));
}

export function saveCurrentTitleNavigation(view?: TitleView) {
    if (!titleWorkspace.activeSession) {
        return;
    }

    titleWorkspace.saveActiveContext(snapshotTitleNavigationContext(), view);
}

function saveCurrentBaseView() {
    if (typeof document === "undefined") {
        return;
    }

    const scrollContainer = document.querySelector<HTMLElement>("[data-base-view-scroll]");
    const context = baseViewContextForRoute(
        window.location.pathname,
        scrollContainer?.scrollTop ?? 0,
    );
    if (context) {
        titleWorkspace.saveBaseView(context);
    }
}

async function restoreBaseView(path: "/" | "/watchlist", scrollY: number) {
    await goto(path);
    await tick();
    document.querySelector<HTMLElement>("[data-base-view-scroll]")?.scrollTo({ top: scrollY });
}
