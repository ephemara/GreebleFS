interface KGreebleGeneratorProps {
    activeShape: string;
    setActiveShape: (shape: string) => void;
    greebleParams: {
        seed: number;
        density: number;
        clustering: number;
        scale_min: number;
        scale_max: number;
        height_min: number;
        height_max: number;
        primitiveType: string;
        pattern: string;
        noise_frequency: number;
        noise_octaves: number;
        useImports?: boolean;
        useShaders?: boolean;
        distortion?: number;
        infiniteShapes?: boolean;
        shapeSegments?: number;
    };
    setGreebleParams: (params: any) => void;
}
export default function KGreebleGenerator({ activeShape, setActiveShape, greebleParams, setGreebleParams }: KGreebleGeneratorProps): import("react/jsx-runtime").JSX.Element;
export {};
