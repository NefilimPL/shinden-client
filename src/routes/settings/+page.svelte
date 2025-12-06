<script lang="ts">
    import {
        autoDownloadSettings,
        moveSource,
        setCopyCount,
        setDownloadFolder,
        setHours,
        setLanguage,
        setSourceEnabled,
        setSpeedLimit,
        toggleAutodownload,
        trackedSeries,
        toggleSeriesTracking
    } from "$lib/autodownload.svelte";

    let windowStart: string = $state(autoDownloadSettings.hours.start);
    let windowEnd: string = $state(autoDownloadSettings.hours.end);
    let folder: string = $state(autoDownloadSettings.folder);

    $effect(() => {
        windowStart = autoDownloadSettings.hours.start;
        windowEnd = autoDownloadSettings.hours.end;
        folder = autoDownloadSettings.folder;
    });

    function updateWindow() {
        setHours(windowStart, windowEnd);
    }

    function updateFolder() {
        setDownloadFolder(folder);
    }
</script>

<div class="p-4 flex flex-col gap-4">
    <div class="flex items-center justify-between bg-base-200 p-4 rounded-lg shadow-sm">
        <div>
            <p class="font-semibold text-lg">Autopobieranie</p>
            <p class="text-sm opacity-70">Włącz lub wyłącz całkowicie harmonogram pobierania.</p>
        </div>
        <input type="checkbox" class="toggle" bind:checked={autoDownloadSettings.enabled} on:change={(e) => toggleAutodownload((e.currentTarget as HTMLInputElement).checked)}>
    </div>

    <div class="bg-base-200 p-4 rounded-lg shadow-sm">
        <div class="flex items-center gap-2 mb-2">
            <p class="font-semibold text-lg">Źródła i priorytety</p>
            <div class="badge badge-info">zmień kolejność</div>
        </div>
        <p class="text-sm opacity-70 mb-3">Ustal kolejność preferowanych źródeł oraz możliwość włączenia/wyłączenia poszczególnych hostów.</p>
        <div class="grid md:grid-cols-2 gap-2">
            {#each autoDownloadSettings.sources as source, index}
                <div class="border rounded-lg p-3 flex items-center justify-between gap-2 bg-base-100">
                    <div class="flex flex-col">
                        <p class="font-semibold">{source.id}</p>
                        <p class="text-xs opacity-70">Pozycja #{index + 1}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="join">
                            <button class="btn btn-sm join-item" disabled={index === 0} on:click={() => moveSource(source.id, -1)}>▲</button>
                            <button class="btn btn-sm join-item" disabled={index === autoDownloadSettings.sources.length - 1} on:click={() => moveSource(source.id, 1)}>▼</button>
                        </div>
                        <input type="checkbox" class="toggle" bind:checked={source.enabled} on:change={(e) => setSourceEnabled(source.id, (e.currentTarget as HTMLInputElement).checked)}>
                    </div>
                </div>
            {/each}
        </div>
    </div>

    <div class="grid md:grid-cols-2 gap-4">
        <div class="bg-base-200 p-4 rounded-lg shadow-sm flex flex-col gap-2">
            <p class="font-semibold">Liczba kopii</p>
            <p class="text-sm opacity-70">Ile kopii pobranej wersji zachować.</p>
            <input type="number" class="input input-bordered" min="1" max="10" bind:value={autoDownloadSettings.copies} on:change={(e) => setCopyCount(Number((e.currentTarget as HTMLInputElement).value))}>
        </div>

        <div class="bg-base-200 p-4 rounded-lg shadow-sm flex flex-col gap-2">
            <p class="font-semibold">Limit prędkości (KB/s)</p>
            <p class="text-sm opacity-70">0 oznacza brak limitu.</p>
            <input type="number" class="input input-bordered" min="0" bind:value={autoDownloadSettings.speedLimit} on:change={(e) => setSpeedLimit(Number((e.currentTarget as HTMLInputElement).value))}>
        </div>
    </div>

    <div class="grid md:grid-cols-2 gap-4">
        <div class="bg-base-200 p-4 rounded-lg shadow-sm flex flex-col gap-2">
            <p class="font-semibold">Godziny autopobierania</p>
            <p class="text-sm opacity-70">Okno czasowe w którym nowe odcinki będą pobierane.</p>
            <div class="join">
                <input type="time" class="input input-bordered join-item" bind:value={windowStart} on:change={updateWindow}>
                <input type="time" class="input input-bordered join-item" bind:value={windowEnd} on:change={updateWindow}>
            </div>
        </div>

        <div class="bg-base-200 p-4 rounded-lg shadow-sm flex flex-col gap-2">
            <p class="font-semibold">Folder docelowy</p>
            <p class="text-sm opacity-70">Lokalizacja gdzie zapisywane są kopie offline.</p>
            <input type="text" class="input input-bordered" bind:value={folder} on:change={updateFolder}>
        </div>
    </div>

    <div class="bg-base-200 p-4 rounded-lg shadow-sm flex flex-col gap-2">
        <p class="font-semibold">Język autopobierania</p>
        <p class="text-sm opacity-70">Wybierz priorytet języka napisów lub audio.</p>
        <select class="select select-bordered w-full" bind:value={autoDownloadSettings.language} on:change={(e) => setLanguage((e.currentTarget as HTMLSelectElement).value as "pl" | "en" | "other")}>
            <option value="pl">Napisy PL / Audio PL</option>
            <option value="en">Napisy EN / Audio EN</option>
            <option value="other">Inne</option>
        </select>
    </div>

    <div class="bg-base-200 p-4 rounded-lg shadow-sm flex flex-col gap-2">
        <div class="flex items-center justify-between">
            <p class="font-semibold">Serie oznaczone do autopobierania</p>
            <div class="badge">{trackedSeries.length}</div>
        </div>
        {#if trackedSeries.length === 0}
            <p class="text-sm opacity-70">Nie dodano jeszcze żadnego anime.</p>
        {:else}
            <ul class="list flex flex-col gap-2">
                {#each trackedSeries as series}
                    <li class="list-row flex items-center justify-between">
                        <div class="list-col-grow">
                            <p class="font-semibold">{series.title}</p>
                            <p class="text-xs opacity-60">{series.url}</p>
                            <p class="text-xs opacity-60">Dodano: {new Date(series.addedAt).toLocaleString()}</p>
                        </div>
                        <button class="btn btn-sm" on:click={() => toggleSeriesTracking(series.url, series.title)}>Usuń</button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</div>
