export interface BuildLinuxGraphicsEnvironmentOptions {
  tauriCommand?: string | null;
  existingEnv?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
}

export interface BuildManagedContentDirectoryEnvironmentOptions {
  tauriCommand?: string | null;
  projectRootPath?: string;
  existingEnv?: Record<string, string | undefined>;
}

export function buildLinuxGraphicsEnvironment(
  options?: BuildLinuxGraphicsEnvironmentOptions,
): Record<string, string>;

export function buildManagedContentDirectoryEnvironment(
  options?: BuildManagedContentDirectoryEnvironmentOptions,
): Record<string, string>;
