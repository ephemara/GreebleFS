import React from 'react';
import { Check, X } from 'lucide-react';

interface KCheckboxProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    className?: string;
    variant?: 'default' | 'toggle';
}

export default function KCheckbox({
    label,
    checked,
    onChange,
    className = '',
    variant = 'default'
}: KCheckboxProps) {
    if (variant === 'toggle') {
        return (
            <button
                onClick={() => onChange(!checked)}
                className={`flex items-center justify-between w-full py-2 px-3 rounded text-[9px] font-bold border flex items-center transition-all ${
                    checked
                        ? 'bg-blue-900/20 border-blue-500 text-blue-400'
                        : 'bg-[#1a1a1a] border-[#333] text-gray-500'
                } ${className}`}
            >
                <span>{label}</span>
                {checked ? <Check size={12} /> : <X size={12} />}
            </button>
        );
    }

    return (
        <label className={`flex items-center gap-2 cursor-pointer ${className}`}>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-blue-500 focus:ring-blue-500 focus:ring-1"
            />
            <span className="text-[10px] text-gray-300">{label}</span>
        </label>
    );
}

