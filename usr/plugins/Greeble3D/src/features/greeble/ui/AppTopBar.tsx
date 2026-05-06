import React from 'react';
import * as ToolbarPrimitive from '@radix-ui/react-toolbar';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
// import { useTheme } from '@/systems/ui';

// --- ROOT ---

interface AppTopBarProps extends React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root> {
    children: React.ReactNode;
}

export const AppTopBar = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.Root>,
    AppTopBarProps
>(({ className, children, ...props }, ref) => {
    return (
        <ToolbarPrimitive.Root
            ref={ref}
            className={cn(
                'flex h-12 w-full items-center justify-between gap-4 px-4 transition-all relative z-50',
                'bg-[#111]/90 backdrop-blur-md',
                'border-b border-[#222]',
                className
            )}
            {...props}
        >
            {children}
        </ToolbarPrimitive.Root>
    );
});
AppTopBar.displayName = 'AppTopBar';

// --- GROUPS ---

export const AppTopBarGroup = ({
    className,
    children,
    align = 'start'
}: {
    className?: string;
    children: React.ReactNode;
    align?: 'start' | 'center' | 'end';
}) => {
    const alignmentClasses = {
        start: 'justify-start',
        center: 'justify-center absolute left-1/2 -translate-x-1/2',
        end: 'justify-end ml-auto'
    };

    return (
        <div className={cn('flex items-center gap-2', alignmentClasses[align], className)}>
            {children}
        </div>
    );
};

// --- SEPARATOR ---

export const AppTopBarSeparator = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Separator>
>(({ className, ...props }, ref) => (
    <ToolbarPrimitive.Separator
        ref={ref}
        className={cn('mx-1 h-5 w-px bg-[#222]', className)}
        {...props}
    />
));
AppTopBarSeparator.displayName = 'AppTopBarSeparator';

// --- BUTTON ---

export type AppTopBarButtonProps = React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button> & {
    active?: boolean;
    tooltip?: React.ReactNode;
    shortcut?: React.ReactNode;
    icon?: React.ReactNode;
    label?: string;
    variant?: 'ghost' | 'solid' | 'outline';
};

export const AppTopBarButton = React.forwardRef<React.ElementRef<typeof ToolbarPrimitive.Button>, AppTopBarButtonProps>(
    ({ className, active, tooltip, shortcut, icon, label, variant = 'ghost', children, ...props }, ref) => {

        const baseStyles = 'inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-[10px] font-bold tracking-wide outline-none transition-all duration-200 select-none';

        const variantStyles = {
            ghost: cn(
                'text-gray-400 hover:bg-[#222] hover:text-white',
                active && 'text-emerald-500 bg-emerald-900/20'
            ),
            solid: cn(
                'bg-[#222] text-white hover:bg-[#333]',
                active && 'bg-emerald-600 text-white hover:bg-emerald-500'
            ),
            outline: cn(
                'border border-[#333] text-gray-400 hover:border-gray-500 hover:text-white',
                active && 'border-emerald-500 text-emerald-500'
            )
        };

        const comp = (
            <ToolbarPrimitive.Button
                ref={ref}
                className={cn(baseStyles, variantStyles[variant], className)}
                {...props}
            >
                <div className="flex items-center gap-2">
                    {icon && <span className={cn(active ? 'text-inherit' : 'text-current')}>{icon}</span>}
                    {label && <span>{label}</span>}
                    {children}
                </div>
            </ToolbarPrimitive.Button>
        );

        if (!tooltip) return comp;

        return (
            <TooltipPrimitive.Provider delayDuration={400}>
                <TooltipPrimitive.Root>
                    <TooltipPrimitive.Trigger asChild>{comp}</TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                        <TooltipPrimitive.Content
                            sideOffset={5}
                            className="z-[200] animate-in fade-in zoom-in-95 overflow-hidden rounded-md border border-[#333] bg-[#111] px-3 py-1.5 shadow-xl select-none"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-white">{tooltip}</span>
                                {shortcut && <span className="text-[9px] font-mono text-gray-500 bg-[#222] px-1 rounded">{shortcut}</span>}
                            </div>
                        </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
            </TooltipPrimitive.Provider>
        );
    }
);
AppTopBarButton.displayName = 'AppTopBarButton';

// --- TOGGLE GROUP ---

export const AppTopBarToggleGroup = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.ToggleGroup>,
    React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleGroup>
>(({ className, ...props }, ref) => (
    <ToolbarPrimitive.ToggleGroup
        ref={ref}
        className={cn(
            'flex items-center gap-1 p-0.5 rounded-lg border border-[#333] bg-[#1a1a1a]',
            className
        )}
        {...props}
    />
));
AppTopBarToggleGroup.displayName = 'AppTopBarToggleGroup';

export type AppTopBarToggleItemProps = React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleItem> & {
    tooltip?: React.ReactNode;
    icon?: React.ReactNode;
    label?: string;
};

export const AppTopBarToggleItem = React.forwardRef<
    React.ElementRef<typeof ToolbarPrimitive.ToggleItem>,
    AppTopBarToggleItemProps
>(({ className, children, tooltip, icon, label, ...props }, ref) => {
    const comp = (
        <ToolbarPrimitive.ToggleItem
            ref={ref}
            className={cn(
                'inline-flex h-7 items-center justify-center rounded px-2 text-[9px] font-bold transition-all select-none',
                'text-gray-500 hover:text-white hover:bg-[#333]',
                'data-[state=on]:bg-emerald-900/20 data-[state=on]:text-emerald-500',
                'focus-visible:z-10 focus-visible:outline-none',
                className
            )}
            {...props}
        >
            <div className="flex items-center gap-1.5">
                {icon}
                {label && <span>{label}</span>}
                {children}
            </div>
        </ToolbarPrimitive.ToggleItem>
    );

    if (!tooltip) return comp;

    return (
        <TooltipPrimitive.Provider delayDuration={400}>
            <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>{comp}</TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        sideOffset={5}
                        className="z-[200] animate-in fade-in zoom-in-95 overflow-hidden rounded-md border border-[#333] bg-[#111] px-3 py-1.5 shadow-xl"
                    >
                        <span className="text-[10px] font-bold text-white">{tooltip}</span>
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    );
});
AppTopBarToggleItem.displayName = 'AppTopBarToggleItem';

// --- SLIDER ---

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

export const AppTopBarSlider = ({
    value,
    min,
    max,
    step = 1,
    onChange,
    label,
    width = "w-24",
    showValue = true,
    formatValue = (v) => v.toString()
}: AppTopBarSliderProps) => {
    return (
        <div className={cn("flex flex-col gap-0.5 group relative select-none", width)}>
            <div className="flex justify-between items-center text-[8px] font-bold text-gray-500 group-hover:text-emerald-500 transition-colors uppercase px-0.5">
                {label && <span>{label}</span>}
                {showValue && <span className="font-mono">{formatValue(value)}</span>}
            </div>
            <div className="relative h-1.5 w-full flex items-center">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-full h-1 bg-[#333] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-600 transition-all duration-75"
                        style={{ width: `${((value - min) / (max - min)) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
};
