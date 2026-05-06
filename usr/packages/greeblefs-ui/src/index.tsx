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

export const greebleUiVersion = '1.0.0';

function mergeStyle(base, next) {
  return next ? { ...base, ...next } : base;
}

export function GreebleSurface({
  children,
  tone = 'panel',
  style,
  ...props
}) {
  const toneStyle = tone === 'shell'
    ? shellSurfaceStyle
    : tone === 'flat'
      ? flatSurfaceStyle
      : panelSurfaceStyle;
  return (
    <section {...props} style={mergeStyle(toneStyle, style)}>
      {children}
    </section>
  );
}

export function GreebleToolbar({
  children,
  align = 'between',
  style,
  ...props
}) {
  return (
    <div
      {...props}
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

export function GreebleSplitLayout({
  children,
  columns = 'minmax(0, 1fr) minmax(220px, 0.42fr)',
  style,
  ...props
}) {
  return (
    <div
      {...props}
      style={mergeStyle({
        display: 'grid',
        gridTemplateColumns: columns,
        gap: 12,
        minWidth: 0,
        minHeight: 0,
      }, style)}
    >
      {children}
    </div>
  );
}

export function GreebleSelect({
  children,
  style,
  ...props
}) {
  return (
    <select {...props} style={mergeStyle(selectStyle, style)}>
      {children}
    </select>
  );
}

export function GreebleTextArea({
  style,
  ...props
}) {
  return (
    <textarea {...props} style={mergeStyle(textAreaStyle, style)} />
  );
}

export function GreebleFieldLabel({
  children,
  style,
  ...props
}) {
  return (
    <label {...props} style={mergeStyle(fieldLabelStyle, style)}>
      {children}
    </label>
  );
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
    <div {...props} role="group" style={mergeStyle(segmentedControlStyle, style)}>
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

export function GreebleWorkflowShell({
  title,
  eyebrow,
  actions,
  footer,
  children,
  style,
  ...props
}) {
  return (
    <GreebleSurface {...props} style={mergeStyle(workflowShellStyle, style)}>
      {title || eyebrow || actions ? (
        <GreebleToolbar>
          <div style={{ minWidth: 0 }}>
            {eyebrow ? <div style={eyebrowStyle}>{eyebrow}</div> : null}
            {title ? <div style={workflowTitleStyle}>{title}</div> : null}
          </div>
          {actions ? <div style={toolbarActionsStyle}>{actions}</div> : null}
        </GreebleToolbar>
      ) : null}
      <div style={workflowBodyStyle}>{children}</div>
      {footer ? <div style={workflowFooterStyle}>{footer}</div> : null}
    </GreebleSurface>
  );
}

export function GreebleIconButton({
  children,
  active = false,
  style,
  ...props
}) {
  return (
    <button
      {...props}
      style={mergeStyle(active ? activeIconButtonStyle : iconButtonStyle, style)}
    >
      {children}
    </button>
  );
}

export const GreebleButton = ExplorerWorkflowButton;
export const GreebleEmptyState = ExplorerWorkflowEmptyState;
export const GreebleFieldGrid = ExplorerWorkflowFieldGrid;
export const GreebleInput = ExplorerWorkflowInput;
export const GreebleTextField = ExplorerWorkflowInput;
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

const flatSurfaceStyle = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  minHeight: 0,
  color: 'var(--overlay-text-primary)',
};

const selectStyle = {
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
  ...selectStyle,
  minHeight: 96,
  resize: 'vertical',
  lineHeight: 1.45,
  fontFamily: 'var(--overlay-font-mono)',
};

const fieldLabelStyle = {
  color: 'var(--overlay-text-secondary)',
  display: 'grid',
  gap: 6,
  fontSize: 11,
  fontWeight: 750,
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

const workflowShellStyle = {
  padding: 12,
};

const eyebrowStyle = {
  color: 'var(--overlay-accent)',
  fontSize: 10,
  fontWeight: 850,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};

const workflowTitleStyle = {
  color: 'var(--overlay-text-primary)',
  fontSize: 16,
  fontWeight: 800,
  lineHeight: 1.1,
};

const toolbarActionsStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const workflowBodyStyle = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  minHeight: 0,
};

const workflowFooterStyle = {
  borderTop: '1px solid var(--overlay-border)',
  paddingTop: 10,
};
