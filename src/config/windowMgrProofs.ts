import type { WindowMgrExecutableSpec } from '@tauri-apps/api/windowmgr';

export type WindowMgrProofPlatform = 'windows' | 'unsupported';

export interface WindowMgrProofDefinition {
  id: string;
  label: string;
  sessionId: string;
  platform: WindowMgrProofPlatform;
  executable: WindowMgrExecutableSpec;
}

const WINDOWS_SYSTEM32 = 'C:\\Windows\\System32';

export const windowMgrProofDefinitions: readonly WindowMgrProofDefinition[] = [
  {
    id: 'windows-notepad',
    label: 'Notepad',
    sessionId: 'greeblefs-windowmgr-notepad-proof',
    platform: 'windows',
    executable: {
      id: 'windows-notepad',
      displayName: 'Notepad',
      shortName: 'Notepad',
      executablePath: `${WINDOWS_SYSTEM32}\\notepad.exe`,
      args: [],
      backendPreference: 'auto',
    },
  },
] as const;

export function resolveWindowMgrProofPlatform(
  platform: string | null | undefined,
): WindowMgrProofPlatform {
  return platform === 'windows' ? 'windows' : 'unsupported';
}

export function getDefaultWindowMgrProofDefinition(
  platform: string | null | undefined,
): WindowMgrProofDefinition | null {
  const proofPlatform = resolveWindowMgrProofPlatform(platform);
  return windowMgrProofDefinitions.find(definition => definition.platform === proofPlatform) ?? null;
}
