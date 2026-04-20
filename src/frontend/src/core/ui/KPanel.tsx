
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, PanelLeftOpen } from 'lucide-react';

interface KPanelProps {
    children?: React.ReactNode;
    position?: 'left' | 'right';
    width?: string;
    className?: string;
    collapsible?: boolean;
    isCollapsed?: boolean;
    onCollapseChange?: (collapsed: boolean) => void;
    collapsedContent?: React.ReactNode;
}

export default function KPanel({
    children,
    position = 'left',
    width = 'w-80',
    className = '',
    collapsible = false,
    isCollapsed: controlledCollapsed,
    onCollapseChange,
    collapsedContent
}: KPanelProps) {
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    
    const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
    
    const handleToggle = () => {
        const newState = !isCollapsed;
        setInternalCollapsed(newState);
        if (onCollapseChange) onCollapseChange(newState);
    };

    const positionClasses = position === 'left' ? 'border-r' : 'border-l';
    const widthClass = isCollapsed ? 'w-14' : width; // Slim width for icon bar
    
    return (
        <div className={`
            ${widthClass} bg-[#0a0a0a] ${positionClasses} border-[#222] 
            flex flex-col h-full z-20 shadow-2xl relative
            transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] shrink-0
            ${className}
        `}>
            {collapsible && (
                <button
                    onClick={handleToggle}
                    className={`
                        absolute top-3 ${position === 'left' ? '-right-3' : '-left-3'} z-50
                        bg-[#1a1a1a] border border-[#333] rounded-full p-1 
                        text-gray-400 hover:text-white hover:border-gray-500 hover:bg-[#222]
                        shadow-lg transition-all flex items-center justify-center w-6 h-6
                    `}
                    title={isCollapsed ? "Expand" : "Collapse"}
                >
                    {isCollapsed 
                        ? (position === 'left' ? <PanelLeftOpen size={12}/> : <PanelLeftOpen size={12} className="rotate-180"/>)
                        : (position === 'left' ? <ChevronLeft size={12}/> : <ChevronRight size={12}/>)
                    }
                </button>
            )}

            {/* EXPANDED CONTENT */}
            <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-opacity duration-200 ${isCollapsed ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100 delay-100'}`}>
                {children}
            </div>

            {/* COLLAPSED CONTENT (DOCK) */}
            {isCollapsed && (
                <div className="flex-1 flex flex-col items-center py-14 space-y-4 animate-in fade-in duration-500 overflow-hidden">
                    {collapsedContent}
                </div>
            )}
        </div>
    );
}
