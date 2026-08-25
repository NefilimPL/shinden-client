<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import type { AnimeListViewMode, DiscoveryAnime, SeasonOption, SeasonSlug } from "$lib/types";
    import { globalStates, LoadingState } from "$lib/global.svelte";
    import { log, LogLevel } from "$lib/logs/logs.svelte";
    import DiscoveryAnimeList from "$lib/DiscoveryAnimeList.svelte";
    import AnimeListViewToggle from "$lib/AnimeListViewToggle.svelte";
    import { baseViewForPath } from "$lib/baseViewState";
    import { titleWorkspace } from "$lib/titleWorkspace.svelte";

    const seasonOptions: SeasonOption[] = [
        { value: "current", label: "Obecny sezon" },
        { value: "winter", label: "Zima" },
        { value: "spring", label: "Wiosna" },
        { value: "summer", label: "Lato" },
        { value: "fall", label: "Jesien" },
    ];

    let year = $state(new Date().getFullYear());
    let season: SeasonSlug = $state(defaultSeasonSlug());
    let result: DiscoveryAnime[] = $state([]);
    let loading = $state(false);
    let viewMode: AnimeListViewMode = $state("list");
    let baseStateRestored = $state(false);
    const viewModeStorageKey = "shinden:season-view-mode";

    onMount(() => {
        loadViewMode();
        restoreBaseState();
        baseStateRestored = true;
        void loadSeasonAnime();
    });

    $effect(() => {
        if (!baseStateRestored) return;
        titleWorkspace.saveBaseView(baseViewForPath("/seasons", { year, season, viewMode }, 0));
    });

    function restoreBaseState() {
        if (titleWorkspace.baseView.id !== "seasons") {
            return;
        }

        const state = titleWorkspace.baseView.state;
        if (typeof state.year === "number" && Number.isFinite(state.year)) {
            year = state.year;
        }
        if (state.season === "current" || state.season === "winter" || state.season === "spring"
            || state.season === "summer" || state.season === "fall") {
            season = state.season;
        }
        if (state.viewMode === "grid" || state.viewMode === "list") {
            viewMode = state.viewMode;
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

    function defaultSeasonSlug(): SeasonSlug {
        const month = new Date().getMonth() + 1;
        if (month <= 3) return "winter";
        if (month <= 6) return "spring";
        if (month <= 9) return "summer";
        return "fall";
    }

    async function loadSeasonAnime() {
        try {
            loading = true;
            globalStates.loadingState = LoadingState.LOADING;
            result = await invoke<DiscoveryAnime[]>("get_season_anime", {
                year: season === "current" ? null : year,
                season,
            });
            globalStates.loadingState = result.length > 0 ? LoadingState.OK : LoadingState.WARNING;
            log(LogLevel.SUCCESS, "Loaded Shinden season anime");
        } catch (e) {
            result = [];
            globalStates.loadingState = LoadingState.ERROR;
            log(LogLevel.ERROR, `Nie udalo sie zaladowac sezonu Shinden: ${e}`);
        } finally {
            loading = false;
        }
    }
</script>

<div class="flex h-full w-full flex-col gap-3 overflow-y-scroll p-4" data-base-view-scroll>
    <section class="flex flex-col gap-3 bg-base-100 rounded-box shadow-md p-4">
        <div>
            <div class="text-xs opacity-60 tracking-wide uppercase">Sezony anime</div>
            <div class="text-sm opacity-80">Przegladaj sezonowe listy z Shinden i oznaczaj statusy.</div>
        </div>

        <div class="flex flex-wrap items-end gap-2">
            <label class="form-control w-32">
                <span class="label-text mb-1">Rok</span>
                <input
                    class="input input-bordered"
                    type="number"
                    min="2000"
                    max="2100"
                    bind:value={year}
                    disabled={season === "current"}
                />
            </label>

            <label class="form-control w-44">
                <span class="label-text mb-1">Sezon</span>
                <select class="select select-bordered" bind:value={season}>
                    {#each seasonOptions as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </label>

            <button
                class="btn btn-primary"
                disabled={loading}
                onclick={() => { void loadSeasonAnime(); }}
            >
                Wczytaj
            </button>

            <div class="ml-auto">
                <AnimeListViewToggle value={viewMode} onChange={setViewMode} />
            </div>
        </div>
    </section>

    {#if loading}
        <div class="flex w-full flex-col gap-4">
            <div class="skeleton h-24 w-full"></div>
            <div class="skeleton h-24 w-full"></div>
            <div class="skeleton h-24 w-full"></div>
        </div>
    {:else}
        <DiscoveryAnimeList
            items={result}
            heading="Anime sezonowe:"
            emptyLabel="Nie znaleziono anime dla wybranego sezonu."
            viewMode={viewMode}
        />
    {/if}
</div>
