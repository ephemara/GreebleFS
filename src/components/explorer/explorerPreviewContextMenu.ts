import type {
  ExplorerContextMenuItemGroup,
  ExplorerMenuContextKind,
  ExplorerMenuInvocationContext,
  ExplorerMenuInvocationEntry,
  ExplorerMenuTone,
} from '../../config/explorerContextMenu';

export interface ExplorerPreviewContextMenuActionContext {
  invocation: ExplorerMenuInvocationContext;
  targetEntries: ExplorerMenuInvocationEntry[];
  primaryEntry: ExplorerMenuInvocationEntry | null;
}

type ExplorerPreviewContextMenuActionHandler = (
  context: ExplorerPreviewContextMenuActionContext,
) => void | Promise<void>;

type ExplorerPreviewContextMenuActionAppliesTo = 'any' | 'file' | 'directory';

export interface ExplorerPreviewContextMenuAction {
  id: string;
  title: string;
  description?: string;
  iconName?: string;
  tone?: ExplorerMenuTone;
  group?: ExplorerContextMenuItemGroup;
  defaultOrder?: number;
  priority?: number;
  shortcutId?: string;
  contexts?: ExplorerMenuContextKind[];
  appliesTo?: ExplorerPreviewContextMenuActionAppliesTo;
  onSelect: ExplorerPreviewContextMenuActionHandler;
}

export interface ExplorerPreviewContextMenuActionOverride {
  id: string;
  hidden?: boolean;
  title?: string;
  description?: string;
  iconName?: string;
  tone?: ExplorerMenuTone;
  group?: ExplorerContextMenuItemGroup;
  defaultOrder?: number;
  priority?: number;
  shortcutId?: string;
  contexts?: ExplorerMenuContextKind[];
  appliesTo?: ExplorerPreviewContextMenuActionAppliesTo;
  onSelect?: ExplorerPreviewContextMenuActionHandler;
}

export interface ExplorerPreviewContextMenuWorkflowOverlay {
  workflowTabId: string;
  actions: ExplorerPreviewContextMenuActionOverride[];
}

export interface ExplorerPreviewContextMenuRegistration {
  previewKind: string;
  baseActions: ExplorerPreviewContextMenuAction[];
  workflowOverlays?: ExplorerPreviewContextMenuWorkflowOverlay[];
}

export interface ExplorerResolvedPreviewContextMenuAction
  extends ExplorerPreviewContextMenuAction {
  tone: ExplorerMenuTone;
  group: ExplorerContextMenuItemGroup;
  defaultOrder: number;
  priority: number;
  contexts: ExplorerMenuContextKind[];
  appliesTo: ExplorerPreviewContextMenuActionAppliesTo;
}

function normalizePreviewAction(
  action:
    | ExplorerPreviewContextMenuAction
    | (Partial<ExplorerResolvedPreviewContextMenuAction> & {
        id: string;
      }),
): ExplorerResolvedPreviewContextMenuAction | null {
  const title = action.title?.trim();
  if (!title || typeof action.onSelect !== 'function') {
    return null;
  }

  const fallbackOrder = Number.isFinite(action.defaultOrder)
    ? Number(action.defaultOrder)
    : Number.isFinite(action.priority)
      ? Number(action.priority)
      : 500;
  const defaultOrder = Number.isFinite(action.defaultOrder)
    ? Number(action.defaultOrder)
    : fallbackOrder;
  const priority = Number.isFinite(action.priority)
    ? Number(action.priority)
    : defaultOrder;

  return {
    id: action.id,
    title,
    description: action.description?.trim() || undefined,
    iconName: action.iconName?.trim() || undefined,
    tone: action.tone ?? 'safe',
    group: action.group ?? 'preview',
    defaultOrder,
    priority,
    shortcutId: action.shortcutId?.trim() || undefined,
    contexts:
      action.contexts && action.contexts.length > 0
        ? [...action.contexts]
        : ['preview-pane'],
    appliesTo: action.appliesTo ?? 'any',
    onSelect: action.onSelect,
  };
}

export function resolveExplorerPreviewContextMenuActions(
  registration: ExplorerPreviewContextMenuRegistration | null | undefined,
  workflowTabId: string | null | undefined,
): ExplorerResolvedPreviewContextMenuAction[] {
  if (!registration) {
    return [];
  }

  const baseActions = registration.baseActions
    .map((action) => normalizePreviewAction(action))
    .filter(
      (action): action is ExplorerResolvedPreviewContextMenuAction => action != null,
    );
  if (!workflowTabId) {
    return baseActions;
  }

  const overlay = registration.workflowOverlays?.find(
    (candidate) => candidate.workflowTabId === workflowTabId,
  );
  if (!overlay) {
    return baseActions;
  }

  const actionsById = new Map(baseActions.map((action) => [action.id, action]));
  const orderedIds = baseActions.map((action) => action.id);

  for (const override of overlay.actions) {
    if (override.hidden) {
      actionsById.delete(override.id);
      continue;
    }

    const existingAction = actionsById.get(override.id);
    const nextAction = normalizePreviewAction({
      ...existingAction,
      ...override,
      id: override.id,
      title: override.title ?? existingAction?.title ?? '',
      onSelect: override.onSelect ?? existingAction?.onSelect,
    });
    if (!nextAction) {
      continue;
    }

    actionsById.set(override.id, nextAction);
    if (!orderedIds.includes(override.id)) {
      orderedIds.push(override.id);
    }
  }

  return orderedIds
    .map((actionId) => actionsById.get(actionId) ?? null)
    .filter(
      (action): action is ExplorerResolvedPreviewContextMenuAction => action != null,
    );
}
