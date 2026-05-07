export async function installDevReactScan(): Promise<void> {
  const reactScanWindow = window as typeof window & {
    __greeblefsReactScanInstalled?: boolean;
  };

  if (
    typeof window === "undefined"
    || reactScanWindow.__greeblefsReactScanInstalled
  ) {
    return;
  }

  try {
    const { scan } = await import("react-scan");

    scan({
      enabled: true,
      allowInIframe: true,
      showToolbar: true,
      showFPS: true,
      safeArea: {
        top: 72,
        right: 20,
        bottom: 24,
        left: 20,
      },
    });
  } catch (error) {
    console.warn("[GreebleFS] Failed to initialize React Scan.", error);
  } finally {
    reactScanWindow.__greeblefsReactScanInstalled = true;
  }
}
