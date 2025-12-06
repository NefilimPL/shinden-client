import type { Player } from "$lib/types";

export type SourcePreference = {
    id: string;
    enabled: boolean;
};

export type AutoDownloadSettings = {
    sources: SourcePreference[];
    copies: number;
    hours: { start: string; end: string };
    speedLimit: number;
    folder: string;
    enabled: boolean;
    language: "pl" | "en" | "other";
};

export type TrackedSeries = {
    url: string;
    title: string;
    addedAt: string;
};

export type DownloadHistoryEntry = {
    episodeLink: string;
    resolution: number;
    source: string;
    fileName: string;
    savedAt: string;
};

const SETTINGS_KEY = "autodownload-settings";
const TRACKED_KEY = "autodownload-series";
const HISTORY_KEY = "autodownload-history";

const defaultSources: SourcePreference[] = [
    "Cda",
    "Gdrive",
    "Mega",
    "Vk",
    "Dailymotion",
    "Youtube",
    "Sibnet",
    "Aparat",
    "Dood",
    "Default",
    "Hqq",
    "Mp4upload"
].map((id) => ({ id, enabled: true }));

const defaultSettings: AutoDownloadSettings = {
    sources: defaultSources,
    copies: 1,
    hours: { start: "00:00", end: "23:59" },
    speedLimit: 0,
    folder: "Shinden/Pobrane",
    enabled: false,
    language: "pl",
};

function safeParse<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch (e) {
        console.error("Failed to parse persisted data", e);
        return fallback;
    }
}

function persistSettings() {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(autoDownloadSettings));
}

function persistSeries() {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(TRACKED_KEY, JSON.stringify(trackedSeries));
}

function persistHistory() {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(downloadHistory));
}

function hydrateSettings(): AutoDownloadSettings {
    if (typeof localStorage === "undefined") return structuredClone(defaultSettings);
    const persisted = safeParse<AutoDownloadSettings>(localStorage.getItem(SETTINGS_KEY), structuredClone(defaultSettings));
    // ensure defaults for new fields
    if (!persisted.sources || persisted.sources.length === 0) {
        persisted.sources = structuredClone(defaultSources);
    }
    return {
        ...defaultSettings,
        ...persisted,
        sources: persisted.sources,
    };
}

function hydrateSeries(): TrackedSeries[] {
    if (typeof localStorage === "undefined") return [];
    return safeParse<TrackedSeries[]>(localStorage.getItem(TRACKED_KEY), []);
}

function hydrateHistory(): DownloadHistoryEntry[] {
    if (typeof localStorage === "undefined") return [];
    return safeParse<DownloadHistoryEntry[]>(localStorage.getItem(HISTORY_KEY), []);
}

export const autoDownloadSettings: AutoDownloadSettings = $state(hydrateSettings());
export const trackedSeries: TrackedSeries[] = $state(hydrateSeries());
export const downloadHistory: DownloadHistoryEntry[] = $state(hydrateHistory());

export function setCopyCount(count: number) {
    autoDownloadSettings.copies = Math.max(1, Math.min(10, Math.round(count)));
    persistSettings();
}

export function setHours(start: string, end: string) {
    autoDownloadSettings.hours = { start, end };
    persistSettings();
}

export function setSpeedLimit(limit: number) {
    autoDownloadSettings.speedLimit = Math.max(0, Math.round(limit));
    persistSettings();
}

export function setDownloadFolder(folder: string) {
    autoDownloadSettings.folder = folder.trim();
    persistSettings();
}

export function toggleAutodownload(enabled: boolean) {
    autoDownloadSettings.enabled = enabled;
    persistSettings();
}

export function setLanguage(lang: "pl" | "en" | "other") {
    autoDownloadSettings.language = lang;
    persistSettings();
}

export function setSourceEnabled(id: string, enabled: boolean) {
    const entry = autoDownloadSettings.sources.find((s) => s.id === id);
    if (entry) {
        entry.enabled = enabled;
    } else {
        autoDownloadSettings.sources.push({ id, enabled });
    }
    persistSettings();
}

export function moveSource(id: string, direction: -1 | 1) {
    const idx = autoDownloadSettings.sources.findIndex((s) => s.id === id);
    const target = idx + direction;
    if (idx === -1 || target < 0 || target >= autoDownloadSettings.sources.length) return;
    const [item] = autoDownloadSettings.sources.splice(idx, 1);
    autoDownloadSettings.sources.splice(target, 0, item);
    persistSettings();
}

export function toggleSeriesTracking(url: string, title: string) {
    const exists = trackedSeries.find((s) => s.url === url);
    if (exists) {
        const index = trackedSeries.indexOf(exists);
        trackedSeries.splice(index, 1);
    } else {
        trackedSeries.push({ url, title, addedAt: new Date().toISOString() });
    }
    persistSeries();
}

export function isSeriesTracked(url: string) {
    return trackedSeries.some((s) => s.url === url);
}

function parseResolution(resolution: string): number {
    const match = resolution?.match(/(\d{3,4})/);
    return match ? Number(match[1]) : 0;
}

export function resolutionValue(resolution: string): number {
    return parseResolution(resolution);
}

function preferredOrder(id: string): number {
    return autoDownloadSettings.sources.findIndex((s) => s.id === id && s.enabled);
}

function matchesLanguagePreference(player: Player): boolean {
    const lang = autoDownloadSettings.language;
    if (lang === "other") return true;
    const subs = player.lang_subs?.toLowerCase() ?? "";
    const audio = player.lang_audio?.toLowerCase() ?? "";
    if (lang === "pl") {
        return subs.includes("pl") || audio.includes("pl");
    }
    if (lang === "en") {
        return subs.includes("en") || audio.includes("en");
    }
    return true;
}

export function pickBestPlayer(players: Player[]): Player | null {
    const enabledSources = autoDownloadSettings.sources.filter((s) => s.enabled).map((s) => s.id);
    if (enabledSources.length === 0) return null;

    const filtered = players.filter((p) => enabledSources.includes(p.player) && matchesLanguagePreference(p));
    if (filtered.length === 0) return null;

    return filtered
        .map((p) => ({ ...p, resolutionValue: parseResolution(p.max_res), priority: preferredOrder(p.player) }))
        .sort((a, b) => {
            if (b.resolutionValue !== a.resolutionValue) return b.resolutionValue - a.resolutionValue;
            return a.priority - b.priority;
        })[0];
}

export function getLocalDownloads(episodeLink: string): DownloadHistoryEntry[] {
    return downloadHistory.filter((entry) => entry.episodeLink === episodeLink);
}

function highestResolutionForEpisode(link: string): number {
    const candidates = downloadHistory.filter((entry) => entry.episodeLink === link);
    if (candidates.length === 0) return 0;
    return Math.max(...candidates.map((entry) => entry.resolution));
}

export function shouldDownload(link: string, resolution: number): boolean {
    const highest = highestResolutionForEpisode(link);
    return resolution > highest;
}

export function recordDownload(link: string, resolution: number, source: string, fileName: string) {
    const sameEpisodeEntries = downloadHistory.filter((entry) => entry.episodeLink === link);
    const alreadyHasResolution = sameEpisodeEntries.some((entry) => entry.resolution === resolution);
    const highest = highestResolutionForEpisode(link);

    if (alreadyHasResolution && resolution <= highest) {
        return;
    }

    // Remove lower-quality duplicates when upgrading
    for (const entry of sameEpisodeEntries) {
        if (entry.resolution < resolution) {
            const idx = downloadHistory.indexOf(entry);
            downloadHistory.splice(idx, 1);
        }
    }

    downloadHistory.push({
        episodeLink: link,
        resolution,
        source,
        fileName,
        savedAt: new Date().toISOString(),
    });

    persistHistory();
}

export function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, "_");
}
