<script lang="ts">
    import {getUserData, globalStates} from "$lib/global.svelte";
    import {onMount} from "svelte";
    import {log, LogLevel} from "$lib/logs/logs.svelte";

    let loading: boolean = $state(false);

    async function getLogin() {
        loading = true;
        try {
            await getUserData();
        } catch (error) {
            log(LogLevel.INFO, "User not logged in");
            loading = false;
        }
        loading = false;
    }

    onMount(async () => {
        await getLogin();
    });
</script>

<a href="/account">
{#if loading}
    <span class="loading loading-dots loading-md"></span>
    {:else }
        {#if globalStates.user.name}
            {globalStates.user.name}
            {#if globalStates.user.image_url}
                <div class="avatar">
                    <div class="w-8 rounded">

                            <img
                                    src={globalStates.user.image_url}
                                    alt="Avatar"
                            />
                    </div>
                </div>
            {:else}
                <div class="avatar avatar-placeholder">
                    <div class="bg-neutral text-neutral-content w-8 rounded">
                        <span class="text-sm">{globalStates.user.name[0]}</span>
                    </div>
                </div>
            {/if}
        {:else }
        Zaloguj się
    {/if}
{/if}
</a>


