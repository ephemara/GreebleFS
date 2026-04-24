export type ExplorerShellLayoutId = 'balanced' | 'navigator' | 'focus' | 'inspector';
export type ExplorerPreviewPlacement = 'leading' | 'trailing';

export interface ExplorerShellLayoutDefinition {
  id: ExplorerShellLayoutId;
  label: string;
  shortLabel: string;
  description: string;
  defaultSourcesVisible: boolean;
  previewPlacement: ExplorerPreviewPlacement;
  railWidthMultiplier: number;
  previewWidthMultiplier: number;
}

export interface ExplorerShellLayoutWidthSuggestion {
  sidebarWidth: number;
  previewWidth: number;
}

export interface ExplorerShellLayoutWidthInputs {
  layoutId: ExplorerShellLayoutId;
  railWidth: number;
  railMinWidth: number;
  railMaxWidth: number;
  previewWidth: number;
  previewMinWidth: number;
  previewMaxWidth: number;
}

export const EXPLORER_PREVIEW_WIDTH_BOUNDS = {
  min: 220,
  max: 1280,
} as const;

export const explorerShellLayouts: readonly ExplorerShellLayoutDefinition[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    shortLabel: 'Balanced',
    description: 'Keep navigation, content, and preview in an even split.',
    defaultSourcesVisible: true,
    previewPlacement: 'trailing',
    railWidthMultiplier: 1,
    previewWidthMultiplier: 1,
  },
  {
    id: 'navigator',
    label: 'Navigator',
    shortLabel: 'Navigator',
    description: 'Give the rail more weight and keep the preview compact.',
    defaultSourcesVisible: true,
    previewPlacement: 'trailing',
    railWidthMultiplier: 1.18,
    previewWidthMultiplier: 0.86,
  },
  {
    id: 'focus',
    label: 'Focus',
    shortLabel: 'Focus',
    description: 'Hide the rail for a content-first browser view.',
    defaultSourcesVisible: false,
    previewPlacement: 'trailing',
    railWidthMultiplier: 0.84,
    previewWidthMultiplier: 0.9,
  },
  {
    id: 'inspector',
    label: 'Inspector',
    shortLabel: 'Inspector',
    description: 'Pull the preview pane forward and make it much larger.',
    defaultSourcesVisible: true,
    previewPlacement: 'leading',
    railWidthMultiplier: 0.92,
    previewWidthMultiplier: 1.28,
  },
] as const;

const explorerShellLayoutMap = new Map(
  explorerShellLayouts.map(layout => [layout.id, layout] as const),
);

function clampRoundedWidth(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function isExplorerShellLayoutId(value: unknown): value is ExplorerShellLayoutId {
  return typeof value === 'string' && explorerShellLayoutMap.has(value as ExplorerShellLayoutId);
}

export function getExplorerShellLayoutDefinition(
  value: unknown,
): ExplorerShellLayoutDefinition {
  return explorerShellLayoutMap.get(value as ExplorerShellLayoutId)
    ?? explorerShellLayoutMap.get('balanced')!;
}

export function getExplorerShellLayoutWidthSuggestion(
  inputs: ExplorerShellLayoutWidthInputs,
): ExplorerShellLayoutWidthSuggestion {
  const layout = getExplorerShellLayoutDefinition(inputs.layoutId);
  return {
    sidebarWidth: clampRoundedWidth(
      inputs.railWidth * layout.railWidthMultiplier,
      inputs.railMinWidth,
      inputs.railMaxWidth,
    ),
    previewWidth: clampRoundedWidth(
      inputs.previewWidth * layout.previewWidthMultiplier,
      inputs.previewMinWidth,
      inputs.previewMaxWidth,
    ),
  };
}
