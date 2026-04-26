import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { LayoutGrid, RotateCcw, Sparkles } from "@/components/AppIcons";
import type {
  LayoutDynamicsAuthoringSnapshot,
  LayoutDynamicsSolverProfile,
} from "../config/layoutDynamics";
import {
  LayoutDynamicsCanvas,
  type LayoutDynamicsCanvasBand,
  type LayoutDynamicsCanvasItem,
} from "../components/layoutDynamics/LayoutDynamicsCanvas";

interface LayoutDynamicsLabProps {
  solver: LayoutDynamicsSolverProfile;
  intensity: number;
  accent: string;
  border: string;
  text: string;
  muted: string;
  reducedMotion?: boolean;
}

interface LayoutDynamicsLabSceneProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}

interface LayoutDynamicsLabItemDefinition {
  id: string;
  label: string;
  order: number;
  widthPx: number;
}

const BAND_SAMPLE_DEFAULT_SNAPSHOT: LayoutDynamicsAuthoringSnapshot = {
  entries: [
    { nodeId: "search", bandId: "top", x: 24, y: 0, widthPx: 124 },
    { nodeId: "mode", bandId: "top", x: 176, y: 0, widthPx: 110 },
    { nodeId: "preview", bandId: "top", x: 314, y: 0, widthPx: 104 },
    { nodeId: "actions", bandId: "top", x: 446, y: 0, widthPx: 118 },
  ],
};

const FREEFORM_SAMPLE_DEFAULT_SNAPSHOT: LayoutDynamicsAuthoringSnapshot = {
  entries: [
    { nodeId: "search", bandId: "canvas", x: 28, y: 18, widthPx: 120 },
    { nodeId: "inspect", bandId: "canvas", x: 208, y: 44, widthPx: 128 },
    { nodeId: "paint", bandId: "canvas", x: 116, y: 116, widthPx: 112 },
    { nodeId: "render", bandId: "canvas", x: 324, y: 118, widthPx: 124 },
  ],
};

const BAND_SAMPLE_ITEMS: readonly LayoutDynamicsLabItemDefinition[] = [
  { id: "search", label: "Search", order: 10, widthPx: 124 },
  { id: "mode", label: "Balanced", order: 20, widthPx: 110 },
  { id: "preview", label: "Preview", order: 30, widthPx: 104 },
  { id: "actions", label: "Actions", order: 40, widthPx: 118 },
];

const FREEFORM_SAMPLE_ITEMS: readonly LayoutDynamicsLabItemDefinition[] = [
  { id: "search", label: "Search", order: 10, widthPx: 120 },
  { id: "inspect", label: "Inspect", order: 20, widthPx: 128 },
  { id: "paint", label: "Paint", order: 30, widthPx: 112 },
  { id: "render", label: "Render", order: 40, widthPx: 124 },
];

const BAND_SAMPLE_BANDS: readonly LayoutDynamicsCanvasBand[] = [
  {
    id: "top",
    minHeightPx: 58,
    style: {
      borderRadius: 18,
      border: "1px solid color-mix(in srgb, var(--overlay-border) 70%, transparent)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
      padding: "10px 12px",
    },
  },
];

const FREEFORM_SAMPLE_BANDS: readonly LayoutDynamicsCanvasBand[] = [
  {
    id: "canvas",
    minHeightPx: 188,
    style: {
      borderRadius: 22,
      border: "1px solid color-mix(in srgb, var(--overlay-border) 70%, transparent)",
      background:
        "radial-gradient(circle at top left, rgba(255,255,255,0.08), rgba(255,255,255,0.025) 56%, rgba(255,255,255,0.015))",
      padding: "14px",
    },
  },
];

function LayoutDynamicsLabScene({
  title,
  subtitle,
  actions,
  children,
}: LayoutDynamicsLabSceneProps) {
  return (
    <section
      className="rounded border p-3"
      style={{
        borderColor: "var(--overlay-workbench-settings-card-border)",
        background: "rgba(255,255,255,0.025)",
      }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
            {title}
          </div>
          <div className="mt-1 text-[11px] opacity-45">{subtitle}</div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function buildLabItems(args: {
  snapshot: LayoutDynamicsAuthoringSnapshot;
  definitions: readonly LayoutDynamicsLabItemDefinition[];
  defaultBandId: string;
  accent: string;
  text: string;
  muted: string;
}): LayoutDynamicsCanvasItem[] {
  const snapshotByNodeId = new Map(
    args.snapshot.entries.map((entry) => [entry.nodeId, entry] as const),
  );

  return args.definitions.map((definition, index) => {
    const snapshotEntry = snapshotByNodeId.get(definition.id);
    const nodeStyle: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      minHeight: 30,
      padding: "6px 12px",
      borderRadius: 999,
      border: "1px solid color-mix(in srgb, var(--overlay-border) 72%, transparent)",
      background:
        index === 0
          ? `${args.accent}18`
          : "color-mix(in srgb, rgba(255,255,255,0.08) 70%, transparent)",
      color: args.text,
      boxShadow:
        index === 0
          ? `0 0 0 1px ${args.accent}22, 0 10px 20px rgba(0,0,0,0.18)`
          : "0 8px 18px rgba(0,0,0,0.14)",
      whiteSpace: "nowrap",
    };

    return {
      id: definition.id,
      label: definition.label,
      bandId: snapshotEntry?.bandId ?? args.defaultBandId,
      order: definition.order,
      anchorX: snapshotEntry?.x ?? 0,
      anchorY: snapshotEntry?.y ?? 0,
      widthPx: snapshotEntry?.widthPx ?? definition.widthPx,
      content: (
        <div style={nodeStyle}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: index === 0 ? args.accent : args.muted,
              opacity: 0.9,
            }}
          />
          <span className="text-[11px] font-semibold">{definition.label}</span>
        </div>
      ),
    };
  });
}

export function LayoutDynamicsLab({
  solver,
  intensity,
  accent,
  border,
  text,
  muted,
  reducedMotion = false,
}: LayoutDynamicsLabProps) {
  const [bandSnapshot, setBandSnapshot] = useState<LayoutDynamicsAuthoringSnapshot>(
    BAND_SAMPLE_DEFAULT_SNAPSHOT,
  );
  const [freeformSnapshot, setFreeformSnapshot] =
    useState<LayoutDynamicsAuthoringSnapshot>(FREEFORM_SAMPLE_DEFAULT_SNAPSHOT);

  const bandItems = useMemo(
    () =>
      buildLabItems({
        snapshot: bandSnapshot,
        definitions: BAND_SAMPLE_ITEMS,
        defaultBandId: "top",
        accent,
        text,
        muted,
      }),
    [accent, bandSnapshot, muted, text],
  );
  const freeformItems = useMemo(
    () =>
      buildLabItems({
        snapshot: freeformSnapshot,
        definitions: FREEFORM_SAMPLE_ITEMS,
        defaultBandId: "canvas",
        accent,
        text,
        muted,
      }),
    [accent, freeformSnapshot, muted, text],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-60">
            <Sparkles size={12} />
            <span>Layout Dynamics Lab</span>
          </div>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 opacity-45">
            This is the same shared layout-dynamics canvas used by live shell
            surfaces. Drag the samples around to pressure-test aura repulsion,
            collision recovery, and anchor return before committing a preset.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span
            className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.04)",
              color: text,
            }}
          >
            {solver.label}
          </span>
          <span
            className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.04)",
              color: muted,
            }}
          >
            {intensity.toFixed(2)}x intensity
          </span>
          {reducedMotion ? (
            <span
              className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: `${accent}55`,
                background: `${accent}14`,
                color: accent,
              }}
            >
              Reduced Motion Softened
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <LayoutDynamicsLabScene
          title="Band Pressure"
          subtitle="Horizontal-band authoring for top bars and explorer chrome strips."
          actions={
            <button
              type="button"
              onClick={() => setBandSnapshot(BAND_SAMPLE_DEFAULT_SNAPSHOT)}
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                border: `1px solid ${border}`,
                background: "rgba(255,255,255,0.04)",
                color: text,
              }}
            >
              <RotateCcw size={10} />
              Reset
            </button>
          }
        >
          <LayoutDynamicsCanvas
            surfaceId="settings-layout-dynamics-band"
            axisMode="horizontal-band"
            solver={solver}
            intensity={intensity}
            authoringActive
            bands={[...BAND_SAMPLE_BANDS]}
            items={bandItems}
            style={{ minHeight: 64 }}
            onCommitSnapshot={setBandSnapshot}
          />
        </LayoutDynamicsLabScene>

        <LayoutDynamicsLabScene
          title="Freeform Drift"
          subtitle="Surface-bound free-2D authoring for widget-style clusters."
          actions={
            <button
              type="button"
              onClick={() => setFreeformSnapshot(FREEFORM_SAMPLE_DEFAULT_SNAPSHOT)}
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                border: `1px solid ${border}`,
                background: "rgba(255,255,255,0.04)",
                color: text,
              }}
            >
              <RotateCcw size={10} />
              Reset
            </button>
          }
        >
          <LayoutDynamicsCanvas
            surfaceId="settings-layout-dynamics-free-2d"
            axisMode="free-2d"
            solver={solver}
            intensity={intensity}
            authoringActive
            bands={[...FREEFORM_SAMPLE_BANDS]}
            items={freeformItems}
            style={{ minHeight: 196 }}
            onCommitSnapshot={setFreeformSnapshot}
          />
        </LayoutDynamicsLabScene>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div
          className="rounded border px-3 py-3"
          style={{
            borderColor: border,
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
            <LayoutGrid size={12} />
            <span>Aura</span>
          </div>
          <p className="mt-2 text-[11px] leading-4 opacity-45">
            Pressure begins before contact so authored chrome parts like fluid
            matter instead of hard slot boxes.
          </p>
        </div>
        <div
          className="rounded border px-3 py-3"
          style={{
            borderColor: border,
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
            <Sparkles size={12} />
            <span>Collision</span>
          </div>
          <p className="mt-2 text-[11px] leading-4 opacity-45">
            Overlap resolves radially, so the local push still feels premium
            when a dragged control plows through a tight cluster.
          </p>
        </div>
        <div
          className="rounded border px-3 py-3"
          style={{
            borderColor: border,
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
            <RotateCcw size={12} />
            <span>Return</span>
          </div>
          <p className="mt-2 text-[11px] leading-4 opacity-45">
            Every resting node is tethered back to its authored anchor, so the
            live pressure never becomes the persisted layout truth.
          </p>
        </div>
      </div>
    </section>
  );
}
