import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fbxLoaderState,
  gltfLoaderState,
  objLoaderState,
  readExplorerFileBase64Mock,
  readExplorerTextFileMock,
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
    fbxLoaderState,
    gltfLoaderState,
    objLoaderState,
    readExplorerFileBase64Mock: vi.fn(),
    readExplorerTextFileMock: vi.fn(),
    stlLoaderState,
  };
});

vi.mock('../runtime/explorerBackend', () => ({
  readExplorerFileBase64: readExplorerFileBase64Mock,
  readExplorerTextFile: readExplorerTextFileMock,
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn(function GLTFLoader() {
    return gltfLoaderState;
  }),
}));

vi.mock('three/examples/jsm/loaders/OBJLoader.js', () => ({
  OBJLoader: vi.fn(function OBJLoader() {
    return objLoaderState;
  }),
}));

vi.mock('three/examples/jsm/loaders/FBXLoader.js', () => ({
  FBXLoader: vi.fn(function FBXLoader() {
    return fbxLoaderState;
  }),
}));

vi.mock('three/examples/jsm/loaders/STLLoader.js', () => ({
  STLLoader: vi.fn(function STLLoader() {
    return stlLoaderState;
  }),
}));

import { loadModelPreviewObject } from '../components/modelPreviewSource';

describe('modelPreviewSource', () => {
  beforeEach(() => {
    readExplorerFileBase64Mock.mockReset();
    readExplorerTextFileMock.mockReset();
    gltfLoaderState.parse.mockReset();
    gltfLoaderState.setMeshoptDecoder.mockReset();
    objLoaderState.parse.mockReset();
    fbxLoaderState.parse.mockReset();
    stlLoaderState.parse.mockReset();
  });

  it('reads glb files through native bytes and parses them directly', async () => {
    const scene = new THREE.Group();
    readExplorerFileBase64Mock.mockResolvedValue('data:application/octet-stream;base64,AQID');
    gltfLoaderState.parse.mockImplementation((data, resourcePath, onLoad) => {
      expect(data).toBeInstanceOf(ArrayBuffer);
      expect(resourcePath).toBe('');
      onLoad({ scene, scenes: [scene] });
    });

    const result = await loadModelPreviewObject('glb', '/models/cube.glb');

    expect(readExplorerFileBase64Mock).toHaveBeenCalledWith('/models/cube.glb');
    expect(gltfLoaderState.setMeshoptDecoder).toHaveBeenCalledTimes(1);
    expect(gltfLoaderState.parse).toHaveBeenCalledTimes(1);
    expect(result).toBe(scene);
  });

  it('inlines gltf sidecar buffers and images before parsing', async () => {
    const scene = new THREE.Group();
    readExplorerTextFileMock.mockImplementation(async (path: string) => {
      if (path === '/models/ship.gltf') {
        return JSON.stringify({
          asset: { version: '2.0' },
          buffers: [{ uri: 'buffers/ship.bin' }],
          images: [{ uri: 'textures/albedo.png' }],
          scene: 0,
          scenes: [{ nodes: [] }],
        });
      }

      throw new Error(`Unexpected text read: ${path}`);
    });
    readExplorerFileBase64Mock.mockImplementation(async (path: string) => {
      if (path === '/models/buffers/ship.bin') {
        return 'data:application/octet-stream;base64,AQID';
      }

      if (path === '/models/textures/albedo.png') {
        return 'data:image/png;base64,Zm9v';
      }

      throw new Error(`Unexpected binary read: ${path}`);
    });
    gltfLoaderState.parse.mockImplementation((data, resourcePath, onLoad) => {
      expect(resourcePath).toBe('');
      expect(String(data)).toContain('data:application/octet-stream;base64,AQID');
      expect(String(data)).toContain('data:image/png;base64,Zm9v');
      onLoad({ scene, scenes: [scene] });
    });

    const result = await loadModelPreviewObject('gltf', '/models/ship.gltf');

    expect(readExplorerTextFileMock).toHaveBeenCalledWith('/models/ship.gltf');
    expect(readExplorerFileBase64Mock).toHaveBeenCalledWith('/models/buffers/ship.bin');
    expect(readExplorerFileBase64Mock).toHaveBeenCalledWith('/models/textures/albedo.png');
    expect(gltfLoaderState.parse).toHaveBeenCalledTimes(1);
    expect(result).toBe(scene);
  });

  it('reads obj files as text and parses them directly', async () => {
    const object = new THREE.Group();
    readExplorerTextFileMock.mockResolvedValue('o Cube\nv 0 0 0\n');
    objLoaderState.parse.mockReturnValue(object);

    const result = await loadModelPreviewObject('obj', '/models/cube.obj');

    expect(readExplorerTextFileMock).toHaveBeenCalledWith('/models/cube.obj');
    expect(objLoaderState.parse).toHaveBeenCalledWith('o Cube\nv 0 0 0\n');
    expect(result).toBe(object);
  });

  it('reads fbx files through native bytes and parses them directly', async () => {
    const object = new THREE.Group();
    readExplorerFileBase64Mock.mockResolvedValue('data:application/octet-stream;base64,AQID');
    fbxLoaderState.parse.mockImplementation((data, resourcePath) => {
      expect(data).toBeInstanceOf(ArrayBuffer);
      expect(resourcePath).toBe('');
      return object;
    });

    const result = await loadModelPreviewObject('fbx', '/models/cube.fbx');

    expect(readExplorerFileBase64Mock).toHaveBeenCalledWith('/models/cube.fbx');
    expect(fbxLoaderState.parse).toHaveBeenCalledTimes(1);
    expect(result).toBe(object);
  });

  it('reads stl files through native bytes and returns a mesh', async () => {
    const geometry = new THREE.BufferGeometry();
    readExplorerFileBase64Mock.mockResolvedValue('data:model/stl;base64,AQID');
    stlLoaderState.parse.mockImplementation((data) => {
      expect(data).toBeInstanceOf(ArrayBuffer);
      return geometry;
    });

    const result = await loadModelPreviewObject('stl', '/models/cube.stl');

    expect(readExplorerFileBase64Mock).toHaveBeenCalledWith('/models/cube.stl');
    expect(stlLoaderState.parse).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(THREE.Mesh);
    expect((result as THREE.Mesh).geometry).toBe(geometry);
  });
});
