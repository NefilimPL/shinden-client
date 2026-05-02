<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import type { Anime } from "$lib/types";
    import { globalStates, LoadingState, params } from "$lib/global.svelte";
    import { log, LogLevel } from "$lib/logs/logs.svelte";
    import Empty from "$lib/Empty.svelte";

    let result: Anime[] = $state([]);

    onMount(async () => {
        try {
            globalStates.loadingState = LoadingState.LOADING;
            log(LogLevel.INFO, "Loading watched anime list");

            result = await invoke<Anime[]>("get_watching_anime");

            globalStates.loadingState =
                result.length > 0 ? LoadingState.OK : LoadingState.WARNING;
            log(LogLevel.SUCCESS, "Loaded watched anime list");
        } catch (e) {
            globalStates.loadingState = LoadingState.ERROR;
            log(LogLevel.ERROR, `Error loading watched anime list: ${e}`);
        }
    });

    async function handleButton(url: string) {
        params.seriesUrl = url;
        await goto("/episodes");
    }
</script>

{#if globalStates.loadingState === LoadingState.LOADING}
    <div class="flex w-full h-full flex-col gap-4 p-4">
        <div class="skeleton h-32 w-full"></div>
        <div class="skeleton h-32 w-full"></div>
        <div class="skeleton h-32 w-full"></div>
        <div class="skeleton h-32 w-full"></div>
        <div class="skeleton h-32 w-full"></div>
    </div>
{:else if result.length > 0}
    <div class="flex flex-col h-full w-full overflow-y-scroll">
        <ul class="list bg-base-100 rounded-box shadow-md">
            <li class="p-4 pb-2 text-xs opacity-60 tracking-wide">Lista ogladanych anime:</li>

            {#each result as anime}
                <li class="list-row flex items-center justify-between">
                    <div class="text-4xl font-thin opacity-30 tabular-nums">
                        {anime.rating || "-"}
                    </div>
                    <div>
                        <img
                            class="w-12 rounded-box object-fill shadow-sm"
                            src={anime.image_url}
                            alt="anime"
                        />
                    </div>
                    <div class="list-col-grow flex-1">
                        <div>{anime.name}</div>
                        <div class="text-xs uppercase font-semibold opacity-60">
                            {anime.anime_type}
                            {#if anime.episodes}
                                <span class="normal-case"> | {anime.episodes}</span>
                            {/if}
                        </div>
                    </div>
                    <button
                        data-debug-url={anime.url}
                        class="btn btn-square btn-ghost"
                        aria-label="episodes"
                        onclick={async () => { await handleButton(anime.url); }}
                    >
                        <svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor">
                                <path d="M6 3L20 12 6 21 6 3z"></path>
                            </g>
                        </svg>
                    </button>
                </li>
            {/each}
        </ul>
    </div>
{:else}
    <Empty />
{/if}
