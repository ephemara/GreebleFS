import { fireEvent, render, screen } from '@testing-library/react';
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

const tone: ExplorerPaneTone = {
  accent: '#7c3aed',
  border: 'rgba(255,255,255,0.12)',
  muted: 'rgba(255,255,255,0.62)',
  text: '#ffffff',
};

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
