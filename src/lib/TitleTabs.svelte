<script lang="ts">
    import { titleTabPresentation } from "$lib/titleTabPresentation";
    import { activateTitleTab, closeTitleTab } from "$lib/titleNavigation";
    import { titleWorkspace } from "$lib/titleWorkspace.svelte";

    let rail = $state<HTMLElement | null>(null);
    let compactLabels = $state(false);

    function updateCompactLabels() {
        compactLabels = (rail?.clientWidth ?? Infinity) < titleWorkspace.tabs.length * 180;
    }

    function observeRail(node: HTMLElement) {
        rail = node;
        const observer = new ResizeObserver(updateCompactLabels);
        observer.observe(node);
        updateCompactLabels();

        return {
            destroy() {
                observer.disconnect();
                if (rail === node) {
                    rail = null;
                }
            },
        };
    }

    $effect(() => {
        titleWorkspace.tabs.length;
        updateCompactLabels();
    });
</script>

{#if titleWorkspace.layout !== "none" && titleWorkspace.tabs.length > 0}
    <nav
        class={`z-10 flex shrink-0 gap-1 bg-base-200 p-1 ${titleWorkspace.layout === "vertical" ? "w-16 flex-col overflow-y-auto border-r border-base-300" : "h-14 w-full flex-row overflow-x-auto border-b border-base-300"}`}
        use:observeRail
        aria-label="Otwarte anime"
    >
        {#each titleWorkspace.tabs as tab (tab.titleId)}
            {@const presentation = titleTabPresentation(
                titleWorkspace.layout,
                tab.titleId === titleWorkspace.activeTitleId,
                compactLabels,
            )}
            <div class={`relative shrink-0 ${titleWorkspace.layout === "vertical" || !presentation.showLabel ? "w-14" : "w-52"}`}>
                <button
                    type="button"
                    class="btn btn-ghost h-12 min-h-0 w-full justify-start overflow-hidden pr-7"
                    class:btn-active={tab.titleId === titleWorkspace.activeTitleId}
                    title={tab.name}
                    aria-label={`Otw?rz ${tab.name}`}
                    onclick={() => { void activateTitleTab(tab.titleId); }}
                >
                    <img class="h-8 w-8 shrink-0 rounded object-cover" src={tab.imageUrl} alt={tab.name} />
                    {#if presentation.showLabel}
                        <span class="truncate text-left text-xs">{tab.name}</span>
                    {/if}
                </button>
                <button
                    type="button"
                    class="btn btn-circle btn-ghost btn-xs absolute right-0 top-1/2 -translate-y-1/2"
                    aria-label={`Zamknij ${tab.name}`}
                    title={`Zamknij ${tab.name}`}
                    onclick={(event) => { event.stopPropagation(); void closeTitleTab(tab.titleId); }}
                >
                    ?
                </button>
            </div>
        {/each}
    </nav>
{/if}
