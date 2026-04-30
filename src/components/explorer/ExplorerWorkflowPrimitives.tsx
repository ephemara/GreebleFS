import type { CSSProperties, ReactNode } from "react";

import { OverlayScrollArea } from "../OverlayScrollArea";

import type {
  ExplorerWorkflowFooterActionTone,
  ExplorerWorkflowStatusTone,
} from "./explorerWorkflowContracts";

type ExplorerWorkflowButtonTone =
  | ExplorerWorkflowFooterActionTone
  | "ghost";

export function ExplorerWorkflowSection({
  title,
  description,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      {title ? (
        <header style={sectionHeaderStyle}>
          <div style={sectionTitleStyle}>{title}</div>
          {description ? (
            <div style={sectionDescriptionStyle}>{description}</div>
          ) : null}
        </header>
      ) : null}
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </section>
  );
}

export function ExplorerWorkflowFieldGrid({
  columns = 2,
  children,
}: {
  columns?: 1 | 2 | 3;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

export function ExplorerWorkflowInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />;
}

export function ExplorerWorkflowMetaStrip({
  children,
}: {
  children: ReactNode;
}) {
  return <div style={metaStripStyle}>{children}</div>;
}

export function ExplorerWorkflowStatusNotice({
  tone = "neutral",
  children,
}: {
  tone?: ExplorerWorkflowStatusTone;
  children: ReactNode;
}) {
  return (
    <div style={resolveNoticeStyle(tone)}>
      {children}
    </div>
  );
}

export function ExplorerWorkflowResultList({
  maxHeight = "50vh",
  children,
}: {
  maxHeight?: number | string;
  children: ReactNode;
}) {
  const resolvedMaxHeight =
    typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;
  return (
    <div style={resultListFrameStyle}>
      <OverlayScrollArea style={{ maxHeight: resolvedMaxHeight }}>
        <div style={resultListBodyStyle}>{children}</div>
      </OverlayScrollArea>
    </div>
  );
}

export function ExplorerWorkflowResultCard({
  children,
}: {
  children: ReactNode;
}) {
  return <div style={resultCardStyle}>{children}</div>;
}

export function ExplorerWorkflowResultCardHeader({
  children,
}: {
  children: ReactNode;
}) {
  return <div style={resultCardHeaderStyle}>{children}</div>;
}

export function ExplorerWorkflowResultRow({
  children,
}: {
  children: ReactNode;
}) {
  return <div style={resultRowStyle}>{children}</div>;
}

export function ExplorerWorkflowRowActions({
  children,
}: {
  children: ReactNode;
}) {
  return <div style={rowActionsStyle}>{children}</div>;
}

export function ExplorerWorkflowEmptyState({
  children,
}: {
  children: ReactNode;
}) {
  return <div style={emptyStateStyle}>{children}</div>;
}

export function ExplorerWorkflowButton({
  tone = "neutral",
  disabled = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ExplorerWorkflowButtonTone;
}) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...resolveButtonStyle(tone, disabled),
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  border: "1px solid var(--overlay-border)",
  borderRadius: 14,
  padding: 14,
  background: "var(--overlay-bg-panel)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const sectionTitleStyle: CSSProperties = {
  color: "var(--overlay-text-primary)",
  fontSize: 12,
  fontWeight: 700,
};

const sectionDescriptionStyle: CSSProperties = {
  color: "var(--overlay-text-muted)",
  fontSize: 11,
  lineHeight: 1.5,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--overlay-explorer-input-bg)",
  border: "1px solid var(--overlay-explorer-input-border)",
  borderRadius: "var(--overlay-explorer-control-radius)",
  color: "var(--overlay-text-primary)",
  fontSize: 12,
  padding: "8px 10px",
  outline: "none",
};

const metaStripStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
  color: "var(--overlay-text-muted)",
  fontSize: 11,
};

function resolveNoticeStyle(tone: ExplorerWorkflowStatusTone): CSSProperties {
  if (tone === "danger") {
    return {
      ...noticeStyle,
      color: "var(--overlay-danger)",
      borderColor: "var(--overlay-explorer-danger-soft-border)",
      background: "var(--overlay-explorer-danger-soft-bg)",
    };
  }
  if (tone === "warning") {
    return {
      ...noticeStyle,
      color: "color-mix(in srgb, var(--overlay-text-primary) 88%, #f59e0b 12%)",
      borderColor: "color-mix(in srgb, #f59e0b 28%, var(--overlay-border))",
      background: "color-mix(in srgb, #f59e0b 12%, transparent)",
    };
  }
  if (tone === "success") {
    return {
      ...noticeStyle,
      color: "color-mix(in srgb, var(--overlay-text-primary) 88%, #22c55e 12%)",
      borderColor: "color-mix(in srgb, #22c55e 28%, var(--overlay-border))",
      background: "color-mix(in srgb, #22c55e 10%, transparent)",
    };
  }
  return noticeStyle;
}

const noticeStyle: CSSProperties = {
  border: "1px solid var(--overlay-border)",
  borderRadius: 12,
  padding: "10px 12px",
  background: "var(--overlay-bg-panel)",
  color: "var(--overlay-text-muted)",
  fontSize: 11,
  lineHeight: 1.5,
};

const resultListFrameStyle: CSSProperties = {
  border: "1px solid var(--overlay-border)",
  borderRadius: 14,
  overflow: "hidden",
  minHeight: 0,
};

const resultListBodyStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 12,
};

const resultCardStyle: CSSProperties = {
  border: "1px solid var(--overlay-border)",
  borderRadius: 12,
  overflow: "hidden",
  background: "var(--overlay-bg-panel)",
};

const resultCardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  borderBottom: "1px solid var(--overlay-border)",
};

const resultRowStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "10px 12px",
  borderTop: "1px solid var(--overlay-border)",
};

const rowActionsStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const emptyStateStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  minHeight: 160,
  padding: 18,
  color: "var(--overlay-text-muted)",
  fontSize: 12,
  textAlign: "center",
};

function resolveButtonStyle(
  tone: ExplorerWorkflowButtonTone,
  disabled: boolean,
): CSSProperties {
  const baseStyle: CSSProperties = {
    borderRadius: "var(--overlay-explorer-control-radius)",
    padding: "6px 12px",
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
    background:
      tone === "ghost"
        ? "transparent"
        : "var(--overlay-explorer-chip-bg)",
    border: "1px solid var(--overlay-explorer-chip-border)",
    color: "var(--overlay-text-primary)",
  };
}
