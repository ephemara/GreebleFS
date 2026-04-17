import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette, type OverlayCommandPaletteAction } from '../components/CommandPalette';
import { resolveOverlayAppearance } from '../config/appearance';

describe('CommandPalette', () => {
  it('filters actions and executes the selected command on enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const actions: OverlayCommandPaletteAction[] = [
      {
        id: 'open-settings',
        title: 'Open Settings',
        subtitle: 'Open the settings panel',
        group: 'App',
        onSelect,
      },
      {
        id: 'refresh-plugins',
        title: 'Refresh Plugins',
        subtitle: 'Rescan plugins',
        group: 'App',
        onSelect: vi.fn(),
      },
    ];

    render(
      <CommandPalette
        isOpen
        appearance={resolveOverlayAppearance({ activeThemeId: 'operator' })}
        blurEnabled={false}
        actions={actions}
        shortcutLabel="Ctrl+K"
        onClose={onClose}
      />,
    );

    const input = screen.getByPlaceholderText('Search commands, panels, plugin actions...');
    await user.type(input, 'settings');
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
