export interface Greeble3DAppProps {
    title?: string;
    homeHref?: string | null;
    showExit?: boolean;
    onExit?: () => void;
}
export declare function Greeble3DApp({ title, homeHref, showExit, onExit, }: Greeble3DAppProps): import("react/jsx-runtime").JSX.Element;
