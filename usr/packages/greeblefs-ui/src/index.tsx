import React from 'react';
import {
  ExplorerWorkflowButton,
  ExplorerWorkflowEmptyState,
  ExplorerWorkflowFieldGrid,
  ExplorerWorkflowInput,
  ExplorerWorkflowMetaStrip,
  ExplorerWorkflowResultCard,
  ExplorerWorkflowResultCardHeader,
  ExplorerWorkflowResultList,
  ExplorerWorkflowResultRow,
  ExplorerWorkflowRowActions,
  ExplorerWorkflowSection,
  ExplorerWorkflowStatusNotice,
} from 'overlayterm-plugin';

export {
  ExplorerWorkflowButton,
  ExplorerWorkflowEmptyState,
  ExplorerWorkflowFieldGrid,
  ExplorerWorkflowInput,
  ExplorerWorkflowMetaStrip,
  ExplorerWorkflowResultCard,
  ExplorerWorkflowResultCardHeader,
  ExplorerWorkflowResultList,
  ExplorerWorkflowResultRow,
  ExplorerWorkflowRowActions,
  ExplorerWorkflowSection,
  ExplorerWorkflowStatusNotice,
};

export const greebleUiVersion = '1.3.0';

export * from './dcc';
export * from './layout';

function mergeStyle(base, next) {
  return next ? { ...base, ...next } : base;
}

function compactChildren(children) {
  return React.Children.toArray(children).filter(Boolean);
}

export function GreebleSurface({
  children,
  tone = 'panel',
  padded = true,
  style,
  ...props
}) {
  const toneStyle = tone === 'shell'
    ? shellSurfaceStyle
    : tone === 'flat'
      ? flatSurfaceStyle
      : tone === 'glass'
        ? glassSurfaceStyle
        : panelSurfaceStyle;
  return (
    <section
      {...props}
      data-greeble-ui="surface"
      style={mergeStyle({ ...toneStyle, padding: padded ? 12 : 0 }, style)}
    >
      {children}
    </section>
  );
}

export function GreeblePanel({ children, title, eyebrow, actions, footer, style, ...props }) {
  return (
    <GreebleSurface {...props} style={mergeStyle(panelLayoutStyle, style)}>
      {title || eyebrow || actions ? (
        <GreebleToolbar>
          <div style={{ minWidth: 0 }}>
            {eyebrow ? <div style={eyebrowStyle}>{eyebrow}</div> : null}
            {title ? <div style={panelTitleStyle}>{title}</div> : null}
          </div>
          {actions ? <GreebleInline gap={6} wrap justify="end">{actions}</GreebleInline> : null}
        </GreebleToolbar>
      ) : null}
      {children}
      {footer ? <div style={footerStyle}>{footer}</div> : null}
    </GreebleSurface>
  );
}

export function GreebleWorkflowShell({ children, title, eyebrow, actions, footer, style, ...props }) {
  return (
    <GreeblePanel
      {...props}
      title={title}
      eyebrow={eyebrow}
      actions={actions}
      footer={footer}
      style={mergeStyle(workflowShellStyle, style)}
    >
      <div style={workflowBodyStyle}>{children}</div>
    </GreeblePanel>
  );
}

export function GreebleStack({ children, gap = 10, style, ...props }) {
  return (
    <div {...props} data-greeble-ui="stack" style={mergeStyle({ display: 'grid', gap, minWidth: 0 }, style)}>
      {children}
    </div>
  );
}

export function GreebleInline({
  children,
  gap = 8,
  align = 'center',
  justify = 'start',
  wrap = true,
  style,
  ...props
}) {
  return (
    <div
      {...props}
      data-greeble-ui="inline"
      style={mergeStyle({
        display: 'flex',
        alignItems: align,
        justifyContent: justify === 'between' ? 'space-between' : justify === 'end' ? 'flex-end' : justify,
        gap,
        minWidth: 0,
        flexWrap: wrap ? 'wrap' : 'nowrap',
      }, style)}
    >
      {children}
    </div>
  );
}

export function GreebleGrid({
  children,
  columns = 'repeat(auto-fit, minmax(180px, 1fr))',
  gap = 10,
  style,
  ...props
}) {
  return (
    <div
      {...props}
      data-greeble-ui="grid"
      style={mergeStyle({ display: 'grid', gridTemplateColumns: columns, gap, minWidth: 0 }, style)}
    >
      {children}
    </div>
  );
}

export function GreebleSplitLayout({
  children,
  columns = 'minmax(0, 1fr) minmax(220px, 0.42fr)',
  gap = 12,
  style,
  ...props
}) {
  return (
    <div
      {...props}
      data-greeble-ui="split"
      style={mergeStyle({
        display: 'grid',
        gridTemplateColumns: columns,
        gap,
        minWidth: 0,
        minHeight: 0,
      }, style)}
    >
      {children}
    </div>
  );
}

export function GreebleToolbar({ children, align = 'between', style, ...props }) {
  return (
    <div
      {...props}
      data-greeble-ui="toolbar"
      style={mergeStyle({
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'end' ? 'flex-end' : align === 'start' ? 'flex-start' : 'space-between',
        gap: 8,
        minWidth: 0,
        flexWrap: 'wrap',
      }, style)}
    >
      {children}
    </div>
  );
}

export function GreebleCommandBar({ children, style, ...props }) {
  return (
    <div {...props} data-greeble-ui="command-bar" style={mergeStyle(commandBarStyle, style)}>
      {children}
    </div>
  );
}

export function GreebleCard({ children, active = false, style, ...props }) {
  return (
    <article
      {...props}
      data-greeble-ui="card"
      style={mergeStyle(active ? activeCardStyle : cardStyle, style)}
    >
      {children}
    </article>
  );
}

export function GreebleCardHeader({ title, eyebrow, meta, actions, style, ...props }) {
  return (
    <header {...props} data-greeble-ui="card-header" style={mergeStyle(cardHeaderStyle, style)}>
      <div style={{ minWidth: 0 }}>
        {eyebrow ? <div style={eyebrowStyle}>{eyebrow}</div> : null}
        {title ? <div style={cardTitleStyle}>{title}</div> : null}
        {meta ? <div style={mutedTextStyle}>{meta}</div> : null}
      </div>
      {actions ? <GreebleInline gap={6} justify="end">{actions}</GreebleInline> : null}
    </header>
  );
}

export function GreebleHero({ eyebrow, title, children, actions, metric, style, ...props }) {
  return (
    <GreebleSurface {...props} tone="glass" style={mergeStyle(heroStyle, style)}>
      <div style={{ minWidth: 0 }}>
        {eyebrow ? <div style={eyebrowStyle}>{eyebrow}</div> : null}
        {title ? <div style={heroTitleStyle}>{title}</div> : null}
        {children ? <div style={heroBodyStyle}>{children}</div> : null}
      </div>
      {metric ? <div style={heroMetricStyle}>{metric}</div> : null}
      {actions ? <GreebleInline gap={6} justify="end">{actions}</GreebleInline> : null}
    </GreebleSurface>
  );
}

export function GreebleMetric({ label, value, delta, tone = 'neutral', style, ...props }) {
  return (
    <div {...props} data-greeble-ui="metric" style={mergeStyle(metricStyle, style)}>
      <div style={metricValueStyle}>{value}</div>
      <GreebleInline gap={6} wrap={false}>
        <span style={mutedTextStyle}>{label}</span>
        {delta ? <span style={badgeStyleForTone(tone)}>{delta}</span> : null}
      </GreebleInline>
    </div>
  );
}

export function GreebleKpiStrip({ metrics = [], style, ...props }) {
  return (
    <GreebleGrid {...props} columns="repeat(auto-fit, minmax(120px, 1fr))" gap={8} style={style}>
      {metrics.map((metric, index) => (
        <GreebleMetric key={metric.id ?? metric.label ?? index} {...metric} />
      ))}
    </GreebleGrid>
  );
}

export function GreebleFieldLabel({ children, label, hint, style, ...props }) {
  return (
    <label {...props} data-greeble-ui="field-label" style={mergeStyle(fieldLabelStyle, style)}>
      {label ? <span>{label}</span> : null}
      {children}
      {hint ? <span style={fieldHintStyle}>{hint}</span> : null}
    </label>
  );
}

export function GreebleInput({ style, ...props }) {
  return <input {...props} style={mergeStyle(inputStyle, style)} />;
}

export function GreebleTextArea({ style, ...props }) {
  return <textarea {...props} style={mergeStyle(textAreaStyle, style)} />;
}

export function GreebleSelect({ children, style, ...props }) {
  return (
    <select {...props} style={mergeStyle(inputStyle, style)}>
      {children}
    </select>
  );
}

export function GreebleSearchBox({ icon, style, inputStyle: nextInputStyle, ...props }) {
  return (
    <div data-greeble-ui="search" style={mergeStyle(searchShellStyle, style)}>
      {icon ? <span style={searchIconStyle}>{icon}</span> : null}
      <input {...props} type={props.type ?? 'search'} style={mergeStyle(searchInputStyle, nextInputStyle)} />
    </div>
  );
}

export function GreebleCheckbox({ label, style, ...props }) {
  return (
    <label data-greeble-ui="checkbox" style={mergeStyle(checkLabelStyle, style)}>
      <input {...props} type="checkbox" style={checkInputStyle} />
      <span>{label}</span>
    </label>
  );
}

export function GreebleToggle({ checked = false, label, onChange, style, ...props }) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(event) => {
        props.onClick?.(event);
        onChange?.(!checked, event);
      }}
      data-greeble-ui="toggle"
      style={mergeStyle(toggleStyle, style)}
    >
      <span style={checked ? toggleTrackOnStyle : toggleTrackStyle}>
        <span style={checked ? toggleKnobOnStyle : toggleKnobStyle} />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}

export function GreebleRange({ style, ...props }) {
  return <input {...props} type="range" data-greeble-ui="range" style={mergeStyle(rangeStyle, style)} />;
}

export function GreebleSegmentedControl({
  options = [],
  value,
  onChange,
  getLabel = option => option.label ?? option.title ?? option.id ?? String(option),
  getValue = option => option.value ?? option.id ?? String(option),
  style,
  ...props
}) {
  return (
    <div {...props} role="group" data-greeble-ui="segmented" style={mergeStyle(segmentedControlStyle, style)}>
      {options.map(option => {
        const optionValue = getValue(option);
        const active = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange?.(optionValue, option)}
            style={active ? segmentedButtonActiveStyle : segmentedButtonStyle}
          >
            {getLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

export function GreebleIconButton({ children, active = false, style, ...props }) {
  return (
    <button {...props} type={props.type ?? 'button'} data-greeble-ui="icon-button" style={mergeStyle(active ? activeIconButtonStyle : iconButtonStyle, style)}>
      {children}
    </button>
  );
}

export function GreebleBadge({ label, tone = 'neutral', style, ...props }) {
  return <span {...props} data-greeble-ui="badge" style={mergeStyle(badgeStyleForTone(tone), style)}>{label}</span>;
}

export function GreebleTag({ children, tone = 'neutral', style, ...props }) {
  return <span {...props} data-greeble-ui="tag" style={mergeStyle(tagStyleForTone(tone), style)}>{children}</span>;
}

export function GreeblePill({ children, active = false, style, ...props }) {
  return <span {...props} data-greeble-ui="pill" style={mergeStyle(active ? activePillStyle : pillStyle, style)}>{children}</span>;
}

export function GreebleTabs({ tabs = [], value, onChange, style, ...props }) {
  return (
    <div {...props} role="tablist" data-greeble-ui="tabs" style={mergeStyle(tabsStyle, style)}>
      {tabs.map(tab => (
        <GreebleTabButton
          key={tab.id ?? tab.value ?? tab.label}
          active={(tab.value ?? tab.id) === value}
          onClick={() => onChange?.(tab.value ?? tab.id, tab)}
        >
          {tab.label ?? tab.title ?? tab.id}
        </GreebleTabButton>
      ))}
    </div>
  );
}

export function GreebleTabButton({ children, active = false, style, ...props }) {
  return (
    <button
      {...props}
      type="button"
      role="tab"
      aria-selected={active}
      data-greeble-ui="tab"
      style={mergeStyle(active ? activeTabStyle : tabStyle, style)}
    >
      {children}
    </button>
  );
}

export function GreebleNotice({ children, tone = 'neutral', title, actions, style, ...props }) {
  return (
    <div {...props} data-greeble-ui="notice" style={mergeStyle(noticeStyleForTone(tone), style)}>
      <div style={{ minWidth: 0 }}>
        {title ? <div style={noticeTitleStyle}>{title}</div> : null}
        {children ? <div style={mutedTextStyle}>{children}</div> : null}
      </div>
      {actions ? <GreebleInline gap={6} justify="end">{actions}</GreebleInline> : null}
    </div>
  );
}

export function GreebleProgressBar({ value = 0, max = 100, tone = 'accent', style, ...props }) {
  const percent = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div {...props} data-greeble-ui="progress" style={mergeStyle(progressTrackStyle, style)}>
      <div style={{ ...progressFillStyle, width: `${percent}%`, background: toneColor(tone) }} />
    </div>
  );
}

export function GreebleSkeleton({ rows = 3, style, ...props }) {
  return (
    <div {...props} data-greeble-ui="skeleton" style={mergeStyle({ display: 'grid', gap: 6 }, style)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ ...skeletonLineStyle, width: `${92 - index * 13}%` }} />
      ))}
    </div>
  );
}

export function GreebleCodeBlock({ children, style, ...props }) {
  return <pre {...props} data-greeble-ui="code" style={mergeStyle(codeBlockStyle, style)}>{children}</pre>;
}

export function GreebleKeyValueList({ items = [], style, ...props }) {
  return (
    <dl {...props} data-greeble-ui="key-values" style={mergeStyle(keyValueListStyle, style)}>
      {items.map((item, index) => (
        <React.Fragment key={item.key ?? item.label ?? index}>
          <dt style={keyStyle}>{item.label ?? item.key}</dt>
          <dd style={valueStyle}>{item.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function GreebleTable({ columns = [], rows = [], getRowKey, style, ...props }) {
  return (
    <div data-greeble-ui="table-wrap" style={mergeStyle(tableWrapStyle, style)}>
      <table {...props} style={tableStyle}>
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.key ?? column.id} style={tableHeaderCellStyle}>
                {column.label ?? column.title ?? column.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey?.(row, rowIndex) ?? row.id ?? row.path ?? rowIndex} style={tableRowStyle}>
              {columns.map(column => (
                <td key={column.key ?? column.id} style={tableCellStyle}>
                  {column.render ? column.render(row, rowIndex) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GreebleFileDropZone({ children, active = false, style, ...props }) {
  return (
    <div {...props} data-greeble-ui="drop-zone" style={mergeStyle(active ? activeDropZoneStyle : dropZoneStyle, style)}>
      {children}
    </div>
  );
}

export function GreebleFilePathRow({ path, label, actions, style, ...props }) {
  return (
    <div {...props} data-greeble-ui="file-path" style={mergeStyle(filePathRowStyle, style)}>
      <div style={{ minWidth: 0 }}>
        {label ? <div style={mutedTextStyle}>{label}</div> : null}
        <div style={filePathTextStyle}>{path}</div>
      </div>
      {actions ? <GreebleInline gap={6} justify="end">{actions}</GreebleInline> : null}
    </div>
  );
}

export function GreebleToastStack({ children, style, ...props }) {
  return (
    <div {...props} data-greeble-ui="toast-stack" style={mergeStyle(toastStackStyle, style)}>
      {compactChildren(children)}
    </div>
  );
}

export const GreebleButton = ExplorerWorkflowButton;
export const GreebleEmptyState = ExplorerWorkflowEmptyState;
export const GreebleFieldGrid = ExplorerWorkflowFieldGrid;
export const GreebleTextField = GreebleInput;
export const GreebleMetaStrip = ExplorerWorkflowMetaStrip;
export const GreebleResultCard = ExplorerWorkflowResultCard;
export const GreebleResultCardHeader = ExplorerWorkflowResultCardHeader;
export const GreebleResultList = ExplorerWorkflowResultList;
export const GreebleResultRow = ExplorerWorkflowResultRow;
export const GreebleRowActions = ExplorerWorkflowRowActions;
export const GreebleSection = ExplorerWorkflowSection;
export const GreebleStatusNotice = ExplorerWorkflowStatusNotice;
export const GreebleStatus = ExplorerWorkflowStatusNotice;

const panelSurfaceStyle = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  minHeight: 0,
  border: '1px solid var(--overlay-border)',
  borderRadius: 'var(--overlay-workbench-panel-radius)',
  background: 'var(--overlay-bg-panel)',
  color: 'var(--overlay-text-primary)',
};

const shellSurfaceStyle = {
  ...panelSurfaceStyle,
  background: 'var(--overlay-bg-shell)',
};

const glassSurfaceStyle = {
  ...panelSurfaceStyle,
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--overlay-bg-panel) 92%, var(--overlay-accent) 8%), color-mix(in srgb, var(--overlay-bg-shell) 88%, transparent))',
  boxShadow: '0 18px 50px color-mix(in srgb, var(--overlay-shadow-color, #000) 24%, transparent)',
  backdropFilter: 'blur(18px)',
};

const flatSurfaceStyle = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  minHeight: 0,
  color: 'var(--overlay-text-primary)',
};

const panelLayoutStyle = {
  alignContent: 'start',
};

const workflowShellStyle = {
  alignContent: 'stretch',
};

const workflowBodyStyle = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  minHeight: 0,
};

const commandBarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  border: '1px solid var(--overlay-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  background: 'var(--overlay-workbench-settings-badge-bg)',
  padding: 4,
  overflowX: 'auto',
};

const cardStyle = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  border: '1px solid var(--overlay-border)',
  borderRadius: 'var(--overlay-explorer-card-radius, var(--overlay-workbench-panel-radius))',
  background: 'color-mix(in srgb, var(--overlay-bg-panel) 88%, transparent)',
  padding: 10,
};

const activeCardStyle = {
  ...cardStyle,
  borderColor: 'var(--overlay-accent)',
  background: 'color-mix(in srgb, var(--overlay-accent) 10%, var(--overlay-bg-panel))',
};

const cardHeaderStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
};

const heroStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 12,
  alignItems: 'center',
  overflow: 'hidden',
};

const heroTitleStyle = {
  color: 'var(--overlay-text-primary)',
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
  letterSpacing: '-0.035em',
};

const heroBodyStyle = {
  color: 'var(--overlay-text-secondary)',
  fontSize: 12,
  lineHeight: 1.45,
  marginTop: 6,
};

const heroMetricStyle = {
  color: 'var(--overlay-accent)',
  fontSize: 28,
  fontWeight: 950,
  letterSpacing: '-0.06em',
};

const metricStyle = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  border: '1px solid var(--overlay-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  background: 'var(--overlay-workbench-settings-badge-bg)',
  padding: 10,
};

const metricValueStyle = {
  color: 'var(--overlay-text-primary)',
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1,
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--overlay-explorer-input-bg)',
  border: '1px solid var(--overlay-explorer-input-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  color: 'var(--overlay-text-primary)',
  fontSize: 12,
  padding: '8px 10px',
  outline: 'none',
};

const textAreaStyle = {
  ...inputStyle,
  minHeight: 96,
  resize: 'vertical',
  lineHeight: 1.45,
  fontFamily: 'var(--overlay-font-mono)',
};

const searchShellStyle = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: 7,
  width: '100%',
  border: '1px solid var(--overlay-explorer-input-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  background: 'var(--overlay-explorer-input-bg)',
  padding: '0 8px',
};

const searchIconStyle = {
  color: 'var(--overlay-text-muted)',
  display: 'inline-flex',
};

const searchInputStyle = {
  border: 0,
  outline: 'none',
  background: 'transparent',
  color: 'var(--overlay-text-primary)',
  minWidth: 0,
  padding: '8px 0',
  fontSize: 12,
};

const fieldLabelStyle = {
  color: 'var(--overlay-text-secondary)',
  display: 'grid',
  gap: 6,
  fontSize: 11,
  fontWeight: 750,
};

const fieldHintStyle = {
  color: 'var(--overlay-text-muted)',
  fontSize: 10,
  fontWeight: 600,
};

const checkLabelStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  color: 'var(--overlay-text-secondary)',
  fontSize: 12,
  fontWeight: 700,
};

const checkInputStyle = {
  accentColor: 'var(--overlay-accent)',
};

const toggleStyle = {
  border: 0,
  background: 'transparent',
  color: 'var(--overlay-text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: 0,
  fontSize: 12,
  fontWeight: 750,
};

const toggleTrackStyle = {
  width: 32,
  height: 18,
  borderRadius: 999,
  background: 'var(--overlay-workbench-settings-badge-bg)',
  border: '1px solid var(--overlay-border)',
  position: 'relative',
};

const toggleTrackOnStyle = {
  ...toggleTrackStyle,
  background: 'color-mix(in srgb, var(--overlay-accent) 32%, transparent)',
  borderColor: 'var(--overlay-accent)',
};

const toggleKnobStyle = {
  position: 'absolute',
  top: 2,
  left: 2,
  width: 12,
  height: 12,
  borderRadius: 999,
  background: 'var(--overlay-text-muted)',
};

const toggleKnobOnStyle = {
  ...toggleKnobStyle,
  left: 16,
  background: 'var(--overlay-text-primary)',
};

const rangeStyle = {
  width: '100%',
  accentColor: 'var(--overlay-accent)',
};

const segmentedControlStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: '1px solid var(--overlay-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  background: 'var(--overlay-workbench-settings-badge-bg)',
  padding: 3,
};

const segmentedButtonStyle = {
  border: 0,
  borderRadius: 'calc(var(--overlay-explorer-control-radius) - 2px)',
  background: 'transparent',
  color: 'var(--overlay-text-muted)',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 750,
  padding: '5px 8px',
};

const segmentedButtonActiveStyle = {
  ...segmentedButtonStyle,
  background: 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)',
  color: 'var(--overlay-text-primary)',
};

const iconButtonStyle = {
  minWidth: 28,
  minHeight: 28,
  border: '1px solid var(--overlay-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  background: 'var(--overlay-workbench-settings-badge-bg)',
  color: 'var(--overlay-text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const activeIconButtonStyle = {
  ...iconButtonStyle,
  borderColor: 'var(--overlay-accent)',
  background: 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)',
  color: 'var(--overlay-text-primary)',
};

const tabsStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  borderBottom: '1px solid var(--overlay-border)',
  minWidth: 0,
};

const tabStyle = {
  border: 0,
  borderBottom: '2px solid transparent',
  background: 'transparent',
  color: 'var(--overlay-text-muted)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 800,
  padding: '7px 9px',
};

const activeTabStyle = {
  ...tabStyle,
  color: 'var(--overlay-text-primary)',
  borderBottomColor: 'var(--overlay-accent)',
};

const progressTrackStyle = {
  width: '100%',
  height: 6,
  borderRadius: 999,
  background: 'var(--overlay-workbench-settings-badge-bg)',
  overflow: 'hidden',
};

const progressFillStyle = {
  height: '100%',
  borderRadius: 999,
  transition: 'width 160ms ease',
};

const skeletonLineStyle = {
  height: 10,
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--overlay-workbench-settings-badge-bg), color-mix(in srgb, var(--overlay-accent) 12%, transparent), var(--overlay-workbench-settings-badge-bg))',
};

const codeBlockStyle = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  overflow: 'auto',
  border: '1px solid var(--overlay-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  background: 'var(--overlay-bg-shell)',
  color: 'var(--overlay-text-primary)',
  fontFamily: 'var(--overlay-font-mono)',
  fontSize: 11,
  lineHeight: 1.5,
  padding: 10,
};

const keyValueListStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(90px, 0.35fr) minmax(0, 1fr)',
  gap: '7px 10px',
  margin: 0,
};

const keyStyle = {
  color: 'var(--overlay-text-muted)',
  fontSize: 11,
  fontWeight: 750,
};

const valueStyle = {
  color: 'var(--overlay-text-primary)',
  fontSize: 12,
  margin: 0,
  minWidth: 0,
};

const tableWrapStyle = {
  minWidth: 0,
  overflow: 'auto',
  border: '1px solid var(--overlay-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const tableHeaderCellStyle = {
  textAlign: 'left',
  color: 'var(--overlay-text-muted)',
  background: 'var(--overlay-workbench-settings-badge-bg)',
  padding: '7px 8px',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const tableRowStyle = {
  borderTop: '1px solid var(--overlay-border)',
};

const tableCellStyle = {
  color: 'var(--overlay-text-primary)',
  padding: '7px 8px',
  verticalAlign: 'top',
};

const dropZoneStyle = {
  display: 'grid',
  placeItems: 'center',
  minHeight: 96,
  border: '1px dashed var(--overlay-border)',
  borderRadius: 'var(--overlay-workbench-panel-radius)',
  background: 'color-mix(in srgb, var(--overlay-bg-panel) 70%, transparent)',
  color: 'var(--overlay-text-secondary)',
  padding: 14,
};

const activeDropZoneStyle = {
  ...dropZoneStyle,
  borderColor: 'var(--overlay-accent)',
  background: 'color-mix(in srgb, var(--overlay-accent) 12%, transparent)',
  color: 'var(--overlay-text-primary)',
};

const filePathRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 8,
  border: '1px solid var(--overlay-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  background: 'var(--overlay-workbench-settings-badge-bg)',
  padding: '7px 8px',
};

const filePathTextStyle = {
  color: 'var(--overlay-text-primary)',
  fontFamily: 'var(--overlay-font-mono)',
  fontSize: 11,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const toastStackStyle = {
  display: 'grid',
  gap: 8,
  position: 'relative',
};

const footerStyle = {
  borderTop: '1px solid var(--overlay-border)',
  paddingTop: 10,
};

const eyebrowStyle = {
  color: 'var(--overlay-accent)',
  fontSize: 10,
  fontWeight: 850,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};

const panelTitleStyle = {
  color: 'var(--overlay-text-primary)',
  fontSize: 16,
  fontWeight: 850,
  lineHeight: 1.1,
};

const cardTitleStyle = {
  color: 'var(--overlay-text-primary)',
  fontSize: 13,
  fontWeight: 850,
  lineHeight: 1.15,
};

const mutedTextStyle = {
  color: 'var(--overlay-text-muted)',
  fontSize: 11,
  lineHeight: 1.35,
};

const noticeTitleStyle = {
  color: 'var(--overlay-text-primary)',
  fontSize: 12,
  fontWeight: 850,
};

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 22,
  borderRadius: 999,
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-workbench-settings-badge-bg)',
  color: 'var(--overlay-text-secondary)',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.06em',
  padding: '3px 8px',
  textTransform: 'uppercase',
};

const activePillStyle = {
  ...pillStyle,
  borderColor: 'var(--overlay-accent)',
  color: 'var(--overlay-text-primary)',
  background: 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)',
};

function toneColor(tone) {
  if (tone === 'success') {
    return 'var(--overlay-success, #4ade80)';
  }
  if (tone === 'warning') {
    return 'var(--overlay-warning, #facc15)';
  }
  if (tone === 'danger') {
    return 'var(--overlay-danger, #fb7185)';
  }
  return 'var(--overlay-accent)';
}

function badgeStyleForTone(tone) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    border: `1px solid color-mix(in srgb, ${toneColor(tone)} 50%, transparent)`,
    background: `color-mix(in srgb, ${toneColor(tone)} 15%, transparent)`,
    color: tone === 'neutral' ? 'var(--overlay-text-secondary)' : 'var(--overlay-text-primary)',
    fontSize: 10,
    fontWeight: 850,
    letterSpacing: '0.06em',
    lineHeight: 1,
    padding: '4px 7px',
    textTransform: 'uppercase',
  };
}

function tagStyleForTone(tone) {
  return {
    ...badgeStyleForTone(tone),
    borderRadius: 'var(--overlay-explorer-control-radius)',
    textTransform: 'none',
    letterSpacing: 0,
  };
}

function noticeStyleForTone(tone) {
  return {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 10,
    alignItems: 'center',
    minWidth: 0,
    border: `1px solid color-mix(in srgb, ${toneColor(tone)} 45%, var(--overlay-border))`,
    borderRadius: 'var(--overlay-explorer-control-radius)',
    background: `color-mix(in srgb, ${toneColor(tone)} 10%, var(--overlay-bg-panel))`,
    padding: 10,
  };
}
