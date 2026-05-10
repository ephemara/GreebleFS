import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsRailButton } from '../components/settings/SettingsPrimitives';

describe('Settings rail overflow', () => {
  it('bounds long rail descriptions instead of letting them trail off screen', () => {
    render(
      <SettingsRailButton
        active={false}
        icon={<span aria-hidden="true">I</span>}
        label="Very Long Settings Section"
        subtitle="C:\\Users\\Admin\\GreebleFS\\usr\\profiles\\default\\settings\\with\\an\\absurdly\\long\\path\\segment"
        summary="A long operational summary with dense words and no convenient breakpoints should still wrap inside the rail button."
        accent="#7c3aed"
        border="rgba(255,255,255,0.12)"
        text="#ffffff"
        muted="rgba(255,255,255,0.58)"
        onClick={vi.fn()}
      />,
    );

    const railButton = screen.getByRole('button', {
      name: /very long settings section/i,
    });
    const summary = screen.getByText(/dense words/i);
    const subtitle = screen.queryByText(/absurdly/i);

    expect(railButton).toHaveClass('overflow-hidden');
    expect(railButton).toHaveAttribute('title', expect.stringContaining('absurdly'));
    expect(summary).toHaveStyle({
      overflow: 'hidden',
      overflowWrap: 'anywhere',
      whiteSpace: 'normal',
      WebkitLineClamp: '1',
    });
    expect(subtitle).not.toBeInTheDocument();
  });
});
