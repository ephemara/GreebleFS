import { ZenModuleId, ZenWorkspaceDocument } from './types';

export const ZEN_VIEWPORT_OPERATOR_SESSION_KEY = 'viewportOperatorSession';

export const ZEN_VIEWPORT_OPERATOR_MODULE_IDS = ['greeble', 'scatter', 'cloner'] as const;

export type ZenViewportOperatorModuleId = (typeof ZEN_VIEWPORT_OPERATOR_MODULE_IDS)[number];

interface ZenViewportOperatorSessionBase<TModuleId extends ZenViewportOperatorModuleId> {
    moduleId: TModuleId;
    enabled: boolean;
    subjectAssetId: string | null;
    subjectEntityId: string | null;
    subjectLayerId: string | null;
    materialId: string | null;
    updatedAt: number;
}

export interface ZenGreebleOperatorSession extends ZenViewportOperatorSessionBase<'greeble'> {
    shape: string;
    symmetry: 'none' | 'x' | 'radial';
    radialCount: number;
    altOrbit: boolean;
    surfaceMode: boolean;
    gridLock: boolean;
    gridSize: number;
    voidAnchor: boolean;
    chaosMode: boolean;
    fractalEcho: boolean;
    scale: number;
}

export interface ZenScatterOperatorSession extends ZenViewportOperatorSessionBase<'scatter'> {
    sourceMode: 'primitive' | 'storage';
    primitive: string;
    storageAssetId: string | null;
    objectCount: number;
    scatterRadius: number;
    minScale: number;
    maxScale: number;
    scatterMode: string;
    distributionEnabled: boolean;
}

export interface ZenClonerOperatorSession extends ZenViewportOperatorSessionBase<'cloner'> {
    clonerMode: string;
    clonerCount: { x: number; y: number; z: number };
    clonerSpacing: { x: number; y: number; z: number };
    radialRadius: number;
    radialCount: number;
    normalizeScale: boolean;
    distributionMode: string;
}

export type ZenViewportOperatorSession =
    | ZenGreebleOperatorSession
    | ZenScatterOperatorSession
    | ZenClonerOperatorSession;

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};

const asString = (value: unknown, fallback: string): string =>
    typeof value === 'string' && value.trim().length > 0 ? value : fallback;

const asNullableString = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value : null;

const asBoolean = (value: unknown, fallback = false): boolean =>
    typeof value === 'boolean' ? value : fallback;

const asFiniteNumber = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asPositiveInteger = (value: unknown, fallback: number): number =>
    Math.max(1, Math.round(asFiniteNumber(value, fallback)));

const asVector3 = (
    value: unknown,
    fallback: { x: number; y: number; z: number }
): { x: number; y: number; z: number } => {
    const record = asRecord(value);
    return {
        x: asFiniteNumber(record.x, fallback.x),
        y: asFiniteNumber(record.y, fallback.y),
        z: asFiniteNumber(record.z, fallback.z)
    };
};

const getNestedSessionRecord = (moduleState?: Record<string, unknown>): Record<string, unknown> => {
    const nested = asRecord(moduleState?.[ZEN_VIEWPORT_OPERATOR_SESSION_KEY]);
    return Object.keys(nested).length > 0 ? nested : {};
};

const coerceBaseSession = <TModuleId extends ZenViewportOperatorModuleId>(
    moduleId: TModuleId,
    sessionState: Record<string, unknown>,
    fallback: Partial<ZenViewportOperatorSessionBase<TModuleId>> = {}
): ZenViewportOperatorSessionBase<TModuleId> => ({
    moduleId,
    enabled: asBoolean(sessionState.enabled, fallback.enabled ?? true),
    subjectAssetId: asNullableString(sessionState.subjectAssetId) ?? fallback.subjectAssetId ?? null,
    subjectEntityId: asNullableString(sessionState.subjectEntityId) ?? fallback.subjectEntityId ?? null,
    subjectLayerId: asNullableString(sessionState.subjectLayerId) ?? fallback.subjectLayerId ?? null,
    materialId: asNullableString(sessionState.materialId) ?? fallback.materialId ?? null,
    updatedAt: asFiniteNumber(sessionState.updatedAt, fallback.updatedAt ?? 0)
});

export const isZenViewportOperatorModule = (moduleId: ZenModuleId): moduleId is ZenViewportOperatorModuleId =>
    (ZEN_VIEWPORT_OPERATOR_MODULE_IDS as readonly string[]).includes(moduleId);

export const readZenGreebleOperatorSession = (
    moduleState?: Record<string, unknown>
): ZenGreebleOperatorSession => {
    const nested = getNestedSessionRecord(moduleState);
    const sessionState = Object.keys(nested).length > 0 ? nested : asRecord(moduleState);
    const symmetryValue = asString(sessionState.symmetry, 'none').toLowerCase();
    const symmetry = symmetryValue === 'x' || symmetryValue === 'radial' ? symmetryValue : 'none';

    return {
        ...coerceBaseSession('greeble', sessionState),
        shape: asString(sessionState.shape ?? sessionState.activeShape, 'greeble'),
        symmetry,
        radialCount: asPositiveInteger(sessionState.radialCount, 6),
        altOrbit: asBoolean(sessionState.altOrbit),
        surfaceMode: asBoolean(sessionState.surfaceMode),
        gridLock: asBoolean(sessionState.gridLock),
        gridSize: Math.max(0.01, asFiniteNumber(sessionState.gridSize, 0.5)),
        voidAnchor: asBoolean(sessionState.voidAnchor),
        chaosMode: asBoolean(sessionState.chaosMode),
        fractalEcho: asBoolean(sessionState.fractalEcho),
        scale: Math.max(0.01, asFiniteNumber(sessionState.scale, 1))
    };
};

export const readZenScatterOperatorSession = (
    moduleState?: Record<string, unknown>
): ZenScatterOperatorSession => {
    const nested = getNestedSessionRecord(moduleState);
    const sessionState = Object.keys(nested).length > 0 ? nested : asRecord(moduleState);
    const sourceMode = asString(sessionState.sourceMode, 'primitive').toLowerCase() === 'storage'
        ? 'storage'
        : 'primitive';

    return {
        ...coerceBaseSession('scatter', sessionState),
        sourceMode,
        primitive: asString(sessionState.primitive ?? sessionState.activePrimitive, 'CUBE'),
        storageAssetId: asNullableString(sessionState.storageAssetId),
        objectCount: asPositiveInteger(sessionState.objectCount, 100),
        scatterRadius: Math.max(0.01, asFiniteNumber(sessionState.scatterRadius, 2)),
        minScale: Math.max(0.001, asFiniteNumber(sessionState.minScale, 0.05)),
        maxScale: Math.max(0.001, asFiniteNumber(sessionState.maxScale, 0.2)),
        scatterMode: asString(sessionState.scatterMode, 'CLOUD'),
        distributionEnabled: asBoolean(sessionState.distributionEnabled)
    };
};

export const readZenClonerOperatorSession = (
    moduleState?: Record<string, unknown>
): ZenClonerOperatorSession => {
    const nested = getNestedSessionRecord(moduleState);
    const sessionState = Object.keys(nested).length > 0 ? nested : asRecord(moduleState);

    return {
        ...coerceBaseSession('cloner', sessionState),
        clonerMode: asString(sessionState.clonerMode ?? sessionState.sessionClonerMode, 'GRID'),
        clonerCount: asVector3(sessionState.clonerCount ?? sessionState.sessionClonerCount, { x: 5, y: 1, z: 5 }),
        clonerSpacing: asVector3(sessionState.clonerSpacing ?? sessionState.sessionClonerSpacing, { x: 2, y: 2, z: 2 }),
        radialRadius: Math.max(0.01, asFiniteNumber(sessionState.radialRadius ?? sessionState.sessionRadialRadius, 5)),
        radialCount: asPositiveInteger(sessionState.radialCount ?? sessionState.sessionRadialCount, 8),
        normalizeScale: asBoolean(sessionState.normalizeScale ?? sessionState.sessionNormalizeScale, true),
        distributionMode: asString(sessionState.distributionMode ?? sessionState.sessionDistributionMode, 'ROUND_ROBIN')
    };
};

export const readZenViewportOperatorSession = (
    document: ZenWorkspaceDocument,
    moduleId: ZenViewportOperatorModuleId
): ZenViewportOperatorSession => {
    const moduleState = document.moduleState[moduleId];
    switch (moduleId) {
        case 'greeble':
            return readZenGreebleOperatorSession(moduleState);
        case 'scatter':
            return readZenScatterOperatorSession(moduleState);
        case 'cloner':
            return readZenClonerOperatorSession(moduleState);
    }
};

export const readActiveZenViewportOperatorSession = (
    document: ZenWorkspaceDocument
): ZenViewportOperatorSession | null =>
    isZenViewportOperatorModule(document.activeModuleId)
        ? readZenViewportOperatorSession(document, document.activeModuleId)
        : null;
