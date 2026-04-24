import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OverlayActionButton } from '../components/OverlayActionButton';
import { resolveOverlayAppearance } from '../config/appearance';
import { useSettingsStore } from '../store/settingsStore';

const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });

describe('OverlayActionButton', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it('applies shared hover and press feedback through the actionButton surface', () => {
    render(
      <OverlayActionButton appearance={appearance}>
        Show QR Codes
      </OverlayActionButton>,
    );

    const button = screen.getByRole('button', { name: /show qr codes/i });
    expect(button).toHaveAttribute('data-interaction-motion-surface', 'actionButton');

    const idleBackground = button.style.background;
    const idleBoxShadow = button.style.boxShadow;
    fireEvent.pointerEnter(button);
    expect(button.style.background).not.toBe(idleBackground);
    expect(button.style.boxShadow).not.toBe(idleBoxShadow);

    const hoverBackground = button.style.background;
    const hoverBoxShadow = button.style.boxShadow;
    fireEvent.pointerDown(button);
    expect(button.style.background).not.toBe(hoverBackground);
    expect(button.style.boxShadow).not.toBe(hoverBoxShadow);
    expect(button.style.transform).toContain('translate3d');
  });

  it('dims disabled buttons and suppresses click handlers', () => {
    const onClick = vi.fn();

    render(
      <OverlayActionButton appearance={appearance} disabled onClick={onClick}>
        Stop Share
      </OverlayActionButton>,
    );

    const button = screen.getByRole('button', { name: /stop share/i });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(button.style.opacity).toBe('0.6');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps static hover feedback when interaction motion is disabled', () => {
    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        appearance: {
          ...state.settings.appearance,
          interactionMotionEnabled: false,
        },
      },
    }));

    render(
      <OverlayActionButton appearance={appearance}>
        Mobile Settings
      </OverlayActionButton>,
    );

    const button = screen.getByRole('button', { name: /mobile settings/i });
    const idleBoxShadow = button.style.boxShadow;
    fireEvent.pointerEnter(button);

    expect(button.style.boxShadow).not.toBe(idleBoxShadow);
    expect(button.style.transform).toBe('');
  });
});
