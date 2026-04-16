import { useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Check,
  FolderOpen,
  LoaderCircle,
  X,
} from 'lucide-react';
import type { ExplorerTaskSnapshot } from '../../runtime/explorerBackend';
import { openFileOperationsWindow } from '../../runtime/fileOperationsWindow';
import {
  closeExplorerTaskCenter,
  toggleExplorerTaskCenter,
  useExplorerTaskCenterOpen,
  useExplorerTaskSnapshots,
} from '../../store/explorerTaskStore';
import {
  ExplorerTaskCenterContent,
  getExplorerTaskSummary,
} from './ExplorerTaskCenterContent';

interface ExplorerTaskStatusBadgeProps {
  accent: string;
  background?: string;
  border: string;
  danger: string;
  muted: string;
  text: string;
}

function resolveExplorerTaskBadgeSummary(args: {
  accent: string;
  danger: string;
  muted: string;
  tasks: ExplorerTaskSnapshot[];
  text: string;
}) {
  const activeTasks = args.tasks.filter((task) => task.status === 'running');
  const failedTasks = args.tasks.filter((task) => task.status === 'failed');
  const dominantTask = activeTasks[0] ?? failedTasks[0] ?? args.tasks[0] ?? null;

  if (!dominantTask) {
    return {
      color: args.muted,
      icon: <FolderOpen size={12} style={{ color: args.muted }} />,
      label: 'No tasks',
    };
  }

  if (failedTasks.length > 0) {
    return {
      color: args.danger,
      icon: <AlertTriangle size={12} style={{ color: args.danger }} />,
      label: `${failedTasks.length} failed${activeTasks.length > 0 ? ` · ${activeTasks.length} active` : ''}`,
    };
  }

  if (activeTasks.length > 0) {
    const dominantSummary = getExplorerTaskSummary(dominantTask);
    return {
      color: args.accent,
      icon: <LoaderCircle size={12} className="animate-spin" style={{ color: args.accent }} />,
      label: `${activeTasks.length} active${dominantSummary ? ` · ${dominantSummary}` : ''}`,
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
  text,
}: ExplorerTaskStatusBadgeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isOpen = useExplorerTaskCenterOpen();
  const tasks = useExplorerTaskSnapshots();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeExplorerTaskCenter();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const summary = useMemo(
    () => resolveExplorerTaskBadgeSummary({ accent, danger, muted, tasks, text }),
    [accent, danger, muted, tasks, text],
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={toggleExplorerTaskCenter}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          maxWidth: '100%',
          padding: '2px 8px',
          borderRadius: 999,
          border: `1px solid ${summary.color === danger ? `${danger}55` : border}`,
          background,
          color: text,
          cursor: 'pointer',
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
          Tasks
        </span>
        <span style={{ color: muted, whiteSpace: 'nowrap' }}>{summary.label}</span>
      </button>

      {isOpen ? (
        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: 'calc(100% + 10px)',
            width: 380,
            maxWidth: 'min(380px, 78vw)',
            maxHeight: 460,
            overflowY: 'auto',
            padding: 14,
            borderRadius: 16,
            border: `1px solid ${border}`,
            background: 'rgba(14,18,24,0.96)',
            boxShadow: '0 20px 48px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(18px)',
            zIndex: 40,
          }}
        >
          <ExplorerTaskCenterContent
            accent={accent}
            border={border}
            danger={danger}
            muted={muted}
            tasks={tasks}
            text={text}
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
                    width: 22,
                    height: 22,
                  }}
                  aria-label="Close task center"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          />
        </div>
      ) : null}
    </div>
  );
}
