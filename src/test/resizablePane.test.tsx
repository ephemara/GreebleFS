import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResizablePane, clampPanelSize, usePersistentPanelSize } from '../components/ResizablePane';

function PanelSizeHarness() {
  const [size, setSize] = usePersistentPanelSize('panel-size-test', 240, 180, 360);
  return (
    <button type="button" onClick={() => setSize(420)}>
      {size}
    </button>
  );
}

describe('ResizablePane helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('clamps panel sizes into the supported range', () => {
    expect(clampPanelSize(100, 180, 360)).toBe(180);
    expect(clampPanelSize(240, 180, 360)).toBe(240);
    expect(clampPanelSize(420, 180, 360)).toBe(360);
  });

  it('hydrates and persists panel sizes through localStorage', () => {
    window.localStorage.setItem('panel-size-test', '320');
    render(<PanelSizeHarness />);

    expect(screen.getByRole('button')).toHaveTextContent('320');

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveTextContent('360');
    expect(window.localStorage.getItem('panel-size-test')).toBe('360');
  });

  it('previews width locally during drag and commits the new size on release', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(16);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {});
    const onSizeChange = vi.fn();

    const { container } = render(
      <ResizablePane
        size={240}
        minSize={180}
        maxSize={360}
        onSizeChange={onSizeChange}
        borderColor="rgb(255, 0, 0)"
      >
        <div>Body</div>
      </ResizablePane>,
    );

    const root = container.querySelector('[data-resizable-pane-root="true"]');
    const handle = container.querySelector('[data-resizable-pane-handle="right"]');
    if (!(root instanceof HTMLDivElement) || !(handle instanceof HTMLDivElement)) {
      throw new Error('Resizable pane drag handles were not rendered');
    }

    fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 7 });
    fireEvent.pointerMove(window, { clientX: 148, pointerId: 7 });

    expect(root.style.width).toBe('288px');
    expect(onSizeChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(window, { clientX: 148, pointerId: 7 });

    expect(onSizeChange).toHaveBeenCalledTimes(1);
    expect(onSizeChange).toHaveBeenCalledWith(288);

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it('restores the starting width when escape cancels the resize gesture', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(16);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {});
    const onSizeChange = vi.fn();

    const { container } = render(
      <ResizablePane
        size={240}
        minSize={180}
        maxSize={360}
        onSizeChange={onSizeChange}
        borderColor="rgb(255, 0, 0)"
      >
        <div>Body</div>
      </ResizablePane>,
    );

    const root = container.querySelector('[data-resizable-pane-root="true"]');
    const handle = container.querySelector('[data-resizable-pane-handle="right"]');
    if (!(root instanceof HTMLDivElement) || !(handle instanceof HTMLDivElement)) {
      throw new Error('Resizable pane drag handles were not rendered');
    }

    fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 9 });
    fireEvent.pointerMove(window, { clientX: 148, pointerId: 9 });

    expect(root.style.width).toBe('288px');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(root.style.width).toBe('240px');
    expect(onSizeChange).not.toHaveBeenCalled();

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });
});
