const importUnanalyzedModule = new Function("modulePath", "return import(modulePath)") as <Module>(
  modulePath: string,
) => Promise<Module>;

type UsrProfileStaticConfigRuntimeModule = {
  refreshUsrProfileStaticConfigRuntime: () => Promise<void> | void;
};

export async function refreshUsrProfileStaticConfigRuntimeThroughLoader(): Promise<void> {
  const staticConfigRuntime = await importUnanalyzedModule<UsrProfileStaticConfigRuntimeModule>(
    '/src/runtime/usrProfileStaticConfigRuntime.ts',
  );
  await staticConfigRuntime.refreshUsrProfileStaticConfigRuntime();
}
