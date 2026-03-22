import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { OverlayScrollArea } from './OverlayScrollArea';

export interface OverlayCommandPaletteAction {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  keywords?: string[];
  badge?: string;
  onSelect: () => void | Promise<void>;
}

export function CommandPalette({
  isOpen,
  appearance,
  actions,
  shortcutLabel,
  onClose,
}: {
  isOpen: boolean;
  appearance: ResolvedOverlayAppearance;
  actions: OverlayCommandPaletteAction[];
  shortcutLabel: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const filteredActions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return actions;
    }

    return actions.filter(action => {
      const haystack = [
        action.title,
        action.subtitle ?? '',
        action.group,
        ...(action.keywords ?? []),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [actions, query]);

  useEffect(() => {
    if (selectedIndex >= filteredActions.length) {
      setSelectedIndex(Math.max(filteredActions.length - 1, 0));
    }
  }, [filteredActions.length, selectedIndex]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(current => Math.min(current + 1, Math.max(filteredActions.length - 1, 0)));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(current => Math.max(current - 1, 0));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const action = filteredActions[selectedIndex];
        if (!action) {
          return;
        }
        void Promise.resolve(action.onSelect()).finally(() => {
          onClose();
        });
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredActions, isOpen, onClose, selectedIndex]);

  if (!isOpen) {
    return null;
  }

  const accent = appearance.theme.palette.accent;
  const border = appearance.theme.palette.border;
  const panel = appearance.theme.palette.panelBackground;
  const panelAlt = appearance.theme.palette.panelAltBackground;
  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 120,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '56px 20px 20px',
        background: 'rgba(0, 0, 0, 0.36)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: 'min(760px, 100%)',
          maxHeight: 'min(72vh, 760px)',
          borderRadius: 18,
          border: `1px solid ${border}`,
          background: `linear-gradient(180deg, ${panelAlt}, ${panel})`,
          boxShadow: appearance.theme.effects.shadow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderBottom: `1px solid ${border}`,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${accent}22`,
              border: `1px solid ${accent}55`,
              color: accent,
              flexShrink: 0,
            }}
          >
            <Search size={15} />
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search commands, panels, plugin actions..."
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: text,
              fontSize: 14,
              fontFamily: appearance.fonts.ui,
            }}
          />
          <kbd
            style={{
              fontSize: 10,
              fontFamily: appearance.fonts.mono,
              color: muted,
              border: `1px solid ${border}`,
              borderRadius: 999,
              padding: '3px 8px',
              background: 'rgba(255,255,255,0.04)',
              whiteSpace: 'nowrap',
            }}
          >
            {shortcutLabel}
          </kbd>
        </div>

        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredActions.length === 0 && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: `1px dashed ${border}`,
                  color: muted,
                  fontSize: 12,
                }}
              >
                No matching actions.
              </div>
            )}

            {filteredActions.map((action, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={action.id}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    void Promise.resolve(action.onSelect()).finally(() => {
                      onClose();
                    });
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: `1px solid ${isSelected ? `${accent}66` : border}`,
                    background: isSelected ? `${accent}14` : 'rgba(255,255,255,0.02)',
                    color: text,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{action.title}</span>
                      {action.badge && (
                        <span
                          style={{
                            fontSize: 9,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            padding: '3px 6px',
                            borderRadius: 999,
                            border: `1px solid ${border}`,
                            color: muted,
                          }}
                        >
                          {action.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {action.group}
                    </div>
                    {action.subtitle && (
                      <div style={{ marginTop: 6, fontSize: 11, color: muted, lineHeight: 1.45 }}>
                        {action.subtitle}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: isSelected ? accent : muted, flexShrink: 0 }}>
                    <CornerDownLeft size={13} />
                  </div>
                </button>
              );
            })}
          </div>
        </OverlayScrollArea>
      </div>
    </div>
  );
}
