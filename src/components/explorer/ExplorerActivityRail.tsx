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
import {
  explorerActivityLaneDefinitions,
  type ExplorerActivityLaneDefinition,
  type ExplorerActivityLaneId,
} from "../../config/explorerActivityRail";
import { ExplorerSlateIconButton, type ExplorerPaneTone } from "./ExplorerPanePrimitives";

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

export function ExplorerActivityRail({
  activeLaneId,
  laneDefinitions = explorerActivityLaneDefinitions,
  laneBadges = {},
  onSelectLane,
  tone,
}: {
  activeLaneId: ExplorerActivityLaneId;
  laneDefinitions?: readonly ExplorerActivityLaneDefinition[];
  laneBadges?: Partial<Record<ExplorerActivityLaneId, number | string | null>>;
  onSelectLane: (laneId: ExplorerActivityLaneId) => void;
  tone: ExplorerPaneTone;
}) {
  return (
    <nav
      aria-label="Explorer activity rail"
      data-overlay-explorer-activity-rail="true"
      style={{
        width: 42,
        minWidth: 42,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: "8px 6px",
        borderRight: `1px solid ${tone.border ?? "var(--overlay-explorer-panel-border)"}`,
        background: "var(--overlay-explorer-panel-bg)",
      }}
    >
      {laneDefinitions.map((lane) => {
        const Icon = activityLaneIconComponents[lane.iconName];
        const badge = laneBadges[lane.id];
        const active = lane.id === activeLaneId;
        return (
          <div key={lane.id} style={{ position: "relative" }}>
            <ExplorerSlateIconButton
              active={active}
              label={lane.label}
              onClick={() => onSelectLane(lane.id)}
              tone={tone}
            >
              <Icon size={15} />
            </ExplorerSlateIconButton>
            {badge != null && badge !== "" ? (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  right: -3,
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
