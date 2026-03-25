import { AlertTriangle, Check, LoaderCircle } from 'lucide-react';
import {
  didExplorerTaskFail,
  getExplorerTaskProgressPercent,
  getExplorerTaskStatusLabel,
  isExplorerTaskFinished,
  type ExplorerTaskProgress,
} from '../../runtime/explorerBackend';

interface ExplorerTaskStatusBadgeProps {
  taskProgress: ExplorerTaskProgress | null;
  accent: string;
  text: string;
  muted: string;
  border: string;
  danger: string;
  background?: string;
}

export function ExplorerTaskStatusBadge({
  taskProgress,
  accent,
  text,
  muted,
  border,
  danger,
  background = 'rgba(255,255,255,0.03)',
}: ExplorerTaskStatusBadgeProps) {
  if (!taskProgress) {
    return null;
  }

  const failed = didExplorerTaskFail(taskProgress.task);
  const finished = isExplorerTaskFinished(taskProgress.task);
  const percent = getExplorerTaskProgressPercent(taskProgress.task);
  const color = failed ? danger : accent;
  const detail = percent != null && !finished
    ? `${percent}%`
    : getExplorerTaskStatusLabel(taskProgress.task);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
        maxWidth: '100%',
        padding: '2px 8px',
        borderRadius: 999,
        border: `1px solid ${failed ? `${danger}55` : border}`,
        background,
        color: text,
      }}
    >
      {failed ? (
        <AlertTriangle size={11} style={{ color }} />
      ) : finished ? (
        <Check size={11} style={{ color }} />
      ) : (
        <LoaderCircle size={11} className="animate-spin" style={{ color }} />
      )}
      <span
        style={{
          color,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {taskProgress.task.name}
      </span>
      <span style={{ color: muted, whiteSpace: 'nowrap' }}>{detail}</span>
    </span>
  );
}
