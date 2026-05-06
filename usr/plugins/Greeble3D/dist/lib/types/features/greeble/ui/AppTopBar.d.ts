import React from 'react';
import * as ToolbarPrimitive from '@radix-ui/react-toolbar';
interface AppTopBarProps extends React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root> {
    children: React.ReactNode;
}
export declare const AppTopBar: React.ForwardRefExoticComponent<AppTopBarProps & React.RefAttributes<HTMLDivElement>>;
export declare const AppTopBarGroup: ({ className, children, align }: {
    className?: string;
    children: React.ReactNode;
    align?: "start" | "center" | "end";
}) => import("react/jsx-runtime").JSX.Element;
export declare const AppTopBarSeparator: React.ForwardRefExoticComponent<Omit<ToolbarPrimitive.ToolbarSeparatorProps & React.RefAttributes<HTMLDivElement>, "ref"> & React.RefAttributes<HTMLDivElement>>;
export type AppTopBarButtonProps = React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button> & {
    active?: boolean;
    tooltip?: React.ReactNode;
    shortcut?: React.ReactNode;
    icon?: React.ReactNode;
    label?: string;
    variant?: 'ghost' | 'solid' | 'outline';
};
export declare const AppTopBarButton: React.ForwardRefExoticComponent<Omit<ToolbarPrimitive.ToolbarButtonProps & React.RefAttributes<HTMLButtonElement>, "ref"> & {
    active?: boolean;
    tooltip?: React.ReactNode;
    shortcut?: React.ReactNode;
    icon?: React.ReactNode;
    label?: string;
    variant?: "ghost" | "solid" | "outline";
} & React.RefAttributes<HTMLButtonElement>>;
export declare const AppTopBarToggleGroup: React.ForwardRefExoticComponent<(Omit<ToolbarPrimitive.ToolbarToggleGroupSingleProps & React.RefAttributes<HTMLDivElement>, "ref"> | Omit<ToolbarPrimitive.ToolbarToggleGroupMultipleProps & React.RefAttributes<HTMLDivElement>, "ref">) & React.RefAttributes<HTMLDivElement>>;
export type AppTopBarToggleItemProps = React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleItem> & {
    tooltip?: React.ReactNode;
    icon?: React.ReactNode;
    label?: string;
};
export declare const AppTopBarToggleItem: React.ForwardRefExoticComponent<Omit<ToolbarPrimitive.ToolbarToggleItemProps & React.RefAttributes<HTMLButtonElement>, "ref"> & {
    tooltip?: React.ReactNode;
    icon?: React.ReactNode;
    label?: string;
} & React.RefAttributes<HTMLButtonElement>>;
interface AppTopBarSliderProps {
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (val: number) => void;
    label?: string;
    width?: string;
    showValue?: boolean;
    formatValue?: (v: number) => string;
}
export declare const AppTopBarSlider: ({ value, min, max, step, onChange, label, width, showValue, formatValue }: AppTopBarSliderProps) => import("react/jsx-runtime").JSX.Element;
export {};
