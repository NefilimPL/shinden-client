import { convertFileSrc } from "@tauri-apps/api/core";
import { shindenImageRequestUrl } from "./shindenImages.ts";
import { imageProxy } from "./imageProxy.svelte";

export function shindenImageSrc(source: string): string {
    return shindenImageRequestUrl(source, convertFileSrc("image", "shinden-image"), imageProxy.token);
}
