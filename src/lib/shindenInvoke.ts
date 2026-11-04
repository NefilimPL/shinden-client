import { invoke as tauriInvoke, type InvokeArgs, type InvokeOptions } from "@tauri-apps/api/core";
import { invokeWithVerification, requireBrowserVerification } from "./browserVerification.ts";
import { currentProfileEpoch } from "./librarySession.ts";

export function invoke<T>(command: string, args?: InvokeArgs, options?: InvokeOptions): Promise<T> {
    const epoch = currentProfileEpoch();
    return invokeWithVerification(
        () => tauriInvoke<T>(command, args, options),
        requireBrowserVerification,
    ).then((result) => {
        if (epoch !== currentProfileEpoch() && !["write_log", "get_image_proxy_token"].includes(command)) {
            throw new Error("Zmieniono profil lokalny. Otwórz widok ponownie.");
        }
        return result;
    });
}
