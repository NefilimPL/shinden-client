import type { FullscreenPresentation } from "$lib/titleWorkspace";
import { PhysicalPosition } from "@tauri-apps/api/dpi";

export type FullscreenWindow = {
    setFullscreen(fullscreen: boolean): Promise<void>;
    isFullscreen(): Promise<boolean>;
};

export type TaskbarPresentationWindow = FullscreenWindow & {
    isMaximized(): Promise<boolean>;
    maximize(): Promise<void>;
    unmaximize(): Promise<void>;
};

export type DraggableWindow = TaskbarPresentationWindow & {
    outerPosition(): Promise<{ x: number; y: number }>;
    outerSize(): Promise<{ width: number; height: number }>;
    setPosition(position: PhysicalPosition): Promise<void>;
    startDragging(): Promise<void>;
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

        async startWindowDragging(
            appWindow: DraggableWindow,
            cursor: { x: number; y: number },
            isPointerPressed: () => boolean = () => true,
        ) {
            const intentVersion = ++fullscreenIntentVersion;
            intendedFullscreen = false;
            const isCurrentDrag = () => intentVersion === fullscreenIntentVersion && isPointerPressed();
            await queueWindowOperation(async () => {
                if (!isCurrentDrag()) return;
                const fullscreen = await appWindow.isFullscreen();
                const maximized = await appWindow.isMaximized();
                if (fullscreen || maximized) {
                    const position = await appWindow.outerPosition();
                    const size = await appWindow.outerSize();
                    const horizontalAnchor = Math.max(0, Math.min(1, (cursor.x - position.x) / size.width));
                    const verticalOffset = Math.max(0, cursor.y - position.y);

                    if (!isCurrentDrag()) return;
                    if (fullscreen) await appWindow.setFullscreen(false);
                    // Fullscreen can restore a previously maximized window.
                    const restoredMaximized = await appWindow.isMaximized();
                    if (!isCurrentDrag()) return;
                    if (restoredMaximized) await appWindow.unmaximize();
                    const restored = await appWindow.outerSize();
                    if (!isCurrentDrag()) return;
                    await appWindow.setPosition(new PhysicalPosition(
                        Math.round(cursor.x - restored.width * horizontalAnchor),
                        Math.round(cursor.y - Math.min(verticalOffset, restored.height - 1)),
                    ));
                }
                if (!isCurrentDrag()) return;
                await appWindow.startDragging();
            });
        },

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
