<script lang="ts">
    import { globalStates, LoadingState, params } from "$lib/global.svelte.js";
    import { onMount } from "svelte";
    import { invoke } from "@tauri-apps/api/core";
    import { log, LogLevel } from "$lib/logs/logs.svelte";
    import { goto } from "$app/navigation";
    import type {
        AnimeListViewMode,
        DiscoveryAnime,
        SearchFilterCatalog,
        SearchTagSelectionMode,
    } from "$lib/types";
    import DiscoveryAnimeList from "$lib/DiscoveryAnimeList.svelte";
    import AnimeListViewToggle from "$lib/AnimeListViewToggle.svelte";

    import {
        defaultSearchFilters,
        setSearchTagSelection,
        type SearchFilters,
    } from "$lib/searchFilters";
    let animeName: string = $state("");
    let premieres: DiscoveryAnime[] = $state([]);
    let searchFilters: SearchFilters = $state({ ...defaultSearchFilters });
    let showSearchFilters = $state(false);
    let filterCatalog: SearchFilterCatalog | null = $state(null);
    let filterCatalogLoading = $state(false);
    let filterCatalogError: string | null = $state(null);
    let activeFilterGroupId = $state("");
    let selectedTagMode: SearchTagSelectionMode = $state("include");
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

    async function toggleSearchFilters() {
        showSearchFilters = !showSearchFilters;
        if (!showSearchFilters || filterCatalog !== null || filterCatalogLoading) {
            return;
        }

        filterCatalogLoading = true;
        filterCatalogError = null;
        try {
            filterCatalog = await invoke<SearchFilterCatalog>("get_search_filter_catalog");
            activeFilterGroupId = filterCatalog.groups[0]?.id ?? "";
        } catch (error) {
            filterCatalogError = `Nie udało się pobrać filtrów Shinden: ${error}`;
        } finally {
            filterCatalogLoading = false;
        }
    }

    function activeFilterGroup() {
        return filterCatalog?.groups.find((group) => group.id === activeFilterGroupId)
            ?? filterCatalog?.groups[0]
            ?? null;
    }

    function tagMode(tagId: number): SearchTagSelectionMode | null {
        return searchFilters.tags.find((tag) => tag.tagId === tagId)?.mode ?? null;
    }

    function toggleTag(tagId: number) {
        const nextMode = tagMode(tagId) === selectedTagMode ? null : selectedTagMode;
        searchFilters = {
            ...searchFilters,
            tags: setSearchTagSelection(searchFilters.tags, tagId, nextMode),
        };
    }

    function toggleLetter(letter: string) {
        searchFilters = {
            ...searchFilters,
            letter: searchFilters.letter === letter ? null : letter,
        };
    }

    function handleButton(event: Event) {
        event.preventDefault();
        params.animeName = animeName.trim();
        params.searchFilters = { ...searchFilters };
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

                <form class="flex w-full flex-col gap-2" onsubmit={handleButton}>
                    <div class="join w-full">
                        <label class="input join-item w-full">
                            <svg class="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2.5" fill="none" stroke="currentColor">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.3-4.3"></path>
                                </g>
                            </svg>
                            <input type="search" placeholder="Tytul (opcjonalnie)" bind:value={animeName} />
                        </label>
                        <button class="btn btn-primary join-item">Szukaj</button>
                        <button
                            type="button"
                            class="btn btn-ghost join-item"
                            aria-pressed={showSearchFilters}
                            onclick={() => { void toggleSearchFilters(); }}
                        >
                            Filtry
                        </button>
                        <button
                            type="button"
                            class="btn btn-ghost join-item"
                            aria-label="sezony"
                            onclick={() => { void openSeasons(); }}
                        >
                            Sezony
                        </button>
                    </div>

                    {#if showSearchFilters}
                        <div class="flex flex-col gap-4 rounded-box bg-base-200 p-3">
                            <div class="grid gap-3 sm:grid-cols-2">
                            <label class="form-control">
                                <span class="label-text mb-1">Dopasowanie wybranych pozycji</span>
                                <select class="select select-bordered select-sm" bind:value={searchFilters.genresType}>
                                    <option value="all">Wszystkie wybrane</option>
                                    <option value="one">Co najmniej jedna</option>
                                </select>
                            </label>
                            <label class="form-control">
                                <span class="label-text mb-1">Minimalna ocena</span>
                                <select class="select select-bordered select-sm" bind:value={searchFilters.minimumRating}>
                                    <option value={null}>Dowolna</option>
                                    <option value={5}>5,0</option>
                                    <option value={6}>6,0</option>
                                    <option value={7}>7,0</option>
                                    <option value={8}>8,0</option>
                                    <option value={9}>9,0</option>
                                </select>
                            </label>
                            </div>

                            {#if filterCatalogLoading}
                                <div class="skeleton h-32 w-full"></div>
                            {:else if filterCatalogError}
                                <div class="alert alert-warning text-sm" role="alert">{filterCatalogError}</div>
                            {:else if filterCatalog && filterCatalog.groups.length > 0}
                                {@const currentGroup = activeFilterGroup()}
                                {#if filterCatalog.letters.length > 0}
                                    <div class="flex flex-wrap items-center gap-1" aria-label="Alfabetycznie">
                                        <span class="mr-1 text-sm font-medium">Alfabetycznie:</span>
                                        {#each filterCatalog.letters as letter}
                                            <button
                                                type="button"
                                                class:btn-active={searchFilters.letter === letter}
                                                class="btn btn-ghost btn-xs"
                                                aria-pressed={searchFilters.letter === letter}
                                                onclick={() => toggleLetter(letter)}
                                            >{letter === "1" ? "#" : letter}</button>
                                        {/each}
                                    </div>
                                {/if}
                                <div class="flex flex-wrap gap-1" role="tablist" aria-label="Kategorie filtrów Shinden">
                                    {#each filterCatalog.groups as group}
                                        <button
                                            type="button"
                                            class:btn-active={activeFilterGroup()?.id === group.id}
                                            class="btn btn-sm btn-ghost"
                                            role="tab"
                                            aria-selected={activeFilterGroup()?.id === group.id}
                                            onclick={() => { activeFilterGroupId = group.id; }}
                                        >{group.label}</button>
                                    {/each}
                                </div>

                                <div class="flex flex-wrap items-center gap-2 text-sm">
                                    <span class="font-medium">Po kliknięciu tagu:</span>
                                    <label class="label cursor-pointer gap-1 py-0">
                                        <input class="radio radio-success radio-xs" type="radio" name="tag-mode" value="include" bind:group={selectedTagMode} />
                                        Chcę
                                    </label>
                                    <label class="label cursor-pointer gap-1 py-0">
                                        <input class="radio radio-error radio-xs" type="radio" name="tag-mode" value="exclude" bind:group={selectedTagMode} />
                                        Nie chcę
                                    </label>
                                    <span class="text-xs opacity-60">Ponowne kliknięcie usuwa wybór.</span>
                                </div>

                                {#if currentGroup}
                                    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                        {#each currentGroup.options as option}
                                            <button
                                                type="button"
                                                class="btn btn-sm justify-start"
                                                class:btn-success={tagMode(option.id) === "include"}
                                                class:btn-error={tagMode(option.id) === "exclude"}
                                                class:btn-ghost={tagMode(option.id) === null}
                                                aria-pressed={tagMode(option.id) !== null}
                                                onclick={() => toggleTag(option.id)}
                                            >{option.label}</button>
                                        {/each}
                                    </div>
                                {/if}
                            {:else}
                                <p class="text-sm opacity-60">Shinden nie zwrócił obecnie dostępnych filtrów.</p>
                            {/if}

                            <p class="text-xs opacity-60">
                                Filtry katalogowe są wysyłane bezpośrednio do Shinden. Tytuł możesz zostawić pusty, aby przeglądać katalog.
                            </p>
                        </div>
                    {/if}
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
