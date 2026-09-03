<script lang="ts">
    import "../app.css";
    import Navbar from "$lib/Navbar.svelte";
    import { onDestroy } from "svelte";
    import { globalStates } from "$lib/global.svelte";
    import { resumeUserAnimeListRefresh } from "$lib/userAnimeListRefresh";
    import { startWatchlistBackgroundRefresh } from "$lib/watchlistRefresh";
    import { plannedEpisodeNotificationStore } from "$lib/plannedEpisodeNotificationStore.svelte";
    import { page } from "$app/state";
    import TitleTabs from "$lib/TitleTabs.svelte";
    import { titleWorkspace } from "$lib/titleWorkspace.svelte";

    let { children } = $props();
    let stopWatchlistBackgroundRefresh: (() => void) | null = null;
    let userAnimeListRefreshResumeStarted = false;
    const titleRoutePaths = new Set(["/episodes", "/players", "/watching"]);
    const isTitleRoute = $derived(titleRoutePaths.has(page.url.pathname));

    $effect(() => {
        if (globalStates.user.name && !stopWatchlistBackgroundRefresh) {
            stopWatchlistBackgroundRefresh = startWatchlistBackgroundRefresh();
            plannedEpisodeNotificationStore.start();
            if (!userAnimeListRefreshResumeStarted) {
                userAnimeListRefreshResumeStarted = true;
                void resumeUserAnimeListRefresh();
            }
        } else if (!globalStates.user.name && stopWatchlistBackgroundRefresh) {
            stopWatchlistBackgroundRefresh();
            stopWatchlistBackgroundRefresh = null;
            plannedEpisodeNotificationStore.stop();
            userAnimeListRefreshResumeStarted = false;
        }
    });

    onDestroy(() => {
        stopWatchlistBackgroundRefresh?.();
        plannedEpisodeNotificationStore.stop();
    });
</script>




<div class="flex h-screen flex-col bg-base-100">
    <Navbar />
    <div class="flex min-h-0 flex-1" class:flex-row={titleWorkspace.layout === "vertical"} class:flex-col={titleWorkspace.layout !== "vertical"}>
        <TitleTabs />
        {#if isTitleRoute && titleWorkspace.activeSession}
            <div class="min-h-0 min-w-0 flex-1 overflow-y-auto">
                {#key `${titleWorkspace.activeTitleId}:${titleWorkspace.activeSession.view}`}
                    {@render children()}
                {/key}
            </div>
        {:else}
        <div class="flex-1 overflow-y-auto" data-base-view-scroll>
            {@render children()}
        </div>
        {/if}
    </div>
</div>
