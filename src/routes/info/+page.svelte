<script lang="ts">
    import { app } from "@tauri-apps/api";
    import { onMount } from "svelte";
    import {
        checkUpdate,
        formatBytes,
        getAndinstallUpdate,
        loadAvailableVersions,
        selectUpdateVersion,
        status,
        UpdateState
    } from "$lib/updater.svelte";
    import { globalStates, LoadingState } from "$lib/global.svelte";
    import { log, LogLevel } from "$lib/logs/logs.svelte";

    let version: string | undefined = $state();
    let selectedTag = $state("");
    let isBusy = $derived(status.updateState === UpdateState.CHECKING || status.updateState === UpdateState.DOWNLOADING);

    $effect(() => {
        selectedTag = status.selectedVersion?.tagName ?? "";
    });

    onMount(async () => {
        version = await app.getVersion();
        await refreshVersions();
    });

    async function refreshVersions() {
        try {
            await loadAvailableVersions(version);
        } catch {
            globalStates.loadingState = LoadingState.ERROR;
        }
    }

    async function checkForUpdates() {
        globalStates.loadingState = LoadingState.LOADING;
        log(LogLevel.INFO, "Checking for updates...");

        try {
            const hasUpdate = await checkUpdate();
            await loadAvailableVersions(version);

            if (hasUpdate) {
                log(LogLevel.SUCCESS, "New update available!");
            } else {
                log(LogLevel.INFO, "No updates available!");
            }
            globalStates.loadingState = LoadingState.OK;
        } catch (error) {
            globalStates.loadingState = LoadingState.ERROR;
            log(LogLevel.ERROR, `${error}`);
        }
    }

    async function installUpdate() {
        try {
            await getAndinstallUpdate(status.selectedVersion);
        } catch (error) {
            globalStates.loadingState = LoadingState.ERROR;
            log(LogLevel.ERROR, `${error}`);
        }
    }

    function onVersionChange(event: Event) {
        const target = event.currentTarget as HTMLSelectElement;
        selectUpdateVersion(target.value);
    }
</script>

<div class="flex flex-col items-center gap-3 px-4 py-2">
    <h2 class="text-center text-lg">Aktualizacje</h2>

    <div class="badge badge-dash w-full max-w-xl justify-center whitespace-normal py-3 text-center">
        {status.statusMessage}
    </div>

    {#if status.errorMessage}
        <div class="alert alert-error w-full max-w-xl items-start text-sm">
            <span>{status.errorMessage}</span>
        </div>
    {/if}

    {#if status.progressPercent !== null || status.updateState === UpdateState.DOWNLOADING}
        <div class="flex w-full max-w-xl flex-col gap-1">
            <progress class="progress progress-primary w-full" max="100" value={status.progressPercent ?? 0}></progress>
            <div class="text-center text-xs opacity-70">
                {formatBytes(status.downloadedBytes)}
                {#if status.totalBytes}
                    / {formatBytes(status.totalBytes)}
                {/if}
                {#if status.progressPercent !== null}
                    ({Math.round(status.progressPercent)}%)
                {/if}
            </div>
        </div>
    {/if}

    <div class="text-xs opacity-70">
        Aktualizacje z <a href="https://github.com/NefilimPL/shinden-client/releases/latest" class="link" target="_blank">NefilimPL/shinden-client</a>
    </div>

    <div class="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
        <select
            class="select w-full"
            bind:value={selectedTag}
            disabled={status.versionsLoading || isBusy || status.availableVersions.length === 0}
            onchange={onVersionChange}
        >
            {#if status.availableVersions.length === 0}
                <option value="">Brak wersji do pobrania</option>
            {:else}
                {#each status.availableVersions as release}
                    <option value={release.tagName}>
                        {release.displayName}{release.version === version ? " - obecna" : ""}{release.prerelease ? " - prerelease" : ""}
                    </option>
                {/each}
            {/if}
        </select>
        <button class="btn" disabled={status.versionsLoading || isBusy} onclick={refreshVersions}>
            {status.versionsLoading ? "Odświeżanie" : "Odśwież listę"}
        </button>
    </div>

    <div class="join">
        <button class="btn join-item" disabled={isBusy} onclick={checkForUpdates}>Sprawdź dostępność</button>
        <button class="btn join-item btn-primary" disabled={isBusy || !status.selectedVersion} onclick={installUpdate}>
            Pobierz i zainstaluj
        </button>
    </div>
</div>

<div class="divider px-4"></div>

<div class="hero">
    <div class="hero-overlay bg-base-100/90"></div>
    <div class="hero-content text-center">
        <div class="flex max-w-md flex-col items-center gap-2">
            <div>
                <h1 class="text-5xl font-bold text-nowrap font-[Orbitron]">Shinden Client 4</h1>
                <h2>v.{version}</h2>
                <p class="font-mono">
                    MIT License
                </p>
            </div>
            <div>
                <div class="font-mono">Thanks to</div>
                <div class="flex flex-row justify-around gap-10 p-4">
                    <a href="https://vitejs.dev" target="_blank" class="drop-shadow-sm drop-shadow-base-content">
                        <img src="/vite.svg" class="w-14" alt="Vite Logo" />
                    </a>
                    <a href="https://tauri.app" target="_blank" class="drop-shadow-sm drop-shadow-base-content">
                        <img src="/tauri.svg" class="w-14" alt="Tauri Logo" />
                    </a>
                    <a href="https://kit.svelte.dev" target="_blank" class="drop-shadow-sm drop-shadow-base-content">
                        <img src="/svelte.svg" class="w-14" alt="SvelteKit Logo" />
                    </a>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="divider px-4"></div>
<div class="bg-base-200 p-4 rounded-lg mx-auto w-fit text-center shadow-md">
    Made with ♥ by
    <a href="https://github.com/Tsugumik" class="link" target="_blank">Błażej Drozd</a>
    &
    <a href="https://github.com/NefilimPL" class="link" target="_blank">NefilimPL</a>
</div>
