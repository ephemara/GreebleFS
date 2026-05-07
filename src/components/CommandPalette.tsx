import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useComboBox,
  useListBox,
  useOption,
} from 'react-aria';
import {
  Item,
  useComboBoxState,
  type ComboBoxState,
} from 'react-stately';
import { CornerDownLeft, Pin, Search } from '@/components/AppIcons';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { AppModalSurface } from './AppModal';
import { OverlayScrollArea } from './OverlayScrollArea';

export type OverlayCommandPaletteActionKind =
  | 'command'
  | 'file'
  | 'panel'
  | 'plugin';

export type OverlayCommandPaletteQuickFilterId =
  | 'all'
  | 'pinned'
  | 'recent'
  | 'commands'
  | 'files'
  | 'panels'
  | 'plugins';

export interface OverlayCommandPaletteAction {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  kind?: OverlayCommandPaletteActionKind;
  keywords?: string[];
  badge?: string;
  shortcutLabel?: string;
  onSelect: () => void | Promise<void>;
}

export interface OverlayCommandPaletteStatusMessage {
  text: string;
  tone?: 'muted' | 'accent' | 'warning' | 'error';
}

interface ScoredCommandPaletteAction {
  action: OverlayCommandPaletteAction;
  isPinned: boolean;
  isRecent: boolean;
  order: number;
  recentIndex: number | null;
  score: number;
}

interface CommandPaletteQuickFilterDefinition {
  id: OverlayCommandPaletteQuickFilterId;
  label: string;
}

interface CommandPaletteCollectionItem {
  id: string;
  textValue: string;
  actionEntry: ScoredCommandPaletteAction;
}

const commandPaletteQuickFilterCatalog: CommandPaletteQuickFilterDefinition[] = [
  { id: 'all', label: 'All' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'recent', label: 'Recent' },
  { id: 'commands', label: 'Commands' },
  { id: 'files', label: 'Files' },
  { id: 'panels', label: 'Panels' },
  { id: 'plugins', label: 'Plugins' },
];

function normalizeSearchTokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function getCommandPaletteActionKindLabel(
  kind: OverlayCommandPaletteActionKind | undefined,
): string {
  switch (kind) {
    case 'file':
      return 'file';
    case 'panel':
      return 'panel';
    case 'plugin':
      return 'plugin';
    case 'command':
    default:
      return 'command';
  }
}

function compareNullableNumber(left: number | null, right: number | null): number {
  if (left == null && right == null) {
    return 0;
  }

  if (left == null) {
    return 1;
  }

  if (right == null) {
    return -1;
  }

  return left - right;
}

function scoreFuzzySubsequence(candidate: string, query: string): number | null {
  let score = 0;
  let queryIndex = 0;
  let consecutiveMatches = 0;

  for (let candidateIndex = 0; candidateIndex < candidate.length; candidateIndex += 1) {
    if (queryIndex >= query.length) {
      break;
    }

    if (candidate[candidateIndex] !== query[queryIndex]) {
      consecutiveMatches = 0;
      continue;
    }

    const previousCharacter = candidate[candidateIndex - 1] ?? '';
    const isBoundaryMatch = candidateIndex === 0 || /[\s:/\\._-]/.test(previousCharacter);
    score += 8 + consecutiveMatches * 6 + (isBoundaryMatch ? 18 : 0);
    consecutiveMatches += 1;
    queryIndex += 1;
  }

  if (queryIndex !== query.length) {
    return null;
  }

  return 90 + score - Math.max(candidate.length - query.length, 0);
}

function scoreSearchField(fieldValue: string | undefined, normalizedToken: string): number | null {
  const candidate = fieldValue?.trim().toLowerCase();
  if (!candidate) {
    return null;
  }

  if (candidate === normalizedToken) {
    return 260;
  }

  if (candidate.startsWith(normalizedToken)) {
    return 220 - Math.min(candidate.length - normalizedToken.length, 28);
  }

  const containsIndex = candidate.indexOf(normalizedToken);
  if (containsIndex >= 0) {
    const previousCharacter = candidate[containsIndex - 1] ?? '';
    const isBoundaryMatch = containsIndex === 0 || /[\s:/\\._-]/.test(previousCharacter);
    return 176 - Math.min(containsIndex, 48) + (isBoundaryMatch ? 24 : 0);
  }

  return scoreFuzzySubsequence(candidate, normalizedToken);
}

function scoreCommandPaletteAction(
  action: OverlayCommandPaletteAction,
  normalizedTokens: string[],
): number | null {
  if (normalizedTokens.length === 0) {
    return 0;
  }

  const actionKindLabel = getCommandPaletteActionKindLabel(action.kind);
  let totalScore = 0;

  for (const token of normalizedTokens) {
    const titleScore = scoreSearchField(action.title, token);
    const subtitleScore = scoreSearchField(action.subtitle, token);
    const groupScore = scoreSearchField(action.group, token);
    const kindScore = scoreSearchField(actionKindLabel, token);
    const keywordScores = (action.keywords ?? [])
      .map((keyword) => scoreSearchField(keyword, token))
      .filter((score): score is number => score != null)
      .map((score) => score - 16);
    const bestScore = Math.max(
      titleScore ?? Number.NEGATIVE_INFINITY,
      subtitleScore != null ? subtitleScore - 24 : Number.NEGATIVE_INFINITY,
      groupScore != null ? groupScore - 32 : Number.NEGATIVE_INFINITY,
      kindScore != null ? kindScore - 20 : Number.NEGATIVE_INFINITY,
      ...keywordScores,
    );

    if (!Number.isFinite(bestScore)) {
      return null;
    }

    totalScore += bestScore;
  }

  return totalScore;
}

function actionMatchesQuickFilter(
  actionEntry: ScoredCommandPaletteAction,
  quickFilterId: OverlayCommandPaletteQuickFilterId,
): boolean {
  switch (quickFilterId) {
    case 'pinned':
      return actionEntry.isPinned;
    case 'recent':
      return actionEntry.isRecent;
    case 'commands':
      return (actionEntry.action.kind ?? 'command') === 'command';
    case 'files':
      return actionEntry.action.kind === 'file';
    case 'panels':
      return actionEntry.action.kind === 'panel';
    case 'plugins':
      return actionEntry.action.kind === 'plugin';
    case 'all':
    default:
      return true;
  }
}

function resolveEmptyStateMessage(
  quickFilterId: OverlayCommandPaletteQuickFilterId,
  quickFilterLabel: string,
  query: string,
  hasPinnedActions: boolean,
  hasRecentActions: boolean,
): string {
  if (quickFilterId === 'pinned' && !hasPinnedActions && query.trim().length === 0) {
    return 'Pin commands to keep your daily drivers at the top.';
  }

  if (quickFilterId === 'recent' && !hasRecentActions && query.trim().length === 0) {
    return 'Run a few commands and they will appear here.';
  }

  if (query.trim().length > 0) {
    return `No matches in ${quickFilterLabel.toLowerCase()}. Try a shorter query or switch scope.`;
  }

  return 'No matching actions.';
}

function CommandPaletteOptionRow({
  item,
  state,
  appearance,
  accent,
  text,
  muted,
  quickFilterId,
  onTogglePinnedAction,
}: {
  item: CommandPaletteCollectionItem;
  state: ComboBoxState<CommandPaletteCollectionItem>;
  appearance: ResolvedOverlayAppearance;
  accent: string;
  text: string;
  muted: string;
  quickFilterId: OverlayCommandPaletteQuickFilterId;
  onTogglePinnedAction?: (actionId: string) => void;
}) {
  const optionRef = useRef<HTMLLIElement | null>(null);
  const { optionProps, labelProps, descriptionProps, isFocused } = useOption(
    { key: item.id },
    state,
    optionRef,
  );
  const actionEntry = item.actionEntry;
  const action = actionEntry.action;
  const shortcutChipLabel = action.shortcutLabel && action.shortcutLabel !== 'Unassigned'
    ? action.shortcutLabel
    : null;
  const showRecentBadge = actionEntry.isRecent && quickFilterId !== 'recent';

  return (
    <li
      {...optionProps}
      ref={optionRef}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 6,
        listStyle: 'none',
        outline: 'none',
        padding: '10px 12px',
        borderRadius: 'var(--overlay-workbench-panel-radius)',
        border: `1px solid ${isFocused ? `${accent}66` : 'var(--overlay-workbench-command-palette-border)'}`,
        background: isFocused
          ? 'var(--overlay-workbench-command-palette-item-active-bg)'
          : 'var(--overlay-workbench-command-palette-item-bg)',
        color: text,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
              flexWrap: 'wrap',
            }}
          >
            <span
              {...labelProps}
              style={{
                fontSize: 12,
                fontWeight: 700,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {action.title}
            </span>
            {action.badge && (
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: 'var(--overlay-workbench-control-radius)',
                  border: '1px solid var(--overlay-workbench-command-palette-border)',
                  color: muted,
                  background: 'transparent',
                }}
              >
                {action.badge}
              </span>
            )}
            {showRecentBadge && (
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: 'var(--overlay-workbench-control-radius)',
                  border: '1px solid var(--overlay-workbench-command-palette-border)',
                  color: muted,
                  background: 'transparent',
                }}
              >
                Recent
              </span>
            )}
          </div>
          <div
            style={{
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
              fontSize: 10,
              color: muted,
            }}
          >
            <span
              style={{
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              {action.group}
            </span>
            {action.subtitle && (
              <span
                {...descriptionProps}
                style={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  opacity: 0.92,
                }}
              >
                {action.subtitle}
              </span>
            )}
          </div>
        </div>
        {shortcutChipLabel && (
          <kbd
            style={{
              fontSize: 10,
              fontFamily: appearance.fonts.mono,
              color: isFocused ? text : muted,
              border: '1px solid var(--overlay-workbench-command-palette-border)',
              borderRadius: 'var(--overlay-workbench-control-radius)',
              padding: '3px 7px',
              background: 'transparent',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {shortcutChipLabel}
          </kbd>
        )}
      </div>
      {onTogglePinnedAction && action.kind !== 'file' && (
        <button
          type="button"
          aria-label={actionEntry.isPinned ? `Unpin ${action.title}` : `Pin ${action.title}`}
          title={actionEntry.isPinned ? 'Unpin command' : 'Pin command to the top'}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onTogglePinnedAction(action.id);
          }}
          style={{
            width: 34,
            borderRadius: 'var(--overlay-workbench-panel-radius)',
            border: `1px solid ${actionEntry.isPinned ? `${accent}66` : 'var(--overlay-workbench-command-palette-border)'}`,
            background: actionEntry.isPinned
              ? 'var(--overlay-workbench-command-palette-item-active-bg)'
              : 'var(--overlay-workbench-command-palette-item-bg)',
            color: actionEntry.isPinned ? accent : muted,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Pin size={12} />
        </button>
      )}
    </li>
  );
}

export function CommandPalette({
  isOpen,
  appearance,
  blurEnabled,
  actions,
  shortcutLabel,
  queryPlaceholder = 'Search commands, panels, plugin actions...',
  statusMessage = null,
  pinnedActionIds = [],
  recentActionIds = [],
  defaultQuickFilterId = 'all',
  onQueryChange,
  onQuickFilterChange,
  onTogglePinnedAction,
  onClose,
}: {
  isOpen: boolean;
  appearance: ResolvedOverlayAppearance;
  blurEnabled: boolean;
  actions: OverlayCommandPaletteAction[];
  shortcutLabel: string;
  queryPlaceholder?: string;
  statusMessage?: OverlayCommandPaletteStatusMessage | null;
  pinnedActionIds?: string[];
  recentActionIds?: string[];
  defaultQuickFilterId?: OverlayCommandPaletteQuickFilterId;
  onQueryChange?: (query: string) => void;
  onQuickFilterChange?: (quickFilterId: OverlayCommandPaletteQuickFilterId) => void;
  onTogglePinnedAction?: (actionId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [quickFilterId, setQuickFilterId] = useState<OverlayCommandPaletteQuickFilterId>(defaultQuickFilterId);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listBoxRef = useRef<HTMLUListElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      onQueryChange?.('');
      setQuickFilterId(defaultQuickFilterId);
      return;
    }

    setQuickFilterId(defaultQuickFilterId);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [defaultQuickFilterId, isOpen, onQueryChange]);

  const pinnedActionIdSet = useMemo(
    () => new Set(pinnedActionIds),
    [pinnedActionIds],
  );
  const recentActionIndexById = useMemo(
    () => new Map(recentActionIds.map((actionId, index) => [actionId, index] as const)),
    [recentActionIds],
  );
  const normalizedSearchTokens = useMemo(
    () => normalizeSearchTokens(query),
    [query],
  );
  const scoredActions = useMemo<ScoredCommandPaletteAction[]>(() => {
    const hasSearchTokens = normalizedSearchTokens.length > 0;

    return actions
      .map((action, order) => {
        const actionScore = scoreCommandPaletteAction(action, normalizedSearchTokens);
        if (actionScore == null) {
          return null;
        }

        const isPinned = pinnedActionIdSet.has(action.id);
        const recentIndex = recentActionIndexById.get(action.id) ?? null;
        const isRecent = recentIndex != null;
        const score = actionScore
          + (isPinned ? 180 : 0)
          + (recentIndex != null ? Math.max(96 - recentIndex * 8, 20) : 0);

        return {
          action,
          isPinned,
          isRecent,
          order,
          recentIndex,
          score,
        } satisfies ScoredCommandPaletteAction;
      })
      .filter((entry): entry is ScoredCommandPaletteAction => entry != null)
      .sort((left, right) => {
        if (hasSearchTokens) {
          return (
            right.score - left.score
            || left.action.title.length - right.action.title.length
            || left.order - right.order
          );
        }

        return (
          Number(right.isPinned) - Number(left.isPinned)
          || compareNullableNumber(left.recentIndex, right.recentIndex)
          || left.order - right.order
        );
      });
  }, [actions, normalizedSearchTokens, pinnedActionIdSet, recentActionIndexById]);

  const quickFilterCounts = useMemo<Record<OverlayCommandPaletteQuickFilterId, number>>(() => {
    const counts: Record<OverlayCommandPaletteQuickFilterId, number> = {
      all: scoredActions.length,
      pinned: 0,
      recent: 0,
      commands: 0,
      files: 0,
      panels: 0,
      plugins: 0,
    };

    for (const actionEntry of scoredActions) {
      if (actionEntry.isPinned) {
        counts.pinned += 1;
      }
      if (actionEntry.isRecent) {
        counts.recent += 1;
      }

      switch (actionEntry.action.kind ?? 'command') {
        case 'file':
          counts.files += 1;
          break;
        case 'panel':
          counts.panels += 1;
          break;
        case 'plugin':
          counts.plugins += 1;
          break;
        case 'command':
        default:
          counts.commands += 1;
          break;
      }
    }

    return counts;
  }, [scoredActions]);

  const visibleQuickFilters = useMemo(
    () => commandPaletteQuickFilterCatalog.filter((filter) => (
      filter.id === 'all'
      || filter.id === 'pinned'
      || filter.id === 'recent'
      || filter.id === quickFilterId
      || quickFilterCounts[filter.id] > 0
    )),
    [quickFilterCounts, quickFilterId],
  );

  const filteredActions = useMemo(
    () => scoredActions.filter((actionEntry) => actionMatchesQuickFilter(actionEntry, quickFilterId)),
    [quickFilterId, scoredActions],
  );

  const activeQuickFilter = useMemo(
    () => visibleQuickFilters.find((filter) => filter.id === quickFilterId)
      ?? commandPaletteQuickFilterCatalog[0],
    [quickFilterId, visibleQuickFilters],
  );

  const actionEntryById = useMemo(
    () => new Map(filteredActions.map((actionEntry) => [actionEntry.action.id, actionEntry] as const)),
    [filteredActions],
  );
  const comboBoxItems = useMemo<CommandPaletteCollectionItem[]>(
    () => filteredActions.map((actionEntry) => ({
      id: actionEntry.action.id,
      textValue: actionEntry.action.title,
      actionEntry,
    })),
    [filteredActions],
  );

  const runActionById = useCallback((actionId: string) => {
    const actionEntry = actionEntryById.get(actionId);
    if (!actionEntry) {
      return;
    }

    void Promise.resolve(actionEntry.action.onSelect());
  }, [actionEntryById]);

  const comboBoxState = useComboBoxState<CommandPaletteCollectionItem>({
    items: comboBoxItems,
    children: (item) => (
      <Item key={item.id} textValue={item.textValue}>
        {item.actionEntry.action.title}
      </Item>
    ),
    inputValue: query,
    onInputChange: (nextQuery) => {
      setQuery(nextQuery);
      onQueryChange?.(nextQuery);
    },
    defaultFilter: () => true,
    allowsCustomValue: true,
    allowsEmptyCollection: true,
    menuTrigger: 'input',
    shouldCloseOnBlur: false,
    onOpenChange: (nextOpen) => {
      if (!nextOpen) {
        onClose();
      }
    },
    onSelectionChange: (key) => {
      if (typeof key === 'string') {
        runActionById(key);
      }
    },
  });

  useEffect(() => {
    if (!isOpen || comboBoxState.isOpen) {
      return;
    }

    comboBoxState.open(comboBoxItems.length > 0 ? 'first' : null, 'manual');
  }, [comboBoxItems.length, comboBoxState, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    comboBoxState.selectionManager.setFocusedKey(comboBoxItems[0]?.id ?? null);
  }, [comboBoxItems, comboBoxState, isOpen]);

  const {
    inputProps,
    listBoxProps: comboBoxListBoxProps,
  } = useComboBox<CommandPaletteCollectionItem>({
    inputRef,
    listBoxRef,
    popoverRef,
    'aria-label': 'Command palette',
    placeholder: queryPlaceholder,
    shouldFocusWrap: true,
    menuTrigger: 'input',
  }, comboBoxState);
  const { listBoxProps } = useListBox<CommandPaletteCollectionItem>({
    ...comboBoxListBoxProps,
    'aria-label': 'Command palette results',
    autoFocus: false,
    shouldFocusWrap: true,
    shouldFocusOnHover: true,
    shouldUseVirtualFocus: true,
    escapeKeyBehavior: 'none',
  }, comboBoxState, listBoxRef);

  if (!isOpen) {
    return null;
  }

  const accent = appearance.theme.palette.accent;
  const panel = appearance.theme.palette.panelBackground;
  const panelAlt = appearance.theme.palette.panelAltBackground;
  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;
  const warning = appearance.theme.palette.warning;
  const danger = appearance.theme.palette.danger;
  const workbench = appearance.workbenchTheme;
  const floatingPalette = workbench.commandPaletteStyle === 'floating' || workbench.commandPaletteStyle === 'glass';
  const focusedActionEntry = (
    typeof comboBoxState.selectionManager.focusedKey === 'string'
      ? actionEntryById.get(comboBoxState.selectionManager.focusedKey)
      : null
  ) ?? filteredActions[0] ?? null;
  const visibleResultCount = filteredActions.length;
  const resultCountLabel = visibleResultCount === 1 ? '1 result' : `${visibleResultCount} results`;
  const emptyStateMessage = resolveEmptyStateMessage(
    quickFilterId,
    activeQuickFilter.label,
    query,
    pinnedActionIds.length > 0,
    recentActionIds.length > 0,
  );
  const summaryToneColor = statusMessage?.tone === 'error'
    ? danger
    : statusMessage?.tone === 'warning'
      ? warning
      : statusMessage?.tone === 'accent'
        ? accent
        : muted;
  const summaryText = statusMessage?.text ?? 'Pinned and recent commands stay close.';

  return (
    <AppModalSurface
      onClose={onClose}
      closeOnBackdrop
      closeOnEscape
      overlayStyle={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'var(--overlay-workbench-command-palette-scrim-bg)',
        backdropFilter: blurEnabled
          ? (workbench.commandPaletteStyle === 'glass' ? 'blur(14px)' : 'blur(10px)')
          : 'none',
        WebkitBackdropFilter: blurEnabled
          ? (workbench.commandPaletteStyle === 'glass' ? 'blur(14px)' : 'blur(10px)')
          : 'none',
      }}
      containerStyle={{
        width: '100%',
        minHeight: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'var(--overlay-workbench-command-palette-top-inset) 16px 16px',
      }}
    >
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Command palette"
        style={{
          width: 'min(var(--overlay-workbench-command-palette-width), calc(100% - 8px))',
          maxHeight: 'min(66vh, 680px)',
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
            gap: 10,
            padding: '12px 14px',
            borderBottom: '1px solid var(--overlay-workbench-command-palette-border)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--overlay-workbench-control-radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${accent}18`,
              border: `1px solid ${accent}44`,
              color: accent,
              flexShrink: 0,
            }}
          >
            <Search size={14} />
          </div>
          <input
            {...inputProps}
            ref={inputRef}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'var(--overlay-workbench-command-palette-input-bg)',
              color: text,
              fontSize: 13,
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 14px',
            borderBottom: '1px solid var(--overlay-workbench-command-palette-border)',
            background: 'var(--overlay-workbench-command-palette-item-bg)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: summaryToneColor,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={summaryText}
          >
            {summaryText}
          </div>
          <div
            style={{
              fontSize: 10,
              color: muted,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {activeQuickFilter.label} · {resultCountLabel}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            padding: '8px 12px',
            borderBottom: '1px solid var(--overlay-workbench-command-palette-border)',
          }}
        >
          {visibleQuickFilters.map((filter) => {
            const isActive = filter.id === quickFilterId;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  setQuickFilterId(filter.id);
                  onQuickFilterChange?.(filter.id);
                  inputRef.current?.focus();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderRadius: 'var(--overlay-workbench-control-radius)',
                  border: `1px solid ${isActive ? `${accent}66` : 'var(--overlay-workbench-command-palette-border)'}`,
                  background: isActive
                    ? 'var(--overlay-workbench-command-palette-item-active-bg)'
                    : 'var(--overlay-workbench-command-palette-item-bg)',
                  color: isActive ? text : muted,
                  cursor: 'pointer',
                  fontSize: 10,
                }}
              >
                <span>{filter.label}</span>
                <span style={{ opacity: isActive ? 0.95 : 0.75 }}>{quickFilterCounts[filter.id]}</span>
              </button>
            );
          })}
        </div>

        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 6 }}>
          {filteredActions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 'var(--overlay-workbench-panel-radius)',
                  border: '1px dashed var(--overlay-workbench-command-palette-border)',
                  color: muted,
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {emptyStateMessage}
              </div>
            </div>
          ) : (
            <ul
              {...listBoxProps}
              ref={listBoxRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                margin: 0,
                padding: 0,
                listStyle: 'none',
                outline: 'none',
              }}
            >
              {comboBoxItems.map((item) => (
                <CommandPaletteOptionRow
                  key={item.id}
                  item={item}
                  state={comboBoxState}
                  appearance={appearance}
                  accent={accent}
                  text={text}
                  muted={muted}
                  quickFilterId={quickFilterId}
                  onTogglePinnedAction={onTogglePinnedAction}
                />
              ))}
            </ul>
          )}
        </OverlayScrollArea>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 12px',
            borderTop: '1px solid var(--overlay-workbench-command-palette-border)',
            background: 'var(--overlay-workbench-command-palette-item-bg)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              fontSize: 10,
              color: muted,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CornerDownLeft size={11} />
              Run
            </span>
            <span>↑↓ Move</span>
            <span>Esc Close</span>
          </div>
          <div
            style={{
              fontSize: 10,
              color: muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {focusedActionEntry?.action.group ?? 'Ready'}
          </div>
        </div>
      </div>
    </AppModalSurface>
  );
}
