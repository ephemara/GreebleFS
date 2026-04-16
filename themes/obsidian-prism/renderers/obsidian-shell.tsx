import { defineThemeRenderer } from 'overlayterm-theme-renderer';
import React from 'react';
import { PrismHeader } from './PrismHeader';
import { LateralCommandRail } from './LateralCommandRail';

export default defineThemeRenderer({
  name: 'Obsidian Prism Shell',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'workbench-tabs',
  capabilities: {
    customScreens: true,
    wallpaperScene: true,
    surfaceAdapters: true,
  },
  surfaceOwnership: {
    chrome: true,
    launcher: true,
    contentFrame: true,
    pinnedPanels: false,
    wallpaper: true,
  },
  component({ host }) {
    const accent = host.theme.palette.accent || '#8b5cf6';
    const sidebarWidth = 280;
    
    return (
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        color: 'var(--overlay-text-primary)',
        fontFamily: 'var(--overlay-font-ui)',
      }}>
        {/* Background Layer */}
        {host.wallpaper.renderBackdropStack()}
        
        {/* Main Shell Layout */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '12px',
          gap: '12px',
        }}>
          {/* First Rail (Sub-file component) */}
          <LateralCommandRail accent={accent} />

          {/* Navigation Rail */}
          <aside style={{
            width: `${sidebarWidth}px`,
            display: 'flex',
            flexDirection: 'column',
            background: 'color-mix(in srgb, var(--overlay-bg-sidebar) 82%, transparent)',
            backdropFilter: 'blur(32px)',
            borderRadius: '16px',
            border: '1px solid color-mix(in srgb, var(--overlay-accent) 15%, var(--overlay-border))',
            overflow: 'hidden',
          }}>
            <PrismHeader 
              title="OBSIDIAN" 
              subtitle="Prism Command Center" 
              accent={accent} 
            />
            
            <div style={{ flex: 1, padding: '0 12px 12px 12px', overflowY: 'auto' }}>
              {host.renderDefaultNavigationSurface()}
            </div>
          </aside>

          {/* Core Content Surface */}
          <main style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minWidth: 0,
          }}>
            {/* Top Toolbar / Utility Action Area */}
            <header style={{
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              background: 'color-mix(in srgb, var(--overlay-bg-topbar) 70%, transparent)',
              backdropFilter: 'blur(24px)',
              borderRadius: '16px',
              border: '1px solid color-mix(in srgb, var(--overlay-accent) 15%, var(--overlay-border))',
            }}>
              <div style={{ flex: 1 }}>
                {/* Custom breadcrumb or session info could go here */}
                <span style={{ fontSize: '11px', opacity: 0.6, letterSpacing: '0.05em' }}>
                  SESSION // {host.shellModel.layout.regions.panelFrame.width}px WORKSPACE
                </span>
              </div>
              {host.renderUtilityActionsSurface()}
            </header>

            {/* Flagship Content Area */}
            <section style={{
              flex: 1,
              position: 'relative',
              background: 'color-mix(in srgb, var(--overlay-bg-shell-solid) 40%, transparent)',
              borderRadius: '16px',
              border: '1px solid color-mix(in srgb, var(--overlay-accent) 8%, var(--overlay-border))',
              overflow: 'hidden',
            }}>
              {host.renderDefaultContentSurface()}
            </section>
          </main>
        </div>

        {/* Floating Utility Overlays (Global) */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          zIndex: 100,
        }}>
          {/* We could render pinned panels as floating bubbles here if we wanted */}
        </div>
      </div>
    );
  },
});
