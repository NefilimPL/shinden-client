<script lang="ts">
    import { status, UpdateState } from "$lib/updater.svelte";
</script>

<a href="/info">
    Aktualizacje
    {#if status.updateState === UpdateState.AVAILABLE && status.availableUpdate}
        <span aria-label="Dostępna aktualizacja" class="status status-success"></span>
    {/if}
</a>
