<script lang="ts">
    import { titleWorkspace } from "$lib/titleWorkspace.svelte";
    import type { FullscreenPresentation, TitleWorkspaceLayout } from "$lib/titleWorkspace";

    const layoutOptions: Array<{ value: TitleWorkspaceLayout; label: string }> = [
        { value: "vertical", label: "Karty pionowe" },
        { value: "horizontal", label: "Karty poziome" },
        { value: "none", label: "Bez kart" },
    ];

    const fullscreenOptions: Array<{ value: FullscreenPresentation; label: string }> = [
        { value: "immersive", label: "Ukryj pasek zada?" },
        { value: "taskbar", label: "Poka? pasek zada?" },
    ];

    function setLayout(layout: TitleWorkspaceLayout) {
        titleWorkspace.setLayout(layout);
    }

    function setFullscreenPresentation(presentation: FullscreenPresentation) {
        titleWorkspace.setFullscreenPresentation(presentation);
    }
</script>

<details class="dropdown dropdown-end">
    <summary class="btn btn-circle btn-sm" title="Opcje widoku" aria-label="Opcje widoku">?</summary>
    <div class="dropdown-content z-50 mt-2 w-64 rounded-box bg-base-200 p-3 shadow-xl">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">Karty anime</p>
        <div class="flex flex-col gap-1">
            {#each layoutOptions as option}
                <button
                    type="button"
                    class="btn btn-sm justify-start"
                    class:btn-primary={titleWorkspace.layout === option.value}
                    aria-pressed={titleWorkspace.layout === option.value}
                    onclick={() => setLayout(option.value)}
                >
                    {option.label}
                </button>
            {/each}
        </div>

        <div class="my-3 border-t border-base-content/10"></div>
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">Pe?ny ekran</p>
        <div class="flex flex-col gap-1">
            {#each fullscreenOptions as option}
                <button
                    type="button"
                    class="btn btn-sm justify-start"
                    class:btn-primary={titleWorkspace.fullscreenPresentation === option.value}
                    aria-pressed={titleWorkspace.fullscreenPresentation === option.value}
                    onclick={() => setFullscreenPresentation(option.value)}
                >
                    {option.label}
                </button>
            {/each}
        </div>
    </div>
</details>
