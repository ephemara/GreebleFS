function parseBooleanEnv(value: string | undefined): boolean | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }

  return null;
}

export function resolveRuntimeAssetPollingEnabled(): boolean {
  const explicit = parseBooleanEnv(
    (import.meta.env as {
      VITE_OVERLAYTERM_ENABLE_RUNTIME_ASSET_POLLING?: string;
    }).VITE_OVERLAYTERM_ENABLE_RUNTIME_ASSET_POLLING,
  );

  return explicit ?? import.meta.env.DEV;
}
