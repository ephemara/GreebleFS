import {
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { useInteractionMotionController } from '../animation/interactionMotion';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { playSoundEffect } from '../runtime/soundEffects';

export type OverlayActionButtonTone = 'accent' | 'neutral' | 'quiet' | 'danger';
export type OverlayActionButtonSize = 'default' | 'compact';

export interface OverlayActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  appearance: ResolvedOverlayAppearance;
  tone?: OverlayActionButtonTone;
  size?: OverlayActionButtonSize;
  active?: boolean;
  motionStepIndex?: number;
  style?: CSSProperties;
}

const ACTION_BUTTON_TRANSITION = 'background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, opacity 0.15s, transform 0.15s, filter 0.15s';

export function OverlayActionButton({
  appearance,
  tone = 'neutral',
  size = 'default',
  active = false,
  motionStepIndex = 0,
  type = 'button',
  disabled = false,
  className,
  children,
  style,
  onClick,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onBlur,
  ...buttonProps
}: OverlayActionButtonProps) {
  const interactionMotion = useInteractionMotionController(appearance);
  const motionBinding = useMemo(() => interactionMotion.bindSurface({
    surfaceId: 'actionButton',
    triggerState: active ? { activate: true } : undefined,
    motionStepIndex,
    baseTransition: ACTION_BUTTON_TRANSITION,
  }), [active, interactionMotion, motionStepIndex]);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const visualStyle = resolveOverlayActionButtonVisualStyle({
    appearance,
    tone,
    size,
    active,
    disabled,
    hovered: isHovered,
    pressed: isPressed,
  });

  const handlePointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!disabled) {
      setIsHovered(true);
    }
    motionBinding.onPointerEnter(event);
    onPointerEnter?.(event);
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLButtonElement>) => {
    setIsHovered(false);
    setIsPressed(false);
    motionBinding.onPointerLeave(event);
    onPointerLeave?.(event);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!disabled) {
      setIsHovered(true);
      setIsPressed(true);
    }
    motionBinding.onPointerDown(event);
    onPointerDown?.(event);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    setIsPressed(false);
    if (!disabled) {
      setIsHovered(true);
    }
    motionBinding.onPointerUp(event);
    onPointerUp?.(event);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    setIsHovered(false);
    setIsPressed(false);
    motionBinding.onPointerCancel(event);
    onPointerCancel?.(event);
  };

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled}
      className={className}
      data-overlay-action-button-tone={tone}
      data-overlay-action-button-size={size}
      {...motionBinding.motionDataAttributes}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={(event) => {
        onClick?.(event);
        if (!disabled && !event.defaultPrevented) {
          void playSoundEffect('shell-button-press');
        }
      }}
      onBlur={(event) => {
        setIsHovered(false);
        setIsPressed(false);
        onBlur?.(event);
      }}
      style={{
        ...visualStyle,
        ...motionBinding.motionStyle,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function resolveOverlayActionButtonVisualStyle(args: {
  appearance: ResolvedOverlayAppearance;
  tone: OverlayActionButtonTone;
  size: OverlayActionButtonSize;
  active: boolean;
  disabled: boolean;
  hovered: boolean;
  pressed: boolean;
}): CSSProperties {
  const {
    appearance,
    tone,
    size,
    active,
    disabled,
    hovered,
    pressed,
  } = args;
  const accent = appearance.theme.palette.accent;
  const border = appearance.theme.palette.border;
  const danger = appearance.theme.palette.danger;
  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;
  const controlRadius = appearance.workbenchTheme.metrics.controlRadius;
  const interactiveState = pressed
    ? 'pressed'
    : hovered
      ? 'hovered'
      : active
        ? 'active'
        : 'idle';
  const sizeStyle = size === 'compact'
    ? {
        minHeight: 28,
        padding: '0 10px',
        gap: 6,
        fontSize: 9,
        letterSpacing: '0.12em',
      }
    : {
        minHeight: 34,
        padding: '0 12px',
        gap: 8,
        fontSize: 10,
        letterSpacing: '0.14em',
      };

  const toneStyleByState: Record<OverlayActionButtonTone, Record<'idle' | 'active' | 'hovered' | 'pressed', Pick<CSSProperties, 'background' | 'border' | 'boxShadow' | 'color'>>> = {
    accent: {
      idle: {
        background: `${accent}18`,
        border: `1px solid ${accent}55`,
        boxShadow: 'none',
        color: text,
      },
      active: {
        background: `${accent}20`,
        border: `1px solid ${accent}80`,
        boxShadow: `0 0 0 1px ${accent}22 inset`,
        color: text,
      },
      hovered: {
        background: `${accent}28`,
        border: `1px solid ${accent}99`,
        boxShadow: `0 0 0 1px ${accent}2a inset`,
        color: text,
      },
      pressed: {
        background: `${accent}32`,
        border: `1px solid ${accent}bb`,
        boxShadow: `0 0 0 1px ${accent}38 inset`,
        color: text,
      },
    },
    neutral: {
      idle: {
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${border}`,
        boxShadow: 'none',
        color: text,
      },
      active: {
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${accent}55`,
        boxShadow: `0 0 0 1px ${accent}18 inset`,
        color: text,
      },
      hovered: {
        background: 'rgba(255,255,255,0.08)',
        border: `1px solid ${accent}66`,
        boxShadow: `0 0 0 1px ${accent}1c inset`,
        color: text,
      },
      pressed: {
        background: 'rgba(255,255,255,0.11)',
        border: `1px solid ${accent}88`,
        boxShadow: `0 0 0 1px ${accent}24 inset`,
        color: text,
      },
    },
    quiet: {
      idle: {
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${border}`,
        boxShadow: 'none',
        color: muted,
      },
      active: {
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${accent}40`,
        boxShadow: `0 0 0 1px ${accent}14 inset`,
        color: text,
      },
      hovered: {
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${accent}52`,
        boxShadow: `0 0 0 1px ${accent}1a inset`,
        color: text,
      },
      pressed: {
        background: 'rgba(255,255,255,0.09)',
        border: `1px solid ${accent}70`,
        boxShadow: `0 0 0 1px ${accent}22 inset`,
        color: text,
      },
    },
    danger: {
      idle: {
        background: `${danger}14`,
        border: `1px solid ${danger}44`,
        boxShadow: 'none',
        color: text,
      },
      active: {
        background: `${danger}18`,
        border: `1px solid ${danger}66`,
        boxShadow: `0 0 0 1px ${danger}18 inset`,
        color: text,
      },
      hovered: {
        background: `${danger}22`,
        border: `1px solid ${danger}88`,
        boxShadow: `0 0 0 1px ${danger}24 inset`,
        color: text,
      },
      pressed: {
        background: `${danger}2b`,
        border: `1px solid ${danger}aa`,
        boxShadow: `0 0 0 1px ${danger}30 inset`,
        color: text,
      },
    },
  };

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    textTransform: 'uppercase',
    borderRadius: controlRadius,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: ACTION_BUTTON_TRANSITION,
    userSelect: 'none',
    ...sizeStyle,
    ...toneStyleByState[tone][interactiveState],
  };
}
