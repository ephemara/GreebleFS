
import {
    Box, Droplet, Mountain, Sun, Zap, Anchor, Layers, Circle, Hexagon, Shield, Disc, Sparkles,
    Feather, Leaf, Fingerprint, Footprints, Snowflake, CloudRain, Scissors, Shirt,
    Gem, Hammer, Construction, FileText, Scroll, Package, Skull, Flame, Grid
} from 'lucide-react';

export const MATERIAL_CATEGORIES = {
    ORGANIC: {
        id: 'organic',
        label: 'Organic',
        icon: Leaf,
        presets: [
            {
                id: 'skin_basic', label: 'Basic Skin', icon: Fingerprint,
                params: { normalStrength: 0.02, roughnessContrast: 1.2, roughnessBrightness: 20, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 0.8, bioDetail: 0.1, gamma: 1.0, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.0 }
            },
            {
                id: 'leather_worn', label: 'Worn Leather', icon: Feather,
                params: { normalStrength: 0.05, roughnessContrast: 1.5, roughnessBrightness: -10, roughnessInvert: true, metalContrast: 0.2, metalBias: -80, aoIntensity: 1.2, wear: 0.3, scratches: 0.2, gamma: 1.0, vignette: 0.2, edgeWear: 0.1, cavityDirt: 0.2 }
            },
            {
                id: 'alien_bio', label: 'Alien Flesh', icon: Disc,
                params: { normalStrength: 0.12, roughnessContrast: 1.0, roughnessBrightness: -20, roughnessInvert: true, metalContrast: 1.5, metalBias: 20, aoIntensity: 1.2, wear: 0.1, bioDetail: 0.6, bioFreq: 0.3, gamma: 1.1, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.3 }
            },
            {
                id: 'bark', label: 'Tree Bark', icon: Mountain,
                params: { normalStrength: 0.15, roughnessContrast: 2.0, roughnessBrightness: 40, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 1.5, dust: 0.2, grunge: 0.3, gamma: 0.9, vignette: 0.1, edgeWear: 0.0, cavityDirt: 0.4 }
            },
            {
                id: 'zombie', label: 'Zombie Skin', icon: Skull,
                params: { normalStrength: 0.08, roughnessContrast: 1.5, roughnessBrightness: 10, roughnessInvert: true, metalContrast: 0.1, metalBias: -90, aoIntensity: 1.3, bioDetail: 0.4, gamma: 1.2, vignette: 0.3, edgeWear: 0.0, cavityDirt: 0.5 }
            },
            {
                id: 'dragon_scale', label: 'Dragon Scale', icon: Shield,
                params: { normalStrength: 0.2, roughnessContrast: 1.8, roughnessBrightness: -20, roughnessInvert: true, metalContrast: 0.5, metalBias: -50, aoIntensity: 1.6, bioDetail: 0.2, gamma: 1.0, vignette: 0.0, edgeWear: 0.3, cavityDirt: 0.2 }
            }
        ]
    },
    RUBBER: {
        id: 'rubber',
        label: 'Rubber / Synth',
        icon: Circle,
        presets: [
            {
                id: 'rubber_matte', label: 'Matte Rubber', icon: Circle,
                params: { normalStrength: 0.005, roughnessContrast: 0.5, roughnessBrightness: 20, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 0.5, wear: 0.05, dust: 0.2, gamma: 1.0, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.0 }
            },
            {
                id: 'latex_shiny', label: 'Shiny Latex', icon: Droplet,
                params: { normalStrength: 0.01, roughnessContrast: 0.2, roughnessBrightness: -60, roughnessInvert: true, metalContrast: 0.5, metalBias: -40, aoIntensity: 0.4, wear: 0.0, gamma: 1.0, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.0 }
            },
            {
                id: 'tire_worn', label: 'Worn Tire', icon: Disc,
                params: { normalStrength: 0.08, roughnessContrast: 1.5, roughnessBrightness: 10, roughnessInvert: true, metalContrast: 0.2, metalBias: -90, aoIntensity: 1.2, wear: 0.4, scratches: 0.3, dust: 0.4, gamma: 0.9, vignette: 0.2, edgeWear: 0.1, cavityDirt: 0.2 }
            },
            {
                id: 'plastic_rough', label: 'Rough Plastic', icon: Box,
                params: { normalStrength: 0.03, roughnessContrast: 1.0, roughnessBrightness: 0, roughnessInvert: true, metalContrast: 0.1, metalBias: -80, aoIntensity: 0.8, wear: 0.1, gamma: 1.0, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.1 }
            },
            {
                id: 'gasket', label: 'Gasket', icon: Circle,
                params: { normalStrength: 0.02, roughnessContrast: 0.8, roughnessBrightness: 10, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 0.6, wear: 0.1, gamma: 1.0, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.1 }
            }
        ]
    },
    GROUND: {
        id: 'ground',
        label: 'Ground / Rock',
        icon: Mountain,
        presets: [
            {
                id: 'ground_wet', label: 'Wet Mud', icon: CloudRain,
                params: { normalStrength: 0.08, roughnessContrast: 2.5, roughnessBrightness: -30, roughnessInvert: true, metalContrast: 0.8, metalBias: -60, aoIntensity: 1.5, wear: 0.2, bioDetail: 0.1, bioFreq: 0.5, dust: 0.1, gamma: 0.9, vignette: 0.1, edgeWear: 0.0, cavityDirt: 0.3 }
            },
            {
                id: 'rock_rough', label: 'Rough Rock', icon: Mountain,
                params: { normalStrength: 0.15, roughnessContrast: 1.8, roughnessBrightness: 60, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 1.8, wear: 0.4, dust: 0.3, gamma: 1.0, vignette: 0.0, edgeWear: 0.2, cavityDirt: 0.4 }
            },
            {
                id: 'concrete', label: 'Concrete', icon: Box,
                params: { normalStrength: 0.05, roughnessContrast: 1.2, roughnessBrightness: 30, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 1.0, dust: 0.1, grunge: 0.1, gamma: 1.0, vignette: 0.1, edgeWear: 0.1, cavityDirt: 0.1 }
            },
            {
                id: 'snow', label: 'Snow', icon: Snowflake,
                params: { normalStrength: 0.04, roughnessContrast: 0.8, roughnessBrightness: 10, roughnessInvert: true, metalContrast: 0.5, metalBias: -50, aoIntensity: 0.5, sparkle: 0.5, gamma: 1.1, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.0 }
            },
            {
                id: 'asphalt', label: 'Asphalt', icon: Grid,
                params: { normalStrength: 0.1, roughnessContrast: 1.5, roughnessBrightness: 20, roughnessInvert: true, metalContrast: 0.1, metalBias: -90, aoIntensity: 1.2, noise: 0.2, grunge: 0.2, gamma: 0.9, vignette: 0.2, edgeWear: 0.1, cavityDirt: 0.2 }
            }
        ]
    },
    FABRIC: {
        id: 'fabric',
        label: 'Fabric',
        icon: Shirt,
        presets: [
            {
                id: 'denim', label: 'Denim', icon: Scissors,
                params: { normalStrength: 0.06, roughnessContrast: 1.5, roughnessBrightness: 40, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 1.2, wear: 0.2, gamma: 1.0, vignette: 0.1, edgeWear: 0.1, cavityDirt: 0.0 }
            },
            {
                id: 'silk', label: 'Silk', icon: Sparkles,
                params: { normalStrength: 0.02, roughnessContrast: 0.5, roughnessBrightness: -20, roughnessInvert: true, metalContrast: 1.0, metalBias: -20, aoIntensity: 0.6, wear: 0.0, gamma: 1.0, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.0 }
            },
            {
                id: 'wool', label: 'Wool', icon: CloudRain,
                params: { normalStrength: 0.1, roughnessContrast: 2.0, roughnessBrightness: 50, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 1.5, wear: 0.1, gamma: 1.0, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.1 }
            },
            {
                id: 'canvas', label: 'Canvas', icon: Layers,
                params: { normalStrength: 0.08, roughnessContrast: 1.2, roughnessBrightness: 30, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 1.0, wear: 0.2, grunge: 0.1, gamma: 1.0, vignette: 0.1, edgeWear: 0.0, cavityDirt: 0.1 }
            },
            {
                id: 'velvet', label: 'Velvet', icon: Shirt,
                params: { normalStrength: 0.05, roughnessContrast: 1.0, roughnessBrightness: 10, roughnessInvert: true, metalContrast: 0.5, metalBias: -60, aoIntensity: 0.8, gamma: 1.1, vignette: 0.2, edgeWear: 0.0, cavityDirt: 0.0 }
            }
        ]
    },
    METAL: {
        id: 'metal',
        label: 'Metal',
        icon: Anchor,
        presets: [
            {
                id: 'iron_rusty', label: 'Rusted Iron', icon: Anchor,
                params: { normalStrength: 0.1, roughnessContrast: 2.0, roughnessBrightness: 40, roughnessInvert: true, metalContrast: 1.0, metalBias: 0, aoIntensity: 1.6, wear: 0.6, scratches: 0.4, gamma: 0.9, vignette: 0.2, edgeWear: 0.0, cavityDirt: 0.3 }
            },
            {
                id: 'gold_dirty', label: 'Aged Gold', icon: Sun,
                params: { normalStrength: 0.02, roughnessContrast: 1.5, roughnessBrightness: 20, roughnessInvert: true, metalContrast: 0.5, metalBias: 90, aoIntensity: 1.0, wear: 0.3, scratches: 0.1, gamma: 1.0, vignette: 0.1, edgeWear: 0.1, cavityDirt: 0.2 }
            },
            {
                id: 'aluminum_brushed', label: 'Brushed Alum', icon: Shield,
                params: { normalStrength: 0.05, roughnessContrast: 1.0, roughnessBrightness: -10, roughnessInvert: true, metalContrast: 1.0, metalBias: 80, aoIntensity: 0.8, scratches: 0.5, wear: 0.1, gamma: 1.0, vignette: 0.0, edgeWear: 0.2, cavityDirt: 0.1 }
            },
            {
                id: 'scifi_panel', label: 'Sci-Fi Panel', icon: Zap,
                params: { normalStrength: 0.05, roughnessContrast: 1.2, roughnessBrightness: -10, roughnessInvert: true, metalContrast: 2.0, metalBias: 40, aoIntensity: 1.2, wear: 0.3, cyberDetail: 0.35, cyberScale: 0.15, scratches: 0.2, gamma: 1.0, vignette: 0.1, edgeWear: 0.3, cavityDirt: 0.2 }
            },
            {
                id: 'copper', label: 'Copper', icon: Disc,
                params: { normalStrength: 0.03, roughnessContrast: 1.2, roughnessBrightness: 10, roughnessInvert: true, metalContrast: 0.8, metalBias: 60, aoIntensity: 0.9, gamma: 1.0, vignette: 0.1, edgeWear: 0.1, cavityDirt: 0.2 }
            }
        ]
    },
    PLASTIC: {
        id: 'plastic',
        label: 'Plastic',
        icon: Box,
        presets: [
            {
                id: 'plastic_glossy', label: 'Glossy Plastic', icon: Sparkles,
                params: { normalStrength: 0.01, roughnessContrast: 0.3, roughnessBrightness: -50, roughnessInvert: true, metalContrast: 0.2, metalBias: -80, aoIntensity: 0.5, wear: 0.05, gamma: 1.0, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.0 }
            },
            {
                id: 'plastic_matte', label: 'Matte Plastic', icon: Box,
                params: { normalStrength: 0.02, roughnessContrast: 0.8, roughnessBrightness: 10, roughnessInvert: true, metalContrast: 0.1, metalBias: -90, aoIntensity: 0.7, wear: 0.1, gamma: 1.0, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.1 }
            },
            {
                id: 'bakelite', label: 'Bakelite', icon: Hexagon,
                params: { normalStrength: 0.01, roughnessContrast: 0.4, roughnessBrightness: -30, roughnessInvert: true, metalContrast: 0.3, metalBias: -70, aoIntensity: 0.6, wear: 0.2, scratches: 0.1, gamma: 0.9, vignette: 0.1, edgeWear: 0.1, cavityDirt: 0.1 }
            },
            {
                id: 'pvc', label: 'PVC Pipe', icon: Circle,
                params: { normalStrength: 0.02, roughnessContrast: 0.6, roughnessBrightness: 0, roughnessInvert: true, metalContrast: 0.1, metalBias: -80, aoIntensity: 0.6, gamma: 1.0, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.1 }
            }
        ]
    },
    PAPER: {
        id: 'paper',
        label: 'Paper / Card',
        icon: FileText,
        presets: [
            {
                id: 'cardboard', label: 'Cardboard', icon: Package,
                params: { normalStrength: 0.06, roughnessContrast: 1.5, roughnessBrightness: 40, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 1.0, wear: 0.3, grunge: 0.1, gamma: 1.0, vignette: 0.1, edgeWear: 0.0, cavityDirt: 0.1 }
            },
            {
                id: 'paper_clean', label: 'Clean Paper', icon: FileText,
                params: { normalStrength: 0.02, roughnessContrast: 0.8, roughnessBrightness: 20, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 0.5, wear: 0.0, gamma: 1.0, vignette: 0.0, edgeWear: 0.0, cavityDirt: 0.0 }
            },
            {
                id: 'parchment', label: 'Old Parchment', icon: Scroll,
                params: { normalStrength: 0.05, roughnessContrast: 1.8, roughnessBrightness: 30, roughnessInvert: true, metalContrast: 0, metalBias: -100, aoIntensity: 1.2, wear: 0.5, grunge: 0.4, dust: 0.2, gamma: 0.9, vignette: 0.3, edgeWear: 0.0, cavityDirt: 0.2 }
            }
        ]
    }
};
