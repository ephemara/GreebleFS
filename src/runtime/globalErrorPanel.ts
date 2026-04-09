interface GlobalErrorPanelRecord {
  title: string;
  detail: string;
  count: number;
  updatedAt: string;
}

const overlayId = 'overlayterm-global-error-panel';
let currentRecord: GlobalErrorPanelRecord | null = null;

function ensureHost(): HTMLDivElement {
  const existing = document.getElementById(overlayId);
  if (existing instanceof HTMLDivElement) {
    return existing;
  }

  const host = document.createElement('div');
  host.id = overlayId;
  host.style.position = 'fixed';
  host.style.top = '16px';
  host.style.right = '16px';
  host.style.zIndex = '2147483647';
  host.style.width = 'min(680px, calc(100vw - 32px))';
  host.style.maxHeight = 'min(72vh, 760px)';
  host.style.pointerEvents = 'none';
  host.style.display = 'flex';
  host.style.justifyContent = 'flex-end';
  host.style.alignItems = 'flex-start';
  document.body.appendChild(host);
  return host;
}

function createButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.border = '1px solid rgba(255,255,255,0.12)';
  button.style.background = 'rgba(255,255,255,0.06)';
  button.style.color = '#f9dcdc';
  button.style.fontSize = '11px';
  button.style.fontWeight = '700';
  button.style.letterSpacing = '0.08em';
  button.style.textTransform = 'uppercase';
  button.style.padding = '6px 10px';
  button.style.borderRadius = '999px';
  button.style.cursor = 'pointer';
  return button;
}

function renderPanel(host: HTMLDivElement, record: GlobalErrorPanelRecord): void {
  host.innerHTML = '';

  const panel = document.createElement('section');
  panel.style.pointerEvents = 'auto';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.gap = '12px';
  panel.style.width = '100%';
  panel.style.maxHeight = '100%';
  panel.style.padding = '16px';
  panel.style.borderRadius = '18px';
  panel.style.border = '1px solid rgba(255, 120, 120, 0.35)';
  panel.style.background = 'rgba(26, 8, 10, 0.94)';
  panel.style.color = '#ffe7e7';
  panel.style.boxShadow = '0 24px 80px rgba(0, 0, 0, 0.45)';
  panel.style.backdropFilter = 'blur(18px)';
  panel.style.setProperty('-webkit-backdrop-filter', 'blur(18px)');

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'flex-start';
  header.style.justifyContent = 'space-between';
  header.style.gap = '12px';

  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.flexDirection = 'column';
  titleWrap.style.gap = '6px';
  titleWrap.style.minWidth = '0';

  const title = document.createElement('div');
  title.textContent = record.title;
  title.style.fontSize = '14px';
  title.style.fontWeight = '700';

  const meta = document.createElement('div');
  meta.textContent = `${record.count > 1 ? `${record.count}x repeated` : 'Captured'} • ${record.updatedAt}`;
  meta.style.fontSize = '11px';
  meta.style.letterSpacing = '0.06em';
  meta.style.textTransform = 'uppercase';
  meta.style.color = 'rgba(255, 231, 231, 0.68)';

  titleWrap.appendChild(title);
  titleWrap.appendChild(meta);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.alignItems = 'center';
  actions.style.gap = '8px';
  actions.style.flexShrink = '0';

  const copyButton = createButton('Copy');
  copyButton.onclick = async () => {
    const content = `${record.title}\n\n${record.detail}`;
    try {
      await navigator.clipboard.writeText(content);
      copyButton.textContent = 'Copied';
      window.setTimeout(() => {
        copyButton.textContent = 'Copy';
      }, 1200);
    } catch {
      copyButton.textContent = 'Failed';
      window.setTimeout(() => {
        copyButton.textContent = 'Copy';
      }, 1200);
    }
  };

  const reloadButton = createButton('Reload');
  reloadButton.onclick = () => {
    window.location.reload();
  };

  const closeButton = createButton('Dismiss');
  closeButton.onclick = () => {
    currentRecord = null;
    host.remove();
  };

  actions.appendChild(copyButton);
  actions.appendChild(reloadButton);
  actions.appendChild(closeButton);

  header.appendChild(titleWrap);
  header.appendChild(actions);

  const detail = document.createElement('pre');
  detail.textContent = record.detail;
  detail.style.margin = '0';
  detail.style.padding = '14px';
  detail.style.overflow = 'auto';
  detail.style.maxHeight = 'min(48vh, 540px)';
  detail.style.whiteSpace = 'pre-wrap';
  detail.style.wordBreak = 'break-word';
  detail.style.fontFamily = "Consolas, 'Courier New', monospace";
  detail.style.fontSize = '12px';
  detail.style.lineHeight = '1.55';
  detail.style.color = '#f9dcdc';
  detail.style.background = 'rgba(255,255,255,0.03)';
  detail.style.border = '1px solid rgba(255,255,255,0.08)';
  detail.style.borderRadius = '12px';

  panel.appendChild(header);
  panel.appendChild(detail);
  host.appendChild(panel);
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatObjectDetail(value: Record<string, unknown>): string {
  const segments: string[] = [];
  const message = typeof value.message === 'string' ? value.message.trim() : '';
  const filename = typeof value.filename === 'string' ? value.filename.trim() : '';
  const lineno = typeof value.lineno === 'number' ? value.lineno : null;
  const colno = typeof value.colno === 'number' ? value.colno : null;

  if (message) {
    segments.push(message);
  }

  if (filename) {
    const locationSuffix = lineno != null
      ? `:${lineno}${colno != null ? `:${colno}` : ''}`
      : '';
    segments.push(`@${filename}${locationSuffix}`);
  }

  if (segments.length > 0) {
    return segments.join('\n');
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatGlobalErrorDetail(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object') {
    return formatObjectDetail(value as Record<string, unknown>);
  }

  return String(value);
}

export function reportGlobalError(title: string, detail: string): void {
  const normalizedDetail = detail.trim() || 'Unknown error.';
  const nextRecord = currentRecord && currentRecord.title === title && currentRecord.detail === normalizedDetail
    ? {
        ...currentRecord,
        count: currentRecord.count + 1,
        updatedAt: formatTimestamp(new Date()),
      }
    : {
        title,
        detail: normalizedDetail,
        count: 1,
        updatedAt: formatTimestamp(new Date()),
      };

  currentRecord = nextRecord;
  renderPanel(ensureHost(), nextRecord);
}

export function resetGlobalErrorPanel(): void {
  currentRecord = null;
  document.getElementById(overlayId)?.remove();
}
