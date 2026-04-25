import { useMemo, useState } from 'react';

import type {
  ExplorerCustomizeCatalogCategory,
  ExplorerCustomizeCatalogEntry,
} from '../../config/explorerCustomizeCatalog';
import type {
  ExplorerChromeControlId,
  ExplorerChromeOverrideEntry,
  ExplorerChromeSizeVariant,
} from '../../config/explorerChromeLayouts';
import { formatHotkeyLabel } from '../../config/hotkeys';
import { OverlayScrollArea } from '../OverlayScrollArea';

const categoryLabels: Record<ExplorerCustomizeCatalogCategory, string> = {
  navigation: 'Navigation',
  search: 'Search',
  selection: 'Selection',
  creation: 'Creation',
  layout: 'Layout',
  preview: 'Preview',
  workspace: 'Workspace',
  rail: 'Rail',
  status: 'Status',
  tasks: 'Tasks',
  'authored-actions': 'Authored Actions',
  other: 'Other',
};

interface ExplorerCustomizeOverlayProps {
  active: boolean;
  catalog: ExplorerCustomizeCatalogEntry[];
  selectedEntry: ExplorerCustomizeCatalogEntry | null;
  selectedPlacement: ExplorerChromeOverrideEntry | null;
  pendingHotkeyPrompt: string | null;
  commandBinding: string;
  onCatalogDragStart: (controlId: ExplorerChromeControlId) => void;
  onCatalogDragEnd: () => void;
  onSelectControl: (controlId: ExplorerChromeControlId | null) => void;
  onRemoveSelected: () => void;
  onSetSelectedSizeVariant: (variant: ExplorerChromeSizeVariant) => void;
  onSetSelectedShowLabel: (value: boolean) => void;
  onSetSelectedShowIcon: (value: boolean) => void;
}

export function ExplorerCustomizeOverlay({
  active,
  catalog,
  selectedEntry,
  selectedPlacement,
  pendingHotkeyPrompt,
  commandBinding,
  onCatalogDragStart,
  onCatalogDragEnd,
  onSelectControl,
  onRemoveSelected,
  onSetSelectedSizeVariant,
  onSetSelectedShowLabel,
  onSetSelectedShowIcon,
}: ExplorerCustomizeOverlayProps) {
  const [query, setQuery] = useState('');

  const filteredCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return catalog;
    }
    return catalog.filter((entry) => {
      const haystack = [
        entry.label,
        entry.description,
        entry.category,
        entry.controlId,
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [catalog, query]);

  const groupedCatalog = useMemo(() => {
    const groups = new Map<ExplorerCustomizeCatalogCategory, ExplorerCustomizeCatalogEntry[]>();
    for (const entry of filteredCatalog) {
      const currentEntries = groups.get(entry.category) ?? [];
      currentEntries.push(entry);
      groups.set(entry.category, currentEntries);
    }
    return Array.from(groups.entries());
  }, [filteredCatalog]);

  if (!active) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 18,
        right: 18,
        zIndex: 55,
        width: 360,
        maxWidth: 'min(360px, calc(100vw - 36px))',
        maxHeight: 'calc(100% - 36px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          borderRadius: 18,
          border: '1px solid var(--overlay-border)',
          background: 'color-mix(in srgb, var(--overlay-bg-panel) 92%, black 8%)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.38)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid color-mix(in srgb, var(--overlay-border) 80%, transparent)',
            background: 'color-mix(in srgb, var(--overlay-bg-panel) 86%, black 14%)',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--overlay-text-dim)' }}>
            Explorer Customize
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--overlay-text-primary)', lineHeight: 1.45 }}>
            Ctrl+Alt+drag any placed control to move it. Drag a control into the explorer canvas to remove it.
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--overlay-text-dim)' }}>
            Ctrl+Alt+click any placed control to bind a hotkey instantly.
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Browse commands and controls…"
            style={{
              marginTop: 12,
              width: '100%',
              borderRadius: 12,
              border: '1px solid color-mix(in srgb, var(--overlay-border) 84%, transparent)',
              background: 'color-mix(in srgb, var(--overlay-bg-panel) 80%, black 20%)',
              color: 'var(--overlay-text-primary)',
              padding: '10px 12px',
              fontSize: 11,
              outline: 'none',
            }}
          />
        </div>
        <OverlayScrollArea viewportStyle={{ maxHeight: 340 }}>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groupedCatalog.map(([category, entries]) => (
              <section key={category} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--overlay-text-dim)' }}>
                  {categoryLabels[category]}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {entries.map((entry) => (
                    <div
                      key={entry.controlId}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', entry.controlId);
                        onCatalogDragStart(entry.controlId);
                      }}
                      onDragEnd={onCatalogDragEnd}
                      onClick={() => onSelectControl(entry.controlId)}
                      style={{
                        borderRadius: 14,
                        border: entry.controlId === selectedEntry?.controlId
                          ? '1px solid color-mix(in srgb, var(--overlay-accent) 80%, transparent)'
                          : '1px solid color-mix(in srgb, var(--overlay-border) 84%, transparent)',
                        background: entry.controlId === selectedEntry?.controlId
                          ? 'color-mix(in srgb, var(--overlay-accent) 10%, transparent)'
                          : 'color-mix(in srgb, var(--overlay-bg-panel) 76%, black 24%)',
                        padding: '10px 12px',
                        cursor: 'grab',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--overlay-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.label}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--overlay-text-dim)', lineHeight: 1.4 }}>
                            {entry.description}
                          </div>
                        </div>
                        <span
                          style={{
                            flexShrink: 0,
                            borderRadius: 999,
                            border: '1px solid color-mix(in srgb, var(--overlay-border) 80%, transparent)',
                            padding: '3px 7px',
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'var(--overlay-text-dim)',
                          }}
                        >
                          {entry.source === 'built-in' ? 'Built-In' : entry.source === 'action' ? 'Action' : 'Missing'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </OverlayScrollArea>
      </div>

      <div
        style={{
          borderRadius: 18,
          border: '1px solid var(--overlay-border)',
          background: 'color-mix(in srgb, var(--overlay-bg-panel) 94%, black 6%)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.32)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid color-mix(in srgb, var(--overlay-border) 80%, transparent)',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--overlay-text-dim)' }}>
            Inspector
          </div>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selectedEntry ? (
            <>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>
                  {selectedEntry.label}
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--overlay-text-dim)', lineHeight: 1.4 }}>
                  {selectedEntry.description}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-dim)' }}>
                  Hotkey
                </span>
                <span style={{ fontSize: 11, color: 'var(--overlay-text-primary)' }}>
                  {formatHotkeyLabel(commandBinding)}
                </span>
              </div>
              {pendingHotkeyPrompt ? (
                <div
                  style={{
                    borderRadius: 12,
                    border: '1px solid color-mix(in srgb, var(--overlay-accent) 70%, transparent)',
                    background: 'color-mix(in srgb, var(--overlay-accent) 12%, transparent)',
                    padding: '10px 12px',
                    fontSize: 11,
                    color: 'var(--overlay-text-primary)',
                  }}
                >
                  {pendingHotkeyPrompt}
                </div>
              ) : null}
              {selectedEntry.supportsSizeVariant ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-dim)' }}>
                    Size
                  </span>
                  <select
                    value={selectedPlacement?.sizeVariant ?? 'regular'}
                    onChange={(event) => onSetSelectedSizeVariant(event.currentTarget.value as ExplorerChromeSizeVariant)}
                    style={{
                      borderRadius: 10,
                      border: '1px solid color-mix(in srgb, var(--overlay-border) 80%, transparent)',
                      background: 'color-mix(in srgb, var(--overlay-bg-panel) 78%, black 22%)',
                      color: 'var(--overlay-text-primary)',
                      padding: '8px 10px',
                      fontSize: 11,
                    }}
                  >
                    {selectedEntry.sizeVariants.map((variant) => (
                      <option key={variant} value={variant}>
                        {variant}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {selectedEntry.supportsLabelVisibility ? (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--overlay-text-primary)' }}>Show label</span>
                  <input
                    type="checkbox"
                    checked={selectedPlacement?.showLabel ?? true}
                    onChange={(event) => onSetSelectedShowLabel(event.currentTarget.checked)}
                  />
                </label>
              ) : null}
              {selectedEntry.supportsIconVisibility ? (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--overlay-text-primary)' }}>Show icon</span>
                  <input
                    type="checkbox"
                    checked={selectedPlacement?.showIcon ?? true}
                    onChange={(event) => onSetSelectedShowIcon(event.currentTarget.checked)}
                  />
                </label>
              ) : null}
              <button
                type="button"
                onClick={onRemoveSelected}
                style={{
                  borderRadius: 12,
                  border: '1px solid color-mix(in srgb, #ef4444 55%, transparent)',
                  background: 'color-mix(in srgb, #ef4444 14%, transparent)',
                  color: 'var(--overlay-text-primary)',
                  padding: '10px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Remove From Layout
              </button>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--overlay-text-dim)', lineHeight: 1.5 }}>
              Select a placed control or a browser item to inspect it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
