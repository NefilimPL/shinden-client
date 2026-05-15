<script lang="ts">
    import "../app.css";
    import Navbar from "$lib/Navbar.svelte";
    import { onDestroy } from "svelte";
    import { globalStates } from "$lib/global.svelte";
    import { resumeUserAnimeListRefresh } from "$lib/userAnimeListRefresh";
    import { startWatchlistBackgroundRefresh } from "$lib/watchlistRefresh";

    let { children } = $props();
    let stopWatchlistBackgroundRefresh: (() => void) | null = null;
    let userAnimeListRefreshResumeStarted = false;

    $effect(() => {
        if (globalStates.user.name && !stopWatchlistBackgroundRefresh) {
            stopWatchlistBackgroundRefresh = startWatchlistBackgroundRefresh();
            if (!userAnimeListRefreshResumeStarted) {
                userAnimeListRefreshResumeStarted = true;
                void resumeUserAnimeListRefresh();
            }
        } else if (!globalStates.user.name && stopWatchlistBackgroundRefresh) {
            stopWatchlistBackgroundRefresh();
            stopWatchlistBackgroundRefresh = null;
            userAnimeListRefreshResumeStarted = false;
        }
    });

    onDestroy(() => {
        stopWatchlistBackgroundRefresh?.();
    });
</script>

<div class="h-screen flex flex-col bg-base-100">
    <Navbar/>
    <div class="flex-1 overflow-y-auto">
        {@render children()}
    </div>
</div>



