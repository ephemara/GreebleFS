import React from 'react';

interface KInputProps {
    label?: string;
    value: string | number;
    onChange: (value: string | number) => void;
    type?: 'text' | 'number' | 'email' | 'password';
    placeholder?: string;
    className?: string;
    inputClassName?: string;
}

export default function KInput({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    className = '',
    inputClassName = ''
}: KInputProps) {
    return (
        <div className={`space-y-1 ${className}`}>
            {label && (
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {label}
                </label>
            )}
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                placeholder={placeholder}
                className={`
                    w-full bg-[#0a0a0a] border border-[#333] rounded px-3 py-2
                    text-[11px] text-gray-300 outline-none
                    focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50
                    transition-colors
                    ${inputClassName}
                `}
            />
        </div>
    );
}

