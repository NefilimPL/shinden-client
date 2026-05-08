<script lang="ts">
    import { globalStates, LoadingState, params } from "$lib/global.svelte.js";
    import { onMount } from "svelte";
    import { invoke } from "@tauri-apps/api/core";
    import { log, LogLevel } from "$lib/logs/logs.svelte";
    import { goto } from "$app/navigation";
    import type { AnimeListViewMode, DiscoveryAnime } from "$lib/types";
    import DiscoveryAnimeList from "$lib/DiscoveryAnimeList.svelte";
    import AnimeListViewToggle from "$lib/AnimeListViewToggle.svelte";

    let animeName: string = $state("");
    let premieres: DiscoveryAnime[] = $state([]);
    let premieresLoading = $state(false);
    let viewMode: AnimeListViewMode = $state("list");
    const viewModeStorageKey = "shinden:premieres-view-mode";

    globalStates.loadingState = LoadingState.LOADING;

    onMount(async () => {
        try {
            loadViewMode();
            log(LogLevel.INFO, "Testing connection to http://shinden.pl");
            await invoke("test_connection");
            globalStates.loadingState = LoadingState.OK;
            log(LogLevel.SUCCESS, "Connection to http://shinden.pl established");
            await loadPremieres();
        } catch (error) {
            globalStates.loadingState = LoadingState.ERROR;
            log(LogLevel.ERROR, "Error connection to http://shinden.pl");
        }
    });

    function loadViewMode() {
        const stored = localStorage.getItem(viewModeStorageKey);
        if (stored === "grid" || stored === "list") {
            viewMode = stored;
        }
    }

    function setViewMode(value: AnimeListViewMode) {
        viewMode = value;
        localStorage.setItem(viewModeStorageKey, value);
    }

    async function loadPremieres() {
        try {
            premieresLoading = true;
            premieres = await invoke<DiscoveryAnime[]>("get_main_premieres");
            log(LogLevel.SUCCESS, "Loaded Shinden premieres");
        } catch (e) {
            premieres = [];
            log(LogLevel.WARNING, `Nie udalo sie zaladowac nowosci Shinden: ${e}`);
        } finally {
            premieresLoading = false;
        }
    }

    function handleButton(event: Event) {
        event.preventDefault();
        params.animeName = animeName;
        goto("/search");
    }

    async function openSeasons() {
        await goto("/seasons");
    }
</script>

<div class="min-h-full bg-base-100 p-4">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <section class="flex flex-col gap-6 rounded-box bg-base-100 py-4 md:flex-row md:items-center">
            <img
                src="/bg.jpg"
                class="w-full max-w-sm rounded-lg object-cover shadow-2xl"
                alt="anime"
            />
            <div class="flex flex-1 flex-col gap-4">
                <div>
                    <h1 class="text-5xl font-bold">Wyszukaj ulubione anime</h1>
                    <p class="py-6">Na co masz dzis ochote?</p>
                </div>

                <form class="join w-full" onsubmit={handleButton}>
                    <label class="input join-item w-full">
                        <svg class="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2.5" fill="none" stroke="currentColor">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.3-4.3"></path>
                            </g>
                        </svg>
                        <input type="search" required bind:value={animeName} />
                    </label>
                    <button class="btn btn-primary join-item">Szukaj</button>
                    <button
                        type="button"
                        class="btn btn-ghost join-item"
                        aria-label="sezony"
                        onclick={() => { void openSeasons(); }}
                    >
                        Sezony
                    </button>
                </form>
            </div>
        </section>

        {#if premieresLoading}
            <div class="flex w-full flex-col gap-4">
                <div class="skeleton h-24 w-full"></div>
                <div class="skeleton h-24 w-full"></div>
                <div class="skeleton h-24 w-full"></div>
            </div>
        {:else}
            <div class="flex justify-end">
                <AnimeListViewToggle value={viewMode} onChange={setViewMode} />
            </div>
            <DiscoveryAnimeList
                items={premieres}
                heading="Nowosci z Shinden:"
                emptyLabel="Nie znaleziono nowosci na stronie glownej Shinden."
                viewMode={viewMode}
            />
        {/if}
    </div>
</div>
