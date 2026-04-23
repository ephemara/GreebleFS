export type MobileRemoteAccessMode = 'lan' | 'tailscale';

export interface MobileRemoteAccessModeDefinition {
  id: MobileRemoteAccessMode;
  label: string;
  summary: string;
  description: string;
  launchBadge: string;
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

export const mobileAccessExternalLinks = {
  tailscaleDownload: 'https://tailscale.com/download',
  tailscaleHttpsDocs: 'https://tailscale.com/kb/1153/enabling-https',
  tailscaleMagicDnsDocs: 'https://tailscale.com/kb/1081/magicdns',
} as const;

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
