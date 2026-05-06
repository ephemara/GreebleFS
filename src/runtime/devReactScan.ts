export async function installDevReactScan(): Promise<void> {
  if (
    typeof window === "undefined"
    || (window as typeof window & { __greeblefsReactScanInstalled?: boolean })
      .__greeblefsReactScanInstalled
  ) {
    return;
  }

  const { scan } = await import("react-scan");

  scan({
    enabled: true,
    allowInIframe: true,
    showToolbar: true,
    showFPS: true,
    trackUnnecessaryRenders: true,
    safeArea: {
      top: 72,
      right: 20,
      bottom: 24,
      left: 20,
    },
  });

  (
    window as typeof window & { __greeblefsReactScanInstalled?: boolean }
  ).__greeblefsReactScanInstalled = true;
}
