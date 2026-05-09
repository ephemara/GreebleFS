import type { ReactNode } from "react";
import type { KainUiNode, KainUiSurface } from "@/runtime/kainUiScaffold";
import {
  SettingsActionButton,
  SettingsRow,
  SettingsRowGroup,
  SettingsSectionBlock,
  SettingsStatusPill,
} from "../settings/SettingsPrimitives";

interface KainUiRendererProps {
  surface?: KainUiSurface | null;
  node?: KainUiNode | null;
  fallback?: ReactNode;
}

function nodeLabel(node: KainUiNode): string {
  return node.label ?? node.text ?? node.title ?? node.id;
}

function renderNodeList(nodes: KainUiNode[]): ReactNode {
  return nodes.map((child) => (
    <KainUiNodeRenderer
      key={child.id}
      node={child}
    />
  ));
}

function renderCompactControl(node: KainUiNode): ReactNode {
  if (node.kind === "status-pill") {
    return (
      <SettingsStatusPill active={node.active ?? node.tone === "live"}>
        {nodeLabel(node)}
      </SettingsStatusPill>
    );
  }

  if (node.kind === "button") {
    return (
      <SettingsActionButton
        disabled
        data-kain-action-id={node.actionId ?? node.id}
      >
        {nodeLabel(node)}
      </SettingsActionButton>
    );
  }

  return <KainUiNodeRenderer node={node} />;
}

function KainUiNodeRenderer({ node }: { node: KainUiNode }) {
  const childNodes = renderNodeList(node.children);
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
            {renderNodeList(content)}
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
          control={controlNode ? renderCompactControl(controlNode) : <SettingsStatusPill>ready</SettingsStatusPill>}
          note={bodyNodes.length ? renderNodeList(bodyNodes) : undefined}
        />
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
        <SettingsActionButton
          disabled
          data-kain-action-id={node.actionId ?? node.id}
        >
          {nodeLabel(node)}
        </SettingsActionButton>
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
}: KainUiRendererProps) {
  const root = node ?? surface?.root ?? null;
  if (!root) {
    return <>{fallback}</>;
  }

  return (
    <div
      className="space-y-2"
      data-kain-ui-renderer="semantic-v1"
      data-kain-ui-surface={surface?.id ?? root.id}
    >
      <KainUiNodeRenderer node={root} />
    </div>
  );
}
