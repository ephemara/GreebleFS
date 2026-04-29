import { describe, expect, it } from 'vitest';

import {
  buildExplorerPreviewWorkflowTabs,
  mergeExplorerPreviewWildcardWorkflowTabs,
  normalizeExplorerPreviewWorkbenchChromeMetadata,
  resolveExplorerPreviewWorkflowActiveTab,
} from '../components/explorer/explorerPreviewWorkflowTabs';

describe('explorer preview workflow tabs', () => {
  it('normalizes reserved and duplicate wildcard tabs', () => {
    const tabs = buildExplorerPreviewWorkflowTabs({
      includePreviewTab: true,
      includeEditTab: true,
      wildcardTabs: [
        { id: 'preview', label: 'Reserved Preview', baseMode: 'preview' },
        { id: 'edit', label: 'Reserved Edit', baseMode: 'edit' },
        { id: 'vst', label: 'VST', baseMode: 'edit' },
        { id: 'VST', label: 'Duplicate VST', baseMode: 'edit' },
        { id: ' render ', label: ' Render ', baseMode: 'preview' },
        { id: '', label: 'Missing Id', baseMode: 'edit' },
      ],
    });

    expect(tabs.map(tab => ({
      id: tab.id,
      label: tab.label,
      baseMode: tab.baseMode,
      kind: tab.kind,
    }))).toEqual([
      { id: 'preview', label: 'Preview', baseMode: 'preview', kind: 'preview' },
      { id: 'edit', label: 'Edit', baseMode: 'edit', kind: 'edit' },
      { id: 'vst', label: 'VST', baseMode: 'edit', kind: 'wildcard' },
      { id: 'render', label: 'Render', baseMode: 'preview', kind: 'wildcard' },
    ]);
  });

  it('lets mounted workbenches replace manifest wildcard metadata by id', () => {
    const mergedTabs = mergeExplorerPreviewWildcardWorkflowTabs(
      [{ id: 'vst', label: 'VST', baseMode: 'edit' }],
      [
        { id: 'vst', label: 'VST Rack', baseMode: 'edit' },
        { id: 'meters', label: 'Meters', baseMode: 'preview' },
      ],
    );

    expect(mergedTabs).toEqual([
      { id: 'vst', label: 'VST Rack', baseMode: 'edit' },
      { id: 'meters', label: 'Meters', baseMode: 'preview' },
    ]);
  });

  it('normalizes preview workbench chrome defaults independently of legacy capabilities', () => {
    const chrome = normalizeExplorerPreviewWorkbenchChromeMetadata(
      {
        includePreviewTab: true,
        topBarLayoutId: 'compact-preview-header',
        wildcardTabs: [{ id: 'vst', label: 'VST', baseMode: 'edit' }],
      },
      {
        includeEditTab: true,
        topBarDensity: 'compact',
      },
    );

    expect(chrome).toEqual({
      includePreviewTab: true,
      includeEditTab: true,
      wildcardTabs: [{ id: 'vst', label: 'VST', baseMode: 'edit' }],
      topBarLayoutId: 'compact-preview-header',
      topBarDensity: 'compact',
    });
  });

  it('resolves invalid active ids back to the first visible workflow tab', () => {
    const tabs = buildExplorerPreviewWorkflowTabs({
      includePreviewTab: false,
      includeEditTab: true,
      wildcardTabs: [{ id: 'inspect', label: 'Inspect', baseMode: 'edit' }],
    });

    expect(resolveExplorerPreviewWorkflowActiveTab(tabs, 'missing')).toMatchObject({
      id: 'edit',
      baseMode: 'edit',
    });
  });
});
