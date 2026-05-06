import React, { useState, useEffect } from 'react';

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

export const BufferedSlider = ({ label, icon: Icon, value, onChange, min, max, step, color = "text-gray-400", accent = "accent-white", className = "" }: BufferedSliderProps) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        setLocalValue(newValue);
        onChange(newValue);
    };

    return (
        <div className={`space-y-1 ${className}`}>
            <div className="flex justify-between text-[9px] font-bold">
                {label && (
                    <div className={`flex items-center gap-1.5 ${color}`}>
                        {Icon && <Icon size={10} />}
                        {label}
                    </div>
                )}
                <span className={color}>{typeof localValue === 'number' ? localValue.toFixed(2) : localValue}</span>
            </div>
            <input 
                type="range" 
                min={min} max={max} step={step} 
                value={localValue} 
                onChange={handleChange} 
                className={`w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none ${accent}`} 
            />
        </div>
    );
};
