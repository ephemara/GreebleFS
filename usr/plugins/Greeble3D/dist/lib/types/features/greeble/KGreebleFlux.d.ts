interface KGreebleFluxProps {
    activeLayerId: string | null;
    layers: any[];
    updateLayer: (id: string, updates: any) => void;
}
export default function KGreebleFlux({ activeLayerId, layers, updateLayer }: KGreebleFluxProps): import("react/jsx-runtime").JSX.Element;
export {};
