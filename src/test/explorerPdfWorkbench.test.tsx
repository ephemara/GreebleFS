import { act, render, screen, waitFor } from '@testing-library/react';
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

function createMockPdfDocument(): ExplorerPdfPreviewDocument {
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
});
