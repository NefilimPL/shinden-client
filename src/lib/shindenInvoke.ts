import { invoke as tauriInvoke, type InvokeArgs, type InvokeOptions } from "@tauri-apps/api/core";
import { invokeWithVerification, requireBrowserVerification } from "./browserVerification.ts";

export function invoke<T>(command: string, args?: InvokeArgs, options?: InvokeOptions): Promise<T> {
    return invokeWithVerification(
        () => tauriInvoke<T>(command, args, options),
        requireBrowserVerification,
    );
}
