<script lang="ts">
    import {globalStates, LoadingState, params} from "$lib/global.svelte";
    import {onMount} from "svelte";
    import {invoke} from "@tauri-apps/api/core";
    import type {
        AnimeDetails,
        AnimeRatingKey,
        AnimeRatingUpdate,
        AnimeWatchStatus,
        EpisodeProgress,
        RelatedSeries,
    } from "$lib/types";
    import {log, LogLevel} from "$lib/logs/logs.svelte";
    import {goto} from "$app/navigation";
    import Empty from "$lib/Empty.svelte";
    import { formatShindenCreatedTime, titleIdFromSeriesUrl } from "$lib/shindenProgress";
    import { queueWatchingCacheTitleRefreshFromStoredSettings } from "$lib/watchlistRefresh";
    import AnimeDetailsPanel from "$lib/AnimeDetailsPanel.svelte";

    let episodes: EpisodeProgress[] = $state([]);
    let watchedUpdateInProgress: number | null = $state(null);
    let details: AnimeDetails | null = $state(null);
    let detailsLoading = $state(false);
    let statusUpdateInProgress = $state(false);
    let ratingInProgress: AnimeRatingKey | null = $state(null);

    onMount(async () => {
        await loadEpisodes();
    });

    async function loadEpisodes() {
        try {
            globalStates.loadingState = LoadingState.LOADING;
            log(LogLevel.INFO, "Loading episodes");

            if (!params.titleId) {
                params.titleId = titleIdFromSeriesUrl(params.seriesUrl);
            }

            episodes = await invoke<EpisodeProgress[]>("get_episodes_with_progress", {
                url: params.seriesUrl,
                titleId: params.titleId,
                totalEpisodes: params.animeTotalEpisodes,
            });
            params.episodeProgress = episodes;
            await loadAnimeDetails();
            globalStates.loadingState = LoadingState.OK;
            log(LogLevel.SUCCESS, "Loaded episodes successfully");
        } catch (e) {
            globalStates.loadingState = LoadingState.ERROR;
            log(LogLevel.ERROR, `Error getting episodes: ${e}`);
        }
    }

    async function loadAnimeDetails() {
        if (!params.seriesUrl) {
            details = null;
            return;
        }

        try {
            detailsLoading = true;
            details = await invoke<AnimeDetails>("get_anime_details", {
                url: params.seriesUrl,
            });
            if (!params.titleId && details.titleId) {
                params.titleId = details.titleId;
            }
            if (details.userStatusLoaded) {
                params.animeWatchStatus = details.watchStatus || "no";
                params.animeIsFavourite = details.isFavourite;
            }
        } catch (e) {
            details = null;
            log(LogLevel.WARNING, `Nie udalo sie zaladowac szczegolow anime: ${e}`);
        } finally {
            detailsLoading = false;
        }
    }

    async function updateAnimeStatus(status: AnimeWatchStatus) {
        const titleId = params.titleId;
        if (!titleId || params.animeWatchStatus === status) {
            return;
        }

        try {
            statusUpdateInProgress = true;
            await invoke("update_anime_status", {
                titleId,
                status,
                isFavourite: params.animeIsFavourite,
            });
            params.animeWatchStatus = status;
            if (details) {
                details.watchStatus = status;
                details.userStatusLoaded = true;
                details = { ...details };
            }
            log(LogLevel.SUCCESS, "Zmieniono status anime");
        } catch (e) {
            log(LogLevel.ERROR, `Nie udalo sie zapisac statusu anime: ${e}`);
        } finally {
            statusUpdateInProgress = false;
        }
    }

    async function updateAnimeRating(ratingType: AnimeRatingKey, value: number) {
        if (!details || !params.titleId) {
            return;
        }

        const previousValue = details.userRatings[ratingType];
        try {
            ratingInProgress = ratingType;
            const update: AnimeRatingUpdate = {
                titleId: params.titleId,
                titleType: details.titleType || "anime",
                ratingType,
                value,
            };
            await invoke("update_anime_rating", { update });
            details.userRatings = {
                ...details.userRatings,
                [ratingType]: value,
            };
            details = { ...details };
            log(LogLevel.SUCCESS, "Zapisano ocene anime");
        } catch (e) {
            if (details) {
                details.userRatings = {
                    ...details.userRatings,
                    [ratingType]: previousValue,
                };
                details = { ...details };
            }
            log(LogLevel.ERROR, `Nie udalo sie zapisac oceny anime: ${e}`);
        } finally {
            ratingInProgress = null;
        }
    }

    async function openRelatedSeries(series: RelatedSeries) {
        const titleId = titleIdFromSeriesUrl(series.url);
        if (!titleId) {
            return;
        }

        params.seriesUrl = series.url;
        params.titleId = titleId;
        params.animeWatchStatus = "no";
        params.animeIsFavourite = 0;
        params.animeTotalEpisodes = null;
        params.episodeProgress = [];
        params.currentEpisodeIndex = -1;
        await loadEpisodes();
    }

    function currentWatchStatus(): AnimeWatchStatus {
        return params.animeWatchStatus || "no";
    }

    async function setEpisodeWatched(episode: EpisodeProgress, watched: boolean) {
        const titleId = params.titleId;
        if (!titleId || !episode.episodeId || episode.watched === watched) {
            return;
        }

        try {
            watchedUpdateInProgress = episode.episodeId;
            await invoke(watched ? "mark_episode_watched" : "mark_episode_unwatched", {
                titleId,
                episodeId: episode.episodeId,
                createdTime: formatShindenCreatedTime(new Date()),
            });

            episode.watched = watched;
            episode.viewCount = watched ? Math.max(episode.viewCount, 1) : 0;
            episodes = [...episodes];
            params.episodeProgress = episodes;
            queueWatchingCacheTitleRefreshFromStoredSettings(titleId);
            log(LogLevel.SUCCESS, watched
                ? `Oznaczono odcinek ${episode.episodeNo} jako obejrzany`
                : `Odznaczono odcinek ${episode.episodeNo} jako obejrzany`);
        } catch (e) {
            log(LogLevel.ERROR, `Error updating episode watched state: ${e}`);
        } finally {
            watchedUpdateInProgress = null;
        }
    }

    async function handleButton(episode: EpisodeProgress, index: number) {
        params.playersUrl = episode.link;
        params.episodeProgress = episodes;
        params.currentEpisodeIndex = index;
        await goto("/players");
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
{:else if globalStates.loadingState === LoadingState.OK}
    <div class="flex flex-col h-full w-full overflow-y-scroll gap-4 p-4">
        {#if detailsLoading}
            <div class="skeleton h-64 w-full"></div>
        {:else if details}
            <AnimeDetailsPanel
                {details}
                watchStatus={currentWatchStatus()}
                canEdit={globalStates.user.name !== null}
                statusDisabled={statusUpdateInProgress}
                {ratingInProgress}
                onStatusChange={(status) => { void updateAnimeStatus(status); }}
                onRatingChange={(ratingType, value) => { void updateAnimeRating(ratingType, value); }}
                onOpenRelated={(series) => { void openRelatedSeries(series); }}
            />
        {/if}

    {#if episodes.length > 0}
        <ul class="list bg-base-100 rounded-box shadow-md">

            <li class="p-4 pb-2 text-xs opacity-60 tracking-wide">Lista odcinków:</li>

            <li class="flex items-center justify-end px-4 pb-2">
                <button class="btn btn-xs btn-ghost" onclick={() => { void loadEpisodes(); }}>
                    Odśwież
                </button>
            </li>

            {#each episodes as episode, i}
                <li class="list-row flex items-center justify-between">
                    <div class="text-4xl font-thin opacity-30 tabular-nums w-fit min-w-16 text-center">{i+1}</div>
                    <div class="list-col-grow flex-1">
                        <div>{episode.title === "" ? "Brak nazwy odcinka" : episode.title}</div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <span class={`badge ${episode.watched ? "badge-success" : "badge-ghost"}`}>
                            {episode.watched ? "Obejrzany" : "Nieobejrzany"}
                        </span>

                        <button
                            class="btn btn-sm btn-ghost"
                            disabled={!episode.episodeId || watchedUpdateInProgress === episode.episodeId}
                            onclick={() => { void setEpisodeWatched(episode, !episode.watched); }}
                        >
                            {episode.watched ? "Odznacz" : "Oznacz"}
                        </button>
                    </div>
                    <button class="btn btn-square btn-ghost" aria-label="play" onclick={async() => { await handleButton(episode, i) }}>
                        <svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor"><path d="M6 3L20 12 6 21 6 3z"></path></g></svg>
                    </button>
                </li>
            {/each}
        </ul>
    {:else}
        <Empty />
    {/if}
    </div>
{/if}
