import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const flexLayoutModelFromJsonSpy = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 72,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        size: 72,
        start: index * 72,
      })),
  }),
}));

vi.mock('flexlayout-react', () => {
  class MockModel {
    constructor(private json: Record<string, any>) {}
    static fromJson(json: Record<string, any>) {
      flexLayoutModelFromJsonSpy(json);
      return new MockModel(json);
    }
    toJson() {
      return this.json;
    }
  }

  function Layout({
    factory,
    model,
    onModelChange,
  }: {
    factory: (node: { getComponent: () => string }) => ReactNode;
    model: MockModel;
    onModelChange: (model: MockModel, action: unknown) => void;
  }) {
    const json = model.toJson();
    const tabset = json.layout.children[0];
    const tabs = tabset.children as Array<{ component: string; id: string; name: string }>;
    const selected = tabset.selected ?? 0;
    return (
      <div data-testid="mock-flexlayout">
        <div>{factory({ getComponent: () => tabs[selected].component })}</div>
        <button
          type="button"
          onClick={() => {
            onModelChange(
              new MockModel({
                ...json,
                layout: {
                  ...json.layout,
                  children: [
                    {
                      ...tabset,
                      selected: 1,
                    },
                  ],
                },
              }),
              { type: 'select-tab' },
            );
          }}
        >
          Select second dock tab
        </button>
      </div>
    );
  }

  return {
    Layout,
    Model: MockModel,
  };
});

import { ExplorerActivityRail } from '../components/explorer/ExplorerActivityRail';
import { ExplorerDockLayoutAdapter } from '../components/explorer/ExplorerDockLayoutAdapter';
import { ExplorerSearchLane } from '../components/explorer/ExplorerSearchLane';
import { ExplorerSemanticLane } from '../components/explorer/ExplorerSemanticLane';
import type { ExplorerPaneTone } from '../components/explorer/ExplorerPanePrimitives';
import {
  defaultExplorerActivityLaneOrderBySide,
  defaultExplorerActivityLanePlacementById,
  explorerActivityLaneDefinitions,
  getExplorerActivityLaneFallbackOrderBySide,
  getExplorerActivityLaneFallbackPlacementById,
  getExplorerActivityLaneDefinitionsForRailSide,
  moveExplorerActivityLane,
  normalizeExplorerActivityLaneOrderBySide,
  normalizeExplorerActivityLanePlacementById,
  type ExplorerActivityLaneDefinition,
  type ExplorerActivityLaneId,
} from '../config/explorerActivityRail';

const tone: ExplorerPaneTone = {
  accent: '#7c3aed',
  border: 'rgba(255,255,255,0.12)',
  muted: 'rgba(255,255,255,0.62)',
  text: '#ffffff',
};

function createDataTransfer() {
  const store = new Map<string, string>();
  return {
    dropEffect: 'move',
    effectAllowed: 'all',
    getData: vi.fn((format: string) => store.get(format) ?? ''),
    setData: vi.fn((format: string, value: string) => {
      store.set(format, value);
    }),
  };
}

describe('Explorer activity dock surfaces', () => {
  beforeEach(() => {
    flexLayoutModelFromJsonSpy.mockClear();
  });

  it('switches lanes from the data-driven activity rail', () => {
    const onSelectLane = vi.fn();
    render(
      <ExplorerActivityRail
        activeLaneId="files"
        laneBadges={{ search: 3 }}
        onSelectLane={onSelectLane}
        tone={tone}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSelectLane).toHaveBeenCalledWith('search');
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('emits target-aware context menu requests for lane buttons and the rail background', () => {
    const onContextMenuRequest = vi.fn();
    render(
      <ExplorerActivityRail
        activeLaneId="files"
        onContextMenuRequest={onContextMenuRequest}
        onSelectLane={vi.fn()}
        tone={tone}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Search' }));

    expect(onContextMenuRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        railSide: 'left',
        laneId: 'search',
        laneDefinition: expect.objectContaining({
          id: 'search',
          label: 'Search',
        }),
      }),
    );

    fireEvent.contextMenu(
      screen.getByRole('navigation', { name: 'Explorer left activity rail' }),
    );

    expect(onContextMenuRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        railSide: 'left',
        laneId: null,
        laneDefinition: null,
      }),
    );
  });

  it('splits left and right rail definitions while tracking multiple open lanes', () => {
    expect(
      getExplorerActivityLaneDefinitionsForRailSide('left').map(
        (lane) => lane.id,
      ),
    ).toEqual(['files', 'search', 'semantic', 'tasks', 'terminal']);
    expect(
      getExplorerActivityLaneDefinitionsForRailSide('right').map(
        (lane) => lane.id,
      ),
    ).toEqual(['preview', 'actions', 'customize']);

    const onSelectLane = vi.fn();
    render(
      <ExplorerActivityRail
        activeLaneIds={new Set<ExplorerActivityLaneId>(['search', 'preview'])}
        laneDefinitions={getExplorerActivityLaneDefinitionsForRailSide('right')}
        onSelectLane={onSelectLane}
        railSide="right"
        tone={tone}
      />,
    );

    expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));

    expect(onSelectLane).toHaveBeenCalledWith('actions');
  });

  it('moves lanes between the left and right rails when icons are dragged across sides', () => {
    const onMoveLane = vi.fn();
    render(
      <>
        <ExplorerActivityRail
          laneDefinitions={getExplorerActivityLaneDefinitionsForRailSide('left')}
          onMoveLane={onMoveLane}
          onSelectLane={vi.fn()}
          railSide="left"
          tone={tone}
        />
        <ExplorerActivityRail
          laneDefinitions={getExplorerActivityLaneDefinitionsForRailSide('right')}
          onMoveLane={onMoveLane}
          onSelectLane={vi.fn()}
          railSide="right"
          tone={tone}
        />
      </>,
    );

    const leftRail = screen.getByRole('navigation', {
      name: 'Explorer left activity rail',
    });
    const rightRail = screen.getByRole('navigation', {
      name: 'Explorer right activity rail',
    });

    const leftToRightTransfer = createDataTransfer();
    const leftTerminalButton = within(leftRail).getByRole('button', {
      name: 'Terminal',
    });
    const rightActionsTarget = within(rightRail)
      .getByRole('button', { name: 'Actions' })
      .parentElement;
    if (!rightActionsTarget) {
      throw new Error('Expected right rail actions target');
    }
    fireEvent.dragStart(leftTerminalButton, { dataTransfer: leftToRightTransfer });
    fireEvent.dragOver(rightActionsTarget, { dataTransfer: leftToRightTransfer });
    fireEvent.drop(rightActionsTarget, { dataTransfer: leftToRightTransfer });
    fireEvent.dragEnd(leftTerminalButton, { dataTransfer: leftToRightTransfer });

    expect(onMoveLane).toHaveBeenCalledWith('terminal', 'right', 1);

    const rightToLeftTransfer = createDataTransfer();
    const rightPreviewButton = within(rightRail).getByRole('button', {
      name: 'Preview',
    });
    const leftSearchTarget = within(leftRail)
      .getByRole('button', { name: 'Search' })
      .parentElement;
    if (!leftSearchTarget) {
      throw new Error('Expected left rail search target');
    }
    fireEvent.dragStart(rightPreviewButton, { dataTransfer: rightToLeftTransfer });
    fireEvent.dragOver(leftSearchTarget, { dataTransfer: rightToLeftTransfer });
    fireEvent.drop(leftSearchTarget, { dataTransfer: rightToLeftTransfer });
    fireEvent.dragEnd(rightPreviewButton, { dataTransfer: rightToLeftTransfer });

    expect(onMoveLane).toHaveBeenCalledWith('preview', 'left', 1);
  });

  it('renders contributed activity lanes from the dynamic rail catalog', () => {
    const contributedLane = {
      id: 'plugin:gitlens:source-control',
      label: 'Source Control',
      iconName: 'GitBranch',
      defaultSide: 'left',
      defaultOrder: 35,
      views: [],
    } satisfies ExplorerActivityLaneDefinition;
    const laneDefinitions = [
      ...explorerActivityLaneDefinitions,
      contributedLane,
    ];
    const placementById = normalizeExplorerActivityLanePlacementById(
      {},
      getExplorerActivityLaneFallbackPlacementById(laneDefinitions),
    );
    const orderBySide = normalizeExplorerActivityLaneOrderBySide(
      {},
      placementById,
      getExplorerActivityLaneFallbackOrderBySide(
        laneDefinitions,
        placementById,
      ),
    );

    expect(
      getExplorerActivityLaneDefinitionsForRailSide(
        'left',
        placementById,
        orderBySide,
        [],
        laneDefinitions,
      ).map((lane) => lane.id),
    ).toContain('plugin:gitlens:source-control');

    const onSelectLane = vi.fn();
    render(
      <ExplorerActivityRail
        laneDefinitions={getExplorerActivityLaneDefinitionsForRailSide(
          'left',
          placementById,
          orderBySide,
          [],
          laneDefinitions,
        )}
        onSelectLane={onSelectLane}
        railSide="left"
        tone={tone}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Source Control' }));

    expect(onSelectLane).toHaveBeenCalledWith('plugin:gitlens:source-control');
  });

  it('reorders icons within the same rail when lanes are dragged', () => {
    const onMoveLane = vi.fn();
    render(
      <ExplorerActivityRail
        laneDefinitions={getExplorerActivityLaneDefinitionsForRailSide('left')}
        onMoveLane={onMoveLane}
        onSelectLane={vi.fn()}
        railSide="left"
        tone={tone}
      />,
    );

    const leftRail = screen.getByRole('navigation', {
      name: 'Explorer left activity rail',
    });
    const dataTransfer = createDataTransfer();
    const terminalButton = within(leftRail).getByRole('button', {
      name: 'Terminal',
    });
    const searchTarget = within(leftRail)
      .getByRole('button', { name: 'Search' })
      .parentElement;
    if (!searchTarget) {
      throw new Error('Expected left rail search target');
    }

    fireEvent.dragStart(terminalButton, { dataTransfer });
    fireEvent.dragOver(searchTarget, { dataTransfer });
    fireEvent.drop(searchTarget, { dataTransfer });
    fireEvent.dragEnd(terminalButton, { dataTransfer });

    expect(onMoveLane).toHaveBeenCalledWith('terminal', 'left', 1);
  });

  it('derives active highlighting from dynamic lane placement instead of hardcoded sides', () => {
    const previewMovedLeft = moveExplorerActivityLane({
      laneId: 'preview',
      targetSide: 'left',
      targetIndex: 1,
      placementById: defaultExplorerActivityLanePlacementById,
      orderBySide: defaultExplorerActivityLaneOrderBySide,
    });
    const terminalMovedRight = moveExplorerActivityLane({
      laneId: 'terminal',
      targetSide: 'right',
      targetIndex: 1,
      placementById: previewMovedLeft.placementById,
      orderBySide: previewMovedLeft.orderBySide,
    });
    const leftLaneDefinitions = getExplorerActivityLaneDefinitionsForRailSide(
      'left',
      terminalMovedRight.placementById,
      terminalMovedRight.orderBySide,
    );
    const rightLaneDefinitions = getExplorerActivityLaneDefinitionsForRailSide(
      'right',
      terminalMovedRight.placementById,
      terminalMovedRight.orderBySide,
    );

    expect(leftLaneDefinitions.map((lane) => lane.id)).toEqual([
      'files',
      'preview',
      'search',
      'semantic',
      'tasks',
    ]);
    expect(rightLaneDefinitions.map((lane) => lane.id)).toEqual([
      'actions',
      'terminal',
      'customize',
    ]);

    render(
      <ExplorerActivityRail
        activeLaneIds={new Set<ExplorerActivityLaneId>(['preview'])}
        laneDefinitions={leftLaneDefinitions}
        onSelectLane={vi.fn()}
        railSide="left"
        tone={tone}
      />,
    );

    expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Terminal' })).toBeNull();
  });

  it('keeps flexlayout dock state behind an adapter callback', () => {
    const onActivePaneChange = vi.fn();
    render(
      <ExplorerDockLayoutAdapter
        activePaneId="search"
        onActivePaneChange={onActivePaneChange}
        panes={[
          { id: 'search', title: 'Search', content: <div>Search Pane</div> },
          { id: 'semantic', title: 'Semantic', content: <div>Semantic Pane</div> },
        ]}
      />,
    );

    expect(screen.getByText('Search Pane')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select second dock tab' }));

    expect(onActivePaneChange).toHaveBeenCalledWith('semantic');
  });

  it('keeps the flexlayout model stable while live search content changes', () => {
    const renderDock = (query: string) => (
      <ExplorerDockLayoutAdapter
        activePaneId="search"
        panes={[
          {
            id: 'search',
            title: 'Search',
            content: (
              <input aria-label="dock search query" readOnly value={query} />
            ),
          },
          { id: 'semantic', title: 'Semantic', content: <div>Semantic Pane</div> },
        ]}
      />
    );

    const { rerender } = render(renderDock('a'));
    const inputBefore = screen.getByRole('textbox', {
      name: 'dock search query',
    });

    rerender(renderDock('ab'));

    expect(flexLayoutModelFromJsonSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: 'dock search query' })).toBe(
      inputBefore,
    );
    expect(inputBefore).toHaveValue('ab');
  });

  it('filters already-loaded search results locally and opens the selected result', () => {
    const onOpenResult = vi.fn();
    render(
      <ExplorerSearchLane
        currentPath="C:\\Workspace"
        loading={false}
        mode="content"
        onCancel={vi.fn()}
        onModeChange={vi.fn()}
        onOpenResult={onOpenResult}
        onQueryChange={vi.fn()}
        onToggleHidden={vi.fn()}
        query="needle"
        results={[
          {
            name: 'alpha.txt',
            path: 'C:\\Workspace\\alpha.txt',
            relative_path: 'alpha.txt',
            snippet: 'first match',
            search_mode: 'content',
          },
          {
            name: 'beta.ts',
            path: 'C:\\Workspace\\src\\beta.ts',
            relative_path: 'src\\beta.ts',
            snippet: 'needle lives here',
            search_mode: 'content',
          },
        ]}
        showHidden={false}
        tone={tone}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Filter loaded results'), {
      target: { value: 'beta' },
    });

    expect(screen.queryByText('alpha.txt')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /beta.ts/i }));

    expect(onOpenResult).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'C:\\Workspace\\src\\beta.ts' }),
    );
  });

  it('exposes semantic index actions and disables find-similar without a selected file', () => {
    const onBuild = vi.fn();
    const onRebuild = vi.fn();
    const onClear = vi.fn();
    const onFindSimilar = vi.fn();
    const onQueryChange = vi.fn();

    render(
      <ExplorerSemanticLane
        currentPath="C:\\Workspace"
        diagnostics={null}
        onBuild={onBuild}
        onClear={onClear}
        onFindSimilar={onFindSimilar}
        onQueryChange={onQueryChange}
        onRebuild={onRebuild}
        query=""
        selectedPath={null}
        statusLabel="Semantic index not built"
        summary={null}
        tone={tone}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /index this folder/i }));
    fireEvent.click(screen.getByRole('button', { name: /rebuild/i }));
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    fireEvent.change(screen.getByPlaceholderText('Meaning search'), {
      target: { value: 'similar files' },
    });
    fireEvent.click(screen.getByRole('button', { name: /find similar/i }));

    expect(onBuild).toHaveBeenCalledTimes(1);
    expect(onRebuild).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith('similar files');
    expect(onFindSimilar).not.toHaveBeenCalled();
  });
});
