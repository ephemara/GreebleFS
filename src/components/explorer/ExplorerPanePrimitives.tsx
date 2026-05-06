import type { CSSProperties, ReactNode } from "react";

export interface ExplorerPaneTone {
  accent: string;
  border?: string;
  muted?: string;
  text?: string;
}

export function ExplorerBoundedText({
  children,
  lines = 1,
  style,
}: {
  children: ReactNode;
  lines?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "-webkit-box",
        minWidth: 0,
        overflow: "hidden",
        overflowWrap: "anywhere",
        textOverflow: "ellipsis",
        whiteSpace: "normal",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: lines,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function ExplorerSlatePane({
  children,
  tone,
  style,
}: {
  children: ReactNode;
  tone: ExplorerPaneTone;
  style?: CSSProperties;
}) {
  return (
    <section
      data-overlay-explorer-slate-pane="true"
      style={{
        display: "flex",
        flexDirection: "column",
        flex: "1 1 0%",
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        height: "100%",
        color: tone.text ?? "var(--overlay-text-primary)",
        background: "var(--overlay-explorer-panel-bg)",
        border: `1px solid ${tone.border ?? "var(--overlay-explorer-panel-border)"}`,
        borderRadius: "var(--overlay-explorer-panel-radius)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function ExplorerSlatePaneHeader({
  title,
  subtitle,
  actions,
  tone,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tone: ExplorerPaneTone;
}) {
  return (
    <header
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderBottom: `1px solid ${tone.border ?? "var(--overlay-explorer-toolbar-border)"}`,
        background: "var(--overlay-explorer-preview-header-bg)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <ExplorerBoundedText
          lines={1}
          style={{
            color: tone.text ?? "var(--overlay-text-primary)",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </ExplorerBoundedText>
        {subtitle ? (
          <ExplorerBoundedText
            lines={2}
            style={{
              marginTop: 3,
              color: tone.muted ?? "var(--overlay-text-muted)",
              fontSize: 10,
              lineHeight: 1.35,
            }}
          >
            {subtitle}
          </ExplorerBoundedText>
        ) : null}
      </div>
      {actions ? (
        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function ExplorerSlateToolbarRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 10px",
        flexWrap: "wrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function ExplorerSlateSection({
  children,
  title,
  tone,
}: {
  children: ReactNode;
  title?: ReactNode;
  tone: ExplorerPaneTone;
}) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
        padding: "10px 12px",
      }}
    >
      {title ? (
        <ExplorerBoundedText
          lines={1}
          style={{
            color: tone.muted ?? "var(--overlay-text-muted)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </ExplorerBoundedText>
      ) : null}
      {children}
    </section>
  );
}

export function ExplorerSlateStatusStrip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: ExplorerPaneTone;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        minHeight: 28,
        padding: "0 10px",
        borderTop: `1px solid ${tone.border ?? "var(--overlay-explorer-toolbar-border)"}`,
        color: tone.muted ?? "var(--overlay-text-muted)",
        fontSize: 10,
      }}
    >
      {children}
    </div>
  );
}

export function ExplorerSlateIconButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
  tone,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  tone: ExplorerPaneTone;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--overlay-explorer-control-radius)",
        border: `1px solid ${active ? tone.accent : tone.border ?? "var(--overlay-explorer-chip-border)"}`,
        background: active
          ? "var(--overlay-explorer-chip-active-bg)"
          : "var(--overlay-explorer-chip-bg)",
        color: active ? tone.accent : tone.muted ?? "var(--overlay-text-muted)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}
