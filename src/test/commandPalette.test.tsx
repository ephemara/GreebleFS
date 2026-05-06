import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CommandPalette,
  type OverlayCommandPaletteAction,
} from '../components/CommandPalette';
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
        kind: 'command',
        onSelect,
      },
      {
        id: 'refresh-plugins',
        title: 'Refresh Plugins',
        subtitle: 'Rescan plugins',
        group: 'App',
        kind: 'command',
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

  it('renders status text, reports query changes, and clears the query when closed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onQueryChange = vi.fn();
    const actions: OverlayCommandPaletteAction[] = [
      {
        id: 'open-explorer',
        title: 'Open Explorer',
        group: 'Explorer',
        kind: 'command',
        onSelect: vi.fn(),
      },
    ];
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const { rerender } = render(
      <CommandPalette
        isOpen
        appearance={appearance}
        blurEnabled={false}
        actions={actions}
        shortcutLabel="Ctrl+K"
        queryPlaceholder="Search files and commands..."
        statusMessage={{ text: 'Indexing 2/4 roots', tone: 'warning' }}
        onQueryChange={onQueryChange}
        onClose={onClose}
      />,
    );

    const input = screen.getByPlaceholderText('Search files and commands...');
    expect(screen.getByText('Indexing 2/4 roots')).toBeInTheDocument();

    await user.type(input, 'alpha');
    expect(onQueryChange).toHaveBeenLastCalledWith('alpha');

    rerender(
      <CommandPalette
        isOpen={false}
        appearance={appearance}
        blurEnabled={false}
        actions={actions}
        shortcutLabel="Ctrl+K"
        queryPlaceholder="Search files and commands..."
        statusMessage={{ text: 'Indexing 2/4 roots', tone: 'warning' }}
        onQueryChange={onQueryChange}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(onQueryChange).toHaveBeenLastCalledWith('');
    });
  });

  it('supports fuzzy search, quick filters, shortcuts, and pin controls', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onQuickFilterChange = vi.fn();
    const onTogglePinnedAction = vi.fn();
    const actions: OverlayCommandPaletteAction[] = [
      {
        id: 'toggle-zen-focus-mode',
        title: 'Toggle Zen Focus Mode',
        subtitle: 'Hide the shell top bar and foreground the explorer.',
        group: 'Layout',
        kind: 'command',
        badge: 'Zen',
        shortcutLabel: 'Ctrl+Alt+Z',
        onSelect: vi.fn(),
      },
      {
        id: 'plugin-command:shader-rebuild',
        title: 'Rebuild Shader Cache',
        subtitle: 'Refresh plugin shader modules.',
        group: 'Plugin Commands',
        kind: 'plugin',
        badge: 'Shader',
        onSelect: vi.fn(),
      },
      {
        id: 'global-search-result:D:/demo/readme.md',
        title: 'readme.md',
        subtitle: 'D:/demo/readme.md',
        group: 'Files',
        kind: 'file',
        badge: 'MD',
        onSelect: vi.fn(),
      },
    ];

    render(
      <CommandPalette
        isOpen
        appearance={resolveOverlayAppearance({ activeThemeId: 'operator' })}
        blurEnabled={false}
        actions={actions}
        shortcutLabel="Ctrl+Shift+P"
        pinnedActionIds={['toggle-zen-focus-mode']}
        recentActionIds={['toggle-zen-focus-mode']}
        onQuickFilterChange={onQuickFilterChange}
        onTogglePinnedAction={onTogglePinnedAction}
        onClose={onClose}
      />,
    );

    const input = screen.getByPlaceholderText('Search commands, panels, plugin actions...');
    expect(screen.getByText('Ctrl+Alt+Z')).toBeInTheDocument();
    expect(screen.getAllByText('Recent').length).toBeGreaterThan(0);

    await user.type(input, 'tzfm');
    expect(screen.getByText('Toggle Zen Focus Mode')).toBeInTheDocument();
    expect(screen.queryByText('Rebuild Shader Cache')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /unpin toggle zen focus mode/i }));
    expect(onTogglePinnedAction).toHaveBeenCalledWith('toggle-zen-focus-mode');

    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /files1/i }));
    expect(onQuickFilterChange).toHaveBeenLastCalledWith('files');
    expect(screen.getByText('readme.md')).toBeInTheDocument();
    expect(screen.queryByText('Toggle Zen Focus Mode')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pin readme\.md/i })).not.toBeInTheDocument();
  });
});
