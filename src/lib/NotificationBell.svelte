<script lang="ts">
    import { openAnimeTitle } from "$lib/titleNavigation";
    import { plannedEpisodeNotificationStore } from "$lib/plannedEpisodeNotificationStore.svelte";

    let open = $state(false);
    let notifications = $derived(plannedEpisodeNotificationStore.state.notifications);
    let unreadCount = $derived(notifications.filter((notification) => !notification.read).length);

    function handleToggle() {
        if (open) {
            plannedEpisodeNotificationStore.markRead();
        }
    }

    async function openNotification(titleId: number, name: string, imageUrl: string, seriesUrl: string) {
        open = false;
        await openAnimeTitle({
            titleId,
            name,
            imageUrl,
            seriesUrl,
            watchStatus: "plan",
            isFavourite: 0,
            totalEpisodes: null,
        });
    }

    function formatDetectedAt(timestamp: number) {
        return new Intl.DateTimeFormat("pl-PL", {
            dateStyle: "short",
            timeStyle: "short",
        }).format(new Date(timestamp));
    }
</script>

<details class="dropdown dropdown-end" bind:open ontoggle={handleToggle}>
    <summary
        class="btn btn-circle btn-sm relative"
        class:notification-pulse={unreadCount > 0}
        title="Powiadomienia"
        aria-label="Powiadomienia"
    >
        <svg class="size-[1.2em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <g stroke-linecap="round" stroke-linejoin="round" stroke-width="2" fill="none" stroke="currentColor">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
                <path d="M13.7 21a2 2 0 0 1-3.4 0"></path>
            </g>
        </svg>
        {#if unreadCount > 0}
            <span class="badge badge-primary badge-xs absolute -right-1 -top-1 min-w-4 px-1 text-[0.6rem]">
                {unreadCount > 99 ? "99+" : unreadCount}
            </span>
        {/if}
    </summary>

    <section class="dropdown-content z-50 mt-2 w-[min(24rem,calc(100vw-1rem))] rounded-box bg-base-200 p-2 shadow-xl" aria-label="Historia powiadomień">
        <header class="px-2 py-1.5 text-sm font-semibold">Powiadomienia</header>
        {#if notifications.length === 0}
            <p class="px-2 py-4 text-sm opacity-60">Brak nowych odcinków do pokazania.</p>
        {:else}
            <ul class="max-h-96 overflow-y-auto">
                {#each notifications.slice(0, 20) as notification (notification.id)}
                    <li>
                        <button
                            class="flex w-full items-center gap-3 rounded-box p-2 text-left hover:bg-base-300"
                            type="button"
                            onclick={() => { void openNotification(notification.titleId, notification.animeName, notification.imageUrl, notification.seriesUrl); }}
                        >
                            <img class="h-12 w-8 rounded object-cover" src={notification.imageUrl} alt="" />
                            <span class="min-w-0 flex-1">
                                <span class="block truncate text-sm font-medium">{notification.animeName}</span>
                                <span class="block truncate text-xs opacity-70">
                                    Odcinek {notification.episodeNo}: {notification.episodeTitle}
                                </span>
                                <span class="block text-xs opacity-50">{formatDetectedAt(notification.detectedAtMs)}</span>
                            </span>
                            {#if !notification.read}
                                <span class="badge badge-primary badge-xs" aria-label="nieprzeczytane"></span>
                            {/if}
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </section>
</details>

<style>
    .notification-pulse {
        animation: notification-pulse 2.4s ease-in-out infinite;
    }

    @keyframes notification-pulse {
        0%, 88%, 100% { transform: rotate(0); }
        91% { transform: rotate(-8deg); }
        94% { transform: rotate(8deg); }
        97% { transform: rotate(-5deg); }
    }

    @media (prefers-reduced-motion: reduce) {
        .notification-pulse {
            animation: none;
        }
    }
</style>
