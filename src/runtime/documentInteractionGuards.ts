const NATIVE_TEXT_SELECTION_SURFACE_SELECTOR =
  '[data-native-text-selection-surface="true"]';

function isEditableElement(element: HTMLElement): boolean {
  const tagName = element.tagName;
  return Boolean(
    tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      element.isContentEditable,
  );
}

export function resolveEventTargetElement(target: EventTarget | null): HTMLElement | null {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

export function shouldAllowNativeContextMenu(target: EventTarget | null): boolean {
  const element = resolveEventTargetElement(target);
  return element
    ? isEditableElement(element) || isNativeTextSelectionSurfaceTarget(element)
    : false;
}

export function shouldAllowDocumentSelection(target: EventTarget | null): boolean {
  const element = resolveEventTargetElement(target);
  if (!element) {
    return false;
  }

  return (
    isEditableElement(element) ||
    isNativeTextSelectionSurfaceTarget(element) ||
    Boolean(element.closest('.monaco-editor, pre, code'))
  );
}

export function isNativeTextSelectionSurfaceTarget(
  target: EventTarget | null,
): boolean {
  const element = resolveEventTargetElement(target);
  return Boolean(element?.closest(NATIVE_TEXT_SELECTION_SURFACE_SELECTOR));
}

export function hasNativeTextSelectionInAllowedSurface(
  selection: Selection | null = typeof window === 'undefined'
    ? null
    : window.getSelection(),
): boolean {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }

  for (let rangeIndex = 0; rangeIndex < selection.rangeCount; rangeIndex += 1) {
    const range = selection.getRangeAt(rangeIndex);
    if (
      isNativeTextSelectionSurfaceTarget(range.commonAncestorContainer) ||
      isNativeTextSelectionSurfaceTarget(range.startContainer) ||
      isNativeTextSelectionSurfaceTarget(range.endContainer)
    ) {
      return true;
    }
  }

  return false;
}
