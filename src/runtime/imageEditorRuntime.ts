import type {
  ExplorerImageEditorHandle,
  ExplorerImageEditorOptions,
} from '@img-editor-runtime';

export type {
  ExplorerImageEditorHandle,
  ExplorerImageEditorOptions,
} from '@img-editor-runtime';

export async function initExplorerImageEditor(
  containerId: string,
  options: ExplorerImageEditorOptions = {},
): Promise<ExplorerImageEditorHandle> {
  const module = await import('@img-editor-runtime');
  return module.default(containerId, options);
}
