import type {AnimeWatchStatus} from "$lib/types";

export const animeStatusOptions: Array<{ value: AnimeWatchStatus; label: string }> = [
    { value: "in progress", label: "Ogladam" },
    { value: "completed", label: "Obejrzane" },
    { value: "skip", label: "Pomijam" },
    { value: "hold", label: "Wstrzymane" },
    { value: "dropped", label: "Porzucone" },
    { value: "plan", label: "Planuje" },
];

export function animeStatusLabel(status: string) {
    return animeStatusOptions.find((option) => option.value === status)?.label ?? "Brak";
}

export function titleIdFromSeriesUrl(url: string): number | null {
    const match = url.match(/\/(?:series|titles)\/(\d+)/);
    if (!match) {
        return null;
    }

    const titleId = Number(match[1]);
    return Number.isFinite(titleId) ? titleId : null;
}

export function formatShindenCreatedTime(date: Date) {
    const pad = (value: number) => String(value).padStart(2, "0");

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join("-") + " " + [
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join(":");
}
