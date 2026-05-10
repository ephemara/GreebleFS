import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverlayProvider } from 'react-aria';
import { describe, expect, it, vi } from 'vitest';
import { AppSelect } from '../components/AppSelect';

describe('AppSelect', () => {
  it('opens a themed React listbox and reports native-compatible change events', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <AppSelect aria-label="Font family" value="system" onChange={onChange}>
        <option value="inter" style={{ fontFamily: 'Inter', fontSize: '48px' }}>Inter</option>
        <option value="geist">Geist</option>
        <option value="system">System UI</option>
      </AppSelect>,
    );

    await user.click(screen.getByRole('button', { name: /font family/i }));

    const listbox = await screen.findByRole('listbox');
    expect(listbox).toHaveAttribute('data-gfs-app-select', 'listbox');
    expect(listbox.parentElement).toHaveStyle({
      fontSize: 'var(--overlay-workbench-chrome-meta-size)',
    });
    expect(screen.getByRole('option', { name: 'Inter' }).textContent).toBe('Inter');
    expect(screen.getByRole('option', { name: 'Inter' }).querySelector('span')).not.toHaveStyle({
      fontSize: '48px',
    });

    await user.click(screen.getByRole('option', { name: 'Geist' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe('geist');
  });

  it('opens inside an existing overlay provider without nesting an overlay container', async () => {
    const user = userEvent.setup();

    render(
      <OverlayProvider>
        <div data-gfs-shell-scene-container="true">
          <AppSelect aria-label="Runtime lane" value="balanced">
            <option value="lean">Lean</option>
            <option value="balanced">Balanced</option>
            <option value="full">Full</option>
          </AppSelect>
        </div>
      </OverlayProvider>,
    );

    await user.click(screen.getByRole('button', { name: /runtime lane/i }));

    const listbox = await screen.findByRole('listbox');
    expect(listbox.closest('[data-gfs-app-select="popover"]')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Full' })).toBeInTheDocument();
  });
});
