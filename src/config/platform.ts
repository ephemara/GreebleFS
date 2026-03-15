export type RuntimePlatform = 'windows' | 'macos' | 'linux' | 'unknown';

export type ExternalTerminalProfile =
  | 'auto'
  | 'system'
  | 'windows-terminal'
  | 'pwsh'
  | 'powershell'
  | 'cmd'
  | 'terminal'
  | 'iterm'
  | 'gnome-terminal'
  | 'konsole'
  | 'xterm'
  | 'custom';

export interface ExternalTerminalProfileOption {
  id: ExternalTerminalProfile;
  label: string;
  description: string;
}

export interface BookmarkSeed {
  id: string;
  name: string;
  value: string;
}

function readClientPlatformSource(): string {
  if (typeof navigator === 'undefined') {
    return '';
  }

  const userAgentDataPlatform = (navigator as Navigator & {
    userAgentData?: { platform?: string };
  }).userAgentData?.platform;

  return [
    navigator.platform,
    userAgentDataPlatform,
    navigator.userAgent,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function detectClientPlatform(): RuntimePlatform {
  const source = readClientPlatformSource();

  if (source.includes('mac')) return 'macos';
  if (source.includes('win')) return 'windows';
  if (source.includes('linux') || source.includes('x11')) return 'linux';

  return 'unknown';
}

export function getDefaultIntegratedShell(platform = detectClientPlatform()): string {
  switch (platform) {
    case 'windows':
      return 'powershell.exe';
    case 'macos':
      return '/bin/zsh';
    case 'linux':
      return '/bin/bash';
    default:
      return '';
  }
}

export function getExternalTerminalProfileOptions(
  platform = detectClientPlatform(),
): ExternalTerminalProfileOption[] {
  switch (platform) {
    case 'windows':
      return [
        { id: 'auto', label: 'Auto', description: 'Pick the best installed Windows terminal.' },
        { id: 'windows-terminal', label: 'Windows Terminal', description: 'Open with Windows Terminal if available.' },
        { id: 'pwsh', label: 'PowerShell Core', description: 'Launch PowerShell 7 / pwsh.' },
        { id: 'powershell', label: 'Windows PowerShell', description: 'Launch classic PowerShell.' },
        { id: 'cmd', label: 'Command Prompt', description: 'Launch cmd.exe.' },
        { id: 'custom', label: 'Custom Command', description: 'Run a fully custom executable and args.' },
      ];
    case 'macos':
      return [
        { id: 'auto', label: 'Auto', description: 'Prefer iTerm when installed, otherwise Terminal.' },
        { id: 'terminal', label: 'Terminal', description: 'Open Apple Terminal.app.' },
        { id: 'iterm', label: 'iTerm', description: 'Open iTerm when installed.' },
        { id: 'custom', label: 'Custom Command', description: 'Run a fully custom executable and args.' },
      ];
    case 'linux':
      return [
        { id: 'auto', label: 'Auto', description: 'Pick the best installed terminal emulator.' },
        { id: 'system', label: 'System Default', description: 'Use the desktop default terminal.' },
        { id: 'gnome-terminal', label: 'GNOME Terminal', description: 'Open gnome-terminal.' },
        { id: 'konsole', label: 'Konsole', description: 'Open KDE Konsole.' },
        { id: 'xterm', label: 'XTerm', description: 'Open xterm.' },
        { id: 'custom', label: 'Custom Command', description: 'Run a fully custom executable and args.' },
      ];
    default:
      return [
        { id: 'auto', label: 'Auto', description: 'Pick a sensible terminal for this platform.' },
        { id: 'custom', label: 'Custom Command', description: 'Run a fully custom executable and args.' },
      ];
  }
}

export function getPlatformPathSeparator(platform = detectClientPlatform()): '/' | '\\' {
  return platform === 'windows' ? '\\' : '/';
}

export function joinPlatformPath(
  base: string,
  segment: string,
  platform = detectClientPlatform(),
): string {
  const separator = getPlatformPathSeparator(platform);
  const trimmedBase = base.replace(/[\\/]+$/, '');
  const trimmedSegment = segment.replace(/^[\\/]+/, '');

  if (!trimmedBase) {
    return trimmedSegment;
  }

  return `${trimmedBase}${separator}${trimmedSegment}`;
}

export function getFallbackExplorerPath(platform = detectClientPlatform()): string {
  return platform === 'windows' ? 'C:\\' : '/';
}

export function createDefaultDirectoryBookmarks(
  homeDir?: string,
  platform = detectClientPlatform(),
): BookmarkSeed[] {
  if (!homeDir) {
    return [];
  }

  const bookmarks: BookmarkSeed[] = [
    { id: 'def-dir-home', name: 'Home', value: homeDir },
  ];

  const commonFolders = ['Desktop', 'Documents'];
  for (const folder of commonFolders) {
    bookmarks.push({
      id: `def-dir-${folder.toLowerCase()}`,
      name: folder,
      value: joinPlatformPath(homeDir, folder, platform),
    });
  }

  if (platform !== 'windows') {
    bookmarks.push({
      id: 'def-dir-projects',
      name: 'Projects',
      value: joinPlatformPath(homeDir, 'Projects', platform),
    });
  }

  return bookmarks;
}

export function createDefaultCommandBookmarks(): BookmarkSeed[] {
  return [
    { id: 'def-cmd-git-status', name: 'Git Status', value: 'git status' },
    { id: 'def-cmd-rust-build', name: 'Rust Build', value: 'cargo build' },
    { id: 'def-cmd-install-deps', name: 'Install Deps', value: 'npm install' },
  ];
}
