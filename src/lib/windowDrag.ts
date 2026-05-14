const INTERACTIVE_DRAG_SELECTOR = [
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "[contenteditable='true']",
    "[role='button']",
    "[data-no-window-drag]"
].join(",");

const TOUCH_DRAG_REGION_SELECTOR = "[data-tauri-drag-region]";

export type WindowDragPointerEvent = Pick<
    PointerEvent,
    "button" | "defaultPrevented" | "isPrimary" | "pointerType" | "target"
>;

function hasClosest(target: EventTarget | null): target is Element {
    return typeof (target as { closest?: unknown } | null)?.closest === "function";
}

export function shouldStartTouchWindowDrag(event: WindowDragPointerEvent): boolean {
    if (
        event.defaultPrevented ||
        event.pointerType !== "touch" ||
        event.button !== 0 ||
        !event.isPrimary
    ) {
        return false;
    }

    if (!hasClosest(event.target) || !event.target.closest(TOUCH_DRAG_REGION_SELECTOR)) {
        return false;
    }

    if (event.target.closest(INTERACTIVE_DRAG_SELECTOR)) {
        return false;
    }

    return true;
}
