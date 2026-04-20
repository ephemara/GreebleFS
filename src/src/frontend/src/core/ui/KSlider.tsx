import React from 'react';

interface KSliderProps {
    label?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    showValue?: boolean;
    valueFormat?: (val: number) => string;
    className?: string;
    accentColor?: string;
}

export default function KSlider({
    label,
    value,
    min,
    max,
    step = 0.1,
    onChange,
    showValue = true,
    valueFormat = (v) => v.toFixed(2),
    className = '',
    accentColor = 'blue'
}: KSliderProps) {
    const colorClasses: Record<string, string> = {
        blue: 'accent-blue-500',
        green: 'accent-green-500',
        purple: 'accent-purple-500',
        orange: 'accent-orange-500',
        red: 'accent-red-500',
        emerald: 'accent-emerald-500',
        cyan: 'accent-cyan-500'
    };

    return (
        <div className={`space-y-1 ${className}`}>
            {label && (
                <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                    <span>{label}</span>
                    {showValue && <span className={`text-${accentColor}-400`}>{valueFormat(value)}</span>}
                </div>
            )}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className={`w-full h-1 bg-[#222] rounded-lg appearance-none ${colorClasses[accentColor] || colorClasses.blue} cursor-pointer`}
            />
        </div>
    );
}

