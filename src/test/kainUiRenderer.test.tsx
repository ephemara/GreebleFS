import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KainUiRenderer } from '../components/kain/KainUiRenderer';
import type { KainUiSurface } from '../runtime/kainUiScaffold';

describe('KainUiRenderer', () => {
  it('renders expanded settings primitives and keeps untrusted actions disabled', () => {
    const onAction = vi.fn();
    const surface: KainUiSurface = {
      id: 'settings:test',
      kind: 'settings-module',
      title: 'Settings Test',
      summary: 'Renderer proof.',
      mountSlot: 'settings.kain-ui',
      order: 1,
      hostModels: [],
      actions: ['trusted.action'],
      root: {
        id: 'root',
        kind: 'stack',
        layout: {},
        props: {},
        children: [
          {
            id: 'kv',
            kind: 'key-value',
            title: 'slot',
            layout: {},
            props: { key: 'slot', value: 'settings.kain-ui' },
            children: [],
          },
          {
            id: 'notice',
            kind: 'notice',
            text: 'semantic notice',
            layout: {},
            props: {},
            children: [],
          },
          {
            id: 'blocked',
            kind: 'button',
            label: 'blocked',
            actionId: 'unknown.action',
            layout: {},
            props: {},
            children: [],
          },
          {
            id: 'trusted',
            kind: 'button',
            label: 'trusted',
            actionId: 'trusted.action',
            layout: {},
            props: {},
            children: [],
          },
        ],
      },
    };

    const { container } = render(
      <KainUiRenderer
        surface={surface}
        onAction={onAction}
        isActionEnabled={(actionId) => actionId === 'trusted.action'}
      />,
    );

    expect(screen.getByText('settings.kain-ui')).toBeInTheDocument();
    expect(screen.getByText('semantic notice')).toBeInTheDocument();
    expect(container.querySelector('[data-kain-action-id="unknown.action"]')).toHaveAttribute('data-kain-action-enabled', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'trusted' }));
    expect(onAction).toHaveBeenCalledWith('trusted.action', expect.objectContaining({ id: 'trusted' }));
  });

  it('renders compact applet primitives', () => {
    const surface: KainUiSurface = {
      id: 'applet:test',
      kind: 'shell-applet',
      title: 'Applet Test',
      summary: 'Applet proof.',
      mountSlot: 'workbench.topbar.trailing',
      order: 1,
      hostModels: [],
      actions: ['kain.ui.reload'],
      root: {
        id: 'applet-root',
        kind: 'applet',
        layout: {},
        props: { tooltip: 'Applet proof' },
        children: [
          {
            id: 'indicator',
            kind: 'indicator',
            label: 'Kain',
            active: true,
            layout: {},
            props: {},
            children: [],
          },
          {
            id: 'meter',
            kind: 'mini-meter',
            layout: {},
            props: { value: 50, max: 100 },
            children: [],
          },
          {
            id: 'reload',
            kind: 'icon-button',
            label: 'reload',
            actionId: 'kain.ui.reload',
            layout: {},
            props: {},
            children: [],
          },
        ],
      },
    };

    const { container } = render(
      <KainUiRenderer
        surface={surface}
        variant="applet"
        onAction={vi.fn()}
        isActionEnabled={() => true}
      />,
    );

    expect(container.querySelector('[data-kain-ui-renderer-variant="applet"]')).not.toBeNull();
    expect(container.querySelector('[data-kain-ui-node-kind="indicator"]')).not.toBeNull();
    expect(container.querySelector('[data-kain-ui-node-kind="mini-meter"]')).not.toBeNull();
    expect(container.querySelector('[data-kain-action-id="kain.ui.reload"]')).toHaveAttribute('data-kain-action-enabled', 'true');
  });
});
