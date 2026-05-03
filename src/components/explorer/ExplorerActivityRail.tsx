import {
  Database,
  Eye,
  FolderTree,
  ListTodo,
  Palette,
  Search,
  Sparkles,
  TerminalSquare,
} from "@/components/AppIcons";
import type { ComponentType, CSSProperties } from "react";
import { useCallback } from "react";

import { useInteractionMotionController } from "../../animation/interactionMotion";
import type { ResolvedOverlayAppearance } from "../../config/appearance";
import {
  explorerActivityLaneDefinitions,
  type ExplorerActivityLaneDefinition,
  type ExplorerActivityLaneId,
  type ExplorerActivityRailSide,
} from "../../config/explorerActivityRail";
import type { ExplorerPaneTone } from "./ExplorerPanePrimitives";

const activityLaneIconComponents: Record<
  ExplorerActivityLaneDefinition["iconName"],
  ComponentType<{ size?: number; style?: CSSProperties }>
> = {
  Database,
  Eye,
  FolderTree,
  ListTodo,
  Palette,
  Search,
  Sparkles,
  TerminalSquare,
};

const activityRailButtonTransition =
  "background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, color 150ms ease, opacity 150ms ease";

export function ExplorerActivityRail({
  activeLaneId,
  activeLaneIds,
  appearance,
  laneDefinitions = explorerActivityLaneDefinitions,
  laneBadges = {},
  onSelectLane,
  railSide = "left",
  tone,
}: {
  activeLaneId?: ExplorerActivityLaneId;
  activeLaneIds?: ReadonlySet<ExplorerActivityLaneId>;
  appearance?: Pick<ResolvedOverlayAppearance, "baseTheme"> | null;
  laneDefinitions?: readonly ExplorerActivityLaneDefinition[];
  laneBadges?: Partial<Record<ExplorerActivityLaneId, number | string | null>>;
  onSelectLane: (laneId: ExplorerActivityLaneId) => void;
  railSide?: ExplorerActivityRailSide;
  tone: ExplorerPaneTone;
}) {
  const interactionMotion = useInteractionMotionController(appearance);
  const bindActivityRailMotion = useCallback(
    (active: boolean, motionStepIndex: number) =>
      interactionMotion.bindSurface({
        surfaceId: "explorerRailItem",
        triggerState: active ? { activate: true } : undefined,
        motionStepIndex,
        baseTransition: activityRailButtonTransition,
      }),
    [interactionMotion],
  );
  const isLaneActive = useCallback(
    (laneId: ExplorerActivityLaneId) =>
      activeLaneIds?.has(laneId) ?? laneId === activeLaneId,
    [activeLaneId, activeLaneIds],
  );

  return (
    <nav
      aria-label={
        railSide === "right"
          ? "Explorer right activity rail"
          : "Explorer left activity rail"
      }
      data-overlay-explorer-activity-rail="true"
      data-overlay-explorer-activity-rail-side={railSide}
      style={{
        width: 44,
        minWidth: 44,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
        padding: "9px 6px",
        borderRight:
          railSide === "left"
            ? `1px solid ${tone.border ?? "var(--overlay-explorer-panel-border)"}`
            : undefined,
        borderLeft:
          railSide === "right"
            ? `1px solid ${tone.border ?? "var(--overlay-explorer-panel-border)"}`
            : undefined,
        background:
          "color-mix(in srgb, var(--overlay-explorer-panel-bg) 92%, transparent)",
        boxShadow:
          railSide === "right"
            ? "inset 1px 0 0 rgba(255,255,255,0.025)"
            : "inset -1px 0 0 rgba(255,255,255,0.025)",
        boxSizing: "border-box",
      }}
    >
      {laneDefinitions.map((lane, index) => {
        const Icon = activityLaneIconComponents[lane.iconName];
        const badge = laneBadges[lane.id];
        const active = isLaneActive(lane.id);
        const motionBinding = bindActivityRailMotion(active, index);
        const indicatorSide = railSide === "right" ? "right" : "left";
        const badgeSide = railSide === "right" ? "left" : "right";
        const isBottomLane = lane.utilityPane === "bottom";

        return (
          <div
            key={lane.id}
            style={{
              position: "relative",
              marginTop: isBottomLane ? "auto" : undefined,
            }}
          >
            <button
              type="button"
              aria-label={lane.label}
              aria-pressed={active}
              data-overlay-explorer-activity-lane={lane.id}
              data-overlay-explorer-activity-lane-active={
                active ? "true" : "false"
              }
              title={lane.label}
              onClick={() => onSelectLane(lane.id)}
              {...motionBinding.motionDataAttributes}
              onPointerEnter={motionBinding.onPointerEnter}
              onPointerLeave={motionBinding.onPointerLeave}
              onPointerDown={motionBinding.onPointerDown}
              onPointerUp={motionBinding.onPointerUp}
              onPointerCancel={motionBinding.onPointerCancel}
              style={{
                width: 32,
                height: 32,
                border: `1px solid ${active ? tone.accent : tone.border ?? "var(--overlay-explorer-panel-border)"}`,
                borderRadius: "var(--overlay-explorer-control-radius)",
                background: active
                  ? `color-mix(in srgb, ${tone.accent} 22%, transparent)`
                  : "color-mix(in srgb, var(--overlay-explorer-panel-bg) 68%, transparent)",
                color: active ? tone.text : tone.muted,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
                position: "relative",
                boxShadow: active
                  ? `0 0 0 1px color-mix(in srgb, ${tone.accent} 18%, transparent), 0 12px 28px color-mix(in srgb, ${tone.accent} 20%, transparent)`
                  : "0 1px 0 rgba(255,255,255,0.035)",
                outline: "none",
                ...motionBinding.motionStyle,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  [indicatorSide]: -6,
                  top: 7,
                  bottom: 7,
                  width: 2,
                  borderRadius: 999,
                  background: tone.accent,
                  opacity: active ? 1 : 0,
                  boxShadow: active ? `0 0 12px ${tone.accent}` : "none",
                  transition:
                    "opacity 150ms ease, box-shadow 150ms ease, transform 150ms ease",
                  transform: active ? "scaleY(1)" : "scaleY(0.35)",
                }}
              />
              <Icon
                size={16}
                style={{
                  color: active ? tone.text : tone.muted,
                  filter: active
                    ? "drop-shadow(0 1px 6px rgba(255,255,255,0.12))"
                    : "none",
                }}
              />
            </button>
            {badge != null && badge !== "" ? (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  [badgeSide]: -3,
                  top: -3,
                  minWidth: 14,
                  height: 14,
                  padding: "0 3px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid ${tone.border ?? "var(--overlay-explorer-panel-border)"}`,
                  background: tone.accent,
                  color: "var(--overlay-accent-contrast)",
                  fontSize: 8,
                  fontWeight: 800,
                  lineHeight: "14px",
                }}
              >
                {badge}
              </span>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
