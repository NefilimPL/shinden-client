export function enableIframeFullscreen(iframeHtml: string): string {
    return iframeHtml.replace(/<iframe\b([^>]*)>/i, (match, attributes: string) => {
        const existingAllow = attributes.match(/\ballow=(['"])(.*?)\1/i);
        let updatedAttributes = attributes;

        if (existingAllow) {
            const [, quote, permissions] = existingAllow;
            if (!permissions.toLowerCase().includes("fullscreen")) {
                updatedAttributes = attributes.replace(existingAllow[0], `allow=${quote}${permissions}; fullscreen${quote}`);
            }
        } else {
            updatedAttributes += ' allow="fullscreen; autoplay; encrypted-media"';
        }

        if (!/\ballowfullscreen\b/i.test(updatedAttributes)) {
            updatedAttributes += " allowfullscreen";
        }

        return `<iframe${updatedAttributes}>`;
    });
}
