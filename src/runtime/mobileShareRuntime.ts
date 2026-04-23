import { isTauri } from '@tauri-apps/api/core';
import type {
  LanShareResult,
  TailscaleStatusSnapshot,
} from '../generated/tauri';
import {
  getMobileRemoteAccessModeDefinition,
  getMobileShareConnectionTargetDefinition,
  type MobileRemoteAccessMode,
  type MobileShareConnectionTargetId,
  type MobileShareConnectionTargetKind,
} from '../config/mobileAccess';
import { isExplorerTrackableFolderPath } from '../config/explorerVirtualLocations';
import { getExplorerHomeDir } from './explorerBackend';
import { ensureMobileShareThemeSnapshotSynced } from './mobileShareThemeRuntime';
import { getTailscaleStatus } from './tailscaleBackend';
import { commands, unwrapTauriResult } from './tauriClient';

export interface MobileShareConnectionTarget {
  id: MobileShareConnectionTargetId;
  label: string;
  description: string;
  kind: MobileShareConnectionTargetKind;
  url: string;
  isPreferred: boolean;
}

export interface MobileShareSession {
  sharePath: string;
  remoteAccessMode: MobileRemoteAccessMode;
  startedAt: number;
  preferredUrl: string;
  result: LanShareResult;
  connectionTargets: MobileShareConnectionTarget[];
}

export interface StartMobileShareArgs {
  requestedPath: string;
  remoteAccessMode: MobileRemoteAccessMode;
  copyPreferredUrl?: boolean;
}

export interface StartMobileShareResult {
  session: MobileShareSession;
  tailscaleStatus: TailscaleStatusSnapshot | null;
  copiedPreferredUrl: boolean;
}

function normalizeShareUrl(value: string | null | undefined): string | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  return `http://${trimmedValue}`;
}

function isUsefulShareUrl(url: string | null): url is string {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname !== '127.0.0.1'
      && parsed.hostname !== '0.0.0.0'
      && parsed.hostname !== 'localhost';
  } catch {
    return false;
  }
}

function dedupeConnectionTargets(
  targets: MobileShareConnectionTarget[],
): MobileShareConnectionTarget[] {
  const seenUrls = new Set<string>();
  return targets.filter((target) => {
    if (seenUrls.has(target.url)) {
      return false;
    }
    seenUrls.add(target.url);
    return true;
  });
}

function createConnectionTarget(
  id: MobileShareConnectionTargetId,
  url: string,
  isPreferred: boolean,
): MobileShareConnectionTarget {
  const definition = getMobileShareConnectionTargetDefinition(id);
  return {
    id,
    label: definition.label,
    description: definition.description,
    kind: definition.kind,
    url,
    isPreferred,
  };
}

export function createMobileShareConnectionTargets(
  result: LanShareResult,
  remoteAccessMode: MobileRemoteAccessMode,
): MobileShareConnectionTarget[] {
  const preferredUrl = normalizeShareUrl(result.preferred_address);
  const targetCandidates: Array<[MobileShareConnectionTargetId, string | null]> = [
    ['lan-secure', normalizeShareUrl(result.ios_address)],
    ['lan-discovery', normalizeShareUrl(result.mdns_address)],
    ['lan-direct', normalizeShareUrl(result.address)],
    ['tailnet', normalizeShareUrl(result.tailscale_address)],
  ];

  const targets = dedupeConnectionTargets(
    targetCandidates
      .filter((entry): entry is [MobileShareConnectionTargetId, string] => isUsefulShareUrl(entry[1]))
      .map(([id, url]) => createConnectionTarget(id, url, url === preferredUrl)),
  );

  const hasPreferredTarget = Boolean(preferredUrl) && targets.some(target => target.url === preferredUrl);
  if (!hasPreferredTarget && isUsefulShareUrl(preferredUrl)) {
    const preferredDefinition = getMobileRemoteAccessModeDefinition(remoteAccessMode);
    targets.unshift({
      ...createConnectionTarget('preferred', preferredUrl, true),
      label: remoteAccessMode === 'tailscale' ? preferredDefinition.launchBadge : 'Preferred Route',
      description: `Best current phone path for ${preferredDefinition.label}.`,
      kind: remoteAccessMode === 'tailscale' ? 'tailscale' : 'lan',
    });
  }

  return targets.sort((left, right) => {
    if (left.isPreferred !== right.isPreferred) {
      return left.isPreferred ? -1 : 1;
    }

    const leftKindRank = left.kind === 'tailscale' ? 0 : 1;
    const rightKindRank = right.kind === 'tailscale' ? 0 : 1;
    if (leftKindRank !== rightKindRank) {
      return leftKindRank - rightKindRank;
    }

    return left.label.localeCompare(right.label);
  });
}

export async function copyTextToClipboardSafely(value: string): Promise<boolean> {
  if (!value || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    console.warn('GreebleFS: failed to copy mobile share URL', error);
    return false;
  }
}

export async function resolveMobileSharePath(requestedPath: string): Promise<string> {
  const trimmedPath = requestedPath.trim();
  if (isExplorerTrackableFolderPath(trimmedPath)) {
    return trimmedPath;
  }

  return getExplorerHomeDir();
}

export function formatMobileShareNotice(
  session: MobileShareSession,
  copiedPreferredUrl: boolean,
): string {
  const accessDefinition = getMobileRemoteAccessModeDefinition(session.remoteAccessMode);
  const suffix = copiedPreferredUrl
    ? ' The preferred URL was copied to the clipboard.'
    : '';
  return `Mobile share is live for ${session.sharePath} via ${accessDefinition.launchBadge} at ${session.preferredUrl}.${suffix}`;
}

export function getTailscaleMobileShareReadinessError(
  status: TailscaleStatusSnapshot,
): string | null {
  if (!status.cliAvailable) {
    return 'Tailscale CLI is not available on this desktop. Install it or switch Mobile Access back to Local LAN.';
  }

  if (!status.running) {
    return status.diagnosticMessage
      ?? 'Tailscale is installed but the local daemon is not running yet.';
  }

  if (!status.connected) {
    if (status.authUrl) {
      return 'Tailscale still needs desktop sign-in before the tailnet mobile route can come online.';
    }

    return status.diagnosticMessage
      ?? 'Tailscale is not connected on this machine yet.';
  }

  return null;
}

export async function ensureMobileShareRemoteAccessReady(
  remoteAccessMode: MobileRemoteAccessMode,
): Promise<TailscaleStatusSnapshot | null> {
  if (remoteAccessMode !== 'tailscale') {
    return null;
  }

  const tailscaleStatus = await getTailscaleStatus();
  const readinessError = getTailscaleMobileShareReadinessError(tailscaleStatus);
  if (readinessError) {
    throw new Error(readinessError);
  }

  return tailscaleStatus;
}

export function createMobileShareSession(
  sharePath: string,
  remoteAccessMode: MobileRemoteAccessMode,
  result: LanShareResult,
): MobileShareSession {
  const preferredUrl = normalizeShareUrl(result.preferred_address)
    ?? normalizeShareUrl(result.address)
    ?? 'http://127.0.0.1';

  return {
    sharePath,
    remoteAccessMode,
    startedAt: Date.now(),
    preferredUrl,
    result,
    connectionTargets: createMobileShareConnectionTargets(result, remoteAccessMode),
  };
}

export async function startMobileShareRuntime(
  args: StartMobileShareArgs,
): Promise<StartMobileShareResult> {
  if (!isTauri()) {
    throw new Error('Mobile share is only available from the desktop host.');
  }

  const sharePath = await resolveMobileSharePath(args.requestedPath);
  await ensureMobileShareThemeSnapshotSynced();
  const tailscaleStatus = await ensureMobileShareRemoteAccessReady(args.remoteAccessMode);
  const result = unwrapTauriResult(await commands.lanShareStart(
    sharePath,
    'mobile',
    null,
    args.remoteAccessMode,
  ));
  const session = createMobileShareSession(sharePath, args.remoteAccessMode, result);
  const copiedPreferredUrl = args.copyPreferredUrl !== false
    ? await copyTextToClipboardSafely(session.preferredUrl)
    : false;

  return {
    session,
    tailscaleStatus,
    copiedPreferredUrl,
  };
}

export async function stopMobileShareRuntime(): Promise<void> {
  if (!isTauri()) {
    throw new Error('Mobile share is only available from the desktop host.');
  }

  unwrapTauriResult(await commands.lanShareStop());
}
