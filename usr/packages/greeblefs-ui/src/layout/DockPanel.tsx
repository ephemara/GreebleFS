import React, {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { OverlayScrollArea } from 'overlayterm-plugin';

export interface DockTab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

export interface DockPanelProps {
  side: 'left' | 'right';
  tabs: DockTab[];
  activeTabId?: string;
  onActiveTabIdChange?: (id: string) => void;
  defaultTabId?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  width?: number;
  className?: string;
  style?: CSSProperties;
  headerActions?: ReactNode;
  emptyMessage?: string;
}

export function DockPanel({
  side,
  tabs,
  activeTabId,
  onActiveTabIdChange,
  defaultTabId,
  collapsed = false,
  onToggleCollapsed,
  width = 320,
  className,
  style,
  headerActions,
  emptyMessage = 'No tabs available',
}: DockPanelProps) {
  const [internalActiveTabId, setInternalActiveTabId] = useState(defaultTabId ?? tabs[0]?.id ?? null);
  const currentActiveTabId = activeTabId ?? internalActiveTabId;

  useEffect(() => {
    if (tabs.length === 0) {
      setInternalActiveTabId(null);
      return;
    }
    if (!currentActiveTabId || !tabs.some((tab) => tab.id === currentActiveTabId)) {
      const nextTabId = defaultTabId ?? tabs[0].id;
      setInternalActiveTabId(nextTabId);
      onActiveTabIdChange?.(nextTabId);
    }
  }, [currentActiveTabId, defaultTabId, onActiveTabIdChange, tabs]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === currentActiveTabId) ?? null,
    [currentActiveTabId, tabs],
  );

  const isLeft = side === 'left';
  const CollapseIcon = collapsed
    ? isLeft ? ChevronRight : ChevronLeft
    : isLeft ? ChevronLeft : ChevronRight;

  return (
    <section
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        width: collapsed ? 52 : width,
        borderLeft: isLeft ? 'none' : '1px solid var(--overlay-border)',
        borderRight: isLeft ? '1px solid var(--overlay-border)' : 'none',
        background: 'var(--overlay-bg-panel)',
        color: 'var(--overlay-text-primary)',
        transition: 'width 140ms ease',
        overflow: 'hidden',
        ...style,
      }}
    >
      <header
        style={{
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: collapsed ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: collapsed ? '10px 8px' : '10px',
          borderBottom: '1px solid var(--overlay-border)',
          background: 'color-mix(in srgb, var(--overlay-bg-shell) 72%, transparent)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: collapsed ? 'column' : 'row',
            alignItems: 'stretch',
            gap: 6,
            minWidth: 0,
            flex: 1,
          }}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === currentActiveTabId;
            return (
              <button
                key={tab.id}
                type="button"
                title={tab.label}
                onClick={() => {
                  setInternalActiveTabId(tab.id);
                  onActiveTabIdChange?.(tab.id);
                  if (collapsed) {
                    onToggleCollapsed?.();
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: 6,
                  minHeight: 30,
                  minWidth: collapsed ? 36 : 0,
                  borderRadius: 'calc(var(--overlay-explorer-control-radius) - 2px)',
                  border: `1px solid ${isActive ? 'color-mix(in srgb, var(--overlay-accent) 42%, var(--overlay-border))' : 'transparent'}`,
                  background: isActive
                    ? 'color-mix(in srgb, var(--overlay-accent) 14%, var(--overlay-bg-panel))'
                    : 'transparent',
                  color: isActive ? 'var(--overlay-text-primary)' : 'var(--overlay-text-secondary)',
                  padding: collapsed ? 0 : '0 10px',
                  cursor: 'pointer',
                }}
              >
                {tab.icon ? <span style={{ display: 'inline-flex', alignItems: 'center' }}>{tab.icon}</span> : null}
                {!collapsed ? <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11, fontWeight: 700 }}>{tab.label}</span> : null}
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: collapsed ? 'column' : 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {!collapsed ? headerActions : null}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? `Expand ${side} dock panel` : `Collapse ${side} dock panel`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 999,
              border: '1px solid var(--overlay-border)',
              background: 'var(--overlay-bg-shell)',
              color: 'var(--overlay-text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <CollapseIcon size={14} />
          </button>
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        {collapsed ? null : activeTab ? (
          <OverlayScrollArea
            scrollbarStyle="themed"
            style={{ height: '100%', minHeight: 0 }}
            viewportStyle={{ minHeight: 0 }}
            contentStyle={{ minHeight: '100%', minWidth: 0 }}
          >
            {activeTab.content}
          </OverlayScrollArea>
        ) : (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              minHeight: '100%',
              padding: 16,
              color: 'var(--overlay-text-muted)',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}
