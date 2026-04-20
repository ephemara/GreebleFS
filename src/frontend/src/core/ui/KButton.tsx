import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KButtonProps {
    children?: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    icon?: LucideIcon;
    disabled?: boolean;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
}

const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500',
    secondary: 'bg-[#111] hover:bg-[#222] text-gray-300 border-[#333] hover:border-gray-500',
    danger: 'bg-red-600 hover:bg-red-500 text-white border-red-500',
    success: 'bg-green-600 hover:bg-green-500 text-white border-green-500',
    ghost: 'bg-transparent hover:bg-[#111] text-gray-400 hover:text-white border-transparent'
};

const sizeStyles = {
    sm: 'px-2 py-1 text-[9px]',
    md: 'px-3 py-1.5 text-[10px]',
    lg: 'px-4 py-2 text-xs'
};

export default function KButton({
    children,
    onClick,
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    disabled = false,
    className = '',
    type = 'button'
}: KButtonProps) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`
                flex items-center justify-center gap-2 rounded border font-bold transition-all
                ${variantStyles[variant]}
                ${sizeStyles[size]}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${className}
            `}
        >
            {Icon && <Icon size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} />}
            {children}
        </button>
    );
}