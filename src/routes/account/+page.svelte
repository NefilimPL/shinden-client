<script lang="ts">
    import { shindenImageSrc } from "$lib/shindenImageSrc";
    import {invoke} from "$lib/shindenInvoke";
    import {log, LogLevel} from "$lib/logs/logs.svelte";
    import {getUserData, globalStates, LoadingState} from "$lib/global.svelte";

    let loginOpened = $state(false);
    let loginBusy = $state(false);
    let loginError = $state("");
    async function openLogin() {
        loginBusy = true;
        loginError = "";
        try {
            await invoke("open_shinden_login");
            loginOpened = true;
        } catch (error) {
            loginError = String(error);
        } finally {
            loginBusy = false;
        }
    }
    async function handleLogin() {
        loginBusy = true;
        loginError = "";
        try {
            log(LogLevel.INFO, "Trying to log in");
            globalStates.loadingState = LoadingState.LOADING;
            await invoke("complete_shinden_login");
            await getUserData();
            globalStates.loadingState = LoadingState.OK;
            log(LogLevel.SUCCESS, `Successfully logged in`);
        } catch (error) {
            loginError = String(error);
            globalStates.loadingState = LoadingState.ERROR;
            log(LogLevel.ERROR, `Could not log in: ${error}`);
        } finally {
            loginBusy = false;
        }
    }

    async function logout() {
        try {
            log(LogLevel.INFO, "Trying to log out");
            globalStates.loadingState = LoadingState.LOADING;
            await invoke("logout");
            await getUserData();
        } catch (error) {
            globalStates.loadingState = LoadingState.ERROR;
            loginError = String(error);
            log(LogLevel.ERROR, `Could not log out: ${error}`);
            return;
        }

        globalStates.user.name = null;
        globalStates.user.image_url = null;

        globalStates.loadingState = LoadingState.OK;
        log(LogLevel.SUCCESS, "Log out successfully");
    }
</script>

<div class="hero bg-base-100 h-full">
    <div class="absolute right-6 top-20 text-right text-sm">
        <p>Biblioteka lokalna: <strong>{globalStates.library.activeProfile.name}</strong></p>
        <a class="link" href="/settings">Profile i import danych</a>
    </div>
    {#if !globalStates.user.name}
        <div class="hero-content flex-col">
            <div class="text-center py-6">
                <h1 class="text-5xl font-bold">Logowanie</h1>
                <p>
                    Logowanie jest opcjonalne i może być potrzebne do materiałów wymagających konta. Listy i postęp działają również jako Guest.
                </p>
                <p>Nie masz konta? <a class="link" target="_blank" href="https://shinden.pl/user/0/register">Zarejestruj się</a></p>
            </div>
            <div class="card bg-base-100 w-full max-w-sm shrink-0 shadow-2xl">
                <div class="card-body gap-4">
                    <p>Zaloguj się loginem lub e-mailem i hasłem w oknie Shinden. Następnie wróć tutaj i potwierdź logowanie.</p>
                    <p class="text-sm">Po zalogowaniu Shinden rozpoznaje konto. Zmiany oglądania nadal zapisujesz wyłącznie lokalnie.</p>
                    {#if !globalStates.library.networkEnabled}<a class="link" href="/settings">Włącz połączenia z Shinden w ustawieniach</a>{/if}
                    <button class="btn btn-neutral" disabled={loginBusy || !globalStates.library.networkEnabled} onclick={openLogin}>
                        {loginOpened ? "Otwórz ponownie okno Shinden" : "Zaloguj w oknie Shinden"}
                    </button>
                    {#if loginOpened}
                        <button class="btn btn-primary" disabled={loginBusy} onclick={handleLogin}>Zalogowano — sprawdź konto</button>
                    {/if}
                    {#if loginError}<p class="text-error" role="alert">{loginError}</p>{/if}
                </div>
            </div>
        </div>
        {:else}
            <div class="hero-content flex-col">
                {#if globalStates.user.image_url}
                    <img
                            src={shindenImageSrc(globalStates.user.image_url)}
                            class="max-w-sm rounded-lg shadow-2xl"
                            alt="Avatar"
                    />
                {:else}
                    <div class="avatar avatar-placeholder">
                        <div class="bg-neutral text-neutral-content w-24 rounded">
                            <span class="text-lg">{globalStates.user.name[0]}</span>
                        </div>
                    </div>
                {/if}
                <div class="text-center">
                    <h1 class="text-5xl font-bold">Zalogowano jako {globalStates.user.name}</h1>
                    <p class="py-6">
                        W razie problemów z dostępem do listy odcinków - zaloguj się ponownie.
                    </p>
                    <div class="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                        <a class="btn btn-primary" href="/account/lists">Moje listy anime</a>
                        <button class="btn btn-neutral" onclick={logout}>Wyloguj się</button>
                    </div>
                    {#if loginError}<p class="text-error" role="alert">{loginError}</p>{/if}
                </div>
            </div>
    {/if}
</div>
