import type {
  LoadedOverlaySoundCue,
  LoadedOverlaySoundPack,
  LoadedOverlaySoundSampleCue,
  LoadedOverlaySoundSynthCue,
  LoadedOverlaySoundTone,
  LoadedOverlaySoundNoiseLayer,
  OverlaySoundEffectGroupId,
  OverlaySoundEffectId,
} from '../config/soundPacks';
import {
  getOverlaySoundEffectDefinition,
} from '../config/soundPacks';

interface SoundEffectsRuntimeConfig {
  enabled: boolean;
  volume: number;
  pack: LoadedOverlaySoundPack | null;
  groupEnabled: Record<OverlaySoundEffectGroupId, boolean>;
}

interface PlaySoundEffectOptions {
  ignoreEnabledFlags?: boolean;
  ignoreCooldown?: boolean;
  volumeMultiplier?: number;
}

const DEFAULT_GROUP_ENABLED: Record<OverlaySoundEffectGroupId, boolean> = {
  button: true,
  navigation: true,
  task: true,
  notification: true,
};

let runtimeConfig: SoundEffectsRuntimeConfig = {
  enabled: false,
  volume: 0.72,
  pack: null,
  groupEnabled: { ...DEFAULT_GROUP_ENABLED },
};

let audioContextPromise: Promise<AudioContext | null> | null = null;
const sampleBufferCache = new Map<string, Promise<AudioBuffer | null>>();
const cueLastPlayedAt = new Map<string, number>();

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const audioWindow = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

async function ensureAudioContext(): Promise<AudioContext | null> {
  if (audioContextPromise) {
    return audioContextPromise;
  }

  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    return null;
  }

  audioContextPromise = Promise.resolve().then(async () => {
    const context = new AudioContextConstructor();
    if (context.state === 'suspended') {
      await context.resume().catch(() => undefined);
    }
    return context;
  }).catch(() => null);

  return audioContextPromise;
}

function createMasterGainNode(context: AudioContext, gainValue: number): GainNode {
  const gainNode = context.createGain();
  gainNode.gain.value = clampUnit(gainValue);
  gainNode.connect(context.destination);
  return gainNode;
}

function connectOptionalStereoPan(
  context: AudioContext,
  sourceNode: AudioNode,
  targetNode: AudioNode,
  pan: number,
): AudioNode {
  if (typeof context.createStereoPanner !== 'function') {
    sourceNode.connect(targetNode);
    return sourceNode;
  }

  const stereoPanner = context.createStereoPanner();
  stereoPanner.pan.value = Math.min(Math.max(pan, -1), 1);
  sourceNode.connect(stereoPanner);
  stereoPanner.connect(targetNode);
  return stereoPanner;
}

function scheduleTone(
  context: AudioContext,
  destinationNode: AudioNode,
  tone: LoadedOverlaySoundTone,
  cueVolume: number,
): number {
  const startAt = context.currentTime + (tone.offsetMs / 1000);
  const durationSeconds = Math.max(tone.durationMs / 1000, 0.008);
  const attackSeconds = Math.min(durationSeconds * 0.18, 0.01);
  const releaseSeconds = Math.min(durationSeconds * 0.45, 0.06);
  const stopAt = startAt + durationSeconds + releaseSeconds;

  const oscillator = context.createOscillator();
  oscillator.type = tone.waveform;
  oscillator.frequency.value = tone.frequency;
  oscillator.detune.value = tone.detuneCents;

  const gainNode = context.createGain();
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.linearRampToValueAtTime(Math.max(tone.gain * cueVolume, 0.0001), startAt + attackSeconds);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  oscillator.connect(gainNode);
  connectOptionalStereoPan(context, gainNode, destinationNode, tone.pan);
  oscillator.start(startAt);
  oscillator.stop(stopAt);
  return stopAt;
}

function buildNoiseBuffer(context: AudioContext, durationSeconds: number): AudioBuffer {
  const frameCount = Math.max(Math.ceil(context.sampleRate * durationSeconds), 1);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = (Math.random() * 2) - 1;
  }
  return buffer;
}

function scheduleNoiseLayer(
  context: AudioContext,
  destinationNode: AudioNode,
  noiseLayer: LoadedOverlaySoundNoiseLayer,
  cueVolume: number,
): number {
  const durationSeconds = Math.max(noiseLayer.durationMs / 1000, 0.006);
  const startAt = context.currentTime + (noiseLayer.offsetMs / 1000);
  const stopAt = startAt + durationSeconds;

  const noiseSource = context.createBufferSource();
  noiseSource.buffer = buildNoiseBuffer(context, durationSeconds);

  let pipeline: AudioNode = noiseSource;

  if (noiseLayer.highpassHz != null) {
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = noiseLayer.highpassHz;
    pipeline.connect(highpass);
    pipeline = highpass;
  }

  if (noiseLayer.lowpassHz != null) {
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = noiseLayer.lowpassHz;
    pipeline.connect(lowpass);
    pipeline = lowpass;
  }

  const gainNode = context.createGain();
  gainNode.gain.setValueAtTime(Math.max(noiseLayer.gain * cueVolume, 0.0001), startAt);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  pipeline.connect(gainNode);
  connectOptionalStereoPan(context, gainNode, destinationNode, noiseLayer.pan);
  noiseSource.start(startAt);
  noiseSource.stop(stopAt);
  return stopAt;
}

async function loadSampleBuffer(context: AudioContext, cue: LoadedOverlaySoundSampleCue): Promise<AudioBuffer | null> {
  const cacheKey = cue.sourceUrl;
  if (sampleBufferCache.has(cacheKey)) {
    return sampleBufferCache.get(cacheKey) ?? null;
  }

  const samplePromise = fetch(cue.sourceUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Unable to load sound sample: ${cue.sourceUrl}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return context.decodeAudioData(arrayBuffer.slice(0));
    })
    .catch(() => null);

  sampleBufferCache.set(cacheKey, samplePromise);
  return samplePromise;
}

async function playSampleCue(
  context: AudioContext,
  cue: LoadedOverlaySoundSampleCue,
  masterGainNode: GainNode,
  cueVolume: number,
): Promise<void> {
  const buffer = await loadSampleBuffer(context, cue);
  if (!buffer) {
    return;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = cue.playbackRate;

  const gainNode = context.createGain();
  gainNode.gain.value = Math.max(cue.volume * cueVolume, 0.0001);

  source.connect(gainNode);
  gainNode.connect(masterGainNode);
  source.start();
}

function playSynthCue(
  context: AudioContext,
  cue: LoadedOverlaySoundSynthCue,
  masterGainNode: GainNode,
  cueVolume: number,
): void {
  const lastEndAt = Math.max(
    0,
    ...cue.tones.map((tone) => scheduleTone(context, masterGainNode, tone, cue.volume * cueVolume)),
    ...cue.noiseLayers.map((noiseLayer) => scheduleNoiseLayer(context, masterGainNode, noiseLayer, cue.volume * cueVolume)),
  );

  if (lastEndAt > context.currentTime) {
    const cleanupDelayMs = Math.max((lastEndAt - context.currentTime) * 1000, 0) + 40;
    window.setTimeout(() => {
      masterGainNode.disconnect();
    }, cleanupDelayMs);
  } else {
    masterGainNode.disconnect();
  }
}

function shouldPlayCue(
  effectId: OverlaySoundEffectId,
  cue: LoadedOverlaySoundCue,
  options?: PlaySoundEffectOptions,
): boolean {
  if (!options?.ignoreEnabledFlags) {
    if (!runtimeConfig.enabled || !runtimeConfig.pack) {
      return false;
    }

    const groupId = getOverlaySoundEffectDefinition(effectId)?.groupId;
    if (groupId && !runtimeConfig.groupEnabled[groupId]) {
      return false;
    }
  }

  if (options?.ignoreCooldown) {
    return true;
  }

  const cooldownKey = `${runtimeConfig.pack?.id ?? 'none'}:${effectId}`;
  const lastPlayedAt = cueLastPlayedAt.get(cooldownKey) ?? 0;
  const cooldownMs = cue.cooldownMs;
  if (cooldownMs <= 0) {
    return true;
  }

  const now = Date.now();
  if ((now - lastPlayedAt) < cooldownMs) {
    return false;
  }

  cueLastPlayedAt.set(cooldownKey, now);
  return true;
}

export function configureSoundEffectsRuntime(config: Partial<SoundEffectsRuntimeConfig>): void {
  runtimeConfig = {
    enabled: config.enabled ?? runtimeConfig.enabled,
    volume: clampUnit(config.volume ?? runtimeConfig.volume),
    pack: config.pack ?? runtimeConfig.pack,
    groupEnabled: {
      ...DEFAULT_GROUP_ENABLED,
      ...runtimeConfig.groupEnabled,
      ...(config.groupEnabled ?? {}),
    },
  };
}

export async function playSoundEffect(
  effectId: OverlaySoundEffectId,
  options?: PlaySoundEffectOptions,
): Promise<boolean> {
  const cue = runtimeConfig.pack?.sounds[effectId];
  if (!cue || !shouldPlayCue(effectId, cue, options)) {
    return false;
  }

  const context = await ensureAudioContext();
  if (!context) {
    return false;
  }

  if (context.state === 'suspended') {
    await context.resume().catch(() => undefined);
  }

  const totalVolume = clampUnit(runtimeConfig.volume * (runtimeConfig.pack?.masterVolume ?? 1) * (options?.volumeMultiplier ?? 1));
  if (totalVolume <= 0) {
    return false;
  }

  const masterGainNode = createMasterGainNode(context, totalVolume);
  if (cue.kind === 'sample') {
    await playSampleCue(context, cue, masterGainNode, 1);
    window.setTimeout(() => {
      masterGainNode.disconnect();
    }, 1500);
    return true;
  }

  playSynthCue(context, cue, masterGainNode, 1);
  return true;
}

export async function previewSoundEffect(effectId: OverlaySoundEffectId): Promise<boolean> {
  return playSoundEffect(effectId, {
    ignoreEnabledFlags: true,
    ignoreCooldown: true,
  });
}
