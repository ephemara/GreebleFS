import JSZip from 'jszip';
import * as THREE from 'three';
import { KernelAlpha, KernelArtifact, KernelMaterial } from '../types/kernel';
import { ZenWorkspaceDocument } from './types';
import { createZenWorkspaceDocument } from './document';

const dataURLToBlob = async (dataURL: string): Promise<Blob | null> => {
    if (!dataURL) return null;

    try {
        const response = await fetch(dataURL);
        return await response.blob();
    } catch {
        return null;
    }
};

export interface ZenArchiveLoadResult {
    workspace: ZenWorkspaceDocument;
    artifacts: KernelArtifact[];
    materials: KernelMaterial[];
    alphas: KernelAlpha[];
    legacy: boolean;
}

export const createZenArchive = async (
    workspace: ZenWorkspaceDocument,
    artifacts: KernelArtifact[],
    materials: KernelMaterial[],
    alphas: KernelAlpha[]
): Promise<Blob> => {
    const zip = new JSZip();
    const archiveMeta = {
        schema: 'zen.archive',
        version: '1.0.0',
        createdAt: Date.now()
    };

    const materialsMeta: any[] = [];
    const saveTexture = async (path: string, url: string) => {
        const blob = await dataURLToBlob(url);
        if (blob) {
            zip.file(path, blob);
            return path;
        }

        return null;
    };

    for (const material of materials) {
        const maps: Record<string, string | null> = {};
        maps.base = await saveTexture(`materials/${material.id}/base.png`, material.base);
        maps.normal = await saveTexture(`materials/${material.id}/normal.png`, material.normal);
        maps.roughness = await saveTexture(`materials/${material.id}/roughness.png`, material.roughness);
        maps.metallic = await saveTexture(`materials/${material.id}/metallic.png`, material.metallic);
        maps.ao = await saveTexture(`materials/${material.id}/ao.png`, material.ao);
        maps.height = await saveTexture(`materials/${material.id}/height.png`, material.height);
        maps.emissive = await saveTexture(`materials/${material.id}/emissive.png`, material.emissive);

        materialsMeta.push({
            id: material.id,
            name: material.name,
            preview: maps.base,
            maps
        });
    }

    const alphasMeta: any[] = [];
    for (const alpha of alphas) {
        const path = await saveTexture(`alphas/${alpha.id}/alpha.png`, alpha.url);
        if (path) {
            alphasMeta.push({
                id: alpha.id,
                name: alpha.name,
                path
            });
        }
    }

    artifacts.forEach((artifact) => {
        // placeholder, written below after async normalization
    });

    for (const artifact of artifacts) {
        zip.file(`artifacts/${artifact.id}`, new Uint8Array(await artifact.blob.arrayBuffer()));
        if (artifact.isWelded && artifact.weldedBlob) {
            zip.file(`artifacts/${artifact.id}_welded`, new Uint8Array(await artifact.weldedBlob.arrayBuffer()));
        }
    }

    zip.file('archive.json', JSON.stringify(archiveMeta, null, 2));
    zip.file('workspace.zen.json', JSON.stringify(workspace, null, 2));
    zip.file('materials.json', JSON.stringify(materialsMeta, null, 2));
    zip.file('alphas.json', JSON.stringify(alphasMeta, null, 2));

    return zip.generateAsync({ type: 'blob' });
};

const loadTextureFromZip = async (zip: JSZip, path?: string | null) => {
    if (!path) return null;
    const blob = await zip.file(path)?.async('blob');
    return blob ? URL.createObjectURL(blob) : null;
};

const loadLegacyArchive = async (
    zip: JSZip,
    manifest: any
): Promise<ZenArchiveLoadResult> => {
    const artifacts: KernelArtifact[] = [];
    const materials: KernelMaterial[] = [];
    const alphas: KernelAlpha[] = [];

    for (const artifactMeta of manifest.artifacts ?? []) {
        const blob = await zip.file(`artifacts/${artifactMeta.id}`)?.async('blob');
        if (!blob) continue;

        const weldedBlob = artifactMeta.isWelded
            ? await zip.file(`artifacts/${artifactMeta.id}_welded`)?.async('blob')
            : undefined;

        artifacts.push({
            ...artifactMeta,
            blob,
            weldedBlob
        });
    }

    for (const materialMeta of manifest.materials ?? []) {
        const channels = materialMeta.maps ?? {};
        const base = await loadTextureFromZip(zip, channels.base);
        if (!base) continue;

        materials.push({
            id: materialMeta.id,
            name: materialMeta.name,
            base,
            normal: await loadTextureFromZip(zip, channels.normal) ?? '',
            roughness: await loadTextureFromZip(zip, channels.roughness) ?? '',
            metallic: await loadTextureFromZip(zip, channels.metallic) ?? '',
            ao: await loadTextureFromZip(zip, channels.ao) ?? '',
            height: await loadTextureFromZip(zip, channels.height) ?? '',
            emissive: await loadTextureFromZip(zip, channels.emissive) ?? '',
            preview: base
        });
    }

    for (const alphaMeta of manifest.alphas ?? []) {
        const url = await loadTextureFromZip(zip, alphaMeta.path);
        if (!url) continue;

        alphas.push({
            id: alphaMeta.id,
            name: alphaMeta.name,
            url,
            preview: url,
            texture: new THREE.TextureLoader().load(url)
        });
    }

    return {
        workspace: createZenWorkspaceDocument('sculpt'),
        artifacts,
        materials,
        alphas,
        legacy: true
    };
};

export const loadZenArchive = async (file: File): Promise<ZenArchiveLoadResult> => {
    const zipSource = file instanceof Blob
        ? await file.arrayBuffer()
        : file;
    const zip = await JSZip.loadAsync(zipSource as Parameters<typeof JSZip.loadAsync>[0]);
    const workspaceString = await zip.file('workspace.zen.json')?.async('string');

    if (!workspaceString) {
        const legacyManifestString = await zip.file('manifest.json')?.async('string');
        if (!legacyManifestString) {
            throw new Error('Invalid project archive');
        }

        return loadLegacyArchive(zip, JSON.parse(legacyManifestString));
    }

    const workspace = JSON.parse(workspaceString) as ZenWorkspaceDocument;
    const artifacts: KernelArtifact[] = [];
    const materials: KernelMaterial[] = [];
    const alphas: KernelAlpha[] = [];

    for (const asset of workspace.assets) {
        if (!asset.storagePath.startsWith('artifacts/')) continue;

        const blob = await zip.file(asset.storagePath)?.async('blob');
        if (!blob) continue;

        const weldedBlob = await zip.file(`${asset.storagePath}_welded`)?.async('blob');

        artifacts.push({
            id: asset.id,
            name: asset.name,
            source: String(asset.metadata.source ?? asset.moduleId).toUpperCase(),
            blob,
            timestamp: asset.createdAt,
            size: asset.size,
            isWelded: Boolean(asset.metadata.welded),
            weldedBlob
        });
    }

    const materialsMetaString = await zip.file('materials.json')?.async('string');
    const materialsMeta = materialsMetaString ? JSON.parse(materialsMetaString) : [];
    for (const materialMeta of materialsMeta) {
        const maps = materialMeta.maps ?? {};
        const base = await loadTextureFromZip(zip, maps.base);
        if (!base) continue;

        materials.push({
            id: materialMeta.id,
            name: materialMeta.name,
            base,
            normal: await loadTextureFromZip(zip, maps.normal) ?? '',
            roughness: await loadTextureFromZip(zip, maps.roughness) ?? '',
            metallic: await loadTextureFromZip(zip, maps.metallic) ?? '',
            ao: await loadTextureFromZip(zip, maps.ao) ?? '',
            height: await loadTextureFromZip(zip, maps.height) ?? '',
            emissive: await loadTextureFromZip(zip, maps.emissive) ?? '',
            preview: base
        });
    }

    const alphasMetaString = await zip.file('alphas.json')?.async('string');
    const alphasMeta = alphasMetaString ? JSON.parse(alphasMetaString) : [];
    for (const alphaMeta of alphasMeta) {
        const url = await loadTextureFromZip(zip, alphaMeta.path);
        if (!url) continue;

        alphas.push({
            id: alphaMeta.id,
            name: alphaMeta.name,
            url,
            preview: url,
            texture: new THREE.TextureLoader().load(url)
        });
    }

    return {
        workspace,
        artifacts,
        materials,
        alphas,
        legacy: false
    };
};
