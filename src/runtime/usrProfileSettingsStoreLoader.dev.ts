type SettingsStoreModule = {
  useSettingsStore: {
    persist?: { rehydrate?: () => Promise<void> | void };
    subscribe: (listener: (state: any, previousState: any) => void) => () => void;
    getState: () => { settings: unknown };
  };
};

const importUnanalyzedModule = new Function("modulePath", "return import(modulePath)") as <Module>(
  modulePath: string,
) => Promise<Module>;

async function loadSettingsStoreModule(): Promise<SettingsStoreModule> {
  return importUnanalyzedModule<SettingsStoreModule>('/src/store/settingsStore.ts');
}

export async function rehydrateSettingsStoreThroughLoader(): Promise<void> {
  const settingsStoreModule = await loadSettingsStoreModule();
  const persistApi = (settingsStoreModule.useSettingsStore as typeof settingsStoreModule.useSettingsStore & {
    persist?: { rehydrate?: () => Promise<void> | void };
  }).persist;
  await persistApi?.rehydrate?.();
}

export async function loadSettingsStoreForUsrProfilePersistence(): Promise<SettingsStoreModule> {
  return loadSettingsStoreModule();
}
