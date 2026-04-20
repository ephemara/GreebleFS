import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerPdfWorkbench } from '../components/ExplorerPdfWorkbench';
import type { ExplorerPdfPreviewDocument } from '../runtime/pdfPreviewBackend';
import { useSettingsStore } from '../store/settingsStore';

const {
  cancelPendingExplorerPdfPreviewDocumentCloseMock,
  renderExplorerPdfPreviewPageMock,
  saveExplorerPdfPreviewEditsMock,
  scheduleExplorerPdfPreviewDocumentCloseMock,
} = vi.hoisted(() => ({
  cancelPendingExplorerPdfPreviewDocumentCloseMock: vi.fn(),
  renderExplorerPdfPreviewPageMock: vi.fn(),
  saveExplorerPdfPreviewEditsMock: vi.fn(),
  scheduleExplorerPdfPreviewDocumentCloseMock: vi.fn(),
}));

vi.mock('../runtime/pdfPreviewBackend', () => ({
  cancelPendingExplorerPdfPreviewDocumentClose: cancelPendingExplorerPdfPreviewDocumentCloseMock,
  renderExplorerPdfPreviewPage: renderExplorerPdfPreviewPageMock,
  saveExplorerPdfPreviewEdits: saveExplorerPdfPreviewEditsMock,
  scheduleExplorerPdfPreviewDocumentClose: scheduleExplorerPdfPreviewDocumentCloseMock,
}));

class MockResizeObserver {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    latestResizeObserver = this;
  }

  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  notify(width: number, height: number) {
    this.callback(
      [
        {
          contentRect: {
            width,
            height,
          },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
}

let latestResizeObserver: MockResizeObserver | null = null;

function createMockPdfDocument(
  overrides?: Partial<ExplorerPdfPreviewDocument>,
): ExplorerPdfPreviewDocument {
  return {
    sessionId: 'pdf-preview-1',
    path: '/tmp/sample.pdf',
    name: 'sample.pdf',
    pageCount: 1,
    pages: [
      {
        pageIndex: 0,
        widthPoints: 612,
        heightPoints: 792,
      },
    ],
    formFields: [],
    ...overrides,
  } as ExplorerPdfPreviewDocument;
}

describe('ExplorerPdfWorkbench', () => {
  beforeEach(() => {
    latestResizeObserver = null;
    useSettingsStore.getState().resetToDefaults();
    cancelPendingExplorerPdfPreviewDocumentCloseMock.mockReset();
    renderExplorerPdfPreviewPageMock.mockReset();
    saveExplorerPdfPreviewEditsMock.mockReset();
    scheduleExplorerPdfPreviewDocumentCloseMock.mockReset();
    renderExplorerPdfPreviewPageMock.mockResolvedValue({
      sessionId: 'pdf-preview-1',
      pageIndex: 0,
      imageDataUrl: 'data:image/png;base64,cGRmLXByZXZpZXc=',
      renderedWidthPx: 612,
      renderedHeightPx: 792,
      appliedZoomScale: 1,
      fitMode: 'fitWidth',
      cacheKey: 'pdf-preview-1-page-0-fitWidth-1',
    });

    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      configurable: true,
      value: MockResizeObserver,
    });
  });

  it('keeps the footer mounted and ignores duplicate viewport resize notifications', async () => {
    render(<ExplorerPdfWorkbench document={createMockPdfDocument()} />);

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('0 forms · 0 annotations')).toBeInTheDocument();
    expect(latestResizeObserver).not.toBeNull();

    act(() => {
      latestResizeObserver?.notify(920, 760);
    });

    await waitFor(() => {
      expect(renderExplorerPdfPreviewPageMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      latestResizeObserver?.notify(920, 760);
    });

    await waitFor(() => {
      expect(renderExplorerPdfPreviewPageMock).toHaveBeenCalledTimes(1);
    });
  });

  it('rejects clearing required dropdown fields and keeps the prior value', async () => {
    const document = createMockPdfDocument({
      formFields: [
        {
          fieldId: 'status',
          fieldName: 'Status',
          groupName: null,
          pageIndex: 0,
          rect: {
            x: 24,
            y: 24,
            width: 160,
            height: 28,
          },
          kind: 'dropdown',
          stringValue: 'approved',
          boolValue: null,
          selectedValues: ['approved'],
          options: [
            { value: 'approved', label: 'Approved' },
            { value: 'pending', label: 'Pending' },
          ],
          readOnly: false,
          required: true,
          widgetExportValue: null,
        },
      ],
    });

    render(<ExplorerPdfWorkbench document={document} />);

    const select = (await screen.findByTitle('Status')) as HTMLSelectElement;
    expect(select.value).toBe('approved');

    fireEvent.change(select, { target: { value: '' } });

    expect(await screen.findByText(/status is required\./i)).toBeInTheDocument();
    expect(select.value).toBe('approved');
  });

  it('preserves PDF edits after a save failure and allows retry', async () => {
    const initialDocument = createMockPdfDocument({
      formFields: [
        {
          fieldId: 'title',
          fieldName: 'Title',
          groupName: null,
          pageIndex: 0,
          rect: {
            x: 24,
            y: 24,
            width: 220,
            height: 28,
          },
          kind: 'text',
          stringValue: 'Alpha',
          boolValue: null,
          selectedValues: ['Alpha'],
          options: [],
          readOnly: false,
          required: true,
          widgetExportValue: null,
        },
      ],
    });

    const savedDocument = createMockPdfDocument({
      formFields: [
        {
          fieldId: 'title',
          fieldName: 'Title',
          groupName: null,
          pageIndex: 0,
          rect: {
            x: 24,
            y: 24,
            width: 220,
            height: 28,
          },
          kind: 'text',
          stringValue: 'Beta',
          boolValue: null,
          selectedValues: ['Beta'],
          options: [],
          readOnly: false,
          required: true,
          widgetExportValue: null,
        },
      ],
    });

    saveExplorerPdfPreviewEditsMock.mockRejectedValueOnce(new Error('Disk full'));
    saveExplorerPdfPreviewEditsMock.mockResolvedValueOnce({
      document: savedDocument,
    });

    render(<ExplorerPdfWorkbench document={initialDocument} />);

    const titleInput = (await screen.findByTitle('Title')) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Beta' } });

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    fireEvent.click(saveButton);

    expect(
      await screen.findByText(/disk full draft preserved; use save to retry\./i),
    ).toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveExplorerPdfPreviewEditsMock).toHaveBeenCalledTimes(2);
    });
    expect(saveExplorerPdfPreviewEditsMock.mock.calls[1]?.[0]).toMatchObject({
      formUpdates: [
        expect.objectContaining({
          fieldId: 'title',
          stringValue: 'Beta',
        }),
      ],
    });
    await waitFor(() => {
      expect(
        screen.queryByText(/draft preserved; use save to retry\./i),
      ).not.toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });
  });
});
