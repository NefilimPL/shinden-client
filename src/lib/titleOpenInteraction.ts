type AuxiliaryPointerEvent = Pick<MouseEvent, "button" | "preventDefault">;

export function openTitleOnAuxClick(
    event: AuxiliaryPointerEvent,
    open: () => void,
): boolean {
    return openTitleOnMiddleMouseButton(event, open);
}

function openTitleOnMiddleMouseButton(
    event: AuxiliaryPointerEvent,
    open: () => void,
): boolean {
    if (event.button !== 1) {
        return false;
    }

    event.preventDefault();
    open();
    return true;
}
