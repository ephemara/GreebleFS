import {
  CONSTELLATION_CONNECTION_DENSITY_BOUNDS,
  CONSTELLATION_MIN_EDGE_SCORE_BY_LENS,
  type ConstellationLensId,
} from "../../config/constellationGraph";
import type { ExplorerFileEntry as FileEntry } from "../../runtime/explorerBackend";
import type {
  ConstellationEdgeReason,
  ConstellationGraph,
  ConstellationGraphEdge,
} from "./constellationGraph";

export interface ConstellationOrbitBandInput {
  id: string;
  label: string;
  description: string;
  dominant: boolean;
  entries: FileEntry[];
}

export interface ConstellationFieldNode {
  entry: FileEntry;
  bandId: string;
  x: number;
  y: number;
  size: number;
  labelVisible: boolean;
  emphasis: "anchor" | "selected" | "satellite";
}

export interface ConstellationFieldBand extends ConstellationOrbitBandInput {
  centerX: number;
  centerY: number;
  radius: number;
  chipX: number;
  chipY: number;
  chipAlign: "left" | "right";
  nodes: ConstellationFieldNode[];
  hiddenEntryCount: number;
}

export interface ConstellationFieldConnection {
  id: string;
  edgeId: string;
  fromPath: string;
  toPath: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  strength: "bridge" | "primary" | "secondary";
  highlighted: boolean;
  dimmed: boolean;
  route: boolean;
  activeLensScore: number;
  reasons: ConstellationEdgeReason[];
}

export interface ConstellationFieldLayout {
  width: number;
  height: number;
  bands: ConstellationFieldBand[];
  connections: ConstellationFieldConnection[];
}

export interface ConstellationFieldLayoutOptions {
  graph?: ConstellationGraph | null;
  activeLens?: ConstellationLensId;
  pinnedPaths?: ReadonlySet<string>;
  routeAnchorPath?: string | null;
  routeTargetPaths?: ReadonlySet<string>;
  routeEdgeIds?: ReadonlySet<string>;
}

interface PositionedConstellationEntry {
  entry: FileEntry;
  hash: number;
  emphasis: ConstellationFieldNode["emphasis"];
  sourceIndex: number;
}

interface ClusterSlot {
  x: number;
  y: number;
  angleOffset: number;
  yScale: number;
  chipBiasX: number;
}

const FIELD_BOUNDS = Object.freeze({
  minWidth: 1520,
  wideWidth: 1720,
  minHeight: 920,
  tallHeight: 1080,
  paddingX: 108,
  paddingY: 92,
});

const EMPHASIS_RANK: Record<ConstellationFieldNode["emphasis"], number> = {
  selected: 0,
  anchor: 1,
  satellite: 2,
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const CLUSTER_SLOTS: Record<number, readonly ClusterSlot[]> = {
  1: [
    { x: 0.5, y: 0.5, angleOffset: -Math.PI / 2, yScale: 0.82, chipBiasX: -0.08 },
  ],
  2: [
    { x: 0.34, y: 0.47, angleOffset: -1.1, yScale: 0.84, chipBiasX: -0.5 },
    { x: 0.72, y: 0.46, angleOffset: 0.55, yScale: 0.86, chipBiasX: 0.44 },
  ],
  3: [
    { x: 0.33, y: 0.44, angleOffset: -1.15, yScale: 0.82, chipBiasX: -0.5 },
    { x: 0.72, y: 0.33, angleOffset: 0.2, yScale: 0.9, chipBiasX: 0.38 },
    { x: 0.65, y: 0.73, angleOffset: 1.3, yScale: 0.82, chipBiasX: 0.32 },
  ],
  4: [
    { x: 0.32, y: 0.38, angleOffset: -1.0, yScale: 0.82, chipBiasX: -0.52 },
    { x: 0.73, y: 0.3, angleOffset: 0.28, yScale: 0.88, chipBiasX: 0.36 },
    { x: 0.29, y: 0.72, angleOffset: -1.5, yScale: 0.78, chipBiasX: -0.46 },
    { x: 0.75, y: 0.7, angleOffset: 1.25, yScale: 0.8, chipBiasX: 0.3 },
  ],
  5: [
    { x: 0.34, y: 0.42, angleOffset: -1.0, yScale: 0.82, chipBiasX: -0.5 },
    { x: 0.73, y: 0.28, angleOffset: 0.15, yScale: 0.88, chipBiasX: 0.32 },
    { x: 0.26, y: 0.73, angleOffset: -1.65, yScale: 0.78, chipBiasX: -0.44 },
    { x: 0.74, y: 0.69, angleOffset: 1.25, yScale: 0.8, chipBiasX: 0.3 },
    { x: 0.52, y: 0.16, angleOffset: -0.4, yScale: 0.92, chipBiasX: -0.08 },
  ],
};

export function buildConstellationFieldLayout(
  bands: readonly ConstellationOrbitBandInput[],
  selectedPaths: ReadonlySet<string>,
  density: number,
  options?: ConstellationFieldLayoutOptions,
): ConstellationFieldLayout {
  const normalizedDensity = clamp(density, 0, 1);
  const maxVisibleNodes = clampNumber(Math.round(8 + normalizedDensity * 22), 8, 30);
  const visibleBands = bands.filter((band) => band.entries.length > 0);
  const pinnedPaths = options?.pinnedPaths ?? new Set<string>();

  if (visibleBands.length === 0) {
    return {
      width: FIELD_BOUNDS.minWidth,
      height: FIELD_BOUNDS.minHeight,
      bands: [],
      connections: [],
    };
  }

  const width = visibleBands.length >= 4 ? FIELD_BOUNDS.wideWidth : FIELD_BOUNDS.minWidth;
  const height = visibleBands.length >= 4 ? FIELD_BOUNDS.tallHeight : FIELD_BOUNDS.minHeight;
  const slots = CLUSTER_SLOTS[visibleBands.length] ?? CLUSTER_SLOTS[5];
  const fieldBands: ConstellationFieldBand[] = [];
  const connections: ConstellationFieldConnection[] = [];
  let dominantPrimaryNode: ConstellationFieldNode | null = null;

  visibleBands.forEach((band, bandIndex) => {
    const slot = resolveClusterSlot(slots, bandIndex, visibleBands.length);
    const visibleEntries = band.entries.slice(0, maxVisibleNodes);
    const anchorQuota = visibleBands.length === 1 ? 2 : band.dominant ? 4 : 2;
    const singleBandNodeScale = visibleBands.length === 1 ? 0.84 : 1;
    const positionedEntries = visibleEntries
      .map((entry, index) => ({
        entry,
        hash: hashExplorerString(entry.path),
        emphasis: selectedPaths.has(entry.path)
          ? "selected"
          : pinnedPaths.has(entry.path) || index < anchorQuota
            ? "anchor"
            : "satellite",
        sourceIndex: index,
      }) satisfies PositionedConstellationEntry)
      .sort((left, right) => (
        EMPHASIS_RANK[left.emphasis] - EMPHASIS_RANK[right.emphasis]
        || left.hash - right.hash
        || left.sourceIndex - right.sourceIndex
        || left.entry.name.localeCompare(right.entry.name, undefined, {
          sensitivity: "base",
          numeric: true,
        })
      ));

    const centerX = clampNumber(width * slot.x, FIELD_BOUNDS.paddingX, width - FIELD_BOUNDS.paddingX);
    const centerY = clampNumber(height * slot.y, FIELD_BOUNDS.paddingY, height - FIELD_BOUNDS.paddingY);
    const singleBandSpreadBonus = visibleBands.length === 1 ? 136 : 0;
    const radius = Math.round(
      (band.dominant ? 248 : 210)
      + Math.min(band.entries.length * 4, band.dominant ? 78 : 58)
      + singleBandSpreadBonus
      + normalizedDensity * 36,
    );

    const primaryEntry = positionedEntries.find((entry) => entry.emphasis === "selected")
      ?? positionedEntries.find((entry) => entry.emphasis === "anchor")
      ?? positionedEntries[0]
      ?? null;
    const coreEntries = primaryEntry
      ? positionedEntries.filter((entry) => entry.entry.path !== primaryEntry.entry.path)
      : positionedEntries;
    const anchoredEntries = coreEntries.filter((entry) => entry.emphasis !== "satellite");
    const satelliteEntries = coreEntries.filter((entry) => entry.emphasis === "satellite");
    const nodes: ConstellationFieldNode[] = [];

    if (primaryEntry) {
      nodes.push({
        entry: primaryEntry.entry,
        bandId: band.id,
        x: centerX,
        y: centerY,
        size: Math.max(
          28,
          Math.round(
            getConstellationNodeSize(primaryEntry.emphasis, band.dominant, normalizedDensity, 0)
            * singleBandNodeScale,
          ),
        ),
        labelVisible: true,
        emphasis: primaryEntry.emphasis,
      });
    }

    anchoredEntries.forEach((positionedEntry, index) => {
      const anchoredAngle = slot.angleOffset
        + ((Math.PI * 2) / Math.max(1, anchoredEntries.length)) * index
        + getHashAngleJitter(positionedEntry.hash, 0.16);
      const anchoredRadius = radius * (0.36 + ((index % 2) * 0.1));
      nodes.push(createConstellationFieldNode({
        bandId: band.id,
        positionedEntry,
        x: centerX + Math.cos(anchoredAngle) * anchoredRadius,
        y: centerY + Math.sin(anchoredAngle) * anchoredRadius * slot.yScale,
        width,
        height,
        size: Math.max(
          28,
          Math.round(
            getConstellationNodeSize(positionedEntry.emphasis, band.dominant, normalizedDensity, 1)
            * singleBandNodeScale,
          ),
        ),
        labelVisible: true,
      }));
    });

    satelliteEntries.forEach((positionedEntry, index) => {
      const progress = (index + 0.72) / Math.max(1, satelliteEntries.length + 0.72);
      const satelliteAngle = slot.angleOffset
        + (index * GOLDEN_ANGLE)
        + getHashAngleJitter(positionedEntry.hash, 0.22);
      const satelliteRadius = radius * (0.42 + Math.sqrt(progress) * 0.58);
      const yScale = slot.yScale * (0.92 + (((positionedEntry.hash >> 3) % 7) * 0.015));
      nodes.push(createConstellationFieldNode({
        bandId: band.id,
        positionedEntry,
        x: centerX + Math.cos(satelliteAngle) * satelliteRadius,
        y: centerY + Math.sin(satelliteAngle) * satelliteRadius * yScale,
        width,
        height,
        size: Math.max(
          26,
          Math.round(
            getConstellationNodeSize(positionedEntry.emphasis, band.dominant, normalizedDensity, 2)
            * singleBandNodeScale,
          ),
        ),
        labelVisible: visibleBands.length > 1 && (band.dominant
          ? normalizedDensity >= 0.7 && index < 2
          : normalizedDensity >= 0.82 && index < 2),
      }));
    });

    const bandPrimaryNode = nodes.find((node) => node.entry.path === primaryEntry?.entry.path) ?? nodes[0] ?? null;
    const bandCoreNodes = nodes.filter((node) => node.emphasis !== "satellite");
    const bandSatelliteNodes = nodes.filter((node) => node.emphasis === "satellite");

    if (bandPrimaryNode) {
      if (band.dominant && !dominantPrimaryNode) {
        dominantPrimaryNode = bandPrimaryNode;
      }

      bandCoreNodes
        .filter((node) => node.entry.path !== bandPrimaryNode.entry.path)
        .forEach((node) => {
          connections.push(createConstellationConnection(bandPrimaryNode, node, "primary"));
        });

      bandSatelliteNodes.forEach((node, index) => {
        const anchorNode = bandCoreNodes.length > 1
          ? bandCoreNodes[(index % Math.max(1, bandCoreNodes.length - 1)) + 1] ?? bandPrimaryNode
          : bandPrimaryNode;
        connections.push(createConstellationConnection(anchorNode, node, "secondary"));
        if (normalizedDensity >= 0.46 && index > 0 && index % 2 === 0) {
          connections.push(createConstellationConnection(bandSatelliteNodes[index - 1], node, "secondary"));
        }
      });
    }

    const chipAlign = slot.chipBiasX > 0 ? "left" : "right";
    const chipX = clampNumber(
      centerX + (radius * slot.chipBiasX),
      FIELD_BOUNDS.paddingX,
      width - FIELD_BOUNDS.paddingX,
    );
    const chipY = clampNumber(
      centerY - (radius * (band.dominant ? 0.54 : 0.62)),
      FIELD_BOUNDS.paddingY,
      height - FIELD_BOUNDS.paddingY,
    );

    fieldBands.push({
      ...band,
      centerX,
      centerY,
      radius,
      chipX,
      chipY,
      chipAlign,
      nodes,
      hiddenEntryCount: Math.max(0, band.entries.length - visibleEntries.length),
    });
  });

  if (!dominantPrimaryNode) {
    dominantPrimaryNode = fieldBands.find((band) => band.nodes.length > 0)?.nodes[0] ?? null;
  }

  if (dominantPrimaryNode) {
    const dominantNode = dominantPrimaryNode;
    fieldBands.forEach((band) => {
      const bandPrimaryNode = band.nodes[0] ?? null;
      if (
        !bandPrimaryNode
        || bandPrimaryNode.entry.path === dominantNode.entry.path
      ) {
        return;
      }
      connections.push(createConstellationConnection(dominantNode, bandPrimaryNode, "bridge"));
    });
  }

  const resolvedConnections = options?.graph
    ? buildConstellationGraphConnections({
      bands: fieldBands,
      graph: options.graph,
      activeLens: options.activeLens ?? "workflow",
      density: normalizedDensity,
      routeAnchorPath: options.routeAnchorPath ?? null,
      routeTargetPaths: options.routeTargetPaths ?? new Set<string>(),
      routeEdgeIds: options.routeEdgeIds ?? new Set<string>(),
      selectedPaths,
    })
    : dedupeConstellationConnections(connections);

  return {
    width,
    height,
    bands: fieldBands,
    connections: resolvedConnections,
  };
}

function createConstellationFieldNode(input: {
  bandId: string;
  positionedEntry: PositionedConstellationEntry;
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
  labelVisible: boolean;
}): ConstellationFieldNode {
  const clamped = clampConstellationPoint(
    { x: input.x, y: input.y },
    input.width,
    input.height,
  );
  return {
    entry: input.positionedEntry.entry,
    bandId: input.bandId,
    x: clamped.x,
    y: clamped.y,
    size: input.size,
    labelVisible: input.labelVisible || input.positionedEntry.emphasis !== "satellite",
    emphasis: input.positionedEntry.emphasis,
  };
}

function createConstellationConnection(
  from: ConstellationFieldNode,
  to: ConstellationFieldNode,
  strength: ConstellationFieldConnection["strength"],
): ConstellationFieldConnection {
  const connectionId = createConstellationConnectionId(from.entry.path, to.entry.path);
  return {
    id: connectionId,
    edgeId: connectionId,
    fromPath: from.entry.path,
    toPath: to.entry.path,
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    strength,
    highlighted: from.emphasis === "selected" || to.emphasis === "selected",
    dimmed: false,
    route: false,
    activeLensScore: strength === "primary" ? 1 : strength === "bridge" ? 0.82 : 0.48,
    reasons: [],
  };
}

function createConstellationConnectionId(leftPath: string, rightPath: string): string {
  return leftPath <= rightPath ? `${leftPath}::${rightPath}` : `${rightPath}::${leftPath}`;
}

function dedupeConstellationConnections(
  connections: readonly ConstellationFieldConnection[],
): ConstellationFieldConnection[] {
  const deduped = new Map<string, ConstellationFieldConnection>();
  const strengthRank: Record<ConstellationFieldConnection["strength"], number> = {
    secondary: 0,
    bridge: 1,
    primary: 2,
  };

  connections.forEach((connection) => {
    const previous = deduped.get(connection.id);
    if (!previous) {
      deduped.set(connection.id, connection);
      return;
    }

    const previousRank = strengthRank[previous.strength];
    const nextRank = strengthRank[connection.strength];
    if (nextRank > previousRank || connection.highlighted) {
      deduped.set(connection.id, {
        ...connection,
        highlighted: previous.highlighted || connection.highlighted,
        dimmed: previous.dimmed && connection.dimmed,
        route: previous.route || connection.route,
        activeLensScore: Math.max(previous.activeLensScore, connection.activeLensScore),
        reasons: previous.reasons.length > 0 ? previous.reasons : connection.reasons,
      });
    }
  });

  return Array.from(deduped.values());
}

function getConstellationNodeSize(
  emphasis: ConstellationFieldNode["emphasis"],
  dominant: boolean,
  density: number,
  tier: number,
): number {
  const base = emphasis === "selected"
    ? (dominant ? 56 : 50)
    : emphasis === "anchor"
      ? (dominant ? 46 : 42)
      : 30;
  const densityPenalty = emphasis === "satellite" ? 7 : 8;
  const tierPenalty = tier === 0 ? 0 : tier === 1 ? 4 : 2;
  return Math.max(24, Math.round(base - (density * densityPenalty) - tierPenalty));
}

function buildConstellationGraphConnections(args: {
  bands: readonly ConstellationFieldBand[];
  graph: ConstellationGraph;
  activeLens: ConstellationLensId;
  density: number;
  routeAnchorPath: string | null;
  routeTargetPaths: ReadonlySet<string>;
  routeEdgeIds: ReadonlySet<string>;
  selectedPaths: ReadonlySet<string>;
}): ConstellationFieldConnection[] {
  const nodeLookup = new Map<string, ConstellationFieldNode>();
  for (const band of args.bands) {
    for (const node of band.nodes) {
      nodeLookup.set(node.entry.path, node);
    }
  }

  const perNodeLimit = clampNumber(
    Math.round(
      CONSTELLATION_CONNECTION_DENSITY_BOUNDS.minPerNode + (args.density * 4),
    ),
    CONSTELLATION_CONNECTION_DENSITY_BOUNDS.minPerNode,
    CONSTELLATION_CONNECTION_DENSITY_BOUNDS.maxPerNode,
  );
  const totalLimit = clampNumber(
    Math.round(
      CONSTELLATION_CONNECTION_DENSITY_BOUNDS.minTotal + (args.density * 20),
    ),
    CONSTELLATION_CONNECTION_DENSITY_BOUNDS.minTotal,
    CONSTELLATION_CONNECTION_DENSITY_BOUNDS.maxTotal,
  );
  const minimumScore = CONSTELLATION_MIN_EDGE_SCORE_BY_LENS[args.activeLens];
  const nodeConnectionCount = new Map<string, number>();
  const candidateEdges = args.graph.edges
    .filter((edge) => (
      nodeLookup.has(edge.fromPath) &&
      nodeLookup.has(edge.toPath) &&
      (
        edge.scoreByLens[args.activeLens] >= minimumScore ||
        args.routeEdgeIds.has(edge.id)
      )
    ))
    .sort((left, right) => (
      Number(args.routeEdgeIds.has(right.id)) - Number(args.routeEdgeIds.has(left.id)) ||
      Number(args.selectedPaths.has(right.fromPath) || args.selectedPaths.has(right.toPath))
        - Number(args.selectedPaths.has(left.fromPath) || args.selectedPaths.has(left.toPath)) ||
      right.scoreByLens[args.activeLens] - left.scoreByLens[args.activeLens]
    ));
  const connections: ConstellationFieldConnection[] = [];

  for (const edge of candidateEdges) {
    const fromNode = nodeLookup.get(edge.fromPath);
    const toNode = nodeLookup.get(edge.toPath);
    if (!fromNode || !toNode) {
      continue;
    }

    const route = args.routeEdgeIds.has(edge.id);
    const fromCount = nodeConnectionCount.get(edge.fromPath) ?? 0;
    const toCount = nodeConnectionCount.get(edge.toPath) ?? 0;
    if (!route && connections.length >= totalLimit) {
      continue;
    }
    if (!route && fromCount >= perNodeLimit && toCount >= perNodeLimit) {
      continue;
    }

    connections.push(createConstellationGraphConnection({
      fromNode,
      toNode,
      edge,
      activeLens: args.activeLens,
      dimmed: args.routeTargetPaths.size > 0 && !route,
      route,
      highlighted:
        route ||
        args.selectedPaths.has(edge.fromPath) ||
        args.selectedPaths.has(edge.toPath) ||
        edge.fromPath === args.routeAnchorPath ||
        edge.toPath === args.routeAnchorPath,
    }));
    nodeConnectionCount.set(edge.fromPath, fromCount + 1);
    nodeConnectionCount.set(edge.toPath, toCount + 1);
  }

  return connections;
}

function createConstellationGraphConnection(args: {
  fromNode: ConstellationFieldNode;
  toNode: ConstellationFieldNode;
  edge: ConstellationGraphEdge;
  activeLens: ConstellationLensId;
  highlighted: boolean;
  dimmed: boolean;
  route: boolean;
}): ConstellationFieldConnection {
  const lensScore = args.edge.scoreByLens[args.activeLens];
  return {
    id: args.edge.id,
    edgeId: args.edge.id,
    fromPath: args.fromNode.entry.path,
    toPath: args.toNode.entry.path,
    fromX: args.fromNode.x,
    fromY: args.fromNode.y,
    toX: args.toNode.x,
    toY: args.toNode.y,
    strength: getConstellationConnectionStrength(lensScore, args.route),
    highlighted: args.highlighted,
    dimmed: args.dimmed,
    route: args.route,
    activeLensScore: lensScore,
    reasons: [...args.edge.reasons],
  };
}

function getConstellationConnectionStrength(
  score: number,
  route: boolean,
): ConstellationFieldConnection["strength"] {
  if (route || score >= 1.2) {
    return "primary";
  }
  if (score >= 0.78) {
    return "bridge";
  }
  return "secondary";
}

function resolveClusterSlot(
  slots: readonly ClusterSlot[],
  index: number,
  bandCount: number,
): ClusterSlot {
  const direct = slots[index];
  if (direct) {
    return direct;
  }

  const progress = (index - slots.length + 1) / Math.max(1, bandCount);
  return {
    x: clamp(0.5 + Math.cos(progress * Math.PI * 2) * 0.24, 0.24, 0.76),
    y: clamp(0.5 + Math.sin(progress * Math.PI * 2) * 0.26, 0.2, 0.8),
    angleOffset: progress * Math.PI * 2,
    yScale: 0.84,
    chipBiasX: Math.cos(progress * Math.PI * 2) >= 0 ? 0.3 : -0.3,
  };
}

function clampConstellationPoint(
  point: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: clampNumber(point.x, FIELD_BOUNDS.paddingX, width - FIELD_BOUNDS.paddingX),
    y: clampNumber(point.y, FIELD_BOUNDS.paddingY, height - FIELD_BOUNDS.paddingY),
  };
}

function getHashAngleJitter(hash: number, amplitude: number): number {
  return ((((hash >> 5) % 31) / 30) - 0.5) * amplitude;
}

function hashExplorerString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
