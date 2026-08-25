<script lang="ts">
    import type {
        AnimeDetails,
        AnimeRatingKey,
        AnimeWatchStatus,
        RelatedSeries,
    } from "$lib/types";
    import { animeStatusOptions } from "$lib/shindenProgress";
    import { openTitleOnAuxClick } from "$lib/titleOpenInteraction";

    let {
        details,
        watchStatus,
        canEdit,
        statusDisabled = false,
        ratingInProgress = null,
        onStatusChange,
        onRatingChange,
        onOpenRelated,
        onOpenRelatedInBackground,
        onOpenOnShinden,
    }: {
        details: AnimeDetails;
        watchStatus: AnimeWatchStatus;
        canEdit: boolean;
        statusDisabled?: boolean;
        ratingInProgress?: AnimeRatingKey | null;
        onStatusChange: (status: AnimeWatchStatus) => void;
        onRatingChange: (ratingType: AnimeRatingKey, value: number) => void;
        onOpenRelated: (series: RelatedSeries) => void;
        onOpenRelatedInBackground?: (series: RelatedSeries) => void;
        onOpenOnShinden: () => void;
    } = $props();

    const ratingLabels: Array<{ key: AnimeRatingKey; label: string }> = [
        { key: "story", label: "Fabula" },
        { key: "graphics", label: "Grafika" },
        { key: "music", label: "Muzyka" },
        { key: "characters", label: "Postacie" },
        { key: "overall", label: "Ogolna" },
    ];

    const ratingValues = Array.from({ length: 11 }, (_, index) => index);

    function communityRating(key: AnimeRatingKey) {
        return details.communityRating[key] || "-";
    }

    function handleStatusChange(event: Event) {
        onStatusChange((event.currentTarget as HTMLSelectElement).value as AnimeWatchStatus);
    }

    function handleRatingChange(event: Event, ratingType: AnimeRatingKey) {
        onRatingChange(ratingType, Number((event.currentTarget as HTMLSelectElement).value));
    }
</script>

<section class="bg-base-100 rounded-box shadow-md p-4">
    <div class="grid gap-4 lg:grid-cols-[minmax(180px,240px)_1fr]">
        <div class="flex flex-col gap-3">
            {#if details.imageUrl}
                <img
                    class="aspect-[2/3] w-full max-w-60 self-center rounded-lg object-cover shadow-lg"
                    src={details.imageUrl}
                    alt={details.name}
                />
            {/if}

            {#if canEdit}
                <label class="form-control w-full">
                    <span class="label-text mb-1">Status</span>
                    <select
                        class="select select-bordered select-sm w-full"
                        value={watchStatus || "no"}
                        disabled={statusDisabled}
                        onchange={handleStatusChange}
                    >
                        <option value="no">Brak statusu</option>
                        {#each animeStatusOptions as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                </label>
            {/if}
        </div>

        <div class="flex min-w-0 flex-col gap-4">
            <div>
                <div class="text-xs uppercase tracking-wide opacity-60">Anime</div>
                <h1 class="text-2xl font-bold">{details.name}</h1>
                <button type="button" class="btn btn-outline btn-sm mt-2" onclick={onOpenOnShinden}>
                    Otw?rz w Shinden
                </button>
                {#if details.alternativeTitles.length > 0}
                    <p class="mt-1 text-sm opacity-70">{details.alternativeTitles.join(", ")}</p>
                {/if}
            </div>

            {#if details.description}
                <p class="text-sm leading-6 opacity-90">{details.description}</p>
            {/if}

            {#if details.information.length > 0}
                <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {#each details.information as row}
                        <div class="rounded-lg bg-base-200 px-3 py-2">
                            <div class="text-[11px] uppercase opacity-60">{row.label}</div>
                            <div class="text-sm">{row.value || "-"}</div>
                        </div>
                    {/each}
                </div>
            {/if}

            {#if details.categories.length > 0}
                <div class="flex flex-col gap-3">
                    {#each details.categories as group}
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="w-32 shrink-0 text-xs uppercase opacity-60">{group.label}</span>
                            {#each group.items as item}
                                <span class="badge badge-outline">{item}</span>
                            {/each}
                        </div>
                    {/each}
                </div>
            {/if}

            <div class="grid gap-3 xl:grid-cols-[minmax(220px,280px)_1fr]">
                <section class="rounded-lg bg-base-200 p-3">
                    <div class="text-xs uppercase tracking-wide opacity-60">Oceny</div>
                    <div class="mt-1 flex items-end gap-2">
                        <span class="text-3xl font-bold">{details.communityRating.overall || "-"}</span>
                        <span class="pb-1 text-sm opacity-70">/10</span>
                    </div>
                    {#if details.communityRating.votes}
                        <div class="text-xs opacity-60">{details.communityRating.votes}</div>
                    {/if}
                    <div class="mt-3 flex flex-col gap-1 text-sm">
                        {#each ratingLabels.slice(0, 4) as rating}
                            <div class="flex justify-between gap-3">
                                <span>{rating.label}</span>
                                <span class="font-semibold">{communityRating(rating.key)}</span>
                            </div>
                        {/each}
                    </div>
                </section>

                {#if canEdit}
                    <section class="rounded-lg bg-base-200 p-3">
                        <div class="text-xs uppercase tracking-wide opacity-60">Moje oceny</div>
                        <div class="mt-3 grid gap-2 sm:grid-cols-2">
                            {#each ratingLabels as rating}
                                <label class="flex items-center justify-between gap-3">
                                    <span class="text-sm">{rating.label}</span>
                                    <select
                                        class="select select-bordered select-xs w-20"
                                        value={details.userRatings[rating.key]}
                                        disabled={ratingInProgress === rating.key}
                                        onchange={(event) => handleRatingChange(event, rating.key)}
                                    >
                                        {#each ratingValues as value}
                                            <option value={value}>{value}</option>
                                        {/each}
                                    </select>
                                </label>
                            {/each}
                        </div>
                    </section>
                {/if}
            </div>

            {#if details.relatedSeries.length > 0}
                <section>
                    <div class="mb-2 text-xs uppercase tracking-wide opacity-60">Powiazane serie</div>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {#each details.relatedSeries as series}
                            <button
                                type="button"
                                class="group flex min-w-0 flex-col overflow-hidden rounded-lg bg-base-200 text-left shadow-sm transition hover:bg-base-300"
                                onclick={() => onOpenRelated(series)}
                                onauxclick={(event) => openTitleOnAuxClick(event, () => onOpenRelatedInBackground?.(series))}
                            >
                                {#if series.imageUrl}
                                    <img
                                        class="aspect-[2/3] w-full object-cover"
                                        src={series.imageUrl}
                                        alt={series.name}
                                    />
                                {/if}
                                <span class="flex min-h-24 flex-col gap-1 p-2">
                                    <span class="line-clamp-2 text-sm font-semibold">{series.name}</span>
                                    <span class="text-xs opacity-60">{series.relation || series.titleType}</span>
                                </span>
                            </button>
                        {/each}
                    </div>
                </section>
            {/if}
        </div>
    </div>
</section>
