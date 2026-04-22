import { useMemo, type CSSProperties, type ReactNode } from 'react';

import {
  FolderOpen,
  LayoutGrid,
  Search,
  Settings2,
  Sparkles,
} from '@/components/AppIcons';

import type { ResolvedOverlayAppearance } from '../config/appearance';
import { useInteractionMotionController } from './interactionMotion';

interface InteractionMotionLabProps {
  appearance: Pick<ResolvedOverlayAppearance, 'baseTheme'>;
  accent: string;
  border: string;
  text: string;
  muted: string;
}

interface MotionLabSampleSurfaceProps {
  label: string;
  surfaceLabel: string;
  style?: CSSProperties;
  children: ReactNode;
}

function MotionLabSampleSurface({
  label,
  surfaceLabel,
  style,
  children,
}: MotionLabSampleSurfaceProps) {
  return (
    <section
      className="rounded border p-3"
      style={{
        borderColor: 'var(--overlay-workbench-settings-card-border)',
        background: 'rgba(255,255,255,0.025)',
        ...style,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{label}</div>
          <div className="mt-1 text-[11px] opacity-45">{surfaceLabel}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

export function InteractionMotionLab({
  appearance,
  accent,
  border,
  text,
  muted,
}: InteractionMotionLabProps) {
  const interactionMotion = useInteractionMotionController(appearance);
  const sampleTransition = 'background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, color 150ms ease';
  const chromeTransition = 'background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, color 150ms ease, opacity 150ms ease';

  const explorerIdleMotion = interactionMotion.bindSurface({
    surfaceId: 'explorerEntry',
    baseTransform: 'translateY(0)',
    baseTransition: sampleTransition,
  });
  const explorerSelectedMotion = interactionMotion.bindSurface({
    surfaceId: 'explorerEntry',
    triggerState: { select: true },
    baseTransform: 'translateY(0)',
    baseTransition: sampleTransition,
  });
  const explorerDropMotion = interactionMotion.bindSurface({
    surfaceId: 'explorerEntry',
    triggerState: { dropHover: true },
    baseTransform: 'translateY(-2px)',
    baseTransition: sampleTransition,
  });
  const railIdleMotion = interactionMotion.bindSurface({
    surfaceId: 'explorerRailItem',
    baseTransition: chromeTransition,
  });
  const railActiveMotion = interactionMotion.bindSurface({
    surfaceId: 'explorerRailItem',
    triggerState: { activate: true },
    baseTransition: chromeTransition,
  });
  const workflowIdleMotion = interactionMotion.bindSurface({
    surfaceId: 'previewWorkflowTab',
    baseTransition: chromeTransition,
  });
  const workflowActiveMotion = interactionMotion.bindSurface({
    surfaceId: 'previewWorkflowTab',
    triggerState: { activate: true },
    baseTransition: chromeTransition,
  });
  const panelIdleMotion = interactionMotion.bindSurface({
    surfaceId: 'panelTab',
    baseTransition: chromeTransition,
  });
  const panelActiveMotion = interactionMotion.bindSurface({
    surfaceId: 'panelTab',
    triggerState: { activate: true },
    baseTransition: chromeTransition,
  });
  const topBarIdleMotion = interactionMotion.bindSurface({
    surfaceId: 'topBarButton',
    baseTransition: chromeTransition,
  });
  const topBarActiveMotion = interactionMotion.bindSurface({
    surfaceId: 'topBarButton',
    triggerState: { activate: true },
    baseTransition: chromeTransition,
  });
  const settingsCardMotion = interactionMotion.bindSurface({
    surfaceId: 'settingsCard',
    baseTransition: chromeTransition,
  });

  const chipStyle = useMemo<CSSProperties>(() => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: 'rgba(255,255,255,0.03)',
    color: muted,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  }), [border, muted]);

  return (
    <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Motion Lab</div>
          <p className="mt-1 max-w-[56rem] text-[11px] leading-4 opacity-45">
            Hover or press the samples. These use the same interaction-motion resolver as the live shell, so the active preset, intensity, and surface overrides update here and in the app together.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span style={chipStyle}>Shell-Wide</span>
          <span style={chipStyle}>Resolver-Backed</span>
          {interactionMotion.prefersReducedMotion && (
            <span style={{ ...chipStyle, borderColor: `${accent}66`, color: accent }}>
              Reduced Motion
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <MotionLabSampleSurface label="Explorer Entries" surfaceLabel="Idle, selected, and drop-hover explorer cards share one motion profile.">
          <div className="space-y-2">
            <button
              type="button"
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${border}`,
                background: 'rgba(255,255,255,0.03)',
                color: text,
                textAlign: 'left',
                cursor: 'pointer',
                ...explorerIdleMotion.motionStyle,
              }}
              {...explorerIdleMotion.motionDataAttributes}
              onPointerEnter={explorerIdleMotion.onPointerEnter}
              onPointerLeave={explorerIdleMotion.onPointerLeave}
              onPointerDown={explorerIdleMotion.onPointerDown}
              onPointerUp={explorerIdleMotion.onPointerUp}
              onPointerCancel={explorerIdleMotion.onPointerCancel}
            >
              <FolderOpen size={14} style={{ color: accent, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>Idle folder</span>
                <span style={{ display: 'block', fontSize: 10, color: muted }}>Hover and press this surface.</span>
              </span>
              <span style={{ ...chipStyle, padding: '4px 7px', fontSize: 9 }}>Idle</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 10px',
                  borderRadius: 12,
                  border: `1px solid ${accent}66`,
                  background: `${accent}16`,
                  color: text,
                  textAlign: 'left',
                  cursor: 'pointer',
                  ...explorerSelectedMotion.motionStyle,
                }}
                {...explorerSelectedMotion.motionDataAttributes}
                onPointerEnter={explorerSelectedMotion.onPointerEnter}
                onPointerLeave={explorerSelectedMotion.onPointerLeave}
                onPointerDown={explorerSelectedMotion.onPointerDown}
                onPointerUp={explorerSelectedMotion.onPointerUp}
                onPointerCancel={explorerSelectedMotion.onPointerCancel}
              >
                <Sparkles size={13} style={{ color: accent, flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700 }}>Selected</span>
                  <span style={{ display: 'block', fontSize: 9.5, color: muted }}>Select trigger</span>
                </span>
              </button>
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 10px',
                  borderRadius: 12,
                  border: `1px solid ${accent}55`,
                  background: `${accent}12`,
                  color: text,
                  textAlign: 'left',
                  cursor: 'pointer',
                  ...explorerDropMotion.motionStyle,
                }}
                {...explorerDropMotion.motionDataAttributes}
                onPointerEnter={explorerDropMotion.onPointerEnter}
                onPointerLeave={explorerDropMotion.onPointerLeave}
                onPointerDown={explorerDropMotion.onPointerDown}
                onPointerUp={explorerDropMotion.onPointerUp}
                onPointerCancel={explorerDropMotion.onPointerCancel}
              >
                <LayoutGrid size={13} style={{ color: accent, flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700 }}>Drop Hover</span>
                  <span style={{ display: 'block', fontSize: 9.5, color: muted }}>Drop-hover trigger</span>
                </span>
              </button>
            </div>
          </div>
        </MotionLabSampleSurface>

        <MotionLabSampleSurface label="Explorer Rail" surfaceLabel="Source rows and drive bookmarks use the same shared motion path.">
          <div className="space-y-2">
            {[{
              label: 'Workspace',
              meta: 'Idle rail item',
              binding: railIdleMotion,
              active: false,
            }, {
              label: 'Pinned Drive',
              meta: 'Active rail item',
              binding: railActiveMotion,
              active: true,
            }].map(sample => (
              <button
                key={sample.label}
                type="button"
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1px solid ${sample.active ? `${accent}66` : border}`,
                  background: sample.active ? `${accent}12` : 'rgba(255,255,255,0.03)',
                  color: text,
                  cursor: 'pointer',
                  textAlign: 'left',
                  ...sample.binding.motionStyle,
                }}
                {...sample.binding.motionDataAttributes}
                onPointerEnter={sample.binding.onPointerEnter}
                onPointerLeave={sample.binding.onPointerLeave}
                onPointerDown={sample.binding.onPointerDown}
                onPointerUp={sample.binding.onPointerUp}
                onPointerCancel={sample.binding.onPointerCancel}
              >
                <FolderOpen size={13} style={{ color: sample.active ? accent : muted, flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>{sample.label}</span>
                  <span style={{ display: 'block', fontSize: 10, color: muted }}>{sample.meta}</span>
                </span>
                <span style={{ ...chipStyle, padding: '4px 7px', fontSize: 9, color: sample.active ? accent : muted }}>
                  {sample.active ? 'Active' : 'Idle'}
                </span>
              </button>
            ))}
          </div>
        </MotionLabSampleSurface>

        <MotionLabSampleSurface label="Workflow Tabs" surfaceLabel="Preview and edit chips animate through the same tab interaction profile.">
          <div
            className="inline-flex flex-wrap items-center gap-2 rounded border p-2"
            style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}
          >
            {[{
              label: 'Preview',
              binding: workflowActiveMotion,
              active: true,
            }, {
              label: 'Edit',
              binding: workflowIdleMotion,
              active: false,
            }, {
              label: 'VST',
              binding: workflowIdleMotion,
              active: false,
            }].map(tab => (
              <button
                key={tab.label}
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 999,
                  border: `1px solid ${tab.active ? `${accent}66` : 'transparent'}`,
                  background: tab.active ? `${accent}14` : 'transparent',
                  color: tab.active ? text : muted,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 700,
                  ...tab.binding.motionStyle,
                }}
                {...tab.binding.motionDataAttributes}
                onPointerEnter={tab.binding.onPointerEnter}
                onPointerLeave={tab.binding.onPointerLeave}
                onPointerDown={tab.binding.onPointerDown}
                onPointerUp={tab.binding.onPointerUp}
                onPointerCancel={tab.binding.onPointerCancel}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </MotionLabSampleSurface>

        <MotionLabSampleSurface label="Panel Tabs" surfaceLabel="Top-bar tabs use the shared panel-tab motion profile.">
          <div
            className="flex items-center gap-1 overflow-hidden rounded border"
            style={{ borderColor: border, background: 'rgba(0,0,0,0.1)' }}
          >
            {[{
              label: 'Explorer',
              binding: panelActiveMotion,
              active: true,
            }, {
              label: 'Notes',
              binding: panelIdleMotion,
              active: false,
            }, {
              label: 'Shots',
              binding: panelIdleMotion,
              active: false,
            }].map(tab => (
              <button
                key={tab.label}
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 10px',
                  border: 'none',
                  borderBottom: `2px solid ${tab.active ? accent : 'transparent'}`,
                  background: tab.active ? `${accent}12` : 'transparent',
                  color: tab.active ? text : muted,
                  cursor: 'pointer',
                  fontSize: 10.5,
                  fontWeight: tab.active ? 700 : 600,
                  ...tab.binding.motionStyle,
                }}
                {...tab.binding.motionDataAttributes}
                onPointerEnter={tab.binding.onPointerEnter}
                onPointerLeave={tab.binding.onPointerLeave}
                onPointerDown={tab.binding.onPointerDown}
                onPointerUp={tab.binding.onPointerUp}
                onPointerCancel={tab.binding.onPointerCancel}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </MotionLabSampleSurface>

        <MotionLabSampleSurface label="Top Bar Buttons" surfaceLabel="Chrome actions such as search, layouts, and focus toggles stay consistent.">
          <div className="flex flex-wrap items-center gap-2">
            {[{
              label: 'Search',
              icon: <Search size={12} />,
              binding: topBarIdleMotion,
              active: false,
            }, {
              label: 'Panels',
              icon: <LayoutGrid size={12} />,
              binding: topBarIdleMotion,
              active: false,
            }, {
              label: 'Zen',
              icon: <Sparkles size={12} />,
              binding: topBarActiveMotion,
              active: true,
            }].map(button => (
              <button
                key={button.label}
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 10px',
                  borderRadius: 999,
                  border: `1px solid ${button.active ? `${accent}66` : border}`,
                  background: button.active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                  color: button.active ? text : muted,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  ...button.binding.motionStyle,
                }}
                {...button.binding.motionDataAttributes}
                onPointerEnter={button.binding.onPointerEnter}
                onPointerLeave={button.binding.onPointerLeave}
                onPointerDown={button.binding.onPointerDown}
                onPointerUp={button.binding.onPointerUp}
                onPointerCancel={button.binding.onPointerCancel}
              >
                {button.icon}
                {button.label}
              </button>
            ))}
          </div>
        </MotionLabSampleSurface>

        <MotionLabSampleSurface label="Settings Cards" surfaceLabel="Settings tiles and cards get the same micro-interaction lane.">
          <button
            type="button"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px',
              borderRadius: 14,
              border: `1px solid ${border}`,
              background: 'var(--overlay-workbench-settings-card-bg)',
              color: text,
              textAlign: 'left',
              cursor: 'pointer',
              boxShadow: `0 10px 24px ${accent}10`,
              ...settingsCardMotion.motionStyle,
            }}
            {...settingsCardMotion.motionDataAttributes}
            onPointerEnter={settingsCardMotion.onPointerEnter}
            onPointerLeave={settingsCardMotion.onPointerLeave}
            onPointerDown={settingsCardMotion.onPointerDown}
            onPointerUp={settingsCardMotion.onPointerUp}
            onPointerCancel={settingsCardMotion.onPointerCancel}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings2 size={13} style={{ color: accent, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700 }}>Interaction Motion Card</span>
              </span>
              <span style={{ display: 'block', marginTop: 6, fontSize: 10.5, color: muted, lineHeight: 1.45 }}>
                Shared settings-card motion keeps the settings surface alive without pulling attention away from the controls.
              </span>
            </span>
            <span style={{ ...chipStyle, padding: '4px 7px', fontSize: 9 }}>Hover</span>
          </button>
        </MotionLabSampleSurface>
      </div>
    </div>
  );
}
