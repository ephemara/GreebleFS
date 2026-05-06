import process from 'node:process';

import {
  GreeblefsAutomationRuntime,
  writeSmokeLog,
  writeSmokeStatus,
} from './runtime/greeblefsAutomationRuntime.js';

async function main(): Promise<void> {
  const captureScreenshot = process.argv.includes('--screenshot');
  const runtime = new GreeblefsAutomationRuntime();

  try {
    await writeSmokeLog('Starting GreebleFS dev MCP smoke run.');
    await writeSmokeStatus('Starting GreebleFS dev MCP smoke run.');

    const status = await runtime.getStatus({ includeAttachProbe: true });
    let bridgeStatus: unknown = null;
    let hostApiSchema: unknown = null;
    let snapshotSummary: Record<string, unknown> | null = null;
    let screenshot: Record<string, unknown> | null = null;
    let nativeWindows: unknown[] = [];

    try {
      nativeWindows = await runtime.listNativeWindows();
    } catch (error) {
      nativeWindows = [
        {
          unavailable: true,
          reason: error instanceof Error ? error.message : String(error),
        },
      ];
    }

    if (status.bridgeReady) {
      bridgeStatus = await runtime.getBridgeStatus();
      const hostBridgeAvailable = Boolean(
        bridgeStatus
        && typeof bridgeStatus === 'object'
        && (bridgeStatus as { capabilities?: { hostBridge?: boolean } }).capabilities?.hostBridge,
      );
      if (hostBridgeAvailable) {
        hostApiSchema = await runtime.getHostApiSchema();
      } else {
        hostApiSchema = {
          unavailable: true,
          reason: 'Host bridge APIs are unavailable on browser-dev-url fallback attachments.',
        };
      }
      const snapshot = await runtime.getBridgeSnapshot({
        includeDom: true,
        includeThemeVariables: true,
        includeTelemetryRecords: true,
        telemetryLimit: 20,
        consoleLimit: 30,
      }) as Record<string, unknown>;
      snapshotSummary = {
        status: snapshot.status ?? null,
        domNodeCount: Array.isArray(snapshot.domNodes) ? snapshot.domNodes.length : 0,
        themeVariableCount: snapshot.themeVariables && typeof snapshot.themeVariables === 'object'
          ? Object.keys(snapshot.themeVariables as Record<string, unknown>).length
          : 0,
        consoleEntryCount: Array.isArray(snapshot.consoleEntries) ? snapshot.consoleEntries.length : 0,
        telemetryRecordCount: Array.isArray(snapshot.telemetryRecords) ? snapshot.telemetryRecords.length : 0,
      };

      if (captureScreenshot) {
        const screenshotResult = await runtime.captureScreenshot({
          pathHint: 'greeblefs-dev-mcp-smoke',
        });
        screenshot = {
          imagePath: screenshotResult.imagePath,
          attachMode: screenshotResult.attachMode,
          pageUrl: screenshotResult.pageUrl,
        };
      }
    }

    const result = {
      generatedAt: new Date().toISOString(),
      status,
      bridgeStatus,
      hostApiSchema,
      snapshotSummary,
      nativeWindows,
      screenshot,
    };

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    await writeSmokeLog('Completed GreebleFS dev MCP smoke run.');
    await writeSmokeStatus('Completed GreebleFS dev MCP smoke run.');
  } finally {
    await runtime.close();
  }
}

void main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  await writeSmokeLog(`Smoke run failed: ${message}`).catch(() => {});
  await writeSmokeStatus(`Smoke run failed: ${message}`).catch(() => {});
  process.exit(1);
});
