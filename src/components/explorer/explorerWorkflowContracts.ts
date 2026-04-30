import type { ExecutionContextSnapshot } from "../../runtime/extensionHostApi";

export type ExplorerWorkflowContextKind =
  | "entry"
  | "background"
  | "multi-select"
  | "search-result"
  | "preview-pane";

export type ExplorerWorkflowSize = "sm" | "md" | "lg" | "xl";

export type ExplorerWorkflowStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger";

export type ExplorerWorkflowFooterActionTone =
  | "neutral"
  | "accent"
  | "danger";

export interface ExplorerWorkflowStatusValue {
  label: string;
  tone?: ExplorerWorkflowStatusTone;
}

export interface ExplorerWorkflowFooterAction {
  id: string;
  label: string;
  tone?: ExplorerWorkflowFooterActionTone;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
}

export interface ExplorerWorkflowLaunchRequest<
  TPayload = Record<string, unknown> | null,
> {
  workflowId: string;
  titleOverride?: string | null;
  payload?: TPayload | null;
  source?: "builtin" | "action" | "plugin-api" | "workspace-action";
  pluginId?: string | null;
  targetPaneId?: string | null;
  workspaceTabId?: string | null;
  contextKind?: ExplorerWorkflowContextKind | null;
}

export interface ExplorerWorkflowDefinition<
  TPayload = Record<string, unknown> | null,
> {
  id: string;
  title: string;
  description?: string;
  contexts: ExplorerWorkflowContextKind[];
  defaultSize: ExplorerWorkflowSize;
  keywords?: string[];
  iconName?: string;
  initialPayload?: TPayload | null;
}

export interface ExplorerWorkflowSession<
  TPayload = Record<string, unknown> | null,
> {
  id: string;
  definition: ExplorerWorkflowDefinition<TPayload>;
  launch: ExplorerWorkflowLaunchRequest<TPayload>;
  title: string;
  size: ExplorerWorkflowSize;
  busy: boolean;
  status: ExplorerWorkflowStatusValue | null;
  footerActions: ExplorerWorkflowFooterAction[];
  openedAt: number;
}

export interface ExplorerWorkflowHostControls {
  close: () => Promise<void>;
  setTitle: (title: string) => void;
  setStatus: (status: ExplorerWorkflowStatusValue | null) => void;
  setBusy: (busy: boolean) => void;
  setSize: (size: ExplorerWorkflowSize) => void;
  setFooterActions: (actions: ExplorerWorkflowFooterAction[]) => void;
  setCloseGuard: (guard: (() => Promise<boolean>) | null) => void;
}

export interface ExplorerWorkflowComponentProps<
  TPayload = Record<string, unknown> | null,
> {
  session: ExplorerWorkflowSession<TPayload>;
  launch: ExplorerWorkflowLaunchRequest<TPayload>;
  host: ExplorerWorkflowHostControls;
  executionContext: ExecutionContextSnapshot | null;
}

export interface OverlayPluginWorkflowDescriptor
  extends ExplorerWorkflowDefinition<Record<string, unknown> | null> {
  pluginId: string;
  pluginName: string;
  rendererEntry: string;
}
