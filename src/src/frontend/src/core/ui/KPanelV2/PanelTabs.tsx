
import React from 'react';
import { PanelTab, PANEL_STYLES } from './types';

// HOW IT WORKS:
// The PanelTabs component renders a horizontal list of tabs.
// It automatically handles the active state styling and interactions.
// Usage: <PanelTabs tabs={myTabs} activeTabId={currentTab} onTabChange={setTab} />

interface PanelTabsProps {
    tabs: PanelTab[];
    activeTabId: string;
    onTabChange: (id: string) => void;
}

export const PanelTabs: React.FC<PanelTabsProps> = ({ tabs, activeTabId, onTabChange }) => {
    return (
        <div className="flex border-b border-[#222] bg-[#0f0f0f] shrink-0">
            {tabs.map((tab) => {
                const isActive = activeTabId === tab.id;
                // Dynamic styling based on verification
                const activeClass = isActive ? PANEL_STYLES.activeTab : PANEL_STYLES.inactiveTab;

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex-1 py-3 text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${activeClass}`}
                    >
                        <tab.icon size={14} />
                        {tab.label.toUpperCase()}
                    </button>
                );
            })}
        </div>
    );
};
