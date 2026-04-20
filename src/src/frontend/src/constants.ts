import { EntityType, SceneData } from './types';

export const INITIAL_SCENE: SceneData = {
  backgroundColor: '#121212',
  ambientLightIntensity: 0.5,
  entities: [
    {
      id: 'ground-1',
      name: 'Ground Plane',
      type: EntityType.PLANE,
      position: { x: 0, y: -2, z: 0 },
      rotation: { x: -Math.PI / 2, y: 0, z: 0 },
      scale: { x: 20, y: 20, z: 1 },
      color: '#2a2a2a',
      visible: true,
      roughness: 0.8,
      metalness: 0.1
    },
    {
      id: 'cube-1',
      name: 'Default Cube',
      type: EntityType.CUBE,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: '#6366f1',
      visible: true,
      roughness: 0.5,
      metalness: 0.5
    },
    {
      id: 'light-1',
      name: 'Main Light',
      type: EntityType.LIGHT_POINT,
      position: { x: 5, y: 5, z: 5 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: '#ffffff',
      visible: true,
      intensity: 100
    }
  ]
};