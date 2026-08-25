<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { openUrl } from "@tauri-apps/plugin-opener";
    import type { AnimeListViewMode, AnimeWatchStatus, DiscoveryAnime } from "$lib/types";
    import { globalStates } from "$lib/global.svelte";
    import { log, LogLevel } from "$lib/logs/logs.svelte";
    import { animeStatusOptions, titleIdFromSeriesUrl } from "$lib/shindenProgress";
    import { openAnimeTitle, openAnimeTitleInBackground } from "$lib/titleNavigation";
    import { openTitleOnAuxClick } from "$lib/titleOpenInteraction";
    import Empty from "$lib/Empty.svelte";

    let {
        items,
        heading,
        emptyLabel = "Brak pozycji",
        viewMode = "list",
    }: {
        items: DiscoveryAnime[];
        heading: string;
        emptyLabel?: string;
        viewMode?: AnimeListViewMode;
    } = $props();

    let displayItems: DiscoveryAnime[] = $state([]);
    let statusUpdateInProgress: number | null = $state(null);

    $effect(() => {
        displayItems = items.map((item) => ({ ...item }));
    });

    function statusTitleId(anime: DiscoveryAnime) {
        return anime.titleId ?? titleIdFromSeriesUrl(anime.url);
    }

    async function updateStatus(anime: DiscoveryAnime, status: AnimeWatchStatus) {
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
            displayItems = [...displayItems];
            log(LogLevel.SUCCESS, `Zmieniono status anime: ${anime.name}`);
        } catch (e) {
            log(LogLevel.ERROR, `Nie udalo sie zapisac statusu anime w Shinden: ${e}`);
        } finally {
            statusUpdateInProgress = null;
        }
    }

    async function handleStatusChange(anime: DiscoveryAnime, event: Event) {
        const select = event.currentTarget as HTMLSelectElement;
        const status = select.value as AnimeWatchStatus;
        await updateStatus(anime, status);
        select.value = anime.watchStatus;
    }

    async function openInApp(anime: DiscoveryAnime, background = false) {
        const titleId = statusTitleId(anime);
        if (!titleId) {
            return;
        }

        const input = {
            titleId,
            name: anime.name,
            imageUrl: anime.image_url,
            seriesUrl: anime.url,
            watchStatus: anime.watchStatus,
            isFavourite: anime.isFavourite,
            totalEpisodes: anime.totalEpisodes,
        };
        await (background ? openAnimeTitleInBackground(input) : openAnimeTitle(input));
    }

    function handleTitleAuxClick(event: MouseEvent, anime: DiscoveryAnime) {
        openTitleOnAuxClick(event, () => { void openInApp(anime, true); });
    }

    async function openOnShinden(anime: DiscoveryAnime) {
        try {
            await openUrl(anime.url);
        } catch (e) {
            log(LogLevel.ERROR, `Nie udalo sie otworzyc linku Shinden: ${e}`);
        }
    }
</script>

{#if displayItems.length > 0 && viewMode === "list"}
    <ul class="list bg-base-100 rounded-box shadow-md">
        <li class="p-4 pb-2 text-xs opacity-60 tracking-wide">{heading}</li>

        {#each displayItems as anime}
            <li class="list-row flex items-center justify-between">
                <div class="text-4xl font-thin opacity-30 tabular-nums">
                    {anime.rating || "-"}
                </div>
                <div>
                    <img class="w-12 rounded-box object-fill shadow-sm" src={anime.image_url} alt="anime" />
                </div>
                <div class="list-col-grow flex-1 min-w-0">
                    <div class="truncate">{anime.name}</div>
                    <div class="text-xs uppercase font-semibold opacity-60 truncate">
                        {anime.anime_type || "anime"}
                        {#if anime.episodes}
                            <span class="normal-case"> | {anime.episodes}</span>
                        {/if}
                        {#if anime.sourceLabel}
                            <span class="normal-case"> | {anime.sourceLabel}</span>
                        {/if}
                    </div>
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

                <button
                    class="btn btn-square btn-ghost"
                    aria-label="otworz na Shinden"
                    title="Otworz na Shinden"
                    onclick={() => { void openOnShinden(anime); }}
                >
                    <svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor">
                            <path d="M14 3h7v7"></path>
                            <path d="M10 14 21 3"></path>
                            <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path>
                        </g>
                    </svg>
                </button>

                <button
                    class="btn btn-square btn-ghost"
                    aria-label="odcinki"
                    disabled={!statusTitleId(anime)}
                    onclick={() => { void openInApp(anime); }}
                    onauxclick={(event) => handleTitleAuxClick(event, anime)}
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
{:else if displayItems.length > 0}
    <section class="bg-base-100 rounded-box shadow-md p-4">
        <div class="pb-3 text-xs opacity-60 tracking-wide">{heading}</div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {#each displayItems as anime}
                <article class="flex min-w-0 flex-col overflow-hidden rounded-lg bg-base-200 shadow-sm">
                    <button
                        type="button"
                        class="group text-left"
                        disabled={!statusTitleId(anime)}
                        onclick={() => { void openInApp(anime); }}
                        onauxclick={(event) => handleTitleAuxClick(event, anime)}
                    >
                        <img
                            class="aspect-[2/3] w-full object-cover"
                            src={anime.image_url}
                            alt={anime.name}
                        />
                        <div class="flex min-h-28 flex-col gap-1 p-3">
                            <div class="line-clamp-2 text-sm font-semibold">{anime.name}</div>
                            <div class="text-xs uppercase opacity-60">
                                {anime.anime_type || "anime"}
                                {#if anime.episodes}
                                    <span class="normal-case"> | {anime.episodes}</span>
                                {/if}
                            </div>
                            <div class="mt-auto flex items-center justify-between gap-2 text-xs">
                                <span class="badge badge-sm">{anime.rating || "-"}</span>
                                {#if anime.sourceLabel}
                                    <span class="truncate opacity-70">{anime.sourceLabel}</span>
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
                            class="btn btn-square btn-ghost btn-sm"
                            aria-label="otworz na Shinden"
                            title="Otworz na Shinden"
                            onclick={() => { void openOnShinden(anime); }}
                        >
                            <svg class="size-[1em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor">
                                    <path d="M14 3h7v7"></path>
                                    <path d="M10 14 21 3"></path>
                                    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path>
                                </g>
                            </svg>
                        </button>
                    </div>
                </article>
            {/each}
        </div>
    </section>
{:else}
    <div class="bg-base-100 rounded-box shadow-md p-4">
        <Empty />
        <p class="text-xs opacity-60 text-center mt-2">{emptyLabel}</p>
    </div>
{/if}
