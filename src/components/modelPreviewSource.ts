import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import {
  MODEL_PREVIEW_SOURCE_CONFIG,
  type ModelPreviewFormat,
} from "../config/filePreview";
import {
  detectClientPlatform,
  getPlatformPathSeparator,
  joinPlatformPath,
} from "../config/platform";
import { readExplorerPreviewBytes } from "../runtime/explorerBackend";

type GltfResourceCollection =
  | Array<{ uri?: string | null } | undefined>
  | undefined;
type PreparedGltfContent = {
  content: string;
  release: () => void;
};

const MODEL_PREVIEW_TEXTURE_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  avif: "image/avif",
  basis: "image/x-basis",
  bin: "application/octet-stream",
  bmp: "image/bmp",
  gif: "image/gif",
  hdr: "image/vnd.radiance",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  ktx2: "image/ktx2",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};
const MODEL_PREVIEW_TEXT_DECODER = new TextDecoder("utf-8");

export async function loadModelPreviewObject(
  format: ModelPreviewFormat,
  sourcePath: string,
): Promise<THREE.Object3D> {
  switch (format) {
    case "glb":
      return loadGlbPreviewObject(sourcePath);
    case "gltf":
      return loadGltfPreviewObject(sourcePath);
    case "obj":
      return loadObjPreviewObject(sourcePath);
    case "fbx":
      return loadFbxPreviewObject(sourcePath);
    case "stl":
      return loadStlPreviewObject(sourcePath);
    default:
      throw new Error(`Unsupported model preview format: ${format}`);
  }
}

async function loadGlbPreviewObject(
  sourcePath: string,
): Promise<THREE.Object3D> {
  const loader = createGltfLoader();
  const bytes = await readModelPreviewBytes(
    sourcePath,
    MODEL_PREVIEW_SOURCE_CONFIG.maxRootSourceBytes,
  );
  const asset = await parseGltfAsync(loader, toArrayBuffer(bytes));
  return asset.scene ?? asset.scenes[0];
}

async function loadGltfPreviewObject(
  sourcePath: string,
): Promise<THREE.Object3D> {
  const loader = createGltfLoader();
  const sourceBytes = await readModelPreviewBytes(
    sourcePath,
    MODEL_PREVIEW_SOURCE_CONFIG.maxRootSourceBytes,
  );
  const preparedContent = await inlineGltfExternalResources(
    decodePreviewText(sourceBytes),
    sourcePath,
  );
  try {
    const asset = await parseGltfAsync(loader, preparedContent.content);
    return asset.scene ?? asset.scenes[0];
  } finally {
    preparedContent.release();
  }
}

async function loadObjPreviewObject(
  sourcePath: string,
): Promise<THREE.Object3D> {
  const loader = new OBJLoader();
  const bytes = await readModelPreviewBytes(
    sourcePath,
    MODEL_PREVIEW_SOURCE_CONFIG.maxRootSourceBytes,
  );
  return loader.parse(decodePreviewText(bytes));
}

async function loadFbxPreviewObject(
  sourcePath: string,
): Promise<THREE.Object3D> {
  const loader = new FBXLoader();
  const bytes = await readModelPreviewBytes(
    sourcePath,
    MODEL_PREVIEW_SOURCE_CONFIG.maxRootSourceBytes,
  );
  return parseFbxAsync(loader, toArrayBuffer(bytes));
}

async function loadStlPreviewObject(
  sourcePath: string,
): Promise<THREE.Object3D> {
  const loader = new STLLoader();
  const bytes = await readModelPreviewBytes(
    sourcePath,
    MODEL_PREVIEW_SOURCE_CONFIG.maxRootSourceBytes,
  );
  const geometry = loader.parse(toArrayBuffer(bytes));
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: "#cbd6e2",
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
): Promise<PreparedGltfContent> {
  const gltf = JSON.parse(content) as {
    buffers?: GltfResourceCollection;
    images?: GltfResourceCollection;
  };
  const sourceDirectory = getParentDirectory(sourcePath);
  if (!sourceDirectory) {
    return {
      content,
      release: () => undefined,
    };
  }

  const objectUrlCache = new Map<string, Promise<string>>();
  const trackedObjectUrls = new Set<string>();
  await Promise.all([
    inlineGltfResourceCollection(
      gltf.buffers,
      sourceDirectory,
      objectUrlCache,
      trackedObjectUrls,
    ),
    inlineGltfResourceCollection(
      gltf.images,
      sourceDirectory,
      objectUrlCache,
      trackedObjectUrls,
    ),
  ]);

  return {
    content: JSON.stringify(gltf),
    release: () => {
      trackedObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    },
  };
}

async function inlineGltfResourceCollection(
  entries: GltfResourceCollection,
  sourceDirectory: string,
  objectUrlCache: Map<string, Promise<string>>,
  trackedObjectUrls: Set<string>,
): Promise<void> {
  if (!entries?.length) {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry?.uri) {
        return;
      }

      const objectUrl = await resolvePreviewObjectUrl(
        entry.uri,
        sourceDirectory,
        objectUrlCache,
        trackedObjectUrls,
      );
      if (objectUrl) {
        entry.uri = objectUrl;
      }
    }),
  );
}

async function resolvePreviewObjectUrl(
  uri: string,
  sourceDirectory: string,
  objectUrlCache: Map<string, Promise<string>>,
  trackedObjectUrls: Set<string>,
): Promise<string | null> {
  if (isAbsolutePreviewResourceUrl(uri)) {
    return null;
  }

  const [relativePath] = uri.match(/^([^?#]+)/) ?? [];
  if (!relativePath) {
    return null;
  }

  const resolvedPath = resolvePreviewRelativePath(
    sourceDirectory,
    relativePath,
  );
  const cachedObjectUrl = objectUrlCache.get(resolvedPath);
  if (cachedObjectUrl) {
    return cachedObjectUrl;
  }

  const objectUrlPromise = readModelPreviewBytes(
    resolvedPath,
    MODEL_PREVIEW_SOURCE_CONFIG.maxGltfExternalResourceBytes,
  )
    .then((bytes) => {
      const objectUrl = URL.createObjectURL(
        new Blob([bytes], {
          type: getPreviewBlobMimeType(resolvedPath),
        }),
      );
      trackedObjectUrls.add(objectUrl);
      return objectUrl;
    })
    .catch((error) => {
      objectUrlCache.delete(resolvedPath);
      throw error;
    });
  objectUrlCache.set(resolvedPath, objectUrlPromise);
  return objectUrlPromise;
}

async function readModelPreviewBytes(
  path: string,
  maxBytes: number,
): Promise<Uint8Array> {
  return readExplorerPreviewBytes(path, maxBytes);
}

function decodePreviewText(bytes: Uint8Array): string {
  return MODEL_PREVIEW_TEXT_DECODER.decode(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

function getPreviewBlobMimeType(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return (
    MODEL_PREVIEW_TEXTURE_MIME_TYPE_BY_EXTENSION[extension] ??
    "application/octet-stream"
  );
}

function resolvePreviewRelativePath(
  sourceDirectory: string,
  relativePath: string,
): string {
  const platform = detectClientPlatform();
  const separator = getPlatformPathSeparator(platform);
  const normalizedRelativePath = relativePath.replace(/[\\/]+/g, separator);
  if (sourceDirectory === "/") {
    return `/${normalizedRelativePath}`;
  }
  return joinPlatformPath(sourceDirectory, normalizedRelativePath, platform);
}

function getParentDirectory(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const lastSlashIndex = normalizedPath.lastIndexOf("/");

  if (lastSlashIndex < 0) {
    return "";
  }

  if (lastSlashIndex === 0) {
    return "/";
  }

  return path.slice(0, lastSlashIndex);
}

function isAbsolutePreviewResourceUrl(url: string): boolean {
  return /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(url) || /^[a-z]:[\\/]/i.test(url);
}

function parseGltfAsync(loader: GLTFLoader, data: string | ArrayBuffer) {
  return new Promise<Awaited<ReturnType<GLTFLoader["loadAsync"]>>>(
    (resolve, reject) => {
      loader.parse(data, "", resolve, reject);
    },
  );
}

function parseFbxAsync(loader: FBXLoader, data: ArrayBuffer) {
  return new Promise<THREE.Group>((resolve, reject) => {
    try {
      resolve(loader.parse(data, ""));
    } catch (error) {
      reject(error);
    }
  });
}
