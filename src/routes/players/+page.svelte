<script lang="ts">
    import {onMount} from "svelte";
    import {invoke} from "@tauri-apps/api/core";
    import type {Player} from "$lib/types";
    import {globalStates, LoadingState, params} from "$lib/global.svelte";
    import {log, LogLevel} from "$lib/logs/logs.svelte";
    import {goto} from "$app/navigation";
    import Empty from "$lib/Empty.svelte";
    import {builtinPlayers, dangerousPlayers, safePlayers} from "$lib/playerSafety.svelte";
    import PlayerListElement from "$lib/PlayerListElement.svelte";
    import Secure from "$lib/badges/Secure.svelte";
    import BuiltIn from "$lib/badges/BuiltIn.svelte";
    import Players from "$lib/Players.svelte";
    import Unsecure from "$lib/badges/Unsecure.svelte";
    import Unknown from "$lib/badges/Unknown.svelte";
    import {
        autoDownloadSettings,
        getLocalDownloads,
        pickBestPlayer,
        recordDownload,
        resolutionValue,
        sanitizeFileName,
        shouldDownload
    } from "$lib/autodownload.svelte";

    let players: Player[] = $state([]);
    let grouped: Record<string, Player[]> = $state({});

    let safe: string[] = $state([]);
    let unsafe: string[] = $state([]);
    let unknown: string[] = $state([]);
    let builtIn: string[] = $state([]);

    let recommended: Player | null = $state(null);
    let localCopies: ReturnType<typeof getLocalDownloads> = $state([]);
    let infoMessage: string = $state("");

    $effect(() => {
        const preferenceSignature = `${autoDownloadSettings.language}|${autoDownloadSettings.sources.map((s) => `${s.id}-${s.enabled}`).join(",")}`;
        void preferenceSignature;
        if (players.length > 0) {
            recommended = pickBestPlayer(players);
        }
    });

    onMount(async ()=>{
       try {
           globalStates.loadingState = LoadingState.LOADING;
           log(LogLevel.INFO, "Loading players");

           if(!params.playersUrl) {
               await goto("/");
               log(LogLevel.WARNING, "No parameters provided; probably refreshing page");
               return;
           }

           players = await invoke("get_players", {
               url: params.playersUrl
           });

           grouped = players.reduce<Record<string, Player[]>>((acc, p) => {
               if (!acc[p.player]) {
                   acc[p.player] = [];
               }
               acc[p.player].push(p);
               return acc;
           }, {});

           recommended = pickBestPlayer(players);
           localCopies = getLocalDownloads(params.playersUrl);

           globalStates.loadingState = LoadingState.OK;
           log(LogLevel.SUCCESS, "Loaded players successfully");

           for (let groupedKey in grouped) {
               console.log(groupedKey);
               if(safePlayers.includes(groupedKey)) {
                   safe.push(groupedKey)
                   console.log(`SafePlayers: ${safePlayers}`);
               } else if(dangerousPlayers.includes(groupedKey)) {
                    unsafe.push(groupedKey)
               } else if(builtinPlayers.includes(groupedKey)) {
                   builtIn.push(groupedKey)
               } else {
                   unknown.push(groupedKey)
               }
           }

        } catch (e) {
            globalStates.loadingState = LoadingState.ERROR;
            log(LogLevel.ERROR, `Error loading players: ${e}`);
        }
     });

    function markDownloaded(player: Player) {
        const resolution = resolutionValue(player.max_res);
        if (!shouldDownload(params.playersUrl, resolution)) {
            infoMessage = "Ta wersja została już pobrana lub jest niższej jakości.";
            return;
        }

        const safeSeries = sanitizeFileName(params.animeName || params.seriesUrl || "anime");
        const safeFolder = (autoDownloadSettings.folder || "Pobrane").split("/").map((part) => sanitizeFileName(part)).join("/");
        const safeFileName = sanitizeFileName(`${safeSeries}_${player.max_res}_${player.player}.mp4`);
        const fileName = `${safeFolder}/${safeSeries}/${safeFileName}`;
        recordDownload(params.playersUrl, resolution, player.player, fileName);
        localCopies = getLocalDownloads(params.playersUrl);
        infoMessage = "Dodano zapis pobranego pliku do sekcji 'lokalne'.";
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
    {#if players.length > 0}
        <div class="p-4 flex flex-col gap-4">
            <div class="bg-base-200 p-4 rounded-lg shadow-sm flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-semibold text-lg">Rekomendacja autopobierania</p>
                        <p class="text-sm opacity-70">Preferowane źródła: {autoDownloadSettings.sources.filter((s)=>s.enabled).map((s)=>s.id).join(", ")} · Język: {autoDownloadSettings.language}</p>
                    </div>
                    {#if recommended}
                        <button class="btn btn-primary" onclick={() => markDownloaded(recommended!)}>Zapisz do lokalnych</button>
                    {:else}
                        <div class="badge badge-error">Brak dopasowania</div>
                    {/if}
                </div>
                {#if recommended}
                    <div class="flex flex-wrap gap-2 text-sm">
                        <div class="badge">{recommended.player}</div>
                        <div class="badge">{recommended.max_res}</div>
                        <div class="badge">Napisy: {recommended.lang_subs}</div>
                        <div class="badge">Audio: {recommended.lang_audio}</div>
                        <div class={`badge ${autoDownloadSettings.enabled ? "badge-success" : "badge-outline"}`}>{autoDownloadSettings.enabled ? "Autopobieranie włączone" : "Autopobieranie wyłączone"}</div>
                        <div class="badge">Limit: {autoDownloadSettings.speedLimit === 0 ? "bez limitu" : `${autoDownloadSettings.speedLimit} KB/s`}</div>
                    </div>
                    <p class="text-xs opacity-70">System wybiera najwyższą dostępną rozdzielczość (np. 720p zamiast 480p) i aktualizuje pobrania gdy pojawi się lepsza wersja.</p>
                {:else}
                    <p class="text-sm opacity-70">Brak źródła spełniającego ustawione preferencje językowe lub wyłączone źródła.</p>
                {/if}
                {#if infoMessage}
                    <div class="alert alert-info text-sm">{infoMessage}</div>
                {/if}
            </div>

            {#if localCopies.length > 0}
                <div class="bg-base-200 p-4 rounded-lg shadow-sm">
                    <div class="flex items-center justify-between mb-2">
                        <p class="font-semibold">Źródło: lokalne</p>
                        <div class="badge">{localCopies.length} kopii</div>
                    </div>
                    <ul class="list flex flex-col gap-2">
                        {#each localCopies as copy}
                            <li class="list-row flex items-center justify-between">
                                <div class="list-col-grow">
                                    <p class="font-semibold">{copy.fileName}</p>
                                    <p class="text-xs opacity-60">{copy.source} · {copy.resolution}p</p>
                                    <p class="text-xs opacity-60">Zapisano: {new Date(copy.savedAt).toLocaleString()}</p>
                                </div>
                                <div class="badge">Lokalne</div>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}
        </div>
        <Players keys={builtIn} group={grouped}>
            <BuiltIn /> <Secure />
        </Players>
        <Players keys={safe} group={grouped}>
            <Secure />
        </Players>
        <Players keys={unknown} group={grouped}>
            <Unknown />
        </Players>
        <Players keys={unsafe} group={grouped}>
            <Unsecure />
        </Players>
    {:else}
    <Empty />
    {/if}
{/if}
