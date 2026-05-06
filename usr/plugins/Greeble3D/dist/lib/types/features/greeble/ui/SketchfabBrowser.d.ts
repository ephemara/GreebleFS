interface SketchfabBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (url: string, name: string) => void;
}
export declare function SketchfabBrowser({ isOpen, onClose, onImport }: SketchfabBrowserProps): import("react/jsx-runtime").JSX.Element | null;
export {};
