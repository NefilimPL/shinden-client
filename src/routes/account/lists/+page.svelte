<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import AnimeListViewToggle from "$lib/AnimeListViewToggle.svelte";
    import Empty from "$lib/Empty.svelte";
    import { animeStatusOptions } from "$lib/shindenProgress";
    import { getUserData, globalStates, LoadingState } from "$lib/global.svelte";
    import { log, LogLevel } from "$lib/logs/logs.svelte";
    import type {
        AnimeListViewMode,
        AnimeWatchStatus,
        UserAnimeListFilters,
        UserAnimeListItem,
        UserAnimeListRefreshStatus,
        UserAnimeListRefreshSummary,
        UserAnimeListsPayload,
        UserAnimeListStatusFilter,
    } from "$lib/types";
    import { resumeUserAnimeListRefresh } from "$lib/userAnimeListRefresh";
    import {
        applyUserAnimeListFilters,
        countUserAnimeListStatuses,
        statusCountKey,
        userAnimeListAgeRatings,
        userAnimeListNeedsAgeMetadataRefresh,
        userAnimeListStatusOptions,
        userAnimeListTags,
        userAnimeListTypes,
    } from "$lib/userAnimeLists";

    import { openAnimeTitle, openAnimeTitleInBackground } from "$lib/titleNavigation";
    import { openTitleOnAuxClick } from "$lib/titleOpenInteraction";
    import { baseViewForPath } from "$lib/baseViewState";
    import { titleWorkspace } from "$lib/titleWorkspace.svelte";
    const viewModeStorageKey = "shinden:user-anime-lists-view-mode";
    const refreshStatusPollMs = 1500;

    let items: UserAnimeListItem[] = $state([]);
    let filters: UserAnimeListFilters = $state({
        query: "",
        status: "all",
        animeType: "",
        releaseYearFrom: null,
        releaseYearTo: null,
        tag: "",
        excludeTag: false,
        ageRating: "",
        sortKey: "title",
    });
    let viewMode: AnimeListViewMode = $state("grid");
    let refreshStatus: UserAnimeListRefreshStatus = $state(defaultUserAnimeListRefreshStatus());
    let statusUpdateInProgress: number | null = $state(null);
    let syncError: string | null = $state(null);
    let refreshedAtMs: number | null = $state(null);
    let baseStateRestored = $state(false);

    let visibleItems = $derived(applyUserAnimeListFilters(items, filters));
    let counts = $derived(countUserAnimeListStatuses(items));
    let animeTypes = $derived(userAnimeListTypes(items));
    let tagOptions = $derived(userAnimeListTags(items));
    let ageRatingOptions = $derived(userAnimeListAgeRatings(items));
    let needsAgeMetadataRefresh = $derived(userAnimeListNeedsAgeMetadataRefresh(items));
    let refreshInProgress = $derived(refreshStatus.running);
    let refreshProgressText = $derived(
        refreshStatus.total > 0
            ? `Zebrano ${refreshStatus.current}/${refreshStatus.total}, pozostalo ${refreshStatus.remaining}`
            : "Przygotowywanie odswiezania...",
    );
    let currentStatusLabel = $derived(
        userAnimeListStatusOptions.find((option) => option.value === filters.status)?.label
            ?? "Wszystkie",
    );

    onMount(() => {
        loadViewMode();
        restoreBaseState();
        baseStateRestored = true;

        const refreshStatusTimer = window.setInterval(() => {
            void pollUserAnimeListRefreshStatus();
        }, refreshStatusPollMs);

        void initializePage();

        return () => {
            window.clearInterval(refreshStatusTimer);
        };
    });

    $effect(() => {
        if (!baseStateRestored) return;
        titleWorkspace.saveBaseView(baseViewForPath("/account/lists", {
            filters: { ...filters },
            viewMode,
        }, 0));
    });

    function restoreBaseState() {
        if (titleWorkspace.baseView.id !== "user-lists") {
            return;
        }

        const state = titleWorkspace.baseView.state;
        if (typeof state.filters === "object" && state.filters !== null && !Array.isArray(state.filters)) {
            filters = { ...filters, ...state.filters };
        }
        if (state.viewMode === "grid" || state.viewMode === "list") {
            viewMode = state.viewMode;
        }
    }

    function defaultUserAnimeListRefreshStatus(): UserAnimeListRefreshStatus {
        return {
            running: false,
            current: 0,
            total: 0,
            remaining: 0,
            refreshed: 0,
            failed: 0,
            currentTitle: "",
            lastFinishedAtMs: null,
            lastError: null,
        };
    }

    async function initializePage() {
        await ensureUserLoaded();
        if (!globalStates.user.name) {
            globalStates.loadingState = LoadingState.WARNING;
            await goto("/account");
            return;
        }

        void resumeUserAnimeListRefresh();
        await pollUserAnimeListRefreshStatus(false);
        await loadUserAnimeLists(false);
    }

    async function ensureUserLoaded() {
        if (globalStates.user.name) {
            return;
        }

        try {
            await getUserData();
        } catch (error) {
            log(LogLevel.INFO, `User anime lists require login: ${error}`);
        }
    }

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

    async function loadUserAnimeLists(forceRefresh: boolean, showInitialLoading = true) {
        try {
            syncError = null;
            if (showInitialLoading && items.length === 0) {
                globalStates.loadingState = LoadingState.LOADING;
            }

            const payload = await invoke<UserAnimeListsPayload>("get_user_anime_lists", {
                forceRefresh,
            });
            items = payload.items;
            refreshedAtMs = payload.refreshedAtMs;
            syncError = payload.syncError;
            globalStates.loadingState =
                payload.items.length > 0 ? LoadingState.OK : LoadingState.WARNING;

            if (payload.syncError) {
                log(LogLevel.WARNING, `Loaded cached user anime lists: ${payload.syncError}`);
            } else {
                log(LogLevel.SUCCESS, "Loaded user anime lists");
            }
        } catch (error) {
            globalStates.loadingState = LoadingState.ERROR;
            syncError = `${error}`;
            log(LogLevel.ERROR, `Error loading user anime lists: ${error}`);
        }
    }

    async function pollUserAnimeListRefreshStatus(reloadOnFinish = true) {
        try {
            const previousRunning = refreshStatus.running;
            const previousFinishedAtMs = refreshStatus.lastFinishedAtMs;
            const nextStatus = await invoke<UserAnimeListRefreshStatus>(
                "get_user_anime_list_refresh_status",
            );
            refreshStatus = nextStatus;

            if (
                reloadOnFinish
                && previousRunning
                && !nextStatus.running
                && nextStatus.lastFinishedAtMs
                && nextStatus.lastFinishedAtMs !== previousFinishedAtMs
            ) {
                await loadUserAnimeLists(false, false);
            }
        } catch (error) {
            log(LogLevel.WARNING, `Error polling user anime list refresh: ${error}`);
        }
    }

    async function refreshUserAnimeListCache() {
        if (refreshStatus.running) {
            return;
        }

        try {
            syncError = null;
            refreshStatus = {
                ...defaultUserAnimeListRefreshStatus(),
                running: true,
                lastFinishedAtMs: refreshStatus.lastFinishedAtMs,
            };

            const summary = await invoke<UserAnimeListRefreshSummary>(
                "refresh_user_anime_list_cache",
            );
            refreshStatus = summary.status;
            await loadUserAnimeLists(false, false);

            if (summary.status.lastError) {
                log(LogLevel.WARNING, summary.status.lastError);
            } else {
                log(LogLevel.SUCCESS, "Odswiezono cache wszystkich list");
            }
        } catch (error) {
            syncError = `${error}`;
            await pollUserAnimeListRefreshStatus(false);
            log(LogLevel.ERROR, `Error refreshing user anime lists: ${error}`);
        }
    }

    function setStatusFilter(status: UserAnimeListStatusFilter) {
        filters.status = status;
    }

    function setReleaseYearFrom(event: Event) {
        const value = (event.currentTarget as HTMLInputElement).value;
        filters.releaseYearFrom = value ? Number(value) : null;
    }

    function setReleaseYearTo(event: Event) {
        const value = (event.currentTarget as HTMLInputElement).value;
        filters.releaseYearTo = value ? Number(value) : null;
    }

    function clearFilters() {
        filters.query = "";
        filters.status = "all";
        filters.animeType = "";
        filters.releaseYearFrom = null;
        filters.releaseYearTo = null;
        filters.tag = "";
        filters.excludeTag = false;
        filters.ageRating = "";
        filters.sortKey = "title";
    }

    function formatRefreshTime(timestamp: number | null) {
        if (!timestamp) {
            return "Brak cache";
        }

        return new Date(timestamp).toLocaleString();
    }

    function statusLabel(status: AnimeWatchStatus) {
        if (status === "no") {
            return "Brak statusu";
        }

        return animeStatusOptions.find((option) => option.value === status)?.label ?? status;
    }

    async function updateStatus(anime: UserAnimeListItem, status: AnimeWatchStatus) {
        if (anime.watchStatus === status) {
            return;
        }

        try {
            statusUpdateInProgress = anime.titleId;
            await invoke("update_anime_status", {
                titleId: anime.titleId,
                status,
                isFavourite: anime.isFavourite,
            });

            anime.watchStatus = status;
            anime.active = status !== "no";
            items = [...items];
            log(LogLevel.SUCCESS, `Zmieniono status anime: ${anime.name}`);
        } catch (error) {
            log(LogLevel.ERROR, `Error updating anime status: ${error}`);
        } finally {
            statusUpdateInProgress = null;
        }
    }

    async function handleStatusChange(anime: UserAnimeListItem, event: Event) {
        const select = event.currentTarget as HTMLSelectElement;
        const status = select.value as AnimeWatchStatus;
        await updateStatus(anime, status);
        select.value = anime.watchStatus;
    }

    async function openEpisodes(anime: UserAnimeListItem, background = false) {
        const input = {
            titleId: anime.titleId,
            name: anime.name,
            imageUrl: anime.image_url,
            seriesUrl: anime.url,
            watchStatus: anime.watchStatus,
            isFavourite: anime.isFavourite,
            totalEpisodes: anime.totalEpisodes,
        };
        await (background ? openAnimeTitleInBackground(input) : openAnimeTitle(input));
    }

    function handleTitleAuxClick(event: MouseEvent, anime: UserAnimeListItem) {
        openTitleOnAuxClick(event, () => { void openEpisodes(anime, true); });
    }
</script>

{#if globalStates.loadingState === LoadingState.LOADING && items.length === 0}
    <div class="flex h-full w-full flex-col gap-4 p-4">
        <div class="skeleton h-24 w-full"></div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div class="skeleton aspect-[2/3] w-full"></div>
            <div class="skeleton aspect-[2/3] w-full"></div>
            <div class="skeleton aspect-[2/3] w-full"></div>
            <div class="skeleton aspect-[2/3] w-full"></div>
            <div class="skeleton aspect-[2/3] w-full"></div>
        </div>
    </div>
{:else}
    <div class="flex h-full w-full flex-col gap-3 overflow-hidden p-4 lg:flex-row">
        <aside class="flex w-full shrink-0 flex-col gap-3 overflow-y-auto rounded-box bg-base-200 p-3 shadow-md lg:w-72">
            <label class="input input-bordered flex w-full items-center gap-2">
                <svg class="size-4 opacity-70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.3-4.3"></path>
                    </g>
                </svg>
                <input class="grow" type="search" placeholder="Wyszukaj tytul..." bind:value={filters.query} />
            </label>

            <section>
                <div class="mb-2 border-b border-base-content/30 pb-1 text-sm font-bold tracking-wide">LISTY</div>
                <div class="flex flex-col gap-1">
                    {#each userAnimeListStatusOptions as option}
                        <button
                            type="button"
                            class:btn-primary={filters.status === option.value}
                            class:btn-ghost={filters.status !== option.value}
                            class="btn btn-sm justify-between"
                            aria-pressed={filters.status === option.value}
                            onclick={() => setStatusFilter(option.value)}
                        >
                            <span>{option.label}</span>
                            <span class="badge badge-sm">{counts[statusCountKey(option.value)]}</span>
                        </button>
                    {/each}
                </div>
            </section>

            <section>
                <div class="mb-2 border-b border-base-content/30 pb-1 text-sm font-bold tracking-wide">SORTOWANIE</div>
                <select class="select select-bordered select-sm w-full" bind:value={filters.sortKey}>
                    <option value="title">Tytul</option>
                    <option value="rating">Ocena</option>
                    <option value="progress">Nieobejrzane</option>
                    <option value="updated">Ostatnia synchronizacja</option>
                    <option value="releaseYear">Rok premiery</option>
                </select>
            </section>

            <section>
                <div class="mb-2 flex items-center justify-between border-b border-base-content/30 pb-1">
                    <span class="text-sm font-bold tracking-wide">FILTRY</span>
                    <button class="btn btn-ghost btn-xs" type="button" onclick={clearFilters}>Wyczysc</button>
                </div>

                <div class="flex flex-col gap-2">
                    <select class="select select-bordered select-sm w-full" bind:value={filters.animeType}>
                        <option value="">Typ...</option>
                        {#each animeTypes as animeType}
                            <option value={animeType}>{animeType}</option>
                        {/each}
                    </select>

                    <div class="grid grid-cols-2 gap-2">
                        <input
                            class="input input-bordered input-sm w-full"
                            type="number"
                            min="1900"
                            max="2100"
                            placeholder="Od roku"
                            value={filters.releaseYearFrom ?? ""}
                            oninput={setReleaseYearFrom}
                        />
                        <input
                            class="input input-bordered input-sm w-full"
                            type="number"
                            min="1900"
                            max="2100"
                            placeholder="Do roku"
                            value={filters.releaseYearTo ?? ""}
                            oninput={setReleaseYearTo}
                        />
                    </div>

                    <label class="flex items-center justify-between gap-3 text-sm">
                        <span>Wyklucz tag</span>
                        <input
                            type="checkbox"
                            class="checkbox checkbox-sm"
                            bind:checked={filters.excludeTag}
                            disabled={!filters.tag}
                        />
                    </label>

                    <select
                        class="select select-bordered select-sm w-full"
                        bind:value={filters.tag}
                        disabled={tagOptions.length === 0}
                    >
                        <option value="">Tag...</option>
                        {#each tagOptions as tag}
                            <option value={tag}>{tag}</option>
                        {/each}
                    </select>

                    <select
                        class="select select-bordered select-sm w-full"
                        bind:value={filters.ageRating}
                        disabled={ageRatingOptions.length === 0}
                    >
                        <option value="">Kat. wiekowa...</option>
                        {#each ageRatingOptions as ageRating}
                            <option value={ageRating}>{ageRating}</option>
                        {/each}
                    </select>

                    {#if needsAgeMetadataRefresh}
                        <button
                            class="btn btn-outline btn-sm w-full"
                            type="button"
                            disabled={refreshInProgress}
                            onclick={() => { void refreshUserAnimeListCache(); }}
                        >
                            Pobierz kategorie wiekowe
                        </button>
                    {/if}

                    {#if tagOptions.length === 0 && ageRatingOptions.length === 0}
                        <p class="text-xs opacity-60">
                            Uzyj odswiezania cache, aby pobrac tagi i kategorie wiekowe.
                        </p>
                    {/if}
                </div>
            </section>
        </aside>

        <main class="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
            <header class="flex flex-wrap items-center justify-between gap-3 rounded-box bg-base-100 p-4 shadow-md">
                <div class="min-w-0">
                    <div class="text-xs uppercase tracking-wide opacity-60">{currentStatusLabel}</div>
                    <div class="truncate text-sm opacity-80">
                        {visibleItems.length} pozycji | cache: {formatRefreshTime(refreshedAtMs)}
                    </div>
                    {#if syncError}
                        <div class="truncate text-xs text-warning">{syncError}</div>
                    {/if}
                    {#if refreshStatus.running}
                        <div class="mt-2 flex max-w-xl flex-wrap items-center gap-2 text-xs">
                            <progress
                                class="progress progress-primary h-1.5 w-40"
                                value={refreshStatus.current}
                                max={refreshStatus.total || 1}
                            ></progress>
                            <span class="tabular-nums opacity-80">{refreshProgressText}</span>
                            {#if refreshStatus.failed > 0}
                                <span class="text-warning">Bledy: {refreshStatus.failed}</span>
                            {/if}
                        </div>
                        {#if refreshStatus.currentTitle}
                            <div class="mt-1 max-w-xl truncate text-xs opacity-60">
                                Teraz: {refreshStatus.currentTitle}
                            </div>
                        {/if}
                    {:else if refreshStatus.lastError}
                        <div class="mt-1 truncate text-xs text-warning">
                            Ostatnie odswiezanie: {refreshStatus.lastError}
                        </div>
                    {/if}
                </div>

                <div class="flex shrink-0 items-center gap-1">
                    <button
                        class="btn btn-square btn-ghost btn-sm"
                        type="button"
                        aria-label="odswiez cache list"
                        title="Odswiez cache list"
                        disabled={refreshInProgress}
                        onclick={() => { void refreshUserAnimeListCache(); }}
                    >
                        {#if refreshInProgress}
                            <span class="loading loading-spinner loading-xs"></span>
                        {:else}
                            <svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor">
                                    <path d="M21 12a9 9 0 0 1-15.5 6.3"></path>
                                    <path d="M3 12a9 9 0 0 1 15.5-6.3"></path>
                                    <path d="M3 19v-5h5"></path>
                                    <path d="M21 5v5h-5"></path>
                                </g>
                            </svg>
                        {/if}
                    </button>
                    <AnimeListViewToggle value={viewMode} onChange={setViewMode} />
                </div>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto">
                {#if visibleItems.length === 0}
                    <div class="rounded-box bg-base-100 p-4 shadow-md">
                        <Empty />
                    </div>
                {:else if viewMode === "list"}
                    <ul class="list rounded-box bg-base-100 shadow-md">
                        {#each visibleItems as anime}
                            <li class="list-row flex items-center justify-between">
                                <div class="text-4xl font-thin tabular-nums opacity-30">
                                    {anime.rating || "-"}
                                </div>
                                <div>
                                    <img class="w-12 rounded-box object-fill shadow-sm" src={anime.image_url} alt={anime.name} />
                                </div>
                                <div class="list-col-grow min-w-0 flex-1">
                                    <div class="truncate">{anime.name}</div>
                                    <div class="truncate text-xs uppercase font-semibold opacity-60">
                                        {anime.anime_type || "anime"}
                                        {#if anime.episodes}
                                            <span class="normal-case"> | {anime.episodes}</span>
                                        {/if}
                                        {#if anime.releaseYear}
                                            <span class="normal-case"> | {anime.releaseYear}</span>
                                        {/if}
                                    </div>
                                </div>
                                <select
                                    class="select select-bordered select-sm w-36"
                                    value={anime.watchStatus}
                                    disabled={statusUpdateInProgress === anime.titleId}
                                    aria-label="status anime"
                                    onchange={(event) => { void handleStatusChange(anime, event); }}
                                >
                                    <option value="no">Brak statusu</option>
                                    {#each animeStatusOptions as option}
                                        <option value={option.value}>{option.label}</option>
                                    {/each}
                                </select>
                                <button
                                    class="btn btn-square btn-ghost"
                                    aria-label="odcinki"
                                    onclick={() => { void openEpisodes(anime); }}
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
                {:else}
                    <section class="rounded-box bg-base-100 p-4 shadow-md">
                        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                            {#each visibleItems as anime}
                                <article class="flex min-w-0 flex-col overflow-hidden rounded-lg bg-base-200 shadow-sm">
                                    <button
                                        type="button"
                                        class="text-left"
                                        onclick={() => { void openEpisodes(anime); }}
                                        onauxclick={(event) => handleTitleAuxClick(event, anime)}
                                    >
                                        <img
                                            class="aspect-[2/3] w-full object-cover"
                                            src={anime.image_url}
                                            alt={anime.name}
                                        />
                                        <div class="flex min-h-32 flex-col gap-1 p-3">
                                            <div class="line-clamp-2 text-sm font-semibold">{anime.name}</div>
                                            <div class="truncate text-xs uppercase opacity-60">
                                                {anime.anime_type || "anime"}
                                                {#if anime.episodes}
                                                    <span class="normal-case"> | {anime.episodes}</span>
                                                {/if}
                                            </div>
                                            <div class="mt-auto flex items-center justify-between gap-2 text-xs">
                                                <span class="badge badge-sm">{anime.rating || "-"}</span>
                                                <span class="truncate opacity-70">{statusLabel(anime.watchStatus)}</span>
                                            </div>
                                        </div>
                                    </button>

                                    <div class="flex items-center gap-1 border-t border-base-content/10 p-2">
                                        <select
                                            class="select select-bordered select-xs min-w-0 flex-1"
                                            value={anime.watchStatus}
                                            disabled={statusUpdateInProgress === anime.titleId}
                                            aria-label="status anime"
                                            onchange={(event) => { void handleStatusChange(anime, event); }}
                                        >
                                            <option value="no">Brak statusu</option>
                                            {#each animeStatusOptions as option}
                                                <option value={option.value}>{option.label}</option>
                                            {/each}
                                        </select>
                                        <button
                                            class="btn btn-square btn-ghost btn-sm"
                                            aria-label="odcinki"
                                            onclick={() => { void openEpisodes(anime); }}
                                            onauxclick={(event) => handleTitleAuxClick(event, anime)}
                                        >
                                            <svg class="size-[1em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                                <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor">
                                                    <path d="M6 3L20 12 6 21 6 3z"></path>
                                                </g>
                                            </svg>
                                        </button>
                                    </div>
                                </article>
                            {/each}
                        </div>
                    </section>
                {/if}
            </div>
        </main>
    </div>
{/if}
