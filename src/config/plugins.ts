export const pluginSystemConfig = {
  pluginsDirectory: 'M:\\OverlayTerm\\plugins',
  frontendExtensions: ['tsx', 'ts', 'jsx', 'js'] as const,
  backendDirectoryName: 'backend',
  runtimeModuleName: 'overlayterm-plugin',
  folderPanelsOpenByDefault: true,
  folderPanelsKeepMounted: false,
  scanIntervalMs: 2000,
} as const;

export type FrontendPluginExtension =
  typeof pluginSystemConfig.frontendExtensions[number];
