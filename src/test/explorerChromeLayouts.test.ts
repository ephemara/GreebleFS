import { describe, expect, it } from 'vitest';
import {
  resolveExplorerChromeSurfaceLayout,
  type ExplorerChromeControlDefinition,
} from '../config/explorerChromeLayouts';

const toolbarDefinitions: ExplorerChromeControlDefinition[] = [
  { id: 'navigateBack', label: 'Back', surfaces: ['explorerToolbar'] },
  { id: 'addressBar', label: 'Address Bar', surfaces: ['explorerToolbar'] },
  { id: 'toggleSources', label: 'Sources', surfaces: ['explorerToolbar', 'explorerTopbar'] },
  { id: 'experimentalModes', label: 'Experimental Modes', surfaces: ['explorerToolbar', 'explorerTopbar'] },
  { id: 'refresh', label: 'Refresh', surfaces: ['explorerToolbar'] },
];

describe('explorer chrome layout resolver', () => {
  it('resolves the default toolbar placements from the built-in layout', () => {
    const surface = resolveExplorerChromeSurfaceLayout({
      layoutId: 'default',
      surfaceId: 'explorerToolbar',
      controlDefinitions: toolbarDefinitions,
      isControlVisible: () => true,
    });

    const primaryStart = surface.rows[0]?.zones.find((zone) => zone.id === 'primaryStart');
    const primaryCenter = surface.rows[0]?.zones.find((zone) => zone.id === 'primaryCenter');
    const primaryEnd = surface.rows[0]?.zones.find((zone) => zone.id === 'primaryEnd');

    expect(primaryStart?.controls.map((control) => control.controlId)).toContain('navigateBack');
    expect(primaryCenter?.controls.map((control) => control.controlId)).toContain('addressBar');
    expect(primaryEnd?.controls.map((control) => control.controlId)).toContain('toggleSources');
  });

  it('supports alternate built-in layouts without changing the component registry', () => {
    const surface = resolveExplorerChromeSurfaceLayout({
      layoutId: 'focused-search',
      surfaceId: 'explorerToolbar',
      controlDefinitions: toolbarDefinitions,
      isControlVisible: () => true,
    });

    const primaryEnd = surface.rows[0]?.zones.find((zone) => zone.id === 'primaryEnd');
    const secondaryStart = surface.rows[1]?.zones.find((zone) => zone.id === 'secondaryStart');
    const secondaryEnd = surface.rows[1]?.zones.find((zone) => zone.id === 'secondaryEnd');

    expect(primaryEnd?.controls.map((control) => control.controlId)).toContain('refresh');
    expect(secondaryStart?.controls.map((control) => control.controlId)).toContain('toggleSources');
    expect(secondaryEnd?.controls.map((control) => control.controlId)).toContain('experimentalModes');
  });

  it('applies per-theme overrides after the built-in layout and before visibility filtering', () => {
    const surface = resolveExplorerChromeSurfaceLayout({
      layoutId: 'default',
      surfaceId: 'explorerToolbar',
      controlDefinitions: toolbarDefinitions,
      override: {
        entries: [
          {
            controlId: 'refresh',
            surfaceId: 'explorerToolbar',
            zone: 'primaryStart',
            order: 5,
          },
        ],
      },
      isControlVisible: (controlId) => controlId !== 'experimentalModes',
    });

    const primaryStart = surface.rows[0]?.zones.find((zone) => zone.id === 'primaryStart');
    const visibleControlIds = surface.visibleControlIds;

    expect(primaryStart?.controls[0]?.controlId).toBe('refresh');
    expect(visibleControlIds).not.toContain('experimentalModes');
  });
});
