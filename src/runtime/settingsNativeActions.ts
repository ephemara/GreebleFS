import { commands, unwrapTauriResult } from "./tauriClient";
import { callGreebleNativeWithInvokeFallback } from "./nativeControl";

export async function setLaunchAtStartupNativeFirst(enabled: boolean): Promise<boolean> {
  return callGreebleNativeWithInvokeFallback<boolean, { enabled: boolean }>(
    "settings",
    "setLaunchAtStartup",
    { enabled },
    () => commands.startupSetLaunchAtStartup(enabled).then(unwrapTauriResult),
  );
}
