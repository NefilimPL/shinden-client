<script lang="ts">
    import type { AnimeListViewMode } from "$lib/types";

    let {
        value,
        onChange,
    }: {
        value: AnimeListViewMode;
        onChange: (value: AnimeListViewMode) => void;
    } = $props();
</script>

<div class="join" aria-label="widok listy anime">
    <button
        type="button"
        class={`btn btn-sm join-item ${value === "list" ? "btn-active" : ""}`}
        aria-label="widok listy"
        title="Widok listy"
        onclick={() => onChange("list")}
    >
        <svg class="size-[1.1em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M8 6h13" />
                <path d="M8 12h13" />
                <path d="M8 18h13" />
                <path d="M3 6h.01" />
                <path d="M3 12h.01" />
                <path d="M3 18h.01" />
            </g>
        </svg>
    </button>
    <button
        type="button"
        class={`btn btn-sm join-item ${value === "grid" ? "btn-active" : ""}`}
        aria-label="widok kafelkow"
        title="Widok kafelkow"
        onclick={() => onChange("grid")}
    >
        <svg class="size-[1.1em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
            </g>
        </svg>
    </button>
</div>
