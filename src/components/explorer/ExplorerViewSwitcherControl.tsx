import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useMenu, useMenuItem } from "react-aria";
import { Item, useTreeState, type TreeState } from "react-stately";

import { ChevronDown } from "@/components/AppIcons";

import type { ExplorerChromeSizeVariant } from "../../config/explorerChromeLayouts";
import { resolveExplorerChromeControlMetrics } from "../../config/explorerChromeControlMetrics";
import { ExplorerFloatingSurface } from "./ExplorerFloatingSurface";
import { ExplorerPopupSurface } from "./ExplorerPopupSurface";

export interface ExplorerViewSwitcherOption {
  id: string;
  label: string;
  description?: string;
  active: boolean;
  icon?: ReactNode;
  onSelect: () => void;
}

export interface ExplorerViewSwitcherOptionGroup {
  id: string;
  label?: string;
  options: ExplorerViewSwitcherOption[];
}

export interface ExplorerViewSwitcherButtonDescriptor {
  ariaLabel: string;
  title: string;
  label: string;
  shortLabel?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ExplorerViewSwitcherTransientHud {
  visible: boolean;
  label: string;
  valueLabel?: string | null;
  progressPercent?: number | null;
  testId?: string;
}

interface ExplorerViewSwitcherControlProps {
  variant: "mode-only" | "mode-and-density";
  sizeVariant?: ExplorerChromeSizeVariant;
  accent: string;
  text: string;
  muted: string;
  muted2: string;
  modeButton: ExplorerViewSwitcherButtonDescriptor;
  modeGroups: ExplorerViewSwitcherOptionGroup[];
  modeMenuAriaLabel: string;
  densityButton?: ExplorerViewSwitcherButtonDescriptor | null;
  densityGroups?: ExplorerViewSwitcherOptionGroup[] | null;
  densityMenuAriaLabel?: string;
  transientHud?: ExplorerViewSwitcherTransientHud | null;
  groupAriaLabel?: string;
  modeMenuOpenRequestKey?: number;
}

function hasExplorerViewSwitcherOptions(
  groups: readonly ExplorerViewSwitcherOptionGroup[] | null | undefined,
): boolean {
  return Boolean(
    groups?.some((group) => group.options.some((option) => option != null)),
  );
}

function ExplorerViewSwitcherMenuOptionButton({
  option,
  state,
  accent,
  text,
  muted,
}: {
  option: ExplorerViewSwitcherOption;
  state: TreeState<ExplorerViewSwitcherOption>;
  accent: string;
  text: string;
  muted: string;
}) {
  const itemRef = useRef<HTMLButtonElement | null>(null);
  const {
    menuItemProps,
    labelProps,
    isFocused,
    isSelected,
  } = useMenuItem(
    { key: option.id },
    state,
    itemRef,
  );
  const isActive = isFocused || option.active || isSelected;

  return (
    <button
      {...menuItemProps}
      ref={itemRef}
      type="button"
      title={
        option.description
          ? `${option.label}: ${option.description}`
          : option.label
      }
      style={{
        display: "grid",
        gridTemplateColumns: "16px minmax(0, 1fr)",
        gap: 7,
        alignItems: "center",
        width: "100%",
        border: "none",
        borderRadius: 8,
        padding: "5px 8px",
        background: isActive
          ? "var(--overlay-explorer-chip-active-bg)"
          : "transparent",
        color: isActive ? text : muted,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: option.active ? accent : muted,
        }}
      >
        {option.icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          {...labelProps}
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 11,
            fontWeight: 700,
            color: text,
          }}
        >
          {option.label}
        </span>
      </span>
    </button>
  );
}

function ExplorerViewSwitcherMenuPanel({
  groups,
  ariaLabel,
  accent,
  text,
  muted,
  muted2,
  onClose,
}: {
  groups: readonly ExplorerViewSwitcherOptionGroup[];
  ariaLabel: string;
  accent: string;
  text: string;
  muted: string;
  muted2: string;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const options = useMemo(
    () => groups.flatMap((group) => group.options),
    [groups],
  );
  const optionById = useMemo(
    () => new Map(options.map((option) => [option.id, option] as const)),
    [options],
  );
  const activeOptionId = options.find((option) => option.active)?.id ?? null;
  const menuState = useTreeState<ExplorerViewSwitcherOption>({
    items: options,
    selectionMode: "single",
    selectedKeys: activeOptionId ? [activeOptionId] : [],
    children: (option) => (
      <Item key={option.id} textValue={option.label}>
        {option.label}
      </Item>
    ),
  });
  const { menuProps } = useMenu<ExplorerViewSwitcherOption>({
    "aria-label": ariaLabel,
    autoFocus: "first",
    shouldFocusWrap: true,
    escapeKeyBehavior: "none",
    onAction: (key) => {
      const option = optionById.get(String(key));
      if (!option) {
        return;
      }
      option.onSelect();
      onClose();
    },
    onClose,
  }, menuState, menuRef);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      menuRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      {...menuProps}
      ref={menuRef}
      style={{
        display: "grid",
        gap: 5,
        outline: "none",
        background: "var(--overlay-explorer-popup-bg)",
      }}
    >
      {groups.map((group) => {
        if (group.options.length === 0) {
          return null;
        }
        return (
          <div key={group.id} style={{ display: "grid", gap: 2 }}>
            {group.label ? (
              <div
                style={{
                  padding: "2px 8px 1px",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: muted2,
                }}
              >
                {group.label}
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 2 }}>
              {group.options.map((option) => (
                <ExplorerViewSwitcherMenuOptionButton
                  key={option.id}
                  option={option}
                  state={menuState}
                  accent={accent}
                  text={text}
                  muted={muted}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ExplorerViewSwitcherControl({
  variant,
  sizeVariant = "regular",
  accent,
  text,
  muted,
  muted2,
  modeButton,
  modeGroups,
  modeMenuAriaLabel,
  densityButton = null,
  densityGroups = null,
  densityMenuAriaLabel = "Explorer density menu",
  transientHud = null,
  groupAriaLabel,
  modeMenuOpenRequestKey,
}: ExplorerViewSwitcherControlProps) {
  const metrics = resolveExplorerChromeControlMetrics(sizeVariant);
  const sanitizedId = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const modeAnchorRef = useRef<HTMLButtonElement | null>(null);
  const densityAnchorRef = useRef<HTMLButtonElement | null>(null);
  const lastModeMenuOpenRequestKeyRef = useRef(modeMenuOpenRequestKey);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [densityMenuOpen, setDensityMenuOpen] = useState(false);
  const menuSide = variant === "mode-and-density" ? "top" : "bottom";
  const viewSwitcherMenuMaxWidth = "min(15rem, calc(100vw - 1rem))";
  const viewSwitcherMenuMaxHeight = "min(24rem, calc(100vh - 1rem))";
  const modeMenuMinWidth = variant === "mode-and-density" ? 212 : 220;
  const densityMenuMinWidth = variant === "mode-and-density" ? 184 : 208;
  const modeSurfaceGroup = `explorer-view-switcher-mode-${sanitizedId}`;
  const densitySurfaceGroup = `explorer-view-switcher-density-${sanitizedId}`;
  const showsDensityButton =
    variant === "mode-and-density" &&
    densityButton != null &&
    hasExplorerViewSwitcherOptions(densityGroups);

  useEffect(() => {
    if (modeMenuOpenRequestKey == null) {
      return;
    }
    if (lastModeMenuOpenRequestKeyRef.current === modeMenuOpenRequestKey) {
      return;
    }
    lastModeMenuOpenRequestKeyRef.current = modeMenuOpenRequestKey;
    setDensityMenuOpen(false);
    setModeMenuOpen(true);
    modeAnchorRef.current?.focus();
  }, [modeMenuOpenRequestKey]);

  useEffect(() => {
    if (!modeMenuOpen && !densityMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const targetElement =
        event.target instanceof Element ? event.target : null;
      const targetNode = event.target instanceof Node ? event.target : null;
      if (
        (targetNode && rootRef.current?.contains(targetNode)) ||
        targetElement?.closest(
          `[data-overlay-explorer-floating-surface-group="${modeSurfaceGroup}"]`,
        ) ||
        targetElement?.closest(
          `[data-overlay-explorer-floating-surface-group="${densitySurfaceGroup}"]`,
        )
      ) {
        return;
      }
      setModeMenuOpen(false);
      setDensityMenuOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [densityMenuOpen, densitySurfaceGroup, modeMenuOpen, modeSurfaceGroup]);

  useEffect(() => {
    if (!showsDensityButton && densityMenuOpen) {
      setDensityMenuOpen(false);
    }
  }, [densityMenuOpen, showsDensityButton]);

  const triggerLabelStyle = useMemo<CSSProperties>(
    () => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: metrics.fontSize,
      fontWeight: 800,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    }),
    [metrics.fontSize],
  );

  const standaloneTriggerStyle = useMemo<CSSProperties>(
    () => ({
      display: "inline-flex",
      alignItems: "center",
      gap: metrics.gap,
      minWidth: 0,
      minHeight: metrics.minHeight,
      padding: `${metrics.blockPadding}px ${metrics.inlinePadding}px`,
      borderRadius: "var(--overlay-explorer-control-radius)",
      border: "1px solid var(--overlay-explorer-chip-border)",
      background: "var(--overlay-explorer-chip-bg)",
      color: muted,
      cursor: modeButton.disabled ? "default" : "pointer",
      transition:
        "background 0.14s ease, border-color 0.14s ease, color 0.14s ease",
    }),
    [
      metrics.blockPadding,
      metrics.gap,
      metrics.inlinePadding,
      metrics.minHeight,
      modeButton.disabled,
      muted,
    ],
  );

  const clusterHostStyle = useMemo<CSSProperties>(
    () => ({
      display: "inline-flex",
      alignItems: "center",
      gap: Math.max(metrics.gap - 2, 3),
      padding: metrics.blockPadding,
      borderRadius: 999,
      border: "1px solid var(--overlay-explorer-chip-border)",
      background: "rgba(255,255,255,0.03)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    }),
    [metrics.blockPadding, metrics.gap],
  );

  const buildClusterTriggerStyle = (active: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: Math.max(metrics.gap - 1, 4),
    minWidth: 0,
    minHeight: Math.max(metrics.minHeight - 4, 22),
    padding: `0 ${Math.max(metrics.inlinePadding - 1, 6)}px`,
    borderRadius: 999,
    border: `1px solid ${
      active ? `${accent}55` : "transparent"
    }`,
    background: active
      ? "var(--overlay-explorer-chip-active-bg)"
      : "transparent",
    color: active ? text : muted,
    cursor: "pointer",
    transition:
      "background 0.14s ease, border-color 0.14s ease, color 0.14s ease",
  });

  const renderTriggerLabel = (
    descriptor: ExplorerViewSwitcherButtonDescriptor,
  ): ReactNode => {
    const triggerLabel =
      variant === "mode-and-density"
        ? descriptor.label
        : descriptor.shortLabel ?? descriptor.label;
    return <span style={triggerLabelStyle}>{triggerLabel}</span>;
  };
  return (
    <div
      ref={rootRef}
      role={variant === "mode-and-density" ? "group" : undefined}
      aria-label={variant === "mode-and-density" ? groupAriaLabel : undefined}
      style={
        variant === "mode-and-density"
          ? clusterHostStyle
          : { position: "relative" }
      }
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={modeAnchorRef}
        type="button"
        aria-label={modeButton.ariaLabel}
        aria-haspopup="menu"
        aria-expanded={modeMenuOpen}
        title={modeButton.title}
        disabled={modeButton.disabled}
        onClick={() => {
          if (modeButton.disabled) {
            return;
          }
          setDensityMenuOpen(false);
          setModeMenuOpen((current) => !current);
        }}
        style={
          variant === "mode-and-density"
            ? buildClusterTriggerStyle(modeMenuOpen)
            : {
                ...standaloneTriggerStyle,
                color: modeMenuOpen ? text : standaloneTriggerStyle.color,
                background: modeMenuOpen
                  ? "var(--overlay-explorer-chip-active-bg)"
                  : standaloneTriggerStyle.background,
                borderColor: modeMenuOpen
                  ? "var(--overlay-explorer-chip-active-border)"
                  : "var(--overlay-explorer-chip-border)",
              }
        }
      >
        {modeButton.icon ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: modeMenuOpen ? accent : "currentColor",
            }}
          >
            {modeButton.icon}
          </span>
        ) : null}
        {renderTriggerLabel(modeButton)}
        <ChevronDown size={Math.max(metrics.iconSize - 1, 11)} />
      </button>

      <ExplorerPopupSurface
        anchorRef={modeAnchorRef}
        open={modeMenuOpen}
        side={menuSide}
        align="end"
        surfaceGroup={modeSurfaceGroup}
        minWidth={modeMenuMinWidth}
        maxWidth={viewSwitcherMenuMaxWidth}
        maxHeight={viewSwitcherMenuMaxHeight}
        padding={6}
      >
        <ExplorerViewSwitcherMenuPanel
          groups={modeGroups}
          ariaLabel={modeMenuAriaLabel}
          accent={accent}
          text={text}
          muted={muted}
          muted2={muted2}
          onClose={() => setModeMenuOpen(false)}
        />
      </ExplorerPopupSurface>

      {showsDensityButton && densityButton ? (
        <>
          <button
            ref={densityAnchorRef}
            type="button"
            aria-label={densityButton.ariaLabel}
            aria-haspopup="menu"
            aria-expanded={densityMenuOpen}
            title={densityButton.title}
            disabled={densityButton.disabled}
            onClick={() => {
              if (densityButton.disabled) {
                return;
              }
              setModeMenuOpen(false);
              setDensityMenuOpen((current) => !current);
            }}
            style={buildClusterTriggerStyle(densityMenuOpen)}
          >
            {densityButton.icon ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: densityMenuOpen ? accent : "currentColor",
                }}
              >
                {densityButton.icon}
              </span>
            ) : null}
            {renderTriggerLabel(densityButton)}
            <ChevronDown size={Math.max(metrics.iconSize - 1, 11)} />
          </button>

          <ExplorerPopupSurface
            anchorRef={densityAnchorRef}
            open={densityMenuOpen}
            side={menuSide}
            align="end"
            surfaceGroup={densitySurfaceGroup}
            minWidth={densityMenuMinWidth}
            maxWidth={viewSwitcherMenuMaxWidth}
            maxHeight={viewSwitcherMenuMaxHeight}
            padding={6}
          >
            <ExplorerViewSwitcherMenuPanel
              groups={densityGroups ?? []}
              ariaLabel={densityMenuAriaLabel}
              accent={accent}
              text={text}
              muted={muted}
              muted2={muted2}
              onClose={() => setDensityMenuOpen(false)}
            />
          </ExplorerPopupSurface>

          {transientHud?.visible ? (
            <ExplorerFloatingSurface
              anchorRef={densityAnchorRef}
              open
              side={menuSide}
              align="end"
              surfaceGroup={`${densitySurfaceGroup}-hud`}
              zIndexCssVar="--overlay-explorer-floating-hud-layer"
              zIndexFallback={9996}
              data-testid={transientHud.testId}
              style={{
                minWidth: 164,
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${accent}55`,
                background: "var(--overlay-explorer-popup-bg)",
                boxShadow: "var(--overlay-explorer-popup-shadow)",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: text,
                  }}
                >
                  {transientHud.label}
                </span>
                {transientHud.valueLabel ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: accent,
                    }}
                  >
                    {transientHud.valueLabel}
                  </span>
                ) : null}
              </div>
              {transientHud.progressPercent != null ? (
                <div
                  style={{
                    marginTop: 8,
                    height: 5,
                    borderRadius: 999,
                    background: "var(--overlay-explorer-popup-item-hover-bg)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${transientHud.progressPercent}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: `linear-gradient(90deg, ${accent}99, ${accent})`,
                      transition: "width 0.14s ease",
                    }}
                  />
                </div>
              ) : null}
            </ExplorerFloatingSurface>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
