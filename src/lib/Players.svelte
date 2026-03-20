<script lang="ts">
    import type {Player} from "$lib/types";
    import PlayerListElement from "$lib/PlayerListElement.svelte";

    let { children, keys, group } : { children: any, keys: string[], group: Record<string, Player[]>} = $props();

</script>

{#if keys.length > 0}
<div class="flex flex-col gap-2 mb-8 px-4">
    <div class="flex items-center gap-4 px-2 mb-2">
        <div class="flex items-center gap-2">
            {@render children()}
        </div>
        <div class="h-px flex-1 bg-base-content/10"></div>
        <div class="text-xs font-mono font-bold text-base-content/40 uppercase tracking-widest">{keys.length} Groups</div>
    </div>

    <div class="grid grid-cols-1 gap-6">
        {#each keys as playerKey}
            <div class="card bg-base-200/50 border border-base-content/5 shadow-sm overflow-hidden">
                <div class="card-title px-5 py-3 bg-base-300 flex items-center justify-between border-b border-base-content/5">
                    <span class="text-sm font-bold font-[Orbitron] tracking-wider">{playerKey}</span>
                </div>
                <div class="card-body p-0">
                    <ul class="list bg-transparent divide-y divide-base-content/5">
                        {#each group[playerKey] as player, i}
                            <PlayerListElement player={player} iterator={i}/>
                        {/each}
                    </ul>
                </div>
            </div>
        {/each}
    </div>
</div>
{/if}

