import { describe, expect, it } from 'vitest';
import {
  moveExplorerChromeControlInResolvedSurfaces,
  resolveExplorerChromeSurfaceLayout,
  type ExplorerChromeControlDefinition,
} from '../config/explorerChromeLayouts';

const toolbarDefinitions: ExplorerChromeControlDefinition[] = [
  { id: 'navigateBack', label: 'Back', surfaces: ['explorerToolbar'] },
  { id: 'addressBar', label: 'Address Bar', surfaces: ['explorerToolbar'] },
  { id: 'toggleSources', label: 'Sources', surfaces: ['explorerToolbar', 'explorerTopbar'] },
  { id: 'experimentalModes', label: 'Experimental Modes', surfaces: ['explorerToolbar', 'explorerTopbar'] },
  { id: 'refresh', label: 'Refresh', surfaces: ['explorerToolbar'] },
  { id: 'railIdentity', label: 'Rail Identity', surfaces: ['railHeader'] },
  { id: 'railClose', label: 'Rail Close', surfaces: ['railHeader'] },
  { id: 'railManageToggle', label: 'Rail Manage Toggle', surfaces: ['railHeader'] },
  { id: 'previewIdentity', label: 'Preview Identity', surfaces: ['previewHeader'] },
  { id: 'previewClose', label: 'Preview Close', surfaces: ['previewHeader'] },
  { id: 'statusItemCount', label: 'Status Item Count', surfaces: ['explorerStatusBar'] },
  { id: 'statusViewToggles', label: 'Status View Toggles', surfaces: ['explorerStatusBar'] },
  { id: 'statusClipboardQueue', label: 'Status Clipboard Queue', surfaces: ['explorerStatusBar'] },
  { id: 'statusPreviewLoading', label: 'Status Preview Loading', surfaces: ['explorerStatusBar'] },
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
    expect(primaryStart?.controls.map((control) => control.controlId)).toContain('toggleSources');
    expect(primaryCenter?.controls.map((control) => control.controlId)).toContain('addressBar');
    expect(primaryEnd?.controls.map((control) => control.controlId)).not.toContain('toggleSources');
  });

  it('supports alternate built-in layouts without changing the component registry', () => {
    const surface = resolveExplorerChromeSurfaceLayout({
      layoutId: 'focused-search',
      surfaceId: 'explorerToolbar',
      controlDefinitions: toolbarDefinitions,
      isControlVisible: () => true,
    });

    const primaryStart = surface.rows[0]?.zones.find((zone) => zone.id === 'primaryStart');
    const primaryEnd = surface.rows[0]?.zones.find((zone) => zone.id === 'primaryEnd');
    const secondaryEnd = surface.rows[1]?.zones.find((zone) => zone.id === 'secondaryEnd');

    expect(primaryEnd?.controls.map((control) => control.controlId)).toContain('refresh');
    expect(primaryStart?.controls.map((control) => control.controlId)).toContain('toggleSources');
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

  it('resolves rail, preview, and status surfaces through the shared chrome layout registry', () => {
    const railHeader = resolveExplorerChromeSurfaceLayout({
      layoutId: 'default',
      surfaceId: 'railHeader',
      controlDefinitions: toolbarDefinitions,
      isControlVisible: () => true,
    });
    const previewHeader = resolveExplorerChromeSurfaceLayout({
      layoutId: 'default',
      surfaceId: 'previewHeader',
      controlDefinitions: toolbarDefinitions,
      isControlVisible: () => true,
    });
    const statusBar = resolveExplorerChromeSurfaceLayout({
      layoutId: 'focused-search',
      surfaceId: 'explorerStatusBar',
      controlDefinitions: toolbarDefinitions,
      isControlVisible: () => true,
    });

    expect(railHeader.rows[0]?.zones.find((zone) => zone.id === 'start')?.controls.map((control) => control.controlId)).toContain('railIdentity');
    expect(railHeader.rows[0]?.zones.find((zone) => zone.id === 'end')?.controls.map((control) => control.controlId)).toContain('railClose');
    expect(railHeader.rows[0]?.zones.find((zone) => zone.id === 'end')?.controls.map((control) => control.controlId)).toContain('railManageToggle');
    expect(previewHeader.rows[0]?.zones.find((zone) => zone.id === 'start')?.controls.map((control) => control.controlId)).toContain('previewIdentity');
    expect(previewHeader.rows[0]?.zones.find((zone) => zone.id === 'end')?.controls.map((control) => control.controlId)).toContain('previewClose');
    expect(statusBar.rows[0]?.zones.find((zone) => zone.id === 'start')?.controls.map((control) => control.controlId)).toContain('statusItemCount');
    expect(statusBar.rows[0]?.zones.find((zone) => zone.id === 'center')?.controls.map((control) => control.controlId)).toEqual([
      'statusClipboardQueue',
      'statusPreviewLoading',
    ]);
    expect(statusBar.rows[0]?.zones.find((zone) => zone.id === 'end')?.controls.map((control) => control.controlId)).toEqual([
      'statusViewToggles',
    ]);
  });

  it('rebuilds override snapshots when a control moves across chrome surfaces', () => {
    const toolbar = resolveExplorerChromeSurfaceLayout({
      layoutId: 'default',
      surfaceId: 'explorerToolbar',
      controlDefinitions: toolbarDefinitions,
      isControlVisible: () => true,
    });
    const statusBar = resolveExplorerChromeSurfaceLayout({
      layoutId: 'default',
      surfaceId: 'explorerStatusBar',
      controlDefinitions: toolbarDefinitions,
      isControlVisible: () => true,
    });

    const override = moveExplorerChromeControlInResolvedSurfaces({
      surfaces: [toolbar, statusBar],
      controlId: 'refresh',
      targetSurfaceId: 'explorerStatusBar',
      targetZoneId: 'end',
      targetIndex: 0,
    });

    expect(override.entries).toContainEqual({
      controlId: 'refresh',
      surfaceId: 'explorerStatusBar',
      zone: 'end',
      order: 10,
    });
  });
});
