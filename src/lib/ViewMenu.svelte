<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
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
    let closeToTray = $state(false);

    onMount(() => {
        void loadCloseToTrayPreference();
    });

    function setLayout(layout: TitleWorkspaceLayout) {
        titleWorkspace.setLayout(layout);
    }

    function setFullscreenPresentation(presentation: FullscreenPresentation) {
        titleWorkspace.setFullscreenPresentation(presentation);
    }

    async function loadCloseToTrayPreference() {
        try {
            closeToTray = await invoke<boolean>("get_close_to_tray_enabled");
        } catch {
            closeToTray = false;
        }
    }

    async function saveCloseToTrayPreference() {
        const selected = closeToTray;
        try {
            await invoke("set_close_to_tray_enabled", { enabled: selected });
        } catch {
            closeToTray = !selected;
        }
    }
</script>

<details class="dropdown dropdown-end">
    <summary class="btn btn-circle btn-sm" title="Opcje widoku" aria-label="Opcje widoku">
        <svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2" fill="none" stroke="currentColor">
                <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z"></path>
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 20 7.1l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z"></path>
            </g>
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
                    onclick={() => { setFullscreenPresentation(option.value); }}
                >
                    {option.label}
                </button>
            {/each}
        </div>

        <div class="my-3 border-t border-base-content/10"></div>
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">Aplikacja</p>
        <label class="flex items-center justify-between gap-3 text-sm">
            <span>Zamykaj do zasobnika systemowego</span>
            <input
                type="checkbox"
                class="toggle toggle-sm toggle-primary"
                bind:checked={closeToTray}
                onchange={() => { void saveCloseToTrayPreference(); }}
            />
        </label>
    </div>
</details>
