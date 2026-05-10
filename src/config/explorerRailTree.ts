import shippedExplorerRailTreeManifestJson from "../../usr/profiles/default/explorer-rail-trees/greeblefs-core/explorer-rail-tree.json";
import { detectClientPlatform, joinPlatformPath, type RuntimePlatform } from "./platform";

export type ExplorerRailTreeNodeKind = "action" | "path" | "group";
export type ExplorerRailTreeNodeAction = "go-home";
export type ExplorerRailTreeNodeIcon =
  | "cloud"
  | "collections"
  | "desktop"
  | "folder"
  | "ftp"
  | "home"
  | "libraries"
  | "linux";

export interface ExplorerRailTreeNodeDefinition {
  id: string;
  kind: ExplorerRailTreeNodeKind;
  label: string;
  icon: ExplorerRailTreeNodeIcon;
  action: ExplorerRailTreeNodeAction | null;
  path: string | null;
  pathTemplate: string | null;
  platforms: RuntimePlatform[] | null;
  defaultExpanded: boolean;
  children: ExplorerRailTreeNodeDefinition[];
}

export interface ExplorerRailTreeVirtualizationPolicy {
  maxInlineStaticNodes: number;
}

export interface ExplorerRailTreeManifest {
  version: number;
  id: string;
  name: string;
  description: string;
  quickAccessNodes: ExplorerRailTreeNodeDefinition[];
  virtualization: ExplorerRailTreeVirtualizationPolicy;
}

export interface ShippedExplorerRailTreeManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  quickAccessNodes?: unknown[];
  virtualization?: Partial<ExplorerRailTreeVirtualizationPolicy>;
}

export interface ExplorerRailTreePathResolutionContext {
  homeDir: string | null;
  platform?: RuntimePlatform;
}

const DEFAULT_EXPLORER_RAIL_TREE_MANIFEST: ExplorerRailTreeManifest = Object.freeze({
  version: 1,
  id: "greeblefs-core-explorer-rail-tree",
  name: "GreebleFS Core Explorer Rail Tree",
  description: "Profile-authored navigation roots for the Explorer side rail.",
  quickAccessNodes: [],
  virtualization: Object.freeze({
    maxInlineStaticNodes: 96,
  }),
});

const explorerRailTreeNodeKinds = new Set<ExplorerRailTreeNodeKind>([
  "action",
  "path",
  "group",
]);

const explorerRailTreeNodeActions = new Set<ExplorerRailTreeNodeAction>([
  "go-home",
]);

const explorerRailTreeNodeIcons = new Set<ExplorerRailTreeNodeIcon>([
  "cloud",
  "collections",
  "desktop",
  "folder",
  "ftp",
  "home",
  "libraries",
  "linux",
]);

const clientPlatforms = new Set<RuntimePlatform>([
  "windows",
  "macos",
  "linux",
  "unknown",
]);

let activeExplorerRailTreeManifest: ExplorerRailTreeManifest =
  cloneExplorerRailTreeManifest(DEFAULT_EXPLORER_RAIL_TREE_MANIFEST);

export function applyUsrExplorerRailTreeManifest(
  manifest: ShippedExplorerRailTreeManifest | null | undefined,
): void {
  activeExplorerRailTreeManifest = normalizeExplorerRailTreeManifest(manifest);
}

applyUsrExplorerRailTreeManifest(
  shippedExplorerRailTreeManifestJson as ShippedExplorerRailTreeManifest,
);

export function getExplorerRailTreeManifest(): ExplorerRailTreeManifest {
  return cloneExplorerRailTreeManifest(activeExplorerRailTreeManifest);
}

export function getExplorerRailTreeQuickAccessNodes(
  platform: RuntimePlatform = detectClientPlatform(),
): ExplorerRailTreeNodeDefinition[] {
  return filterRailTreeNodesForPlatform(
    activeExplorerRailTreeManifest.quickAccessNodes,
    platform,
  );
}

export function collectExplorerRailTreeNodeIds(
  nodes: readonly ExplorerRailTreeNodeDefinition[],
): string[] {
  const ids: string[] = [];
  const visit = (node: ExplorerRailTreeNodeDefinition) => {
    ids.push(node.id);
    for (const child of node.children) {
      visit(child);
    }
  };
  for (const node of nodes) {
    visit(node);
  }
  return ids;
}

export function resolveExplorerRailTreeNodePath(
  node: ExplorerRailTreeNodeDefinition,
  context: ExplorerRailTreePathResolutionContext,
): string | null {
  if (node.path) {
    return node.path;
  }
  if (!node.pathTemplate) {
    return null;
  }
  const homeDir = context.homeDir?.trim();
  if (!homeDir) {
    return null;
  }
  return resolveRailTreePathTemplate(node.pathTemplate, {
    homeDir,
    platform: context.platform ?? detectClientPlatform(),
  });
}

export function normalizeExplorerRailTreeManifest(
  manifest: ShippedExplorerRailTreeManifest | null | undefined,
): ExplorerRailTreeManifest {
  const source = asRecord(manifest);
  const quickAccessNodes = Array.isArray(source?.quickAccessNodes)
    ? normalizeExplorerRailTreeNodeList(source.quickAccessNodes)
    : [];

  return {
    version: asFinitePositiveInteger(source?.version, DEFAULT_EXPLORER_RAIL_TREE_MANIFEST.version),
    id: asNonEmptyString(source?.id, DEFAULT_EXPLORER_RAIL_TREE_MANIFEST.id),
    name: asNonEmptyString(source?.name, DEFAULT_EXPLORER_RAIL_TREE_MANIFEST.name),
    description: asNonEmptyString(
      source?.description,
      DEFAULT_EXPLORER_RAIL_TREE_MANIFEST.description,
    ),
    quickAccessNodes,
    virtualization: {
      maxInlineStaticNodes: clampInteger(
        source?.virtualization && typeof source.virtualization === "object"
          ? (source.virtualization as Partial<ExplorerRailTreeVirtualizationPolicy>).maxInlineStaticNodes
          : undefined,
        16,
        2048,
        DEFAULT_EXPLORER_RAIL_TREE_MANIFEST.virtualization.maxInlineStaticNodes,
      ),
    },
  };
}

function normalizeExplorerRailTreeNodeList(
  values: readonly unknown[],
): ExplorerRailTreeNodeDefinition[] {
  const usedIds = new Set<string>();
  const normalizedNodes: ExplorerRailTreeNodeDefinition[] = [];

  values.forEach((value, index) => {
    const node = normalizeExplorerRailTreeNode(value, index, usedIds);
    if (node) {
      normalizedNodes.push(node);
    }
  });

  return normalizedNodes;
}

function normalizeExplorerRailTreeNode(
  value: unknown,
  index: number,
  usedIds: Set<string>,
): ExplorerRailTreeNodeDefinition | null {
  const source = asRecord(value);
  if (!source) {
    return null;
  }

  const label = asNonEmptyString(source.label, "");
  if (!label) {
    return null;
  }

  const kind = explorerRailTreeNodeKinds.has(source.kind as ExplorerRailTreeNodeKind)
    ? source.kind as ExplorerRailTreeNodeKind
    : "group";
  const rawId = asNonEmptyString(source.id, createRailTreeNodeId(label, index));
  const id = dedupeRailTreeNodeId(rawId, usedIds);
  const action = explorerRailTreeNodeActions.has(source.action as ExplorerRailTreeNodeAction)
    ? source.action as ExplorerRailTreeNodeAction
    : null;
  const path = asNonEmptyString(source.path, "");
  const pathTemplate = asNonEmptyString(source.pathTemplate, "");
  const children = Array.isArray(source.children)
    ? normalizeExplorerRailTreeNodeList(source.children)
    : [];

  if (kind === "action" && action === null) {
    return null;
  }
  if (kind === "path" && !path && !pathTemplate) {
    return null;
  }

  return {
    id,
    kind,
    label,
    icon: explorerRailTreeNodeIcons.has(source.icon as ExplorerRailTreeNodeIcon)
      ? source.icon as ExplorerRailTreeNodeIcon
      : "folder",
    action: kind === "action" ? action : null,
    path: path || null,
    pathTemplate: pathTemplate || null,
    platforms: normalizeClientPlatforms(source.platforms),
    defaultExpanded: source.defaultExpanded === true,
    children,
  };
}

function filterRailTreeNodesForPlatform(
  nodes: readonly ExplorerRailTreeNodeDefinition[],
  platform: RuntimePlatform,
): ExplorerRailTreeNodeDefinition[] {
  return nodes.flatMap((node) => {
    if (node.platforms && !node.platforms.includes(platform)) {
      return [];
    }
    return [{
      ...node,
      children: filterRailTreeNodesForPlatform(node.children, platform),
    }];
  });
}

function cloneExplorerRailTreeManifest(
  manifest: ExplorerRailTreeManifest,
): ExplorerRailTreeManifest {
  return {
    ...manifest,
    quickAccessNodes: cloneExplorerRailTreeNodes(manifest.quickAccessNodes),
    virtualization: { ...manifest.virtualization },
  };
}

function cloneExplorerRailTreeNodes(
  nodes: readonly ExplorerRailTreeNodeDefinition[],
): ExplorerRailTreeNodeDefinition[] {
  return nodes.map((node) => ({
    ...node,
    platforms: node.platforms ? [...node.platforms] : null,
    children: cloneExplorerRailTreeNodes(node.children),
  }));
}

function resolveRailTreePathTemplate(
  template: string,
  context: { homeDir: string; platform: RuntimePlatform },
): string {
  const homeDir = context.homeDir.replace(/[\\/]+$/, "");
  const suffix = template.replace("{home}", "").replace(/^[\\/]+/, "");
  if (!suffix) {
    return homeDir;
  }
  const normalizedSuffix =
    context.platform === "windows"
      ? suffix.replace(/\//g, "\\")
      : suffix.replace(/\\/g, "/");
  return joinPlatformPath(homeDir, normalizedSuffix, context.platform);
}

function normalizeClientPlatforms(value: unknown): RuntimePlatform[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const platforms = Array.from(new Set(
    value.filter((entry): entry is RuntimePlatform =>
      typeof entry === "string" && clientPlatforms.has(entry as RuntimePlatform),
    ),
  ));
  return platforms.length > 0 ? platforms : null;
}

function createRailTreeNodeId(label: string, index: number): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `node-${index + 1}`;
}

function dedupeRailTreeNodeId(id: string, usedIds: Set<string>): string {
  let nextId = id.trim();
  let suffix = 2;
  while (usedIds.has(nextId)) {
    nextId = `${id}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(nextId);
  return nextId;
}

function asNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asFinitePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

function clampInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
