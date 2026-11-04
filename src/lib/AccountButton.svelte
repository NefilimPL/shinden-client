<script lang="ts">
    import {globalStates} from "$lib/global.svelte";
</script>

<a href="/account" title={globalStates.library.authenticated ? "Sesja Shinden aktywna" : "Profil lokalny"}>
    {globalStates.library.activeProfile.name}
    <span class="badge badge-sm">{globalStates.library.authenticated ? "Shinden" : "lokalnie"}</span>
</a>
