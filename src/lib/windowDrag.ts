const INTERACTIVE_DRAG_SELECTOR = [
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "summary",
    "label",
    "[contenteditable='true']",
    "[role='button']",
    "[data-no-window-drag]"
].join(",");

const DRAG_REGION_SELECTOR = "[data-window-drag-region]";

export type WindowDragPointerEvent = Pick<
    PointerEvent,
    "button" | "defaultPrevented" | "isPrimary" | "pointerType" | "target"
>;

function hasClosest(target: EventTarget | null): target is Element {
    return typeof (target as { closest?: unknown } | null)?.closest === "function";
}

export function shouldStartWindowDrag(event: WindowDragPointerEvent): boolean {
    if (
        event.defaultPrevented ||
        !["mouse", "touch", "pen"].includes(event.pointerType) ||
        event.button !== 0 ||
        !event.isPrimary
    ) {
        return false;
    }

    if (!hasClosest(event.target) || !event.target.closest(DRAG_REGION_SELECTOR)) {
        return false;
    }

    if (event.target.closest(INTERACTIVE_DRAG_SELECTOR)) {
        return false;
    }

    return true;
}

export function shouldStartTouchWindowDrag(event: WindowDragPointerEvent): boolean {
    return event.pointerType === "touch" && shouldStartWindowDrag(event);
}
