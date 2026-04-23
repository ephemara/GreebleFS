export type MobileRemoteAccessMode = 'lan' | 'tailscale';
export type MobileShareConnectionTargetId =
  | 'preferred'
  | 'lan-secure'
  | 'lan-discovery'
  | 'lan-direct'
  | 'tailnet';
export type MobileShareConnectionTargetKind = 'lan' | 'tailscale';

export interface MobileRemoteAccessModeDefinition {
  id: MobileRemoteAccessMode;
  label: string;
  summary: string;
  description: string;
  launchBadge: string;
}

export interface MobileShareConnectionTargetDefinition {
  id: MobileShareConnectionTargetId;
  label: string;
  description: string;
  kind: MobileShareConnectionTargetKind;
}

export const mobileRemoteAccessModeDefinitions = [
  {
    id: 'lan',
    label: 'Local LAN',
    summary: 'mDNS plus local IP delivery for same-network phones and tablets.',
    description: 'Best for same-LAN, hotspot, and local demo flows. GreebleFS serves the mobile shell directly from the desktop over the current local network.',
    launchBadge: 'LAN',
  },
  {
    id: 'tailscale',
    label: 'Tailscale',
    summary: 'Tailnet URL delivery for remote phones without opening router ports.',
    description: 'Uses the local Tailscale CLI and tailnet identity so the desktop can advertise a MagicDNS/Tailscale URL instead of a private-only LAN address.',
    launchBadge: 'Tailnet',
  },
] as const satisfies readonly MobileRemoteAccessModeDefinition[];

const MOBILE_REMOTE_ACCESS_MODE_LOOKUP = new Map(
  mobileRemoteAccessModeDefinitions.map(definition => [definition.id, definition] as const),
);

export const mobileShareConnectionTargetDefinitions = [
  {
    id: 'preferred',
    label: 'Preferred Route',
    description: 'Best current phone path for the selected mobile access mode.',
    kind: 'lan',
  },
  {
    id: 'lan-secure',
    label: 'LAN HTTPS',
    description: 'Local-network HTTPS route for Safari and nearby devices.',
    kind: 'lan',
  },
  {
    id: 'lan-discovery',
    label: 'LAN Discovery',
    description: 'mDNS fallback for nearby devices when direct HTTPS is unavailable.',
    kind: 'lan',
  },
  {
    id: 'lan-direct',
    label: 'LAN Direct',
    description: 'Direct local IP fallback for the current network.',
    kind: 'lan',
  },
  {
    id: 'tailnet',
    label: 'Tailnet',
    description: 'Remote path over the active tailnet when Tailscale is connected.',
    kind: 'tailscale',
  },
] as const satisfies readonly MobileShareConnectionTargetDefinition[];

const MOBILE_SHARE_CONNECTION_TARGET_LOOKUP = new Map(
  mobileShareConnectionTargetDefinitions.map(definition => [definition.id, definition] as const),
);

export const mobileAccessExternalLinks = {
  tailscaleDownload: 'https://tailscale.com/download',
  tailscaleHttpsDocs: 'https://tailscale.com/kb/1153/enabling-https',
  tailscaleMagicDnsDocs: 'https://tailscale.com/kb/1081/magicdns',
} as const;

export const mobileShareQrHoverDelayMs = 3000;
export const mobileShareQrCodeSizePx = 160;

export function normalizeMobileRemoteAccessMode(value: unknown): MobileRemoteAccessMode {
  if (typeof value !== 'string') {
    return 'lan';
  }

  const normalizedValue = value.trim() as MobileRemoteAccessMode;
  return MOBILE_REMOTE_ACCESS_MODE_LOOKUP.has(normalizedValue) ? normalizedValue : 'lan';
}

export function getMobileRemoteAccessModeDefinition(
  mode: MobileRemoteAccessMode,
): MobileRemoteAccessModeDefinition {
  return MOBILE_REMOTE_ACCESS_MODE_LOOKUP.get(mode)
    ?? MOBILE_REMOTE_ACCESS_MODE_LOOKUP.get('lan')!;
}

export function getMobileShareConnectionTargetDefinition(
  targetId: MobileShareConnectionTargetId,
): MobileShareConnectionTargetDefinition {
  return MOBILE_SHARE_CONNECTION_TARGET_LOOKUP.get(targetId)
    ?? MOBILE_SHARE_CONNECTION_TARGET_LOOKUP.get('preferred')!;
}
