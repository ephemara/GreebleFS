import type { CSSProperties, ReactNode } from 'react';

import { ChevronDown, ChevronRight } from '@/components/AppIcons';

export type WorkbenchDisclosureGroupVariant = 'rail' | 'panel';

export interface WorkbenchDisclosureGroupProps {
  label: ReactNode;
  count?: ReactNode;
  ariaLabel: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  children?: ReactNode;
  variant?: WorkbenchDisclosureGroupVariant;
  forceExpanded?: boolean;
  leadingIcon?: ReactNode;
  textColor?: string;
  mutedColor?: string;
  borderColor?: string;
  background?: string;
  sectionStyle?: CSSProperties;
  buttonStyle?: CSSProperties;
  contentStyle?: CSSProperties;
}

const DEFAULT_RAIL_MUTED = 'var(--overlay-text-muted)';
const DEFAULT_PANEL_TEXT = 'var(--overlay-text-primary)';
const DEFAULT_PANEL_BORDER = 'var(--overlay-workbench-settings-card-border)';

export function WorkbenchDisclosureGroup({
  label,
  count,
  ariaLabel,
  collapsed,
  onToggleCollapsed,
  children,
  variant = 'rail',
  forceExpanded = false,
  leadingIcon,
  textColor = DEFAULT_PANEL_TEXT,
  mutedColor = DEFAULT_RAIL_MUTED,
  borderColor = DEFAULT_PANEL_BORDER,
  background,
  sectionStyle,
  buttonStyle,
  contentStyle,
}: WorkbenchDisclosureGroupProps) {
  const expanded = forceExpanded || !collapsed;
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;
  const countNode =
    count == null ? null : typeof count === 'string' || typeof count === 'number'
      ? <span style={{ opacity: 0.5 }}>{count}</span>
      : count;

  const baseSectionStyle: CSSProperties =
    variant === 'panel'
      ? {
          overflow: 'hidden',
          border: `1px solid ${borderColor}`,
          borderRadius: 14,
          background: background ?? 'rgba(255,255,255,0.014)',
        }
      : {
          marginBottom: 9,
        };

  const baseButtonStyle: CSSProperties =
    variant === 'panel'
      ? {
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 10px',
          border: 0,
          background: 'transparent',
          color: textColor,
          textAlign: 'left',
          cursor: 'pointer',
          borderBottom: expanded ? `1px solid ${borderColor}72` : 'none',
        }
      : {
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '2px 1px 5px',
          border: 0,
          background: 'transparent',
          fontSize: 9,
          color: mutedColor,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          textAlign: 'left',
          cursor: 'pointer',
        };

  const headerLabelStyle: CSSProperties =
    variant === 'panel'
      ? {
          display: 'inline-flex',
          minWidth: 0,
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }
      : {
          display: 'inline-flex',
          minWidth: 0,
          alignItems: 'center',
          gap: 5,
        };

  const baseContentStyle: CSSProperties =
    variant === 'panel'
      ? {}
      : {
          display: 'grid',
          gap: 4,
        };

  return (
    <section style={{ ...baseSectionStyle, ...sectionStyle }}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={ariaLabel}
        onClick={onToggleCollapsed}
        style={{ ...baseButtonStyle, ...buttonStyle }}
      >
        <span style={headerLabelStyle}>
          <ChevronIcon
            size={11}
            style={{
              flexShrink: 0,
              color: mutedColor,
            }}
          />
          {leadingIcon ? (
            <span
              style={{
                display: 'inline-flex',
                flexShrink: 0,
                color: variant === 'panel' ? 'var(--overlay-text-secondary)' : mutedColor,
              }}
            >
              {leadingIcon}
            </span>
          ) : null}
          <span
            style={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        </span>
        {countNode}
      </button>
      {expanded ? (
        <div style={{ ...baseContentStyle, ...contentStyle }}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
