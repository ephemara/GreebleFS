import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MODEL_PREVIEW_SOURCE_CONFIG } from "../config/filePreview";

const {
  createObjectUrlMock,
  fbxLoaderState,
  gltfLoaderState,
  objLoaderState,
  readExplorerPreviewBytesMock,
  revokeObjectUrlMock,
  stlLoaderState,
} = vi.hoisted(() => {
  const gltfLoaderState = {
    parse: vi.fn(),
    setMeshoptDecoder: vi.fn(),
  };
  const objLoaderState = {
    parse: vi.fn(),
  };
  const fbxLoaderState = {
    parse: vi.fn(),
  };
  const stlLoaderState = {
    parse: vi.fn(),
  };

  return {
    createObjectUrlMock: vi.fn(),
    fbxLoaderState,
    gltfLoaderState,
    objLoaderState,
    readExplorerPreviewBytesMock: vi.fn(),
    revokeObjectUrlMock: vi.fn(),
    stlLoaderState,
  };
});

vi.mock("../runtime/explorerBackend", () => ({
  readExplorerPreviewBytes: readExplorerPreviewBytesMock,
}));

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: vi.fn(function GLTFLoader() {
    return gltfLoaderState;
  }),
}));

vi.mock("three/examples/jsm/loaders/OBJLoader.js", () => ({
  OBJLoader: vi.fn(function OBJLoader() {
    return objLoaderState;
  }),
}));

vi.mock("three/examples/jsm/loaders/FBXLoader.js", () => ({
  FBXLoader: vi.fn(function FBXLoader() {
    return fbxLoaderState;
  }),
}));

vi.mock("three/examples/jsm/loaders/STLLoader.js", () => ({
  STLLoader: vi.fn(function STLLoader() {
    return stlLoaderState;
  }),
}));

import { loadModelPreviewObject } from "../components/modelPreviewSource";

describe("modelPreviewSource", () => {
  beforeEach(() => {
    Object.assign(globalThis.URL, {
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    });

    createObjectUrlMock.mockReset();
    revokeObjectUrlMock.mockReset();
    readExplorerPreviewBytesMock.mockReset();
    gltfLoaderState.parse.mockReset();
    gltfLoaderState.setMeshoptDecoder.mockReset();
    objLoaderState.parse.mockReset();
    fbxLoaderState.parse.mockReset();
    stlLoaderState.parse.mockReset();
  });

  it("reads glb files through native bytes and parses them directly", async () => {
    const scene = new THREE.Group();
    readExplorerPreviewBytesMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    gltfLoaderState.parse.mockImplementation((data, resourcePath, onLoad) => {
      expect(data).toBeInstanceOf(ArrayBuffer);
      expect(resourcePath).toBe("");
      onLoad({ scene, scenes: [scene] });
    });

    const result = await loadModelPreviewObject("glb", "/models/cube.glb");

    expect(readExplorerPreviewBytesMock).toHaveBeenCalledWith(
      "/models/cube.glb",
      MODEL_PREVIEW_SOURCE_CONFIG.maxRootSourceBytes,
    );
    expect(gltfLoaderState.setMeshoptDecoder).toHaveBeenCalledTimes(1);
    expect(gltfLoaderState.parse).toHaveBeenCalledTimes(1);
    expect(result).toBe(scene);
  });

  it("rewrites gltf sidecar buffers and images to blob urls before parsing", async () => {
    const scene = new THREE.Group();
    const textEncoder = new TextEncoder();
    createObjectUrlMock
      .mockReturnValueOnce("blob:preview-1")
      .mockReturnValueOnce("blob:preview-2");
    readExplorerPreviewBytesMock.mockImplementation(async (path: string) => {
      if (path === "/models/ship.gltf") {
        return textEncoder.encode(
          JSON.stringify({
            asset: { version: "2.0" },
            buffers: [{ uri: "buffers/ship.bin" }],
            images: [{ uri: "textures/albedo.png" }],
            scene: 0,
            scenes: [{ nodes: [] }],
          }),
        );
      }

      if (path === "/models/buffers/ship.bin") {
        return new Uint8Array([1, 2, 3]);
      }

      if (path === "/models/textures/albedo.png") {
        return new Uint8Array([4, 5, 6]);
      }

      throw new Error(`Unexpected preview read: ${path}`);
    });
    gltfLoaderState.parse.mockImplementation((data, resourcePath, onLoad) => {
      expect(resourcePath).toBe("");
      expect(String(data)).toContain("blob:preview-1");
      expect(String(data)).toContain("blob:preview-2");
      onLoad({ scene, scenes: [scene] });
    });

    const result = await loadModelPreviewObject("gltf", "/models/ship.gltf");

    expect(readExplorerPreviewBytesMock).toHaveBeenCalledWith(
      "/models/ship.gltf",
      MODEL_PREVIEW_SOURCE_CONFIG.maxRootSourceBytes,
    );
    expect(readExplorerPreviewBytesMock).toHaveBeenCalledWith(
      "/models/buffers/ship.bin",
      MODEL_PREVIEW_SOURCE_CONFIG.maxGltfExternalResourceBytes,
    );
    expect(readExplorerPreviewBytesMock).toHaveBeenCalledWith(
      "/models/textures/albedo.png",
      MODEL_PREVIEW_SOURCE_CONFIG.maxGltfExternalResourceBytes,
    );
    expect(createObjectUrlMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:preview-1");
    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:preview-2");
    expect(gltfLoaderState.parse).toHaveBeenCalledTimes(1);
    expect(result).toBe(scene);
  });

  it("reads obj files as text and parses them directly", async () => {
    const object = new THREE.Group();
    readExplorerPreviewBytesMock.mockResolvedValue(
      new TextEncoder().encode("o Cube\nv 0 0 0\n"),
    );
    objLoaderState.parse.mockReturnValue(object);

    const result = await loadModelPreviewObject("obj", "/models/cube.obj");

    expect(readExplorerPreviewBytesMock).toHaveBeenCalledWith(
      "/models/cube.obj",
      MODEL_PREVIEW_SOURCE_CONFIG.maxRootSourceBytes,
    );
    expect(objLoaderState.parse).toHaveBeenCalledWith("o Cube\nv 0 0 0\n");
    expect(result).toBe(object);
  });

  it("reads fbx files through native bytes and parses them directly", async () => {
    const object = new THREE.Group();
    readExplorerPreviewBytesMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    fbxLoaderState.parse.mockImplementation((data, resourcePath) => {
      expect(data).toBeInstanceOf(ArrayBuffer);
      expect(resourcePath).toBe("");
      return object;
    });

    const result = await loadModelPreviewObject("fbx", "/models/cube.fbx");

    expect(readExplorerPreviewBytesMock).toHaveBeenCalledWith(
      "/models/cube.fbx",
      MODEL_PREVIEW_SOURCE_CONFIG.maxRootSourceBytes,
    );
    expect(fbxLoaderState.parse).toHaveBeenCalledTimes(1);
    expect(result).toBe(object);
  });

  it("reads stl files through native bytes and returns a mesh", async () => {
    const geometry = new THREE.BufferGeometry();
    readExplorerPreviewBytesMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    stlLoaderState.parse.mockImplementation((data) => {
      expect(data).toBeInstanceOf(ArrayBuffer);
      return geometry;
    });

    const result = await loadModelPreviewObject("stl", "/models/cube.stl");

    expect(readExplorerPreviewBytesMock).toHaveBeenCalledWith(
      "/models/cube.stl",
      MODEL_PREVIEW_SOURCE_CONFIG.maxRootSourceBytes,
    );
    expect(stlLoaderState.parse).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(THREE.Mesh);
    expect((result as THREE.Mesh).geometry).toBe(geometry);
  });
});
