
import React, { createContext, useContext } from 'react';

// Defines the shape of the Painter's brain
interface PainterContextType {
    // State
    brush: any;
    setBrush: React.Dispatch<React.SetStateAction<any>>;
    activeChannels: any;
    setActiveChannels: React.Dispatch<React.SetStateAction<any>>;
    layers: any[];
    activeLayerId: string | null;

    // Actions
    handleLayerAdd: () => void;
    handleLayerDelete: (id: string) => void;
    handleLayerToggle: (id: string) => void;
    handleLayerSelect: (id: string) => void;
    handleLayerFill: () => void;

    // Material / Assets
    activeMaterial: any;
    setActiveMaterial: (mat: any) => void;
    projectMaterials: any[];
    textureSets: any[];
    activeSetId: string | null;
    handleSetSelect: (id: string) => void;

    // Core Actions
    handleExport: () => void;
    handleUndo: () => void;
    handleRedo: () => void;
    handleChangeMesh: () => void;
    paint: (uv: any, pressure?: number, event?: any) => void;
    recordHistory: () => void;

    // UI State
    status: string;
    viewChannel: string;
    setViewChannel: (ch: string) => void;

    // Alphas
    alphas: any[];
    alphaPrompt: string;
    setAlphaPrompt: (s: string) => void;
    isGeneratingAlpha: boolean;
    handleGenerateAlpha: () => void;
    handleImportAlpha: (e: any) => void;

    // Masking
    handleClearMask: () => void;

    // Kerr Black Hole Event
    blackHole: {
        active: boolean;
        strength: number;
        spin: number;
        radius: number; // 0-1
        decay: number;  // 0-1
        infinite: boolean; // Stability toggle
    };
    setBlackHole: React.Dispatch<React.SetStateAction<{
        active: boolean;
        strength: number;
        spin: number;
        radius: number;
        decay: number;
        infinite: boolean;
    }>>;

    // Brush Modifiers
    activeMods: Record<string, boolean>;
    setActiveMods: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

    // Modifier Parameters (Speed, Chaos, Intensity for sim effects)
    modParams: { speed: number; chaos: number; intensity: number };
    setModParams: React.Dispatch<React.SetStateAction<{ speed: number; chaos: number; intensity: number }>>;

    // Picker
    handlePickColor: (uv: any) => void;

    // Performance Mode
    performanceMode: boolean;
    setPerformanceMode: React.Dispatch<React.SetStateAction<boolean>>;

    // View Mode (3D / 2D)
    viewMode: '3D' | '2D';
    setViewMode: React.Dispatch<React.SetStateAction<'3D' | '2D'>>;

    // Symmetry
    symmetry: { x: boolean; y: boolean; z: boolean; radial: boolean; radialCount: number };
    setSymmetry: React.Dispatch<React.SetStateAction<{ x: boolean; y: boolean; z: boolean; radial: boolean; radialCount: number }>>;

    // Lighting
    lighting: { preset: string; intensity: number };
    setLighting: React.Dispatch<React.SetStateAction<{ preset: string; intensity: number }>>;

    // Texture Import/Export
    importedTextures: { id: string; name: string; url: string; texture: any }[];
    handleImportTexture: (e: any) => void;
    handleExportTextures: () => void;
}

export const PainterContext = createContext<PainterContextType | null>(null);

export const usePainter = () => {
    const context = useContext(PainterContext);
    if (!context) {
        throw new Error("usePainter must be used within a PainterProvider");
    }
    return context;
};
