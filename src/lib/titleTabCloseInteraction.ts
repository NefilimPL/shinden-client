type CloseControlEvent = Pick<MouseEvent, "preventDefault" | "stopPropagation">;

export function closeTitleTabFromControl(
    event: CloseControlEvent,
    close: () => void,
): boolean {
    event.preventDefault();
    event.stopPropagation();
    close();
    return true;
}
