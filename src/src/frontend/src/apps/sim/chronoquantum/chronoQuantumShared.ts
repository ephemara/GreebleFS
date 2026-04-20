import * as THREE from 'three';
import type { ZenModuleId } from '../../../core/zen/types';

export const CHRONO_QUANTUM_MODULE_IDS = ['chronos', 'quantum'] as const;
export type ChronoQuantumModuleId = (typeof CHRONO_QUANTUM_MODULE_IDS)[number];

export const CHRONO_QUANTUM_ARTIFACT_SOURCES = ['K-CHRONOS', 'K-QUANTUM'] as const;
export const CHRONO_QUANTUM_FIELD_LAYER_ID = 'chronoquantum:field';
export const CHRONO_QUANTUM_FIELD_LAYER_NAME = 'Chrono-Quantum Field';
export const CHRONO_QUANTUM_FIELD_BOOTSTRAP_LAYER_NAMES = ['Sphere_Fallback', 'SPHERE'] as const;

export interface ChronoQuantumState {
    simRes: number;
    mode: number;
    speed: number;
    chaos: number;
    damping: number;
    colorHex: string;
    colorMode: number;
    pointSize: number;
    doppler: boolean;
    useImageColor: boolean;
    activePalette: string;
    aberration: number;
    distortion: number;
    decay: number;
    scripts: Array<Record<string, unknown>>;
    newScript: string;
    activeModifiers: string[];
    modParams: Record<string, unknown>;
    audioFile: string | null;
    isPlaying: boolean;
    bassSens: number;
    highSens: number;
    audioVolume: number;
    audioSmoothing: number;
    updatedAt: number;
}

export const CHRONO_QUANTUM_DEFAULTS: ChronoQuantumState = {
    simRes: 256,
    mode: 0,
    speed: 1,
    chaos: 1,
    damping: 0.96,
    colorHex: '#00ffcc',
    colorMode: 0,
    pointSize: 1,
    doppler: false,
    useImageColor: true,
    activePalette: 'COSMIC',
    aberration: 1,
    distortion: 0,
    decay: 0.9,
    scripts: [],
    newScript: 'force.y += sin(p.x * 0.5 + t) * 2.0;',
    activeModifiers: [],
    modParams: {},
    audioFile: null,
    isPlaying: false,
    bassSens: 1,
    highSens: 1,
    audioVolume: 0.5,
    audioSmoothing: 0.8,
    updatedAt: 0
};

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

const toFiniteNumber = (value: unknown, fallback: number): number => {
    const nextValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(nextValue) ? nextValue : fallback;
};

const toBoolean = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

const toStringValue = (value: unknown, fallback: string): string =>
    typeof value === 'string' && value.trim().length > 0 ? value : fallback;

const toStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const toRecordArray = (value: unknown): Array<Record<string, unknown>> =>
    Array.isArray(value)
        ? value.filter((entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
        : [];

const toRecord = (value: unknown): Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};

export const isChronoQuantumModuleId = (value: unknown): value is ChronoQuantumModuleId =>
    value === 'chronos' || value === 'quantum';

export const isChronoQuantumArtifactSource = (value: unknown): boolean =>
    typeof value === 'string' && CHRONO_QUANTUM_ARTIFACT_SOURCES.includes(value as (typeof CHRONO_QUANTUM_ARTIFACT_SOURCES)[number]);

export const getChronoQuantumModuleLabel = (moduleId: ChronoQuantumModuleId): string =>
    moduleId === 'chronos' ? 'K-CHRONOS' : 'K-QUANTUM';

export const readChronoQuantumModuleState = (
    moduleStateById?: Record<string, Record<string, unknown>>
): Record<string, unknown> | undefined => {
    if (!moduleStateById) {
        return undefined;
    }

    let freshestState: Record<string, unknown> | undefined;
    let freshestTimestamp = -1;

    CHRONO_QUANTUM_MODULE_IDS.forEach((moduleId) => {
        const candidate = moduleStateById[moduleId];
        if (!candidate) {
            return;
        }

        const updatedAt = toFiniteNumber(candidate.updatedAt, 0);
        if (!freshestState || updatedAt >= freshestTimestamp) {
            freshestState = candidate;
            freshestTimestamp = updatedAt;
        }
    });

    return freshestState;
};

export const coerceChronoQuantumState = (
    moduleState?: Record<string, unknown>
): ChronoQuantumState => ({
    simRes: clamp(Math.round(toFiniteNumber(moduleState?.simRes, CHRONO_QUANTUM_DEFAULTS.simRes)), 32, 512),
    mode: Math.max(0, Math.round(toFiniteNumber(moduleState?.mode, CHRONO_QUANTUM_DEFAULTS.mode))),
    speed: clamp(toFiniteNumber(moduleState?.speed, CHRONO_QUANTUM_DEFAULTS.speed), 0.05, 12),
    chaos: clamp(toFiniteNumber(moduleState?.chaos, CHRONO_QUANTUM_DEFAULTS.chaos), 0, 12),
    damping: clamp(toFiniteNumber(moduleState?.damping, CHRONO_QUANTUM_DEFAULTS.damping), 0.1, 0.999),
    colorHex: toStringValue(moduleState?.colorHex, CHRONO_QUANTUM_DEFAULTS.colorHex),
    colorMode: Math.max(0, Math.round(toFiniteNumber(moduleState?.colorMode, CHRONO_QUANTUM_DEFAULTS.colorMode))),
    pointSize: clamp(toFiniteNumber(moduleState?.pointSize, CHRONO_QUANTUM_DEFAULTS.pointSize), 0.1, 10),
    doppler: toBoolean(moduleState?.doppler, CHRONO_QUANTUM_DEFAULTS.doppler),
    useImageColor: toBoolean(moduleState?.useImageColor, CHRONO_QUANTUM_DEFAULTS.useImageColor),
    activePalette: toStringValue(moduleState?.activePalette, CHRONO_QUANTUM_DEFAULTS.activePalette),
    aberration: clamp(toFiniteNumber(moduleState?.aberration, CHRONO_QUANTUM_DEFAULTS.aberration), 0, 5),
    distortion: clamp(toFiniteNumber(moduleState?.distortion, CHRONO_QUANTUM_DEFAULTS.distortion), -2, 2),
    decay: clamp(toFiniteNumber(moduleState?.decay, CHRONO_QUANTUM_DEFAULTS.decay), 0.1, 0.999),
    scripts: toRecordArray(moduleState?.scripts),
    newScript: toStringValue(moduleState?.newScript, CHRONO_QUANTUM_DEFAULTS.newScript),
    activeModifiers: toStringArray(moduleState?.activeModifiers),
    modParams: toRecord(moduleState?.modParams),
    audioFile: typeof moduleState?.audioFile === 'string' ? moduleState.audioFile : null,
    isPlaying: toBoolean(moduleState?.isPlaying, CHRONO_QUANTUM_DEFAULTS.isPlaying),
    bassSens: clamp(toFiniteNumber(moduleState?.bassSens, CHRONO_QUANTUM_DEFAULTS.bassSens), 0, 5),
    highSens: clamp(toFiniteNumber(moduleState?.highSens, CHRONO_QUANTUM_DEFAULTS.highSens), 0, 5),
    audioVolume: clamp(toFiniteNumber(moduleState?.audioVolume, CHRONO_QUANTUM_DEFAULTS.audioVolume), 0, 1),
    audioSmoothing: clamp(toFiniteNumber(moduleState?.audioSmoothing, CHRONO_QUANTUM_DEFAULTS.audioSmoothing), 0, 0.999),
    updatedAt: Math.max(0, Math.round(toFiniteNumber(moduleState?.updatedAt, CHRONO_QUANTUM_DEFAULTS.updatedAt)))
});

export const createChronoQuantumFieldGeometry = (
    state: ChronoQuantumState
): THREE.BufferGeometry => {
    const widthSegments = clamp(Math.round(state.simRes / 6), 24, 96);
    const heightSegments = clamp(Math.round(widthSegments / 2), 16, 48);
    const baseRadius = 1.2 + state.pointSize * 0.16;
    const detailPhase = state.updatedAt * 0.0015;
    const modifierInfluence = state.activeModifiers.length * 0.05;
    const scriptInfluence = state.scripts.length * 0.035;
    const geometry = new THREE.SphereGeometry(baseRadius, widthSegments, heightSegments);
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);
    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const baseColor = new THREE.Color(state.colorHex);
    const highlightColor = new THREE.Color('#ffffff');

    for (let index = 0; index < positions.count; index += 1) {
        position.fromBufferAttribute(positions, index);
        normal.copy(position).normalize();

        const waveA = Math.sin((normal.x + normal.z) * (state.mode + 1) * 2.4 + detailPhase);
        const waveB = Math.cos(normal.y * (state.speed + 1.25) * 3.2 - detailPhase * 1.4);
        const waveC = Math.sin((normal.x - normal.z) * (state.chaos + 1) * 4.4 + state.distortion * 2.6);
        const displacement = (
            waveA * (0.16 + state.chaos * 0.05)
            + waveB * (0.08 + state.speed * 0.03)
            + waveC * (0.05 + (1 - state.damping) * 0.6)
            + modifierInfluence
            + scriptInfluence
        );
        const verticalLift = state.isPlaying
            ? Math.sin(detailPhase * 2 + normal.x * 3.5 + normal.z * 1.5) * (0.12 + state.bassSens * 0.03)
            : 0;
        const radius = baseRadius + displacement;

        position.copy(normal).multiplyScalar(radius);
        position.y += verticalLift;
        positions.setXYZ(index, position.x, position.y, position.z);

        const colorBlend = clamp(0.35 + (waveA + waveB + 2) * 0.15, 0, 1);
        const vertexColor = baseColor.clone().lerp(highlightColor, colorBlend);
        colors[index * 3] = vertexColor.r;
        colors[index * 3 + 1] = vertexColor.g;
        colors[index * 3 + 2] = vertexColor.b;
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    return geometry;
};

export const buildChronoQuantumStatePatch = (
    state: Omit<ChronoQuantumState, 'updatedAt'>
): Record<string, unknown> => ({
    ...state,
    updatedAt: Date.now()
});

export const toChronoQuantumModuleId = (moduleId: ZenModuleId): ChronoQuantumModuleId =>
    moduleId === 'chronos' ? 'chronos' : 'quantum';
