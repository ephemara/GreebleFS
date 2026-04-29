import type { CSSProperties } from "react";

import { useInteractionMotionController } from "../../animation/interactionMotion";
import type { ExplorerPreviewWorkflowTab } from "./explorerPreviewWorkflowTabs";

export interface ExplorerPreviewWorkflowTabControlProps {
  tabs: readonly ExplorerPreviewWorkflowTab[];
  activeTabId: string;
  onTabSelect: (tab: ExplorerPreviewWorkflowTab) => void;
  ariaLabel?: string;
  style?: CSSProperties;
}

export function ExplorerPreviewWorkflowTabControl({
  tabs,
  activeTabId,
  onTabSelect,
  ariaLabel = "Preview workflow tabs",
  style,
}: ExplorerPreviewWorkflowTabControlProps) {
  const interactionMotion = useInteractionMotionController();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: 2,
        borderRadius: "var(--overlay-explorer-control-radius)",
        border: "1px solid var(--overlay-explorer-chip-border)",
        background: "var(--overlay-explorer-chip-bg)",
        flexWrap: "wrap",
        ...style,
      }}
    >
      {tabs.map((tab, index) => {
        const active = activeTabId === tab.id;
        const workflowTabMotion = interactionMotion.bindSurface({
          surfaceId: "previewWorkflowTab",
          triggerState: { activate: active },
          motionStepIndex: index,
          baseTransition:
            "background 0.14s ease, border-color 0.14s ease, color 0.14s ease",
        });

        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active}
            data-preview-workflow-tab={tab.id}
            onClick={() => onTabSelect(tab)}
            {...workflowTabMotion.motionDataAttributes}
            onPointerEnter={workflowTabMotion.onPointerEnter}
            onPointerLeave={workflowTabMotion.onPointerLeave}
            onPointerDown={workflowTabMotion.onPointerDown}
            onPointerUp={workflowTabMotion.onPointerUp}
            onPointerCancel={workflowTabMotion.onPointerCancel}
            style={{
              ...previewWorkflowTabButtonStyle(active),
              ...workflowTabMotion.motionStyle,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function previewWorkflowTabButtonStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    borderRadius: "var(--overlay-explorer-control-radius)",
    border: "1px solid var(--overlay-explorer-chip-border)",
    background: active
      ? "var(--overlay-explorer-chip-active-bg)"
      : "transparent",
    color: active
      ? "var(--overlay-explorer-chip-active-text)"
      : "var(--overlay-explorer-muted, var(--overlay-text-muted))",
    padding: "4px 8px",
    fontSize: 10,
    fontWeight: 750,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: 0,
    lineHeight: 1,
  };
}
