
import React, { useState } from 'react';
import { ChevronRight, PanelLeftOpen } from 'lucide-react';
import { PanelTab, PANEL_STYLES } from './types';
import { PanelTabs } from './PanelTabs';

// HOW IT WORKS:
// The KRightPanel is designed for "Inspector" or "Properties" style views.
// It integrates the Tab system directly.
//
// KEY FEATURES:
// 1. **Integrated Tabs**: Tabs are handled internally (or controlled via props).
// 2. **Click-to-Expand**: Clicking a tab icon in the collapsed state AUTOMATICALLY expands the panel.
// 3. **Content Switching**: Renders the `view` property of the active tab.

interface KRightPanelProps {
    width?: string;
    isCollapsed?: boolean;
    onCollapseChange?: (collapsed: boolean) => void;
    tabs: PanelTab[];
    activeTabId?: string; // Controlled tab state
    onTabChange?: (tabId: string) => void;
}

export default function KRightPanel({
    width = "w-80",
    isCollapsed: controlledCollapsed,
    onCollapseChange,
    tabs,
    activeTabId: controlledTabId,
    onTabChange
}: KRightPanelProps) {
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const [internalTabId, setInternalTabId] = useState(tabs[0]?.id);

    const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
    const activeTabId = controlledTabId !== undefined ? controlledTabId : internalTabId;

    const handleToggle = (forceState?: boolean) => {
        const newState = forceState !== undefined ? forceState : !isCollapsed;
        setInternalCollapsed(newState);
        if (onCollapseChange) onCollapseChange(newState);
    };

    const handleTabClick = (id: string) => {
        setInternalTabId(id);
        if (onTabChange) onTabChange(id);

        // FEATURE: If collapsed, clicking a tab expands the panel!
        if (isCollapsed) {
            handleToggle(false); // Expand
        }
    };

    // Find active view
    const activeTab = tabs.find(t => t.id === activeTabId);

    // Styling
    const widthClass = isCollapsed ? 'w-14' : width;

    return (
        <div className={`
            ${widthClass} ${PANEL_STYLES.glass} 
            border-l flex flex-col h-full z-20 relative
            transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] shrink-0
        `}>
            {/* COLLAPSE TOGGLE */}
            <button
                onClick={() => handleToggle()}
                className={`
                    absolute top-3 -left-3 z-50
                    bg-[#1a1a1a] border border-[#333] rounded-full p-1 
                    text-gray-400 hover:text-white hover:border-gray-500 hover:bg-[#222]
                    shadow-lg transition-all flex items-center justify-center w-6 h-6
                `}
            >
                {isCollapsed ? <PanelLeftOpen size={12} className="rotate-180" /> : <ChevronRight size={12} />}
            </button>

            {/* EXPANDED CONTENT */}
            <div className={`
                flex-1 flex flex-col min-w-0 overflow-hidden transition-opacity duration-200 
                ${isCollapsed ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100 delay-100'}
            `}>
                {/* 1. TABS */}
                <PanelTabs
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onTabChange={handleTabClick}
                />

                {/* 2. TAB CONTENT */}
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">
                    {activeTab?.view}
                </div>
            </div>

            {/* COLLAPSED ICON BAR */}
            {isCollapsed && (
                <div className="flex-1 flex flex-col items-center py-14 space-y-6 animate-in fade-in duration-500 w-full">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab.id)}
                            className={`
                                p-2 rounded-lg transition-all relative group
                                ${activeTabId === tab.id ? PANEL_STYLES.activeTab : 'text-gray-500 hover:text-white'}
                            `}
                            title={tab.label}
                        >
                            <tab.icon size={20} />
                            {/* Tooltip */}
                            <span className="absolute right-full mr-2 px-2 py-1 bg-black/90 border border-[#333] rounded text-[10px] text-white opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                {tab.label}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
