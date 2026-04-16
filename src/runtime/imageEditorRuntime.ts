import type { CanvasOptions } from 'fabric';
import type { ImageEditor } from '../../packages/img-editor/src/editor/index.ts';

export type ExplorerImageEditorHandle = ImageEditor;
export type ExplorerImageEditorOptions = Partial<CanvasOptions>;

export async function initExplorerImageEditor(
  containerId: string,
  options: ExplorerImageEditorOptions = {},
): Promise<ExplorerImageEditorHandle> {
  const module = await import('../../packages/img-editor/src/main.ts');
  return module.default(containerId, options);
}
