import type { CSSProperties, ReactNode } from "react";

import { X } from "@/components/AppIcons";

import { AppModalSurface } from "../AppModal";
import { OverlayScrollArea } from "../OverlayScrollArea";

import type {
  ExplorerWorkflowFooterActionTone,
  ExplorerWorkflowSession,
  ExplorerWorkflowStatusTone,
} from "./explorerWorkflowContracts";

const modalSizeConfig: Record<
  ExplorerWorkflowSession["size"],
  { width: string; maxWidth: string }
> = {
  sm: { width: "min(720px, 94vw)", maxWidth: "94vw" },
  md: { width: "min(920px, 95vw)", maxWidth: "95vw" },
  lg: { width: "min(1100px, 96vw)", maxWidth: "96vw" },
  xl: { width: "min(1320px, 97vw)", maxWidth: "97vw" },
};

export function ExplorerWorkflowModal({
  session,
  onRequestClose,
  children,
}: {
  session: ExplorerWorkflowSession;
  onRequestClose: () => void;
  children: ReactNode;
}) {
  const sizeConfig = modalSizeConfig[session.size];
  return (
    <AppModalSurface
      onClose={onRequestClose}
      closeOnBackdrop
      closeOnEscape
      dismissDisabled={session.busy}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`explorer-workflow-title-${session.id}`}
        style={{
          ...panelStyle,
          width: sizeConfig.width,
          maxWidth: sizeConfig.maxWidth,
        }}
      >
        <div style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <div
              id={`explorer-workflow-title-${session.id}`}
              style={titleStyle}
            >
              {session.title}
            </div>
            {session.definition.description ? (
              <div style={descriptionStyle}>
                {session.definition.description}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            disabled={session.busy}
            aria-label="Close workflow"
            style={closeButtonStyle(session.busy)}
          >
            <X size={14} />
          </button>
        </div>
        {session.status ? (
          <div style={resolveStatusStyle(session.status.tone ?? "neutral")}>
            {session.status.label}
          </div>
        ) : null}
        <div style={bodyStyle}>
          <OverlayScrollArea style={{ maxHeight: "68vh" }}>
            <div style={{ display: "grid", gap: 14 }}>{children}</div>
          </OverlayScrollArea>
        </div>
        <div style={footerStyle}>
          {session.footerActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                void action.onSelect();
              }}
              disabled={action.disabled}
              style={resolveFooterButtonStyle(
                action.tone ?? "neutral",
                action.disabled === true,
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </AppModalSurface>
  );
}

const panelStyle: CSSProperties = {
  borderRadius: "var(--overlay-explorer-panel-radius)",
  border: "var(--overlay-explorer-modal-border)",
  background: "var(--overlay-explorer-modal-surface)",
  color: "var(--overlay-text-primary)",
  boxShadow: "var(--overlay-explorer-modal-shadow)",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  minWidth: 0,
  maxHeight: "86vh",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const titleStyle: CSSProperties = {
  color: "var(--overlay-text-primary)",
  fontWeight: 700,
  fontSize: 14,
};

const descriptionStyle: CSSProperties = {
  marginTop: 4,
  color: "var(--overlay-text-muted)",
  fontSize: 11,
  lineHeight: 1.45,
};

const bodyStyle: CSSProperties = {
  minHeight: 0,
  flex: 1,
};

const footerStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  flexWrap: "wrap",
};

function closeButtonStyle(disabled: boolean): CSSProperties {
  return {
    borderRadius: "var(--overlay-explorer-control-radius)",
    border: "1px solid var(--overlay-explorer-chip-border)",
    background: "var(--overlay-explorer-chip-bg)",
    color: disabled
      ? "var(--overlay-text-muted)"
      : "var(--overlay-text-primary)",
    padding: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    flexShrink: 0,
  };
}

function resolveStatusStyle(
  tone: ExplorerWorkflowStatusTone,
): CSSProperties {
  if (tone === "danger") {
    return {
      ...statusStyle,
      color: "var(--overlay-danger)",
      borderColor: "var(--overlay-explorer-danger-soft-border)",
      background: "var(--overlay-explorer-danger-soft-bg)",
    };
  }
  if (tone === "warning") {
    return {
      ...statusStyle,
      color: "color-mix(in srgb, var(--overlay-text-primary) 88%, #f59e0b 12%)",
      borderColor: "color-mix(in srgb, #f59e0b 28%, var(--overlay-border))",
      background: "color-mix(in srgb, #f59e0b 12%, transparent)",
    };
  }
  if (tone === "success") {
    return {
      ...statusStyle,
      color: "color-mix(in srgb, var(--overlay-text-primary) 88%, #22c55e 12%)",
      borderColor: "color-mix(in srgb, #22c55e 28%, var(--overlay-border))",
      background: "color-mix(in srgb, #22c55e 10%, transparent)",
    };
  }
  return statusStyle;
}

const statusStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid var(--overlay-border)",
  background: "var(--overlay-bg-panel)",
  color: "var(--overlay-text-muted)",
  fontSize: 11,
  padding: "8px 10px",
};

function resolveFooterButtonStyle(
  tone: ExplorerWorkflowFooterActionTone,
  disabled: boolean,
): CSSProperties {
  const baseStyle: CSSProperties = {
    borderRadius: "var(--overlay-explorer-control-radius)",
    padding: "6px 14px",
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    opacity: disabled ? 0.7 : 1,
  };

  if (tone === "accent") {
    return {
      ...baseStyle,
      background: disabled
        ? "rgba(255,255,255,0.08)"
        : "var(--overlay-explorer-chip-active-bg)",
      border: "1px solid var(--overlay-explorer-chip-active-border)",
      color: disabled
        ? "var(--overlay-text-muted)"
        : "var(--overlay-explorer-chip-active-text)",
    };
  }

  if (tone === "danger") {
    return {
      ...baseStyle,
      background: "var(--overlay-explorer-danger-soft-bg)",
      border: "1px solid var(--overlay-explorer-danger-soft-border)",
      color: "var(--overlay-danger)",
    };
  }

  return {
    ...baseStyle,
    background: "var(--overlay-explorer-chip-bg)",
    border: "1px solid var(--overlay-explorer-chip-border)",
    color: "var(--overlay-text-primary)",
  };
}
