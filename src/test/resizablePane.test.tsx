import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clampPanelSize, usePersistentPanelSize } from '../components/ResizablePane';

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
});
