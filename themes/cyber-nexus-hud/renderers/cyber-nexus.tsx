import React from 'react';
import { Target } from 'lucide-react';
import { defineThemeRenderer } from 'overlayterm-theme-renderer';

export default defineThemeRenderer({
  name: 'Cyber Nexus HUD',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'channel-launcher',
  capabilities: {
    customScreens: true,
    wallpaperScene: true,
    surfaceAdapters: true,
  },
  surfaceOwnership: {
    launcher: true,
    chrome: true,
    contentFrame: true,
    wallpaper: true,
  },
  component({ host }) {
    const panels = host.shellModel.launcher.panels;
    const activePanel = panels.find(p => p.id === host.activePanelId) ?? panels[0] ?? null;

    return (
      <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', perspective: '1600px', backgroundColor: '#020406' }}>
        <style>{`
          @keyframes cyber-nexus-grid-sweep {
            from { transform: rotateX(75deg) rotateZ(0deg) translateY(-200px) translateZ(-600px); }
            to { transform: rotateX(75deg) rotateZ(360deg) translateY(-200px) translateZ(-600px); }
          }

          @keyframes cyber-nexus-panel-breathe {
            0%, 100% { opacity: 0.38; }
            50% { opacity: 0.56; }
          }
        `}</style>
        {host.wallpaper.renderBackdropStack()}

        <div
          style={{
            position: 'absolute',
            left: '-50%',
            top: '-50%',
            width: '200%',
            height: '200%',
            background: 'linear-gradient(rgba(0, 255, 170, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 170, 0.03) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
            transform: 'rotateX(75deg) rotateZ(0deg) translateY(-200px) translateZ(-600px)',
            animation: 'cyber-nexus-grid-sweep 32s linear infinite',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, transparent 20%, #020406 85%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 24, paddingBottom: 0 }}>
          <header style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 24px',
                background: 'rgba(0, 255, 170, 0.08)',
                border: '1px solid rgba(0, 255, 170, 0.4)',
                boxShadow: '0 0 30px rgba(0, 255, 170, 0.15)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#00ffaa',
                textTransform: 'uppercase',
                fontFamily: 'monospace',
                letterSpacing: 4,
                borderRadius: 8,
                clipPath: 'polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px))',
              }}
            >
              <Target size={18} />
              <span>NEXUS HUD // {activePanel?.label}</span>
            </div>
          </header>

          <div style={{ flex: 1, position: 'relative', transformStyle: 'preserve-3d' }}>
            {panels.map((panel, idx) => {
              const isActive = panel.id === activePanel?.id;
              const total = panels.length;
              const angle = total > 0 ? (idx / total) * Math.PI * 2 : 0;

              return (
                <div
                  key={panel.id}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transition: 'all 0.8s cubic-bezier(0.2, 1, 0.2, 1)',
                    transform: isActive
                      ? 'translate(-50%, -50%) scale(1) translateZ(100px)'
                      : `translate(calc(-50% + ${Math.cos(angle) * 500}px), calc(-50% + ${Math.sin(angle) * 350}px)) scale(0.4) translateZ(-400px) rotateY(${Math.cos(angle) * 45}deg) rotateX(${Math.sin(angle) * 20}deg)`,
                    width: isActive ? '85%' : '300px',
                    height: isActive ? '85%' : '200px',
                    zIndex: isActive ? 100 : 10,
                    opacity: isActive ? 1 : 0.4,
                    border: `1px solid ${isActive ? 'rgba(0,255,170,0.6)' : 'rgba(0,180,255,0.3)'}`,
                    background: isActive ? 'rgba(4, 8, 12, 0.95)' : 'rgba(6, 12, 18, 0.8)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: isActive ? 16 : 12,
                    boxShadow: isActive ? '0 0 60px rgba(0,255,170,0.15), inset 0 0 30px rgba(0,255,170,0.05)' : 'none',
                    cursor: isActive ? 'default' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: isActive ? 'none' : `cyber-nexus-panel-breathe 5.4s ease-in-out ${idx * 220}ms infinite`,
                  }}
                  onClick={() => {
                    if (!isActive) {
                      host.activatePanel(panel.id);
                    }
                  }}
                >
                  {isActive ? (
                    <>
                      <div style={{ height: 4, width: '100%', background: 'linear-gradient(90deg, transparent, #00ffaa, transparent)', opacity: 0.8 }} />
                      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                        {host.renderPanelSurface(panel.id, { forceMount: true, forceVisible: true })}
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                      <div style={{ color: 'rgba(0,180,255,0.9)', transform: 'scale(1.5)' }}>
                        {panel.icon}
                      </div>
                      <div style={{ color: 'rgba(0,255,170,0.8)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 2, fontSize: 16 }}>
                        {panel.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(0,180,255,0.5)', maxWidth: '80%', textAlign: 'center' }}>
                        {panel.description}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
            {host.renderUtilityActionsSurface()}
          </div>
        </div>
      </div>
    );
  },
});
