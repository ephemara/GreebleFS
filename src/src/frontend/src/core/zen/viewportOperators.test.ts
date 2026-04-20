import { describe, expect, it } from 'vitest';
import { createZenWorkspaceDocument, setModuleState } from './document';
import {
    readActiveZenViewportOperatorSession,
    readZenClonerOperatorSession,
    readZenGreebleOperatorSession,
    readZenScatterOperatorSession,
    ZEN_VIEWPORT_OPERATOR_SESSION_KEY
} from './viewportOperators';

describe('zen viewport operator sessions', () => {
    it('reads nested greeble sessions from module state', () => {
        const session = readZenGreebleOperatorSession({
            [ZEN_VIEWPORT_OPERATOR_SESSION_KEY]: {
                moduleId: 'greeble',
                enabled: true,
                subjectLayerId: 'sculpt:hero',
                subjectEntityId: 'sculpt:entity:hero',
                subjectAssetId: 'ART_HERO',
                materialId: 'MAT_HERO',
                updatedAt: 42,
                shape: 'greeble',
                symmetry: 'radial',
                radialCount: 12,
                altOrbit: true,
                surfaceMode: true,
                gridLock: true,
                gridSize: 0.25,
                voidAnchor: true,
                chaosMode: true,
                fractalEcho: true,
                scale: 1.5
            }
        });

        expect(session.subjectLayerId).toBe('sculpt:hero');
        expect(session.symmetry).toBe('radial');
        expect(session.radialCount).toBe(12);
        expect(session.altOrbit).toBe(true);
        expect(session.surfaceMode).toBe(true);
        expect(session.scale).toBe(1.5);
    });

    it('falls back to legacy scatter and cloner fields', () => {
        const scatterSession = readZenScatterOperatorSession({
            activePrimitive: 'SPHERE',
            objectCount: 250,
            scatterRadius: 6,
            minScale: 0.2,
            maxScale: 0.8,
            scatterMode: 'SURFACE'
        });
        const clonerSession = readZenClonerOperatorSession({
            sessionClonerMode: 'RADIAL',
            sessionClonerCount: { x: 3, y: 1, z: 2 },
            sessionClonerSpacing: { x: 1.5, y: 2, z: 2.5 },
            sessionRadialRadius: 8,
            sessionRadialCount: 24,
            sessionNormalizeScale: false,
            sessionDistributionMode: 'RANDOM'
        });

        expect(scatterSession.primitive).toBe('SPHERE');
        expect(scatterSession.objectCount).toBe(250);
        expect(clonerSession.clonerMode).toBe('RADIAL');
        expect(clonerSession.radialRadius).toBe(8);
        expect(clonerSession.distributionMode).toBe('RANDOM');
    });

    it('resolves the active operator session from the active module', () => {
        const workspace = setModuleState(
            createZenWorkspaceDocument('scatter'),
            'scatter',
            {
                [ZEN_VIEWPORT_OPERATOR_SESSION_KEY]: {
                    moduleId: 'scatter',
                    enabled: true,
                    subjectLayerId: 'sculpt:subject',
                    subjectEntityId: 'sculpt:entity:subject',
                    subjectAssetId: 'ART_SUBJECT',
                    materialId: 'MAT_SUBJECT',
                    updatedAt: 99,
                    sourceMode: 'primitive',
                    primitive: 'CUBE',
                    storageAssetId: null,
                    objectCount: 32,
                    scatterRadius: 4,
                    minScale: 0.1,
                    maxScale: 0.5,
                    scatterMode: 'CLOUD',
                    distributionEnabled: false
                }
            }
        );

        const session = readActiveZenViewportOperatorSession(workspace);

        expect(session?.moduleId).toBe('scatter');
        expect(session?.subjectLayerId).toBe('sculpt:subject');
        expect((session && 'objectCount' in session) ? session.objectCount : null).toBe(32);
    });
});
