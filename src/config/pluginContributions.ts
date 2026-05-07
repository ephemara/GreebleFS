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
  sourceLabel: string;
  component: BoundExplorerViewComponent | null;
  error: string | null;
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
