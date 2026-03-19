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
  openIds: string[],
  availableIds: string[],
  defaultOpenIds: string[],
): string[] {
  return derivePanelOpenState({
    savedOpenIds: openIds,
    dismissedPanelIds: [],
    availableIds,
    defaultOpenIds,
    enforcedOpenIds: [],
  });
}

export function derivePanelOpenState(args: {
  savedOpenIds: string[];
  dismissedPanelIds: string[];
  availableIds: string[],
  defaultOpenIds: string[],
  enforcedOpenIds: string[],
}): string[] {
  const availableSet = new Set(args.availableIds);
  const savedOpenIds = args.savedOpenIds.filter(id => availableSet.has(id));
  const dismissedSet = new Set(args.dismissedPanelIds.filter(id => availableSet.has(id)));
  const defaultOpenIds = args.defaultOpenIds
    .filter(id => availableSet.has(id) && !dismissedSet.has(id));
  const enforcedOpenIds = args.enforcedOpenIds.filter(id => availableSet.has(id));

  return Array.from(new Set([
    ...savedOpenIds,
    ...defaultOpenIds,
    ...enforcedOpenIds,
  ]));
}

export function getNextActivePanelId(openIds: string[], closedId: string): string | null {
  const next = openIds.filter(id => id !== closedId);
  return next[next.length - 1] ?? null;
}
