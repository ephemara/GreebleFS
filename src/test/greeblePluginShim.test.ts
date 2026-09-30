/**
 * greeblePluginShim — proof that legacy definePlugin packs surface
 * through the API as panel + previewLane + settingsSlot + workflow
 * contributions, owned by the plugin id, with fallback adapters when no
 * live host providers are set.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  GreeblePanelContribution,
  GreeblePreviewLaneContribution,
  GreebleRenderProps,
  GreebleSettingsSlotContribution,
  GreebleWorkflowContribution,
} from '../api/greeble';
import type {
  LoadedOverlayPlugin,
  OverlayPluginApi,
  OverlayPluginProps,
} from '../components/pluginRuntime';
import {
  adoptLegacyPlugin,
  adoptLoadedPluginPacks,
  setLegacyPluginHostProviders,
  withdrawLegacyPlugin,
} from '../runtime/greeblePluginShim';
import {
  getGreebleDomainBook,
  resetGreebleHostForTests,
} from '../runtime/greebleHost';

function makePlugin(
  overrides?: Partial<LoadedOverlayPlugin>,
): LoadedOverlayPlugin {
  return {
    id: 'demo-plugin',
    name: 'Demo Plugin',
    filePath: 'demo-plugin.tsx',
    pluginRoot: 'plugins',
    pluginDirectory: 'plugins/demo-plugin',
    backendDirectory: 'plugins/demo-plugin/backend',
    enablementKey: 'demo-plugin',
    description: 'A legacy demo plugin.',
    modified: 0,
    enabled: true,
    defaultOpen: false,
    keepMounted: true,
    component: PanelBody,
    error: null,
    diagnostics: {
      sourceKind: 'file-plugin',
      sourceLabel: 'demo-plugin.tsx',
      category: 'General',
      tags: [],
      testFiles: [],
      warnings: [],
      capabilities: {
        panel: true,
        themes: 0,
        shaders: 0,
        fonts: 0,
        commands: 0,
        actions: 0,
        explorerActions: 0,
        contextMenuItems: 0,
        previewLanes: 0,
        settingsSlots: 0,
      },
    },
    ...overrides,
  };
}

function PanelBody(): React.ReactElement {
  return React.createElement('div', null, 'panel-body-marker');
}

function LaneBody(): React.ReactElement {
  return React.createElement('div', null, 'lane-body-marker');
}

function SlotBody(): React.ReactElement {
  return React.createElement('div', null, 'slot-body-marker');
}

function WorkflowBody(): React.ReactElement {
  return React.createElement('div', null, 'workflow-body-marker');
}

function stubProps(): GreebleRenderProps {
  return { data: {}, ctx: {}, render: {} } as unknown as GreebleRenderProps;
}

function renderComponent(component: unknown): string {
  return renderToStaticMarkup(
    React.createElement(component as React.ComponentType<any>, stubProps()),
  );
}

afterEach(() => {
  setLegacyPluginHostProviders(null);
  resetGreebleHostForTests();
});

describe('legacy definePlugin shim', () => {
  it('adopts a plugin panel plus lane, slot, and workflow with titles', () => {
    const adopted = adoptLegacyPlugin({
      pluginId: 'demo-plugin',
      plugin: makePlugin(),
      lanes: [{ id: 'demo-lane', title: 'Demo Lane', component: LaneBody }],
      slots: [{ id: 'demo-slot', title: 'Demo Slot', component: SlotBody }],
      workflows: [{ id: 'demo-flow', title: 'Demo Flow', component: WorkflowBody }],
    });
    expect(adopted).toEqual(['demo-plugin', 'demo-lane', 'demo-slot', 'demo-flow']);

    const panels = getGreebleDomainBook().define<GreeblePanelContribution>('panel').list();
    expect(panels.map((entry) => entry.id)).toContain('demo-plugin');
    expect(panels.find((entry) => entry.id === 'demo-plugin')?.title).toBe(
      'Demo Plugin',
    );

    const lanes = getGreebleDomainBook().define<GreeblePreviewLaneContribution>('previewLane').list();
    expect(lanes.find((entry) => entry.id === 'demo-lane')?.title).toBe(
      'Demo Lane',
    );

    const slots = getGreebleDomainBook().define<GreebleSettingsSlotContribution>('settingsSlot').list();
    expect(slots.find((entry) => entry.id === 'demo-slot')?.title).toBe(
      'Demo Slot',
    );

    const workflows = getGreebleDomainBook().define<GreebleWorkflowContribution>('workflow').list();
    expect(workflows.find((entry) => entry.id === 'demo-flow')?.title).toBe(
      'Demo Flow',
    );
  });

  it('re-adopting is idempotent and withdraw empties the book', () => {
    const options = {
      pluginId: 'demo-plugin',
      plugin: makePlugin(),
      lanes: [{ id: 'demo-lane', title: 'Demo Lane', component: LaneBody }],
      slots: [{ id: 'demo-slot', title: 'Demo Slot', component: SlotBody }],
      workflows: [{ id: 'demo-flow', title: 'Demo Flow', component: WorkflowBody }],
    };
    adoptLegacyPlugin(options);
    adoptLegacyPlugin(options);

    expect(
      getGreebleDomainBook().define<GreeblePanelContribution>('panel').list()
        .filter((entry) => entry.id === 'demo-plugin'),
    ).toHaveLength(1);
    expect(
      getGreebleDomainBook().define<GreeblePreviewLaneContribution>('previewLane').list()
        .filter((entry) => entry.id === 'demo-lane'),
    ).toHaveLength(1);
    expect(
      getGreebleDomainBook().define<GreebleSettingsSlotContribution>('settingsSlot').list()
        .filter((entry) => entry.id === 'demo-slot'),
    ).toHaveLength(1);
    expect(
      getGreebleDomainBook().define<GreebleWorkflowContribution>('workflow').list()
        .filter((entry) => entry.id === 'demo-flow'),
    ).toHaveLength(1);

    expect(withdrawLegacyPlugin('demo-plugin')).toBeGreaterThan(0);
    expect(getGreebleDomainBook().define<GreeblePanelContribution>('panel').list()).toHaveLength(0);
    expect(getGreebleDomainBook().define<GreeblePreviewLaneContribution>('previewLane').list()).toHaveLength(0);
    expect(getGreebleDomainBook().define<GreebleSettingsSlotContribution>('settingsSlot').list()).toHaveLength(0);
    expect(getGreebleDomainBook().define<GreebleWorkflowContribution>('workflow').list()).toHaveLength(0);
  });

  it('skips null, undefined, and failed inputs', () => {
    expect(
      adoptLegacyPlugin({
        pluginId: 'empty-plugin',
        plugin: null,
        lanes: [null, undefined, { component: null }],
        slots: null,
        workflows: undefined,
      }),
    ).toEqual([]);
    expect(adoptLegacyPlugin({ pluginId: '' })).toEqual([]);
    expect(withdrawLegacyPlugin('')).toBe(0);

    // An errored plugin registers no panel, but its lanes still adopt.
    const adopted = adoptLegacyPlugin({
      pluginId: 'broken-plugin',
      plugin: makePlugin({
        id: 'broken-plugin',
        name: 'Broken Plugin',
        component: PanelBody,
        error: 'boom',
      }),
      lanes: [{ title: 'Broken Lane', component: LaneBody }],
    });
    expect(adopted).toHaveLength(1);
    expect(
      getGreebleDomainBook().define<GreeblePanelContribution>('panel').list()
        .find((entry) => entry.id === 'broken-plugin'),
    ).toBeUndefined();
    expect(
      getGreebleDomainBook().define<GreeblePreviewLaneContribution>('previewLane').list(),
    ).toHaveLength(1);
  });

  it('adoptLoadedPluginPacks batches packs and tolerates empties', () => {
    expect(adoptLoadedPluginPacks(null)).toEqual([]);
    expect(adoptLoadedPluginPacks(undefined)).toEqual([]);
    const adopted = adoptLoadedPluginPacks([
      null,
      undefined,
      { pluginId: '', plugin: null },
      {
        pluginId: 'demo-plugin',
        plugin: makePlugin(),
        lanes: [{ id: 'demo-lane', title: 'Demo Lane', component: LaneBody }],
      },
      // pluginId falls back to the plugin's own id.
      { plugin: makePlugin({ id: 'second-plugin', name: 'Second' }) },
    ]);
    expect(adopted).toContain('demo-plugin');
    expect(adopted).toContain('demo-lane');
    expect(adopted).toContain('second-plugin');
    expect(withdrawLegacyPlugin('demo-plugin')).toBeGreaterThan(0);
    expect(withdrawLegacyPlugin('second-plugin')).toBeGreaterThan(0);
  });

  it('adapters render a fallback notice without providers', () => {
    setLegacyPluginHostProviders(null);
    adoptLegacyPlugin({
      pluginId: 'demo-plugin',
      plugin: makePlugin(),
      lanes: [{ id: 'demo-lane', title: 'Demo Lane', component: LaneBody }],
      slots: [{ id: 'demo-slot', title: 'Demo Slot', component: SlotBody }],
      workflows: [{ id: 'demo-flow', title: 'Demo Flow', component: WorkflowBody }],
    });

    const panel = getGreebleDomainBook().define<GreeblePanelContribution>('panel').list()
      .find((entry) => entry.id === 'demo-plugin');
    const lane = getGreebleDomainBook().define<GreeblePreviewLaneContribution>('previewLane').list()
      .find((entry) => entry.id === 'demo-lane');
    const slot = getGreebleDomainBook().define<GreebleSettingsSlotContribution>('settingsSlot').list()
      .find((entry) => entry.id === 'demo-slot');
    const workflow = getGreebleDomainBook().define<GreebleWorkflowContribution>('workflow').list()
      .find((entry) => entry.id === 'demo-flow');

    expect(typeof panel?.component).toBe('function');
    expect(typeof lane?.component).toBe('function');
    expect(typeof slot?.component).toBe('function');
    expect(typeof workflow?.component).toBe('function');

    // None of the adapters crash — each degrades to a fallback notice.
    expect(renderComponent(panel?.component)).toContain('needs the plugin host surface');
    expect(renderComponent(panel?.component)).toContain('Demo Plugin');
    expect(renderComponent(lane?.component)).toContain('needs the plugin host surface');
    expect(renderComponent(lane?.component)).toContain('Demo Lane');
    expect(renderComponent(slot?.component)).toContain('needs the plugin host surface');
    expect(renderComponent(workflow?.component)).toContain('needs the plugin host surface');
  });

  it('adapters use live providers when set', () => {
    const appearance = {
      theme: {},
      fonts: { ui: 'ui-font', mono: 'mono-font' },
    } as unknown as OverlayPluginProps['appearance'];
    setLegacyPluginHostProviders({
      createApi: () => ({} as OverlayPluginApi),
      getAppearance: () => appearance,
      renderPreviewLane: (request) =>
        React.createElement(request.component as React.ComponentType, null),
    });
    adoptLegacyPlugin({
      pluginId: 'demo-plugin',
      plugin: makePlugin(),
      lanes: [{ id: 'demo-lane', title: 'Demo Lane', component: LaneBody }],
    });

    const panel = getGreebleDomainBook().define<GreeblePanelContribution>('panel').list()
      .find((entry) => entry.id === 'demo-plugin');
    const lane = getGreebleDomainBook().define<GreeblePreviewLaneContribution>('previewLane').list()
      .find((entry) => entry.id === 'demo-lane');

    expect(renderComponent(panel?.component)).toContain('panel-body-marker');
    expect(renderComponent(lane?.component)).toContain('lane-body-marker');
  });
});
