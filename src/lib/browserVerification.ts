export function needsBrowserVerification(error: unknown): boolean {
    return String(error).includes("SHINDEN_BROWSER_VERIFICATION_REQUIRED");
}

export async function invokeWithVerification<T>(
    operation: () => Promise<T>,
    requireVerification: () => void,
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (needsBrowserVerification(error)) requireVerification();
        throw error;
    }
}

let required = false;
const listeners = new Set<(required: boolean) => void>();

export function requireBrowserVerification(): void {
    required = true;
    for (const listener of listeners) listener(required);
}

export function subscribeBrowserVerification(listener: (required: boolean) => void): () => void {
    listeners.add(listener);
    listener(required);
    return () => { listeners.delete(listener); };
}

