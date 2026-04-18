import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '../runtime/tauriClient';
import {
  cancelPendingExplorerPdfPreviewDocumentClose,
  scheduleExplorerPdfPreviewDocumentClose,
} from '../runtime/pdfPreviewBackend';

describe('pdfPreviewBackend session close scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(commands, 'pdfClosePreviewDocument').mockResolvedValue({
      status: 'ok',
      data: null,
    });
  });

  afterEach(async () => {
    cancelPendingExplorerPdfPreviewDocumentClose('pdf-session-a');
    cancelPendingExplorerPdfPreviewDocumentClose('pdf-session-b');
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('defers pdf session close until the timeout fires', async () => {
    scheduleExplorerPdfPreviewDocumentClose('pdf-session-a');

    expect(commands.pdfClosePreviewDocument).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(0);

    expect(commands.pdfClosePreviewDocument).toHaveBeenCalledWith('pdf-session-a');
  });

  it('cancels a pending pdf session close before the timeout fires', async () => {
    scheduleExplorerPdfPreviewDocumentClose('pdf-session-a');
    cancelPendingExplorerPdfPreviewDocumentClose('pdf-session-a');

    await vi.advanceTimersByTimeAsync(0);

    expect(commands.pdfClosePreviewDocument).not.toHaveBeenCalled();
  });

  it('replaces an existing pending close for the same session', async () => {
    scheduleExplorerPdfPreviewDocumentClose('pdf-session-a');
    scheduleExplorerPdfPreviewDocumentClose('pdf-session-a');

    await vi.advanceTimersByTimeAsync(0);

    expect(commands.pdfClosePreviewDocument).toHaveBeenCalledTimes(1);
    expect(commands.pdfClosePreviewDocument).toHaveBeenCalledWith('pdf-session-a');
  });
});
