import { convertFileSrc } from '@tauri-apps/api/core';
import {
  clearScreenshots,
  getMonitorScreenshot,
  getScreenshotableMonitors,
  removeMonitorScreenshot,
} from 'tauri-plugin-screenshots-api';

import type {
  SavedScreenshot,
  ScreenshotRegion,
  ScreenshotStage,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export interface ScreenshotableMonitorDescriptor {
  id: number;
  name: string;
}

export type PreparedScreenshotStage = ScreenshotStage;

export async function listScreenshotableMonitors(): Promise<
  ScreenshotableMonitorDescriptor[]
> {
  const monitors = await getScreenshotableMonitors();
  return monitors.map((monitor) => ({
    id: Number(monitor.id),
    name: typeof monitor.name === 'string' ? monitor.name : '',
  }));
}

export async function captureScreenshotMonitor(
  monitorId: number,
): Promise<string> {
  return getMonitorScreenshot(monitorId);
}

export async function removeScreenshotMonitorCapture(
  monitorId: number,
): Promise<void> {
  await removeMonitorScreenshot(monitorId);
}

export async function clearScreenshotPluginCaptures(): Promise<void> {
  await clearScreenshots();
}

export async function prepareScreenshotStage(
  path: string,
  crop: ScreenshotRegion | null,
): Promise<PreparedScreenshotStage> {
  return unwrapTauriResult(
    await commands.screenshotPrepareImageStage(path, crop),
  );
}

export async function finalizeScreenshotStage(
  path: string,
  directory: string,
  filePrefix: string | null,
  copyToClipboard: boolean,
): Promise<SavedScreenshot> {
  return unwrapTauriResult(
    await commands.screenshotFinalizeImage(
      path,
      directory,
      filePrefix,
      copyToClipboard,
    ),
  );
}

export async function deleteScreenshotStage(path: string): Promise<void> {
  unwrapTauriResult(await commands.screenshotDeleteImageStage(path));
}

export async function copyScreenshotImageToClipboard(
  path: string,
): Promise<void> {
  unwrapTauriResult(await commands.screenshotCopyImageToClipboard(path));
}

export function buildScreenshotAssetUrl(
  path: string,
  revision?: number | string,
): string {
  const assetUrl = convertFileSrc(path);
  if (revision == null) {
    return assetUrl;
  }

  const suffix = String(revision);
  return `${assetUrl}${assetUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(suffix)}`;
}
