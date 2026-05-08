import type {
  BoundOverlayPluginPreviewLaneComponent,
  BoundOverlayPluginSettingsSlotComponent,
  BoundOverlayPluginWorkflowComponent,
} from '../components/pluginRuntime';
import type {
  BoundExplorerViewComponent,
  ExplorerViewDescriptor,
} from '../components/explorer/explorerViewRuntime';
import type {
  ExplorerActivityLaneDefinition,
  ExplorerActivityLaneViewDefinition,
} from './explorerActivityRail';
import type {
  BoundExplorerWidgetComponent,
  ExplorerWidgetDescriptor,
} from '../components/explorer/explorerWidgetRuntime';
import type {
  OverlayPluginPreviewLaneCapabilityFlags,
  OverlayPluginPreviewLaneDescriptor,
  OverlayPluginPreviewLaneMatchRule,
} from './pluginPreviewLanes';
import type { OverlayPluginSettingsSlotDescriptor } from './pluginSettings';
import type { OverlayPluginWorkflowDescriptor } from '../components/explorer/explorerWorkflowContracts';

export interface OverlayPluginCommandContribution {
  id: string;
  pluginId: string;
  pluginName: string;
  name: string;
  command: string;
  description?: string;
  runOnSelect: boolean;
  sourceKind?: 'plugin' | 'vscode-vsix';
  vscodeCommand?: OverlayPluginVsCodeExtensionRuntimeMetadata & {
    commandId: string;
  };
}

export interface OverlayPluginExplorerActionContribution {
  id: string;
  pluginId: string;
  pluginName: string;
  label: string;
  command: string;
  description?: string;
  appliesTo: 'any' | 'file' | 'directory';
  runOnSelect: boolean;
}

export type OverlayPluginContextMenuContributionExecution =
  | {
    kind: 'terminal-template';
    command: string;
    runOnSelect: boolean;
  }
  | {
    kind: 'plugin-backend';
    entry: string;
    args: string[];
  }
  | {
    kind: 'panel-request';
    panelId: string;
    payload: Record<string, string>;
  };

export interface OverlayPluginContextMenuContribution {
  id: string;
  pluginId: string;
  pluginName: string;
  title: string;
  description?: string;
  contexts: Array<'entry' | 'background'>;
  appliesTo: 'any' | 'file' | 'directory';
  group?: string;
  defaultOrder?: number;
  iconName?: string;
  execution: OverlayPluginContextMenuContributionExecution;
}

export interface OverlayPluginPreviewLaneContribution
  extends OverlayPluginPreviewLaneDescriptor {
  match: OverlayPluginPreviewLaneMatchRule;
  capabilities: OverlayPluginPreviewLaneCapabilityFlags;
  component: BoundOverlayPluginPreviewLaneComponent;
}

export interface OverlayPluginExplorerViewContribution
  extends ExplorerViewDescriptor {
  pluginId: string;
  pluginName: string;
  sourceKind: 'plugin';
  sourceLabel: string;
  component: BoundExplorerViewComponent | null;
  error: string | null;
}

export interface OverlayPluginExplorerWidgetContribution
  extends ExplorerWidgetDescriptor {
  pluginId: string;
  pluginName: string;
  sourceKind: 'plugin';
  sourceLabel: string;
  component: BoundExplorerWidgetComponent | null;
  error: string | null;
}

export interface OverlayPluginExplorerActivityLaneViewContribution
  extends ExplorerActivityLaneViewDefinition {
  pluginId: string;
  pluginName: string;
  sourceKind: 'plugin' | 'vscode-vsix';
  sourceLabel: string;
  rendererEntry: string | null;
  runtimeId: string | null;
  runtimeSurfaceId: string | null;
  buildTarget: string | null;
  vscode?: OverlayPluginVsCodeExtensionRuntimeMetadata & {
    viewId: string;
  };
  viewDescriptor: ExplorerViewDescriptor;
  component: BoundExplorerViewComponent | null;
}

export interface OverlayPluginExplorerActivityLaneContribution
  extends ExplorerActivityLaneDefinition {
  pluginId: string;
  pluginName: string;
  sourceKind: 'plugin' | 'vscode-vsix';
  sourceLabel: string;
  vscode?: OverlayPluginVsCodeExtensionRuntimeMetadata;
  views: OverlayPluginExplorerActivityLaneViewContribution[];
}

export interface OverlayPluginVsCodeExtensionRuntimeMetadata {
  extensionId: string;
  extensionName: string;
  extensionRootPath: string;
  packageJsonPath: string;
  originalPath: string;
  main: string | null;
  activationEvents: string[];
}

export interface OverlayPluginSettingsSlotContribution
  extends OverlayPluginSettingsSlotDescriptor {
  component: BoundOverlayPluginSettingsSlotComponent | null;
}

export interface OverlayPluginWorkflowContribution
  extends OverlayPluginWorkflowDescriptor {
  component: BoundOverlayPluginWorkflowComponent;
}

export interface OverlayPluginCommandContext {
  path: string;
  name: string;
  parent: string;
  extension: string;
  stem: string;
  isDirectory: boolean;
  pluginId: string;
  pluginName: string;
}

export interface OverlayTerminalCommandInjectionDetail {
  command: string;
  run?: boolean;
}

export function resolvePluginCommandTemplate(
  template: string,
  context: OverlayPluginCommandContext,
): string {
  const replacements: Record<string, string> = {
    '{path}': context.path,
    '{name}': context.name,
    '{parent}': context.parent,
    '{extension}': context.extension,
    '{stem}': context.stem,
    '{pluginId}': context.pluginId,
    '{pluginName}': context.pluginName,
    '{kind}': context.isDirectory ? 'directory' : 'file',
  };

  return Object.entries(replacements).reduce(
    (resolved, [token, value]) => resolved.split(token).join(value),
    template,
  );
}

export function dispatchTerminalCommand(command: string, run = false): void {
  if (typeof window === 'undefined' || !command.trim()) {
    return;
  }

  window.dispatchEvent(new CustomEvent<OverlayTerminalCommandInjectionDetail>('overlayterm:cmdinject', {
    detail: {
      command,
      run,
    },
  }));
}
