import type { TitleWorkspaceLayout } from "$lib/titleWorkspace";

export type TitleTabPresentation = {
    showImage: true;
    showLabel: boolean;
    showClose: boolean;
};

export function titleTabPresentation(
    layout: TitleWorkspaceLayout,
    isActive: boolean,
    compactLabels: boolean,
): TitleTabPresentation {
    return {
        showImage: true,
        showLabel: layout === "horizontal" && (!compactLabels || isActive),
        showClose: true,
    };
}
