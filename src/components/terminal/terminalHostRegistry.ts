import type { IntegratedTerminalHost } from '../../store/settingsStore';

export type TerminalPaneLocalMessageTone = 'info' | 'success' | 'error';

export interface TerminalPaneHostEntry {
  hostId: IntegratedTerminalHost;
  focus: () => void;
  clear: () => void;
  getSelectionText: () => string;
  appendLocalMessage: (
    label: string,
    body: string,
    tone?: TerminalPaneLocalMessageTone,
  ) => void;
}

const terminalPaneHostRegistry = new Map<string, TerminalPaneHostEntry>();

export function registerTerminalPaneHostEntry(
  paneId: string,
  entry: TerminalPaneHostEntry,
): void {
  terminalPaneHostRegistry.set(paneId, entry);
}

export function unregisterTerminalPaneHostEntry(paneId: string): void {
  terminalPaneHostRegistry.delete(paneId);
}

export function getTerminalPaneHostEntry(
  paneId: string,
): TerminalPaneHostEntry | null {
  return terminalPaneHostRegistry.get(paneId) ?? null;
}

export function hasTerminalPaneHostEntry(paneId: string): boolean {
  return terminalPaneHostRegistry.has(paneId);
}
