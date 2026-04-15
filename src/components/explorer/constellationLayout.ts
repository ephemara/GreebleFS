import type { ExplorerFileEntry as FileEntry } from '../../runtime/explorerBackend';

export interface ConstellationOrbitBandInput {
  id: string;
  label: string;
  description: string;
  dominant: boolean;
  entries: FileEntry[];
}

export interface ConstellationOrbitNode {
  entry: FileEntry;
  x: number;
  y: number;
  size: number;
  labelVisible: boolean;
  emphasis: 'anchor' | 'selected' | 'satellite';
}

export interface ConstellationOrbitBand extends ConstellationOrbitBandInput {
  nodes: ConstellationOrbitNode[];
  hiddenEntryCount: number;
}

interface PositionedConstellationEntry {
  entry: FileEntry;
  hash: number;
  emphasis: ConstellationOrbitNode['emphasis'];
  sourceIndex: number;
}

interface ConstellationOrbitLane {
  width: number;
  height: number;
  slotOffset: number;
  reverseDirection: boolean;
}

const CONSTELLATION_FIELD_BOUNDS = Object.freeze({
  minX: 11,
  maxX: 89,
  minY: 12,
  maxY: 88,
});

const CONSTELLATION_SLOT_PROGRESS_SEQUENCE = [
  0.25,
  0.75,
  0,
  0.5,
  0.125,
  0.625,
  0.375,
  0.875,
  0.0625,
  0.5625,
  0.3125,
  0.8125,
  0.1875,
  0.6875,
  0.4375,
  0.9375,
] as const;

export function buildConstellationOrbitBands(
  bands: readonly ConstellationOrbitBandInput[],
  selectedPaths: ReadonlySet<string>,
  density: number,
): ConstellationOrbitBand[] {
  const normalizedDensity = Math.min(1, Math.max(0, density));
  const maxVisibleNodes = Math.max(6, Math.min(24, Math.round(6 + normalizedDensity * 18)));

  return bands
    .filter((band) => band.entries.length > 0)
    .map((band) => {
      const visibleEntries = band.entries.slice(0, maxVisibleNodes);
      const hubBaseSize = band.dominant ? 46 : 42;
      const nodeBaseSize = band.dominant ? 34 : 30;
      const positionedEntries = visibleEntries
        .map((entry, index) => {
          const emphasis = selectedPaths.has(entry.path)
            ? 'selected'
            : entry.is_dir || (band.dominant && index < 3)
              ? 'anchor'
              : 'satellite';

          return {
            entry,
            hash: hashExplorerString(entry.path),
            emphasis,
            sourceIndex: index,
          } satisfies PositionedConstellationEntry;
        })
        .sort((left, right) => (
          left.hash - right.hash
          || left.sourceIndex - right.sourceIndex
          || left.entry.name.localeCompare(right.entry.name, undefined, { sensitivity: 'base', numeric: true })
        ));

      const orbitLanes = buildConstellationOrbitLanes(positionedEntries.length, normalizedDensity, band.dominant);
      const laneBuckets = orbitLanes.map(() => [] as PositionedConstellationEntry[]);

      positionedEntries.forEach((positionedEntry, index) => {
        laneBuckets[index % orbitLanes.length].push(positionedEntry);
      });

      const nodes = laneBuckets.flatMap((laneEntries, laneIndex) => {
        const lane = orbitLanes[laneIndex];

        return laneEntries.map((positionedEntry, slotIndex) => {
          const { x, y } = projectConstellationOrbitPoint(slotIndex, laneEntries.length, lane, positionedEntry.hash);
          const size = Math.max(
            26,
            Math.round(
              (positionedEntry.emphasis === 'anchor'
                ? hubBaseSize
                : positionedEntry.emphasis === 'selected'
                  ? hubBaseSize - 2
                  : nodeBaseSize)
              - normalizedDensity * 8
              - laneIndex * 2,
            ),
          );

          return {
            entry: positionedEntry.entry,
            x,
            y,
            size,
            labelVisible: normalizedDensity > 0.28 || positionedEntry.emphasis !== 'satellite' || slotIndex < 3,
            emphasis: positionedEntry.emphasis,
          } satisfies ConstellationOrbitNode;
        });
      });

      return {
        ...band,
        nodes,
        hiddenEntryCount: Math.max(0, band.entries.length - visibleEntries.length),
      };
    });
}

function buildConstellationOrbitLanes(
  nodeCount: number,
  density: number,
  dominant: boolean,
): ConstellationOrbitLane[] {
  const laneCount = Math.max(
    2,
    Math.min(
      5,
      2
      + (density >= 0.42 ? 1 : 0)
      + (nodeCount >= 10 ? 1 : 0)
      + (nodeCount >= 18 ? 1 : 0),
    ),
  );

  const minWidth = dominant ? 40 : 36;
  const maxWidth = dominant ? 86 : 80;
  const minHeight = dominant ? 24 : 22;
  const maxHeight = dominant ? 58 : 52;
  const widthStep = laneCount <= 1 ? 0 : (maxWidth - minWidth) / (laneCount - 1);
  const heightStep = laneCount <= 1 ? 0 : (maxHeight - minHeight) / (laneCount - 1);

  return Array.from({ length: laneCount }, (_, laneIndex) => ({
    width: minWidth + widthStep * laneIndex,
    height: minHeight + heightStep * laneIndex,
    slotOffset: laneIndex,
    reverseDirection: laneIndex % 2 === 1,
  }));
}

function projectConstellationOrbitPoint(
  slotIndex: number,
  slotCount: number,
  lane: ConstellationOrbitLane,
  entryHash: number,
): { x: number; y: number } {
  const baseProgress = slotCount <= 0
    ? 0
    : getConstellationOrbitSlotProgress(slotIndex + lane.slotOffset);
  const jitterWindow = Math.min(0.012, 0.06 / Math.max(4, slotCount));
  const jitter = ((((entryHash >> 3) % 29) / 28) - 0.5) * jitterWindow;
  const phasedProgress = wrapUnitInterval(baseProgress + jitter);
  const orbitProgress = lane.reverseDirection
    ? wrapUnitInterval(1 - phasedProgress)
    : phasedProgress;

  return projectStadiumOrbitProgress(orbitProgress, lane.width, lane.height);
}

function getConstellationOrbitSlotProgress(slotIndex: number): number {
  const presetProgress = CONSTELLATION_SLOT_PROGRESS_SEQUENCE[slotIndex];
  if (typeof presetProgress === 'number') {
    return presetProgress;
  }

  return wrapUnitInterval(0.25 + (slotIndex * 0.61803398875));
}

function projectStadiumOrbitProgress(
  progress: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const orbitHeight = Math.max(12, height);
  const orbitWidth = Math.max(orbitHeight, width);
  const orbitRadius = orbitHeight / 2;
  const straightLength = Math.max(0, orbitWidth - orbitHeight);
  const perimeter = (straightLength * 2) + (orbitRadius * Math.PI * 2);
  let distance = wrapUnitInterval(progress) * perimeter;

  const centerX = 50;
  const centerY = 50;
  const leftArcCenterX = centerX - (straightLength / 2);
  const rightArcCenterX = centerX + (straightLength / 2);
  const topY = centerY - orbitRadius;
  const bottomY = centerY + orbitRadius;

  if (distance <= straightLength) {
    return clampConstellationPoint({ x: leftArcCenterX + distance, y: topY });
  }

  distance -= straightLength;
  const rightArcLength = orbitRadius * Math.PI;
  if (distance <= rightArcLength) {
    const angle = (-Math.PI / 2) + (distance / orbitRadius);
    return clampConstellationPoint({
      x: rightArcCenterX + Math.cos(angle) * orbitRadius,
      y: centerY + Math.sin(angle) * orbitRadius,
    });
  }

  distance -= rightArcLength;
  if (distance <= straightLength) {
    return clampConstellationPoint({ x: rightArcCenterX - distance, y: bottomY });
  }

  distance -= straightLength;
  const angle = (Math.PI / 2) + (distance / orbitRadius);
  return clampConstellationPoint({
    x: leftArcCenterX + Math.cos(angle) * orbitRadius,
    y: centerY + Math.sin(angle) * orbitRadius,
  });
}

function hashExplorerString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function clampConstellationPoint(point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: clamp(point.x, CONSTELLATION_FIELD_BOUNDS.minX, CONSTELLATION_FIELD_BOUNDS.maxX),
    y: clamp(point.y, CONSTELLATION_FIELD_BOUNDS.minY, CONSTELLATION_FIELD_BOUNDS.maxY),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapUnitInterval(value: number): number {
  return ((value % 1) + 1) % 1;
}
