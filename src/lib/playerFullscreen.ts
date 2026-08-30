export type EmbeddedPlayerFrame = Pick<Element, "requestFullscreen">;

export type EmbeddedPlayerContainer = {
    querySelector(selector: "iframe"): EmbeddedPlayerFrame | null;
};

export async function requestEmbeddedPlayerFullscreen(container: EmbeddedPlayerContainer) {
    const iframe = container.querySelector("iframe");
    if (!iframe) {
        return false;
    }

    await iframe.requestFullscreen();
    return true;
}
