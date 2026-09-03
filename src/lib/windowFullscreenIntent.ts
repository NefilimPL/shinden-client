import type { FullscreenPresentation } from "$lib/titleWorkspace";

export type FullscreenWindow = {
    setFullscreen(fullscreen: boolean): Promise<void>;
    isFullscreen(): Promise<boolean>;
};

export type TaskbarPresentationWindow = FullscreenWindow & {
    isMaximized(): Promise<boolean>;
    maximize(): Promise<void>;
    unmaximize(): Promise<void>;
};

export function createWindowFullscreenIntent() {
    let intendedFullscreen = false;
    let fullscreenIntentVersion = 0;
    let windowOperation = Promise.resolve();

    function queueWindowOperation<T>(operation: () => Promise<T>): Promise<T> {
        const queuedOperation = windowOperation.then(operation, operation);
        windowOperation = queuedOperation.then(
            () => undefined,
            () => undefined,
        );
        return queuedOperation;
    }

    async function toggleWindowFullscreen(appWindow: FullscreenWindow) {
        const intentVersion = ++fullscreenIntentVersion;

        await queueWindowOperation(async () => {
            const nextFullscreen = !(await appWindow.isFullscreen());
            if (intentVersion !== fullscreenIntentVersion) {
                return;
            }

            intendedFullscreen = nextFullscreen;
            await appWindow.setFullscreen(nextFullscreen);
        });
    }

    return {
        setIntendedFullscreen(fullscreen: boolean) {
            intendedFullscreen = fullscreen;
            fullscreenIntentVersion += 1;
        },

        isWindowFullscreenIntended() {
            return intendedFullscreen;
        },

        toggleWindowFullscreen,

        async toggleWindowPresentation(
            appWindow: TaskbarPresentationWindow,
            presentation: FullscreenPresentation,
        ) {
            if (presentation === "immersive") {
                await toggleWindowFullscreen(appWindow);
                return;
            }

            const intentVersion = ++fullscreenIntentVersion;
            intendedFullscreen = false;
            await queueWindowOperation(async () => {
                if (intentVersion !== fullscreenIntentVersion || intendedFullscreen) {
                    return;
                }

                if (await appWindow.isFullscreen()) {
                    await appWindow.setFullscreen(false);
                }

                if (intentVersion !== fullscreenIntentVersion || intendedFullscreen) {
                    return;
                }

                if (await appWindow.isMaximized()) {
                    await appWindow.unmaximize();
                } else {
                    await appWindow.maximize();
                }
            });
        },

        async restoreAfterElementFullscreenExit(
            appWindow: FullscreenWindow,
            fullscreenElement: Element | null,
        ) {
            const intentVersion = fullscreenIntentVersion;
            if (!intendedFullscreen || fullscreenElement) {
                return false;
            }

            return queueWindowOperation(async () => {
                if (intentVersion !== fullscreenIntentVersion || !intendedFullscreen) {
                    return false;
                }

                if (await appWindow.isFullscreen()) {
                    return false;
                }

                if (intentVersion !== fullscreenIntentVersion || !intendedFullscreen) {
                    return false;
                }

                await appWindow.setFullscreen(true);
                return true;
            });
        },
    };
}

export const windowFullscreenIntent = createWindowFullscreenIntent();
