import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';

import { getManagedContentDirectory } from './appContentDirectories';
import { joinPlatformPath } from './platform';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
import { listLocalDirectoryEntriesFast } from '../runtime/localDirectoryListing';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

type LooseRecord = Record<string, unknown>;

export const overlaySoundEffectCatalog = [
  {
    id: 'shell-button-press',
    label: 'Shell Button Press',
    groupId: 'button',
    description: 'Primary shell button click and chrome confirmations.',
  },
  {
    id: 'explorer-selection-step',
    label: 'Explorer Selection Step',
    groupId: 'navigation',
    description: 'Directional key travel through explorer results.',
  },
  {
    id: 'explorer-open-entry',
    label: 'Explorer Open Entry',
    groupId: 'navigation',
    description: 'Opening a file or navigating into a folder.',
  },
  {
    id: 'task-start',
    label: 'Task Start',
    groupId: 'task',
    description: 'Transfer and background task kickoff.',
  },
  {
    id: 'task-success',
    label: 'Task Success',
    groupId: 'task',
    description: 'Completed explorer task or finished transfer.',
  },
  {
    id: 'task-failure',
    label: 'Task Failure',
    groupId: 'task',
    description: 'Failed or cancelled explorer task.',
  },
  {
    id: 'notification-info',
    label: 'Notification Info',
    groupId: 'notification',
    description: 'Informational native notification or test ping.',
  },
  {
    id: 'notification-success',
    label: 'Notification Success',
    groupId: 'notification',
    description: 'Successful native notification test or routing check.',
  },
  {
    id: 'notification-error',
    label: 'Notification Error',
    groupId: 'notification',
    description: 'Warning or failure native notification cue.',
  },
] as const;

export type OverlaySoundEffectId = typeof overlaySoundEffectCatalog[number]['id'];
export type OverlaySoundEffectGroupId = typeof overlaySoundEffectCatalog[number]['groupId'];

export interface OverlaySoundToneManifest {
  frequency?: number;
  durationMs?: number;
  offsetMs?: number;
  gain?: number;
  waveform?: OscillatorType;
  detuneCents?: number;
  pan?: number;
}

export interface OverlaySoundNoiseLayerManifest {
  durationMs?: number;
  offsetMs?: number;
  gain?: number;
  highpassHz?: number;
  lowpassHz?: number;
  pan?: number;
}

export interface OverlaySoundSampleCueManifest {
  kind: 'sample';
  file?: string;
  volume?: number;
  playbackRate?: number;
  cooldownMs?: number;
}

export interface OverlaySoundSynthCueManifest {
  kind?: 'synth';
  volume?: number;
  cooldownMs?: number;
  tones?: OverlaySoundToneManifest[];
  noiseLayers?: OverlaySoundNoiseLayerManifest[];
}

export type OverlaySoundCueManifest = OverlaySoundSampleCueManifest | OverlaySoundSynthCueManifest;

export interface OverlaySoundPackManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  masterVolume?: number;
  sounds?: Partial<Record<OverlaySoundEffectId, OverlaySoundCueManifest>>;
}

interface OverlaySoundPackRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: OverlaySoundPackManifest;
}

export interface LoadedOverlaySoundTone {
  frequency: number;
  durationMs: number;
  offsetMs: number;
  gain: number;
  waveform: OscillatorType;
  detuneCents: number;
  pan: number;
}

export interface LoadedOverlaySoundNoiseLayer {
  durationMs: number;
  offsetMs: number;
  gain: number;
  highpassHz: number | null;
  lowpassHz: number | null;
  pan: number;
}

export interface LoadedOverlaySoundSampleCue {
  kind: 'sample';
  sourceUrl: string;
  volume: number;
  playbackRate: number;
  cooldownMs: number;
}

export interface LoadedOverlaySoundSynthCue {
  kind: 'synth';
  volume: number;
  cooldownMs: number;
  tones: LoadedOverlaySoundTone[];
  noiseLayers: LoadedOverlaySoundNoiseLayer[];
}

export type LoadedOverlaySoundCue = LoadedOverlaySoundSampleCue | LoadedOverlaySoundSynthCue;

export interface LoadedOverlaySoundPack {
  id: string;
  localId: string;
  name: string;
  version: number;
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'built-in' | 'sound-pack-directory';
  sourceLabel: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags: string[];
  warnings: string[];
  masterVolume: number;
  sounds: Partial<Record<OverlaySoundEffectId, LoadedOverlaySoundCue>>;
}

export interface SoundPackLoadResult {
  packs: LoadedOverlaySoundPack[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}

interface SoundPackLoadOptions {
  includeBuiltIns?: boolean;
  scopeId?: string;
  sourceKind?: LoadedOverlaySoundPack['sourceKind'];
  sourceLabel?: string;
}

export const DEFAULT_SOUND_PACK_ID = 'greeblefs-default-shell-sounds';

export const soundPackSystemConfig = {
  get soundPacksDirectory(): string {
    return getManagedContentDirectory('soundPacks');
  },
  manifestNames: ['sound-pack.json', 'sound-pack.toml', 'manifest.json', 'manifest.toml'] as const,
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as LooseRecord;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function clampUnit(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, 0), 1);
}

function clampFrequency(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, 20), 22050);
}

function clampDuration(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(value), 0), 5000);
}

function clampPan(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, -1), 1);
}

function clampPlaybackRate(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, 0.25), 4);
}

function normalizeSoundPackIdFragment(value: string | undefined, fallback: string): string {
  const normalized = (value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function createScopedSoundPackId(scopeId: string | undefined, localId: string): string {
  const normalizedLocalId = normalizeSoundPackIdFragment(localId, 'sound-pack');
  if (!scopeId) {
    return normalizedLocalId;
  }

  return `${normalizeSoundPackIdFragment(scopeId, 'theme-bundle')}:${normalizedLocalId}`;
}

function deriveDisplayName(id: string): string {
  return id
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getParentDirectoryPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return normalized.startsWith('/') ? '/' : '.';
  }

  return normalized.slice(0, lastSlash);
}

function normalizeRelativeAssetPath(path: string): string | null {
  const trimmed = path.trim().replace(/\\/g, '/');
  if (!trimmed || trimmed.startsWith('/') || /^[A-Za-z]:\//.test(trimmed)) {
    return null;
  }

  const segments: string[] = [];
  for (const segment of trimmed.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (segments.length === 0) {
        return null;
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.join('/');
}

function toAssetUrl(filePath: string): string {
  if (typeof window === 'undefined') {
    return filePath;
  }

  try {
    return convertFileSrc(filePath);
  } catch {
    const normalized = filePath.replace(/\\/g, '/');
    return normalized.startsWith('/') ? `file://${encodeURI(normalized)}` : `file:///${encodeURI(normalized)}`;
  }
}

function parseSoundCueManifest(value: unknown): OverlaySoundCueManifest | null {
  const source = asRecord(value);
  if (!source) {
    return null;
  }

  const kind = asString(source.kind).toLowerCase();
  if (kind === 'sample') {
    return {
      kind: 'sample',
      file: asString(source.file),
      volume: typeof source.volume === 'number' ? source.volume : undefined,
      playbackRate: typeof source.playbackRate === 'number' ? source.playbackRate : undefined,
      cooldownMs: typeof source.cooldownMs === 'number' ? source.cooldownMs : undefined,
    };
  }

  const tones = Array.isArray(source.tones)
    ? source.tones
      .map((entry) => asRecord(entry))
      .filter((entry): entry is LooseRecord => entry != null)
      .map((entry) => ({
        frequency: typeof entry.frequency === 'number' ? entry.frequency : undefined,
        durationMs: typeof entry.durationMs === 'number' ? entry.durationMs : undefined,
        offsetMs: typeof entry.offsetMs === 'number' ? entry.offsetMs : undefined,
        gain: typeof entry.gain === 'number' ? entry.gain : undefined,
        waveform: asString(entry.waveform) as OscillatorType,
        detuneCents: typeof entry.detuneCents === 'number' ? entry.detuneCents : undefined,
        pan: typeof entry.pan === 'number' ? entry.pan : undefined,
      }))
    : [];
  const noiseLayers = Array.isArray(source.noiseLayers)
    ? source.noiseLayers
      .map((entry) => asRecord(entry))
      .filter((entry): entry is LooseRecord => entry != null)
      .map((entry) => ({
        durationMs: typeof entry.durationMs === 'number' ? entry.durationMs : undefined,
        offsetMs: typeof entry.offsetMs === 'number' ? entry.offsetMs : undefined,
        gain: typeof entry.gain === 'number' ? entry.gain : undefined,
        highpassHz: typeof entry.highpassHz === 'number' ? entry.highpassHz : undefined,
        lowpassHz: typeof entry.lowpassHz === 'number' ? entry.lowpassHz : undefined,
        pan: typeof entry.pan === 'number' ? entry.pan : undefined,
      }))
    : [];

  return {
    kind: 'synth',
    volume: typeof source.volume === 'number' ? source.volume : undefined,
    cooldownMs: typeof source.cooldownMs === 'number' ? source.cooldownMs : undefined,
    tones,
    noiseLayers,
  };
}

function parseSoundPackManifestText(text: string, filePath: string): OverlaySoundPackManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Sound-pack manifest is empty: ${filePath}`);
  }

  const parsed = filePath.toLowerCase().endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const source = asRecord(parsed);
  if (!source) {
    throw new Error(`Sound-pack manifest must be an object: ${filePath}`);
  }

  const soundsSource = asRecord(source.sounds);
  const sounds = Object.fromEntries(
    overlaySoundEffectCatalog
      .map((effect) => {
        const cue = parseSoundCueManifest(soundsSource?.[effect.id]);
        return cue ? [effect.id, cue] as const : null;
      })
      .filter((entry): entry is readonly [OverlaySoundEffectId, OverlaySoundCueManifest] => entry != null),
  ) as Partial<Record<OverlaySoundEffectId, OverlaySoundCueManifest>>;

  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    masterVolume: typeof source.masterVolume === 'number' ? source.masterVolume : undefined,
    sounds,
  };
}

function createLoadedSoundCue(
  cue: OverlaySoundCueManifest,
  directoryPath: string,
  warnings: string[],
  effectId: OverlaySoundEffectId,
): LoadedOverlaySoundCue | null {
  if (cue.kind === 'sample') {
    const normalizedFile = normalizeRelativeAssetPath(asString(cue.file));
    if (!normalizedFile) {
      warnings.push(`Sound "${effectId}" references an invalid sample file path.`);
      return null;
    }

    return {
      kind: 'sample',
      sourceUrl: toAssetUrl(joinPlatformPath(directoryPath, normalizedFile)),
      volume: clampUnit(cue.volume, 1),
      playbackRate: clampPlaybackRate(cue.playbackRate, 1),
      cooldownMs: clampDuration(cue.cooldownMs, 40),
    };
  }

  const tones: LoadedOverlaySoundTone[] = (cue.tones ?? [])
    .map((tone) => ({
      frequency: clampFrequency(tone.frequency, 440),
      durationMs: clampDuration(tone.durationMs, 48),
      offsetMs: clampDuration(tone.offsetMs, 0),
      gain: clampUnit(tone.gain, 0.24),
      waveform: tone.waveform === 'square' || tone.waveform === 'sawtooth' || tone.waveform === 'triangle'
        ? tone.waveform
        : 'sine' as OscillatorType,
      detuneCents: typeof tone.detuneCents === 'number' && Number.isFinite(tone.detuneCents)
        ? Math.min(Math.max(tone.detuneCents, -4800), 4800)
        : 0,
      pan: clampPan(tone.pan, 0),
    }))
    .filter((tone) => tone.durationMs > 0 && tone.frequency > 0 && tone.gain > 0);
  const noiseLayers: LoadedOverlaySoundNoiseLayer[] = (cue.noiseLayers ?? [])
    .map((noiseLayer) => ({
      durationMs: clampDuration(noiseLayer.durationMs, 24),
      offsetMs: clampDuration(noiseLayer.offsetMs, 0),
      gain: clampUnit(noiseLayer.gain, 0.12),
      highpassHz: typeof noiseLayer.highpassHz === 'number' && Number.isFinite(noiseLayer.highpassHz)
        ? clampFrequency(noiseLayer.highpassHz, 1200)
        : null,
      lowpassHz: typeof noiseLayer.lowpassHz === 'number' && Number.isFinite(noiseLayer.lowpassHz)
        ? clampFrequency(noiseLayer.lowpassHz, 9000)
        : null,
      pan: clampPan(noiseLayer.pan, 0),
    }))
    .filter((noiseLayer) => noiseLayer.durationMs > 0 && noiseLayer.gain > 0);

  if (tones.length === 0 && noiseLayers.length === 0) {
    warnings.push(`Sound "${effectId}" does not define any playable synth layers.`);
    return null;
  }

  return {
    kind: 'synth',
    volume: clampUnit(cue.volume, 1),
    cooldownMs: clampDuration(cue.cooldownMs, 40),
    tones,
    noiseLayers,
  };
}

function deriveSoundPackId(record: OverlaySoundPackRecord, scopeId?: string): { id: string; localId: string } {
  const localId = normalizeSoundPackIdFragment(record.manifest.id || record.directoryName, 'sound-pack');
  return {
    id: createScopedSoundPackId(scopeId, localId),
    localId,
  };
}

function deriveSoundPackName(record: OverlaySoundPackRecord, localId: string): string {
  return asString(record.manifest.name) || deriveDisplayName(localId);
}

async function readSoundPackRecord(entry: FileEntry): Promise<OverlaySoundPackRecord | null> {
  if (!entry.is_dir) {
    const lowerName = entry.name.toLowerCase();
    const isManifestFile = lowerName.endsWith('.json') || lowerName.endsWith('.toml');
    if (!isManifestFile) {
      return null;
    }

    const manifestText = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
    return {
      directoryName: entry.name.replace(/\.[^.]+$/, ''),
      directoryPath: getParentDirectoryPath(entry.path),
      manifestPath: entry.path,
      manifest: parseSoundPackManifestText(manifestText, entry.path),
    };
  }

  for (const manifestName of soundPackSystemConfig.manifestNames) {
    const manifestPath = joinPlatformPath(entry.path, manifestName);
    try {
      const manifestText = await commands.fsReadTextFile(manifestPath).then(unwrapTauriResult);
      return {
        directoryName: entry.name,
        directoryPath: entry.path,
        manifestPath,
        manifest: parseSoundPackManifestText(manifestText, manifestPath),
      };
    } catch {
      continue;
    }
  }

  return null;
}

function createBuiltInSoundPacks(): LoadedOverlaySoundPack[] {
  const defaultManifest: OverlaySoundPackManifest = {
    version: 1,
    id: DEFAULT_SOUND_PACK_ID,
    name: 'GreebleFS Default',
    description: 'A tight synth-forward shell pack with soft explorer ticks and warm success cues.',
    tags: ['built-in', 'synth', 'shell'],
    masterVolume: 0.92,
    sounds: {
      'shell-button-press': {
        kind: 'synth',
        volume: 0.68,
        cooldownMs: 28,
        tones: [
          { frequency: 720, durationMs: 22, gain: 0.26, waveform: 'square' },
          { frequency: 1180, durationMs: 52, offsetMs: 8, gain: 0.12, waveform: 'triangle' },
        ],
        noiseLayers: [
          { durationMs: 10, gain: 0.055, highpassHz: 2400 },
        ],
      },
      'explorer-selection-step': {
        kind: 'synth',
        volume: 0.52,
        cooldownMs: 30,
        tones: [
          { frequency: 460, durationMs: 18, gain: 0.12, waveform: 'triangle' },
          { frequency: 700, durationMs: 36, offsetMs: 4, gain: 0.08, waveform: 'sine' },
        ],
      },
      'explorer-open-entry': {
        kind: 'synth',
        volume: 0.64,
        cooldownMs: 48,
        tones: [
          { frequency: 520, durationMs: 24, gain: 0.18, waveform: 'triangle' },
          { frequency: 780, durationMs: 68, offsetMs: 10, gain: 0.15, waveform: 'sine' },
        ],
      },
      'task-start': {
        kind: 'synth',
        volume: 0.58,
        cooldownMs: 40,
        tones: [
          { frequency: 440, durationMs: 16, gain: 0.16, waveform: 'square' },
          { frequency: 660, durationMs: 26, offsetMs: 14, gain: 0.11, waveform: 'triangle' },
        ],
      },
      'task-success': {
        kind: 'synth',
        volume: 0.74,
        cooldownMs: 80,
        tones: [
          { frequency: 523.25, durationMs: 36, gain: 0.16, waveform: 'triangle' },
          { frequency: 659.25, durationMs: 48, offsetMs: 18, gain: 0.14, waveform: 'triangle' },
          { frequency: 783.99, durationMs: 96, offsetMs: 44, gain: 0.18, waveform: 'sine' },
        ],
      },
      'task-failure': {
        kind: 'synth',
        volume: 0.72,
        cooldownMs: 90,
        tones: [
          { frequency: 330, durationMs: 42, gain: 0.17, waveform: 'sawtooth' },
          { frequency: 220, durationMs: 120, offsetMs: 22, gain: 0.18, waveform: 'triangle' },
        ],
        noiseLayers: [
          { durationMs: 22, offsetMs: 18, gain: 0.05, lowpassHz: 1800 },
        ],
      },
      'notification-info': {
        kind: 'synth',
        volume: 0.62,
        cooldownMs: 60,
        tones: [
          { frequency: 600, durationMs: 24, gain: 0.14, waveform: 'triangle' },
          { frequency: 900, durationMs: 64, offsetMs: 8, gain: 0.12, waveform: 'sine' },
        ],
      },
      'notification-success': {
        kind: 'synth',
        volume: 0.7,
        cooldownMs: 70,
        tones: [
          { frequency: 660, durationMs: 24, gain: 0.13, waveform: 'triangle' },
          { frequency: 990, durationMs: 60, offsetMs: 14, gain: 0.14, waveform: 'sine' },
          { frequency: 1320, durationMs: 92, offsetMs: 34, gain: 0.1, waveform: 'sine' },
        ],
      },
      'notification-error': {
        kind: 'synth',
        volume: 0.7,
        cooldownMs: 90,
        tones: [
          { frequency: 360, durationMs: 26, gain: 0.16, waveform: 'square' },
          { frequency: 288, durationMs: 92, offsetMs: 18, gain: 0.16, waveform: 'triangle' },
        ],
      },
    },
  };

  const warnings: string[] = [];
  const sounds = Object.fromEntries(
    Object.entries(defaultManifest.sounds ?? {})
      .map(([effectId, cue]) => {
        const loadedCue = createLoadedSoundCue(cue as OverlaySoundCueManifest, 'built-in:sound-packs', warnings, effectId as OverlaySoundEffectId);
        return loadedCue ? [effectId, loadedCue] as const : null;
      })
      .filter((entry): entry is readonly [string, LoadedOverlaySoundCue] => entry != null),
  ) as Partial<Record<OverlaySoundEffectId, LoadedOverlaySoundCue>>;

  return [{
    id: DEFAULT_SOUND_PACK_ID,
    localId: DEFAULT_SOUND_PACK_ID,
    name: defaultManifest.name ?? 'GreebleFS Default',
    version: 1,
    directoryPath: 'built-in:sound-packs',
    manifestPath: 'built-in:sound-packs/default',
    sourceKind: 'built-in',
    sourceLabel: 'Built-In',
    description: defaultManifest.description,
    tags: defaultManifest.tags ?? [],
    warnings,
    masterVolume: clampUnit(defaultManifest.masterVolume, 1),
    sounds,
  }];
}

function mergeSoundPacksWithBuiltInFallback(
  authoredPacks: LoadedOverlaySoundPack[],
  includeBuiltIns = true,
): LoadedOverlaySoundPack[] {
  const mergedPacks = new Map<string, LoadedOverlaySoundPack>();

  for (const pack of authoredPacks) {
    mergedPacks.set(pack.id, pack);
  }

  if (includeBuiltIns) {
    for (const builtInPack of createBuiltInSoundPacks()) {
      if (!mergedPacks.has(builtInPack.id)) {
        mergedPacks.set(builtInPack.id, builtInPack);
      }
    }
  }

  return Array.from(mergedPacks.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function resolveLoadedSoundPack(
  packs: readonly LoadedOverlaySoundPack[],
  requestedId: string | null | undefined,
): LoadedOverlaySoundPack | null {
  const trimmedId = requestedId?.trim();
  if (!trimmedId) {
    return null;
  }

  return packs.find((pack) => pack.id === trimmedId || pack.localId === trimmedId) ?? null;
}

export function getOverlaySoundEffectDefinition(effectId: OverlaySoundEffectId) {
  return overlaySoundEffectCatalog.find((effect) => effect.id === effectId) ?? null;
}

export async function loadSoundPacksFromDirectoryEntries(
  directoryEntries: FileEntry[],
  directoryLabel = soundPackSystemConfig.soundPacksDirectory,
  options?: SoundPackLoadOptions,
): Promise<SoundPackLoadResult> {
  try {
    const authoredPacks: LoadedOverlaySoundPack[] = [];
    const warnings: string[] = [];

    for (const entry of directoryEntries) {
      try {
        const record = await readSoundPackRecord(entry);
        if (!record) {
          continue;
        }

        const { id, localId } = deriveSoundPackId(record, options?.scopeId);
        const packWarnings: string[] = [];
        const sounds = Object.fromEntries(
          Object.entries(record.manifest.sounds ?? {})
            .map(([effectId, cue]) => {
              const loadedCue = createLoadedSoundCue(
                cue,
                record.directoryPath,
                packWarnings,
                effectId as OverlaySoundEffectId,
              );
              return loadedCue ? [effectId, loadedCue] as const : null;
            })
            .filter((soundEntry): soundEntry is readonly [string, LoadedOverlaySoundCue] => soundEntry != null),
        ) as Partial<Record<OverlaySoundEffectId, LoadedOverlaySoundCue>>;

        authoredPacks.push({
          id,
          localId,
          name: deriveSoundPackName(record, localId),
          version: typeof record.manifest.version === 'number' ? record.manifest.version : 1,
          directoryPath: record.directoryPath,
          manifestPath: record.manifestPath,
          sourceKind: options?.sourceKind ?? 'sound-pack-directory',
          sourceLabel: options?.sourceLabel ?? 'Sound Pack',
          description: asString(record.manifest.description) || undefined,
          author: asString(record.manifest.author) || undefined,
          homepage: asString(record.manifest.homepage) || undefined,
          tags: asStringArray(record.manifest.tags),
          warnings: packWarnings,
          masterVolume: clampUnit(record.manifest.masterVolume, 1),
          sounds,
        });
      } catch (error) {
        warnings.push(`${entry.name}: ${String(error)}`);
      }
    }

    return {
      packs: mergeSoundPacksWithBuiltInFallback(authoredPacks, options?.includeBuiltIns !== false),
      directory: directoryLabel,
      warnings,
      sourceError: null,
    };
  } catch (error) {
    return {
      packs: mergeSoundPacksWithBuiltInFallback([], options?.includeBuiltIns !== false),
      directory: directoryLabel,
      warnings: [],
      sourceError: String(error),
    };
  }
}

export async function loadSoundPacks(): Promise<SoundPackLoadResult> {
  const directory = soundPackSystemConfig.soundPacksDirectory;
  if (!isTauri()) {
    return {
      packs: mergeSoundPacksWithBuiltInFallback([]),
      directory,
      warnings: [],
      sourceError: null,
    };
  }

  try {
    const rootEntries = await listLocalDirectoryEntriesFast(directory);
    return loadSoundPacksFromDirectoryEntries(rootEntries, directory);
  } catch (error) {
    return {
      packs: mergeSoundPacksWithBuiltInFallback([]),
      directory,
      warnings: [],
      sourceError: String(error),
    };
  }
}
