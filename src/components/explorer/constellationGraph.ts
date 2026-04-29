import {
  CONSTELLATION_GRAPH_NODE_BUDGETS,
  CONSTELLATION_HOVER_REASON_LIMIT,
  CONSTELLATION_LENS_RECENT_ENTRY_LIMIT,
  CONSTELLATION_MIN_EDGE_SCORE_BY_LENS,
  CONSTELLATION_REASON_WEIGHTS,
  CONSTELLATION_ROUTE_TARGET_LIMIT,
  getConstellationReasonDefinition,
  type ConstellationEdgeReasonKind,
  type ConstellationLensId,
} from "../../config/constellationGraph";
import type { ExplorerFileEntry as FileEntry } from "../../runtime/explorerBackend";

export interface ConstellationLensBand {
  id: string;
  label: string;
  description: string;
  dominant: boolean;
  entries: FileEntry[];
}

export interface ConstellationEdgeReason {
  kind: ConstellationEdgeReasonKind;
  label: string;
  detail: string;
  weight: number;
}

export interface ConstellationGraphNode {
  entry: FileEntry;
  pinned: boolean;
  selected: boolean;
  bookmarked: boolean;
  anchorEligible: boolean;
}

export interface ConstellationGraphEdge {
  id: string;
  fromPath: string;
  toPath: string;
  scoreByLens: Record<ConstellationLensId, number>;
  reasons: ConstellationEdgeReason[];
}

export interface ConstellationGraph {
  nodes: ConstellationGraphNode[];
  edges: ConstellationGraphEdge[];
}

export interface ConstellationGraphBuildInput {
  entries: readonly FileEntry[];
  selectedPaths: ReadonlySet<string>;
  pinnedPaths: ReadonlySet<string>;
  bookmarkPaths: ReadonlySet<string>;
  pathTagIds: ReadonlyMap<string, readonly string[]>;
}

export interface ConstellationBandBuildInput {
  entries: readonly FileEntry[];
  selectedPaths: ReadonlySet<string>;
  pinnedPaths: ReadonlySet<string>;
  bookmarkPaths: ReadonlySet<string>;
  pathTagIds: ReadonlyMap<string, readonly string[]>;
  currentPath: string;
  activeLens: ConstellationLensId;
  sortBy: "name" | "size" | "date" | "type";
  sortOrder: "asc" | "desc";
  nowMs?: number;
}

export interface ConstellationRouteState {
  anchorPath: string | null;
  targetPaths: string[];
  edgeIds: string[];
}

export interface ConstellationNodeExplanation {
  edge: ConstellationGraphEdge | null;
  connectedPath: string | null;
  reasons: ConstellationEdgeReason[];
}

interface NodeMetadata {
  entry: FileEntry;
  index: number;
  selected: boolean;
  pinned: boolean;
  bookmarked: boolean;
  anchorEligible: boolean;
  parentPath: string;
  extension: string;
  stem: string;
  recencyBucketId: ConstellationRecencyBucketId;
  recencyBucketLabel: string;
  pathTokens: string[];
  tagIds: string[];
}

interface RankedConstellationNodeMetadata {
  node: NodeMetadata;
  score: number;
}

type ConstellationRecencyBucketId =
  | "today"
  | "this-week"
  | "this-month"
  | "this-quarter"
  | "archive"
  | "undated";

const TEXT_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

const CONSTELLATION_RECENCY_BUCKETS: ReadonlyArray<{
  id: Exclude<ConstellationRecencyBucketId, "undated">;
  label: string;
  durationMs: number;
}> = Object.freeze([
  { id: "today", label: "Today", durationMs: 24 * 60 * 60 * 1000 },
  { id: "this-week", label: "This week", durationMs: 7 * 24 * 60 * 60 * 1000 },
  { id: "this-month", label: "This month", durationMs: 31 * 24 * 60 * 60 * 1000 },
  { id: "this-quarter", label: "This quarter", durationMs: 92 * 24 * 60 * 60 * 1000 },
  { id: "archive", label: "Archive", durationMs: Number.POSITIVE_INFINITY },
]);

export function buildConstellationGraph(
  input: ConstellationGraphBuildInput,
): ConstellationGraph {
  const nodeMetadata = buildNodeMetadata(input.entries, input, Date.now());
  const comparedNodeMetadata = selectComparedConstellationNodeMetadata(nodeMetadata);
  const edges: ConstellationGraphEdge[] = [];

  for (let leftIndex = 0; leftIndex < comparedNodeMetadata.length; leftIndex += 1) {
    const left = comparedNodeMetadata[leftIndex];
    if (!left) {
      continue;
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < comparedNodeMetadata.length;
      rightIndex += 1
    ) {
      const right = comparedNodeMetadata[rightIndex];
      if (!right) {
        continue;
      }
      const edge = buildConstellationEdge(left, right);
      if (!edge) {
        continue;
      }
      edges.push(edge);
    }
  }

  return {
    nodes: comparedNodeMetadata.map((node) => ({
      entry: node.entry,
      pinned: node.pinned,
      selected: node.selected,
      bookmarked: node.bookmarked,
      anchorEligible: node.anchorEligible,
    })),
    edges,
  };
}

export function buildConstellationLensBands(
  input: ConstellationBandBuildInput,
): ConstellationLensBand[] {
  const nodeMetadata = buildNodeMetadata(input.entries, input, input.nowMs ?? Date.now());
  const referenceNode = findConstellationReferenceNode(nodeMetadata);

  switch (input.activeLens) {
    case "structure":
      return buildStructureBands(nodeMetadata, input, referenceNode);
    case "time":
      return buildTimeBands(nodeMetadata, input);
    case "similarity":
      return buildSimilarityBands(nodeMetadata, input, referenceNode);
    case "workflow":
    default:
      return buildWorkflowBands(nodeMetadata, input, referenceNode);
  }
}

export function createConstellationGraphEdgeLookup(
  edges: readonly ConstellationGraphEdge[],
): Map<string, ConstellationGraphEdge> {
  return new Map(edges.map((edge) => [edge.id, edge] as const));
}

export function createConstellationGraphAdjacencyLookup(
  edges: readonly ConstellationGraphEdge[],
): Map<string, ConstellationGraphEdge[]> {
  const adjacency = new Map<string, ConstellationGraphEdge[]>();
  for (const edge of edges) {
    const fromEdges = adjacency.get(edge.fromPath) ?? [];
    fromEdges.push(edge);
    adjacency.set(edge.fromPath, fromEdges);

    const toEdges = adjacency.get(edge.toPath) ?? [];
    toEdges.push(edge);
    adjacency.set(edge.toPath, toEdges);
  }
  return adjacency;
}

export function resolveConstellationRouteState(args: {
  graph: ConstellationGraph;
  activeLens: ConstellationLensId;
  selectedPaths: ReadonlySet<string>;
  pinnedPaths: ReadonlySet<string>;
  bookmarkPaths: ReadonlySet<string>;
  visibleEntryOrder: readonly FileEntry[];
  dominantPath: string | null;
}): ConstellationRouteState {
  const nodeByPath = new Map(
    args.graph.nodes.map((node) => [node.entry.path, node] as const),
  );
  const adjacency = createConstellationGraphAdjacencyLookup(args.graph.edges);
  const anchorPath =
    args.visibleEntryOrder.find((entry) => args.selectedPaths.has(entry.path))?.path ??
    args.visibleEntryOrder.find((entry) => args.pinnedPaths.has(entry.path))?.path ??
    args.dominantPath ??
    args.visibleEntryOrder[0]?.path ??
    null;

  if (!anchorPath) {
    return {
      anchorPath: null,
      targetPaths: [],
      edgeIds: [],
    };
  }

  const candidateEdges = adjacency.get(anchorPath) ?? [];
  const rankedTargets = candidateEdges
    .map((edge) => {
      const targetPath = edge.fromPath === anchorPath ? edge.toPath : edge.fromPath;
      const targetNode = nodeByPath.get(targetPath);
      if (!targetNode) {
        return null;
      }
      return {
        edge,
        targetPath,
        score:
          edge.scoreByLens[args.activeLens] +
          getConstellationRouteTargetBonus(targetNode, args.activeLens, args.bookmarkPaths),
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((left, right) => (
      right.score - left.score ||
      TEXT_COLLATOR.compare(
        nodeByPath.get(left.targetPath)?.entry.name ?? left.targetPath,
        nodeByPath.get(right.targetPath)?.entry.name ?? right.targetPath,
      )
    ))
    .slice(0, CONSTELLATION_ROUTE_TARGET_LIMIT);

  return {
    anchorPath,
    targetPaths: rankedTargets.map((candidate) => candidate.targetPath),
    edgeIds: rankedTargets.map((candidate) => candidate.edge.id),
  };
}

export function findConstellationEdgeBetween(
  edgeLookup: ReadonlyMap<string, ConstellationGraphEdge>,
  leftPath: string,
  rightPath: string,
): ConstellationGraphEdge | null {
  if (!leftPath || !rightPath || leftPath === rightPath) {
    return null;
  }
  return edgeLookup.get(createConstellationEdgeId(leftPath, rightPath)) ?? null;
}

export function resolveConstellationNodeExplanation(args: {
  nodePath: string;
  graph: ConstellationGraph;
  edgeLookup?: ReadonlyMap<string, ConstellationGraphEdge>;
  adjacencyLookup?: ReadonlyMap<string, readonly ConstellationGraphEdge[]>;
  activeLens: ConstellationLensId;
  routeAnchorPath: string | null;
}): ConstellationNodeExplanation {
  const edgeLookup =
    args.edgeLookup ?? createConstellationGraphEdgeLookup(args.graph.edges);
  if (args.routeAnchorPath && args.routeAnchorPath !== args.nodePath) {
    const routedEdge = findConstellationEdgeBetween(
      edgeLookup,
      args.routeAnchorPath,
      args.nodePath,
    );
    if (routedEdge) {
      return {
        edge: routedEdge,
        connectedPath: args.routeAnchorPath,
        reasons: getConstellationEdgeReasonsForLens(routedEdge, args.activeLens),
      };
    }
  }

  const adjacency =
    args.adjacencyLookup ?? createConstellationGraphAdjacencyLookup(args.graph.edges);
  const localEdges = adjacency.get(args.nodePath) ?? [];
  let strongestEdge: ConstellationGraphEdge | null = null;
  for (const edge of localEdges) {
    if (
      !strongestEdge ||
      edge.scoreByLens[args.activeLens] >
        strongestEdge.scoreByLens[args.activeLens]
    ) {
      strongestEdge = edge;
    }
  }
  if (!strongestEdge) {
    return {
      edge: null,
      connectedPath: null,
      reasons: [],
    };
  }

  return {
    edge: strongestEdge,
    connectedPath:
      strongestEdge.fromPath === args.nodePath
        ? strongestEdge.toPath
        : strongestEdge.fromPath,
    reasons: getConstellationEdgeReasonsForLens(strongestEdge, args.activeLens),
  };
}

export function getConstellationEdgeReasonsForLens(
  edge: ConstellationGraphEdge,
  activeLens: ConstellationLensId,
): ConstellationEdgeReason[] {
  return [...edge.reasons]
    .sort((left, right) => (
      getReasonLensWeight(right.kind, activeLens) -
        getReasonLensWeight(left.kind, activeLens) ||
      right.weight - left.weight ||
      TEXT_COLLATOR.compare(left.label, right.label)
    ))
    .slice(0, CONSTELLATION_HOVER_REASON_LIMIT);
}

function buildStructureBands(
  nodeMetadata: readonly NodeMetadata[],
  input: ConstellationBandBuildInput,
  referenceNode: NodeMetadata | null,
): ConstellationLensBand[] {
  const folderEntries = nodeMetadata
    .filter((node) => node.entry.is_dir)
    .map((node) => node.entry);
  const referenceParentPath =
    referenceNode?.entry.is_dir === true
      ? referenceNode.entry.path
      : referenceNode?.parentPath ?? normalizeExplorerPath(input.currentPath);
  const localContextEntries = nodeMetadata
    .filter(
      (node) =>
        !node.entry.is_dir &&
        node.parentPath === referenceParentPath &&
        node.entry.path !== referenceNode?.entry.path,
    )
    .map((node) => node.entry);
  const siblingTypeEntries = nodeMetadata
    .filter((node) => {
      if (node.entry.is_dir || !referenceNode || node.entry.path === referenceNode.entry.path) {
        return false;
      }
      return (
        (referenceNode.extension.length > 0 && node.extension === referenceNode.extension) ||
        (referenceNode.stem.length > 0 && node.stem === referenceNode.stem)
      );
    })
    .map((node) => node.entry);
  const claimedPaths = new Set([
    ...folderEntries.map((entry) => entry.path),
    ...localContextEntries.map((entry) => entry.path),
    ...siblingTypeEntries.map((entry) => entry.path),
  ]);

  return compactConstellationBands([
    createBand("folders", "Folders", "Directory anchors define the structural map.", true, folderEntries),
    createBand(
      "local-structure",
      "Local Context",
      "Sibling files stay closest to the active folder anchor.",
      false,
      sortConstellationEntries(localContextEntries, input.sortBy, input.sortOrder),
    ),
    createBand(
      "similar-shape",
      "Shared Shape",
      "Matching stems and file types stay nearby in structure view.",
      false,
      sortConstellationEntries(dedupeEntries(siblingTypeEntries), input.sortBy, input.sortOrder),
    ),
    createBand(
      "outer-structure",
      "Outer Surface",
      "Everything else stays visible without crowding the anchor cluster.",
      false,
      sortConstellationEntries(
        nodeMetadata
          .map((node) => node.entry)
          .filter((entry) => !claimedPaths.has(entry.path)),
        input.sortBy,
        input.sortOrder,
      ),
    ),
  ]);
}

function buildTimeBands(
  nodeMetadata: readonly NodeMetadata[],
  _input: ConstellationBandBuildInput,
): ConstellationLensBand[] {
  const buckets = new Map<ConstellationRecencyBucketId, FileEntry[]>();
  for (const node of nodeMetadata) {
    const entries = buckets.get(node.recencyBucketId) ?? [];
    entries.push(node.entry);
    buckets.set(node.recencyBucketId, entries);
  }

  return compactConstellationBands([
    createBand(
      "today",
      "Today",
      "Fresh edits stay at the front of the time lens.",
      true,
      sortConstellationEntries(buckets.get("today") ?? [], "date", "desc"),
    ),
    createBand(
      "this-week",
      "This Week",
      "Files touched this week stay one move away from the freshest layer.",
      false,
      sortConstellationEntries(buckets.get("this-week") ?? [], "date", "desc"),
    ),
    createBand(
      "this-month",
      "This Month",
      "Current-month work stays visible before it falls into the archive.",
      false,
      sortConstellationEntries(buckets.get("this-month") ?? [], "date", "desc"),
    ),
    createBand(
      "archive",
      "Archive",
      "Older files compress into the deeper timeline field.",
      false,
      sortConstellationEntries(
        [
          ...(buckets.get("this-quarter") ?? []),
          ...(buckets.get("archive") ?? []),
          ...(buckets.get("undated") ?? []),
        ],
        "date",
        "desc",
      ),
    ),
  ]);
}

function buildSimilarityBands(
  nodeMetadata: readonly NodeMetadata[],
  input: ConstellationBandBuildInput,
  referenceNode: NodeMetadata | null,
): ConstellationLensBand[] {
  const referenceTokens = new Set(referenceNode?.pathTokens ?? []);
  const referenceTags = new Set(referenceNode?.tagIds ?? []);
  const stemMatches = nodeMetadata
    .filter((node) => {
      if (!referenceNode || node.entry.path === referenceNode.entry.path) {
        return false;
      }
      return referenceNode.stem.length > 0 && node.stem === referenceNode.stem;
    })
    .map((node) => node.entry);
  const typeMatches = nodeMetadata
    .filter((node) => {
      if (!referenceNode || node.entry.path === referenceNode.entry.path) {
        return false;
      }
      return referenceNode.extension.length > 0 && node.extension === referenceNode.extension;
    })
    .map((node) => node.entry);
  const tokenMatches = nodeMetadata
    .filter((node) => {
      if (!referenceNode || node.entry.path === referenceNode.entry.path) {
        return false;
      }
      return node.pathTokens.some((token) => referenceTokens.has(token));
    })
    .map((node) => node.entry);
  const tagMatches = nodeMetadata
    .filter((node) => {
      if (!referenceNode || node.entry.path === referenceNode.entry.path) {
        return false;
      }
      return node.tagIds.some((tagId) => referenceTags.has(tagId));
    })
    .map((node) => node.entry);
  const claimedPaths = new Set([
    ...stemMatches.map((entry) => entry.path),
    ...typeMatches.map((entry) => entry.path),
    ...tokenMatches.map((entry) => entry.path),
    ...tagMatches.map((entry) => entry.path),
  ]);

  return compactConstellationBands([
    createBand(
      "stem-matches",
      "Shared Stem",
      "Files with the same basename stay closest to the current anchor.",
      true,
      sortConstellationEntries(dedupeEntries(stemMatches), input.sortBy, input.sortOrder),
    ),
    createBand(
      "type-matches",
      "Shared Type",
      "Matching extensions and tags form the next similarity ring.",
      false,
      sortConstellationEntries(
        dedupeEntries([...typeMatches, ...tagMatches]),
        input.sortBy,
        input.sortOrder,
      ),
    ),
    createBand(
      "token-matches",
      "Shared Tokens",
      "Path tokens keep semantically close names within reach.",
      false,
      sortConstellationEntries(dedupeEntries(tokenMatches), input.sortBy, input.sortOrder),
    ),
    createBand(
      "outer-similarity",
      "Outer Matches",
      "The remaining surface stays visible without overwhelming the anchor.",
      false,
      sortConstellationEntries(
        nodeMetadata
          .map((node) => node.entry)
          .filter((entry) => !claimedPaths.has(entry.path)),
        input.sortBy,
        input.sortOrder,
      ),
    ),
  ]);
}

function buildWorkflowBands(
  nodeMetadata: readonly NodeMetadata[],
  input: ConstellationBandBuildInput,
  referenceNode: NodeMetadata | null,
): ConstellationLensBand[] {
  const folderEntries = nodeMetadata
    .filter((node) => node.entry.is_dir)
    .map((node) => node.entry);
  const worksetEntries = nodeMetadata
    .filter((node) => node.selected || node.pinned || node.bookmarked)
    .map((node) => node.entry);
  const referenceParentPath =
    referenceNode?.entry.is_dir === true
      ? referenceNode.entry.path
      : referenceNode?.parentPath ?? normalizeExplorerPath(input.currentPath);
  const localContextEntries = nodeMetadata
    .filter((node) => {
      if (node.entry.path === referenceNode?.entry.path || node.entry.is_dir) {
        return false;
      }
      const sharesParent = node.parentPath === referenceParentPath;
      const sharesExtension =
        referenceNode?.extension.length &&
        node.extension === referenceNode.extension;
      return Boolean(sharesParent || sharesExtension);
    })
    .map((node) => node.entry);
  const recentEntries = selectRecentConstellationFileEntries(
    nodeMetadata,
    CONSTELLATION_LENS_RECENT_ENTRY_LIMIT,
  );
  const claimedPaths = new Set([
    ...folderEntries.map((entry) => entry.path),
    ...worksetEntries.map((entry) => entry.path),
    ...localContextEntries.map((entry) => entry.path),
    ...recentEntries.map((entry) => entry.path),
  ]);

  return compactConstellationBands([
    createBand("folders", "Folders", "Directory anchors keep the map navigable.", true, folderEntries),
    createBand(
      "workset",
      "Workset",
      "Selected, pinned, and bookmarked entries become the live task map.",
      false,
      sortConstellationEntries(dedupeEntries(worksetEntries), input.sortBy, input.sortOrder),
    ),
    createBand(
      "local-context",
      "Local Context",
      "Selection-adjacent files stay near the next-step orbit.",
      false,
      sortConstellationEntries(dedupeEntries(localContextEntries), input.sortBy, input.sortOrder),
    ),
    createBand(
      "recent-flow",
      "Recent Activity",
      "Freshly modified work stays elevated in the flow lens.",
      false,
      sortConstellationEntries(dedupeEntries(recentEntries), "date", "desc"),
    ),
    createBand(
      "outer-flow",
      "Outer Flow",
      "The remaining files stay available without stealing focus.",
      false,
      sortConstellationEntries(
        nodeMetadata
          .map((node) => node.entry)
          .filter((entry) => !claimedPaths.has(entry.path)),
        input.sortBy,
        input.sortOrder,
      ),
    ),
  ]);
}

function findConstellationReferenceNode(
  nodeMetadata: readonly NodeMetadata[],
): NodeMetadata | null {
  let latestFileNode: NodeMetadata | null = null;

  for (const node of nodeMetadata) {
    if (node.selected) {
      return node;
    }
    if (!latestFileNode && !node.entry.is_dir) {
      latestFileNode = node;
    } else if (
      !node.entry.is_dir &&
      latestFileNode &&
      node.entry.modified > latestFileNode.entry.modified
    ) {
      latestFileNode = node;
    }
  }

  return (
    nodeMetadata.find((node) => node.pinned) ??
    nodeMetadata.find((node) => node.bookmarked) ??
    latestFileNode ??
    nodeMetadata[0] ??
    null
  );
}

function buildNodeMetadata(
  entries: readonly FileEntry[],
  context: Pick<
    ConstellationGraphBuildInput,
    "selectedPaths" | "pinnedPaths" | "bookmarkPaths" | "pathTagIds"
  >,
  nowMs: number,
): NodeMetadata[] {
  return entries.map((entry, index) => {
    const parentPath = getExplorerParentPath(entry.path);
    const extension = getEntryExtension(entry);
    const stem = getEntryStem(entry);
    const tagIds = [...(context.pathTagIds.get(entry.path) ?? [])].sort(TEXT_COLLATOR.compare);
    const recencyBucket = getConstellationRecencyBucket(entry.modified, nowMs);
    return {
      entry,
      index,
      selected: context.selectedPaths.has(entry.path),
      pinned: context.pinnedPaths.has(entry.path),
      bookmarked: context.bookmarkPaths.has(entry.path),
      anchorEligible:
        entry.is_dir ||
        context.selectedPaths.has(entry.path) ||
        context.pinnedPaths.has(entry.path),
      parentPath,
      extension,
      stem,
      recencyBucketId: recencyBucket.id,
      recencyBucketLabel: recencyBucket.label,
      pathTokens: tokenizeConstellationPath(entry),
      tagIds,
    };
  });
}

function selectComparedConstellationNodeMetadata(
  nodeMetadata: readonly NodeMetadata[],
): NodeMetadata[] {
  const maxComparedNodes = CONSTELLATION_GRAPH_NODE_BUDGETS.maxComparedNodes;
  if (nodeMetadata.length <= maxComparedNodes) {
    return [...nodeMetadata];
  }

  const requiredNodes: NodeMetadata[] = [];
  const candidateNodes: NodeMetadata[] = [];

  for (const node of nodeMetadata) {
    if (node.selected || node.pinned || node.bookmarked) {
      requiredNodes.push(node);
    } else {
      candidateNodes.push(node);
    }
  }

  const selectedRequiredNodes = requiredNodes.slice(0, maxComparedNodes);
  const remainingBudget = Math.max(0, maxComparedNodes - selectedRequiredNodes.length);
  const selectedCandidateNodes = selectBestConstellationGraphCandidateNodes(
    candidateNodes,
    remainingBudget,
  );

  return [...selectedRequiredNodes, ...selectedCandidateNodes].sort(
    (left, right) => left.index - right.index,
  );
}

function selectBestConstellationGraphCandidateNodes(
  candidateNodes: readonly NodeMetadata[],
  limit: number,
): NodeMetadata[] {
  if (limit <= 0) {
    return [];
  }

  const rankedNodes: RankedConstellationNodeMetadata[] = [];
  for (const node of candidateNodes) {
    const rankedNode = {
      node,
      score: getConstellationGraphCandidateScore(node),
    };
    const insertIndex = rankedNodes.findIndex(
      (candidate) => compareRankedConstellationGraphCandidate(rankedNode, candidate) < 0,
    );
    if (insertIndex >= 0) {
      rankedNodes.splice(insertIndex, 0, rankedNode);
    } else if (rankedNodes.length < limit) {
      rankedNodes.push(rankedNode);
    }

    if (rankedNodes.length > limit) {
      rankedNodes.length = limit;
    }
  }

  return rankedNodes.map((candidate) => candidate.node);
}

function compareRankedConstellationGraphCandidate(
  left: RankedConstellationNodeMetadata,
  right: RankedConstellationNodeMetadata,
): number {
  return (
    right.score - left.score ||
    right.node.entry.modified - left.node.entry.modified ||
    left.node.index - right.node.index ||
    TEXT_COLLATOR.compare(left.node.entry.name, right.node.entry.name)
  );
}

function getConstellationGraphCandidateScore(node: NodeMetadata): number {
  let score = 0;

  if (node.entry.is_dir) {
    score += CONSTELLATION_GRAPH_NODE_BUDGETS.directoryScore;
  }

  score += getConstellationRecencyCandidateScore(node.recencyBucketId);
  if (node.tagIds.length > 0) {
    score += CONSTELLATION_GRAPH_NODE_BUDGETS.taggedScore;
  }
  if (node.anchorEligible) {
    score += 24;
  }

  return score;
}

function getConstellationRecencyCandidateScore(
  bucketId: ConstellationRecencyBucketId,
): number {
  switch (bucketId) {
    case "today":
      return CONSTELLATION_GRAPH_NODE_BUDGETS.recentTodayScore;
    case "this-week":
      return CONSTELLATION_GRAPH_NODE_BUDGETS.recentWeekScore;
    case "this-month":
      return CONSTELLATION_GRAPH_NODE_BUDGETS.recentMonthScore;
    case "this-quarter":
      return CONSTELLATION_GRAPH_NODE_BUDGETS.recentQuarterScore;
    case "archive":
      return CONSTELLATION_GRAPH_NODE_BUDGETS.archiveScore;
    case "undated":
    default:
      return 0;
  }
}

function selectRecentConstellationFileEntries(
  nodeMetadata: readonly NodeMetadata[],
  limit: number,
): FileEntry[] {
  if (limit <= 0) {
    return [];
  }

  const recentNodes: NodeMetadata[] = [];
  for (const node of nodeMetadata) {
    if (node.entry.is_dir) {
      continue;
    }

    const insertIndex = recentNodes.findIndex(
      (candidate) => node.entry.modified > candidate.entry.modified,
    );
    if (insertIndex >= 0) {
      recentNodes.splice(insertIndex, 0, node);
    } else if (recentNodes.length < limit) {
      recentNodes.push(node);
    }

    if (recentNodes.length > limit) {
      recentNodes.length = limit;
    }
  }

  return recentNodes.map((node) => node.entry);
}

function buildConstellationEdge(
  left: NodeMetadata,
  right: NodeMetadata,
): ConstellationGraphEdge | null {
  const reasons: ConstellationEdgeReason[] = [];
  const sharedTokens = intersectStringValues(left.pathTokens, right.pathTokens);
  const sharedTags = intersectStringValues(left.tagIds, right.tagIds);
  const sharedStem = left.stem.length > 0 && left.stem === right.stem;
  const sharedExtension =
    left.extension.length > 0 && left.extension === right.extension;
  const sameParent =
    left.parentPath.length > 0 && left.parentPath === right.parentPath;
  const folderAnchor =
    (left.entry.is_dir && right.parentPath === normalizeExplorerPath(left.entry.path)) ||
    (right.entry.is_dir && left.parentPath === normalizeExplorerPath(right.entry.path));

  if (folderAnchor) {
    reasons.push(
      createConstellationReason(
        "folderAnchor",
        left.entry.is_dir
          ? `${left.entry.name} directly contains ${right.entry.name}.`
          : `${right.entry.name} directly contains ${left.entry.name}.`,
      ),
    );
  }

  if (sameParent) {
    reasons.push(
      createConstellationReason(
        "sameParent",
        `${left.entry.name} and ${right.entry.name} live under ${formatExplorerPathLabel(left.parentPath)}.`,
      ),
    );
  }

  if (sharedStem) {
    reasons.push(
      createConstellationReason(
        "sharedStem",
        `They share the base name ${left.stem}.`,
      ),
    );
  }

  if (sharedExtension) {
    reasons.push(
      createConstellationReason(
        "sameExtension",
        `Both resolve as .${left.extension} files.`,
      ),
    );
  }

  const meaningfulSharedTokens = sharedTokens.filter((token) => token.length >= 3);
  if (
    meaningfulSharedTokens.length >= 2 ||
    meaningfulSharedTokens.some((token) => token.length >= 5)
  ) {
    reasons.push(
      createConstellationReason(
        "sharedPathToken",
        `Shared path tokens: ${meaningfulSharedTokens.slice(0, 3).join(", ")}.`,
      ),
    );
  }

  if (sharedTags.length > 0) {
    reasons.push(
      createConstellationReason(
        "sharedTag",
        `Shared tags: ${sharedTags.slice(0, 3).join(", ")}.`,
      ),
    );
  }

  if (
    left.recencyBucketId !== "undated" &&
    left.recencyBucketId === right.recencyBucketId
  ) {
    reasons.push(
      createConstellationReason(
        "sameRecencyBucket",
        `Both were modified in ${left.recencyBucketLabel.toLowerCase()}.`,
      ),
    );
  }

  const modifiedDistance = Math.abs(left.entry.modified - right.entry.modified);
  if (
    left.entry.modified > 0 &&
    right.entry.modified > 0 &&
    modifiedDistance <= 72 * 60 * 60 * 1000
  ) {
    reasons.push(
      createConstellationReason(
        "modifiedProximity",
        `Modified ${formatRelativeModificationDistance(modifiedDistance)} apart.`,
      ),
    );
  }

  if (left.pinned && right.pinned) {
    reasons.push(
      createConstellationReason(
        "pinnedWorkset",
        "Both entries are pinned into the current Constellation workset.",
      ),
    );
  }

  if (
    (left.selected || right.selected) &&
    Math.abs(left.index - right.index) <= 4 &&
    left.entry.path !== right.entry.path
  ) {
    reasons.push(
      createConstellationReason(
        "selectionAdjacency",
        "This relationship stays close to the active selection pass.",
      ),
    );
  }

  if (
    (left.bookmarked || right.bookmarked) &&
    (sameParent || folderAnchor || sharedStem || meaningfulSharedTokens.length > 0)
  ) {
    reasons.push(
      createConstellationReason(
        "bookmarkAnchor",
        "A bookmarked path is reinforcing this relationship.",
      ),
    );
  }

  if (reasons.length === 0) {
    return null;
  }

  const scoreByLens = calculateConstellationScores(reasons);
  const maxScore = Math.max(
    scoreByLens.structure,
    scoreByLens.time,
    scoreByLens.similarity,
    scoreByLens.workflow,
  );
  const minimumEdgeScore = Math.min(
    CONSTELLATION_MIN_EDGE_SCORE_BY_LENS.structure,
    CONSTELLATION_MIN_EDGE_SCORE_BY_LENS.time,
    CONSTELLATION_MIN_EDGE_SCORE_BY_LENS.similarity,
    CONSTELLATION_MIN_EDGE_SCORE_BY_LENS.workflow,
  );
  if (maxScore < minimumEdgeScore) {
    return null;
  }

  return {
    id: createConstellationEdgeId(left.entry.path, right.entry.path),
    fromPath: left.entry.path,
    toPath: right.entry.path,
    scoreByLens,
    reasons: reasons.sort((leftReason, rightReason) => (
      rightReason.weight - leftReason.weight ||
      TEXT_COLLATOR.compare(leftReason.label, rightReason.label)
    )),
  };
}

function calculateConstellationScores(
  reasons: readonly ConstellationEdgeReason[],
): Record<ConstellationLensId, number> {
  return reasons.reduce(
    (result, reason) => {
      const weights = CONSTELLATION_REASON_WEIGHTS[reason.kind];
      result.structure += weights.structure;
      result.time += weights.time;
      result.similarity += weights.similarity;
      result.workflow += weights.workflow;
      return result;
    },
    {
      structure: 0,
      time: 0,
      similarity: 0,
      workflow: 0,
    },
  );
}

function createConstellationReason(
  kind: ConstellationEdgeReasonKind,
  detail: string,
): ConstellationEdgeReason {
  const definition = getConstellationReasonDefinition(kind);
  const weights = CONSTELLATION_REASON_WEIGHTS[kind];
  return {
    kind,
    label: definition.label,
    detail,
    weight: Math.max(
      weights.structure,
      weights.time,
      weights.similarity,
      weights.workflow,
    ),
  };
}

function getConstellationRouteTargetBonus(
  node: ConstellationGraphNode,
  activeLens: ConstellationLensId,
  bookmarkPaths: ReadonlySet<string>,
): number {
  let bonus = 0;

  if (node.pinned) {
    bonus += 0.24;
  }
  if (bookmarkPaths.has(node.entry.path)) {
    bonus += 0.18;
  }
  if (node.selected) {
    bonus += 0.12;
  }
  if (activeLens !== "time" && node.entry.is_dir) {
    bonus += 0.1;
  }
  if (activeLens === "workflow" && node.anchorEligible) {
    bonus += 0.08;
  }

  return bonus;
}

function getReasonLensWeight(
  reasonKind: ConstellationEdgeReasonKind,
  activeLens: ConstellationLensId,
): number {
  return CONSTELLATION_REASON_WEIGHTS[reasonKind][activeLens];
}

function getConstellationRecencyBucket(
  modifiedMs: number,
  nowMs: number,
): { id: ConstellationRecencyBucketId; label: string } {
  if (!modifiedMs) {
    return { id: "undated", label: "Undated" };
  }
  const ageMs = Math.max(0, nowMs - modifiedMs);
  const bucket = CONSTELLATION_RECENCY_BUCKETS.find(
    (candidate) => ageMs <= candidate.durationMs,
  );
  if (!bucket) {
    return { id: "archive", label: "Archive" };
  }
  return { id: bucket.id, label: bucket.label };
}

function tokenizeConstellationPath(entry: FileEntry): string[] {
  const baseValue = `${entry.name} ${entry.path}`.toLowerCase();
  return Array.from(
    new Set(
      baseValue
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter(
          (token) => token.length >= 2 && !/^\d+$/.test(token),
        ),
    ),
  );
}

function getEntryExtension(
  entry: Pick<FileEntry, "is_dir" | "name" | "extension">,
): string {
  if (entry.is_dir) {
    return "";
  }
  const normalizedExtension = (entry.extension ?? "")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();
  if (normalizedExtension) {
    return normalizedExtension;
  }
  const lastDotIndex = entry.name.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === entry.name.length - 1) {
    return "";
  }
  return entry.name.slice(lastDotIndex + 1).toLowerCase();
}

function getEntryStem(entry: Pick<FileEntry, "is_dir" | "name">): string {
  if (entry.is_dir) {
    return entry.name.trim().toLowerCase();
  }
  const normalizedName = entry.name.trim().toLowerCase();
  const lastDotIndex = normalizedName.lastIndexOf(".");
  return lastDotIndex > 0 ? normalizedName.slice(0, lastDotIndex) : normalizedName;
}

function getExplorerParentPath(path: string): string {
  if (path.startsWith("cloud://")) {
    const trimmed = path.replace(/\/+$/, "");
    const segments = trimmed.split("/");
    if (segments.length <= 5) {
      return trimmed;
    }
    return segments.slice(0, -1).join("/");
  }
  const normalized = path.replace(/[/\\]+$/, "");
  const parts = normalized.split(/[/\\]/);
  if (parts.length <= 1) {
    return normalized;
  }
  if (/^[A-Za-z]:$/.test(parts[0] ?? "")) {
    return `${parts.slice(0, -1).join("\\")}\\`;
  }
  return parts.slice(0, -1).join("/");
}

function normalizeExplorerPath(path: string): string {
  if (path.startsWith("cloud://")) {
    return path.replace(/\/+$/, "") || path;
  }
  return /^[A-Za-z]:$/.test(path) ? `${path}\\` : path;
}

function createBand(
  id: string,
  label: string,
  description: string,
  dominant: boolean,
  entries: readonly FileEntry[],
): ConstellationLensBand {
  return {
    id,
    label,
    description,
    dominant,
    entries: [...entries],
  };
}

function compactConstellationBands(
  bands: readonly ConstellationLensBand[],
): ConstellationLensBand[] {
  return bands.filter((band) => band.entries.length > 0);
}

function sortConstellationEntries(
  entries: readonly FileEntry[],
  sortBy: "name" | "size" | "date" | "type",
  sortOrder: "asc" | "desc",
): FileEntry[] {
  const multiplier = sortOrder === "asc" ? 1 : -1;
  return [...entries].sort((left, right) => {
    if (left.is_dir !== right.is_dir) {
      return left.is_dir ? -1 : 1;
    }

    let comparison = 0;
    switch (sortBy) {
      case "size":
        comparison = left.size - right.size;
        break;
      case "date":
        comparison = left.modified - right.modified;
        break;
      case "type":
        comparison = TEXT_COLLATOR.compare(
          getEntryExtension(left) || (left.is_dir ? "folder" : "file"),
          getEntryExtension(right) || (right.is_dir ? "folder" : "file"),
        );
        break;
      case "name":
      default:
        comparison = TEXT_COLLATOR.compare(left.name, right.name);
        break;
    }
    if (comparison === 0) {
      comparison = TEXT_COLLATOR.compare(left.name, right.name);
    }
    return comparison * multiplier;
  });
}

function dedupeEntries(entries: readonly FileEntry[]): FileEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.path)) {
      return false;
    }
    seen.add(entry.path);
    return true;
  });
}

function intersectStringValues(
  left: readonly string[],
  right: readonly string[],
): string[] {
  const rightSet = new Set(right);
  const seen = new Set<string>();
  const sharedValues: string[] = [];
  for (const value of left) {
    if (!rightSet.has(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    sharedValues.push(value);
  }
  return sharedValues;
}

function formatExplorerPathLabel(path: string): string {
  if (!path) {
    return "the current folder";
  }
  const normalized = path.replace(/[/\\]+$/, "");
  const parts = normalized.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function formatRelativeModificationDistance(distanceMs: number): string {
  const hours = Math.round(distanceMs / (60 * 60 * 1000));
  if (hours <= 1) {
    return "about 1 hour";
  }
  if (hours < 24) {
    return `${hours} hours`;
  }
  const days = Math.round(hours / 24);
  if (days <= 1) {
    return "about 1 day";
  }
  return `${days} days`;
}

function createConstellationEdgeId(leftPath: string, rightPath: string): string {
  return TEXT_COLLATOR.compare(leftPath, rightPath) <= 0
    ? `${leftPath}::${rightPath}`
    : `${rightPath}::${leftPath}`;
}
