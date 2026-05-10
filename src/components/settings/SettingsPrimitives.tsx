import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, Info } from '../AppIcons';
import { PremiumSlider } from '../PremiumSlider';
import { OverlayToggle } from '../OverlayToggle';
import type { InteractionMotionBinding } from '../../animation/interactionMotion';

// ---------------------------------------------------------------------------
// Description visibility context
// ---------------------------------------------------------------------------
//
// Settings rows used to render their `description` text inline at all times,
// which made `rows`-archetype pages feel balloon-y and hard to scan. The
// macOS-style compaction pass moves descriptions into a hover/focus
// `InfoBubble` by default. Sections opt back into the verbose layout via a
// per-section "Show descriptions" toggle wired through this context, so we
// don't have to prop-drill the flag through every row.

const SettingsRowDescriptionContext = createContext<boolean>(false);

export function SettingsRowDescriptionProvider({
  showDescriptions,
  children,
}: {
  showDescriptions: boolean;
  children: ReactNode;
}) {
  return (
    <SettingsRowDescriptionContext.Provider value={showDescriptions}>
      {children}
    </SettingsRowDescriptionContext.Provider>
  );
}

export function useSettingsRowDescriptionsVisible(): boolean {
  return useContext(SettingsRowDescriptionContext);
}

// ---------------------------------------------------------------------------
// Info bubble
// ---------------------------------------------------------------------------

// Tooltip rendered through a body portal so settings rows near the bottom of
// the panel, inside scroll containers, or under any ancestor with
// `overflow: hidden`/`auto` cannot clip it. The tooltip is positioned against
// the trigger button's viewport rect, with automatic flip-up when there is
// not enough room below and horizontal clamping inside the viewport so it
// never spawns off-canvas.
const INFO_BUBBLE_GAP = 6;
const INFO_BUBBLE_VIEWPORT_PADDING = 8;
const INFO_BUBBLE_MAX_WIDTH = 280;
const INFO_BUBBLE_MIN_WIDTH = 200;

type InfoBubblePlacement = 'top' | 'bottom';

interface InfoBubblePosition {
  top: number;
  left: number;
  placement: InfoBubblePlacement;
}

export function InfoBubble({
  description,
  note,
  label,
  className = '',
}: {
  description: ReactNode;
  note?: ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<InfoBubblePosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();
  const ariaLabel = label ?? 'More info';

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      const placement: InfoBubblePlacement =
        spaceBelow >= tooltipRect.height + INFO_BUBBLE_GAP + INFO_BUBBLE_VIEWPORT_PADDING
          ? 'bottom'
          : spaceAbove >= tooltipRect.height + INFO_BUBBLE_GAP + INFO_BUBBLE_VIEWPORT_PADDING
            ? 'top'
            : spaceBelow >= spaceAbove
              ? 'bottom'
              : 'top';

      const top = placement === 'bottom'
        ? triggerRect.bottom + INFO_BUBBLE_GAP
        : triggerRect.top - tooltipRect.height - INFO_BUBBLE_GAP;
      const desiredLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      const minLeft = INFO_BUBBLE_VIEWPORT_PADDING;
      const maxLeft = Math.max(minLeft, viewportWidth - tooltipRect.width - INFO_BUBBLE_VIEWPORT_PADDING);
      const clampedLeft = Math.min(Math.max(desiredLeft, minLeft), maxLeft);
      const minTop = INFO_BUBBLE_VIEWPORT_PADDING;
      const maxTop = Math.max(minTop, viewportHeight - tooltipRect.height - INFO_BUBBLE_VIEWPORT_PADDING);
      const clampedTop = Math.min(Math.max(top, minTop), maxTop);

      setPosition({ top: clampedTop, left: clampedLeft, placement });
    };

    updatePosition();

    const scrollOptions: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener('scroll', updatePosition, scrollOptions);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, scrollOptions);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <span
      className={`relative inline-flex items-center ${className}`.trim()}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(prev => !prev)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full opacity-50 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none"
        style={{
          color: 'var(--overlay-text-primary)',
          background: 'transparent',
        }}
      >
        <Info size={11} />
      </button>
      {portalTarget
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              aria-hidden={!open}
              className="pointer-events-none fixed rounded border px-2.5 py-1.5 text-[10px] leading-4 transition-opacity"
              style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                opacity: open && position != null ? 1 : 0,
                minWidth: INFO_BUBBLE_MIN_WIDTH,
                maxWidth: INFO_BUBBLE_MAX_WIDTH,
                zIndex: 2147483600,
                borderColor: 'var(--overlay-workbench-settings-card-border)',
                background: 'var(--overlay-workbench-settings-card-bg)',
                color: 'var(--overlay-text-primary)',
                boxShadow: '0 6px 18px rgba(0,0,0,0.32)',
                whiteSpace: 'normal',
              }}
            >
              <span className="block opacity-80">{description}</span>
              {note ? <span className="mt-1 block opacity-60">{note}</span> : null}
            </span>,
            portalTarget,
          )
        : null}
    </span>
  );
}

type SettingsSurfaceTone = 'default' | 'muted' | 'accent';

function resolveSettingsSurfaceStyle(
  tone: SettingsSurfaceTone,
  accent?: string,
): CSSProperties {
  if (tone === 'accent') {
    return {
      borderColor: accent ? `${accent}44` : 'var(--overlay-workbench-settings-card-border)',
      background: accent ? `${accent}0d` : 'var(--overlay-workbench-settings-card-bg)',
    };
  }

  if (tone === 'muted') {
    return {
      borderColor: 'var(--overlay-workbench-settings-card-border)',
      background: 'rgba(255,255,255,0.025)',
    };
  }

  return {
    borderColor: 'var(--overlay-workbench-settings-card-border)',
    background: 'var(--overlay-workbench-settings-card-bg)',
  };
}

export function ThemeBadge({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      className="inline-flex max-w-full items-center rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
      style={{
        border: `1px solid ${active ? 'currentColor' : 'var(--overlay-workbench-settings-badge-border)'}`,
        background: active ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-settings-badge-bg)',
      }}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

export function SettingsSectionHeader({
  icon,
  title,
  subtitle,
  badges,
  actions,
}: {
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  badges?: string[];
  actions?: ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-start justify-between gap-3"
      data-settings-section-header={title}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-60">
          {icon}
          <span>{title}</span>
        </div>
        <div className="mt-0.5 truncate text-[10px] leading-3 opacity-40">{subtitle}</div>
        {badges && badges.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {badges.map(badge => (
              <ThemeBadge key={badge} label={badge} />
            ))}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <SettingsSectionHeader
      icon={icon}
      title={title}
      subtitle={subtitle}
    />
  );
}

export function SettingsSectionBlock({
  children,
  title,
  subtitle,
  badges,
  actions,
  tone = 'default',
  accent,
  className = '',
  contentClassName = '',
  style,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  badges?: string[];
  actions?: ReactNode;
  tone?: SettingsSurfaceTone;
  accent?: string;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded border p-2.5 ${className}`.trim()}
      data-settings-section-block={title ?? 'block'}
      style={{
        ...resolveSettingsSurfaceStyle(tone, accent),
        ...style,
      }}
    >
      {title ? (
        <SettingsSectionHeader
          icon={null}
          title={title}
          subtitle={subtitle ?? ''}
          badges={badges}
          actions={actions}
        />
      ) : null}
      {title ? (
        <div className={`mt-3 ${contentClassName}`.trim()}>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

export function SettingsActionStrip({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
      data-settings-action-strip="true"
    >
      {children}
    </div>
  );
}

export function SettingsStatusPill({
  children,
  active = false,
  className = '',
  style,
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${className}`.trim()}
      style={{
        border: `1px solid ${active ? 'currentColor' : 'var(--overlay-workbench-settings-badge-border)'}`,
        background: active ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-settings-badge-bg)',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function SettingsActionButton({
  children,
  active = false,
  accent,
  className = '',
  style,
  ...buttonProps
}: {
  children: ReactNode;
  active?: boolean;
  accent?: string;
  className?: string;
  style?: CSSProperties;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style' | 'children'>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${className}`.trim()}
      style={{
        border: `1px solid ${active && accent ? `${accent}88` : 'var(--overlay-workbench-settings-badge-border)'}`,
        background: active && accent ? `${accent}1f` : 'var(--overlay-workbench-settings-badge-bg)',
        color: 'var(--overlay-text-primary)',
        ...style,
      }}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export function SettingsCompactActionButton({
  children,
  active = false,
  accent,
  className = '',
  style,
  ...buttonProps
}: {
  children: ReactNode;
  active?: boolean;
  accent?: string;
  className?: string;
  style?: CSSProperties;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style' | 'children'>) {
  return (
    <button
      type="button"
      className={`inline-flex h-6 min-w-0 items-center gap-1.5 rounded px-2 text-[10px] font-semibold uppercase transition-colors disabled:opacity-50 ${className}`.trim()}
      style={{
        border: `1px solid ${active && accent ? `${accent}88` : 'var(--overlay-workbench-settings-badge-border)'}`,
        background: active && accent ? `${accent}1f` : 'var(--overlay-workbench-settings-badge-bg)',
        color: 'var(--overlay-text-primary)',
        ...style,
      }}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export function SettingsIconActionButton({
  children,
  active = false,
  accent,
  className = '',
  style,
  ...buttonProps
}: {
  children: ReactNode;
  active?: boolean;
  accent?: string;
  className?: string;
  style?: CSSProperties;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style' | 'children'>) {
  return (
    <button
      type="button"
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors disabled:opacity-50 ${className}`.trim()}
      style={{
        border: `1px solid ${active && accent ? `${accent}88` : 'var(--overlay-workbench-settings-badge-border)'}`,
        background: active && accent ? `${accent}1f` : 'var(--overlay-workbench-settings-badge-bg)',
        color: 'var(--overlay-text-primary)',
        ...style,
      }}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export function SettingsSelect({
  className = '',
  style,
  children,
  ...selectProps
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'style' | 'children'>) {
  return (
    <select
      className={`h-7 min-w-0 rounded border bg-transparent px-2 text-[11px] outline-none ${className}`.trim()}
      style={{
        borderColor: 'var(--overlay-workbench-settings-badge-border)',
        background: 'var(--overlay-workbench-settings-badge-bg)',
        color: 'var(--overlay-text-primary)',
        ...style,
      }}
      {...selectProps}
    >
      {children}
    </select>
  );
}

export function SettingsCompactSection({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded border ${className}`.trim()}
      data-settings-compact-section={title}
      style={{
        borderColor: 'var(--overlay-workbench-settings-card-border)',
        background: 'var(--overlay-workbench-settings-card-bg)',
      }}
    >
      <div
        className="flex min-w-0 items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--overlay-workbench-settings-card-border)' }}
      >
        <div className="min-w-0">
          <div className="truncate text-[10px] font-semibold uppercase opacity-70">{title}</div>
          {subtitle ? <div className="truncate text-[10px] opacity-45">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function SettingsKeyValueRow({
  label,
  value,
  action,
}: {
  label: ReactNode;
  value: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="grid min-h-8 grid-cols-[minmax(120px,0.35fr)_minmax(0,1fr)_auto] items-center gap-3 border-t px-3 py-1.5 text-[11px] first:border-t-0"
      data-settings-key-value-row="true"
      style={{ borderColor: 'var(--overlay-workbench-settings-card-border)' }}
    >
      <div className="min-w-0 truncate font-semibold uppercase opacity-65">{label}</div>
      <div className="min-w-0 truncate opacity-80">{value}</div>
      {action ? <div className="shrink-0">{action}</div> : <div />}
    </div>
  );
}

export function SettingsOverflowMenu({
  label = 'More',
  children,
  className = '',
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`relative ${className}`.trim()} data-settings-overflow-menu="true">
      <summary
        className="flex h-6 cursor-pointer list-none items-center rounded border px-2 text-[10px] font-semibold uppercase"
        style={{
          borderColor: 'var(--overlay-workbench-settings-badge-border)',
          background: 'var(--overlay-workbench-settings-badge-bg)',
          color: 'var(--overlay-text-primary)',
        }}
      >
        {label}
      </summary>
      <div
        className="absolute right-0 top-7 z-20 min-w-40 rounded border p-1"
        style={{
          borderColor: 'var(--overlay-workbench-settings-card-border)',
          background: 'var(--overlay-workbench-settings-card-bg)',
          boxShadow: 'var(--overlay-workbench-shell-shadow)',
        }}
      >
        {children}
      </div>
    </details>
  );
}

export function SettingsDirectoryTable({
  entries,
  onOpen,
  emptyLabel = 'No directories',
}: {
  entries: Array<{
    id: string;
    label: string;
    path: string;
    description?: string;
  }>;
  onOpen: (entry: { id: string; label: string; path: string }) => void;
  emptyLabel?: string;
}) {
  return (
    <div
      className="min-w-0 overflow-hidden rounded border"
      data-settings-directory-table="true"
      style={{
        borderColor: 'var(--overlay-workbench-settings-card-border)',
        background: 'var(--overlay-workbench-settings-card-bg)',
      }}
    >
      {entries.length === 0 ? (
        <div className="px-3 py-4 text-[11px] opacity-50">{emptyLabel}</div>
      ) : (
        entries.map((entry, index) => (
          <div
            key={entry.id}
            className={`grid min-h-8 grid-cols-[minmax(120px,0.28fr)_minmax(0,1fr)_auto] items-center gap-3 px-3 py-1.5 text-[11px] ${index > 0 ? 'border-t' : ''}`.trim()}
            style={{ borderColor: 'var(--overlay-workbench-settings-card-border)' }}
          >
            <div className="min-w-0 truncate font-semibold">{entry.label}</div>
            <div className="min-w-0 truncate opacity-60" title={entry.description ?? entry.path}>
              <span style={{ fontFamily: 'var(--overlay-font-mono)' }}>{entry.path}</span>
            </div>
            <SettingsIconActionButton
              aria-label={`Open ${entry.label} Folder`}
              title={`Open ${entry.label} Folder`}
              onClick={() => onOpen(entry)}
            >
              <FolderOpen size={13} />
            </SettingsIconActionButton>
          </div>
        ))
      )}
    </div>
  );
}

// Group context: when SettingsRow renders inside a SettingsRowGroup we drop
// per-row borders so the group can paint a single bordered shell with
// hairline dividers between rows (macOS Settings vibe).
const SettingsRowGroupContext = createContext<boolean>(false);

export function SettingsRowGroup({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <SettingsRowGroupContext.Provider value={true}>
      <div
        data-settings-row-group="true"
        className={`overflow-hidden rounded border ${className}`.trim()}
        style={{
          borderColor: 'var(--overlay-workbench-settings-card-border)',
          background: 'var(--overlay-workbench-settings-card-bg)',
          ...style,
        }}
      >
        {children}
      </div>
    </SettingsRowGroupContext.Provider>
  );
}

export function SettingsRow({
  title,
  description,
  control,
  note,
  disabled = false,
  className = '',
  style,
  descriptionAlwaysVisible = false,
}: {
  title: string;
  description: ReactNode;
  control: ReactNode;
  note?: ReactNode;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Force the description to render inline even when the section is in
   * compact / bubble mode. Use sparingly for rows whose description is
   * actually critical context, not boilerplate. */
  descriptionAlwaysVisible?: boolean;
}) {
  const showAllDescriptions = useSettingsRowDescriptionsVisible();
  const inGroup = useContext(SettingsRowGroupContext);
  const showInline = descriptionAlwaysVisible || showAllDescriptions;

  const normalizedControl = isNativeCheckboxControl(control)
    ? convertNativeCheckboxToToggle(control)
    : control;
  const labeledControl = isValidElement<{ 'aria-label'?: string; 'aria-labelledby'?: string }>(normalizedControl)
    ? cloneElement(
      normalizedControl,
      normalizedControl.props['aria-label'] || normalizedControl.props['aria-labelledby']
        ? {}
        : { 'aria-label': title },
    )
    : normalizedControl;

  const containerClass = inGroup
    ? `flex items-center justify-between gap-4 px-3 py-2.5 text-[11px] [&:not(:first-child)]:border-t ${className}`.trim()
    : `flex items-center justify-between gap-4 rounded border px-3 ${showInline ? 'py-3' : 'py-2.5'} text-[11px] ${className}`.trim();

  const containerStyle: CSSProperties = inGroup
    ? {
      borderColor: 'var(--overlay-workbench-settings-card-border)',
      opacity: disabled ? 0.6 : 1,
      ...style,
    }
    : {
      borderColor: 'var(--overlay-workbench-settings-card-border)',
      opacity: disabled ? 0.6 : 1,
      ...style,
    };

  return (
    <div
      className={containerClass}
      data-settings-row={title}
      style={containerStyle}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="font-semibold uppercase tracking-[0.12em] opacity-70">{title}</div>
          {showInline ? null : (
            <InfoBubble
              description={description}
              note={note}
              label={`About ${title}`}
            />
          )}
        </div>
        {showInline ? (
          <>
            <div className="mt-1 text-[11px] opacity-45">{description}</div>
            {note ? <div className="mt-2 text-[10px] opacity-50">{note}</div> : null}
          </>
        ) : null}
      </div>
      <div className="shrink-0">{labeledControl}</div>
    </div>
  );
}

function isNativeCheckboxControl(
  control: ReactNode,
): control is ReactElement<InputHTMLAttributes<HTMLInputElement>> {
  return isValidElement<InputHTMLAttributes<HTMLInputElement>>(control)
    && control.type === 'input'
    && control.props.type === 'checkbox';
}

function convertNativeCheckboxToToggle(
  control: ReactElement<InputHTMLAttributes<HTMLInputElement>>,
): ReactElement {
  const { type: _type, size: _size, ...checkboxProps } = control.props;
  return <OverlayToggle {...checkboxProps} />;
}

export function SettingsCatalogGrid({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-2 ${className}`.trim()}
      data-settings-catalog-grid="true"
    >
      {children}
    </div>
  );
}

export function SettingsCatalogCard({
  title,
  subtitle,
  description,
  badges,
  preview,
  metadata,
  footer,
  active = false,
  onClick,
  accent,
  className = '',
  style,
}: {
  title: string;
  subtitle?: ReactNode;
  description?: ReactNode;
  badges?: ReactNode;
  preview?: ReactNode;
  metadata?: ReactNode;
  footer?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  accent?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      {...(onClick ? { type: 'button', onClick, 'aria-label': title } : {})}
      className={`rounded border px-3 py-3 text-left transition-colors ${className}`.trim()}
      data-settings-catalog-card={title}
      style={{
        borderColor: active
          ? (accent ?? 'var(--overlay-accent)')
          : 'var(--overlay-workbench-settings-card-border)',
        background: active
          ? `${accent ?? 'var(--overlay-accent)'}16`
          : 'rgba(255,255,255,0.03)',
        color: 'var(--overlay-text-primary)',
        boxShadow: active && accent ? `inset 0 0 0 1px ${accent}22` : 'none',
        ...style,
      }}
    >
      {preview ? <div className="mb-3">{preview}</div> : null}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-[9px] uppercase tracking-[0.14em] opacity-55">{subtitle}</div>
          ) : null}
        </div>
        {badges ? <div className="shrink-0">{badges}</div> : null}
      </div>
      {description ? (
        <div
          className="mt-1 break-words text-[10px] leading-3 opacity-45"
          style={{
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
          }}
        >
          {description}
        </div>
      ) : null}
      {metadata ? <div className="mt-2">{metadata}</div> : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </Component>
  );
}

export function SettingsInspectorPanel({
  title,
  subtitle,
  badges,
  actions,
  children,
  tone = 'muted',
  accent,
  className = '',
  style,
}: {
  title: string;
  subtitle?: ReactNode;
  badges?: string[];
  actions?: ReactNode;
  children: ReactNode;
  tone?: SettingsSurfaceTone;
  accent?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <SettingsSectionBlock
      title={title}
      subtitle={subtitle ?? ''}
      badges={badges}
      actions={actions}
      tone={tone}
      accent={accent}
      className={className}
      style={style}
    >
      <div data-settings-inspector={title}>{children}</div>
    </SettingsSectionBlock>
  );
}

export function SettingsRailButton({
  active,
  icon,
  label,
  subtitle,
  summary,
  accent,
  border: _border,
  text,
  muted,
  onClick,
  motionBinding,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  subtitle: string;
  summary: string;
  accent: string;
  border: string;
  text: string;
  muted: string;
  onClick: () => void;
  motionBinding?: InteractionMotionBinding;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${subtitle}${summary ? ` | ${summary}` : ''}`}
      aria-label={label}
      className="w-full overflow-hidden rounded px-2 py-1.5 text-left transition-colors"
      data-settings-rail-button={label}
      {...motionBinding?.motionDataAttributes}
      onPointerEnter={motionBinding?.onPointerEnter}
      onPointerLeave={motionBinding?.onPointerLeave}
      onPointerDown={motionBinding?.onPointerDown}
      onPointerUp={motionBinding?.onPointerUp}
      onPointerCancel={motionBinding?.onPointerCancel}
      style={{
        border: `1px solid ${active ? `${accent}66` : 'transparent'}`,
        background: active ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'transparent',
        color: text,
        boxShadow: active ? `inset 2px 0 0 ${accent}` : 'none',
        ...motionBinding?.motionStyle,
      }}
    >
      <div className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-2 overflow-hidden">
        <div
          className="flex h-[18px] w-[18px] items-center justify-center rounded"
          style={{ color: active ? accent : muted }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-semibold uppercase">{label}</div>
          <div
            className="text-[9px] leading-3"
            style={{
              color: active ? accent : muted,
              display: '-webkit-box',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
              whiteSpace: 'normal',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 1,
            }}
          >
            {summary}
          </div>
        </div>
      </div>
    </button>
  );
}

export function OverviewCard({
  title,
  subtitle,
  badges,
  children,
  motionBinding,
}: {
  title: string;
  subtitle: string;
  badges?: string[];
  children: ReactNode;
  motionBinding?: InteractionMotionBinding;
}) {
  const showInlineDescriptions = useSettingsRowDescriptionsVisible();
  return (
    <div
      className="rounded border p-2.5"
      data-settings-overview-card={title}
      {...motionBinding?.motionDataAttributes}
      onPointerEnter={motionBinding?.onPointerEnter}
      onPointerLeave={motionBinding?.onPointerLeave}
      onPointerDown={motionBinding?.onPointerDown}
      onPointerUp={motionBinding?.onPointerUp}
      onPointerCancel={motionBinding?.onPointerCancel}
      style={{
        borderColor: 'var(--overlay-workbench-settings-card-border)',
        background: 'var(--overlay-workbench-settings-card-bg)',
        ...motionBinding?.motionStyle,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{title}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] leading-3 opacity-45">
            {showInlineDescriptions ? (
              <span>{subtitle}</span>
            ) : (
              <>
                <span className="truncate">{subtitle}</span>
                <InfoBubble description={subtitle} label={`About ${title}`} />
              </>
            )}
          </div>
        </div>
        {badges && badges.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {badges.map(badge => (
              <span
                key={badge}
                className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{ borderColor: 'var(--overlay-workbench-settings-badge-border)', background: 'var(--overlay-workbench-settings-badge-bg)' }}
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function RangeField({
  label,
  description,
  min,
  max,
  step,
  value,
  valueLabel,
  onChange,
  density = 'comfortable',
}: {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  valueLabel: string;
  onChange: (value: number) => void;
  density?: 'comfortable' | 'compact';
}) {
  const showInlineDescriptions = useSettingsRowDescriptionsVisible();
  return (
    <label className="block min-w-0 overflow-hidden rounded border p-2.5" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'var(--overlay-workbench-settings-card-bg)' }}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="truncate text-[10px] font-semibold uppercase opacity-60">{label}</div>
            {showInlineDescriptions ? null : (
              <InfoBubble description={description} label={`About ${label}`} />
            )}
          </div>
          {showInlineDescriptions ? (
            <div className="mt-1 break-words text-[10px] leading-3 opacity-40">{description}</div>
          ) : null}
        </div>
        <span className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
          {valueLabel}
        </span>
      </div>
      <div className="mt-3 min-w-0 overflow-hidden">
        <PremiumSlider
          ariaLabel={label}
          ariaValueText={valueLabel}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          density={density}
        />
      </div>
    </label>
  );
}
