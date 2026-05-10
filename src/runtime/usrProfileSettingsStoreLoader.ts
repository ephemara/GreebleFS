type SettingsStoreModule = typeof import('../store/settingsStore');

export async function rehydrateSettingsStoreThroughLoader(): Promise<void> {
  const settingsStoreModule = await import('../store/settingsStore');
  const persistApi = (settingsStoreModule.useSettingsStore as typeof settingsStoreModule.useSettingsStore & {
    persist?: { rehydrate?: () => Promise<void> | void };
  }).persist;
  await persistApi?.rehydrate?.();
}

export async function loadSettingsStoreForUsrProfilePersistence(): Promise<SettingsStoreModule> {
  return import('../store/settingsStore');
}
