import { useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FolderOpen,
  LoaderCircle,
  X,
} from '@/components/AppIcons';
import type { ExplorerTaskSnapshot } from '../../runtime/explorerBackend';
import { openFileOperationsWindow } from '../../runtime/fileOperationsWindow';
import {
  closeExplorerTaskCenter,
  toggleExplorerTaskCenter,
  useExplorerTaskCenterOpen,
  useExplorerTaskSnapshots,
} from '../../store/explorerTaskStore';
import { useExplorerActionRunSnapshots } from '../../store/explorerActionRunStore';
import { ExplorerActionRunCenterContent } from './ExplorerActionRunCenterContent';
import {
  ExplorerTaskCenterContent,
  getExplorerTaskSummary,
} from './ExplorerTaskCenterContent';
import { ExplorerFloatingSurface } from './ExplorerFloatingSurface';
import { OverlayScrollArea } from '../OverlayScrollArea';
import type { ExplorerChromeSizeVariant } from '../../config/explorerChromeLayouts';

const EXPLORER_TASK_CENTER_FLOATING_SURFACE_GROUP = 'explorer-task-center';

interface ExplorerTaskStatusBadgeProps {
  accent: string;
  background?: string;
  border: string;
  danger: string;
  muted: string;
  sizeVariant?: ExplorerChromeSizeVariant;
  text: string;
}

function resolveExplorerTaskBadgeMetrics(
  sizeVariant: ExplorerChromeSizeVariant,
) {
  if (sizeVariant === 'compact') {
    return {
      buttonPadding: '2px 7px',
      gap: 5,
      iconSize: 11,
      fontSize: 10,
      closeButtonSize: 20,
    };
  }
  if (sizeVariant === 'wide') {
    return {
      buttonPadding: '4px 10px',
      gap: 7,
      iconSize: 13,
      fontSize: 11,
      closeButtonSize: 24,
    };
  }
  return {
    buttonPadding: '3px 8px',
    gap: 6,
    iconSize: 12,
    fontSize: 10.5,
    closeButtonSize: 22,
  };
}

function resolveExplorerTaskBadgeSummary(args: {
  actionRuns: ReturnType<typeof useExplorerActionRunSnapshots>;
  accent: string;
  danger: string;
  muted: string;
  tasks: ExplorerTaskSnapshot[];
  text: string;
}) {
  const activeTasks = args.tasks.filter((task) => task.status === 'running');
  const failedTasks = args.tasks.filter((task) => task.status === 'failed');
  const failedActionRuns = args.actionRuns.filter((run) => run.status === 'failed');
  const launchedActionRuns = args.actionRuns.filter((run) => run.status === 'launched');
  const dominantTask = activeTasks[0] ?? failedTasks[0] ?? args.tasks[0] ?? null;

  if (failedTasks.length > 0 || failedActionRuns.length > 0) {
    const failedCount = failedTasks.length + failedActionRuns.length;
    return {
      color: args.danger,
      icon: <AlertTriangle size={12} style={{ color: args.danger }} />,
      label: `${failedCount} failed${activeTasks.length > 0 ? ` · ${activeTasks.length} active` : ''}`,
    };
  }

  if (activeTasks.length > 0) {
    const dominantSummary = dominantTask
      ? getExplorerTaskSummary(dominantTask)
      : null;
    return {
      color: args.accent,
      icon: <LoaderCircle size={12} className="animate-spin" style={{ color: args.accent }} />,
      label: `${activeTasks.length} active${dominantSummary ? ` · ${dominantSummary}` : ''}`,
    };
  }

  if (launchedActionRuns.length > 0) {
    return {
      color: args.accent,
      icon: <ExternalLink size={12} style={{ color: args.accent }} />,
      label: `${launchedActionRuns.length} launched`,
    };
  }

  if (args.actionRuns.length > 0) {
    return {
      color: args.text,
      icon: <Check size={12} style={{ color: args.accent }} />,
      label: `${args.actionRuns.length} action run${args.actionRuns.length === 1 ? '' : 's'}`,
    };
  }

  if (!dominantTask) {
    return {
      color: args.muted,
      icon: <FolderOpen size={12} style={{ color: args.muted }} />,
      label: 'No tasks',
    };
  }

  return {
    color: args.text,
    icon: <Check size={12} style={{ color: args.accent }} />,
    label: `${args.tasks.length} recent`,
  };
}

export function ExplorerTaskStatusBadge({
  accent,
  background = 'rgba(255,255,255,0.03)',
  border,
  danger,
  muted,
  sizeVariant = 'regular',
  text,
}: ExplorerTaskStatusBadgeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isOpen = useExplorerTaskCenterOpen();
  const tasks = useExplorerTaskSnapshots();
  const actionRuns = useExplorerActionRunSnapshots();
  const metrics = useMemo(
    () => resolveExplorerTaskBadgeMetrics(sizeVariant),
    [sizeVariant],
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const targetElement = target instanceof Element ? target : null;
      if (
        targetElement?.closest(
          `[data-overlay-explorer-floating-surface-group="${EXPLORER_TASK_CENTER_FLOATING_SURFACE_GROUP}"]`,
        )
      ) {
        return;
      }
      if (!containerRef.current?.contains(target)) {
        closeExplorerTaskCenter();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const summary = useMemo(
    () => resolveExplorerTaskBadgeSummary({ actionRuns, accent, danger, muted, tasks, text }),
    [actionRuns, accent, danger, muted, tasks, text],
  );

  const closeButton = (
    <button
      type="button"
      onClick={closeExplorerTaskCenter}
      style={{
        border: 'none',
        background: 'transparent',
        color: muted,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: metrics.closeButtonSize,
        height: metrics.closeButtonSize,
      }}
      aria-label="Close task center"
    >
      <X size={Math.max(12, metrics.iconSize + 1)} />
    </button>
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        minWidth: 0,
      }}
    >
      <button
        type="button"
        onClick={toggleExplorerTaskCenter}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: metrics.gap,
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          padding: metrics.buttonPadding,
          borderRadius: 999,
          border: `1px solid ${summary.color === danger ? `${danger}55` : border}`,
          background,
          color: text,
          cursor: 'pointer',
          fontSize: metrics.fontSize,
        }}
        >
          {summary.icon}
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: summary.color,
          }}
        >
          {actionRuns.length > 0 ? 'Activity' : 'Tasks'}
        </span>
        <span style={{ color: muted, whiteSpace: 'nowrap' }}>{summary.label}</span>
      </button>

      <ExplorerFloatingSurface
        anchorRef={containerRef}
        open={isOpen}
        side="top"
        align="end"
        offset={10}
        viewportPadding={10}
        surfaceGroup={EXPLORER_TASK_CENTER_FLOATING_SURFACE_GROUP}
        zIndexCssVar="--overlay-explorer-floating-menu-layer"
        zIndexFallback={9997}
      >
        <div
          role="dialog"
          aria-label="Explorer task center"
          style={{
            width: 380,
            maxWidth: 'min(380px, 78vw)',
            maxHeight: 460,
            borderRadius: 16,
            border: `1px solid ${border}`,
            background: 'rgba(14,18,24,0.96)',
            boxShadow: '0 20px 48px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(18px)',
          }}
        >
          <OverlayScrollArea
            style={{ maxHeight: 460 }}
            viewportStyle={{ padding: 14 }}
            scrollbarStyle="themed"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ExplorerActionRunCenterContent
                accent={accent}
                border={border}
                danger={danger}
                muted={muted}
                runs={actionRuns}
                text={text}
                headerActions={tasks.length === 0 ? closeButton : undefined}
              />
              {(tasks.length > 0 || actionRuns.length === 0) ? (
                <ExplorerTaskCenterContent
                  accent={accent}
                  border={border}
                  danger={danger}
                  muted={muted}
                  tasks={tasks}
                  text={text}
                  title={actionRuns.length > 0 ? 'Explorer Tasks' : 'Explorer Tasks'}
                  headerActions={(
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          void openFileOperationsWindow({ view: 'tasks' });
                          closeExplorerTaskCenter();
                        }}
                        style={{
                          border: `1px solid ${border}`,
                          background: 'rgba(255,255,255,0.04)',
                          color: text,
                          cursor: 'pointer',
                          borderRadius: 8,
                          padding: '5px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Pop Out
                      </button>
                      {closeButton}
                    </div>
                  )}
                />
              ) : null}
            </div>
          </OverlayScrollArea>
        </div>
      </ExplorerFloatingSurface>
    </div>
  );
}
