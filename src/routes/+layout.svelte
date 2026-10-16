<script lang="ts">
    import "../app.css";
    import Navbar from "$lib/Navbar.svelte";
    import BrowserVerification from "$lib/BrowserVerification.svelte";
    import { onDestroy, onMount } from "svelte";
    import { invoke } from "$lib/shindenInvoke";
    import { imageProxy } from "$lib/imageProxy.svelte";
    import { globalStates } from "$lib/global.svelte";
    import { resumeUserAnimeListRefresh } from "$lib/userAnimeListRefresh";
    import { startWatchlistBackgroundRefresh } from "$lib/watchlistRefresh";
    import { plannedEpisodeNotificationStore } from "$lib/plannedEpisodeNotificationStore.svelte";
    import { page } from "$app/state";
    import TitleTabs from "$lib/TitleTabs.svelte";
    import { titleWorkspace } from "$lib/titleWorkspace.svelte";

    let { children } = $props();
    onMount(() => {
        void invoke<string>("get_image_proxy_token").then(token => { imageProxy.token = token; });
    });
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
    <BrowserVerification />
    <div class="flex min-h-0 flex-1" class:flex-row={titleWorkspace.layout === "vertical"} class:flex-col={titleWorkspace.layout !== "vertical"}>
        <TitleTabs />
        {#if isTitleRoute && titleWorkspace.activeSession}
            <div class="min-h-0 min-w-0 flex-1 overflow-y-auto">
                <!-- SvelteKit mounts route changes; only title switches need a forced remount.
                     The session view is saved before goto(), while children still holds the old route. -->
                {#key titleWorkspace.activeTitleId}
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
