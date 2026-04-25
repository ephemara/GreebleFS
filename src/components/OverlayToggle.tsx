import {
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react';

import type { ResolvedOverlayAppearance } from '../config/appearance';
import { playSoundEffect } from '../runtime/soundEffects';

export type OverlayToggleSize = 'default' | 'compact' | 'micro';

export interface OverlayToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  appearance?: Pick<ResolvedOverlayAppearance, 'baseTheme'> | null;
  size?: OverlayToggleSize;
  playToggleSound?: boolean;
}

const TOGGLE_TRANSITION =
  'background-position 0.18s cubic-bezier(0.22, 1, 0.36, 1), background 0.18s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s cubic-bezier(0.22, 1, 0.36, 1), filter 0.18s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.18s cubic-bezier(0.22, 1, 0.36, 1), transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)';

export function OverlayToggle({
  appearance: _appearance = null,
  size = 'default',
  className,
  style,
  disabled = false,
  playToggleSound = true,
  onChange,
  ...inputProps
}: OverlayToggleProps) {
  const classes = ['overlay-toggle-native', className].filter(Boolean).join(' ');

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    if (!disabled && playToggleSound && !event.defaultPrevented) {
      void playSoundEffect('shell-button-press');
    }
  };

  return (
    <input
      {...inputProps}
      type="checkbox"
      disabled={disabled}
      className={classes}
      data-overlay-toggle-size={size}
      data-interaction-motion-surface="actionButton"
      onChange={handleChange}
      style={{
        transition: TOGGLE_TRANSITION,
        ...style,
      }}
    />
  );
}
