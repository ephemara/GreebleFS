import React from 'react';
import { Compass } from 'lucide-react';
import { defineThemeRenderer } from 'overlayterm-theme-renderer';

export default defineThemeRenderer({
  name: 'Celestial Astrolabe',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'channel-launcher',
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
    const panels = host.shellModel.launcher.panels;
    const activePanel = panels.find(panel => panel.id === host.activePanelId) ?? panels[0] ?? null;
    const launcherRegion = host.shellModel.layout.regions.launcher;
    const contentRegion = host.shellModel.layout.regions.content;
    const orbitSize = Math.max(340, Math.min(launcherRegion.width || 420, launcherRegion.height || 420, 520));
    const orbitRadius = Math.max(150, Math.min(orbitSize * 0.34, 250));
    const contentPadding = Math.max(10, host.shellModel.layout.contentInnerPadding);
    const utilityActions = host.shellModel.chrome.utilityActions;

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          backgroundColor: '#03060C',
          fontFamily: '"Cormorant Garamond", serif',
        }}
      >
        <style>{`
          @keyframes celestial-astrolabe-ring-slow {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }

          @keyframes celestial-astrolabe-ring-reverse {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(-360deg); }
          }
        `}</style>
        {host.wallpaper.renderBackdropStack()}

        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1400, height: 1400, animation: 'celestial-astrolabe-ring-slow 160s linear infinite', borderRadius: '50%', border: '1px solid rgba(212, 175, 55, 0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1100, height: 1100, animation: 'celestial-astrolabe-ring-reverse 90s linear infinite', borderRadius: '50%', border: '2px dashed rgba(212, 175, 55, 0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 600, height: 600, animation: 'celestial-astrolabe-ring-slow 46s linear infinite', borderRadius: '50%', border: '1px solid rgba(212, 175, 55, 0.15)', pointerEvents: 'none' }} />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: Math.max(18, host.shellModel.layout.panelGap),
            padding: host.shellModel.layout.shellInset + 12,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${launcherRegion.visible ? `${launcherRegion.width}px` : 'minmax(320px, 32%)'} minmax(0, 1fr)`,
              gap: Math.max(18, host.shellModel.layout.panelGap),
              flex: 1,
              minHeight: 0,
            }}
          >
            <div style={{ position: 'relative', minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: orbitSize, height: orbitSize, maxWidth: '100%', maxHeight: '100%' }}>
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: orbitSize + 20, height: orbitSize + 20, animation: 'celestial-astrolabe-ring-slow 28s linear infinite', borderRadius: '50%', border: '1px solid rgba(212, 175, 55, 0.12)', borderLeftColor: 'transparent', borderRightColor: 'transparent' }} />
                <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: Math.max(220, orbitSize * 0.64), height: Math.max(220, orbitSize * 0.64), borderRadius: '50%', background: 'radial-gradient(circle, rgba(212, 175, 55, 0.12) 0%, transparent 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Compass size={44} style={{ margin: '0 auto', opacity: 0.8, filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.4))' }} />
                    <div style={{ fontSize: 26, marginTop: 16, letterSpacing: 3, textTransform: 'uppercase', textShadow: '0 0 16px rgba(212,175,55,0.3)' }}>{activePanel?.label}</div>
                    <div style={{ fontSize: 16, marginTop: 8, opacity: 0.7, fontStyle: 'italic', maxWidth: 180, marginInline: 'auto' }}>{activePanel?.description}</div>
                  </div>
                </div>

                {panels.map((panel, index) => {
                  const total = panels.length;
                  const currentAngle = total > 0 ? (index / total) * Math.PI * 2 : 0;
                  const isActive = panel.id === activePanel?.id;

                  return (
                    <div
                      key={panel.id}
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: `translate(-50%, -50%) translate(${Math.cos(currentAngle) * orbitRadius}px, ${Math.sin(currentAngle) * orbitRadius}px)`,
                        transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                        zIndex: isActive ? 10 : 1,
                      }}
                    >
                      <button
                        type="button"
                        onClick={panel.activate}
                        style={{
                          width: isActive ? 72 : 52,
                          height: isActive ? 72 : 52,
                          borderRadius: '50%',
                          border: isActive ? '2px solid #D4AF37' : '1px solid rgba(212, 175, 55, 0.3)',
                          background: isActive ? '#1A2436' : 'rgba(11, 18, 32, 0.8)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          color: isActive ? '#FAEDCD' : '#D4AF37',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isActive ? '0 0 30px rgba(212, 175, 55, 0.4), inset 0 0 15px rgba(212, 175, 55, 0.2)' : '0 4px 12px rgba(0,0,0,0.5)',
                          cursor: 'pointer',
                          transition: 'all 0.4s ease',
                          transform: isActive ? 'scale(1.1)' : 'scale(1)',
                        }}
                      >
                        {panel.icon}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {utilityActions.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
                  {utilityActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      title={action.title}
                      onClick={action.onSelect}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 14px',
                        borderRadius: 999,
                        border: `1px solid ${action.isActive ? '#D4AF37' : 'rgba(212, 175, 55, 0.25)'}`,
                        background: action.isActive ? 'rgba(212, 175, 55, 0.16)' : 'rgba(5, 11, 20, 0.64)',
                        color: action.isActive ? '#FAEDCD' : '#D4AF37',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        boxShadow: action.isActive ? '0 0 24px rgba(212, 175, 55, 0.22)' : '0 12px 28px rgba(0, 0, 0, 0.28)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {action.icon ? <span style={{ display: 'flex' }}>{action.icon}</span> : null}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  background: 'rgba(5, 11, 20, 0.75)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  borderRadius: 36,
                  padding: contentPadding,
                  boxShadow: '0 24px 60px rgba(0,0,0,0.6), inset 0 0 100px rgba(212, 175, 55, 0.04)',
                  minHeight: 0,
                }}
              >
                <div style={{ position: 'absolute', top: -2, left: -2, width: 24, height: 24, borderTop: '2px solid #D4AF37', borderLeft: '2px solid #D4AF37', borderTopLeftRadius: 36, boxShadow: '-5px -5px 15px rgba(212,175,55,0.2)' }} />
                <div style={{ position: 'absolute', top: -2, right: -2, width: 24, height: 24, borderTop: '2px solid #D4AF37', borderRight: '2px solid #D4AF37', borderTopRightRadius: 36, boxShadow: '5px -5px 15px rgba(212,175,55,0.2)' }} />
                <div style={{ position: 'absolute', bottom: -2, left: -2, width: 24, height: 24, borderBottom: '2px solid #D4AF37', borderLeft: '2px solid #D4AF37', borderBottomLeftRadius: 36, boxShadow: '-5px 5px 15px rgba(212,175,55,0.2)' }} />
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderBottom: '2px solid #D4AF37', borderRight: '2px solid #D4AF37', borderBottomRightRadius: 36, boxShadow: '5px 5px 15px rgba(212,175,55,0.2)' }} />

                <div style={{ width: '100%', height: '100%', minHeight: Math.max(280, contentRegion.height - contentPadding * 2), borderRadius: 32, overflow: 'hidden', position: 'relative' }}>
                  {activePanel ? host.renderPanelSurface(activePanel.id, { forceMount: true, forceVisible: true }) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
});
