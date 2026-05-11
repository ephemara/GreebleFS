type TauriClientModule = {
  commands: any;
  unwrapTauriResult: <T>(result: T) => T;
};

const importUnanalyzedModule = new Function("modulePath", "return import(modulePath)") as <Module>(
  modulePath: string,
) => Promise<Module>;

export async function loadTauriClientThroughLoader(): Promise<TauriClientModule> {
  return importUnanalyzedModule<TauriClientModule>('/src/runtime/tauriClient.ts');
}
