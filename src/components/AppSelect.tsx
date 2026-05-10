import {
  Children,
  isValidElement,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import {
  DismissButton,
  FocusScope,
  HiddenSelect,
  mergeProps,
  OverlayContainer,
  useButton,
  useListBox,
  useOption,
  useOverlay,
  useOverlayPosition,
  useSelect,
} from "react-aria";
import {
  Item,
  useSelectState,
  type Node,
  type SelectState,
} from "react-stately";

import { Check, ChevronDown } from "./AppIcons";

export interface AppSelectOptionDefinition {
  value: string;
  label: string;
  disabled?: boolean;
  style?: CSSProperties;
}

type NativeSelectCompatProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children" | "className" | "defaultValue" | "multiple" | "onChange" | "size" | "style" | "value"
>;

export interface AppSelectProps extends NativeSelectCompatProps {
  children?: ReactNode;
  className?: string;
  defaultValue?: string | number | readonly string[];
  menuStyle?: CSSProperties;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  onValueChange?: (value: string) => void;
  options?: AppSelectOptionDefinition[];
  optionStyle?: CSSProperties;
  size?: number;
  style?: CSSProperties;
  value?: string | number | readonly string[];
}

function stringifySelectValue(value: string | number | readonly string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0] != null ? String(value[0]) : undefined;
  }
  return value != null ? String(value) : undefined;
}

function extractTextValue(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      return "";
    })
    .join("")
    .trim();
}

function isOptionElement(
  child: ReactNode,
): child is ReactElement<{
  children?: ReactNode;
  disabled?: boolean;
  label?: string;
  style?: CSSProperties;
  value?: string | number;
}> {
  return isValidElement(child) && child.type === "option";
}

function isOptGroupElement(
  child: ReactNode,
): child is ReactElement<{ children?: ReactNode }> {
  return isValidElement(child) && child.type === "optgroup";
}

function optionElementToDefinition(child: ReturnType<typeof Children.toArray>[number]): AppSelectOptionDefinition | null {
  if (!isOptionElement(child)) {
    return null;
  }

  const childLabel = extractTextValue(child.props.children);
  const value = child.props.value != null ? String(child.props.value) : childLabel;
  return {
    value,
    label: typeof child.props.label === "string" ? child.props.label : childLabel || value,
    disabled: child.props.disabled === true,
    style: child.props.style,
  };
}

function optionChildrenToDefinitions(children: ReactNode): AppSelectOptionDefinition[] {
  const options: AppSelectOptionDefinition[] = [];

  for (const child of Children.toArray(children)) {
    if (isOptionElement(child)) {
      const option = optionElementToDefinition(child);
      if (option) {
        options.push(option);
      }
      continue;
    }

    if (isOptGroupElement(child)) {
      options.push(...optionChildrenToDefinitions(child.props.children));
    }
  }

  return options;
}

function normalizeSelectOptions(
  options: AppSelectOptionDefinition[] | undefined,
  children: ReactNode,
): AppSelectOptionDefinition[] {
  const sourceOptions = options ?? optionChildrenToDefinitions(children);
  const usedValues = new Set<string>();

  return sourceOptions.map((option, index) => {
    const baseValue = String(option.value);
    const value = usedValues.has(baseValue) ? `${baseValue}__duplicate_${index}` : baseValue;
    usedValues.add(value);
    return {
      ...option,
      value,
      label: option.label || baseValue,
    };
  });
}

function createSelectChangeEvent(value: string): ChangeEvent<HTMLSelectElement> {
  const target = { value } as HTMLSelectElement;
  return {
    target,
    currentTarget: target,
  } as ChangeEvent<HTMLSelectElement>;
}

function textPreviewStyle(style: CSSProperties | undefined): CSSProperties | undefined {
  if (!style) {
    return undefined;
  }

  const nextStyle: CSSProperties = {};
  if (style.fontFamily) {
    nextStyle.fontFamily = style.fontFamily;
  }
  if (style.fontStyle) {
    nextStyle.fontStyle = style.fontStyle;
  }
  if (style.fontWeight) {
    nextStyle.fontWeight = style.fontWeight;
  }
  if (style.textTransform) {
    nextStyle.textTransform = style.textTransform;
  }
  return Object.keys(nextStyle).length > 0 ? nextStyle : undefined;
}

function AppSelectOptionRow({
  item,
  option,
  optionStyle,
  state,
}: {
  item: Node<AppSelectOptionDefinition>;
  option: AppSelectOptionDefinition;
  optionStyle?: CSSProperties;
  state: SelectState<AppSelectOptionDefinition>;
}) {
  const optionRef = useRef<HTMLLIElement | null>(null);
  const { optionProps, labelProps, isDisabled, isFocused, isSelected } = useOption(
    { key: item.key },
    state,
    optionRef,
  );
  const previewStyle = textPreviewStyle(option.style);

  return (
    <li
      {...optionProps}
      ref={optionRef}
      data-gfs-app-select-option={option.value}
      data-gfs-app-select-focused={isFocused ? "true" : "false"}
      data-gfs-app-select-selected={isSelected ? "true" : "false"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--overlay-workbench-control-gap)",
        minHeight: "var(--overlay-workbench-chrome-control-height)",
        padding: "0 var(--overlay-workbench-control-padding-x)",
        borderRadius: "var(--overlay-workbench-control-radius)",
        outline: "none",
        listStyle: "none",
        cursor: isDisabled ? "default" : "pointer",
        color: isDisabled
          ? "var(--overlay-text-dim)"
          : "var(--overlay-text-primary)",
        background: isFocused
          ? "var(--overlay-workbench-command-palette-item-active-bg, var(--overlay-workbench-chrome-button-active-bg))"
          : isSelected
            ? "var(--overlay-workbench-chrome-button-active-bg)"
            : "transparent",
        ...optionStyle,
      }}
    >
      <span
        {...labelProps}
        style={{
          minWidth: 0,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          ...previewStyle,
        }}
      >
        {option.label}
      </span>
      {isSelected ? (
        <Check
          size={12}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: "var(--overlay-accent, currentColor)",
          }}
        />
      ) : null}
    </li>
  );
}

export function AppSelect({
  children,
  className = "",
  defaultValue,
  disabled,
  menuStyle,
  onChange,
  onValueChange,
  options,
  optionStyle,
  size: _size,
  style,
  value,
  ...selectProps
}: AppSelectProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listBoxRef = useRef<HTMLUListElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);
  const [portalContainer, setPortalContainer] = useState<Element | null>(null);
  const normalizedOptions = useMemo(
    () => normalizeSelectOptions(options, children),
    [children, options],
  );
  const optionByValue = useMemo(
    () => new Map(normalizedOptions.map((option) => [option.value, option] as const)),
    [normalizedOptions],
  );
  const selectedKey = stringifySelectValue(value);
  const defaultSelectedKey = stringifySelectValue(defaultValue);
  const disabledKeys = useMemo(
    () => normalizedOptions.filter((option) => option.disabled).map((option) => option.value),
    [normalizedOptions],
  );
  const passthroughButtonProps = useMemo(
    () => Object.fromEntries(
      Object.entries(selectProps).filter(([key]) => key.startsWith("data-")),
    ) as Record<string, unknown>,
    [selectProps],
  );
  const state = useSelectState<AppSelectOptionDefinition>({
    items: normalizedOptions,
    children: (item) => (
      <Item key={item.value} textValue={item.label}>
        {item.label}
      </Item>
    ),
    selectedKey,
    defaultSelectedKey,
    disabledKeys,
    isDisabled: disabled,
    onSelectionChange: (key) => {
      if (key == null) {
        return;
      }
      const nextValue = String(key);
      onValueChange?.(nextValue);
      onChange?.(createSelectChangeEvent(nextValue));
    },
  });
  const {
    triggerProps,
    valueProps,
    menuProps,
    hiddenSelectProps,
  } = useSelect<AppSelectOptionDefinition>(
    {
      id: selectProps.id,
      name: selectProps.name,
      form: selectProps.form,
      autoComplete: selectProps.autoComplete,
      "aria-label": selectProps["aria-label"],
      "aria-labelledby": selectProps["aria-labelledby"],
      "aria-describedby": selectProps["aria-describedby"],
      isDisabled: disabled,
      isRequired: selectProps.required,
      selectedKey,
      defaultSelectedKey,
      disabledKeys,
    },
    state,
    triggerRef,
  );
  const { buttonProps } = useButton(triggerProps, triggerRef);
  const { overlayProps } = useOverlay(
    {
      isOpen: state.isOpen,
      isDismissable: true,
      shouldCloseOnBlur: true,
      onClose: () => state.close(),
    },
    popoverRef,
  );
  const { overlayProps: positionProps } = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef: popoverRef,
    scrollRef: listBoxRef,
    isOpen: state.isOpen,
    onClose: () => state.close(),
    placement: "bottom start",
    offset: 4,
    containerPadding: 8,
    shouldFlip: true,
  });
  const { listBoxProps } = useListBox<AppSelectOptionDefinition>(
    {
      ...menuProps,
      autoFocus: state.focusStrategy ?? true,
      shouldFocusWrap: true,
      shouldFocusOnHover: true,
    },
    state,
    listBoxRef,
  );
  const selectedOption = state.selectedKey != null
    ? optionByValue.get(String(state.selectedKey))
    : null;
  const selectedLabel = selectedOption?.label ?? normalizedOptions[0]?.label ?? "";
  const selectedPreviewStyle = textPreviewStyle(selectedOption?.style);

  useLayoutEffect(() => {
    if (!state.isOpen) {
      return;
    }

    setPortalContainer(
      triggerRef.current?.closest(".overlay-window-host")
        ?? triggerRef.current?.closest("[data-gfs-shell-scene-container]")
        ?? document.body,
    );
    setTriggerWidth(triggerRef.current?.getBoundingClientRect().width ?? null);
  }, [state.isOpen]);

  return (
    <>
      <HiddenSelect
        {...hiddenSelectProps}
        state={state}
        triggerRef={triggerRef}
      />
      <button
        {...buttonProps}
        {...passthroughButtonProps}
        ref={triggerRef}
        type="button"
        title={selectProps.title}
        className={className}
        data-gfs-app-select="trigger"
        data-gfs-app-select-open={state.isOpen ? "true" : "false"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--overlay-workbench-control-gap)",
          minWidth: 0,
          minHeight: "var(--overlay-workbench-chrome-control-height)",
          borderRadius: "var(--overlay-workbench-control-radius)",
          border: "var(--overlay-workbench-border-width, thin) solid var(--overlay-workbench-settings-badge-border, var(--overlay-border))",
          background: "var(--overlay-workbench-settings-badge-bg, var(--overlay-workbench-chrome-button-bg))",
          color: "var(--overlay-text-primary)",
          padding: "0 var(--overlay-workbench-control-padding-x)",
          font: "inherit",
          fontSize: "var(--overlay-workbench-chrome-meta-size)",
          lineHeight: 1,
          outline: "none",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          boxSizing: "border-box",
          ...style,
        }}
      >
        <span
          {...valueProps}
          style={{
            minWidth: 0,
            flex: "1 1 auto",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "left",
            ...selectedPreviewStyle,
          }}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: "var(--overlay-text-muted, currentColor)",
            transform: state.isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform var(--overlay-motion-duration-fast) var(--overlay-motion-ease-standard)",
          }}
        />
      </button>
      {state.isOpen ? (
        <OverlayContainer portalContainer={portalContainer ?? undefined}>
          <FocusScope restoreFocus>
            <div
              {...mergeProps(overlayProps, positionProps)}
              ref={popoverRef}
              data-gfs-app-select="popover"
              style={{
                ...positionProps.style,
                minWidth: triggerWidth ?? undefined,
                maxWidth: "min(26rem, calc(100vw - 1rem))",
                maxHeight: "min(22.5rem, calc(100vh - 1rem))",
                overflow: "hidden",
                borderRadius: "var(--overlay-workbench-panel-radius, var(--overlay-workbench-control-radius))",
                border: "var(--overlay-workbench-border-width, thin) solid var(--overlay-workbench-settings-card-border, var(--overlay-border))",
                background: "var(--overlay-workbench-command-palette-bg, var(--overlay-bg-panel))",
                color: "var(--overlay-text-primary)",
                fontFamily: "var(--overlay-font-ui)",
                fontSize: "var(--overlay-workbench-chrome-meta-size)",
                lineHeight: "var(--overlay-workbench-control-line-height, 1.2)",
                zIndex: "var(--overlay-z-popover, 2147483200)",
                padding: "var(--overlay-workbench-control-gap)",
                boxSizing: "border-box",
                ...menuStyle,
              }}
            >
              <DismissButton onDismiss={() => state.close()} />
              <ul
                {...listBoxProps}
                ref={listBoxRef}
                data-gfs-app-select="listbox"
                style={{
                  display: "grid",
                  gap: "var(--overlay-workbench-control-gap)",
                  maxHeight: "inherit",
                  minWidth: 0,
                  margin: 0,
                  padding: 0,
                  overflow: "auto",
                  outline: "none",
                }}
              >
                {[...state.collection].map((item) => {
                  const option = optionByValue.get(String(item.key));
                  return option ? (
                    <AppSelectOptionRow
                      key={item.key}
                      item={item}
                      option={option}
                      optionStyle={optionStyle}
                      state={state}
                    />
                  ) : null;
                })}
              </ul>
              <DismissButton onDismiss={() => state.close()} />
            </div>
          </FocusScope>
        </OverlayContainer>
      ) : null}
    </>
  );
}
