import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { check } from "@tauri-apps/plugin-updater";
import { log, LogLevel } from "$lib/logs/logs.svelte";
import {
    GITHUB_RELEASES_API_URL,
    mapGitHubReleasesToUpdateVersions,
    selectDefaultReleaseVersion,
    UPDATE_PROGRESS_EVENT,
    type GitHubRelease,
    type UpdateProgressPayload,
    type UpdateReleaseVersion
} from "$lib/updateReleases";

export enum UpdateState {
    CHECKING,
    ERROR,
    AVAILABLE,
    NOT_AVAILABLE,
    DOWNLOADING,
    INSTALLED,
    UNKNOWN
}

export const status: {
    updateState: UpdateState;
    statusMessage: string;
    errorMessage: string | null;
    availableVersions: UpdateReleaseVersion[];
    selectedVersion: UpdateReleaseVersion | null;
    versionsLoading: boolean;
    downloadedBytes: number;
    totalBytes: number | null;
    progressPercent: number | null;
} = $state({
    updateState: UpdateState.UNKNOWN,
    statusMessage: getStatusMessage(UpdateState.UNKNOWN),
    errorMessage: null,
    availableVersions: [],
    selectedVersion: null,
    versionsLoading: false,
    downloadedBytes: 0,
    totalBytes: null,
    progressPercent: null
});

let progressUnlisten: Promise<UnlistenFn> | null = null;

export function getStatusMessage(state: UpdateState) {
    switch (state) {
        case UpdateState.CHECKING:
            return "Sprawdzanie aktualizacji";
        case UpdateState.ERROR:
            return "Wystąpił błąd podczas aktualizacji";
        case UpdateState.AVAILABLE:
            return "Dostępna jest nowa wersja";
        case UpdateState.NOT_AVAILABLE:
            return "Brak dostępnych aktualizacji";
        case UpdateState.DOWNLOADING:
            return "Pobieranie aktualizacji";
        case UpdateState.INSTALLED:
            return "Zainstalowano aktualizację. Uruchamianie ponownie";
        case UpdateState.UNKNOWN:
            return "Nie sprawdzano aktualizacji";
        default:
            throw new Error("Unknown state");
    }
}

export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function errorToMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

function clearProgress() {
    status.downloadedBytes = 0;
    status.totalBytes = null;
    status.progressPercent = null;
}

export async function setUpdateState(state: UpdateState, message?: string | null) {
    status.updateState = state;
    status.statusMessage = message ?? getStatusMessage(state);
}

async function ensureProgressListener() {
    if (progressUnlisten) {
        return;
    }

    progressUnlisten = listen<UpdateProgressPayload>(UPDATE_PROGRESS_EVENT, (event) => {
        const payload = event.payload;
        status.downloadedBytes = payload.downloaded;
        status.totalBytes = payload.total;
        status.progressPercent = payload.percent;
        status.updateState = payload.finished ? UpdateState.INSTALLED : UpdateState.DOWNLOADING;

        if (payload.finished) {
            status.statusMessage = getStatusMessage(UpdateState.INSTALLED);
            return;
        }

        const bytes = payload.total
            ? `${formatBytes(payload.downloaded)} / ${formatBytes(payload.total)}`
            : formatBytes(payload.downloaded);
        const percent = payload.percent !== null ? ` (${Math.round(payload.percent)}%)` : "";
        status.statusMessage = `Pobieranie wersji ${payload.version}: ${bytes}${percent}`;
    });
}

export async function loadAvailableVersions(currentVersion?: string): Promise<UpdateReleaseVersion[]> {
    status.versionsLoading = true;
    status.errorMessage = null;

    try {
        const response = await fetch(GITHUB_RELEASES_API_URL, {
            headers: {
                Accept: "application/vnd.github+json"
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub zwrócił status HTTP ${response.status}`);
        }

        const releases = (await response.json()) as GitHubRelease[];
        const versions = mapGitHubReleasesToUpdateVersions(releases);
        status.availableVersions = versions;
        status.selectedVersion = selectDefaultReleaseVersion(versions, currentVersion ?? "0.0.0");
        return versions;
    } catch (error) {
        const message = errorToMessage(error);
        status.errorMessage = `Nie udało się pobrać listy wersji: ${message}`;
        log(LogLevel.ERROR, status.errorMessage);
        throw error;
    } finally {
        status.versionsLoading = false;
    }
}

export function selectUpdateVersion(tagName: string) {
    status.selectedVersion =
        status.availableVersions.find((version) => version.tagName === tagName) ?? status.selectedVersion;
}

export async function checkUpdate(): Promise<boolean> {
    clearProgress();
    status.errorMessage = null;
    await setUpdateState(UpdateState.CHECKING);

    try {
        const update = await check();
        if (update) {
            await setUpdateState(UpdateState.AVAILABLE, `Dostępna jest wersja ${update.version}`);
            return true;
        }

        await setUpdateState(UpdateState.NOT_AVAILABLE);
        return false;
    } catch (error) {
        const message = errorToMessage(error);
        status.errorMessage = message;
        await setUpdateState(UpdateState.ERROR);
        throw error;
    }
}

export async function getAndinstallUpdate(selectedVersion = status.selectedVersion) {
    if (!selectedVersion) {
        status.errorMessage = "Nie wybrano wersji do pobrania.";
        await setUpdateState(UpdateState.ERROR);
        throw new Error(status.errorMessage);
    }

    clearProgress();
    status.errorMessage = null;
    await ensureProgressListener();
    await setUpdateState(UpdateState.CHECKING, `Przygotowywanie wersji ${selectedVersion.displayName}`);

    try {
        log(LogLevel.INFO, `Installing update ${selectedVersion.displayName}`);
        await invoke("install_update_from_manifest", { tag: selectedVersion.tagName });
    } catch (error) {
        const message = errorToMessage(error);
        status.errorMessage = message;
        await setUpdateState(UpdateState.ERROR);
        log(LogLevel.ERROR, `Update ${selectedVersion.displayName} failed: ${message}`);
        throw error;
    }
}

