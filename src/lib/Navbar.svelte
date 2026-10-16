<script lang="ts">
    import LoadingButton from "$lib/LoadingButton.svelte";
    import AccountButton from "$lib/AccountButton.svelte";
    import NotificationBell from "$lib/NotificationBell.svelte";
    import UpdateButton from "$lib/logs/UpdateButton.svelte";
    import { onMount } from "svelte";
    import { globalStates } from "$lib/global.svelte";
    import { windowFullscreenIntent } from "$lib/windowFullscreenIntent";
    import ViewMenu from "$lib/ViewMenu.svelte";
    import { titleWorkspace } from "$lib/titleWorkspace.svelte";
    import { shouldStartWindowDrag } from "$lib/windowDrag";

    let isDark = $state(true);
    let pendingDrag: { pointerId: number; x: number; y: number; target: Element } | null = null;
    let dragGestureVersion = 0;

    $effect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        }
    });

    onMount(() => {
        const theme = document.documentElement.getAttribute('data-theme');
        isDark = theme === 'dark';
    });

    async function minimizeWindow() {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().minimize();
    }

    async function toggleFullscreenWindow() {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await windowFullscreenIntent.toggleWindowPresentation(getCurrentWindow(), titleWorkspace.fullscreenPresentation);
    }

    async function closeWindow() {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().close();
    }

    function prepareWindowDrag(event: PointerEvent) {
        if (!shouldStartWindowDrag(event)) return;
        const target = event.target as Element;
        target.setPointerCapture(event.pointerId);
        pendingDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, target };
    }

    function cancelWindowDrag() {
        dragGestureVersion += 1;
        const drag = pendingDrag;
        pendingDrag = null;
        if (drag?.target.hasPointerCapture(drag.pointerId)) {
            drag.target.releasePointerCapture(drag.pointerId);
        }
    }

    async function moveWindowDrag(event: PointerEvent) {
        if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - pendingDrag.x, event.clientY - pendingDrag.y) < 5) return;
        cancelWindowDrag();
        const gestureVersion = dragGestureVersion;
        const isPointerPressed = () => gestureVersion === dragGestureVersion;
        try {
            const { getCurrentWindow, cursorPosition } = await import("@tauri-apps/api/window");
            const cursor = await cursorPosition();
            if (!isPointerPressed()) return;
            await windowFullscreenIntent.startWindowDragging(getCurrentWindow(), cursor, isPointerPressed);
        } catch (error) {
            console.error("Nie udało się przeciągnąć okna", error);
        }
    }

    function handleWindowDoubleClick(event: MouseEvent) {
        if (shouldStartWindowDrag({
            button: event.button, defaultPrevented: event.defaultPrevented,
            isPrimary: true, pointerType: "mouse", target: event.target,
        })) {
            void toggleFullscreenWindow();
        }
    }
</script>

<svelte:window
    onpointerdown={prepareWindowDrag}
    onpointermove={(event) => { void moveWindowDrag(event); }}
    onpointerup={cancelWindowDrag}
    onpointercancel={cancelWindowDrag}
    onblur={cancelWindowDrag}
    ondblclick={handleWindowDoubleClick}
/>

<header
    data-window-drag-region
    class="navbar shadow-sm bg-base-300 h-16 gap-4 select-none touch-none"
>
    <div data-window-drag-region class="flex-1 font-[Orbitron] flex items-center gap-4">
        <a class="btn btn-ghost text-xl" href="/">Shinden Client 4</a>
        <LoadingButton />
    </div>
    <div class="flex-none">
        <ul class="menu menu-horizontal px-1 flex items-center">
            {#if globalStates.user.name}
                <li><a class="btn btn-ghost btn-sm" href="/watchlist">Ogladam</a></li>
            {/if}
            <li><NotificationBell /></li>
            <li><AccountButton/></li>
            <li><UpdateButton/></li>
        </ul>
    </div>
    <ViewMenu />

    <div>
        <input type="checkbox" bind:checked={isDark} class="toggle theme-controller" />
    </div>

    <div>
        <button class="btn btn-circle btn-sm" onclick={() => history.back()}>
            &#8592;
        </button>
        <button class="btn btn-circle btn-sm" onclick={() => { void minimizeWindow(); }}>
            —
        </button>
        <button class="btn btn-circle btn-sm" title="Pelny ekran" onclick={() => { void toggleFullscreenWindow(); }}>
            &#x25A1;
        </button>
        <button class="btn btn-circle btn-sm" onclick={() => { void closeWindow(); }}>
            &#x2715;
        </button>
    </div>
</header>
