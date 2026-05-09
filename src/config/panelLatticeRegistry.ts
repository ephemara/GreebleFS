import type {
  DockStackPlacement,
  WorkbenchSurfaceDefaultVisibility,
  WorkbenchSurfaceIdeRole,
} from './ideWorkbenchLayout';

export const PANEL_LATTICE_PACKAGE_ID = 'greeblefs.lattice.panel-registry';

export type BuiltInPanelId =
  | 'explorer'
  | 'storage'
  | 'terminal'
  | 'git'
  | 'notes'
  | 'go-sample-panel'
  | 'settings'
  | 'plugins';

export type BuiltInPanelRenderKind =
  | 'explorer-workspace'
  | 'storage-panel'
  | 'terminal-overlay'
  | 'git-manager'
  | 'notes-manager'
  | 'go-wasm-smoke'
  | 'settings-page'
  | 'plugins-manager';

export type LatticeWorkbenchSurfacePresentation = 'stack' | 'floating' | 'native-window';
export type LatticeIdeNavigationTier = 'primary' | 'secondary';

export interface BuiltInPanelLatticeDescriptor {
  id: BuiltInPanelId;
  label: string;
  description: string;
  catalogDescription: string;
  defaultOpen: boolean;
  keepMounted: boolean;
  renderKind: BuiltInPanelRenderKind;
  navigation: {
    groupId: string;
    groupLabel: string;
    groupOrder: number;
    itemOrder: number;
  };
  dock: {
    defaultPlacement: DockStackPlacement;
    defaultOrder: number;
    defaultVisibility: WorkbenchSurfaceDefaultVisibility;
    allowedPresentations: readonly LatticeWorkbenchSurfacePresentation[];
    railShortcut: boolean;
    ideRole: WorkbenchSurfaceIdeRole;
    ideNavigationTier: LatticeIdeNavigationTier;
  };
  icon: {
    fallbackSlotId: string;
  };
  catalog: {
    order: number;
    example?: boolean;
  };
  lattice: {
    packageId: typeof PANEL_LATTICE_PACKAGE_ID;
    componentId: string;
    hostModels: readonly string[];
    migrationStatus: 'lattice-descriptor-live' | 'react-renderer-hosted';
  };
}

export const builtInPanelLatticeDescriptors = [
  {
    id: 'explorer',
    label: 'Explorer',
    description: 'File browser and asset navigation.',
    catalogDescription: 'Built-in panel plugin for file browsing.',
    defaultOpen: true,
    keepMounted: true,
    renderKind: 'explorer-workspace',
    navigation: {
      groupId: 'browse',
      groupLabel: 'Browse',
      groupOrder: 10,
      itemOrder: 10,
    },
    dock: {
      defaultPlacement: 'center',
      defaultOrder: 10,
      defaultVisibility: 'visible',
      allowedPresentations: ['stack', 'floating'],
      railShortcut: true,
      ideRole: 'explorer-core',
      ideNavigationTier: 'primary',
    },
    icon: {
      fallbackSlotId: 'folder_open',
    },
    catalog: {
      order: 20,
    },
    lattice: {
      packageId: PANEL_LATTICE_PACKAGE_ID,
      componentId: 'ExplorerPanel',
      hostModels: ['host.explorer', 'host.panels', 'host.profile'],
      migrationStatus: 'lattice-descriptor-live',
    },
  },
  {
    id: 'storage',
    label: 'Storage',
    description: 'Drive treemap, storage forensics, and destructive cleanup.',
    catalogDescription: 'Built-in panel plugin for storage scanning and cleanup.',
    defaultOpen: true,
    keepMounted: true,
    renderKind: 'storage-panel',
    navigation: {
      groupId: 'browse',
      groupLabel: 'Browse',
      groupOrder: 10,
      itemOrder: 20,
    },
    dock: {
      defaultPlacement: 'right-sidebar',
      defaultOrder: 20,
      defaultVisibility: 'hidden',
      allowedPresentations: ['stack', 'floating'],
      railShortcut: true,
      ideRole: 'utility',
      ideNavigationTier: 'secondary',
    },
    icon: {
      fallbackSlotId: 'hard_drive',
    },
    catalog: {
      order: 30,
    },
    lattice: {
      packageId: PANEL_LATTICE_PACKAGE_ID,
      componentId: 'StoragePanel',
      hostModels: ['host.storage', 'host.panels'],
      migrationStatus: 'lattice-descriptor-live',
    },
  },
  {
    id: 'terminal',
    label: 'Terminal',
    description: 'Primary command workspace.',
    catalogDescription: 'Built-in panel plugin for terminal sessions.',
    defaultOpen: true,
    keepMounted: true,
    renderKind: 'terminal-overlay',
    navigation: {
      groupId: 'work',
      groupLabel: 'Work',
      groupOrder: 20,
      itemOrder: 10,
    },
    dock: {
      defaultPlacement: 'bottom-panel',
      defaultOrder: 10,
      defaultVisibility: 'collapsed',
      allowedPresentations: ['stack', 'floating'],
      railShortcut: true,
      ideRole: 'utility',
      ideNavigationTier: 'primary',
    },
    icon: {
      fallbackSlotId: 'terminal_square',
    },
    catalog: {
      order: 10,
    },
    lattice: {
      packageId: PANEL_LATTICE_PACKAGE_ID,
      componentId: 'TerminalPanel',
      hostModels: ['host.terminal', 'host.panels'],
      migrationStatus: 'lattice-descriptor-live',
    },
  },
  {
    id: 'git',
    label: 'Source',
    description: 'Git tools and diff management.',
    catalogDescription: 'Built-in panel plugin for Git workflows.',
    defaultOpen: true,
    keepMounted: false,
    renderKind: 'git-manager',
    navigation: {
      groupId: 'work',
      groupLabel: 'Work',
      groupOrder: 20,
      itemOrder: 20,
    },
    dock: {
      defaultPlacement: 'bottom-panel',
      defaultOrder: 20,
      defaultVisibility: 'collapsed',
      allowedPresentations: ['stack', 'floating'],
      railShortcut: true,
      ideRole: 'utility',
      ideNavigationTier: 'primary',
    },
    icon: {
      fallbackSlotId: 'git_branch',
    },
    catalog: {
      order: 40,
    },
    lattice: {
      packageId: PANEL_LATTICE_PACKAGE_ID,
      componentId: 'SourcePanel',
      hostModels: ['host.repo', 'host.panels'],
      migrationStatus: 'lattice-descriptor-live',
    },
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Scratchpads and structured notes.',
    catalogDescription: 'Built-in panel plugin for note taking.',
    defaultOpen: true,
    keepMounted: false,
    renderKind: 'notes-manager',
    navigation: {
      groupId: 'work',
      groupLabel: 'Work',
      groupOrder: 20,
      itemOrder: 30,
    },
    dock: {
      defaultPlacement: 'right-sidebar',
      defaultOrder: 30,
      defaultVisibility: 'hidden',
      allowedPresentations: ['stack', 'floating'],
      railShortcut: true,
      ideRole: 'utility',
      ideNavigationTier: 'secondary',
    },
    icon: {
      fallbackSlotId: 'sticky_note',
    },
    catalog: {
      order: 50,
    },
    lattice: {
      packageId: PANEL_LATTICE_PACKAGE_ID,
      componentId: 'NotesPanel',
      hostModels: ['host.notes', 'host.panels'],
      migrationStatus: 'lattice-descriptor-live',
    },
  },
  {
    id: 'go-sample-panel',
    label: 'Go Wasm',
    description: 'Interactive smoke test for the Go/Wasm panel runtime and host event bus.',
    catalogDescription: 'Interactive Go/Wasm smoke test panel for the universal runtime host.',
    defaultOpen: false,
    keepMounted: true,
    renderKind: 'go-wasm-smoke',
    navigation: {
      groupId: 'labs',
      groupLabel: 'Labs',
      groupOrder: 45,
      itemOrder: 10,
    },
    dock: {
      defaultPlacement: 'right-sidebar',
      defaultOrder: 45,
      defaultVisibility: 'hidden',
      allowedPresentations: ['stack', 'floating'],
      railShortcut: true,
      ideRole: 'utility',
      ideNavigationTier: 'secondary',
    },
    icon: {
      fallbackSlotId: 'cpu',
    },
    catalog: {
      order: 60,
      example: true,
    },
    lattice: {
      packageId: PANEL_LATTICE_PACKAGE_ID,
      componentId: 'GoWasmSmokePanel',
      hostModels: ['host.runtimes', 'host.panels'],
      migrationStatus: 'lattice-descriptor-live',
    },
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Application-wide appearance, terminal, and explorer settings.',
    catalogDescription: 'Built-in panel plugin for application-wide settings.',
    defaultOpen: false,
    keepMounted: false,
    renderKind: 'settings-page',
    navigation: {
      groupId: 'system',
      groupLabel: 'System',
      groupOrder: 50,
      itemOrder: 10,
    },
    dock: {
      defaultPlacement: 'right-sidebar',
      defaultOrder: 50,
      defaultVisibility: 'hidden',
      allowedPresentations: ['stack', 'floating'],
      railShortcut: true,
      ideRole: 'utility',
      ideNavigationTier: 'secondary',
    },
    icon: {
      fallbackSlotId: 'settings2',
    },
    catalog: {
      order: 70,
    },
    lattice: {
      packageId: PANEL_LATTICE_PACKAGE_ID,
      componentId: 'SettingsPanel',
      hostModels: ['host.settings', 'host.profile', 'host.panels'],
      migrationStatus: 'lattice-descriptor-live',
    },
  },
  {
    id: 'plugins',
    label: 'Plugins',
    description: 'Plugin browser and drop-in loader workspace.',
    catalogDescription: 'Built-in panel plugin for managing folder plugins.',
    defaultOpen: true,
    keepMounted: false,
    renderKind: 'plugins-manager',
    navigation: {
      groupId: 'extensions',
      groupLabel: 'Extensions',
      groupOrder: 40,
      itemOrder: 10,
    },
    dock: {
      defaultPlacement: 'right-sidebar',
      defaultOrder: 60,
      defaultVisibility: 'hidden',
      allowedPresentations: ['stack', 'floating'],
      railShortcut: true,
      ideRole: 'utility',
      ideNavigationTier: 'secondary',
    },
    icon: {
      fallbackSlotId: 'puzzle',
    },
    catalog: {
      order: 80,
    },
    lattice: {
      packageId: PANEL_LATTICE_PACKAGE_ID,
      componentId: 'PluginsPanel',
      hostModels: ['host.plugins', 'host.panels'],
      migrationStatus: 'lattice-descriptor-live',
    },
  },
] as const satisfies readonly BuiltInPanelLatticeDescriptor[];

export function getBuiltInPanelLatticeDescriptor(
  panelId: string,
): BuiltInPanelLatticeDescriptor | null {
  return builtInPanelLatticeDescriptors.find((descriptor) => descriptor.id === panelId) ?? null;
}

export function buildBuiltInPanelCatalogFromLattice() {
  return [...builtInPanelLatticeDescriptors]
    .sort((left, right) => left.catalog.order - right.catalog.order)
    .map((descriptor) => ({
      id: descriptor.id,
      label: descriptor.label,
      description: descriptor.catalogDescription,
      kind: 'built-in-panel' as const,
      ...('example' in descriptor.catalog && descriptor.catalog.example === true ? { example: true } : {}),
    }));
}
