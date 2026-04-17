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
  blurEnabled,
  actions,
  shortcutLabel,
  onClose,
}: {
  isOpen: boolean;
  appearance: ResolvedOverlayAppearance;
  blurEnabled: boolean;
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
  const panel = appearance.theme.palette.panelBackground;
  const panelAlt = appearance.theme.palette.panelAltBackground;
  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;
  const workbench = appearance.workbenchTheme;
  const floatingPalette = workbench.commandPaletteStyle === 'floating' || workbench.commandPaletteStyle === 'glass';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 120,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: `var(--overlay-workbench-command-palette-top-inset) 20px 20px`,
        background: 'var(--overlay-workbench-command-palette-scrim-bg)',
        backdropFilter: blurEnabled
          ? (workbench.commandPaletteStyle === 'glass' ? 'blur(14px)' : 'blur(10px)')
          : 'none',
        WebkitBackdropFilter: blurEnabled
          ? (workbench.commandPaletteStyle === 'glass' ? 'blur(14px)' : 'blur(10px)')
          : 'none',
      }}
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: `min(var(--overlay-workbench-command-palette-width), 100%)`,
          maxHeight: 'min(72vh, 760px)',
          borderRadius: 'var(--overlay-workbench-panel-radius)',
          border: '1px solid var(--overlay-workbench-command-palette-border)',
          background: floatingPalette
            ? 'var(--overlay-workbench-command-palette-bg)'
            : `linear-gradient(180deg, ${panelAlt}, ${panel})`,
          boxShadow: 'var(--overlay-workbench-shell-shadow)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backdropFilter: blurEnabled && workbench.commandPaletteStyle === 'glass' ? 'blur(18px)' : 'none',
          WebkitBackdropFilter: blurEnabled && workbench.commandPaletteStyle === 'glass' ? 'blur(18px)' : 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid var(--overlay-workbench-command-palette-border)',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--overlay-workbench-control-radius)',
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
              background: 'var(--overlay-workbench-command-palette-input-bg)',
              color: text,
              fontSize: 14,
              fontFamily: appearance.fonts.ui,
              borderRadius: 'var(--overlay-workbench-control-radius)',
              padding: '8px 10px',
            }}
          />
          <kbd
            style={{
              fontSize: 10,
              fontFamily: appearance.fonts.mono,
              color: muted,
              border: '1px solid var(--overlay-workbench-command-palette-border)',
              borderRadius: 'var(--overlay-workbench-control-radius)',
              padding: '3px 8px',
              background: 'var(--overlay-workbench-command-palette-item-bg)',
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
                  borderRadius: 'var(--overlay-workbench-panel-radius)',
                  border: '1px dashed var(--overlay-workbench-command-palette-border)',
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
                    borderRadius: 'var(--overlay-workbench-panel-radius)',
                    border: `1px solid ${isSelected ? `${accent}66` : 'var(--overlay-workbench-command-palette-border)'}`,
                    background: isSelected ? 'var(--overlay-workbench-command-palette-item-active-bg)' : 'var(--overlay-workbench-command-palette-item-bg)',
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
                            borderRadius: 'var(--overlay-workbench-control-radius)',
                            border: '1px solid var(--overlay-workbench-command-palette-border)',
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
