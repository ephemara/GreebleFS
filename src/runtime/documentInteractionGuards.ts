function isEditableElement(element: HTMLElement): boolean {
  const tagName = element.tagName;
  return Boolean(tagName === 'INPUT' || tagName === 'TEXTAREA' || element.isContentEditable);
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
  return element ? isEditableElement(element) : false;
}

export function shouldAllowDocumentSelection(target: EventTarget | null): boolean {
  const element = resolveEventTargetElement(target);
  if (!element) {
    return false;
  }

  return isEditableElement(element) || Boolean(element.closest('.monaco-editor, pre, code'));
}
