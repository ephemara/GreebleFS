import React from 'react';

export const PrismHeader: React.FC<{ title: string; subtitle?: string; accent: string }> = ({ 
  title, 
  subtitle,
  accent 
}) => {
  return (
    <div style={{
      padding: '24px',
      marginBottom: '12px',
      borderBottom: `1px solid color-mix(in srgb, ${accent} 20%, transparent)`,
      background: 'linear-gradient(90deg, color-mix(in srgb, var(--overlay-bg-sidebar) 40%, transparent), transparent)',
    }}>
      <h1 style={{
        fontSize: '22px',
        fontWeight: 800,
        letterSpacing: '-0.02em',
        margin: 0,
        background: `linear-gradient(135deg, ${accent}, #67e8f9)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        textShadow: `0 0 20px color-mix(in srgb, ${accent} 30%, transparent)`,
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{
          fontSize: '11px',
          color: 'var(--overlay-text-muted)',
          margin: '4px 0 0 0',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          fontWeight: 600,
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
};
