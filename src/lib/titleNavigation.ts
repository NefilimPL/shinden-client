import { goto } from "$app/navigation";
import { tick } from "svelte";
import {
    restoreTitleNavigationContext,
    snapshotTitleNavigationContext,
    type TitleNavigationContext,
} from "$lib/global.svelte";
import { baseViewForPathWithPreservedState, baseViewPath, isBaseViewPath } from "$lib/baseViewState";
import { titleRouteForView, type TitleOpenInput, type TitleView } from "$lib/titleWorkspace";
import { titleSessionNavigationContext, titleWorkspace } from "$lib/titleWorkspace.svelte";

export type OpenAnimeTitleInput = TitleOpenInput;

export async function openAnimeTitle(input: OpenAnimeTitleInput) {
    saveCurrentWorkspaceContext();
    const opened = titleWorkspace.open(input, true);
    const session = opened.session;
    if (session) {
        restoreTitleNavigationContext(titleSessionNavigationContext(session));
        await goto(titleRouteForView(session.view));
        return;
    }

    if (titleWorkspace.layout !== "none") {
        return;
    }

    restoreTitleNavigationContext(titleNavigationContextForInput(input));
    await goto("/episodes");
}

export async function openAnimeTitleInBackground(input: OpenAnimeTitleInput) {
    if (titleWorkspace.layout === "none") {
        return;
    }

    saveCurrentWorkspaceContext();
    titleWorkspace.open(input, false);
}

export async function openRelatedAnimeTitle(input: OpenAnimeTitleInput) {
    await openAnimeTitle(input);
}

export async function activateTitleTab(titleId: number) {
    saveCurrentWorkspaceContext();
    const session = titleWorkspace.activate(titleId);
    if (!session) {
        return;
    }

    restoreTitleNavigationContext(titleSessionNavigationContext(session));
    await goto(titleRouteForView(session.view));
}

export async function closeTitleTab(titleId: number) {
    const wasActive = titleWorkspace.activeTitleId === titleId;
    if (wasActive) {
        saveCurrentWorkspaceContext();
    }

    const session = titleWorkspace.close(titleId);
    if (!wasActive) {
        return;
    }

    if (!session) {
        await restoreBaseView(titleWorkspace.baseView);
        return;
    }

    restoreTitleNavigationContext(titleSessionNavigationContext(session));
    await goto(titleRouteForView(session.view));
}

export async function activateBaseTab() {
    saveCurrentWorkspaceContext();
    const baseView = titleWorkspace.activateBase();
    await restoreBaseView(baseView);
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

function saveCurrentWorkspaceContext() {
    saveCurrentBaseView();
    saveCurrentTitleNavigation();
}

function saveCurrentBaseView() {
    if (typeof document === "undefined") {
        return;
    }

    const path = window.location.pathname;
    if (!isBaseViewPath(path)) {
        return;
    }

    const scrollContainer = baseViewScrollContainer();
    const context = baseViewForPathWithPreservedState(
        path,
        titleWorkspace.baseView,
        scrollContainer?.scrollTop ?? 0,
    );
    titleWorkspace.saveBaseView(context);
}

async function restoreBaseView(baseView: ReturnType<typeof titleWorkspace.activateBase>) {
    await goto(baseViewPath(baseView));
    await tick();
    baseViewScrollContainer()?.scrollTo({ top: baseView.scrollY });
}

function titleNavigationContextForInput(input: TitleOpenInput): TitleNavigationContext {
    return {
        animeName: input.name,
        seriesUrl: input.seriesUrl,
        playersUrl: "",
        playerId: "",
        titleId: input.titleId,
        animeWatchStatus: input.watchStatus,
        animeIsFavourite: input.isFavourite,
        animeTotalEpisodes: input.totalEpisodes,
        episodeProgress: [],
        currentEpisodeIndex: -1,
    };
}

function baseViewScrollContainer(): HTMLElement | null {
    const containers = document.querySelectorAll<HTMLElement>("[data-base-view-scroll]");
    return containers[containers.length - 1] ?? null;
}
