import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { readExplorerTextFileMock } = vi.hoisted(() => ({
  readExplorerTextFileMock: vi.fn(),
}));

vi.mock('../runtime/explorerBackend', () => ({
  readExplorerTextFile: readExplorerTextFileMock,
}));

vi.mock('../store/settingsStore', () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({
      settings: {
        editor: {
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: 1.5,
          tabSize: 2,
          wordWrap: 'off',
        },
      },
    }),
}));

vi.mock('../components/ExplorerTextWorkbenchSurface', () => ({
  ExplorerTextWorkbenchSurface: (props: Record<string, unknown>) => (
    <div data-testid="mock-text-workbench">
      {String(props.name)}|{String(props.content)}|{String(props.viewMode)}|{String(props.renderKind)}
    </div>
  ),
}));

import { TextWorkbenchPreviewAdapter } from '../components/pluginWorkbenchAdapters';

function makeTextWorkbenchProps(overrides: Record<string, unknown> = {}) {
  return {
    plugin: {
      id: 'text-workbench',
      name: 'Text Workbench',
      filePath: 'C:/Dev/GreebleFS/usr/plugins/greeblefs-workbench-text/index.tsx',
      pluginRoot: 'C:/Dev/GreebleFS/usr/plugins',
      pluginDirectory: 'C:/Dev/GreebleFS/usr/plugins/greeblefs-workbench-text',
      backendDirectory: 'C:/Dev/GreebleFS/usr/plugins/greeblefs-workbench-text/backend',
    },
    api: {},
    appearance: {
      theme: {
        palette: {},
      },
      fonts: {
        ui: 'sans-serif',
        mono: 'monospace',
      },
      cssVars: {},
    },
    host: {
      mode: 'preview-pane',
      width: 960,
      height: 640,
      zoom: 1,
      compact: false,
      density: 'compact',
    },
    executionContext: null,
    lane: {
      id: 'text-workbench.preview-lane.text',
      pluginId: 'text-workbench',
      pluginName: 'Text Workbench',
      title: 'Text Workbench',
      priority: 900,
      rendererKind: 'react',
      rendererEntry: 'preview/textWorkbench.tsx',
      runtimeId: null,
      runtimeSurfaceId: null,
      buildTarget: null,
      match: {
        appliesTo: 'file',
        extensions: ['md'],
        fileNames: [],
        previewKinds: ['text'],
      },
      capabilities: {
        editable: true,
        save: false,
        export: false,
        workflowTabs: false,
        contextMenu: false,
        prefetch: false,
        closeGuard: false,
      },
      workbenchChrome: null,
      component: () => null,
    },
    file: {
      path: 'C:/tmp/notes.md',
      resolvedPath: 'C:/tmp/notes.md',
      name: 'notes.md',
      extension: 'md',
      size: 24,
      assetUrl: 'asset://notes.md',
      isDirectory: false,
    },
    runtime: {
      runtimeId: null,
      getRuntimePackage: async () => null,
      listRuntimePackages: async () => ({ items: [] }),
      prepareRuntimePackage: async () => ({ status: 'idle' }),
      callRuntimeAction: async () => ({ status: 'ok', data: null }),
      runRuntimeCommand: async () => ({ code: 0, stdout: '', stderr: '' }),
      openRuntimeTui: async () => ({ pid: null }),
    },
    viewMode: 'preview',
    workflowTabId: 'preview',
    previewBackedByArchiveVirtual: false,
    ...overrides,
  } as any;
}

describe('pluginWorkbenchAdapters text loader', () => {
  const originalTauriInternals = (window as any).__TAURI_INTERNALS__;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    readExplorerTextFileMock.mockReset();
  });

  afterEach(() => {
    (window as any).__TAURI_INTERNALS__ = originalTauriInternals;
    globalThis.fetch = originalFetch;
  });

  it('loads standalone text previews through the explorer backend in Tauri mode', async () => {
    (window as any).__TAURI_INTERNALS__ = {};
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    readExplorerTextFileMock.mockResolvedValue('# Host Read');

    render(<TextWorkbenchPreviewAdapter {...makeTextWorkbenchProps()} />);

    await waitFor(() => {
      expect(readExplorerTextFileMock).toHaveBeenCalledWith('C:/tmp/notes.md');
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByTestId('mock-text-workbench')).toHaveTextContent(
      'notes.md|# Host Read|preview|markdown',
    );
  });

  it('falls back to asset fetches outside Tauri', async () => {
    (window as any).__TAURI_INTERNALS__ = null;
    globalThis.fetch = vi.fn().mockResolvedValue({
      text: async () => '# Browser Read',
    }) as typeof fetch;

    render(<TextWorkbenchPreviewAdapter {...makeTextWorkbenchProps()} />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('asset://notes.md');
    });

    expect(readExplorerTextFileMock).not.toHaveBeenCalled();
    expect(await screen.findByTestId('mock-text-workbench')).toHaveTextContent(
      'notes.md|# Browser Read|preview|markdown',
    );
  });

  it('does not re-register text workbench status just because parent callbacks and host objects are recreated', async () => {
    const statusRegistrations: string[] = [];

    function TextWorkbenchRegistrationHarness() {
      const [registrationRevision, setRegistrationRevision] = useState(0);
      const textWorkbench = {
        content: '# Host Context',
        language: 'markdown',
        renderKind: 'markdown',
        scriptPreview: null,
        pythonPreview: null,
        focusTarget: null,
        isDirty: false,
        isSaving: false,
        lastSavedAt: null,
        error: null,
        editorSettings: {
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: 1.5,
          tabSize: 2,
          wordWrap: 'off',
        },
        pythonRuntimeConfig: null,
        pythonBootstrapPackageInput: '',
        onChange: vi.fn(),
        onSave: async () => true,
      };

      return (
        <div>
          <div data-testid="registration-revision">{registrationRevision}</div>
          <TextWorkbenchPreviewAdapter
            {...makeTextWorkbenchProps({
              workbench: {
                delegateDescriptor: null,
                text: textWorkbench,
              },
              onRegisterWorkbenchStatus: (
                status: { label: string; tone?: string } | null,
              ) => {
                statusRegistrations.push(
                  status ? `${status.label}:${status.tone ?? 'neutral'}` : 'null',
                );
                if (status) {
                  setRegistrationRevision((current) => current + 1);
                }
              },
            })}
          />
        </div>
      );
    }

    render(<TextWorkbenchRegistrationHarness />);

    expect(await screen.findByTestId('mock-text-workbench')).toHaveTextContent(
      'notes.md|# Host Context|preview|markdown',
    );
    await waitFor(() => {
      expect(screen.getByTestId('registration-revision')).toHaveTextContent('1');
    });
    expect(statusRegistrations).toEqual(['Saved:success']);
  });
});
