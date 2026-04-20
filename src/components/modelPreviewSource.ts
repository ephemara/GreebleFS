import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { ModelPreviewFormat } from '../config/filePreview';
import {
  detectClientPlatform,
  getPlatformPathSeparator,
  joinPlatformPath,
} from '../config/platform';
import {
  readExplorerFileBase64,
  readExplorerTextFile,
} from '../runtime/explorerBackend';
import { decodeDataUrlToUint8Array } from './modelPreview.utils';

type GltfResourceCollection = Array<{ uri?: string | null } | undefined> | undefined;

export async function loadModelPreviewObject(
  format: ModelPreviewFormat,
  sourcePath: string,
): Promise<THREE.Object3D> {
  switch (format) {
    case 'glb':
      return loadGlbPreviewObject(sourcePath);
    case 'gltf':
      return loadGltfPreviewObject(sourcePath);
    case 'obj':
      return loadObjPreviewObject(sourcePath);
    case 'fbx':
      return loadFbxPreviewObject(sourcePath);
    case 'stl':
      return loadStlPreviewObject(sourcePath);
    default:
      throw new Error(`Unsupported model preview format: ${format}`);
  }
}

async function loadGlbPreviewObject(sourcePath: string): Promise<THREE.Object3D> {
  const loader = createGltfLoader();
  const dataUrl = await readExplorerFileBase64(sourcePath);
  const asset = await parseGltfAsync(
    loader,
    decodeDataUrlToUint8Array(dataUrl).buffer,
  );
  return asset.scene ?? asset.scenes[0];
}

async function loadGltfPreviewObject(sourcePath: string): Promise<THREE.Object3D> {
  const loader = createGltfLoader();
  const content = await readExplorerTextFile(sourcePath);
  const inlinedContent = await inlineGltfExternalResources(content, sourcePath);
  const asset = await parseGltfAsync(loader, inlinedContent);
  return asset.scene ?? asset.scenes[0];
}

async function loadObjPreviewObject(sourcePath: string): Promise<THREE.Object3D> {
  const loader = new OBJLoader();
  const content = await readExplorerTextFile(sourcePath);
  return loader.parse(content);
}

async function loadFbxPreviewObject(sourcePath: string): Promise<THREE.Object3D> {
  const loader = new FBXLoader();
  const dataUrl = await readExplorerFileBase64(sourcePath);
  return parseFbxAsync(loader, decodeDataUrlToUint8Array(dataUrl).buffer);
}

async function loadStlPreviewObject(sourcePath: string): Promise<THREE.Object3D> {
  const loader = new STLLoader();
  const dataUrl = await readExplorerFileBase64(sourcePath);
  const geometry = loader.parse(decodeDataUrlToUint8Array(dataUrl).buffer);
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: '#cbd6e2',
      roughness: 0.64,
      metalness: 0.08,
    }),
  );
}

function createGltfLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

async function inlineGltfExternalResources(
  content: string,
  sourcePath: string,
): Promise<string> {
  const gltf = JSON.parse(content) as {
    buffers?: GltfResourceCollection;
    images?: GltfResourceCollection;
  };
  const sourceDirectory = getParentDirectory(sourcePath);
  if (!sourceDirectory) {
    return content;
  }

  const dataUrlCache = new Map<string, Promise<string>>();
  await Promise.all([
    inlineGltfResourceCollection(gltf.buffers, sourceDirectory, dataUrlCache),
    inlineGltfResourceCollection(gltf.images, sourceDirectory, dataUrlCache),
  ]);

  return JSON.stringify(gltf);
}

async function inlineGltfResourceCollection(
  entries: GltfResourceCollection,
  sourceDirectory: string,
  dataUrlCache: Map<string, Promise<string>>,
): Promise<void> {
  if (!entries?.length) {
    return;
  }

  await Promise.all(entries.map(async (entry) => {
    if (!entry?.uri) {
      return;
    }

    const dataUrl = await resolvePreviewDataUrl(entry.uri, sourceDirectory, dataUrlCache);
    if (dataUrl) {
      entry.uri = dataUrl;
    }
  }));
}

async function resolvePreviewDataUrl(
  uri: string,
  sourceDirectory: string,
  dataUrlCache: Map<string, Promise<string>>,
): Promise<string | null> {
  if (isAbsolutePreviewResourceUrl(uri)) {
    return null;
  }

  const [relativePath] = uri.match(/^([^?#]+)/) ?? [];
  if (!relativePath) {
    return null;
  }

  const resolvedPath = resolvePreviewRelativePath(sourceDirectory, relativePath);
  const cachedDataUrl = dataUrlCache.get(resolvedPath);
  if (cachedDataUrl) {
    return cachedDataUrl;
  }

  const dataUrlPromise = readExplorerFileBase64(resolvedPath).catch((error) => {
    dataUrlCache.delete(resolvedPath);
    throw error;
  });
  dataUrlCache.set(resolvedPath, dataUrlPromise);
  return dataUrlPromise;
}

function resolvePreviewRelativePath(sourceDirectory: string, relativePath: string): string {
  const platform = detectClientPlatform();
  const separator = getPlatformPathSeparator(platform);
  const normalizedRelativePath = relativePath.replace(/[\\/]+/g, separator);
  if (sourceDirectory === '/') {
    return `/${normalizedRelativePath}`;
  }
  return joinPlatformPath(sourceDirectory, normalizedRelativePath, platform);
}

function getParentDirectory(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/');
  const lastSlashIndex = normalizedPath.lastIndexOf('/');

  if (lastSlashIndex < 0) {
    return '';
  }

  if (lastSlashIndex === 0) {
    return '/';
  }

  return path.slice(0, lastSlashIndex);
}

function isAbsolutePreviewResourceUrl(url: string): boolean {
  return /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(url) || /^[a-z]:[\\/]/i.test(url);
}

function parseGltfAsync(loader: GLTFLoader, data: string | ArrayBuffer) {
  return new Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>((resolve, reject) => {
    loader.parse(data, '', resolve, reject);
  });
}

function parseFbxAsync(loader: FBXLoader, data: ArrayBuffer) {
  return new Promise<THREE.Group>((resolve, reject) => {
    try {
      resolve(loader.parse(data, ''));
    } catch (error) {
      reject(error);
    }
  });
}
