<script lang="ts">
    import { titleWorkspace } from "$lib/titleWorkspace.svelte";
    import type { FullscreenPresentation, TitleWorkspaceLayout } from "$lib/titleWorkspace";

    const layoutOptions: Array<{ value: TitleWorkspaceLayout; label: string }> = [
        { value: "vertical", label: "Karty pionowe" },
        { value: "horizontal", label: "Karty poziome" },
        { value: "none", label: "Bez kart" },
    ];

    const fullscreenOptions: Array<{ value: FullscreenPresentation; label: string }> = [
        { value: "immersive", label: "Ukryj pasek zada\u0144" },
        { value: "taskbar", label: "Poka\u017c pasek zada\u0144" },
    ];

    function setLayout(layout: TitleWorkspaceLayout) {
        titleWorkspace.setLayout(layout);
    }

    function setFullscreenPresentation(presentation: FullscreenPresentation) {
        titleWorkspace.setFullscreenPresentation(presentation);
    }
</script>

<details class="dropdown dropdown-end">
    <summary class="btn btn-circle btn-sm" title="Opcje widoku" aria-label="Opcje widoku">
        <svg class="size-[1.1em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="none" stroke="currentColor" stroke-width="1.8"></path>
            <path d="m19.4 15 .1.1 1.3 1-2 3.4-1.6-.6a7.6 7.6 0 0 1-1.7 1l-.2 1.7h-4l-.2-1.7a7.6 7.6 0 0 1-1.7-1l-1.6.6-2-3.4 1.3-1 .1-.1a7 7 0 0 1 0-2l-.1-.1-1.3-1 2-3.4 1.6.6a7.6 7.6 0 0 1 1.7-1l1.6-.6 2 3.4-1.3 1-.1.1a7 7 0 0 1 0 2Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.8"></path>
        </svg>
    </summary>
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
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">Pe&#322;ny ekran</p>
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
