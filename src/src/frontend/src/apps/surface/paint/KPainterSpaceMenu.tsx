import React, { useEffect, useRef } from 'react';
import KSpaceMenu, { SpaceMenuItem } from '../../../core/ui/KSpaceMenu/KSpaceMenu';

interface ThemedKSpaceMenuProps {
    visible: boolean;
    position: { x: number; y: number };
    title: React.ReactNode;
    items: SpaceMenuItem[];
    activeItemId?: string;
    activeItemIds?: string[]; // NEW: Support multiple active items
    onItemSelect: (id: string) => void;
    sliders?: any[];
    headerActions?: React.ReactNode;
    onReset?: () => void;
}

/**
 * KPainter-themed wrapper for KSpaceMenu
 * Applies cyan/blue color scheme instead of orange
 * Supports multiple active items for effect chaining
 */
export default function KPainterSpaceMenu(props: ThemedKSpaceMenuProps) {
    const { activeItemIds, items, ...restProps } = props;
    const containerRef = useRef<HTMLDivElement>(null);

    // Direct DOM manipulation to apply colors (more reliable than CSS)
    useEffect(() => {
        if (!containerRef.current || !activeItemIds || !items) return;

        // Find all buttons in the menu
        const buttons = containerRef.current.querySelectorAll('button');

        // Reset all buttons first
        buttons.forEach(btn => {
            btn.style.background = '';
            btn.style.border = '';
            btn.style.boxShadow = '';
        });

        // Apply colors to active items
        activeItemIds.forEach(activeId => {
            const idx = items.findIndex(i => i.id === activeId);
            if (idx === -1) return;

            const item = items[idx];
            const color = (item as any).color || '#22d3ee';
            const rgb = color.startsWith('#')
                ? `${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)} `
                : color.replace('rgb(', '').replace(')', '');

            // Target button at this index
            const button = buttons[idx];
            if (button) {
                button.style.background = `rgba(${rgb}, 0.25)`;
                button.style.border = `1px solid ${color} `;
                button.style.boxShadow = `0 0 15px rgba(${rgb}, 0.5), inset 0 0 10px rgba(${rgb}, 0.2)`;
            }
        });
    }, [activeItemIds, items]);

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                .kpainter-theme .text-orange-400,
                .kpainter-theme .text-orange-500 {
                    color: rgb(34 211 238) !important;
                }
                
                .kpainter-theme .bg-orange-500,
                .kpainter-theme .bg-orange-400 {
                    background-color: rgb(34 211 238) !important;
                }
                
                .kpainter-theme .border-orange-500,
                .kpainter-theme .border-orange-400 {
                    border-color: rgb(34 211 238) !important;
                }
                
                .kpainter-theme input[type="range"] {
                    accent-color: rgb(34 211 238) !important;
                }
                
                .kpainter-theme .hover\\:bg-orange-500:hover,
                .kpainter-theme .hover\\:border-orange-500:hover {
                    background-color: rgb(34 211 238) !important;
                    border-color: rgb(34 211 238) !important;
                }
            `}} />
            <div className="kpainter-theme" ref={containerRef}>
                <KSpaceMenu {...restProps} items={items} />
            </div>
        </>
    );
}
