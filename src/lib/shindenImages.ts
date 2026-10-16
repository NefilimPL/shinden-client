export function normalizeShindenImageUrl(source: string | null | undefined): string | null {
    if (!source?.trim()) return null;
    try {
        const url = new URL(source.trim(), "https://shinden.pl/");
        const trustedHost = url.hostname === "shinden.pl"
            || url.hostname.endsWith(".shinden.pl")
            || url.hostname === "cdn.shinden.eu";
        if (!trustedHost || !["http:", "https:"].includes(url.protocol)
            || url.username || url.password || url.port) return null;
        url.protocol = "https:";
        return url.href;
    } catch {
        return null;
    }
}

export function shindenImageRequestUrl(source: string, base: string, token: string): string {
    // Application assets such as /hero.png must stay on the application origin.
    if (!/^(https?:)?\/\//i.test(source)) return source;
    const url = normalizeShindenImageUrl(source);
    return url ? (token ? `${base}?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}` : "") : source;
}
