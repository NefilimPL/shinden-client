<script lang="ts">
    import {invoke} from "@tauri-apps/api/core";
    import {onMount} from "svelte";
    import type {AnimeListViewMode, AnimeWatchStatus, SearchAnime} from "$lib/types";
    import {log, LogLevel} from "$lib/logs/logs.svelte";
    import {globalStates, LoadingState, params} from "$lib/global.svelte";
    import Empty from "$lib/Empty.svelte";
    import { animeStatusOptions, titleIdFromSeriesUrl } from "$lib/shindenProgress";
    import AnimeListViewToggle from "$lib/AnimeListViewToggle.svelte";
    import { openAnimeTitle } from "$lib/titleNavigation";
    import { filterSearchAnime } from "$lib/searchFilters";
    globalStates.loadingState = LoadingState.LOADING;

    let result: Array<SearchAnime> = $state([]);
    let statusUpdateInProgress: number | null = $state(null);
    let viewMode: AnimeListViewMode = $state("list");
    const viewModeStorageKey = "shinden:search-view-mode";

    onMount(async () => {
        try {
            loadViewMode();
            log(LogLevel.INFO, `Searching anime: ${params.animeName}`);

            const searchResults = await invoke<SearchAnime[]>("search", {
                query: params.animeName
            });

            result = filterSearchAnime(searchResults, params.searchFilters);
            if (result.length > 0) {
                result = result.sort((a, b) => {
                    let a_rating = Number(a.rating.replace(",", "."));
                    let b_rating = Number(b.rating.replace(",", "."));

                    return b_rating - a_rating;
                });
                globalStates.loadingState = LoadingState.OK;
                log(LogLevel.SUCCESS, `Searching anime: ${params.animeName} done`);
            } else {

                log(LogLevel.WARNING, `Searching anime: ${params.animeName} found 0 results`);
                globalStates.loadingState = LoadingState.WARNING;
            }
        } catch (e) {
            globalStates.loadingState = LoadingState.ERROR;
            log(LogLevel.ERROR, `Error searching anime: ${params.animeName}`);
        }
    })

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

    function statusTitleId(anime: SearchAnime) {
        return anime.titleId ?? titleIdFromSeriesUrl(anime.url);
    }

    async function updateStatus(anime: SearchAnime, status: AnimeWatchStatus) {
        const titleId = statusTitleId(anime);
        if (!titleId || anime.watchStatus === status) {
            return;
        }

        try {
            statusUpdateInProgress = titleId;
            await invoke("update_anime_status", {
                titleId,
                status,
                isFavourite: anime.isFavourite,
            });
            anime.titleId = titleId;
            anime.watchStatus = status;
            result = [...result];
            log(LogLevel.SUCCESS, `Zmieniono status anime: ${anime.name}`);
        } catch (e) {
            log(LogLevel.ERROR, `Nie udało się zapisać statusu anime w Shinden: ${e}`);
        } finally {
            statusUpdateInProgress = null;
        }
    }

    async function handleStatusChange(anime: SearchAnime, event: Event) {
        const select = event.currentTarget as HTMLSelectElement;
        const status = select.value as AnimeWatchStatus;
        await updateStatus(anime, status);
        select.value = anime.watchStatus;
    }

    async function handleButton(anime: SearchAnime) {
        const titleId = statusTitleId(anime);
        if (!titleId) {
            return;
        }

        await openAnimeTitle({
            titleId,
            name: anime.name,
            imageUrl: anime.image_url,
            seriesUrl: anime.url,
            watchStatus: anime.watchStatus,
            isFavourite: anime.isFavourite,
            totalEpisodes: anime.totalEpisodes,
        });
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
{:else}

    {#if result.length > 0}

    <div class="flex flex-col h-full w-full overflow-y-scroll gap-3 p-4">
        <div class="flex justify-end">
            <AnimeListViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {#if viewMode === "list"}
        <ul class="list bg-base-100 rounded-box shadow-md">

            <li class="p-4 pb-2 text-xs opacity-60 tracking-wide">Wyniki wyszukiwania:</li>

            {#each result as anime}
                <li class="list-row flex items-center justify-between">
                    <div class="text-4xl font-thin opacity-30 tabular-nums">{anime.rating}</div>
                    <div class=""><img class="w-12 rounded-box object-fill shadow-sm" src={anime.image_url} alt="anime"/></div>
                    <div class="list-col-grow flex-1">
                        <div>{anime.name}</div>
                        <div class="text-xs uppercase font-semibold opacity-60">{anime.anime_type}</div>
                    </div>
                    {#if globalStates.user.name !== null && statusTitleId(anime)}
                        <select
                            class="select select-bordered select-sm w-36"
                            value={anime.watchStatus}
                            disabled={statusUpdateInProgress === statusTitleId(anime)}
                            aria-label="status anime"
                            onchange={(event) => { void handleStatusChange(anime, event); }}
                        >
                            <option value="no">Brak statusu</option>
                            {#each animeStatusOptions as option}
                                <option value={option.value}>{option.label}</option>
                            {/each}
                        </select>
                    {/if}
                    {#if anime.url.startsWith("https://shinden.pl/titles") && globalStates.user.name === null}
                        <div class="badge badge-warning">Zaloguj się aby obejrzeć</div>
                        <button disabled data-debug-url={anime.url} class="btn btn-square btn-ghost" aria-label="play" onclick={async ()=>{ await handleButton(anime) }}>
                            <svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor"><path d="M6 3L20 12 6 21 6 3z"></path></g></svg>
                        </button>
                    {:else}
                        <button data-debug-url={anime.url} class="btn btn-square btn-ghost" aria-label="play" onclick={async ()=>{ await handleButton(anime) }}>
                            <svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor"><path d="M6 3L20 12 6 21 6 3z"></path></g></svg>
                        </button>
                    {/if}

                </li>
            {/each}
        </ul>
        {:else}
            <section class="bg-base-100 rounded-box shadow-md p-4">
                <div class="pb-3 text-xs opacity-60 tracking-wide">Wyniki wyszukiwania:</div>
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {#each result as anime}
                        <article class="flex min-w-0 flex-col overflow-hidden rounded-lg bg-base-200 shadow-sm">
                            <button
                                type="button"
                                data-debug-url={anime.url}
                                class="text-left"
                                disabled={anime.url.startsWith("https://shinden.pl/titles") && globalStates.user.name === null}
                                onclick={async () => { await handleButton(anime); }}
                            >
                                <img
                                    class="aspect-[2/3] w-full object-cover"
                                    src={anime.image_url}
                                    alt={anime.name}
                                />
                                <div class="flex min-h-28 flex-col gap-1 p-3">
                                    <div class="line-clamp-2 text-sm font-semibold">{anime.name}</div>
                                    <div class="text-xs uppercase opacity-60">{anime.anime_type}</div>
                                    <div class="mt-auto flex items-center justify-between gap-2">
                                        <span class="badge badge-sm">{anime.rating || "-"}</span>
                                        {#if anime.url.startsWith("https://shinden.pl/titles") && globalStates.user.name === null}
                                            <span class="badge badge-warning badge-sm">Login</span>
                                        {/if}
                                    </div>
                                </div>
                            </button>

                            <div class="flex items-center gap-1 border-t border-base-content/10 p-2">
                                {#if globalStates.user.name !== null && statusTitleId(anime)}
                                    <select
                                        class="select select-bordered select-xs min-w-0 flex-1"
                                        value={anime.watchStatus}
                                        disabled={statusUpdateInProgress === statusTitleId(anime)}
                                        aria-label="status anime"
                                        onchange={(event) => { void handleStatusChange(anime, event); }}
                                    >
                                        <option value="no">Brak statusu</option>
                                        {#each animeStatusOptions as option}
                                            <option value={option.value}>{option.label}</option>
                                        {/each}
                                    </select>
                                {/if}
                                <button
                                    data-debug-url={anime.url}
                                    class="btn btn-square btn-ghost btn-sm"
                                    aria-label="play"
                                    disabled={anime.url.startsWith("https://shinden.pl/titles") && globalStates.user.name === null}
                                    onclick={async () => { await handleButton(anime); }}
                                >
                                    <svg class="size-[1em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor"><path d="M6 3L20 12 6 21 6 3z"></path></g></svg>
                                </button>
                            </div>
                        </article>
                    {/each}
                </div>
            </section>
        {/if}
    </div>
    {:else}
        <Empty />
    {/if}
{/if}



