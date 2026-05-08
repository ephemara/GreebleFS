import {
  callRuntimeAction,
  type ExecutionContextSnapshot,
} from './externalRuntimeBackend';

export const VSCODE_BRIDGE_RUNTIME_ID = 'vscode-bridge-host';

export interface VsCodeBridgeExtensionMetadata {
  extensionId: string;
  extensionName: string;
  extensionRootPath: string;
  packageJsonPath: string;
  originalPath: string;
  main: string | null;
  activationEvents: string[];
}

export interface VsCodeBridgeCommandMetadata extends VsCodeBridgeExtensionMetadata {
  commandId: string;
}

export interface VsCodeBridgeTreeViewRequest extends VsCodeBridgeExtensionMetadata {
  viewId: string;
  parentHandle?: string | null;
  activationEvent?: string | null;
}

export interface VsCodeBridgeTreeItemCommand {
  command: string;
  title: string;
  arguments?: unknown[];
}

export interface VsCodeBridgeTreeItemIcon {
  kind: string;
  id?: string;
  path?: string;
  light?: string;
  dark?: string;
}

export interface VsCodeBridgeTreeItem {
  id: string;
  handle: string;
  label: string;
  description: string | null;
  tooltip: string | null;
  icon: VsCodeBridgeTreeItemIcon | null;
  collapsibleState: number;
  command: VsCodeBridgeTreeItemCommand | null;
  contextValue: string | null;
}

export interface VsCodeBridgeTreeViewResult {
  extensionId: string;
  viewId: string;
  items: VsCodeBridgeTreeItem[];
  missingProvider?: boolean;
}

export async function activateVsCodeExtension(
  metadata: VsCodeBridgeExtensionMetadata,
  activationEvent?: string | null,
  executionContext?: ExecutionContextSnapshot | null,
): Promise<unknown> {
  return callRuntimeAction({
    runtimeId: VSCODE_BRIDGE_RUNTIME_ID,
    actionId: 'vscode.activateExtension',
    payload: {
      ...metadata,
      activationEvent: activationEvent ?? null,
    },
    executionContext: executionContext ?? null,
  }).then((response) => response.result);
}

export async function executeVsCodeCommand(
  command: VsCodeBridgeCommandMetadata,
  args: unknown[] = [],
  executionContext?: ExecutionContextSnapshot | null,
): Promise<unknown> {
  return callRuntimeAction({
    runtimeId: VSCODE_BRIDGE_RUNTIME_ID,
    actionId: 'vscode.executeCommand',
    payload: {
      ...command,
      args,
    },
    executionContext: executionContext ?? null,
  }).then((response) => response.result);
}

export async function getVsCodeTreeView(
  request: VsCodeBridgeTreeViewRequest,
  executionContext?: ExecutionContextSnapshot | null,
): Promise<VsCodeBridgeTreeViewResult> {
  return callRuntimeAction<VsCodeBridgeTreeViewResult>({
    runtimeId: VSCODE_BRIDGE_RUNTIME_ID,
    actionId: 'vscode.getTreeView',
    payload: request,
    executionContext: executionContext ?? null,
  }).then((response) => response.result);
}

export async function refreshVsCodeTreeView(
  request: VsCodeBridgeTreeViewRequest,
  executionContext?: ExecutionContextSnapshot | null,
): Promise<unknown> {
  return callRuntimeAction({
    runtimeId: VSCODE_BRIDGE_RUNTIME_ID,
    actionId: 'vscode.refreshTreeView',
    payload: request,
    executionContext: executionContext ?? null,
  }).then((response) => response.result);
}
