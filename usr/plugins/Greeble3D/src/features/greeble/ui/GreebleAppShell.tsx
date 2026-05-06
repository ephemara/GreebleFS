import React from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { GripVertical } from 'lucide-react';
import { greeble3dRuntimeConfig } from '../../../config/greeble3dRuntime';

interface GreebleAppShellProps {
    topBar: React.ReactNode;
    leftPanel: React.ReactNode;
    rightPanel: React.ReactNode;
    viewport: React.ReactNode;
    bottomOverlay?: React.ReactNode;
    autoSaveId?: string;
}

export function GreebleAppShell({
    topBar,
    leftPanel,
    rightPanel,
    viewport,
    bottomOverlay,
    autoSaveId = greeble3dRuntimeConfig.storage.layoutAutoSaveId,
}: GreebleAppShellProps) {
    return (
        <div className="h-full w-full bg-[#050505] flex flex-col overflow-hidden" style={{ touchAction: 'none' }}>
            {/* Top Bar - Fixed */}
            <div className="flex-none z-50 bg-[#0a0a0a] border-b border-[#222]">
                {topBar}
            </div>

            {/* Main Content - Resizable Panels */}
            <div className="flex-1 min-h-0" style={{ isolation: 'isolate' }}>
                <PanelGroup direction="horizontal" autoSaveId={autoSaveId}>
                    {/* Left Panel */}
                    <Panel 
                        defaultSize={18} 
                        minSize={12} 
                        maxSize={30}
                        className="bg-[#0a0a0a] border-r border-[#222] panel-container"
                        style={{ contain: 'layout style' }}
                    >
                        {leftPanel}
                    </Panel>

                    <PanelResizeHandle className="w-1 bg-[#1a1a1a] hover:bg-emerald-500/50 transition-colors">
                        <div className="h-full flex items-center justify-center">
                            <GripVertical size={12} className="text-gray-700" />
                        </div>
                    </PanelResizeHandle>

                    {/* Center Viewport */}
                    <Panel minSize={30} className="relative bg-[#050505]" style={{ contain: 'strict' }}>
                        {viewport}
                        {bottomOverlay && (
                            <div className="absolute bottom-0 left-0 right-0 z-40">
                                {bottomOverlay}
                            </div>
                        )}
                    </Panel>

                    <PanelResizeHandle className="w-1 bg-[#1a1a1a] hover:bg-emerald-500/50 transition-colors">
                        <div className="h-full flex items-center justify-center">
                            <GripVertical size={12} className="text-gray-700" />
                        </div>
                    </PanelResizeHandle>

                    {/* Right Panel */}
                    <Panel 
                        defaultSize={20} 
                        minSize={15} 
                        maxSize={35}
                        className="bg-[#0a0a0a] border-l border-[#222] panel-container"
                        style={{ contain: 'layout style' }}
                    >
                        {rightPanel}
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
}
