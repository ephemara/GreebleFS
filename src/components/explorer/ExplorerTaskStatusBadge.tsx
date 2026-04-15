import { useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  getExplorerTaskProgressPercent,
  getExplorerTaskStatusLabel,
  openExplorerPath,
  restoreExplorerTrashAction,
  revealExplorerPath,
  type ExplorerTaskSnapshot,
} from '../../runtime/explorerBackend';
import {
  cancelExplorerTaskById,
  closeExplorerTaskCenter,
  retryExplorerTaskById,
  toggleExplorerTaskCenter,
  useExplorerTaskCenterOpen,
  useExplorerTaskSnapshots,
} from '../../store/explorerTaskStore';

interface ExplorerTaskStatusBadgeProps {
  accent: string;
  text: string;
  muted: string;
  border: string;
  danger: string;
  background?: string;
}

function getTaskSummary(task: ExplorerTaskSnapshot): string {
  const percent = getExplorerTaskProgressPercent(task);
  if (percent != null && task.status === 'running') {
    return `${percent}%`;
  }

  if (task.status === 'failed' && task.errorMessage) {
    return task.errorMessage;
  }

  return getExplorerTaskStatusLabel(task);
}

function TaskStatusIcon({
  task,
  accent,
  danger,
}: {
  task: ExplorerTaskSnapshot;
  accent: string;
  danger: string;
}) {
  if (task.status === 'failed') {
    return <AlertTriangle size={12} style={{ color: danger }} />;
  }
  if (task.status === 'cancelled') {
    return <XCircle size={12} style={{ color: danger }} />;
  }
  if (task.status === 'succeeded') {
    return <Check size={12} style={{ color: accent }} />;
  }
  return <LoaderCircle size={12} className="animate-spin" style={{ color: accent }} />;
}

function TaskActionButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
        color: disabled ? 'rgba(255,255,255,0.35)' : 'inherit',
        borderRadius: 8,
        padding: '4px 8px',
        fontSize: 10,
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export function ExplorerTaskStatusBadge({
  accent,
  text,
  muted,
  border,
  danger,
  background = 'rgba(255,255,255,0.03)',
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

  const summary = useMemo(() => {
    const activeTasks = tasks.filter((task) => task.status === 'running');
    const failedTasks = tasks.filter((task) => task.status === 'failed');
    const dominantTask = activeTasks[0] ?? failedTasks[0] ?? tasks[0] ?? null;

    if (!dominantTask) {
      return {
        label: 'No tasks',
        color: muted,
        icon: <FolderOpen size={12} style={{ color: muted }} />,
      };
    }

    if (failedTasks.length > 0) {
      return {
        label: `${failedTasks.length} failed${activeTasks.length > 0 ? ` · ${activeTasks.length} active` : ''}`,
        color: danger,
        icon: <AlertTriangle size={12} style={{ color: danger }} />,
      };
    }

    if (activeTasks.length > 0) {
      const dominantSummary = getTaskSummary(dominantTask);
      return {
        label: `${activeTasks.length} active${dominantSummary ? ` · ${dominantSummary}` : ''}`,
        color: accent,
        icon: <LoaderCircle size={12} className="animate-spin" style={{ color: accent }} />,
      };
    }

    return {
      label: `${tasks.length} recent`,
      color: text,
      icon: <Check size={12} style={{ color: accent }} />,
    };
  }, [accent, danger, muted, tasks, text]);

  const activeTasks = tasks.filter((task) => task.status === 'running');
  const historyTasks = tasks.filter((task) => task.status !== 'running').slice(0, 8);

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ color: text, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Explorer Tasks
              </div>
              <div style={{ color: muted, fontSize: 11 }}>
                {activeTasks.length > 0
                  ? `${activeTasks.length} running · ${historyTasks.filter((task) => task.status === 'failed').length} failed`
                  : tasks.length > 0
                    ? `${historyTasks.length} recent result${historyTasks.length === 1 ? '' : 's'}`
                    : 'No explorer tasks yet'}
              </div>
            </div>
            <button
              type="button"
              onClick={closeExplorerTaskCenter}
              style={{
                border: 'none',
                background: 'transparent',
                color: muted,
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {tasks.length === 0 ? (
            <div
              style={{
                marginTop: 14,
                padding: 16,
                borderRadius: 12,
                border: `1px dashed ${border}`,
                color: muted,
                fontSize: 12,
              }}
            >
              File transfers, duplicate scans, trash actions, and batch renames will show up here.
            </div>
          ) : null}

          {activeTasks.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: muted, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Active
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${border}`,
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <TaskStatusIcon task={task} accent={accent} danger={danger} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: text, fontSize: 12, fontWeight: 700 }}>{task.title}</div>
                        <div
                          style={{
                            color: muted,
                            fontSize: 11,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {task.detail}
                        </div>
                      </div>
                      <div style={{ color: accent, fontSize: 11, fontWeight: 700 }}>{getTaskSummary(task)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <TaskActionButton
                        label="Cancel"
                        disabled={!task.canCancel}
                        onClick={() => { void cancelExplorerTaskById(task.id); }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {historyTasks.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: muted, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Recent
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {historyTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${border}`,
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <TaskStatusIcon task={task} accent={accent} danger={danger} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: text, fontSize: 12, fontWeight: 700 }}>{task.title}</div>
                        <div
                          style={{
                            color: task.status === 'failed' ? danger : muted,
                            fontSize: 11,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {task.errorMessage ?? task.detail}
                        </div>
                      </div>
                      <div style={{ color: task.status === 'failed' ? danger : muted, fontSize: 11, fontWeight: 700 }}>
                        {getTaskSummary(task)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <TaskActionButton
                        label="Retry"
                        disabled={!task.canRetry}
                        onClick={() => { void retryExplorerTaskById(task.id); }}
                      />
                      <TaskActionButton
                        label="Reveal"
                        disabled={!task.canRevealOutput || !task.destinationPath}
                        onClick={() => {
                          if (task.destinationPath) {
                            void revealExplorerPath(task.destinationPath);
                          }
                        }}
                      />
                      <TaskActionButton
                        label="Open"
                        disabled={!task.canOpenOutput || !task.destinationPath}
                        onClick={() => {
                          if (task.destinationPath) {
                            void openExplorerPath(task.destinationPath);
                          }
                        }}
                      />
                      <TaskActionButton
                        label="Copy Error"
                        disabled={!task.errorMessage}
                        onClick={() => {
                          if (task.errorMessage) {
                            void navigator.clipboard.writeText(task.errorMessage);
                          }
                        }}
                      />
                      <TaskActionButton
                        label="Undo"
                        disabled={!task.canUndo}
                        onClick={() => { void restoreExplorerTrashAction(); }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
