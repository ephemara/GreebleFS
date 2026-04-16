import { cavemanPalette } from './palette';

export function renderGodModeLauncher(groups, activePanelId, activatePanel) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
      {groups.map(group => (
        <section
          key={group.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 14,
            borderRadius: 22,
            border: `1px solid ${cavemanPalette.shellBorder}`,
            background: cavemanPalette.shellPanelSoft,
            boxShadow: cavemanPalette.shellShadow,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: cavemanPalette.textDim }}>
              {group.label}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: cavemanPalette.accentAlt }}>
              {group.panels.length}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.panels.map(panel => {
              const isActive = panel.id === activePanelId;
              return (
                <button
                  key={panel.id}
                  onClick={() => activatePanel(panel.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px minmax(0, 1fr)',
                    gap: 12,
                    alignItems: 'start',
                    padding: '12px 12px 13px',
                    borderRadius: 18,
                    border: isActive
                      ? `1px solid ${cavemanPalette.accent}`
                      : '1px solid rgba(141, 178, 255, 0.08)',
                    background: isActive
                      ? 'linear-gradient(180deg, rgba(12,26,40,0.96), rgba(10,18,30,0.88))'
                      : 'rgba(255,255,255,0.02)',
                    boxShadow: isActive ? '0 16px 34px rgba(4, 12, 24, 0.44)' : 'none',
                    color: cavemanPalette.textStrong,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 14,
                      background: isActive ? cavemanPalette.accentSoft : 'rgba(255,255,255,0.04)',
                      color: isActive ? cavemanPalette.accent : cavemanPalette.textSoft,
                    }}
                  >
                    {panel.icon}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
                      {panel.isOpen ? (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: isActive ? cavemanPalette.accent : cavemanPalette.signalWarm,
                            flexShrink: 0,
                          }}
                        />
                      ) : null}
                    </span>
                    <span style={{ fontSize: 10, lineHeight: 1.45, color: cavemanPalette.textSoft }}>
                      {panel.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function renderGodModeTelemetry(activePanel, layoutProfile, utilitySurface) {
  const telemetryCards = [
    {
      label: 'Runtime',
      value: layoutProfile.label,
      tone: cavemanPalette.accentAlt,
    },
    {
      label: 'Focus',
      value: activePanel?.label ?? 'Idle',
      tone: cavemanPalette.accent,
    },
    {
      label: 'Signal',
      value: activePanel?.isOpen ? 'Live' : 'Standby',
      tone: activePanel?.isOpen ? cavemanPalette.signalWarm : cavemanPalette.textSoft,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
      <section
        style={{
          padding: 16,
          borderRadius: 22,
          border: `1px solid ${cavemanPalette.shellBorderWarm}`,
          background: cavemanPalette.shellPanelSoft,
          boxShadow: cavemanPalette.shellShadow,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: cavemanPalette.textDim }}>
          Utility Surface
        </div>
        <div style={{ marginTop: 12 }}>
          {utilitySurface}
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gap: 10,
          padding: 16,
          borderRadius: 22,
          border: `1px solid ${cavemanPalette.shellBorder}`,
          background: cavemanPalette.shellPanel,
          boxShadow: cavemanPalette.shellShadow,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: cavemanPalette.textDim }}>
          Telemetry Cards
        </div>
        {telemetryCards.map(card => (
          <div
            key={card.label}
            style={{
              padding: '12px 12px 13px',
              borderRadius: 18,
              border: '1px solid rgba(141, 178, 255, 0.08)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: cavemanPalette.textDim }}>
              {card.label}
            </div>
            <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, color: card.tone }}>
              {card.value}
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          padding: 16,
          borderRadius: 22,
          border: `1px solid ${cavemanPalette.shellBorder}`,
          background: cavemanPalette.shellPanel,
          boxShadow: cavemanPalette.shellShadow,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: cavemanPalette.textDim }}>
          LLM Notes
        </div>
        <div style={{ marginTop: 10, display: 'grid', gap: 8, fontSize: 11, lineHeight: 1.55, color: cavemanPalette.textSoft }}>
          <div>Use <strong>host.shellModel.launcher</strong> for navigation structure.</div>
          <div>Use <strong>host.renderPanelSurface(...)</strong> for the active stage.</div>
          <div>Keep style tokens in helpers before the entry renderer gets noisy.</div>
        </div>
      </section>
    </div>
  );
}
