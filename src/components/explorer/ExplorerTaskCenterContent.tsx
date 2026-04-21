import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  LoaderCircle,
  XCircle,
} from '@/components/AppIcons';
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
  retryExplorerTaskById,
} from '../../store/explorerTaskStore';

interface ExplorerTaskCenterContentProps {
  accent: string;
  border: string;
  danger: string;
  emptyMessage?: string;
  headerActions?: ReactNode;
  muted: string;
  tasks: ExplorerTaskSnapshot[];
  text: string;
  title?: string;
}

export function getExplorerTaskSummary(task: ExplorerTaskSnapshot): string {
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
  accent: string;
  danger: string;
  task: ExplorerTaskSnapshot;
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
  disabled?: boolean;
  label: string;
  onClick: () => void;
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

function TaskCard({
  accent,
  background,
  border,
  children,
}: {
  accent: string;
  background: string;
  border: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${border}`,
        background,
        boxShadow: `inset 0 0 0 1px ${accent}08`,
      }}
    >
      {children}
    </div>
  );
}

export function ExplorerTaskCenterContent({
  accent,
  border,
  danger,
  emptyMessage = 'File transfers, duplicate scans, trash actions, and batch renames will show up here.',
  headerActions,
  muted,
  tasks,
  text,
  title = 'Explorer Tasks',
}: ExplorerTaskCenterContentProps) {
  const activeTasks = tasks.filter((task) => task.status === 'running');
  const historyTasks = tasks.filter((task) => task.status !== 'running').slice(0, 8);
  const failedTaskCount = historyTasks.filter((task) => task.status === 'failed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: text, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {title}
          </div>
          <div style={{ color: muted, fontSize: 11 }}>
            {activeTasks.length > 0
              ? `${activeTasks.length} running · ${failedTaskCount} failed`
              : tasks.length > 0
                ? `${historyTasks.length} recent result${historyTasks.length === 1 ? '' : 's'}`
                : 'No explorer tasks yet'}
          </div>
        </div>
        {headerActions}
      </div>

      {tasks.length === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: `1px dashed ${border}`,
            color: muted,
            fontSize: 12,
          }}
        >
          {emptyMessage}
        </div>
      ) : null}

      {activeTasks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ color: muted, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Active
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeTasks.map((task) => (
              <TaskCard
                key={task.id}
                accent={accent}
                background="rgba(255,255,255,0.03)"
                border={border}
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
                  <div style={{ color: accent, fontSize: 11, fontWeight: 700 }}>{getExplorerTaskSummary(task)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <TaskActionButton
                    label="Cancel"
                    disabled={!task.canCancel}
                    onClick={() => { void cancelExplorerTaskById(task.id); }}
                  />
                </div>
              </TaskCard>
            ))}
          </div>
        </div>
      ) : null}

      {historyTasks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ color: muted, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Recent
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {historyTasks.map((task) => (
              <TaskCard
                key={task.id}
                accent={accent}
                background="rgba(255,255,255,0.02)"
                border={border}
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
                    {getExplorerTaskSummary(task)}
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
              </TaskCard>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
