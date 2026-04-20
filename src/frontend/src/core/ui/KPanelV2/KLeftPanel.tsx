
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, PanelLeftOpen } from 'lucide-react';
import { PanelAction, PANEL_STYLES } from './types';

// HOW IT WORKS:
// The KLeftPanel is a specialized sidebar designed for Toolbars (like in KGreeble).
// It handles switching between a "collapsed" icon-only state and an "expanded" detail state.
// 
// KEY FEATURES:
// 1. **Auto-Collapse**: Can be collapsed to a slim bar.
// 2. **Quick Actions**: Renders a vertical list of icons when collapsed.
// 3. **Click-to-Expand**: As per request, clicking an icon in the collapsed state can optionally expand the panel.

interface KLeftPanelProps {
    width?: string;
    isCollapsed?: boolean;
    onCollapseChange?: (collapsed: boolean) => void;
    actions: PanelAction[]; // Main toolbar actions
    bottomActions?: PanelAction[]; // Actions pinned to bottom (like Settings)
    currentActionId?: string; // For highlighting the active tool
    children?: React.ReactNode; // The expanded content (e.g. detailed buttons)
}

export default function KLeftPanel({
    width = "w-64",
    isCollapsed: controlledCollapsed,
    onCollapseChange,
    actions,
    bottomActions,
    currentActionId,
    children
}: KLeftPanelProps) {
    const [internalCollapsed, setInternalCollapsed] = useState(false);

    // Support controlled or uncontrolled collapse state
    const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

    const handleToggle = () => {
        const newState = !isCollapsed;
        setInternalCollapsed(newState);
        if (onCollapseChange) onCollapseChange(newState);
    };

    // Styling
    const widthClass = isCollapsed ? 'w-14' : width;

    return (
        <div className={`
            ${widthClass} ${PANEL_STYLES.glass} 
            border-r flex flex-col h-full z-20 relative
            transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] shrink-0
        `}>
            {/* COLLAPSE TOGGLE */}
            <button
                onClick={handleToggle}
                className={`
                    absolute top-3 -right-3 z-50
                    bg-[#1a1a1a] border border-[#333] rounded-full p-1 
                    text-gray-400 hover:text-white hover:border-gray-500 hover:bg-[#222]
                    shadow-lg transition-all flex items-center justify-center w-6 h-6
                `}
            >
                {isCollapsed ? <PanelLeftOpen size={12} /> : <ChevronLeft size={12} />}
            </button>

            {/* EXPANDED CONTENT AREA */}
            <div className={`
                flex-1 flex flex-col min-w-0 overflow-hidden transition-opacity duration-200 
                ${isCollapsed ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100 delay-100'}
            `}>
                {children}
            </div>

            {/* COLLAPSED ICON BAR (Docked State) */}
            {isCollapsed && (
                <div className="flex-1 flex flex-col items-center py-14 space-y-4 animate-in fade-in duration-500 w-full">
                    {/* Main Actions */}
                    {actions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => {
                                action.onClick();
                                // OPTIONAL: Auto-expand on click if desired?
                                // handleToggle(); 
                            }}
                            className={`
                                p-2 rounded-lg transition-all relative group
                                ${action.id === currentActionId ? (action.color || 'bg-emerald-900/50 text-emerald-400') : 'text-gray-500 hover:text-white'}
                            `}
                            title={action.label}
                        >
                            <action.icon size={20} />
                            {/* Tooltip on Hover */}
                            <span className="absolute left-full ml-2 px-2 py-1 bg-black/90 border border-[#333] rounded text-[10px] text-white opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                {action.label}
                            </span>
                        </button>
                    ))}

                    <div className="flex-1" /> {/* Spacer */}

                    {/* Bottom Actions */}
                    {bottomActions?.map((action) => (
                        <button
                            key={action.id}
                            onClick={action.onClick}
                            className="text-gray-600 hover:text-white transition-colors p-2"
                            title={action.label}
                        >
                            <action.icon size={18} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
