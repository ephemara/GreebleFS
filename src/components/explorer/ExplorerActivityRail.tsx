import {
  Database,
  Eye,
  FolderTree,
  ListTodo,
  Palette,
  Puzzle,
  Search,
  Sparkles,
  TerminalSquare,
} from "@/components/AppIcons";
import type {
  ComponentType,
  CSSProperties,
  DragEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useCallback, useState } from "react";

import { useInteractionMotionController } from "../../animation/interactionMotion";
import type { ResolvedOverlayAppearance } from "../../config/appearance";
import {
  explorerActivityLaneDefinitions,
  isExplorerActivityLaneId,
  type ExplorerActivityLaneDefinition,
  type ExplorerActivityLaneId,
  type ExplorerActivityRailSide,
} from "../../config/explorerActivityRail";
import type { ExplorerPaneTone } from "./ExplorerPanePrimitives";
import type { ExplorerActivityRailContextMenuRequest } from "./overlayContextMenuModel";

const activityLaneIconComponents: Record<
  string,
  ComponentType<{ size?: number; style?: CSSProperties }>
> = {
  Database,
  Eye,
  FolderTree,
  ListTodo,
  Palette,
  Puzzle,
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
  onMoveLane,
  onContextMenuRequest,
  onSelectLane,
  railSide = "left",
  tone,
}: {
  activeLaneId?: ExplorerActivityLaneId;
  activeLaneIds?: ReadonlySet<ExplorerActivityLaneId>;
  appearance?: Pick<ResolvedOverlayAppearance, "baseTheme"> | null;
  laneDefinitions?: readonly ExplorerActivityLaneDefinition[];
  laneBadges?: Partial<Record<ExplorerActivityLaneId, number | string | null>>;
  onMoveLane?: (
    laneId: ExplorerActivityLaneId,
    targetSide: ExplorerActivityRailSide,
    targetIndex: number,
  ) => void;
  onContextMenuRequest?: (
    request: ExplorerActivityRailContextMenuRequest,
  ) => void;
  onSelectLane: (laneId: ExplorerActivityLaneId) => void;
  railSide?: ExplorerActivityRailSide;
  tone: ExplorerPaneTone;
}) {
  const interactionMotion = useInteractionMotionController(appearance);
  const [draggedLaneId, setDraggedLaneId] = useState<ExplorerActivityLaneId | null>(
    null,
  );
  const [dragOverTargetIndex, setDragOverTargetIndex] = useState<number | null>(
    null,
  );
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
  const resolveDraggedLaneId = useCallback(
    (event: DragEvent<HTMLElement>): ExplorerActivityLaneId | null => {
      const explicitDraggedLaneId = draggedLaneId;
      if (explicitDraggedLaneId) {
        return explicitDraggedLaneId;
      }
      const transferredLaneId = event.dataTransfer.getData(
        "application/x-greeblefs-explorer-activity-lane",
      );
      return isExplorerActivityLaneId(transferredLaneId)
        ? transferredLaneId
        : null;
    },
    [draggedLaneId],
  );
  const resolveMoveTargetIndex = useCallback(
    (laneId: ExplorerActivityLaneId, rawTargetIndex: number): number => {
      const sourceIndex = laneDefinitions.findIndex((lane) => lane.id === laneId);
      if (sourceIndex >= 0 && sourceIndex < rawTargetIndex) {
        return rawTargetIndex - 1;
      }
      return rawTargetIndex;
    },
    [laneDefinitions],
  );
  const handleLaneDragStart = useCallback(
    (laneId: ExplorerActivityLaneId) => (event: DragEvent<HTMLButtonElement>) => {
      if (!onMoveLane) {
        return;
      }
      setDraggedLaneId(laneId);
      setDragOverTargetIndex(null);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        "application/x-greeblefs-explorer-activity-lane",
        laneId,
      );
    },
    [onMoveLane],
  );
  const handleLaneDragEnd = useCallback(() => {
    setDraggedLaneId(null);
    setDragOverTargetIndex(null);
  }, []);
  const handleRailDragOver = useCallback(
    (targetIndex: number) => (event: DragEvent<HTMLElement>) => {
      if (!onMoveLane || !resolveDraggedLaneId(event)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverTargetIndex(targetIndex);
    },
    [onMoveLane, resolveDraggedLaneId],
  );
  const handleRailDragLeave = useCallback(
    (targetIndex: number) => () => {
      setDragOverTargetIndex((current) =>
        current === targetIndex ? null : current,
      );
    },
    [],
  );
  const handleRailDrop = useCallback(
    (rawTargetIndex: number) => (event: DragEvent<HTMLElement>) => {
      if (!onMoveLane) {
        return;
      }
      const laneId = resolveDraggedLaneId(event);
      if (!laneId) {
        return;
      }
      event.preventDefault();
      onMoveLane(
        laneId,
        railSide,
        resolveMoveTargetIndex(laneId, rawTargetIndex),
      );
      setDraggedLaneId(null);
      setDragOverTargetIndex(null);
    },
    [onMoveLane, railSide, resolveDraggedLaneId, resolveMoveTargetIndex],
  );
  const emitContextMenuRequest = useCallback(
    (
      event: ReactMouseEvent<HTMLElement>,
      laneId: ExplorerActivityLaneId | null,
      laneDefinition: ExplorerActivityLaneDefinition | null,
    ) => {
      if (!onContextMenuRequest) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onContextMenuRequest({
        event,
        railSide,
        laneId,
        laneDefinition,
      });
    },
    [onContextMenuRequest, railSide],
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
      onContextMenu={(event) => {
        emitContextMenuRequest(event, null, null);
      }}
      onDragOver={handleRailDragOver(laneDefinitions.length)}
      onDragLeave={handleRailDragLeave(laneDefinitions.length)}
      onDrop={handleRailDrop(laneDefinitions.length)}
    >
      {laneDefinitions.map((lane, index) => {
        const Icon = activityLaneIconComponents[lane.iconName] ?? Puzzle;
        const badge = laneBadges[lane.id];
        const active = isLaneActive(lane.id);
        const motionBinding = bindActivityRailMotion(active, index);
        const indicatorSide = railSide === "right" ? "right" : "left";
        const badgeSide = railSide === "right" ? "left" : "right";
        const showDropIndicator = dragOverTargetIndex === index;
        const isDraggedLane = lane.id === draggedLaneId;

        return (
          <div
            key={lane.id}
            onDragOver={handleRailDragOver(index)}
            onDragLeave={handleRailDragLeave(index)}
            onDrop={handleRailDrop(index)}
            style={{
              position: "relative",
              width: "100%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            {showDropIndicator ? (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 6,
                  right: 6,
                  top: -4,
                  height: 2,
                  borderRadius: 999,
                  background: tone.accent,
                  boxShadow: `0 0 12px ${tone.accent}`,
                }}
              />
            ) : null}
            <button
              type="button"
              aria-label={lane.label}
              aria-pressed={active}
              data-overlay-explorer-activity-lane={lane.id}
              data-overlay-explorer-activity-lane-dragging={
                isDraggedLane ? "true" : "false"
              }
              data-overlay-explorer-activity-lane-active={
                active ? "true" : "false"
              }
              title={lane.label}
              onClick={() => onSelectLane(lane.id)}
              onContextMenu={(event) => {
                emitContextMenuRequest(event, lane.id, lane);
              }}
              draggable={Boolean(onMoveLane)}
              onDragStart={handleLaneDragStart(lane.id)}
              onDragEnd={handleLaneDragEnd}
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
                opacity: isDraggedLane ? 0.48 : 1,
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
              {lane.iconUrl ? (
                <img
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  src={lane.iconUrl}
                  style={{
                    width: 16,
                    height: 16,
                    objectFit: "contain",
                    filter: active
                      ? "drop-shadow(0 1px 6px rgba(255,255,255,0.12))"
                      : "none",
                    opacity: active ? 1 : 0.78,
                  }}
                />
              ) : (
                <Icon
                  size={16}
                  style={{
                    color: active ? tone.text : tone.muted,
                    filter: active
                      ? "drop-shadow(0 1px 6px rgba(255,255,255,0.12))"
                      : "none",
                  }}
                />
              )}
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
      {dragOverTargetIndex === laneDefinitions.length ? (
        <span
          aria-hidden="true"
          style={{
            width: 26,
            height: 2,
            borderRadius: 999,
            background: tone.accent,
            boxShadow: `0 0 12px ${tone.accent}`,
            marginTop: 2,
          }}
        />
      ) : null}
    </nav>
  );
}
