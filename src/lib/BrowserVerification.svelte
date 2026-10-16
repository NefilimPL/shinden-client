<script lang="ts">
    import { invoke } from "$lib/shindenInvoke";
    import { requireBrowserVerification, subscribeBrowserVerification } from "$lib/browserVerification";
    import { listen } from "@tauri-apps/api/event";
    import { onMount } from "svelte";

    let required = $state(false);
    let opened = $state(false);
    let busy = $state(false);
    let errorMessage = $state("");
    onMount(() => {
        const unsubscribe = subscribeBrowserVerification(value => { required = value; });
        let disposed = false;
        let unlisten: (() => void) | undefined;
        void listen("shinden-browser-verification-required", requireBrowserVerification).then(stop => {
            if (disposed) stop();
            else unlisten = stop;
        });
        return () => { disposed = true; unsubscribe(); unlisten?.(); };
    });

    async function openVerification() {
        busy = true;
        errorMessage = "";
        try {
            await invoke("open_shinden_verification");
            opened = true;
        } catch (error) {
            errorMessage = `Nie udało się otworzyć okna weryfikacji: ${error}`;
        } finally {
            busy = false;
        }
    }

    async function finishVerification() {
        busy = true;
        errorMessage = "";
        try {
            await invoke("complete_shinden_verification");
            window.location.reload();
        } catch (error) {
            errorMessage = `Nie udało się potwierdzić połączenia: ${error}`;
        } finally {
            busy = false;
        }
    }
</script>

{#if required}
    <aside class="bg-base-200 border-b border-warning p-4" aria-label="Weryfikacja połączenia z Shinden">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div role="status">
                <p class="font-semibold">Shinden wymaga weryfikacji Cloudflare</p>
                <p class="text-sm">Otwórz okno weryfikacji i poczekaj, aż pojawi się strona Shinden. Następnie wróć tutaj i sprawdź połączenie.</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <button class="btn btn-warning btn-sm" disabled={busy} onclick={openVerification}>
                    {opened ? "Otwórz ponownie" : "Zweryfikuj połączenie"}
                </button>
                {#if opened}
                    <button class="btn btn-primary btn-sm" disabled={busy} onclick={finishVerification}>
                        {busy ? "Sprawdzanie…" : "Weryfikacja zakończona — sprawdź połączenie"}
                    </button>
                {/if}
            </div>
        </div>
        {#if errorMessage}
            <p class="mt-2 text-sm text-error" role="alert">{errorMessage}</p>
        {/if}
    </aside>
{/if}
