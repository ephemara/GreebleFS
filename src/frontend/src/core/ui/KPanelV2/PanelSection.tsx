
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react';
import { PANEL_STYLES } from './types';

// HOW IT WORKS:
// The PanelSection component provides a collapsible container for grouping UI elements.
// It enforces the "Premium" look with consistent headers and spacing.
// Usage: <PanelSection title="My Settings" icon={Settings}> ...content... </PanelSection>

interface PanelSectionProps {
    title: string;
    icon?: LucideIcon;
    children: React.ReactNode;
    defaultOpen?: boolean;
    className?: string; // For additional custom spacing if needed
    color?: string; // Optional overlay color for the header icon/text
}

export const PanelSection: React.FC<PanelSectionProps> = ({
    title,
    icon: Icon,
    children,
    defaultOpen = true,
    className = "",
    color // e.g. "text-blue-400"
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`space-y-3 ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`${PANEL_STYLES.sectionHeader} w-full hover:text-gray-300 transition-colors cursor-pointer group`}
            >
                <div className={`flex items-center gap-2 flex-1 ${color || ''}`}>
                    {Icon && <Icon size={12} />}
                    {title}
                </div>
                {isOpen ? <ChevronDown size={12} className="opacity-50" /> : <ChevronRight size={12} className="opacity-50" />}
            </button>

            {isOpen && (
                <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};
