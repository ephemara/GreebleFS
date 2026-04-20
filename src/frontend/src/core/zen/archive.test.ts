import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createZenArchive, loadZenArchive } from './archive';
import { createZenWorkspaceDocument, upsertAsset } from './document';
import { KernelArtifact } from '../types/kernel';

describe('zen archive io', () => {
    it('round-trips a .zen workspace archive', async () => {
        const workspace = upsertAsset(createZenWorkspaceDocument('rig'), {
            id: 'ART_ZEN',
            name: 'RigAsset',
            moduleId: 'rig',
            kind: 'scene',
            mimeType: 'model/gltf-binary',
            size: 4,
            storagePath: 'artifacts/ART_ZEN',
            extension: 'glb',
            createdAt: 10,
            updatedAt: 10,
            metadata: {
                source: 'K-RIG'
            }
        });

        const artifacts: KernelArtifact[] = [
            {
                id: 'ART_ZEN',
                name: 'RigAsset',
                source: 'K-RIG',
                blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'model/gltf-binary' }),
                timestamp: 10,
                size: 4
            }
        ];

        const archive = await createZenArchive(workspace, artifacts, [], []);
        const file = new File([archive], 'roundtrip.zen', { type: 'application/octet-stream' });
        const loaded = await loadZenArchive(file);

        expect(loaded.legacy).toBe(false);
        expect(loaded.workspace.schema).toBe('zen.workspace');
        expect(loaded.artifacts).toHaveLength(1);
        expect(loaded.artifacts[0].id).toBe('ART_ZEN');
    });

    it('loads legacy .kipp archives into the new workspace loader', async () => {
        const zip = new JSZip();
        zip.file('manifest.json', JSON.stringify({
            version: '0.9.1',
            artifacts: [
                {
                    id: 'ART_LEGACY',
                    name: 'LegacyMesh',
                    source: 'K-SCULPT',
                    size: 3,
                    type: 'model/gltf-binary',
                    isWelded: false
                }
            ],
            materials: [],
            alphas: []
        }));
        zip.file('artifacts/ART_LEGACY', new Uint8Array([7, 8, 9]));

        const legacyBlob = await zip.generateAsync({ type: 'blob' });
        const legacyFile = new File([legacyBlob], 'legacy.kipp', { type: 'application/octet-stream' });
        const loaded = await loadZenArchive(legacyFile);

        expect(loaded.legacy).toBe(true);
        expect(loaded.workspace.schema).toBe('zen.workspace');
        expect(loaded.artifacts[0].name).toBe('LegacyMesh');
    });
});
