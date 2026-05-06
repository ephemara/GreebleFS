export type RuntimePlatform = 'windows' | 'macos' | 'linux' | 'unknown';
export type DefaultIntegratedTerminalHost = 'xterm';

export type IntegratedTerminalProfile =
  | 'auto'
  | 'pwsh'
  | 'powershell'
  | 'cmd'
  | 'zsh'
  | 'bash'
  | 'fish'
  | 'custom';

export interface IntegratedTerminalProfileOption {
  id: IntegratedTerminalProfile;
  label: string;
  description: string;
}

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

interface IntegratedTerminalProfileDefaults {
  shellPath: string;
  shellArgs: string;
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

function shellCommandNeedsQuotes(value: string): boolean {
  return /\s|["']/.test(value);
}

function quoteShellCommandSegment(value: string): string {
  if (!shellCommandNeedsQuotes(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function splitShellCommand(command: string): string[] {
  const trimmed = command.trim();
  if (!trimmed) {
    return [];
  }

  const tokens: string[] = [];
  let current = '';
  let activeQuote: '"' | "'" | null = null;
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index] ?? '';

    if (activeQuote === '"') {
      if (char === '\\') {
        const next = trimmed[index + 1];
        if (next === '"' || next === '\\') {
          current += next;
          index += 1;
          continue;
        }
        current += char;
        continue;
      }
      if (char === '"') {
        activeQuote = null;
        continue;
      }
      current += char;
      continue;
    }

    if (activeQuote === "'") {
      if (char === "'") {
        activeQuote = null;
        continue;
      }
      current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      activeQuote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function shellExecutableName(shell: string): string {
  return splitShellCommand(shell)[0]?.trim() ?? '';
}

function shellExecutableBasename(shell: string): string {
  const executable = shellExecutableName(shell);
  if (!executable) {
    return '';
  }

  const normalized = executable.replace(/["']/g, '');
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return (segments[segments.length - 1] ?? normalized).toLowerCase();
}

function getIntegratedTerminalProfileDefaults(
  profile: IntegratedTerminalProfile,
  platform = detectClientPlatform(),
): IntegratedTerminalProfileDefaults {
  switch (platform) {
    case 'windows':
      switch (profile) {
        case 'pwsh':
          return { shellPath: 'pwsh.exe', shellArgs: '-NoLogo' };
        case 'powershell':
          return { shellPath: 'powershell.exe', shellArgs: '-NoLogo' };
        case 'cmd':
          return { shellPath: 'cmd.exe', shellArgs: '' };
        case 'auto':
          return { shellPath: 'pwsh.exe', shellArgs: '-NoLogo' };
        default:
          return { shellPath: '', shellArgs: '' };
      }
    case 'macos':
      switch (profile) {
        case 'zsh':
          return { shellPath: '/bin/zsh', shellArgs: '-l' };
        case 'bash':
          return { shellPath: '/bin/bash', shellArgs: '-l' };
        case 'fish':
          return { shellPath: 'fish', shellArgs: '-l' };
        case 'auto':
          return { shellPath: '/bin/zsh', shellArgs: '-l' };
        default:
          return { shellPath: '', shellArgs: '' };
      }
    case 'linux':
      switch (profile) {
        case 'bash':
          return { shellPath: '/bin/bash', shellArgs: '-l' };
        case 'zsh':
          return { shellPath: '/bin/zsh', shellArgs: '-l' };
        case 'fish':
          return { shellPath: 'fish', shellArgs: '-l' };
        case 'auto':
          return { shellPath: '/bin/bash', shellArgs: '-l' };
        default:
          return { shellPath: '', shellArgs: '' };
      }
    default:
      return { shellPath: '', shellArgs: '' };
  }
}

export function getDefaultIntegratedTerminalProfile(
  platform = detectClientPlatform(),
): IntegratedTerminalProfile {
  switch (platform) {
    case 'windows':
    case 'macos':
    case 'linux':
      return 'auto';
    default:
      return 'custom';
  }
}

export function getDefaultIntegratedTerminalHost(
  _platform = detectClientPlatform(),
): DefaultIntegratedTerminalHost {
  return 'xterm';
}

export function getIntegratedTerminalProfileOptions(
  platform = detectClientPlatform(),
): IntegratedTerminalProfileOption[] {
  switch (platform) {
    case 'windows':
      return [
        { id: 'auto', label: 'Auto', description: 'Prefer PowerShell 7, then fall back to Windows PowerShell or Command Prompt.' },
        { id: 'pwsh', label: 'PowerShell 7', description: 'Launch pwsh / PowerShell Core with a profile-aware terminal session.' },
        { id: 'powershell', label: 'Windows PowerShell', description: 'Launch the built-in Windows PowerShell host.' },
        { id: 'cmd', label: 'Command Prompt', description: 'Launch cmd.exe without PowerShell-specific shell integration.' },
        { id: 'custom', label: 'Custom Command', description: 'Provide an explicit shell executable path plus args.' },
      ];
    case 'macos':
      return [
        { id: 'auto', label: 'Auto', description: 'Let the host fall back to the best available login shell.' },
        { id: 'zsh', label: 'Zsh', description: 'Launch zsh as a login shell.' },
        { id: 'bash', label: 'Bash', description: 'Launch bash as a login shell.' },
        { id: 'fish', label: 'Fish', description: 'Launch fish as a login shell.' },
        { id: 'custom', label: 'Custom Command', description: 'Provide an explicit shell executable path plus args.' },
      ];
    case 'linux':
      return [
        { id: 'auto', label: 'Auto', description: 'Let the host use $SHELL when possible, then fall back to bash.' },
        { id: 'bash', label: 'Bash', description: 'Launch bash as a login shell.' },
        { id: 'zsh', label: 'Zsh', description: 'Launch zsh as a login shell.' },
        { id: 'fish', label: 'Fish', description: 'Launch fish as a login shell.' },
        { id: 'custom', label: 'Custom Command', description: 'Provide an explicit shell executable path plus args.' },
      ];
    default:
      return [
        { id: 'custom', label: 'Custom Command', description: 'Provide an explicit shell executable path plus args.' },
      ];
  }
}

export function normalizeIntegratedTerminalProfile(
  value: unknown,
  platform = detectClientPlatform(),
): IntegratedTerminalProfile {
  if (typeof value !== 'string') {
    return getDefaultIntegratedTerminalProfile(platform);
  }

  const normalized = value.trim() as IntegratedTerminalProfile;
  if (!normalized) {
    return getDefaultIntegratedTerminalProfile(platform);
  }

  const availableProfiles = new Set(
    getIntegratedTerminalProfileOptions(platform).map((option) => option.id),
  );
  return availableProfiles.has(normalized)
    ? normalized
    : getDefaultIntegratedTerminalProfile(platform);
}

export function getIntegratedTerminalProfileTemplate(
  profile: IntegratedTerminalProfile,
  platform = detectClientPlatform(),
): IntegratedTerminalProfileDefaults {
  const normalizedProfile = normalizeIntegratedTerminalProfile(profile, platform);
  if (normalizedProfile === 'auto' || normalizedProfile === 'custom') {
    return { shellPath: '', shellArgs: '' };
  }

  return getIntegratedTerminalProfileDefaults(normalizedProfile, platform);
}

function buildShellCommand(shellPath: string, shellArgs: string): string {
  const normalizedPath = shellPath.trim();
  const normalizedArgs = shellArgs.trim();
  if (!normalizedPath) {
    return '';
  }

  return [quoteShellCommandSegment(normalizedPath), normalizedArgs]
    .filter(Boolean)
    .join(' ');
}

export function resolveIntegratedTerminalShellCommand(args: {
  profile: IntegratedTerminalProfile;
  shellPath?: string | null;
  shellArgs?: string | null;
  platform?: RuntimePlatform;
}): string {
  const platform = args.platform ?? detectClientPlatform();
  const profile = normalizeIntegratedTerminalProfile(args.profile, platform);
  const defaults = getIntegratedTerminalProfileDefaults(profile, platform);
  const shellPath = args.shellPath?.trim() || defaults.shellPath;
  const shellArgs = args.shellArgs?.trim() || defaults.shellArgs;
  return buildShellCommand(shellPath, shellArgs);
}

export function resolveIntegratedTerminalSpawnShellCommand(args: {
  profile: IntegratedTerminalProfile;
  shellPath?: string | null;
  shellArgs?: string | null;
  platform?: RuntimePlatform;
}): string | null {
  const platform = args.platform ?? detectClientPlatform();
  const profile = normalizeIntegratedTerminalProfile(args.profile, platform);
  if (
    profile === 'auto'
    && !(args.shellPath?.trim() || args.shellArgs?.trim())
  ) {
    return null;
  }

  const resolved = resolveIntegratedTerminalShellCommand({
    profile,
    shellPath: args.shellPath,
    shellArgs: args.shellArgs,
    platform,
  });
  return resolved || null;
}

export function inferIntegratedTerminalProfileFromShell(args: {
  shell: string;
  platform?: RuntimePlatform;
}): {
  shellProfile: IntegratedTerminalProfile;
  shellPath: string;
  shellArgs: string;
} {
  const platform = args.platform ?? detectClientPlatform();
  const tokens = splitShellCommand(args.shell);
  const shellPath = tokens[0] ?? '';
  const shellArgs = tokens.slice(1).join(' ');
  const executableName = shellExecutableBasename(args.shell);

  if (!shellPath) {
    const defaultProfile = getDefaultIntegratedTerminalProfile(platform);
    const defaults = getIntegratedTerminalProfileTemplate(defaultProfile, platform);
    return {
      shellProfile: defaultProfile,
      shellPath: defaults.shellPath,
      shellArgs: defaults.shellArgs,
    };
  }

  if (platform === 'windows') {
    if (executableName.includes('pwsh')) {
      return { shellProfile: 'pwsh', shellPath, shellArgs };
    }
    if (executableName.includes('powershell')) {
      return { shellProfile: 'powershell', shellPath, shellArgs };
    }
    if (executableName === 'cmd' || executableName === 'cmd.exe') {
      return { shellProfile: 'cmd', shellPath, shellArgs };
    }
    return { shellProfile: 'custom', shellPath, shellArgs };
  }

  if (executableName.endsWith('zsh')) {
    return { shellProfile: 'zsh', shellPath, shellArgs };
  }
  if (executableName.endsWith('bash')) {
    return { shellProfile: 'bash', shellPath, shellArgs };
  }
  if (executableName.endsWith('fish')) {
    return { shellProfile: 'fish', shellPath, shellArgs };
  }

  return { shellProfile: 'custom', shellPath, shellArgs };
}

export function getDefaultIntegratedShell(platform = detectClientPlatform()): string {
  return resolveIntegratedTerminalShellCommand({
    profile: getDefaultIntegratedTerminalProfile(platform),
    platform,
  });
}

export function getShellCommandDisplayLabel(shell: string): string {
  const executable = shellExecutableName(shell);
  if (!executable) {
    return 'shell';
  }

  const normalized = executable.replace(/["']/g, '');
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
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
