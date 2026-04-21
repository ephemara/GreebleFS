import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { OverlayScrollArea } from "../OverlayScrollArea";

export type ExplorerTablePreviewLayout = "compact" | "wide";

export interface ExplorerTablePreviewMetric {
  label: string;
  value: string;
}

export interface ExplorerTablePreviewColumn {
  id: string;
  label: ReactNode;
  title?: string;
  align?: "left" | "right";
  minWidth?: number;
  maxWidth?: number;
}

export interface ExplorerTablePreviewCell {
  key: string;
  content: ReactNode;
  title?: string;
  align?: "left" | "right";
  tone?: "default" | "secondary" | "muted" | "danger";
}

export interface ExplorerTablePreviewRow {
  id: string;
  cells: readonly ExplorerTablePreviewCell[];
}

export interface ExplorerTablePreviewGridProps {
  columns: readonly ExplorerTablePreviewColumn[];
  rows: readonly ExplorerTablePreviewRow[];
  emptyState: ReactNode;
  overlay?: ReactNode;
}

export interface ExplorerTablePreviewCollectionButtonProps {
  active: boolean;
  icon?: ReactNode;
  label: string;
  detail?: string;
  title?: string;
  layoutMode: ExplorerTablePreviewLayout;
  onClick: () => void;
}

export interface ExplorerTablePreviewDatasetHeaderProps {
  icon: ReactNode;
  title: ReactNode;
  metrics: readonly ExplorerTablePreviewMetric[];
  layoutMode: ExplorerTablePreviewLayout;
  actions?: ReactNode;
  footer?: ReactNode;
}

const TABLE_PREVIEW_COMPACT_BREAKPOINT_PX = 760;

export function resolveExplorerTablePreviewLayout(
  containerWidth: number | null,
): ExplorerTablePreviewLayout {
  return containerWidth == null || containerWidth < TABLE_PREVIEW_COMPACT_BREAKPOINT_PX
    ? "compact"
    : "wide";
}

export function useExplorerTablePreviewLayout(
  containerRef: RefObject<HTMLElement | null>,
): ExplorerTablePreviewLayout {
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = (nextWidth: number) => {
      setContainerWidth((currentWidth) => {
        if (
          currentWidth != null &&
          Number.isFinite(nextWidth) &&
          Math.abs(currentWidth - nextWidth) < 1
        ) {
          return currentWidth;
        }
        return nextWidth;
      });
    };

    updateWidth(element.getBoundingClientRect().width);

    const ResizeObserverConstructor = globalThis.ResizeObserver;
    if (typeof ResizeObserverConstructor !== "function") {
      return;
    }

    const observer = new ResizeObserverConstructor((entries) => {
      const nextWidth =
        entries[0]?.contentRect.width ?? element.getBoundingClientRect().width;
      updateWidth(nextWidth);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [containerRef]);

  return resolveExplorerTablePreviewLayout(containerWidth);
}

export function ExplorerTablePreviewSurface({
  children,
  containerRef,
  layoutMode,
}: {
  children: ReactNode;
  containerRef?: RefObject<HTMLDivElement | null>;
  layoutMode?: ExplorerTablePreviewLayout;
}) {
  return (
    <div
      ref={containerRef}
      data-table-preview-layout={layoutMode}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--overlay-explorer-preview-bg)",
        overflow: "hidden",
        color: "var(--overlay-text-primary)",
      }}
    >
      {children}
    </div>
  );
}

export function ExplorerTablePreviewIdentityHeader({
  icon,
  title,
  subtitle,
  metrics,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  metrics: readonly ExplorerTablePreviewMetric[];
}) {
  return (
    <div style={identityHeaderStyle}>
      <div style={identityIconWrapStyle}>{icon}</div>
      <div style={{ minWidth: 0, display: "grid", gap: 6, flex: 1 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={identityTitleStyle}>{title}</div>
          <div style={identitySubtitleStyle}>{subtitle}</div>
        </div>
        {metrics.length > 0 ? (
          <div style={metricWrapStyle}>
            {metrics.map((metric) => (
              <ExplorerTablePreviewMetricPill
                key={`${metric.label}:${metric.value}`}
                label={metric.label}
                value={metric.value}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ExplorerTablePreviewMetricPill({
  label,
  value,
}: ExplorerTablePreviewMetric) {
  return (
    <div style={metricPillStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <span style={metricValueStyle}>{value}</span>
    </div>
  );
}

export function ExplorerTablePreviewCollectionStrip({
  label,
  meta,
  children,
}: {
  label: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={collectionStripStyle}>
      <div style={collectionHeaderStyle}>
        <div style={sectionEyebrowStyle}>{label}</div>
        {meta ? <div style={sectionMetaStyle}>{meta}</div> : null}
      </div>
      <OverlayScrollArea
        direction="horizontal"
        style={{ flex: "0 0 auto" }}
        viewportStyle={{ paddingBottom: 2 }}
        contentStyle={{
          display: "flex",
          alignItems: "stretch",
          gap: 8,
          minWidth: "max-content",
          paddingRight: 8,
        }}
        scrollbarStyle="themed"
      >
        {children}
      </OverlayScrollArea>
    </div>
  );
}

export function ExplorerTablePreviewCollectionButton({
  active,
  icon,
  label,
  detail,
  title,
  layoutMode,
  onClick,
}: ExplorerTablePreviewCollectionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        flex: "0 0 auto",
        minWidth: layoutMode === "compact" ? 152 : 176,
        maxWidth: layoutMode === "compact" ? 196 : 228,
        border: "1px solid var(--overlay-explorer-preview-border)",
        borderRadius: 999,
        padding: "8px 10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        textAlign: "left",
        background: active
          ? "var(--overlay-selection-bg)"
          : "var(--overlay-explorer-chip-bg)",
        color: active
          ? "var(--overlay-text-primary)"
          : "var(--overlay-text-secondary)",
        boxShadow: active
          ? "inset 0 0 0 1px var(--overlay-explorer-preview-border)"
          : "none",
      }}
    >
      {icon ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            opacity: active ? 1 : 0.7,
          }}
        >
          {icon}
        </span>
      ) : null}
      <span style={collectionButtonLabelStyle}>{label}</span>
      {detail ? <span style={collectionButtonDetailStyle}>{detail}</span> : null}
    </button>
  );
}

export function ExplorerTablePreviewDatasetHeader({
  icon,
  title,
  metrics,
  layoutMode,
  actions,
  footer,
}: ExplorerTablePreviewDatasetHeaderProps) {
  return (
    <div style={datasetHeaderStyle}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            layoutMode === "compact" ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "var(--overlay-accent)",
              }}
            >
              {icon}
            </span>
            <div style={datasetTitleStyle}>{title}</div>
          </div>
          {metrics.length > 0 ? (
            <div style={metricWrapStyle}>
              {metrics.map((metric) => (
                <ExplorerTablePreviewMetricPill
                  key={`${metric.label}:${metric.value}`}
                  label={metric.label}
                  value={metric.value}
                />
              ))}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: layoutMode === "compact" ? "wrap" : "nowrap",
            }}
          >
            {actions}
          </div>
        ) : null}
      </div>
      {footer ? <div style={datasetFooterStyle}>{footer}</div> : null}
    </div>
  );
}

export function ExplorerTablePreviewActionButton({
  children,
  disabled = false,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "6px 9px",
        borderRadius: 8,
        background: "transparent",
        border: "1px solid var(--overlay-explorer-preview-border)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        display: "flex",
        alignItems: "center",
        gap: 4,
        color: "var(--overlay-text-primary)",
        outline: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export function ExplorerTablePreviewGrid({
  columns,
  rows,
  emptyState,
  overlay,
}: ExplorerTablePreviewGridProps) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        position: "relative",
      }}
    >
      <OverlayScrollArea
        direction="both"
        style={{ flex: 1, minHeight: 0 }}
        scrollbarStyle="themed"
      >
        <table
          style={{
            minWidth: "100%",
            width: "max-content",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: 12.5,
            lineHeight: 1.45,
          }}
        >
          <thead
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              background: "var(--overlay-bg-card)",
              boxShadow: "0 1px 0 var(--overlay-explorer-preview-border)",
            }}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  title={column.title}
                  style={tableHeadCellStyle(column)}
                >
                  <div style={tableHeadLabelStyle}>{column.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr
                  key={row.id}
                  style={{
                    background:
                      rowIndex % 2 === 0 ? "transparent" : "rgba(255,255,255,0.018)",
                  }}
                >
                  {row.cells.map((cell, cellIndex) => (
                    <td
                      key={cell.key || `${row.id}-${cellIndex}`}
                      title={cell.title}
                      style={tableBodyCellStyle(columns[cellIndex], cell)}
                    >
                      {cell.content}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length || 1}
                  style={{
                    padding: 32,
                    textAlign: "center",
                    color: "var(--overlay-text-muted)",
                    borderBottom: "1px solid var(--overlay-explorer-preview-border)",
                  }}
                >
                  {emptyState}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </OverlayScrollArea>
      {overlay ? <div style={overlayWrapStyle}>{overlay}</div> : null}
    </div>
  );
}

export function ExplorerTablePreviewCenteredStatus({
  children,
  textColor = "var(--overlay-text-dim)",
}: {
  children: ReactNode;
  textColor?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        placeItems: "center",
        padding: 24,
        color: textColor,
      }}
    >
      {children}
    </div>
  );
}

function tableHeadCellStyle(
  column: ExplorerTablePreviewColumn,
): CSSProperties {
  return {
    textAlign: column.align ?? "left",
    padding: "10px 12px",
    fontWeight: 700,
    color: "var(--overlay-text-secondary)",
    borderRight: "1px solid var(--overlay-explorer-preview-border)",
    borderBottom: "1px solid var(--overlay-explorer-preview-border)",
    verticalAlign: "bottom",
    minWidth: column.minWidth ?? 152,
    maxWidth: column.maxWidth ?? 280,
    background: "var(--overlay-bg-card)",
  };
}

function tableBodyCellStyle(
  column: ExplorerTablePreviewColumn | undefined,
  cell: ExplorerTablePreviewCell,
): CSSProperties {
  return {
    padding: "10px 12px",
    color: resolveCellToneColor(cell.tone),
    textAlign: cell.align ?? column?.align ?? "left",
    borderRight: "1px solid var(--overlay-explorer-preview-border)",
    borderBottom: "1px solid var(--overlay-explorer-preview-border)",
    verticalAlign: "top",
    minWidth: column?.minWidth ?? 152,
    maxWidth: column?.maxWidth ?? 320,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
}

function resolveCellToneColor(
  tone: ExplorerTablePreviewCell["tone"] = "default",
): string {
  switch (tone) {
    case "muted":
      return "var(--overlay-text-dim)";
    case "secondary":
      return "var(--overlay-text-secondary)";
    case "danger":
      return "var(--overlay-danger)";
    default:
      return "var(--overlay-text-primary)";
  }
}

const identityHeaderStyle: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--overlay-explorer-preview-border)",
  background: "var(--overlay-bg-card)",
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
};

const identityIconWrapStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  background: "var(--overlay-explorer-chip-bg)",
  color: "var(--overlay-accent)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const identityTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const identitySubtitleStyle: CSSProperties = {
  fontSize: 9.5,
  color: "var(--overlay-text-muted)",
  fontFamily: "var(--overlay-font-mono, monospace)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const metricPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 7px",
  borderRadius: 999,
  background: "var(--overlay-explorer-chip-bg)",
  border: "1px solid var(--overlay-explorer-preview-border)",
  minWidth: 0,
};

const metricLabelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--overlay-text-muted)",
};

const metricValueStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--overlay-text-primary)",
  whiteSpace: "nowrap",
};

const collectionStripStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "8px 12px 10px",
  borderBottom: "1px solid var(--overlay-explorer-preview-border)",
  background: "var(--overlay-bg-panel)",
};

const collectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const sectionEyebrowStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--overlay-text-muted)",
};

const sectionMetaStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--overlay-text-dim)",
};

const collectionButtonLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
};

const collectionButtonDetailStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--overlay-text-dim)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const datasetHeaderStyle: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--overlay-explorer-preview-border)",
  background: "var(--overlay-bg-card)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const datasetTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const datasetFooterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  fontSize: 11,
  color: "var(--overlay-text-dim)",
};

const tableHeadLabelStyle: CSSProperties = {
  whiteSpace: "normal",
  wordBreak: "break-word",
};

const overlayWrapStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  pointerEvents: "none",
};
