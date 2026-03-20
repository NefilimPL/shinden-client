<script lang="ts">
    import type {Player} from "$lib/types";
    import {params} from "$lib/global.svelte";
    import {goto} from "$app/navigation";

    let { player, iterator } : {
        player: Player, iterator: number
    } = $props();

    async function handleButton(playerId: string) {
        params.playerId = playerId;
        await goto(`/watching`);
    }
</script>
        <li class="list-row items-center hover:bg-base-content/5 transition-colors group">
            <div class="text-3xl font-black opacity-10 tabular-nums w-12 text-center group-hover:opacity-30 transition-opacity italic">{iterator+1}</div>
            <div class="list-col-grow flex-1 py-3">
                <div class="text-sm font-semibold flex items-center gap-2">
                    <span class="opacity-50">Sub:</span> {player.lang_subs}
                </div>
                <div class="text-xs opacity-70 flex items-center gap-2">
                    <span class="opacity-50">Audio:</span> {player.lang_audio}
                </div>
            </div>
            <div class="text-2xl font-black opacity-40 tabular-nums px-4 text-center font-[Orbitron]">{player.max_res}</div>
            <div class="pr-3">
                <button class="btn btn-circle btn-ghost group-hover:btn-accent group-hover:shadow-md transition-all" aria-label="play" onclick={async() => {await handleButton(player.online_id)}}>
                    <svg class="size-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.14v14.72a.5.5 0 0 0 .73.44l11-7.36a.5.5 0 0 0 0-.88l-11-7.36a.5.5 0 0 0-.73.44z"/></svg>
                </button>
            </div>
        </li>