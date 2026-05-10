import React from 'react';

function mergeStyle(base, next) {
  return next ? { ...base, ...next } : base;
}

function textFromChildren(children) {
  return React.Children.toArray(children).map(child => (
    typeof child === 'string' || typeof child === 'number' ? String(child) : ''
  )).join('').trim();
}

function optionsFromSelectChildren(children) {
  const output = [];
  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return;
    if (child.type === 'option') {
      const label = child.props.label ?? textFromChildren(child.props.children);
      const value = child.props.value != null ? String(child.props.value) : String(label);
      output.push({
        value,
        label: String(label || value),
        disabled: child.props.disabled === true,
      });
      return;
    }
    if (child.type === 'optgroup') {
      output.push(...optionsFromSelectChildren(child.props.children));
    }
  });
  return output;
}

function createSelectChangeEvent(value) {
  const target = { value };
  return { target, currentTarget: target };
}

export function GreebleSelect({ children, style, wrapperStyle, onChange, value, defaultValue, disabled, ...props }) {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(defaultValue != null ? String(defaultValue) : '');
  const options = React.useMemo(() => optionsFromSelectChildren(children), [children]);
  const selectedValue = value != null ? String(value) : internalValue || options[0]?.value || '';
  const selectedOption = options.find(option => option.value === selectedValue) ?? options[0] ?? null;
  const commitValue = nextValue => {
    setInternalValue(nextValue);
    onChange?.(createSelectChangeEvent(nextValue));
    setOpen(false);
  };

  return (
    <span
      data-greeble-ui="select"
      style={mergeStyle(selectShellStyle, wrapperStyle)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        {...props}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={event => {
          props.onClick?.(event);
          if (!disabled) setOpen(current => !current);
        }}
        style={mergeStyle(selectTriggerStyle, style)}
      >
        <span style={selectValueStyle}>{selectedOption?.label ?? ''}</span>
        <span aria-hidden="true" style={selectChevronStyle}>v</span>
      </button>
      {open ? (
        <span role="listbox" style={selectPopoverStyle}>
          {options.map(option => {
            const active = option.value === selectedValue;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                disabled={option.disabled}
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  if (!option.disabled) commitValue(option.value);
                }}
                style={active ? selectOptionActiveStyle : selectOptionStyle}
              >
                {option.label}
              </button>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--overlay-explorer-input-bg)',
  border: '1px solid var(--overlay-explorer-input-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  color: 'var(--overlay-text-primary)',
  fontSize: 'var(--overlay-workbench-chrome-meta-size)',
  minHeight: 'var(--overlay-workbench-chrome-control-height)',
  padding: '0 var(--overlay-workbench-control-padding-x)',
  outline: 'none',
};

const selectShellStyle = {
  display: 'inline-block',
  position: 'relative',
  width: '100%',
  minWidth: 0,
};

const selectTriggerStyle = {
  ...inputStyle,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--overlay-workbench-control-gap)',
  cursor: 'pointer',
};

const selectValueStyle = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'left',
  flex: 1,
};

const selectChevronStyle = {
  color: 'var(--overlay-text-muted)',
  flexShrink: 0,
  fontSize: 'var(--overlay-workbench-chrome-meta-size)',
  fontWeight: 900,
};

const selectPopoverStyle = {
  position: 'absolute',
  zIndex: 'var(--overlay-z-popover, 2147483000)',
  left: 0,
  top: 'calc(100% + var(--overlay-workbench-control-gap))',
  display: 'grid',
  gap: 'var(--overlay-workbench-control-gap)',
  minWidth: '100%',
  maxWidth: 'min(360px, calc(100vw - 16px))',
  maxHeight: 'min(22.5rem, calc(100vh - 1rem))',
  overflow: 'auto',
  boxSizing: 'border-box',
  padding: 'var(--overlay-workbench-control-gap)',
  border: '1px solid var(--overlay-workbench-settings-card-border, var(--overlay-border))',
  borderRadius: 'var(--overlay-workbench-panel-radius, var(--overlay-explorer-control-radius))',
  background: 'var(--overlay-workbench-command-palette-bg, var(--overlay-bg-panel))',
  color: 'var(--overlay-text-primary)',
  boxShadow: 'var(--overlay-workbench-shell-shadow, none)',
};

const selectOptionStyle = {
  width: '100%',
  minHeight: 'var(--overlay-workbench-chrome-control-height)',
  border: 0,
  borderRadius: 'var(--overlay-explorer-control-radius)',
  background: 'transparent',
  color: 'var(--overlay-text-primary)',
  cursor: 'pointer',
  fontSize: 'var(--overlay-workbench-chrome-meta-size)',
  fontWeight: 700,
  padding: '0 var(--overlay-workbench-control-padding-x)',
  textAlign: 'left',
};

const selectOptionActiveStyle = {
  ...selectOptionStyle,
  background: 'var(--overlay-workbench-chrome-button-active-bg)',
  color: 'var(--overlay-text-primary)',
};
