import React from 'react';

export interface KModule {
  id: string;
  name: string;
  cat?: string;
  description: string;
  icon: React.ComponentType<any>;
  component: React.ComponentType<any>;
  status?: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
}

export enum EntityType {
  CUBE = 'CUBE',
  PLANE = 'PLANE',
  LIGHT_POINT = 'LIGHT_POINT',
  SPHERE = 'SPHERE'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface SceneEntity {
  id: string;
  name: string;
  type: EntityType;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  color: string;
  visible: boolean;
  roughness?: number;
  metalness?: number;
  intensity?: number;
}

export interface SceneData {
  backgroundColor: string;
  ambientLightIntensity: number;
  entities: SceneEntity[];
}

// Extend window for the KChronos script loading
declare global {
  interface Window {
    THREE: any;
    JSZip: any;
  }
}