<script lang="ts">
    import { onMount } from "svelte";
    import { checkUpdateOnStartup, dismissStartupUpdate, status } from "$lib/updater.svelte";

    let dialog: HTMLDialogElement | undefined = $state();

    onMount(() => {
        void checkUpdateOnStartup();
    });

    $effect(() => {
        if (!dialog) return;
        if (status.startupUpdate && !dialog.open) {
            dialog.showModal();
        } else if (!status.startupUpdate && dialog.open) {
            dialog.close();
        }
    });
</script>

<dialog
    bind:this={dialog}
    class="modal"
    aria-labelledby="update-notification-title"
    aria-describedby="update-notification-description"
    onclose={dismissStartupUpdate}
    oncancel={dismissStartupUpdate}
>
    <div class="modal-box flex max-h-[85vh] max-w-2xl flex-col gap-4">
        <h2 id="update-notification-title" class="text-xl font-semibold">Dostępna aktualizacja</h2>
        {#if status.startupUpdate}
            <p id="update-notification-description">
                Dostępna jest wersja <strong>{status.startupUpdate.version}</strong>.
                Twoja wersja: {status.startupUpdate.currentVersion}.
            </p>
            <section class="min-h-0 overflow-y-auto rounded-box bg-base-200 p-4" aria-label="Lista zmian">
                <h3 class="mb-2 font-semibold">Co nowego?</h3>
                <p class="whitespace-pre-wrap break-words text-sm">{status.startupUpdate.notes || "Autor wydania nie udostępnił listy zmian."}</p>
            </section>
        {/if}
        <div class="modal-action mt-0 flex-wrap">
            <button type="button" class="btn btn-ghost" onclick={dismissStartupUpdate}>Później</button>
            <a class="btn btn-primary" href="/info" onclick={dismissStartupUpdate}>Przejdź do aktualizacji</a>
        </div>
    </div>
</dialog>
