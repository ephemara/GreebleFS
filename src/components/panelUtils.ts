export function reorderPanelIds(ids: string[], draggedId: string, targetId: string): string[] {
  if (draggedId === targetId) return ids;

  const next = [...ids];
  const draggedIndex = next.indexOf(draggedId);
  const targetIndex = next.indexOf(targetId);

  if (draggedIndex === -1 || targetIndex === -1) return ids;

  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  return next;
}

export function togglePanelId(ids: string[], panelId: string): string[] {
  return ids.includes(panelId)
    ? ids.filter(id => id !== panelId)
    : [...ids, panelId];
}

export function syncOpenPanelIds(
  currentIds: string[],
  availableIds: string[],
  defaultOpenIds: string[],
): string[] {
  const currentAvailable = currentIds.filter(id => availableIds.includes(id));
  const missingDefaults = defaultOpenIds.filter(id => !currentAvailable.includes(id));
  return [...currentAvailable, ...missingDefaults];
}

export function getNextActivePanelId(openIds: string[], closedId: string): string | null {
  const next = openIds.filter(id => id !== closedId);
  return next[next.length - 1] ?? null;
}
