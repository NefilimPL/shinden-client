<script lang="ts">
    import "../app.css";
    import Navbar from "$lib/Navbar.svelte";
    import BrowserVerification from "$lib/BrowserVerification.svelte";
    import UpdateNotification from "$lib/UpdateNotification.svelte";
    import { onDestroy, onMount } from "svelte";
    import { invoke } from "$lib/shindenInvoke";
    import { imageProxy } from "$lib/imageProxy.svelte";
    import { globalStates, getUserData } from "$lib/global.svelte";
    import { plannedEpisodeNotificationStore } from "$lib/plannedEpisodeNotificationStore.svelte";
    import { page } from "$app/state";
    import TitleTabs from "$lib/TitleTabs.svelte";
    import { titleWorkspace } from "$lib/titleWorkspace.svelte";

    let { children } = $props();
    let startupError = $state("");
    onMount(() => {
        void invoke<string>("get_image_proxy_token").then(token => { imageProxy.token = token; });
        void getUserData().catch(error => { startupError = String(error); });
    });
    const titleRoutePaths = new Set(["/episodes", "/players", "/watching"]);
    const isTitleRoute = $derived(titleRoutePaths.has(page.url.pathname));

    onDestroy(() => {
        plannedEpisodeNotificationStore.stop();
    });
</script>




<div class="flex h-screen flex-col bg-base-100">
    <Navbar />
    <BrowserVerification />
    <UpdateNotification />
    {#if startupError}
        <p class="alert alert-error m-4" role="alert">{startupError}</p>
    {:else if !globalStates.libraryReady}
        <p class="p-6">Otwieranie lokalnej biblioteki…</p>
    {:else}
    {#key globalStates.profileRevision}
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
    {/key}
    {/if}
</div>
