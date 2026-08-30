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

    return {
        setIntendedFullscreen(fullscreen: boolean) {
            intendedFullscreen = fullscreen;
        },

        isWindowFullscreenIntended() {
            return intendedFullscreen;
        },

        async toggleWindowFullscreen(appWindow: FullscreenWindow) {
            const nextFullscreen = !(await appWindow.isFullscreen());
            intendedFullscreen = nextFullscreen;
            await appWindow.setFullscreen(nextFullscreen);
        },
        async toggleWindowPresentation(
            appWindow: TaskbarPresentationWindow,
            presentation: FullscreenPresentation,
        ) {
            if (presentation === "immersive") {
                const nextFullscreen = !(await appWindow.isFullscreen());
                intendedFullscreen = nextFullscreen;
                await appWindow.setFullscreen(nextFullscreen);
                return;
            }

            intendedFullscreen = false;
            if (await appWindow.isFullscreen()) {
                await appWindow.setFullscreen(false);
            }

            if (await appWindow.isMaximized()) {

                await appWindow.unmaximize();
            } else {
                await appWindow.maximize();
            }
        },
        handlePlayerFullscreenChange(fullscreenElement: Element | null) {
            if (fullscreenElement) {
                return;
            }

            intendedFullscreen = false;
        }
    };
}

export const windowFullscreenIntent = createWindowFullscreenIntent();
