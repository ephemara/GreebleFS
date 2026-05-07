import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  DismissButton,
  FocusScope,
  OverlayContainer,
  useDialog,
  useModalOverlay,
} from 'react-aria';
import { useOverlayTriggerState } from 'react-stately';

type AppDialogTone = 'accent' | 'danger';

interface AppDialogFrameProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  width?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
}

interface AppPromptDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  value: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  tone?: AppDialogTone;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

interface AppConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: AppDialogTone;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

interface AppModalSurfaceProps {
  children: ReactNode;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  dismissDisabled?: boolean;
  overlayStyle?: CSSProperties;
  containerStyle?: CSSProperties;
  portalContainer?: Element;
  shouldCloseOnInteractOutside?: (element: Element) => boolean;
}

export function AppModalSurface({
  children,
  onClose,
  closeOnBackdrop = true,
  closeOnEscape = true,
  dismissDisabled = false,
  overlayStyle: overlayStyleOverride,
  containerStyle,
  portalContainer,
  shouldCloseOnInteractOutside,
}: AppModalSurfaceProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const state = useOverlayTriggerState({
    defaultOpen: true,
    onOpenChange: (nextOpen) => {
      if (!nextOpen) {
        onClose?.();
      }
    },
  });
  const { modalProps, underlayProps } = useModalOverlay({
    isDismissable: closeOnBackdrop && !dismissDisabled,
    isKeyboardDismissDisabled: dismissDisabled || !closeOnEscape,
    shouldCloseOnInteractOutside,
  }, state, panelRef);

  if (!state.isOpen) {
    return null;
  }

  return (
    <OverlayContainer portalContainer={portalContainer}>
      <div
        {...underlayProps}
        style={{
          ...overlayStyle,
          ...overlayStyleOverride,
        }}
      >
        <FocusScope contain restoreFocus autoFocus>
          <div
            {...modalProps}
            ref={panelRef}
            style={{
              outline: 'none',
              minWidth: 0,
              ...containerStyle,
            }}
          >
            {!dismissDisabled ? <DismissButton onDismiss={state.close} /> : null}
            {children}
            {!dismissDisabled ? <DismissButton onDismiss={state.close} /> : null}
          </div>
        </FocusScope>
      </div>
    </OverlayContainer>
  );
}

export function AppDialogFrame({
  title,
  description,
  icon,
  children,
  actions,
  width = 420,
  maxWidth = 'min(92vw, 560px)',
  maxHeight = 'calc(100vh - 40px)',
  onClose,
  closeOnBackdrop = true,
}: AppDialogFrameProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({
    role: 'dialog',
    'aria-labelledby': titleId,
    'aria-describedby': description ? descriptionId : undefined,
  }, dialogRef);
  const resolvedWidth = typeof width === 'number' ? `${width}px` : width;
  const resolvedMaxWidth = typeof maxWidth === 'number'
    ? `min(92vw, ${maxWidth}px)`
    : maxWidth;
  const resolvedMaxHeight = typeof maxHeight === 'number'
    ? `min(calc(100vh - 40px), ${maxHeight}px)`
    : maxHeight;

  return (
    <AppModalSurface onClose={onClose} closeOnBackdrop={closeOnBackdrop}>
      <div
        {...dialogProps}
        ref={dialogRef}
        style={{
          ...panelStyle,
          width: resolvedWidth,
          maxWidth: resolvedMaxWidth,
          maxHeight: resolvedMaxHeight,
        }}
      >
        <div style={headerStyle}>
          {icon ? <div style={iconWrapStyle}>{icon}</div> : null}
          <div style={{ minWidth: 0 }}>
            <div {...titleProps} id={titleId} style={titleStyle}>{title}</div>
            {description ? (
              <div id={descriptionId} style={descriptionStyle}>{description}</div>
            ) : null}
          </div>
        </div>
        {children ? <div style={{ marginTop: 16 }}>{children}</div> : null}
        {actions ? <div style={actionsStyle}>{actions}</div> : null}
      </div>
    </AppModalSurface>
  );
}

export function AppPromptDialog({
  open,
  title,
  description,
  icon,
  value,
  placeholder,
  submitLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'accent',
  onChange,
  onSubmit,
  onCancel,
}: AppPromptDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <AppDialogFrame
      title={title}
      description={description}
      icon={icon}
      onClose={onCancel}
      actions={(
        <>
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onSubmit} style={getToneButtonStyle(tone)}>
            {submitLabel}
          </button>
        </>
      )}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => handlePromptKeyDown(event, onSubmit, onCancel)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </AppDialogFrame>
  );
}

export function AppConfirmDialog({
  open,
  title,
  description,
  icon,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'accent',
  onConfirm,
  onCancel,
  children,
}: AppConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmButtonRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <AppDialogFrame
      title={title}
      description={description}
      icon={icon}
      onClose={onCancel}
      actions={(
        <>
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
              }
            }}
            style={getToneButtonStyle(tone)}
          >
            {confirmLabel}
          </button>
        </>
      )}
    >
      {children}
    </AppDialogFrame>
  );
}

function handlePromptKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  onSubmit: () => void,
  onCancel: () => void,
) {
  if (event.key === 'Enter') {
    event.preventDefault();
    onSubmit();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    onCancel();
  }
}

function getToneButtonStyle(tone: AppDialogTone): CSSProperties {
  if (tone === 'danger') {
    return dangerButtonStyle;
  }
  return primaryButtonStyle;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'clamp(12px, 2vw, 20px)',
  background: 'var(--overlay-explorer-modal-scrim, var(--overlay-bg-scrim))',
};

const panelStyle: CSSProperties = {
  borderRadius: 'var(--overlay-explorer-panel-radius, 18px)',
  border: '1px solid var(--overlay-explorer-preview-border, var(--overlay-border))',
  background: 'var(--overlay-explorer-preview-bg, var(--overlay-bg-panel))',
  color: 'var(--overlay-text-primary)',
  boxShadow: 'var(--overlay-explorer-modal-shadow, var(--overlay-shadow))',
  padding: 'clamp(16px, 1.8vw, 20px)',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
};

const iconWrapStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: 'var(--overlay-accent)',
  marginTop: 1,
};

const titleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--overlay-text-primary)',
};

const descriptionStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 1.55,
  color: 'var(--overlay-text-muted)',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 18,
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 'var(--overlay-explorer-control-radius, 10px)',
  border: '1px solid var(--overlay-explorer-input-border, var(--overlay-border))',
  background: 'var(--overlay-explorer-input-bg, rgba(255,255,255,0.04))',
  color: 'var(--overlay-text-primary)',
  outline: 'none',
  padding: '9px 11px',
  fontSize: 12,
};

const secondaryButtonStyle: CSSProperties = {
  background: 'var(--overlay-explorer-chip-bg, rgba(255,255,255,0.04))',
  border: '1px solid var(--overlay-explorer-chip-border, var(--overlay-border))',
  borderRadius: 'var(--overlay-explorer-control-radius, 10px)',
  color: 'var(--overlay-text-primary)',
  padding: '7px 14px',
  fontSize: 12,
  cursor: 'pointer',
};

const primaryButtonStyle: CSSProperties = {
  background: 'var(--overlay-explorer-chip-active-bg, rgba(255,255,255,0.12))',
  border: '1px solid var(--overlay-explorer-chip-active-border, var(--overlay-accent))',
  borderRadius: 'var(--overlay-explorer-control-radius, 10px)',
  color: 'var(--overlay-explorer-chip-active-text, var(--overlay-text-primary))',
  padding: '7px 14px',
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 600,
};

const dangerButtonStyle: CSSProperties = {
  background: 'var(--overlay-explorer-danger-soft-bg, rgba(248,113,113,0.12))',
  border: '1px solid var(--overlay-explorer-danger-soft-border, rgba(248,113,113,0.28))',
  borderRadius: 'var(--overlay-explorer-control-radius, 10px)',
  color: 'var(--overlay-danger, #f87171)',
  padding: '7px 14px',
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 600,
};
