import { describe, expect, it } from 'vitest';
import {
  getNextActivePanelId,
  reorderPanelIds,
  syncOpenPanelIds,
  togglePanelId,
} from '../components/panelUtils';

describe('panelUtils', () => {
  it('reorders open panel ids', () => {
    expect(reorderPanelIds(['terminal', 'explorer', 'git'], 'git', 'terminal')).toEqual([
      'git',
      'terminal',
      'explorer',
    ]);
  });

  it('toggles panel visibility', () => {
    expect(togglePanelId(['terminal', 'explorer'], 'explorer')).toEqual(['terminal']);
    expect(togglePanelId(['terminal'], 'notes')).toEqual(['terminal', 'notes']);
  });

  it('syncs open ids with available/default panels', () => {
    expect(syncOpenPanelIds(['terminal', 'ghost'], ['terminal', 'notes'], ['notes'])).toEqual([
      'terminal',
      'notes',
    ]);
  });

  it('picks the next active panel after close', () => {
    expect(getNextActivePanelId(['terminal', 'explorer', 'git'], 'explorer')).toBe('git');
    expect(getNextActivePanelId(['terminal'], 'terminal')).toBeNull();
  });
});
