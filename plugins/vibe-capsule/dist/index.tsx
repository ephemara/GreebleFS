import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Code2,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  Image,
  Pause,
  Play,
  RefreshCcw,
  Save,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { definePlugin } from 'overlayterm-plugin';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

type ArtifactKind = 'image' | 'text' | 'audio' | 'code' | 'video' | 'folder' | 'other';
type CapsuleOrigin = 'explorer-drop' | 'browser-drop' | 'browser-pick' | 'saved';

type CapsulePalette = {
  accent: string;
  accentSoft: string;
  glow: string;
  surface: string;
  surfaceAlt: string;
  fieldA: string;
  fieldB: string;
  fieldC: string;
  text: string;
  muted: string;
};

type CapsuleArtifact = {
  id: string;
  name: string;
  kind: ArtifactKind;
  extension: string;
  displayPath: string;
  path?: string;
  relativePath?: string;
  snippet?: string;
  previewUrl?: string;
  sizeBytes?: number;
  modifiedAt?: number;
  weight: number;
  tags: string[];
  origin: CapsuleOrigin;
};

type ArtifactCounts = Record<ArtifactKind, number>;

type CapsuleSnapshot = {
  id: string;
  title: string;
  sourceLabel: string;
  origin: CapsuleOrigin;
  createdAt: number;
  moodId: string;
  story: string;
  shellHint: string;
  palette: CapsulePalette;
  counts: ArtifactCounts;
  artifactTotal: number;
  orbitSpeed: number;
  pulseBias: number;
  artifacts: CapsuleArtifact[];
  focalArtifactId?: string;
};

type CapsuleMoodProfile = {
  id: string;
  label: string;
  description: string;
  atmosphereWord: string;
  accentWord: string;
  shellHint: string;
  palette: CapsulePalette;
  scoreWeights: Partial<Record<ArtifactKind, number>>;
  keywords: string[];
  storyTemplates: string[];
};

type VibeCapsulePluginStorageApi = {
  rootDir: string;
  ensureDir: (relativePath?: string) => Promise<string>;
  readTextFile: (relativePath: string) => Promise<string>;
  writeTextFile: (relativePath: string, data: string) => Promise<void>;
};

type VibeCapsulePluginApi = {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  storage?: VibeCapsulePluginStorageApi;
  refreshPlugins: () => Promise<void>;
  openPluginsFolder: () => Promise<void>;
};

type VibeCapsulePluginProps = {
  plugin: { id: string; name: string };
  api: VibeCapsulePluginApi;
  host?: { compact?: boolean; width?: number; height?: number; zoom?: number };
  appearance?: { theme?: { palette?: { accent?: string; textMuted?: string } } };
};

type ExplorerFileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
};

type BrowserArtifactSeed = {
  file: File;
  relativePath: string;
};

const CAPSULE_STORAGE_DIRECTORY = 'capsules';
const CAPSULE_STORAGE_INDEX_PATH = `${CAPSULE_STORAGE_DIRECTORY}/index.json`;
const MAX_SCAN_ITEMS = 72;
const MAX_SCAN_DEPTH = 5;
const MAX_TEXT_PREVIEW_LENGTH = 320;
const MAX_IMAGE_PREVIEWS = 10;
const MAX_AUDIO_PREVIEWS = 5;
const MAX_STORED_CAPSULES = 12;
const MAX_ORBIT_ARTIFACTS = 14;
const MAX_SAVED_ARTIFACTS = 18;
const MAX_PREVIEW_URL_LENGTH = 400_000;

const FILE_KIND_RULES: Array<{
  kind: ArtifactKind;
  extensions: string[];
  mimePrefixes: string[];
  baseWeight: number;
}> = [
  {
    kind: 'image',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'],
    mimePrefixes: ['image/'],
    baseWeight: 1.45,
  },
  {
    kind: 'audio',
    extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
    mimePrefixes: ['audio/'],
    baseWeight: 1.55,
  },
  {
    kind: 'video',
    extensions: ['mp4', 'webm', 'mov', 'mkv'],
    mimePrefixes: ['video/'],
    baseWeight: 1.2,
  },
  {
    kind: 'code',
    extensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'rs', 'py', 'go', 'java', 'cpp', 'c', 'html', 'css', 'scss', 'toml', 'yaml', 'yml', 'mdx'],
    mimePrefixes: ['application/json'],
    baseWeight: 1.35,
  },
  {
    kind: 'text',
    extensions: ['md', 'txt', 'rtf', 'log'],
    mimePrefixes: ['text/'],
    baseWeight: 1.18,
  },
];

const MOOD_PROFILES: CapsuleMoodProfile[] = [
  {
    id: 'dream-archive',
    label: 'Dream Archive',
    description: 'Soft relics, floating screenshots, diary fragments, and haunted brightness.',
    atmosphereWord: 'Dreamlight',
    accentWord: 'archive',
    shellHint: 'Pearled dusk, coral highlights, and memory-glass panels.',
    palette: {
      accent: '#ffbf99',
      accentSoft: 'rgba(255, 191, 153, 0.18)',
      glow: 'rgba(239, 183, 255, 0.48)',
      surface: 'rgba(13, 18, 33, 0.86)',
      surfaceAlt: 'rgba(22, 29, 50, 0.94)',
      fieldA: '#060910',
      fieldB: '#10162a',
      fieldC: '#231735',
      text: '#f7ecff',
      muted: 'rgba(247, 236, 255, 0.62)',
    },
    scoreWeights: { image: 1.7, text: 1.25, audio: 1.1, video: 1.05, code: 0.6, other: 0.7 },
    keywords: ['dream', 'archive', 'memory', 'photo', 'shot', 'note', 'journal', 'capsule', 'moon'],
    storyTemplates: [
      '{source} now lives as a suspended {spark} shrine where {artifactCount} artifacts keep glowing after the rest of the room goes dark.',
      'This capsule treats {source} like a private constellation: {spark} in the foreground, {motif} drifting under the glass.',
      '{source} became a playable reliquary of {spark} and {motif}, built to be wandered instead of filed away.',
    ],
  },
  {
    id: 'signal-bloom',
    label: 'Signal Bloom',
    description: 'Playlist energy, kinetic color, broadcast motion, and a pulse that wants a crowd.',
    atmosphereWord: 'Pulsewake',
    accentWord: 'signal',
    shellHint: 'Club-glow glass, bright cyan data haze, and warm broadcast flares.',
    palette: {
      accent: '#79daff',
      accentSoft: 'rgba(121, 218, 255, 0.2)',
      glow: 'rgba(255, 126, 204, 0.52)',
      surface: 'rgba(7, 14, 28, 0.84)',
      surfaceAlt: 'rgba(16, 25, 46, 0.94)',
      fieldA: '#040913',
      fieldB: '#0b1630',
      fieldC: '#25144b',
      text: '#ecf8ff',
      muted: 'rgba(236, 248, 255, 0.62)',
    },
    scoreWeights: { audio: 1.95, image: 1.1, video: 1.25, text: 0.7, code: 0.55, other: 0.9 },
    keywords: ['mix', 'track', 'signal', 'playlist', 'sound', 'club', 'broadcast', 'radio', 'set'],
    storyTemplates: [
      '{source} has been tuned into a {spark} bloom, with {artifactCount} fragments now moving like a station you can stand inside.',
      'This capsule broadcasts {source} as a living afterimage: {spark} up front, {motif} running beneath the floor.',
      '{source} now behaves like a personal venue, all {spark} edges and {motif} echoes with nowhere to sit still.',
    ],
  },
  {
    id: 'shrine-engine',
    label: 'Shrine Engine',
    description: 'Project files, manifests, source code, and build scraps reborn as ceremonial machinery.',
    atmosphereWord: 'Engine Shrine',
    accentWord: 'ritual',
    shellHint: 'Operator chrome with sacred warmth, blueprint shadows, and amber telemetry.',
    palette: {
      accent: '#ffd479',
      accentSoft: 'rgba(255, 212, 121, 0.18)',
      glow: 'rgba(128, 228, 255, 0.42)',
      surface: 'rgba(10, 15, 23, 0.86)',
      surfaceAlt: 'rgba(18, 27, 39, 0.94)',
      fieldA: '#05070c',
      fieldB: '#101925',
      fieldC: '#1b1a2f',
      text: '#f6f3e8',
      muted: 'rgba(246, 243, 232, 0.62)',
    },
    scoreWeights: { code: 1.9, text: 1.35, folder: 1.1, image: 0.75, audio: 0.45, other: 0.95 },
    keywords: ['src', 'build', 'engine', 'manifest', 'ritual', 'design', 'spec', 'task', 'project', 'ship'],
    storyTemplates: [
      '{source} reads like a machine temple now: {artifactCount} linked parts, {spark} in the core, and {motif} humming around the rails.',
      'This capsule turns {source} into a ceremonial workstation where {spark} becomes architecture and {motif} becomes weather.',
      '{source} was translated into an engine-shrine: dense with {spark}, edged with {motif}, still unmistakably alive.',
    ],
  },
  {
    id: 'solarpunk-garden',
    label: 'Solarpunk Garden',
    description: 'Bright images, hopeful notes, and soft daylight drifting through living surfaces.',
    atmosphereWord: 'Bloomfield',
    accentWord: 'garden',
    shellHint: 'Glass-leaf greens, daylight haze, and tender gold edge lighting.',
    palette: {
      accent: '#97f3c8',
      accentSoft: 'rgba(151, 243, 200, 0.18)',
      glow: 'rgba(255, 240, 138, 0.44)',
      surface: 'rgba(10, 24, 25, 0.84)',
      surfaceAlt: 'rgba(18, 36, 39, 0.94)',
      fieldA: '#061011',
      fieldB: '#102629',
      fieldC: '#1f3f36',
      text: '#ecfff7',
      muted: 'rgba(236, 255, 247, 0.62)',
    },
    scoreWeights: { image: 1.4, text: 1.05, video: 1.05, audio: 0.8, code: 0.55, other: 0.75 },
    keywords: ['garden', 'bloom', 'light', 'green', 'summer', 'sun', 'flower', 'field', 'leaf'],
    storyTemplates: [
      '{source} now opens like a small interior garden, with {artifactCount} pieces reframed as {spark} under patient daylight.',
      'This capsule lets {source} breathe: {spark} in the leaves, {motif} under the floor, everything still soft enough to touch.',
      '{source} became a bloomfield of {spark} and {motif}, less folder than climate.',
    ],
  },
];

const EMPTY_COUNTS = (): ArtifactCounts => ({
  image: 0,
  text: 0,
  audio: 0,
  code: 0,
  video: 0,
  folder: 0,
  other: 0,
});

const CAPSULE_SCENE_STYLE = `
@keyframes vibe-capsule-float {
  0% { transform: translate3d(-50%, -50%, 0) translateY(0px) scale(1); }
  50% { transform: translate3d(-50%, -50%, 0) translateY(-10px) scale(1.015); }
  100% { transform: translate3d(-50%, -50%, 0) translateY(0px) scale(1); }
}

@keyframes vibe-capsule-glow {
  0% { opacity: 0.48; }
  50% { opacity: 0.82; }
  100% { opacity: 0.48; }
}
`;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function basename(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/g, '');
  const slashIndex = normalized.lastIndexOf('/');
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

function extensionOf(value: string): string {
  const name = basename(value);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : '';
}

function stemOf(value: string): string {
  const name = basename(value);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(0, dotIndex) : name;
}

function inferArtifactKind(name: string, mimeType = ''): ArtifactKind {
  const extension = extensionOf(name);
  const normalizedMimeType = mimeType.toLowerCase();
  for (const rule of FILE_KIND_RULES) {
    if (rule.extensions.includes(extension)) {
      return rule.kind;
    }
    if (rule.mimePrefixes.some(prefix => normalizedMimeType.startsWith(prefix))) {
      return rule.kind;
    }
  }
  return 'other';
}

function computeArtifactWeight(kind: ArtifactKind, name: string, snippet = '', sizeBytes = 0): number {
  const baseWeight = FILE_KIND_RULES.find(rule => rule.kind === kind)?.baseWeight ?? 0.9;
  const lowercaseName = name.toLowerCase();
  let weight = baseWeight;
  if (/cover|hero|poster|final|mood|shot|scene|mix|note|manifest|readme|capsule|dream|ritual/.test(lowercaseName)) {
    weight += 0.42;
  }
  if (snippet.length > 0) {
    weight += Math.min(snippet.length / 500, 0.34);
  }
  if (sizeBytes > 0) {
    weight += Math.min(sizeBytes / 2_000_000, 0.24);
  }
  return Number(weight.toFixed(2));
}

function trimPreviewUrl(previewUrl?: string): string | undefined {
  if (!previewUrl || previewUrl.length > MAX_PREVIEW_URL_LENGTH) {
    return undefined;
  }
  return previewUrl;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 3);
}

function uniqueTokens(values: string[]): string[] {
  return Array.from(new Set(values));
}

function deriveTags(name: string, relativePath = '', snippet = ''): string[] {
  const tags = uniqueTokens([
    ...tokenize(stemOf(name)),
    ...tokenize(relativePath),
    ...tokenize(snippet).slice(0, 12),
  ]);
  return tags.slice(0, 10);
}

function extractSnippet(value: string): string {
  return normalizeWhitespace(value).slice(0, MAX_TEXT_PREVIEW_LENGTH);
}

function summarizeCounts(artifacts: CapsuleArtifact[]): ArtifactCounts {
  const counts = EMPTY_COUNTS();
  artifacts.forEach(artifact => {
    counts[artifact.kind] += 1;
  });
  return counts;
}

function collectTopTags(artifacts: CapsuleArtifact[]): string[] {
  const scoreByTag = new Map<string, number>();
  artifacts.forEach(artifact => {
    artifact.tags.forEach(tag => {
      scoreByTag.set(tag, (scoreByTag.get(tag) ?? 0) + artifact.weight);
    });
  });
  return Array.from(scoreByTag.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([tag]) => tag);
}

function chooseMoodProfile(artifacts: CapsuleArtifact[], sourceLabel: string, forcedMoodId?: string): CapsuleMoodProfile {
  if (forcedMoodId) {
    const forced = MOOD_PROFILES.find(profile => profile.id === forcedMoodId);
    if (forced) {
      return forced;
    }
  }

  const counts = summarizeCounts(artifacts);
  const tokens = new Set([
    ...collectTopTags(artifacts),
    ...tokenize(sourceLabel),
  ]);
  const scoredProfiles = MOOD_PROFILES.map(profile => {
    let score = 0;
    Object.entries(profile.scoreWeights).forEach(([kind, weight]) => {
      score += (counts[kind as ArtifactKind] ?? 0) * (weight ?? 0);
    });
    profile.keywords.forEach(keyword => {
      if (tokens.has(keyword)) {
        score += 1.4;
      }
    });
    return { profile, score };
  }).sort((left, right) => right.score - left.score);

  return scoredProfiles[0]?.profile ?? MOOD_PROFILES[0];
}

function renderStoryTemplate(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce(
    (current, [token, value]) => current.split(`{${token}}`).join(value),
    template,
  );
}

function deriveCapsuleTitle(sourceLabel: string, mood: CapsuleMoodProfile, topTags: string[]): string {
  const cleanedSource = sourceLabel.trim() || 'Untitled Source';
  const leadTag = topTags[0]
    ? topTags[0].replace(/\b\w/g, character => character.toUpperCase())
    : mood.atmosphereWord;
  return `${cleanedSource} / ${leadTag}`;
}

function buildCapsuleSnapshot(
  artifacts: CapsuleArtifact[],
  sourceLabel: string,
  origin: CapsuleOrigin,
  forcedMoodId?: string,
): CapsuleSnapshot {
  const orderedArtifacts = [...artifacts]
    .sort((left, right) => right.weight - left.weight)
    .slice(0, MAX_SCAN_ITEMS);
  const counts = summarizeCounts(orderedArtifacts);
  const topTags = collectTopTags(orderedArtifacts);
  const mood = chooseMoodProfile(orderedArtifacts, sourceLabel, forcedMoodId);
  const templateIndex = hashString(`${sourceLabel}:${orderedArtifacts.length}:${mood.id}`) % mood.storyTemplates.length;
  const spark = topTags[0] ?? mood.accentWord;
  const motif = topTags[1] ?? mood.atmosphereWord.toLowerCase();
  const story = renderStoryTemplate(mood.storyTemplates[templateIndex], {
    source: sourceLabel,
    spark,
    motif,
    artifactCount: String(orderedArtifacts.length),
  });
  return {
    id: createId('capsule'),
    title: deriveCapsuleTitle(sourceLabel, mood, topTags),
    sourceLabel,
    origin,
    createdAt: Date.now(),
    moodId: mood.id,
    story,
    shellHint: mood.shellHint,
    palette: mood.palette,
    counts,
    artifactTotal: orderedArtifacts.length,
    orbitSpeed: clamp(0.85 + orderedArtifacts.length / 48, 0.85, 2.2),
    pulseBias: clamp(0.2 + counts.audio * 0.08 + counts.image * 0.02, 0.18, 0.92),
    artifacts: orderedArtifacts.slice(0, MAX_SAVED_ARTIFACTS),
    focalArtifactId: orderedArtifacts[0]?.id,
  };
}

function buildThemeExport(snapshot: CapsuleSnapshot): string {
  const { palette } = snapshot;
  return JSON.stringify({
    version: 1,
    id: `${snapshot.id}-shell`,
    name: `${snapshot.title} Shell`,
    extends: 'operator',
    theme: {
      palette: {
        appBackground: palette.fieldA,
        appBackgroundAlt: palette.fieldB,
        panelBackground: palette.surface,
        panelAltBackground: palette.surfaceAlt,
        cardBackground: palette.surfaceAlt,
        cardHoverBackground: palette.fieldC,
        textPrimary: palette.text,
        textMuted: palette.muted,
        border: palette.accentSoft,
        borderStrong: palette.glow,
        accent: palette.accent,
        accentSoft: palette.accentSoft,
        accentContrast: '#09111d',
        info: palette.accent,
      },
      fonts: {
        ui: '"Space Grotesk", Inter, sans-serif',
        mono: '"JetBrains Mono", "Cascadia Code", monospace',
      },
    },
    visuals: [
      {
        id: `${snapshot.id}-atmosphere`,
        backgroundImage: `radial-gradient(circle at 20% 18%, ${palette.accentSoft}, transparent 26%), radial-gradient(circle at 80% 16%, ${palette.glow}, transparent 22%), radial-gradient(circle at 50% 80%, rgba(255,255,255,0.08), transparent 18%)`,
        opacity: 0.92,
        blendMode: 'screen',
      },
    ],
  }, null, 2);
}

async function ensureNotificationPermissionGranted(): Promise<boolean> {
  try {
    const granted = await isPermissionGranted();
    if (granted) {
      return true;
    }
    return (await requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

async function sendCapsuleNotification(title: string, body: string): Promise<void> {
  if (await ensureNotificationPermissionGranted()) {
    await sendNotification({ title, body });
  }
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

function sourceLabelFromPaths(paths: string[]): string {
  if (paths.length === 1) {
    return basename(paths[0]) || 'Dropped Capsule';
  }
  return `${paths.length} source cluster`;
}

function sourceLabelFromBrowserSeeds(seeds: BrowserArtifactSeed[]): string {
  const firstRelativePath = seeds.find(seed => seed.relativePath.includes('/'))?.relativePath;
  if (firstRelativePath) {
    return firstRelativePath.split('/')[0] || 'Picked Capsule';
  }
  if (seeds.length === 1) {
    return stemOf(seeds[0].file.name) || 'Picked Capsule';
  }
  return `${seeds.length} picked artifacts`;
}

async function maybeReadPathSnippet(api: VibeCapsulePluginApi, path: string): Promise<string | undefined> {
  try {
    const text = await api.invoke<string>('fs_read_text_file', { path });
    return extractSnippet(text);
  } catch {
    return undefined;
  }
}

async function maybeReadPathPreviewUrl(api: VibeCapsulePluginApi, path: string): Promise<string | undefined> {
  try {
    const previewUrl = await api.invoke<string>('fs_read_file_base64', { path });
    return trimPreviewUrl(previewUrl);
  } catch {
    return undefined;
  }
}

async function createPathArtifact(
  api: VibeCapsulePluginApi,
  path: string,
  relativePath: string,
  origin: CapsuleOrigin,
  budgets: { images: number; audio: number },
): Promise<CapsuleArtifact> {
  const name = basename(path);
  const extension = extensionOf(path);
  const kind = inferArtifactKind(name);
  let snippet: string | undefined;
  let previewUrl: string | undefined;

  if ((kind === 'text' || kind === 'code') && extension !== 'svg') {
    snippet = await maybeReadPathSnippet(api, path);
  }

  if (kind === 'image' && budgets.images > 0) {
    budgets.images -= 1;
    previewUrl = await maybeReadPathPreviewUrl(api, path);
  }

  if (kind === 'audio' && budgets.audio > 0) {
    budgets.audio -= 1;
    previewUrl = await maybeReadPathPreviewUrl(api, path);
  }

  return {
    id: createId('artifact'),
    name,
    kind,
    extension,
    displayPath: relativePath || name,
    path,
    relativePath,
    snippet,
    previewUrl,
    weight: computeArtifactWeight(kind, name, snippet),
    tags: deriveTags(name, relativePath, snippet),
    origin,
  };
}

async function collectArtifactsFromPaths(
  api: VibeCapsulePluginApi,
  rootPaths: string[],
  origin: CapsuleOrigin,
  onStatus: (message: string) => void,
): Promise<CapsuleArtifact[]> {
  const budgets = { images: MAX_IMAGE_PREVIEWS, audio: MAX_AUDIO_PREVIEWS };
  const artifacts: CapsuleArtifact[] = [];
  const queue: Array<{ path: string; relativePath: string; depth: number }> = rootPaths.map(path => ({
    path,
    relativePath: basename(path),
    depth: 0,
  }));

  while (queue.length > 0 && artifacts.length < MAX_SCAN_ITEMS) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    onStatus(`Scanning ${current.relativePath || basename(current.path)}...`);
    let directoryEntries: ExplorerFileEntry[] | null = null;
    try {
      directoryEntries = await api.invoke<ExplorerFileEntry[]>('fs_list_dir', {
        path: current.path,
        showHidden: false,
      });
    } catch {
      directoryEntries = null;
    }

    if (Array.isArray(directoryEntries)) {
      if (current.depth === 0) {
        artifacts.push({
          id: createId('artifact'),
          name: basename(current.path),
          kind: 'folder',
          extension: '',
          displayPath: current.relativePath,
          path: current.path,
          relativePath: current.relativePath,
          snippet: `Folder source with ${directoryEntries.length} immediate entries.`,
          weight: 0.8 + directoryEntries.length * 0.03,
          tags: deriveTags(basename(current.path), current.relativePath),
          origin,
        });
      }

      const sortedEntries = [...directoryEntries].sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of sortedEntries) {
        if (artifacts.length >= MAX_SCAN_ITEMS) {
          break;
        }
        const nextRelativePath = current.relativePath
          ? `${current.relativePath}/${entry.name}`
          : entry.name;
        if (entry.is_dir) {
          if (current.depth + 1 <= MAX_SCAN_DEPTH) {
            queue.push({
              path: entry.path,
              relativePath: nextRelativePath,
              depth: current.depth + 1,
            });
          }
          continue;
        }
        artifacts.push(await createPathArtifact(api, entry.path, nextRelativePath, origin, budgets));
      }
      continue;
    }

    artifacts.push(await createPathArtifact(api, current.path, current.relativePath, origin, budgets));
  }

  return artifacts;
}

async function createBrowserArtifact(
  seed: BrowserArtifactSeed,
  origin: CapsuleOrigin,
  budgets: { images: number; audio: number },
): Promise<CapsuleArtifact> {
  const { file, relativePath } = seed;
  const kind = inferArtifactKind(file.name, file.type);
  let snippet: string | undefined;
  let previewUrl: string | undefined;

  if (kind === 'text' || kind === 'code') {
    try {
      snippet = extractSnippet(await file.text());
    } catch {
      snippet = undefined;
    }
  }

  if (kind === 'image' && budgets.images > 0) {
    budgets.images -= 1;
    previewUrl = trimPreviewUrl(await readFileAsDataUrl(file));
  }

  if (kind === 'audio' && budgets.audio > 0) {
    budgets.audio -= 1;
    previewUrl = trimPreviewUrl(await readFileAsDataUrl(file));
  }

  return {
    id: createId('artifact'),
    name: file.name,
    kind,
    extension: extensionOf(file.name),
    displayPath: relativePath,
    relativePath,
    snippet,
    previewUrl,
    sizeBytes: file.size,
    modifiedAt: file.lastModified,
    weight: computeArtifactWeight(kind, file.name, snippet, file.size),
    tags: deriveTags(file.name, relativePath, snippet),
    origin,
  };
}

async function collectArtifactsFromBrowserFiles(
  files: File[],
  origin: CapsuleOrigin,
  onStatus: (message: string) => void,
): Promise<CapsuleArtifact[]> {
  const seeds = files
    .filter(file => file.size > 0)
    .slice(0, MAX_SCAN_ITEMS)
    .map(file => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    }));

  const budgets = { images: MAX_IMAGE_PREVIEWS, audio: MAX_AUDIO_PREVIEWS };
  const artifacts: CapsuleArtifact[] = [];
  for (const [index, seed] of seeds.entries()) {
    onStatus(`Reading ${seed.relativePath || seed.file.name} (${index + 1}/${seeds.length})...`);
    artifacts.push(await createBrowserArtifact(seed, origin, budgets));
  }

  return artifacts;
}

async function loadStoredCapsules(storage?: VibeCapsulePluginStorageApi): Promise<CapsuleSnapshot[]> {
  if (!storage) {
    return [];
  }
  try {
    const stored = JSON.parse(await storage.readTextFile(CAPSULE_STORAGE_INDEX_PATH)) as CapsuleSnapshot[];
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

async function persistCapsules(
  storage: VibeCapsulePluginStorageApi | undefined,
  snapshots: CapsuleSnapshot[],
): Promise<void> {
  if (!storage) {
    return;
  }
  await storage.ensureDir(CAPSULE_STORAGE_DIRECTORY);
  await storage.writeTextFile(CAPSULE_STORAGE_INDEX_PATH, JSON.stringify(
    snapshots
      .slice(0, MAX_STORED_CAPSULES)
      .map(snapshot => ({
        ...snapshot,
        artifacts: snapshot.artifacts.map(artifact => ({
          ...artifact,
          previewUrl: trimPreviewUrl(artifact.previewUrl),
          snippet: artifact.snippet?.slice(0, MAX_TEXT_PREVIEW_LENGTH),
        })),
      })),
    null,
    2,
  ));
}

function formatCountLabel(kind: ArtifactKind, count: number): string {
  if (kind === 'image') return `${count} visuals`;
  if (kind === 'audio') return `${count} tracks`;
  if (kind === 'text') return `${count} notes`;
  if (kind === 'code') return `${count} code relics`;
  if (kind === 'video') return `${count} clips`;
  if (kind === 'folder') return `${count} roots`;
  return `${count} miscellany`;
}

function artifactIcon(kind: ArtifactKind): React.ReactNode {
  if (kind === 'image') return <Image size={14} />;
  if (kind === 'text') return <FileText size={14} />;
  if (kind === 'code') return <Code2 size={14} />;
  if (kind === 'audio') return <Play size={14} />;
  if (kind === 'video') return <Play size={14} />;
  return <Sparkles size={14} />;
}

function VibeCapsule({ plugin, api, host, appearance }: VibeCapsulePluginProps) {
  const shellAccent = appearance?.theme?.palette?.accent ?? '#ffbf99';
  const shellMuted = appearance?.theme?.palette?.textMuted ?? 'rgba(231, 225, 255, 0.62)';
  const compact = Boolean(host?.compact) || (host?.width ?? 0) < 1200;
  const [capsule, setCapsule] = useState<CapsuleSnapshot | null>(null);
  const [savedCapsules, setSavedCapsules] = useState<CapsuleSnapshot[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [status, setStatus] = useState('Drop a folder, playlist, screenshot set, or project here.');
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioIndex, setAudioIndex] = useState(0);
  const [energyLevel, setEnergyLevel] = useState(0);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const sceneCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const energyLevelRef = useRef(0);

  useEffect(() => {
    energyLevelRef.current = energyLevel;
  }, [energyLevel]);

  useEffect(() => {
    const node = folderInputRef.current;
    if (!node) {
      return;
    }
    node.setAttribute('webkitdirectory', '');
    node.setAttribute('directory', '');
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadStoredCapsules(api.storage).then(stored => {
      if (!cancelled) {
        setSavedCapsules(stored.sort((left, right) => right.createdAt - left.createdAt));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api.storage]);

  const selectedArtifact = useMemo(
    () => capsule?.artifacts.find(artifact => artifact.id === selectedArtifactId) ?? null,
    [capsule, selectedArtifactId],
  );

  useEffect(() => {
    if (!capsule) {
      setSelectedArtifactId(null);
      return;
    }
    setSelectedArtifactId(current => {
      if (current && capsule.artifacts.some(artifact => artifact.id === current)) {
        return current;
      }
      return capsule.focalArtifactId ?? capsule.artifacts[0]?.id ?? null;
    });
  }, [capsule]);

  const audioArtifacts = useMemo(
    () => capsule?.artifacts.filter(artifact => artifact.kind === 'audio' && artifact.previewUrl) ?? [],
    [capsule],
  );

  const currentMood = useMemo(
    () => MOOD_PROFILES.find(profile => profile.id === capsule?.moodId) ?? MOOD_PROFILES[0],
    [capsule?.moodId],
  );

  const orbitArtifacts = useMemo(() => {
    const visibleArtifacts = capsule?.artifacts.slice(0, MAX_ORBIT_ARTIFACTS) ?? [];
    return visibleArtifacts.map((artifact, index) => {
      const seed = hashString(`${artifact.id}:${index}`);
      const angle = (Math.PI * 2 * index) / Math.max(visibleArtifacts.length, 1) + (seed % 360) * (Math.PI / 180);
      const radius = 110 + (index % 3) * 62 + (seed % 29);
      const verticalScale = 0.65 + (seed % 18) / 100;
      return {
        artifact,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * verticalScale,
        duration: 9 + (seed % 6),
        delay: -((seed % 12) / 2),
      };
    });
  }, [capsule]);

  const capsuleThemeExport = useMemo(
    () => (capsule ? buildThemeExport(capsule) : ''),
    [capsule],
  );

  const saveCapsuleLibrary = useCallback(async (updater: (current: CapsuleSnapshot[]) => CapsuleSnapshot[]) => {
    setSavedCapsules(current => {
      const next = updater(current)
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, MAX_STORED_CAPSULES);
      void persistCapsules(api.storage, next);
      return next;
    });
  }, [api.storage]);

  const archiveCapsule = useCallback(async () => {
    if (!capsule) {
      return;
    }
    await saveCapsuleLibrary(current => {
      const withoutCurrent = current.filter(entry => entry.id !== capsule.id);
      return [capsule, ...withoutCurrent];
    });
    setStatus(`Archived ${capsule.title} to the capsule shelf.`);
    void sendCapsuleNotification('Vibe Capsule archived', capsule.title);
  }, [capsule, saveCapsuleLibrary]);

  const removeStoredCapsule = useCallback(async (capsuleId: string) => {
    await saveCapsuleLibrary(current => current.filter(entry => entry.id !== capsuleId));
    setStatus('Removed capsule from the shelf.');
  }, [saveCapsuleLibrary]);

  const ingestFromPaths = useCallback(async (paths: string[], origin: CapsuleOrigin) => {
    if (paths.length === 0) {
      return;
    }
    setBusy(true);
    setStatus('Gathering a new capsule from explorer paths...');
    try {
      const artifacts = await collectArtifactsFromPaths(api, paths, origin, setStatus);
      if (artifacts.length === 0) {
        setStatus('Nothing usable was found in that drop.');
        return;
      }
      const snapshot = buildCapsuleSnapshot(artifacts, sourceLabelFromPaths(paths), origin);
      setCapsule(snapshot);
      setAudioIndex(0);
      setPlaying(snapshot.counts.audio > 0);
      setStatus(`Built ${snapshot.title} with ${snapshot.artifactTotal} artifacts.`);
      void sendCapsuleNotification('Vibe Capsule built', snapshot.title);
    } catch (error) {
      setStatus(`Capsule build failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }, [api]);

  const ingestFromBrowserFiles = useCallback(async (files: File[], origin: CapsuleOrigin) => {
    if (files.length === 0) {
      return;
    }
    setBusy(true);
    setStatus('Sampling dropped artifacts...');
    try {
      const artifacts = await collectArtifactsFromBrowserFiles(files, origin, setStatus);
      if (artifacts.length === 0) {
        setStatus('That drop did not include usable artifacts.');
        return;
      }
      const sourceLabel = sourceLabelFromBrowserSeeds(files.map(file => ({
        file,
        relativePath: file.webkitRelativePath || file.name,
      })));
      const snapshot = buildCapsuleSnapshot(artifacts, sourceLabel, origin);
      setCapsule(snapshot);
      setAudioIndex(0);
      setPlaying(snapshot.counts.audio > 0);
      setStatus(`Built ${snapshot.title} with ${snapshot.artifactTotal} artifacts.`);
      void sendCapsuleNotification('Vibe Capsule built', snapshot.title);
    } catch (error) {
      setStatus(`Capsule build failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropActive(false);
    const payload = event.dataTransfer.getData('application/x-overlayterm-paths');
    if (payload) {
      try {
        const parsedPaths = JSON.parse(payload) as string[];
        if (Array.isArray(parsedPaths) && parsedPaths.length > 0) {
          await ingestFromPaths(parsedPaths, 'explorer-drop');
          return;
        }
      } catch {
        // fall through to browser files
      }
    }
    if (event.dataTransfer.files.length > 0) {
      await ingestFromBrowserFiles(Array.from(event.dataTransfer.files), 'browser-drop');
    }
  }, [ingestFromBrowserFiles, ingestFromPaths]);

  const handlePickFiles = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      await ingestFromBrowserFiles(files, 'browser-pick');
    }
    event.target.value = '';
  }, [ingestFromBrowserFiles]);

  const handleLoadStoredCapsule = useCallback((snapshot: CapsuleSnapshot) => {
    setCapsule({ ...snapshot, origin: 'saved' });
    setAudioIndex(0);
    setPlaying(snapshot.counts.audio > 0);
    setStatus(`Loaded ${snapshot.title} from the capsule shelf.`);
  }, []);

  const handleRemixCapsule = useCallback(() => {
    if (!capsule) {
      return;
    }
    const moodIndex = MOOD_PROFILES.findIndex(profile => profile.id === capsule.moodId);
    const nextMood = MOOD_PROFILES[(moodIndex + 1) % MOOD_PROFILES.length];
    const remixed = buildCapsuleSnapshot(capsule.artifacts, capsule.sourceLabel, capsule.origin, nextMood.id);
    setCapsule(remixed);
    setStatus(`Remixed capsule into ${nextMood.label}.`);
  }, [capsule]);

  const handleCopyThemeExport = useCallback(async () => {
    if (!capsuleThemeExport || typeof navigator === 'undefined' || !navigator.clipboard) {
      setStatus('Clipboard export is not available here.');
      return;
    }
    await navigator.clipboard.writeText(capsuleThemeExport);
    setStatus('Copied shell-skin theme export to the clipboard.');
  }, [capsuleThemeExport]);

  const handleOpenArtifact = useCallback(async (artifact: CapsuleArtifact) => {
    if (!artifact.path) {
      setStatus('This artifact only exists inside the current capsule snapshot.');
      return;
    }
    try {
      await api.invoke('fs_open_file', { path: artifact.path });
      setStatus(`Opened ${artifact.name}.`);
    } catch (error) {
      setStatus(`Could not open ${artifact.name}: ${String(error)}`);
    }
  }, [api]);

  const handleRevealArtifact = useCallback(async (artifact: CapsuleArtifact) => {
    if (!artifact.path) {
      setStatus('This artifact came from a picker snapshot and has no native path to reveal.');
      return;
    }
    try {
      await api.invoke('fs_reveal_in_explorer', { path: artifact.path });
      setStatus(`Revealed ${artifact.name}.`);
    } catch (error) {
      setStatus(`Could not reveal ${artifact.name}: ${String(error)}`);
    }
  }, [api]);

  useEffect(() => {
    const currentAudioArtifact = audioArtifacts[audioIndex] ?? null;
    if (!currentAudioArtifact?.previewUrl) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      setEnergyLevel(0);
      return;
    }

    const audio = new Audio(currentAudioArtifact.previewUrl);
    audio.loop = false;
    audio.volume = muted ? 0 : 0.72;
    audioElementRef.current = audio;

    let disposed = false;
    const attachAnalyser = async () => {
      try {
        const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) {
          return;
        }
        const context = new AudioContextCtor();
        audioContextRef.current = context;
        const source = context.createMediaElementSource(audio);
        const analyser = context.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyser.connect(context.destination);
        analyserRef.current = analyser;
        if (playing && !disposed) {
          await context.resume();
          await audio.play();
        }
      } catch {
        analyserRef.current = null;
        if (playing && !disposed) {
          void audio.play().catch(() => {
            setPlaying(false);
          });
        }
      }
    };

    void attachAnalyser();

    const handleEnded = () => {
      setAudioIndex(current => {
        if (audioArtifacts.length === 0) {
          return 0;
        }
        return (current + 1) % audioArtifacts.length;
      });
    };
    audio.addEventListener('ended', handleEnded);

    return () => {
      disposed = true;
      audio.pause();
      audio.removeEventListener('ended', handleEnded);
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [audioArtifacts, audioIndex, muted, playing]);

  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio) {
      return;
    }
    audio.volume = muted ? 0 : 0.72;
    if (!playing) {
      audio.pause();
      return;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.resume().catch(() => undefined);
    }
    void audio.play().catch(() => {
      setPlaying(false);
    });
  }, [muted, playing]);

  useEffect(() => {
    let frameId = 0;
    let disposed = false;
    const buffer = new Uint8Array(32);
    let lastEnergyUpdate = 0;

    const tick = (timestamp: number) => {
      if (disposed) {
        return;
      }

      let nextEnergy = capsule?.pulseBias ?? 0.18;
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(buffer);
        const average = buffer.reduce((total, value) => total + value, 0) / Math.max(buffer.length, 1);
        nextEnergy = clamp(average / 255, 0, 1);
      } else {
        nextEnergy = clamp((capsule?.pulseBias ?? 0.18) + Math.sin(timestamp / 1100) * 0.08, 0.08, 0.62);
      }

      if (timestamp - lastEnergyUpdate >= 66) {
        lastEnergyUpdate = timestamp;
        setEnergyLevel(current => current * 0.66 + nextEnergy * 0.34);
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [capsule?.pulseBias]);

  useEffect(() => {
    const canvas = sceneCanvasRef.current;
    const scene = sceneRef.current;
    const palette = capsule?.palette;
    if (!canvas || !scene || !palette) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    let frameId = 0;
    let disposed = false;
    const seed = hashString(capsule.id);
    const particleCount = 32;
    const particles = Array.from({ length: particleCount }, (_, index) => {
      const value = hashString(`${seed}:${index}`);
      return {
        offset: value % 1000,
        drift: 0.4 + (value % 70) / 100,
        size: 1.2 + (value % 18) / 10,
        radius: 90 + (value % 240),
        angle: (value % 360) * (Math.PI / 180),
      };
    });

    const render = (timestamp: number) => {
      if (disposed) {
        return;
      }

      const sceneWidth = Math.max(scene.clientWidth, 320);
      const sceneHeight = Math.max(scene.clientHeight, 320);
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.floor(sceneWidth * dpr) || canvas.height !== Math.floor(sceneHeight * dpr)) {
        canvas.width = Math.floor(sceneWidth * dpr);
        canvas.height = Math.floor(sceneHeight * dpr);
        canvas.style.width = `${sceneWidth}px`;
        canvas.style.height = `${sceneHeight}px`;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, sceneWidth, sceneHeight);

      const gradient = context.createLinearGradient(0, 0, sceneWidth, sceneHeight);
      gradient.addColorStop(0, palette.fieldA);
      gradient.addColorStop(0.48, palette.fieldB);
      gradient.addColorStop(1, palette.fieldC);
      context.fillStyle = gradient;
      context.fillRect(0, 0, sceneWidth, sceneHeight);

      const pointerX = pointerRef.current.x;
      const pointerY = pointerRef.current.y;
      const centerX = sceneWidth * (0.48 + (pointerX - 0.5) * 0.08);
      const centerY = sceneHeight * (0.52 + (pointerY - 0.5) * 0.08);
      const energy = energyLevelRef.current;

      const aurora = context.createRadialGradient(
        centerX - sceneWidth * 0.18,
        centerY - sceneHeight * 0.2,
        0,
        centerX,
        centerY,
        sceneWidth * 0.72,
      );
      aurora.addColorStop(0, palette.glow);
      aurora.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = aurora;
      context.globalAlpha = 0.34 + energy * 0.28;
      context.fillRect(0, 0, sceneWidth, sceneHeight);

      context.globalAlpha = 1;
      particles.forEach((particle, index) => {
        const time = timestamp / 1000;
        const angle = particle.angle + time * (0.04 + particle.drift * 0.03);
        const orbitRadius = particle.radius + Math.sin(time * particle.drift + particle.offset) * 18;
        const x = centerX + Math.cos(angle) * orbitRadius;
        const y = centerY + Math.sin(angle) * orbitRadius * 0.58;
        context.beginPath();
        context.fillStyle = index % 4 === 0 ? palette.accent : palette.text;
        context.globalAlpha = 0.15 + (particle.size / 4) * 0.18;
        context.arc(x, y, particle.size + energy * 1.2, 0, Math.PI * 2);
        context.fill();
      });

      context.globalAlpha = 0.9;
      const orbRadius = Math.min(sceneWidth, sceneHeight) * (0.12 + energy * 0.05);
      const orb = context.createRadialGradient(centerX, centerY, orbRadius * 0.2, centerX, centerY, orbRadius * 1.6);
      orb.addColorStop(0, palette.text);
      orb.addColorStop(0.18, palette.accent);
      orb.addColorStop(0.38, palette.glow);
      orb.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = orb;
      context.beginPath();
      context.arc(centerX, centerY, orbRadius * 1.7, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = palette.accentSoft;
      context.lineWidth = 1;
      for (let bandIndex = 0; bandIndex < 4; bandIndex += 1) {
        const radius = orbRadius * (1.4 + bandIndex * 0.48 + energy * 0.3);
        context.beginPath();
        context.ellipse(centerX, centerY, radius * (1.05 + bandIndex * 0.06), radius * 0.42, 0, 0, Math.PI * 2);
        context.stroke();
      }

      context.globalAlpha = 0.2 + energy * 0.25;
      context.strokeStyle = palette.text;
      context.lineWidth = 1;
      for (let row = 0; row < 6; row += 1) {
        const baseline = centerY - sceneHeight * 0.22 + row * 36;
        context.beginPath();
        for (let x = 0; x <= sceneWidth; x += 12) {
          const wave = Math.sin((x / sceneWidth) * Math.PI * 4 + timestamp / 820 + row) * (5 + energy * 16);
          if (x === 0) {
            context.moveTo(x, baseline + wave);
          } else {
            context.lineTo(x, baseline + wave);
          }
        }
        context.stroke();
      }

      context.globalAlpha = 1;
      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [capsule?.id, capsule?.palette]);

  const currentTrack = audioArtifacts[audioIndex] ?? null;

  const sceneBorder = capsule ? `1px solid ${capsule.palette.accentSoft}` : '1px solid rgba(255,255,255,0.08)';
  const sceneBackground = capsule?.palette.surface ?? 'rgba(12, 16, 30, 0.88)';
  const sceneText = capsule?.palette.text ?? '#f7ecff';
  const sceneMuted = capsule?.palette.muted ?? shellMuted;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        background: 'linear-gradient(180deg, rgba(6,8,14,0.94), rgba(10,12,20,0.98))',
        color: sceneText,
        fontFamily: 'var(--overlay-font-ui)',
      }}
    >
      <style>{CAPSULE_SCENE_STYLE}</style>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(11, 14, 24, 0.88)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              background: `${shellAccent}18`,
              border: `1px solid ${shellAccent}55`,
              boxShadow: `0 0 24px ${shellAccent}22`,
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{plugin.name}</div>
            <div style={{ fontSize: 11, color: shellMuted }}>
              Build a playable ambient shrine from explorer drops, folders, playlists, screenshots, or project scraps.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ActionButton label="Pick Files" onClick={() => fileInputRef.current?.click()} icon={<Upload size={14} />} disabled={busy} />
          <ActionButton label="Pick Folder" onClick={() => folderInputRef.current?.click()} icon={<FolderOpen size={14} />} disabled={busy} />
          <ActionButton label="Remix Mood" onClick={handleRemixCapsule} icon={<RefreshCcw size={14} />} disabled={!capsule || busy} />
          <ActionButton label="Archive Capsule" onClick={archiveCapsule} icon={<Save size={14} />} disabled={!capsule || busy} />
          <ActionButton label="Copy Shell Skin" onClick={handleCopyThemeExport} icon={<Copy size={14} />} disabled={!capsule} />
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handlePickFiles} />
      <input ref={folderInputRef} type="file" multiple style={{ display: 'none' }} onChange={handlePickFiles} />

      <div
        style={{
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          gap: 14,
          flex: 1,
          minHeight: 0,
          padding: 14,
        }}
      >
        <section
          ref={sceneRef}
          onDragOver={event => {
            event.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={event => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }
            setDropActive(false);
          }}
          onDrop={handleDrop}
          onMouseMove={event => {
            const rect = event.currentTarget.getBoundingClientRect();
            pointerRef.current = {
              x: clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1),
              y: clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1),
            };
          }}
          onMouseLeave={() => {
            pointerRef.current = { x: 0.5, y: 0.5 };
          }}
          style={{
            position: 'relative',
            flex: 1.2,
            minHeight: compact ? 420 : 560,
            minWidth: 0,
            overflow: 'hidden',
            borderRadius: 26,
            border: sceneBorder,
            background: sceneBackground,
            boxShadow: capsule ? `0 32px 80px ${capsule.palette.accentSoft}` : '0 22px 72px rgba(0,0,0,0.35)',
          }}
        >
          <canvas
            ref={sceneCanvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              display: 'block',
            }}
          />

          {!capsule && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                padding: 28,
              }}
            >
              <div
                style={{
                  width: 'min(88%, 640px)',
                  borderRadius: 24,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(10, 14, 24, 0.78)',
                  backdropFilter: 'blur(18px)',
                  padding: 24,
                  boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, fontWeight: 700 }}>
                  <Sparkles size={18} />
                  Vibe Capsule wants a source world
                </div>
                <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.65, color: shellMuted }}>
                  Drag material straight from Greeble Explorer or the OS. Folders become shrines, playlists become pulse fields,
                  screenshots become floating memories, and notes or code become the capsule narrative.
                </div>
                <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
                  <HintRow icon={<FolderOpen size={14} />} label="Drag a project folder to generate a living reference world." />
                  <HintRow icon={<Image size={14} />} label="Drop screenshots or moodboards to get a cinematic scrapbook capsule." />
                  <HintRow icon={<Play size={14} />} label="Drop audio to unlock reactive motion and pulse-driven ambience." />
                  <HintRow icon={<Code2 size={14} />} label="Source files and notes turn into shrine text, motifs, and shell hints." />
                </div>
              </div>
            </div>
          )}

          {capsule && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: 18,
                  top: 18,
                  zIndex: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxWidth: 'min(56%, 440px)',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    width: 'fit-content',
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: `1px solid ${capsule.palette.accentSoft}`,
                    background: 'rgba(6, 8, 16, 0.48)',
                    backdropFilter: 'blur(16px)',
                    color: capsule.palette.text,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  <Sparkles size={12} />
                  {currentMood.label}
                </div>
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 18,
                    border: `1px solid ${capsule.palette.accentSoft}`,
                    background: 'rgba(6, 10, 18, 0.52)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{capsule.title}</div>
                  <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.65, color: capsule.palette.muted }}>
                    {capsule.story}
                  </div>
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  right: 18,
                  top: 18,
                  zIndex: 3,
                  display: 'flex',
                  gap: 8,
                }}
              >
                <StatPill label="Artifacts" value={String(capsule.artifactTotal)} accent={capsule.palette.accent} />
                <StatPill label="Mood" value={currentMood.atmosphereWord} accent={capsule.palette.accent} />
              </div>

              {orbitArtifacts.map(({ artifact, x, y, duration, delay }) => {
                const selected = artifact.id === selectedArtifactId;
                return (
                  <button
                    key={artifact.id}
                    type="button"
                    onClick={() => setSelectedArtifactId(artifact.id)}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: selected ? 190 : 168,
                      padding: 12,
                      borderRadius: 18,
                      border: selected ? `1px solid ${capsule.palette.accent}` : `1px solid ${capsule.palette.accentSoft}`,
                      background: selected ? 'rgba(6, 10, 18, 0.9)' : 'rgba(6, 10, 18, 0.72)',
                      backdropFilter: 'blur(18px)',
                      color: capsule.palette.text,
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: selected ? `0 18px 44px ${capsule.palette.accentSoft}` : '0 16px 40px rgba(0,0,0,0.26)',
                      transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                      animation: `vibe-capsule-float ${duration}s ease-in-out infinite`,
                      animationDelay: `${delay}s`,
                      zIndex: selected ? 4 : 2,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: capsule.palette.muted }}>
                      {artifactIcon(artifact.kind)}
                      {artifact.kind}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>
                      {artifact.name}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: capsule.palette.muted }}>
                      {artifact.displayPath}
                    </div>
                    {artifact.snippet && (
                      <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: capsule.palette.muted }}>
                        {artifact.snippet}
                      </div>
                    )}
                  </button>
                );
              })}

              <div
                style={{
                  position: 'absolute',
                  left: 18,
                  right: 18,
                  bottom: 18,
                  zIndex: 3,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    maxWidth: 'min(70%, 720px)',
                  }}
                >
                  {Object.entries(capsule.counts)
                    .filter(([, count]) => count > 0)
                    .map(([kind, count]) => (
                      <MetricChip
                        key={kind}
                        label={formatCountLabel(kind as ArtifactKind, count)}
                        accent={capsule.palette.accent}
                      />
                    ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 16,
                    border: `1px solid ${capsule.palette.accentSoft}`,
                    background: 'rgba(8, 10, 18, 0.56)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <ActionIconButton
                    label={playing ? 'Pause capsule audio' : 'Play capsule audio'}
                    onClick={() => setPlaying(current => !current)}
                    disabled={audioArtifacts.length === 0}
                    icon={playing ? <Pause size={14} /> : <Play size={14} />}
                  />
                  <ActionIconButton
                    label={muted ? 'Unmute capsule audio' : 'Mute capsule audio'}
                    onClick={() => setMuted(current => !current)}
                    disabled={audioArtifacts.length === 0}
                    icon={muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  />
                  <div style={{ fontSize: 11, color: capsule.palette.muted }}>
                    {currentTrack ? currentTrack.name : 'No audio artifact'}
                  </div>
                </div>
              </div>
            </>
          )}

          {dropActive && (
            <div
              style={{
                position: 'absolute',
                inset: 12,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 22,
                border: `1px dashed ${capsule?.palette.accent ?? shellAccent}`,
                background: 'rgba(8, 10, 18, 0.52)',
                backdropFilter: 'blur(18px)',
                zIndex: 5,
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 700 }}>Release to build a new capsule</div>
            </div>
          )}
        </section>

        <aside
          style={{
            width: compact ? '100%' : 420,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <PanelCard title="Focused Memory" accent={capsule?.palette.accent ?? shellAccent}>
            {!selectedArtifact && (
              <div style={{ fontSize: 12, lineHeight: 1.65, color: sceneMuted }}>
                Select a floating memory to inspect it. Native-path artifacts can be opened or revealed back in the host system.
              </div>
            )}

            {selectedArtifact && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: sceneMuted }}>
                  {artifactIcon(selectedArtifact.kind)}
                  {selectedArtifact.kind}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedArtifact.name}</div>
                <div style={{ fontSize: 12, color: sceneMuted, lineHeight: 1.5 }}>
                  {selectedArtifact.displayPath}
                </div>

                {selectedArtifact.previewUrl && selectedArtifact.kind === 'image' && (
                  <img
                    src={selectedArtifact.previewUrl}
                    alt={selectedArtifact.name}
                    style={{
                      width: '100%',
                      maxHeight: 220,
                      objectFit: 'cover',
                      borderRadius: 16,
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  />
                )}

                {selectedArtifact.previewUrl && selectedArtifact.kind === 'audio' && (
                  <audio controls src={selectedArtifact.previewUrl} style={{ width: '100%' }} />
                )}

                {selectedArtifact.snippet && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontSize: 12,
                      lineHeight: 1.65,
                      color: sceneMuted,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedArtifact.snippet}
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <ActionButton
                    label="Open"
                    onClick={() => void handleOpenArtifact(selectedArtifact)}
                    icon={<ExternalLink size={14} />}
                    disabled={!selectedArtifact.path}
                  />
                  <ActionButton
                    label="Reveal"
                    onClick={() => void handleRevealArtifact(selectedArtifact)}
                    icon={<FolderOpen size={14} />}
                    disabled={!selectedArtifact.path}
                  />
                </div>
              </div>
            )}
          </PanelCard>

          <PanelCard title="Generated Shell Skin" accent={capsule?.palette.accent ?? shellAccent}>
            {!capsule && (
              <div style={{ fontSize: 12, lineHeight: 1.65, color: sceneMuted }}>
                Every capsule derives a shell palette. Copy it as a theme manifest and turn the surrounding shell into the same mood.
              </div>
            )}

            {capsule && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 12, color: sceneMuted, lineHeight: 1.6 }}>
                  {capsule.shellHint}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                  {[
                    ['Accent', capsule.palette.accent],
                    ['Glow', capsule.palette.glow],
                    ['Field A', capsule.palette.fieldA],
                    ['Field B', capsule.palette.fieldB],
                    ['Field C', capsule.palette.fieldC],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'grid', gap: 6 }}>
                      <div
                        style={{
                          height: 36,
                          borderRadius: 12,
                          background: String(value),
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                      <div style={{ fontSize: 10, color: sceneMuted }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    maxHeight: 156,
                    overflow: 'auto',
                    padding: 12,
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 11,
                    lineHeight: 1.55,
                    color: sceneMuted,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--overlay-font-mono)',
                  }}
                >
                  {capsuleThemeExport}
                </div>
              </div>
            )}
          </PanelCard>

          <PanelCard title="Capsule Shelf" accent={capsule?.palette.accent ?? shellAccent}>
            {savedCapsules.length === 0 && (
              <div style={{ fontSize: 12, lineHeight: 1.65, color: sceneMuted }}>
                Archived capsules show up here so you can reload reference worlds without rebuilding them from scratch.
              </div>
            )}
            {savedCapsules.length > 0 && (
              <div style={{ display: 'grid', gap: 8 }}>
                {savedCapsules.map(snapshot => (
                  <div
                    key={snapshot.id}
                    style={{
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                      padding: 12,
                      display: 'grid',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{snapshot.title}</div>
                      <div style={{ marginTop: 4, fontSize: 11, color: sceneMuted }}>
                        {new Date(snapshot.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, lineHeight: 1.5, color: sceneMuted }}>
                      {snapshot.story}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <ActionButton label="Load" onClick={() => handleLoadStoredCapsule(snapshot)} icon={<Play size={14} />} />
                      <ActionButton label="Delete" onClick={() => void removeStoredCapsule(snapshot.id)} icon={<RefreshCcw size={14} />} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>
        </aside>
      </div>

      <div
        style={{
          padding: '10px 16px 14px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(8, 10, 18, 0.92)',
          fontSize: 11,
          color: busy ? (capsule?.palette.accent ?? shellAccent) : shellMuted,
        }}
      >
        {busy ? 'Building capsule...' : status}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  icon,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 12px',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.12)',
        background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
        color: disabled ? 'rgba(255,255,255,0.28)' : '#f5efff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function ActionIconButton({
  label,
  onClick,
  icon,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.12)',
        background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
        color: disabled ? 'rgba(255,255,255,0.28)' : '#f5efff',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon}
    </button>
  );
}

function PanelCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        borderRadius: 20,
        border: `1px solid ${accent}22`,
        background: 'rgba(10, 12, 22, 0.9)',
        padding: 14,
        boxShadow: `0 18px 48px ${accent}14`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
        <Sparkles size={14} />
        {title}
      </div>
      {children}
    </section>
  );
}

function MetricChip({ label, accent }: { label: string; accent: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 10px',
        borderRadius: 999,
        border: `1px solid ${accent}33`,
        background: 'rgba(8, 10, 18, 0.56)',
        color: '#f7ecff',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 14,
        border: `1px solid ${accent}33`,
        background: 'rgba(8, 10, 18, 0.52)',
        backdropFilter: 'blur(16px)',
        color: '#f6efff',
      }}
    >
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.62 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function HintRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        fontSize: 12,
        color: '#dfd2ff',
      }}
    >
      {icon}
      {label}
    </div>
  );
}

export default definePlugin({
  id: 'vibe-capsule',
  name: 'Vibe Capsule',
  description: 'Turn folders, playlists, screenshots, notes, and projects into playable ambient shrines with generated shell-skin exports.',
  keepMounted: true,
  component: VibeCapsule,
});
