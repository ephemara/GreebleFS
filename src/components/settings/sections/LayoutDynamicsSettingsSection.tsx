import { useMemo } from "react";
import { LayoutGrid, RotateCcw, Sparkles } from "@/components/AppIcons";
import type { ResolvedOverlayAppearance } from "../../../config/appearance";
import {
  clampLayoutDynamicsIntensity,
  getLayoutDynamicsPreset,
  layoutDynamicsPresetCatalog,
  layoutDynamicsSurfaceCatalog,
  normalizeLayoutDynamicsPresetId,
  normalizeLayoutDynamicsSurfaceOverride,
  resolveLayoutDynamicsPresetId,
  type LayoutDynamicsAuthoringSnapshot,
  type LayoutDynamicsSurfaceOverride,
  type LayoutDynamicsSurfaceOverrideMap,
} from "../../../config/layoutDynamics";
import { useLayoutDynamicsController } from "../../../animation/layoutDynamics";
import { LayoutDynamicsLab } from "../../../animation/LayoutDynamicsLab";
import type { AppearanceSettings } from "../../../store/settingsStore";
import {
  RangeField,
  SettingsActionStrip,
  SettingsCatalogCard,
  SettingsRow,
  SettingsSectionBlock,
  SettingsSectionHeader,
  ThemeBadge,
} from "../SettingsPrimitives";

interface LayoutDynamicsSettingsSectionProps {
  appearance: Pick<ResolvedOverlayAppearance, "baseTheme">;
  layoutDynamicsEnabled: boolean;
  layoutDynamicsPresetId: string | null;
  layoutDynamicsIntensity: number;
  layoutDynamicsSurfaceOverrides: LayoutDynamicsSurfaceOverrideMap;
  topBarLayoutSnapshotsById: Record<string, LayoutDynamicsAuthoringSnapshot>;
  border: string;
  accent: string;
  text: string;
  muted: string;
  onUpdateAppearance: (patch: Partial<AppearanceSettings>) => void;
}

function isSurfaceOverrideObject(
  value: LayoutDynamicsSurfaceOverride | boolean | null | undefined,
): value is LayoutDynamicsSurfaceOverride {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function formatLayoutDynamicsIntensity(value: number): string {
  return `${value.toFixed(2)}x`;
}

function pruneSurfaceOverride(
  override: LayoutDynamicsSurfaceOverride,
): LayoutDynamicsSurfaceOverride | null {
  const nextOverride: LayoutDynamicsSurfaceOverride = {};
  if (override.enabled !== undefined) {
    nextOverride.enabled = override.enabled;
  }
  if (override.presetId !== undefined) {
    nextOverride.presetId = override.presetId;
  }
  if (override.intensityMultiplier !== undefined) {
    nextOverride.intensityMultiplier = override.intensityMultiplier;
  }
  return Object.keys(nextOverride).length > 0 ? nextOverride : null;
}

export function LayoutDynamicsSettingsSection({
  appearance,
  layoutDynamicsEnabled,
  layoutDynamicsPresetId,
  layoutDynamicsIntensity,
  layoutDynamicsSurfaceOverrides,
  topBarLayoutSnapshotsById,
  border,
  accent,
  text,
  muted,
  onUpdateAppearance,
}: LayoutDynamicsSettingsSectionProps) {
  const layoutDynamics = useLayoutDynamicsController(appearance);
  const themeDefaultPresetId =
    appearance.baseTheme.layoutDynamics?.defaultPresetId ?? null;
  const resolvedSharedPresetId = resolveLayoutDynamicsPresetId({
    requestedPresetId: layoutDynamicsPresetId,
    themeDefaultPresetId,
  });
  const resolvedSharedPreset = getLayoutDynamicsPreset(resolvedSharedPresetId);
  const pinnedSharedPresetId = normalizeLayoutDynamicsPresetId(
    layoutDynamicsPresetId,
  );
  const resolvedSurfaceStates = useMemo(
    () =>
      layoutDynamicsSurfaceCatalog.map((surface) =>
        layoutDynamics.resolveSurfaceSettings(surface.id),
      ),
    [layoutDynamics],
  );

  const setSurfaceOverride = (
    surfaceId: (typeof layoutDynamicsSurfaceCatalog)[number]["id"],
    nextOverride: LayoutDynamicsSurfaceOverride | null,
  ) => {
    const nextOverrides = { ...layoutDynamicsSurfaceOverrides };
    if (nextOverride == null) {
      delete nextOverrides[surfaceId];
    } else {
      nextOverrides[surfaceId] = nextOverride;
    }
    onUpdateAppearance({ layoutDynamicsSurfaceOverrides: nextOverrides });
  };

  const setSurfaceEnabled = (
    surfaceId: (typeof layoutDynamicsSurfaceCatalog)[number]["id"],
    enabled: boolean,
  ) => {
    const currentOverride = normalizeLayoutDynamicsSurfaceOverride(
      layoutDynamicsSurfaceOverrides[surfaceId],
    ) ?? { enabled: true };
    const nextOverride = pruneSurfaceOverride({
      ...currentOverride,
      enabled,
    });
    setSurfaceOverride(surfaceId, nextOverride);
  };

  const setSurfacePresetId = (
    surfaceId: (typeof layoutDynamicsSurfaceCatalog)[number]["id"],
    presetId: string | null,
  ) => {
    const currentOverride = normalizeLayoutDynamicsSurfaceOverride(
      layoutDynamicsSurfaceOverrides[surfaceId],
    ) ?? {};
    const nextOverride = pruneSurfaceOverride({
      ...currentOverride,
      presetId,
    });
    setSurfaceOverride(surfaceId, nextOverride);
  };

  const setSurfaceIntensity = (
    surfaceId: (typeof layoutDynamicsSurfaceCatalog)[number]["id"],
    intensityMultiplier: number,
  ) => {
    const currentOverride = normalizeLayoutDynamicsSurfaceOverride(
      layoutDynamicsSurfaceOverrides[surfaceId],
    ) ?? {};
    const nextOverride = pruneSurfaceOverride({
      ...currentOverride,
      intensityMultiplier: clampLayoutDynamicsIntensity(intensityMultiplier),
    });
    setSurfaceOverride(surfaceId, nextOverride);
  };

  return (
    <section className="space-y-4" data-settings-section="layout-dynamics">
      <SettingsSectionHeader
        icon={<LayoutGrid size={12} />}
        title="Layout Dynamics"
        subtitle="Repo-wide layout-authoring physics for explorer chrome, the shell top bar, and future widget-style surfaces."
        badges={[
          layoutDynamicsEnabled ? "Enabled" : "Disabled",
          layoutDynamics.prefersReducedMotion
            ? "Reduced Motion Softened"
            : "Full Response",
        ]}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <SettingsSectionBlock
            title="Shared Runtime"
            subtitle="One shell-level solver family drives every adopted surface. Surface overrides can still opt out or pin a different preset."
            tone="muted"
          >
            <div className="space-y-3">
              <SettingsRow
                title="Enable layout dynamics"
                description="Turn the repulsion + spring system on for every adopted surface that does not explicitly opt out."
                control={
                  <input
                    type="checkbox"
                    checked={layoutDynamicsEnabled}
                    onChange={(event) =>
                      onUpdateAppearance({
                        layoutDynamicsEnabled: event.target.checked,
                      })
                    }
                  />
                }
                note={`Theme default: ${getLayoutDynamicsPreset(
                  resolveLayoutDynamicsPresetId({
                    themeDefaultPresetId,
                  }),
                ).label}. Shared effective preset: ${resolvedSharedPreset.label}.`}
              />

              {pinnedSharedPresetId ? (
                <div
                  className="rounded border px-3 py-3 text-[11px]"
                  style={{
                    borderColor: `${accent}44`,
                    background: `${accent}10`,
                    color: text,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div
                        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: accent }}
                      >
                        Shared Layout Dynamics Fallback
                      </div>
                      <div className="mt-1 leading-4 opacity-75">
                        The shared shell preset is pinned to{" "}
                        <strong>{resolvedSharedPreset.label}</strong>. Clear it to
                        follow the active theme recipe again.
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Clear shared layout dynamics fallback"
                      onClick={() =>
                        onUpdateAppearance({ layoutDynamicsPresetId: null })
                      }
                      className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                      style={{
                        border: `1px solid ${accent}66`,
                        background: `${accent}16`,
                        color: accent,
                      }}
                    >
                      Follow Theme
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {layoutDynamicsPresetCatalog.map((preset) => {
                  const active = resolvedSharedPresetId === preset.id;
                  return (
                    <SettingsCatalogCard
                      key={`layout-dynamics-preset-${preset.id}`}
                      title={preset.label}
                      subtitle={active ? "Shared Effective Preset" : "Shared Preset"}
                      description={preset.description}
                      badges={
                        <div className="flex flex-wrap gap-1">
                          <ThemeBadge
                            label={`${preset.auraRadiusPx}px aura`}
                            active={active}
                          />
                          <ThemeBadge
                            label={`${preset.gapPx}px gap`}
                            active={active}
                          />
                        </div>
                      }
                      metadata={
                        <div className="grid grid-cols-2 gap-2 text-[10px] opacity-55">
                          <span>
                            Spring {preset.springStiffness.toFixed(1)}
                          </span>
                          <span>Damp {preset.damping.toFixed(1)}</span>
                          <span>Collision {preset.collisionStrength}</span>
                          <span>Velocity {preset.maxVelocityPx}</span>
                        </div>
                      }
                      active={active}
                      accent={accent}
                      onClick={() =>
                        onUpdateAppearance({ layoutDynamicsPresetId: preset.id })
                      }
                    />
                  );
                })}
              </div>

              <RangeField
                label="Shared Intensity"
                description="Master multiplier for every adopted layout-dynamics surface before per-surface intensity modifiers."
                min={0.25}
                max={2}
                step={0.05}
                value={layoutDynamicsIntensity}
                valueLabel={formatLayoutDynamicsIntensity(layoutDynamicsIntensity)}
                onChange={(value) =>
                  onUpdateAppearance({
                    layoutDynamicsIntensity: clampLayoutDynamicsIntensity(value),
                  })
                }
              />
            </div>
          </SettingsSectionBlock>

          <SettingsSectionBlock
            title="Surface Overrides"
            subtitle="Explorer chrome and the top bar can each opt out, pin a different solver, or ride a different intensity multiplier."
            tone="muted"
          >
            <div className="grid grid-cols-1 gap-3">
              {layoutDynamicsSurfaceCatalog.map((surface) => {
                const surfaceState =
                  resolvedSurfaceStates.find(
                    (entry) => entry.surface.id === surface.id,
                  ) ?? layoutDynamics.resolveSurfaceSettings(surface.id);
                const rawOverride = layoutDynamicsSurfaceOverrides[surface.id];
                const overrideObject = isSurfaceOverrideObject(rawOverride)
                  ? rawOverride
                  : normalizeLayoutDynamicsSurfaceOverride(rawOverride);
                const explicitEnabled =
                  typeof rawOverride === "boolean"
                    ? rawOverride
                    : overrideObject?.enabled;
                const selectedPresetId = overrideObject?.presetId ?? null;
                const intensityMultiplier =
                  overrideObject?.intensityMultiplier ?? 1;

                return (
                  <div
                    key={`layout-dynamics-surface-${surface.id}`}
                    className="rounded border p-3"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                          {surface.label}
                        </div>
                        <div className="mt-1 text-[11px] leading-4 opacity-45">
                          {surface.axisMode === "horizontal-band"
                            ? "Band-constrained authoring."
                            : "Freeform 2D authoring."}{" "}
                          Effective preset: <strong>{surfaceState.preset.label}</strong>.
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <ThemeBadge
                          label={surfaceState.enabled ? "Live" : "Disabled"}
                          active={surfaceState.enabled}
                        />
                        <ThemeBadge
                          label={
                            explicitEnabled == null
                              ? "Following shared enablement"
                              : explicitEnabled
                                ? "Pinned enabled"
                                : "Pinned disabled"
                          }
                        />
                        <ThemeBadge
                          label={`${surfaceState.intensity.toFixed(2)}x effective`}
                        />
                      </div>
                    </div>

                    <div className="mt-3 space-y-3">
                      <SettingsRow
                        title={`Enable ${surface.label} layout dynamics`}
                        description="Let this surface participate in live authoring physics without changing the shared runtime for the rest of the shell."
                        control={
                          <input
                            type="checkbox"
                            checked={surfaceState.enabled}
                            onChange={(event) =>
                              setSurfaceEnabled(surface.id, event.target.checked)
                            }
                          />
                        }
                      />

                      <label className="block rounded border p-3" style={{ borderColor: border, background: "rgba(255,255,255,0.025)" }}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                              Surface Preset
                            </div>
                            <p className="mt-1 text-[11px] opacity-40">
                              Leave this on shared routing, or pin a different
                              solver just for {surface.label.toLowerCase()}.
                            </p>
                          </div>
                          <ThemeBadge
                            label={
                              selectedPresetId == null
                                ? "Following shared routing"
                                : `Pinned ${surfaceState.preset.label}`
                            }
                            active={selectedPresetId != null}
                          />
                        </div>
                        <select
                          aria-label={`${surface.label} layout dynamics preset`}
                          value={selectedPresetId ?? ""}
                          onChange={(event) =>
                            setSurfacePresetId(
                              surface.id,
                              event.target.value.length > 0
                                ? event.target.value
                                : null,
                            )
                          }
                          className="mt-3 w-full rounded border px-3 py-2 text-[11px] outline-none"
                          style={{
                            borderColor: border,
                            background: "rgba(15,23,42,0.36)",
                            color: text,
                          }}
                        >
                          <option value="">Follow shared / theme routing</option>
                          {layoutDynamicsPresetCatalog.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <RangeField
                        label={`${surface.label} Intensity`}
                        description="Local multiplier applied after the shared intensity so some surfaces can feel heavier or lighter."
                        min={0.25}
                        max={2}
                        step={0.05}
                        value={intensityMultiplier}
                        valueLabel={formatLayoutDynamicsIntensity(
                          intensityMultiplier,
                        )}
                        onChange={(value) => setSurfaceIntensity(surface.id, value)}
                      />

                      <SettingsActionStrip>
                        <button
                          type="button"
                          onClick={() => setSurfaceOverride(surface.id, null)}
                          className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                          style={{
                            border: `1px solid ${border}`,
                            background: "rgba(255,255,255,0.04)",
                            color: text,
                          }}
                        >
                          Reset Surface Override
                        </button>
                      </SettingsActionStrip>
                    </div>
                  </div>
                );
              })}
            </div>
          </SettingsSectionBlock>
        </div>

        <div className="space-y-4">
          <SettingsSectionBlock
            title="Authoring State"
            subtitle="Persisted anchors stay separate from the live repelled positions. Reset only the top-bar authoring snapshots from here."
            accent={accent}
            tone="muted"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <ThemeBadge
                  label={`${Object.keys(topBarLayoutSnapshotsById).length} saved top-bar snapshot${Object.keys(topBarLayoutSnapshotsById).length === 1 ? "" : "s"}`}
                  active={Object.keys(topBarLayoutSnapshotsById).length > 0}
                />
                <ThemeBadge label={resolvedSharedPreset.label} />
              </div>

              <div
                className="rounded border px-3 py-3 text-[11px] leading-4"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                  color: muted,
                }}
              >
                Explorer chrome adoption rides the same runtime, but top-bar
                snapshots are the only layout-dynamics authoring state currently
                persisted through Settings in this pass.
              </div>

              <SettingsActionStrip>
                <button
                  type="button"
                  aria-label="Reset top bar layout dynamics snapshots"
                  onClick={() =>
                    onUpdateAppearance({ topBarLayoutSnapshotsById: {} })
                  }
                  className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                  style={{
                    border: `1px solid ${accent}66`,
                    background: `${accent}16`,
                    color: accent,
                  }}
                >
                  <RotateCcw size={10} />
                  Reset Top Bar Snapshots
                </button>
              </SettingsActionStrip>
            </div>
          </SettingsSectionBlock>

          <SettingsSectionBlock
            title="Runtime Notes"
            subtitle="The live solver is generic and surface-driven, so future shell strips can adopt it without inventing another drag system."
            tone="muted"
          >
            <div className="space-y-3 text-[11px] leading-4 opacity-55">
              <div className="flex items-start gap-2">
                <Sparkles size={12} style={{ marginTop: 2, color: accent }} />
                <span>
                  Shared presets live in one catalog and every adopted surface
                  resolves through the same runtime controller.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <LayoutGrid size={12} style={{ marginTop: 2, color: accent }} />
                <span>
                  Persisted snapshots only store authored anchors, widths, and
                  band ids. Repelled positions never become durable layout truth.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <RotateCcw size={12} style={{ marginTop: 2, color: accent }} />
                <span>
                  Physics only runs during authoring sessions in v1, so normal
                  browsing never pays the extra RAF cost.
                </span>
              </div>
            </div>
          </SettingsSectionBlock>
        </div>
      </div>

      <LayoutDynamicsLab
        solver={resolvedSharedPreset}
        intensity={layoutDynamicsIntensity}
        accent={accent}
        border={border}
        text={text}
        muted={muted}
        reducedMotion={layoutDynamics.prefersReducedMotion}
      />
    </section>
  );
}
