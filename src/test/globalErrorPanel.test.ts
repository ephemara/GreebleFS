import { afterEach, describe, expect, it } from 'vitest';

import {
  formatGlobalErrorDetail,
  reportGlobalError,
  resetGlobalErrorPanel,
} from '../runtime/globalErrorPanel';

describe('global error panel', () => {
  afterEach(() => {
    resetGlobalErrorPanel();
  });

  it('renders a non-blocking floating panel instead of a full-screen lockout', () => {
    reportGlobalError('OverlayTerm runtime error', 'Boom');

    const host = document.getElementById('overlayterm-global-error-panel') as HTMLDivElement | null;
    expect(host).not.toBeNull();
    expect(host?.style.pointerEvents).toBe('none');
    expect(host?.textContent).toContain('OverlayTerm runtime error');
    expect(host?.textContent).toContain('Boom');
    expect(host?.textContent).toContain('Dismiss');
  });

  it('deduplicates repeated errors and increments the visible counter', () => {
    reportGlobalError('OverlayTerm runtime error', 'Repeated fault');
    reportGlobalError('OverlayTerm runtime error', 'Repeated fault');

    const host = document.getElementById('overlayterm-global-error-panel');
    expect(host?.textContent).toContain('2x repeated');
  });

  it('formats source-location objects into readable detail text', () => {
    expect(formatGlobalErrorDetail({
      message: 'Script error.',
      filename: 'tauri://localhost/assets/index.js',
      lineno: 78,
      colno: 1187,
    })).toBe('Script error.\n@tauri://localhost/assets/index.js:78:1187');
  });
});
