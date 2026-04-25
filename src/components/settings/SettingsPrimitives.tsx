import { cloneElement, isValidElement, type CSSProperties, type ReactNode } from 'react';
import { PremiumSlider } from '../PremiumSlider';
import type { InteractionMotionBinding } from '../../animation/interactionMotion';

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
      className="rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
      style={{
        border: `1px solid ${active ? 'currentColor' : 'var(--overlay-workbench-settings-badge-border)'}`,
        background: active ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-settings-badge-bg)',
      }}
    >
      {label}
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
        <div className="mt-0.5 text-[10px] leading-4 opacity-40">{subtitle}</div>
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
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded border p-3 ${className}`.trim()}
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
      {title ? <div className="mt-3">{children}</div> : children}
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

export function SettingsRow({
  title,
  description,
  control,
  note,
  disabled = false,
  className = '',
  style,
}: {
  title: string;
  description: ReactNode;
  control: ReactNode;
  note?: ReactNode;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const labeledControl = isValidElement<{ 'aria-label'?: string; 'aria-labelledby'?: string }>(control)
    ? cloneElement(
      control,
      control.props['aria-label'] || control.props['aria-labelledby']
        ? {}
        : { 'aria-label': title },
    )
    : control;

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded border px-3 py-3 text-[11px] ${className}`.trim()}
      data-settings-row={title}
      style={{
        borderColor: 'var(--overlay-workbench-settings-card-border)',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">{title}</div>
        <div className="mt-1 text-[11px] opacity-40">{description}</div>
        {note ? <div className="mt-2 text-[10px] opacity-45">{note}</div> : null}
      </div>
      <div className="shrink-0">{labeledControl}</div>
    </div>
  );
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
          <div className="text-[11px] font-semibold">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-[9px] uppercase tracking-[0.14em] opacity-55">{subtitle}</div>
          ) : null}
        </div>
        {badges ? <div className="shrink-0">{badges}</div> : null}
      </div>
      {description ? <div className="mt-2 text-[11px] leading-4 opacity-45">{description}</div> : null}
      {metadata ? <div className="mt-2">{metadata}</div> : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </Component>
  );
}

export function SettingsInspectorPanel({
  title,
  subtitle,
  badges,
  children,
  tone = 'muted',
  accent,
  className = '',
  style,
}: {
  title: string;
  subtitle?: ReactNode;
  badges?: string[];
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
  border,
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
      title={subtitle}
      className="w-full rounded px-2 py-2 text-left transition-colors"
      data-settings-rail-button={label}
      {...motionBinding?.motionDataAttributes}
      onPointerEnter={motionBinding?.onPointerEnter}
      onPointerLeave={motionBinding?.onPointerLeave}
      onPointerDown={motionBinding?.onPointerDown}
      onPointerUp={motionBinding?.onPointerUp}
      onPointerCancel={motionBinding?.onPointerCancel}
      style={{
        border: `1px solid ${active ? `${accent}88` : border}`,
        background: active ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-settings-rail-bg)',
        color: text,
        boxShadow: active ? `inset 0 0 0 1px ${accent}22` : 'none',
        ...motionBinding?.motionStyle,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</div>
          <div className="mt-1 text-[11px] leading-4 opacity-60">{summary}</div>
          <div className="mt-1 text-[10px] leading-4" style={{ color: active ? accent : muted }}>
            {subtitle}
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
  return (
    <div
      className="rounded border p-3"
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
          <p className="mt-1 text-[11px] leading-4 opacity-45">{subtitle}</p>
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
}: {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  valueLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded border p-3" style={{ borderColor: 'var(--overlay-workbench-settings-card-border)', background: 'var(--overlay-workbench-settings-card-bg)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{label}</div>
          <p className="mt-1 text-[11px] opacity-40">{description}</p>
        </div>
        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
          {valueLabel}
        </span>
      </div>
      <div className="mt-3">
        <PremiumSlider
          ariaLabel={label}
          ariaValueText={valueLabel}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
        />
      </div>
    </label>
  );
}
