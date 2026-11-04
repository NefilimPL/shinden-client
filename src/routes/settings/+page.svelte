<script lang="ts">
    import { invoke } from "$lib/shindenInvoke";
    import { applyLibraryState, globalStates, getUserData } from "$lib/global.svelte";
    import type { LibraryState } from "$lib/librarySession";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    type PublicUser = { id: number; name: string; url: string; imageUrl: string | null };
    type ImportSummary = { profileId: string; source: PublicUser; found: number; added: number };
    let query = $state("");
    let users: PublicUser[] = $state([]);
    let selectedProfile = $state(globalStates.library.activeProfile.id);
    let busy = $state(false);
    let error = $state("");
    let message = $state("");
    onMount(() => { void getUserData().catch(e => { error = String(e); }); });

    async function preferences(networkEnabled: boolean, importEnabled: boolean) {
        busy = true; error = ""; message = "";
        try {
            applyLibraryState(await invoke<LibraryState>("set_library_preferences", { networkEnabled, importEnabled }));
            users = [];
        } catch (e) { error = String(e); }
        finally { busy = false; }
    }
    async function switchProfile() {
        busy = true; error = "";
        try {
            const next = await invoke<LibraryState>("select_library_profile", { profileId: selectedProfile });
            applyLibraryState(next);
            await goto("/account/lists");
        } catch (e) { error = String(e); }
        finally { busy = false; }
    }
    async function searchUsers(event: SubmitEvent) {
        event.preventDefault(); busy = true; error = ""; message = ""; users = [];
        try {
            users = await invoke<PublicUser[]>("search_public_users", { query });
            if (users.length === 0) message = "Nie znaleziono użytkowników.";
        } catch (e) { error = String(e); await getUserData(); }
        finally { busy = false; }
    }
    async function importUser(user: PublicUser) {
        busy = true; error = ""; message = "";
        try {
            const summary = await invoke<ImportSummary>("import_public_user", { profileUrl: user.url });
            message = `Import ukończony. Znaleziono ${summary.found} pozycji, dodano ${summary.added}. Istniejące lokalne statusy i postęp zostały zachowane.`;
        } catch (e) { error = String(e); await getUserData(); }
        finally { busy = false; }
    }
</script>

<main class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
    <div>
        <h1 class="text-3xl font-bold">Ustawienia biblioteki</h1>
        <p class="mt-2 opacity-70">Aktywny profil: <strong>{globalStates.library.activeProfile.name}</strong>. Statusy, oceny i obejrzane odcinki zapisujesz lokalnie.</p>
    </div>

    <section class="card border border-base-content/10 bg-base-200 p-5">
        <h2 class="mb-3 text-xl font-semibold">Profil lokalny</h2>
        <p class="mb-3 text-sm opacity-70">Każdy profil ma oddzielną bibliotekę. Zapisane profile są dostępne bez logowania do Shinden. Wylogowanie przełącza na Guest.</p>
        <div class="flex flex-wrap gap-3">
            <select class="select select-bordered flex-1" aria-label="Profil lokalny" bind:value={selectedProfile} disabled={busy}>
                {#each globalStates.library.profiles as profile (profile.id)}
                    <option value={profile.id}>{profile.name}{profile.publicProfileId ? ` (konto ${profile.publicProfileId})` : " (gość)"}</option>
                {/each}
            </select>
            <button class="btn" disabled={busy || selectedProfile === globalStates.library.activeProfile.id} onclick={switchProfile}>Przełącz profil</button>
        </div>
        <p class="mt-4 text-xs opacity-60">Plik bazy danych — kopię wykonuj po zamknięciu aplikacji:</p>
        <code class="mt-1 break-all text-xs">{globalStates.library.databasePath}</code>
    </section>

    <section class="card gap-4 border border-base-content/10 bg-base-200 p-5">
        <h2 class="text-xl font-semibold">Połączenia z Shinden</h2>
        <label class="flex items-center justify-between gap-4">
            <span>Zezwalaj na połączenia z Shinden</span>
            <input type="checkbox" class="toggle toggle-primary" checked={globalStates.library.networkEnabled} disabled={busy}
                onchange={(event) => preferences(event.currentTarget.checked, globalStates.library.importEnabled)} />
        </label>
        <p class="text-sm opacity-70">Domyślnie aplikacja korzysta z zapisanych danych. Włączenie połączeń pozwala pobierać nowe anime, odcinki i grafiki. Zmiany w bibliotece nadal pozostają lokalne.</p>
        <p class="text-sm opacity-70">Połączenia ujawniają serwisowi Twój adres IP. Logowanie i dostęp do materiałów wymagających konta pozwalają powiązać te żądania z kontem. Lokalna baza nie zapewnia anonimowości podczas korzystania z sieci.</p>
        <a class="link w-fit" href="/account">Opcjonalne logowanie do Shinden</a>
    </section>

    <section class="card gap-4 border border-base-content/10 bg-base-200 p-5">
        <h2 class="text-xl font-semibold">Import danych użytkownika</h2>
        <label class="flex items-center justify-between gap-4">
            <span>Włącz import publicznych list</span>
            <input type="checkbox" class="toggle toggle-primary" checked={globalStates.library.importEnabled} disabled={busy}
                onchange={(event) => preferences(globalStates.library.networkEnabled, event.currentTarget.checked)} />
        </label>
        <p class="text-sm opacity-70">Import kopiuje dostępne publicznie listy i liczniki obejrzanych odcinków do profilu <strong>{globalStates.library.activeProfile.name}</strong>. Nie wymaga logowania na konto źródłowe. Istniejące pozycje zachowują lokalne zmiany.</p>
        <p class="text-sm opacity-70">Opisy, okładki i liczby odcinków zapisujemy z listy. Szczegóły, kategorie i linki odcinków zapisujemy po ich otwarciu lub ręcznym pobraniu z biblioteki. Pliki filmów nie są pobierane do bazy.</p>
        {#if !globalStates.library.networkEnabled}
            <p class="text-sm">Aby wyszukać profil i rozpocząć import, włącz połączenia z Shinden.</p>
        {/if}
        <form class="flex flex-wrap gap-3" onsubmit={searchUsers}>
            <input class="input input-bordered min-w-0 flex-1" aria-label="Nick lub adres profilu Shinden" placeholder="Nick lub https://shinden.pl/user/458357-nefilimpl"
                bind:value={query} disabled={busy || !globalStates.library.importEnabled || !globalStates.library.networkEnabled} />
            <button class="btn btn-primary" type="submit" disabled={busy || !query.trim() || !globalStates.library.importEnabled || !globalStates.library.networkEnabled}>Wyszukaj profil</button>
        </form>
        {#each users as user (user.id)}
            <div class="flex items-center justify-between gap-3 rounded-box bg-base-100 p-3">
                <div class="min-w-0"><strong>{user.name}</strong><p class="break-all text-xs opacity-60">{user.url}</p></div>
                <button class="btn btn-primary btn-sm" disabled={busy} onclick={() => importUser(user)}>Importuj do {globalStates.library.activeProfile.name}</button>
            </div>
        {/each}
        {#if busy}<p role="status">Trwa operacja…</p>{/if}
        {#if busy && globalStates.library.networkEnabled}<button class="btn btn-warning" onclick={() => preferences(false, false)}>Przerwij połączenia</button>{/if}
        {#if message}<p class="alert alert-info" role="status">{message}</p>{/if}
        {#if error}<p class="alert alert-error break-all" role="alert">{error}</p>{/if}
    </section>
</main>
