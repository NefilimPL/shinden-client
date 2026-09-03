export type EmbeddedPlayerContainer = Pick<Element, "requestFullscreen">;

export type PlayerFullscreenDocument = {
    fullscreenElement: Element | null;
    exitFullscreen(): Promise<void>;
};

export function enableIframeFullscreen(iframeHtml: string): string {
    return iframeHtml.replace(/<iframe\b([^>]*)>/i, (match, attributes: string) => {
        const existingAllow = attributes.match(/\ballow=(['"])(.*?)\1/i);
        let updatedAttributes = attributes;

        if (existingAllow) {
            const [, quote, permissions] = existingAllow;
            updatedAttributes = attributes.replace(
                existingAllow[0],
                `allow=${quote}${fullscreenAllowedForAllPlayerOrigins(permissions)}${quote}`,
            );
        } else {
            updatedAttributes += ' allow="fullscreen *; autoplay; encrypted-media"';
        }

        if (!/\ballowfullscreen\b/i.test(updatedAttributes)) {
            updatedAttributes += " allowfullscreen";
        }

        return `<iframe${updatedAttributes}>`;
    });
}

export async function requestEmbeddedPlayerFullscreen(container: EmbeddedPlayerContainer) {
    await container.requestFullscreen();
    return true;
}

export async function exitEmbeddedPlayerFullscreen(
    fullscreenDocument: PlayerFullscreenDocument,
    container: Element,
) {
    if (fullscreenDocument.fullscreenElement !== container) {
        return false;
    }

    await fullscreenDocument.exitFullscreen();
    return true;
}

function fullscreenAllowedForAllPlayerOrigins(permissions: string) {
    let hasFullscreenPermission = false;
    const normalizedPermissions = permissions
        .split(";")
        .map((permission) => permission.trim())
        .filter(Boolean)
        .flatMap((permission) => {
            if (!/^fullscreen(?:\s|$)/i.test(permission)) {
                return [permission];
            }

            if (hasFullscreenPermission) {
                return [];
            }

            hasFullscreenPermission = true;
            return ["fullscreen *"];
        });

    if (!hasFullscreenPermission) {
        normalizedPermissions.push("fullscreen *");
    }

    return normalizedPermissions.join("; ");
}
