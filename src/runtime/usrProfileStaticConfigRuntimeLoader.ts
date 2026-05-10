export async function refreshUsrProfileStaticConfigRuntimeThroughLoader(): Promise<void> {
  const staticConfigRuntime = await import('./usrProfileStaticConfigRuntime');
  await staticConfigRuntime.refreshUsrProfileStaticConfigRuntime();
}
