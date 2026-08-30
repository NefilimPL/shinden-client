type CloseControlEvent = Pick<MouseEvent, "preventDefault" | "stopPropagation">;

export function createTitleTabCloseController() {
    const closingTitleIds = new Set<number>();

    return {
        async close(
            event: CloseControlEvent,
            titleId: number,
            requestClose: () => Promise<void>,
        ): Promise<boolean> {
            event.preventDefault();
            event.stopPropagation();
            if (closingTitleIds.has(titleId)) {
                return false;
            }

            closingTitleIds.add(titleId);
            try {
                await requestClose();
                return true;
            } finally {
                closingTitleIds.delete(titleId);
            }
        },
    };
}
