export type FullscreenWindow = {
    setFullscreen(fullscreen: boolean): Promise<void>;
    isFullscreen(): Promise<boolean>;
};

export function createWindowFullscreenIntent() {
    let intendedFullscreen = false;

    return {
        setIntendedFullscreen(fullscreen: boolean) {
            intendedFullscreen = fullscreen;
        },

        async toggleWindowFullscreen(appWindow: FullscreenWindow) {
            const nextFullscreen = !(await appWindow.isFullscreen());
            intendedFullscreen = nextFullscreen;
            await appWindow.setFullscreen(nextFullscreen);
        },

        async restoreAfterElementFullscreenExit(
            appWindow: Pick<FullscreenWindow, "setFullscreen">,
            fullscreenElement: Element | null
        ) {
            if (!intendedFullscreen || fullscreenElement) {
                return false;
            }

            await appWindow.setFullscreen(true);
            return true;
        }
    };
}

export const windowFullscreenIntent = createWindowFullscreenIntent();
