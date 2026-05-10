import type { CSSProperties, ReactNode } from "react";
import type { KainUiNode, KainUiSurface } from "@/runtime/kainUiScaffold";
import { AppSelect } from "../AppSelect";
import {
  SettingsActionButton,
  SettingsRow,
  SettingsRowGroup,
  SettingsSectionBlock,
  SettingsStatusPill,
} from "../settings/SettingsPrimitives";

type KainUiRendererVariant = "settings" | "applet";
type KainUiActionHandler = (actionId: string, node: KainUiNode) => void | Promise<void>;

interface KainUiRendererProps {
  surface?: KainUiSurface | null;
  node?: KainUiNode | null;
  fallback?: ReactNode;
  variant?: KainUiRendererVariant;
  onAction?: KainUiActionHandler;
  isActionEnabled?: (actionId: string, node: KainUiNode) => boolean;
}

interface KainUiNodeRendererProps {
  node: KainUiNode;
  variant: KainUiRendererVariant;
  onAction?: KainUiActionHandler;
  isActionEnabled?: KainUiRendererProps["isActionEnabled"];
}

function nodeLabel(node: KainUiNode): string {
  return node.label ?? node.text ?? node.title ?? node.id;
}

function stringProp(node: KainUiNode, key: string, fallback = ""): string {
  const value = node.props[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function numberProp(node: KainUiNode, key: string, fallback: number): number {
  const value = node.props[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boolProp(node: KainUiNode, key: string, fallback = false): boolean {
  const value = node.props[key];
  return typeof value === "boolean" ? value : fallback;
}

function actionIdForNode(node: KainUiNode): string {
  return node.actionId ?? node.id;
}

function canRunAction(
  node: KainUiNode,
  onAction?: KainUiActionHandler,
  isActionEnabled?: KainUiRendererProps["isActionEnabled"],
): boolean {
  const actionId = actionIdForNode(node);
  return Boolean(onAction) && !node.disabled && (isActionEnabled ? isActionEnabled(actionId, node) : true);
}

function renderNodeList(
  nodes: KainUiNode[],
  props: Omit<KainUiNodeRendererProps, "node">,
): ReactNode {
  return nodes.map((child) => (
    <KainUiNodeRenderer
      key={child.id}
      node={child}
      {...props}
    />
  ));
}

function compactButtonStyle(enabled: boolean, active = false): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "var(--overlay-workbench-chrome-control-height)",
    minWidth: "var(--overlay-workbench-chrome-control-height)",
    padding: "0 7px",
    borderRadius: "var(--overlay-workbench-control-radius)",
    border: "1px solid var(--overlay-workbench-chrome-border)",
    background: active ? "var(--overlay-workbench-chrome-button-active-bg)" : "var(--overlay-workbench-chrome-button-bg)",
    color: "var(--overlay-text-primary)",
    opacity: enabled ? 1 : 0.42,
    cursor: enabled ? "pointer" : "default",
    fontSize: "var(--overlay-workbench-chrome-meta-size)",
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

function renderActionButton(
  node: KainUiNode,
  label: ReactNode,
  props: Omit<KainUiNodeRendererProps, "node">,
  appletChrome = false,
): ReactNode {
  const actionId = actionIdForNode(node);
  const enabled = canRunAction(node, props.onAction, props.isActionEnabled);
  const click = () => {
    if (enabled) {
      void props.onAction?.(actionId, node);
    }
  };

  if (appletChrome) {
    return (
      <button
        type="button"
        disabled={!enabled}
        onClick={click}
        title={node.description ?? node.title ?? nodeLabel(node)}
        data-kain-action-id={actionId}
        data-kain-action-enabled={enabled ? "true" : "false"}
        style={compactButtonStyle(enabled, node.active)}
      >
        {label}
      </button>
    );
  }

  return (
    <SettingsActionButton
      disabled={!enabled}
      onClick={click}
      data-kain-action-id={actionId}
      data-kain-action-enabled={enabled ? "true" : "false"}
    >
      {label}
    </SettingsActionButton>
  );
}

function renderCompactControl(
  node: KainUiNode,
  props: Omit<KainUiNodeRendererProps, "node">,
): ReactNode {
  if (node.kind === "status-pill") {
    return (
      <SettingsStatusPill active={node.active ?? node.tone === "live"}>
        {nodeLabel(node)}
      </SettingsStatusPill>
    );
  }

  if (node.kind === "button" || node.kind === "icon-button") {
    return renderActionButton(node, nodeLabel(node), props, props.variant === "applet");
  }

  if (node.kind === "toggle") {
    return <KainUiNodeRenderer node={node} {...props} />;
  }

  if (node.kind === "select") {
    return <KainUiNodeRenderer node={node} {...props} />;
  }

  if (node.kind === "slider") {
    return <KainUiNodeRenderer node={node} {...props} />;
  }

  return <KainUiNodeRenderer node={node} {...props} />;
}

function KainUiNodeRenderer({
  node,
  variant,
  onAction,
  isActionEnabled,
}: KainUiNodeRendererProps) {
  const childProps = { variant, onAction, isActionEnabled };
  const childNodes = renderNodeList(node.children, childProps);
  const commonProps = {
    "data-kain-ui-node": node.id,
    "data-kain-ui-node-kind": node.kind,
  };

  if (node.kind === "section") {
    const badges = node.children
      .filter((child) => child.kind === "status-pill")
      .map(nodeLabel);
    const content = node.children.filter((child) => child.kind !== "status-pill");

    return (
      <div {...commonProps}>
        <SettingsSectionBlock
          title={node.title}
          subtitle={node.description}
          badges={badges.length ? badges : undefined}
        >
          <SettingsRowGroup>
            {renderNodeList(content, childProps)}
          </SettingsRowGroup>
        </SettingsSectionBlock>
      </div>
    );
  }

  if (node.kind === "row") {
    const [controlNode, ...bodyNodes] = node.children;
    return (
      <div {...commonProps}>
        <SettingsRow
          title={node.title ?? node.id}
          description={node.description ?? node.text ?? ""}
          control={controlNode ? renderCompactControl(controlNode, childProps) : <SettingsStatusPill>ready</SettingsStatusPill>}
          note={bodyNodes.length ? renderNodeList(bodyNodes, childProps) : undefined}
        />
      </div>
    );
  }

  if (node.kind === "action-strip") {
    return (
      <div
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}
        {...commonProps}
      >
        {childNodes}
      </div>
    );
  }

  if (node.kind === "divider") {
    return (
      <div
        style={{ height: 1, background: "var(--overlay-workbench-settings-card-border)", opacity: 0.65 }}
        {...commonProps}
      />
    );
  }

  if (node.kind === "key-value") {
    const key = stringProp(node, "key", node.title ?? "Value");
    const value = stringProp(node, "value", node.text ?? node.label ?? "");
    return (
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 10 }}
        {...commonProps}
      >
        <span style={{ opacity: 0.48, textTransform: "uppercase", fontWeight: 800 }}>{key}</span>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      </span>
    );
  }

  if (node.kind === "notice") {
    return (
      <div
        style={{
          border: "1px solid var(--overlay-workbench-settings-badge-border)",
          borderRadius: "var(--overlay-workbench-control-radius)",
          background: "var(--overlay-workbench-settings-badge-bg)",
          padding: "7px 9px",
          fontSize: 10,
          lineHeight: 1.45,
          opacity: 0.76,
        }}
        {...commonProps}
      >
        {node.text ?? node.description ?? node.title ?? ""}
      </div>
    );
  }

  if (node.kind === "status-pill") {
    return (
      <span {...commonProps}>
        <SettingsStatusPill active={node.active ?? node.tone === "live"}>
          {nodeLabel(node)}
        </SettingsStatusPill>
      </span>
    );
  }

  if (node.kind === "button") {
    return (
      <span {...commonProps}>
        {renderActionButton(node, nodeLabel(node), childProps)}
      </span>
    );
  }

  if (node.kind === "toggle") {
    const checked = boolProp(node, "checked", node.active ?? false);
    const enabled = canRunAction(node, onAction, isActionEnabled) && !boolProp(node, "readonly", false);
    return (
      <input
        type="checkbox"
        checked={checked}
        disabled={!enabled}
        onChange={() => {}}
        aria-label={node.title ?? node.label ?? node.id}
        data-kain-control-enabled={enabled ? "true" : "false"}
        {...commonProps}
      />
    );
  }

  if (node.kind === "select") {
    const value = stringProp(node, "value", node.label ?? "semantic");
    const enabled = canRunAction(node, onAction, isActionEnabled) && !boolProp(node, "readonly", false);
    return (
      <AppSelect
        value={value}
        disabled={!enabled}
        onChange={() => {}}
        aria-label={node.title ?? node.label ?? node.id}
        data-kain-control-enabled={enabled ? "true" : "false"}
        style={{
          maxWidth: 118,
          border: "1px solid var(--overlay-workbench-settings-card-border)",
          borderRadius: "var(--overlay-workbench-control-radius)",
          background: "var(--overlay-workbench-settings-card-bg)",
          color: "var(--overlay-text-primary)",
          fontSize: 10,
        }}
        {...commonProps}
      >
        <option value={value}>{value}</option>
      </AppSelect>
    );
  }

  if (node.kind === "slider") {
    const min = numberProp(node, "min", 0);
    const max = numberProp(node, "max", 100);
    const value = numberProp(node, "value", min);
    const enabled = canRunAction(node, onAction, isActionEnabled) && !boolProp(node, "readonly", false);
    return (
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={!enabled}
        onChange={() => {}}
        aria-label={node.title ?? node.label ?? node.id}
        data-kain-control-enabled={enabled ? "true" : "false"}
        {...commonProps}
      />
    );
  }

  if (node.kind === "applet") {
    return (
      <div
        title={stringProp(node, "tooltip", node.description ?? node.title ?? node.id)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          height: "100%",
          padding: "0 4px",
        }}
        {...commonProps}
      >
        {childNodes}
      </div>
    );
  }

  if (node.kind === "indicator") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          color: "var(--overlay-text-primary)",
          fontSize: "var(--overlay-workbench-chrome-meta-size)",
          fontWeight: 900,
        }}
        {...commonProps}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: node.active ?? node.tone === "live" ? "var(--overlay-accent)" : "var(--overlay-text-muted)",
            boxShadow: node.active ?? node.tone === "live" ? "0 0 0 3px color-mix(in srgb, var(--overlay-accent) 18%, transparent)" : "none",
          }}
        />
        <span>{nodeLabel(node)}</span>
      </span>
    );
  }

  if (node.kind === "icon-button") {
    return (
      <span {...commonProps}>
        {renderActionButton(node, nodeLabel(node), childProps, true)}
      </span>
    );
  }

  if (node.kind === "mini-meter") {
    const max = Math.max(1, numberProp(node, "max", 100));
    const value = Math.min(Math.max(0, numberProp(node, "value", 0)), max);
    const width = `${Math.round((value / max) * 100)}%`;
    return (
      <span
        style={{
          display: "inline-flex",
          width: 26,
          height: 4,
          borderRadius: 999,
          overflow: "hidden",
          background: "var(--overlay-workbench-chrome-border)",
        }}
        {...commonProps}
      >
        <span
          style={{
            width,
            background: "var(--overlay-accent)",
          }}
        />
      </span>
    );
  }

  if (node.kind === "text") {
    return (
      <p
        className={node.role === "caption" ? "text-[10px] opacity-55" : "text-[11px] opacity-70"}
        {...commonProps}
      >
        {node.text ?? node.title ?? ""}
      </p>
    );
  }

  return (
    <div
      className={node.layout.direction === "row" ? "flex flex-wrap items-center gap-2" : "space-y-2"}
      {...commonProps}
    >
      {childNodes}
    </div>
  );
}

export function KainUiRenderer({
  surface,
  node,
  fallback = null,
  variant = "settings",
  onAction,
  isActionEnabled,
}: KainUiRendererProps) {
  const root = node ?? surface?.root ?? null;
  if (!root) {
    return <>{fallback}</>;
  }

  const isApplet = variant === "applet";

  return (
    <div
      className={isApplet ? undefined : "space-y-2"}
      style={isApplet ? { display: "inline-flex", alignItems: "center", height: "100%" } : undefined}
      data-kain-ui-renderer="semantic-v1"
      data-kain-ui-renderer-variant={variant}
      data-kain-ui-surface={surface?.id ?? root.id}
    >
      <KainUiNodeRenderer
        node={root}
        variant={variant}
        onAction={onAction}
        isActionEnabled={isActionEnabled}
      />
    </div>
  );
}
