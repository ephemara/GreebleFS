import { KernelArtifact, KernelMaterial, KernelAlpha } from '../core/types/kernel';
import { ThumbnailGen } from '../core/services/thumbnailGenerator';
import { loadModel } from '../core/three/threeImport';
import { exportScene } from '../core/three/threeExport';
import { createZenArchive, loadZenArchive } from '../core/zen/archive';
import { ZenWorkspaceDocument } from '../core/zen';

/**
 * Save project to .zen file
 */
export const saveProject = async (
    artifacts: KernelArtifact[],
    materials: KernelMaterial[],
    alphas: KernelAlpha[],
    setStatus: (status: string) => void,
    workspace: ZenWorkspaceDocument
): Promise<void> => {
    setStatus("ARCHIVING PROJECT...");
    try {
        const content = await createZenArchive(workspace, artifacts, materials, alphas);
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ZEN_PROJECT_${new Date().toISOString().split('T')[0]}.zen`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setStatus("PROJECT EXPORTED");
    } catch (e) {
        console.error(e);
        setStatus("ARCHIVE ERROR");
    }
};

/**
 * Load project from .zen or legacy .kipp file
 */
export const loadProject = async (
    file: File,
    setStatus: (status: string) => void
): Promise<{
    artifacts: KernelArtifact[];
    materials: KernelMaterial[];
    alphas: KernelAlpha[];
    workspace: ZenWorkspaceDocument;
}> => {
    setStatus("READING ARCHIVE...");
    try {
        const loaded = await loadZenArchive(file);
        const newArtifacts = await Promise.all(loaded.artifacts.map(async (artifact) => ({
            ...artifact,
            thumbnail: await ThumbnailGen.generate(artifact.blob)
        })));

        setStatus("SESSION RESTORED");
        return {
            artifacts: newArtifacts,
            materials: loaded.materials,
            alphas: loaded.alphas,
            workspace: loaded.workspace
        };
    } catch (e) {
        console.error(e);
        setStatus("FILE CORRUPTED");
        throw e;
    }
};

/**
 * Process file import
 */
export const processImport = async (
    file: File,
    onCommit: (blob: Blob, source: string) => Promise<void>,
    setStatus: (status: string) => void
): Promise<void> => {
    setStatus(`ANALYZING ${file.name.toUpperCase()}...`);

    try {
        const { scene, animations } = await loadModel(file, {
            normalize: true,
            targetSize: 4.0,
            center: true
        });

        setStatus("CONVERTING TO KIPP BINARY...");
        await new Promise<void>(resolve => setTimeout(resolve, 100));

        const blob = await exportScene(
            { scene: scene as any, animations },
            {
                format: 'GLB',
                binary: true,
                normalize: false
            }
        );

        await onCommit(blob, "IMPORT_EXTERNAL");
        setStatus("IMPORT SUCCESSFUL");
    } catch (e) {
        console.error(e);
        setStatus("IMPORT FAILED");
        throw e;
    }
};

