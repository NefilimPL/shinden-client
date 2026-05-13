export const GITHUB_RELEASES_API_URL = "https://api.github.com/repos/NefilimPL/shinden-client/releases?per_page=100";
export const UPDATE_PROGRESS_EVENT = "shinden-update-progress";

export interface GitHubReleaseAsset {
    name: string;
    browser_download_url: string;
}

export interface GitHubRelease {
    tag_name: string;
    name?: string | null;
    prerelease?: boolean;
    published_at?: string | null;
    assets?: GitHubReleaseAsset[];
}

export interface UpdateReleaseVersion {
    tagName: string;
    version: string;
    name: string;
    manifestUrl: string;
    publishedAt: string | null;
    prerelease: boolean;
}

export interface UpdateProgressPayload {
    version: string;
    downloaded: number;
    total: number | null;
    percent: number | null;
    finished: boolean;
}

export function extractVersionFromTag(tagName: string): string | null {
    const version = tagName.trim().replace(/^app-v/i, "").replace(/^v/i, "");

    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
        return null;
    }

    return version;
}

function versionParts(version: string): number[] {
    return version
        .split(/[+-]/, 1)[0]
        .split(".")
        .map((part) => Number.parseInt(part, 10));
}

export function compareVersions(left: string, right: string): number {
    const leftParts = versionParts(left);
    const rightParts = versionParts(right);

    for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
        const leftPart = leftParts[index] ?? 0;
        const rightPart = rightParts[index] ?? 0;

        if (leftPart !== rightPart) {
            return leftPart - rightPart;
        }
    }

    return 0;
}

export function mapGitHubReleasesToUpdateVersions(releases: GitHubRelease[]): UpdateReleaseVersion[] {
    return releases
        .map((release) => {
            const version = extractVersionFromTag(release.tag_name);
            const manifest = release.assets?.find((asset) => asset.name === "latest.json");

            if (!version || !manifest) {
                return null;
            }

            return {
                tagName: release.tag_name,
                version,
                name: release.name || release.tag_name,
                manifestUrl: manifest.browser_download_url,
                publishedAt: release.published_at ?? null,
                prerelease: Boolean(release.prerelease)
            };
        })
        .filter((release): release is UpdateReleaseVersion => release !== null)
        .sort((left, right) => compareVersions(right.version, left.version));
}

export function selectDefaultReleaseVersion(
    versions: UpdateReleaseVersion[],
    currentVersion: string
): UpdateReleaseVersion | null {
    return versions.find((version) => compareVersions(version.version, currentVersion) > 0) ?? versions[0] ?? null;
}
