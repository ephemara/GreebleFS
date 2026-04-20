import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Tab {
    id: string;
    label: string;
    icon?: LucideIcon;
}

interface KTabBarProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (id: string) => void;
    className?: string;
}

export default function KTabBar({ tabs, activeTab, onTabChange, className = '' }: KTabBarProps) {
    return (
        <div className={`flex border-b border-[#222] bg-[#0a0a0a] ${className}`}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex-1 min-w-[60px] py-3 text-[9px] font-bold flex flex-col items-center justify-center gap-1 border-b-2 transition-all ${
                        activeTab === tab.id
                            ? 'border-blue-500 text-blue-400 bg-[#0a0a0a]'
                            : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-[#161616]'
                    }`}
                >
                    {tab.icon && <tab.icon size={14} />}
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

