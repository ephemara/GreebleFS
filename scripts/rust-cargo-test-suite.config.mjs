export const rustCargoTestWorkspaceDefinitions = [
  {
    id: 'root',
    displayName: 'Root Rust workspace',
    manifestPath: 'Cargo.toml',
  },
  {
    id: 'vendored-yazi',
    displayName: 'Vendored Yazi workspace',
    manifestPath: 'crates/fileexplorer/crates/Cargo.toml',
  },
];

export const rustCargoTestPackagePlatformRules = [
  {
    manifestPathPrefix: 'crates/file-opening-linux/',
    supportedPlatforms: ['linux'],
    skipReason: 'Linux-only package',
  },
  {
    manifestPathPrefix: 'crates/file-opening-macos/',
    supportedPlatforms: ['darwin'],
    skipReason: 'macOS-only package',
  },
  {
    manifestPathPrefix: 'crates/file-opening-windows/',
    supportedPlatforms: ['win32'],
    skipReason: 'Windows-only package',
  },
  {
    manifestPathPrefix: 'crates/macos/',
    supportedPlatforms: ['darwin'],
    skipReason: 'macOS-only native bridge package',
  },
];
