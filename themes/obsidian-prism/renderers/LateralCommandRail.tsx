import React from 'react';

export const LateralCommandRail: React.FC<{ accent: string }> = ({ accent }) => {
  return (
    <div style={{
      width: '48px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      padding: '24px 0',
      background: 'color-mix(in srgb, var(--overlay-bg-sidebar) 20%, transparent)',
      borderRight: '1px solid color-mix(in srgb, var(--overlay-accent) 10%, var(--overlay-border))',
    }}>
      {/* Abstract Command Gems */}
      {[1, 0.6, 0.4].map((opacity, i) => (
        <div key={i} style={{
          width: '12px',
          height: '12px',
          borderRadius: '2px',
          background: accent,
          opacity,
          transform: 'rotate(45deg)',
          boxShadow: `0 0 10px ${accent}`,
        }} />
      ))}
      <div style={{ flex: 1 }} />
      <div style={{
        width: '2px',
        height: '40px',
        background: `linear-gradient(to bottom, ${accent}, transparent)`,
      }} />
    </div>
  );
};
