interface BufferedSliderProps {
    label?: string;
    icon?: any;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    color?: string;
    accent?: string;
    className?: string;
}
export declare const BufferedSlider: ({ label, icon: Icon, value, onChange, min, max, step, color, accent, className }: BufferedSliderProps) => import("react/jsx-runtime").JSX.Element;
export {};
