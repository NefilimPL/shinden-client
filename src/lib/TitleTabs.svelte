<script lang="ts">
    import { titleTabPresentation } from "$lib/titleTabPresentation";
    import { baseViewLabel } from "$lib/baseViewState";
    import { activateBaseTab, activateTitleTab, closeTitleTab } from "$lib/titleNavigation";
    import { createTitleTabCloseController } from "$lib/titleTabCloseInteraction";
    import { titleWorkspace } from "$lib/titleWorkspace.svelte";

    let rail = $state<HTMLElement | null>(null);
    let compactLabels = $state(false);
    const titleTabCloseController = createTitleTabCloseController();

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

{#if titleWorkspace.layout !== "none"}
    <nav
        class={`flex shrink-0 gap-1 bg-base-200 p-1 ${titleWorkspace.layout === "vertical" ? "w-20 flex-col overflow-y-auto border-r border-base-300" : "h-14 w-full flex-row overflow-x-auto border-b border-base-300"}`}
        use:observeRail
        aria-label="Otwarte anime"
    >
        <div class={`relative shrink-0 ${titleWorkspace.layout === "vertical" ? "w-18" : "w-52"}`}>
            <button
                type="button"
                class={`btn btn-ghost min-h-0 w-full justify-start overflow-hidden ${titleWorkspace.layout === "vertical" ? "h-16" : "h-12"}`}
                class:btn-active={titleWorkspace.activeTab.kind === "base"}
                title={baseViewLabel(titleWorkspace.baseView)}
                aria-label={`Otwórz ${baseViewLabel(titleWorkspace.baseView)}`}
                onclick={() => { void activateBaseTab(); }}
            >
                <span class="truncate text-left text-xs">{baseViewLabel(titleWorkspace.baseView)}</span>
            </button>
        </div>
        {#each titleWorkspace.tabs as tab (tab.titleId)}
            {@const presentation = titleTabPresentation(
                titleWorkspace.layout,
                tab.titleId === titleWorkspace.activeTitleId,
                compactLabels,
            )}
            <div class={`relative shrink-0 ${titleWorkspace.layout === "vertical" ? "w-18" : !presentation.showLabel ? "w-14" : "w-52"}`}>
                <button
                    type="button"
                    class={`btn btn-ghost min-h-0 w-full justify-start overflow-hidden pr-7 ${titleWorkspace.layout === "vertical" ? "h-16" : "h-12"}`}
                    class:btn-active={tab.titleId === titleWorkspace.activeTitleId}
                    title={tab.name}
                    aria-label={`Otw\u00f3rz ${tab.name}`}
                    onclick={() => { void activateTitleTab(tab.titleId); }}
                >
                    <img class={`${titleWorkspace.layout === "vertical" ? "h-12 w-12" : "h-8 w-8"} shrink-0 rounded object-cover`} src={tab.imageUrl} alt={tab.name} />
                    {#if presentation.showLabel}
                        <span class="truncate text-left text-xs">{tab.name}</span>
                    {/if}
                </button>
                {#if presentation.showClose}
                    <button
                    type="button"
                    class="btn btn-circle btn-ghost btn-xs absolute right-0 top-1/2 z-10 -translate-y-1/2"
                    aria-label={`Zamknij ${tab.name}`}
                    title={`Zamknij ${tab.name}`}
                    onclick={(event) => { void titleTabCloseController.close(event, tab.titleId, () => closeTitleTab(tab.titleId)); }}
                    >
                        <svg class="size-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.5"></path>
                        </svg>
                    </button>
                {/if}
            </div>
        {/each}
    </nav>
{/if}
