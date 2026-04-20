
import { LucideIcon } from 'lucide-react';

// Common Types for KPanelV2 System

// HOW IT WORKS:
// This file defines the shared types used across the KPanelV2 system.
// By centralizing these types, we ensure consistency between the Left and Right panels
// and make it easy to extend the system with new features.

export interface PanelTab {
    id: string;
    icon: LucideIcon;
    label: string;
    view: React.ReactNode;
}

export interface PanelAction {
    id: string;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    active?: boolean;
    color?: string; // Optional hex or Tailwind class for custom styling
}

// Visual constants for the "Premium" look
export const PANEL_STYLES = {
    glass: "backdrop-blur-md bg-[#0a0a0a]/90 border border-[#222]",
    activeTab: "text-emerald-400 border-b-2 border-emerald-500 bg-[#1a1a1a]",
    inactiveTab: "text-gray-500 hover:text-white hover:bg-[#161616]",
    sectionHeader: "text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#222]/50",
    neonGlow: "shadow-[0_0_10px_rgba(16,185,129,0.2)]", // Standard Emerald Glow
};
