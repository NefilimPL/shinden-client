<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import type { DiscoveryAnime, SeasonOption, SeasonSlug } from "$lib/types";
    import { globalStates, LoadingState } from "$lib/global.svelte";
    import { log, LogLevel } from "$lib/logs/logs.svelte";
    import DiscoveryAnimeList from "$lib/DiscoveryAnimeList.svelte";

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

    onMount(() => {
        void loadSeasonAnime();
    });

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

<div class="flex h-full w-full flex-col gap-3 overflow-y-scroll p-4">
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
        />
    {/if}
</div>
