import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KSectionProps {
    title: string;
    icon?: LucideIcon;
    children?: React.ReactNode;
    className?: string;
    headerClassName?: string;
}

export default function KSection({
    title,
    icon: Icon,
    children,
    className = '',
    headerClassName = ''
}: KSectionProps) {
    return (
        <div className={`space-y-3 ${className}`}>
            <div className={`text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 ${headerClassName}`}>
                {Icon && <Icon size={12} />}
                {title}
            </div>
            {children}
        </div>
    );
}