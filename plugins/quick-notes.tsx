import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderOpen, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { definePlugin } from 'overlayterm-plugin';

type FsApi = {
  BaseDirectory?: Record<string, unknown>;
  mkdir?: (path: string, options?: Record<string, unknown>) => Promise<void>;
  readTextFile?: (path: string, options?: Record<string, unknown>) => Promise<string>;
  writeTextFile?: (path: string, data: string, options?: Record<string, unknown>) => Promise<void>;
};

type OverlayAppearance = {
  theme: {
    palette?: {
      accent?: string;
      textMuted?: string;
      border?: string;
    };
  };
};

type HostContext = {
  compact: boolean;
} | undefined;

type PluginProps = {
  plugin: {
    name: string;
    pluginDirectory: string;
  };
  api?: {
    fs?: FsApi;
    openPluginsFolder?: () => Promise<void>;
    refreshPlugins?: () => Promise<void>;
  };
  appearance: OverlayAppearance;
  host?: HostContext;
};

type QuickNote = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};

type NotesStore = {
  version: 1;
  notes: QuickNote[];
  lastUpdatedAt: string;
};

const STORAGE_DIR = 'overlayterm/examples/quick-notes';
const STORAGE_FILE = `${STORAGE_DIR}/notes.json`;

const DEFAULT_NOTES: QuickNote[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    body: 'This plugin saves notes into app-local storage and works the same way on Windows, macOS, and Linux.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tip',
    title: 'Tip',
    body: 'Use self-contained TSX files for portable examples. Avoid relative imports and OS-specific binaries unless you ship per-platform helpers.',
    updatedAt: new Date().toISOString(),
  },
];

function createId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `note-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTimestamp(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function parseStore(raw: string): QuickNote[] {
  const parsed = JSON.parse(raw) as Partial<NotesStore>;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.notes)) {
    throw new Error('Invalid notes store format.');
  }

  return parsed.notes
    .filter((note): note is QuickNote => Boolean(note && note.id))
    .map(note => ({
      id: String(note.id),
      title: String(note.title ?? 'Untitled'),
      body: String(note.body ?? ''),
      updatedAt: String(note.updatedAt ?? new Date().toISOString()),
    }));
}

function QuickNotes({ plugin, api, appearance, host }: PluginProps) {
  const accent = appearance.theme.palette?.accent ?? 'var(--overlay-accent)';
  const muted = appearance.theme.palette?.textMuted ?? 'var(--overlay-text-muted)';
  const border = appearance.theme.palette?.border ?? 'var(--overlay-border)';
  const compact = host?.compact ?? false;

  const [notes, setNotes] = useState<QuickNote[]>(DEFAULT_NOTES);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [status, setStatus] = useState('Loading notes...');
  const [ready, setReady] = useState(false);

  const storageBaseDir = api?.fs?.BaseDirectory?.AppLocalData;

  const storageSummary = useMemo(() => {
    if (!storageBaseDir) {
      return 'App-local storage unavailable; notes stay in memory.';
    }
    return `${plugin.pluginDirectory} -> ${STORAGE_FILE}`;
  }, [plugin.pluginDirectory, storageBaseDir]);

  const saveNotes = useCallback(async (nextNotes: QuickNote[]) => {
    const fs = api?.fs;
    const baseDir = storageBaseDir;
    if (!fs || !baseDir || !fs.mkdir || !fs.writeTextFile) {
      setStatus('Stored in memory only; filesystem API is unavailable.');
      return;
    }

    const payload: NotesStore = {
      version: 1,
      notes: nextNotes,
      lastUpdatedAt: new Date().toISOString(),
    };

    await fs.mkdir(STORAGE_DIR, { baseDir, recursive: true });
    await fs.writeTextFile(STORAGE_FILE, JSON.stringify(payload, null, 2), { baseDir });
    setStatus(`Saved ${nextNotes.length} note${nextNotes.length === 1 ? '' : 's'} to app-local storage.`);
  }, [api?.fs, storageBaseDir]);

  const loadNotes = useCallback(async () => {
    const fs = api?.fs;
    const baseDir = storageBaseDir;

    if (!fs || !baseDir || !fs.mkdir || !fs.readTextFile || !fs.writeTextFile) {
      setNotes(DEFAULT_NOTES);
      setStatus('Filesystem API unavailable; showing sample notes.');
      setReady(true);
      return;
    }

    try {
      await fs.mkdir(STORAGE_DIR, { baseDir, recursive: true });
      const raw = await fs.readTextFile(STORAGE_FILE, { baseDir });
      const loaded = parseStore(raw);
      setNotes(loaded.length > 0 ? loaded : DEFAULT_NOTES);
      setStatus(`Loaded ${loaded.length > 0 ? loaded.length : DEFAULT_NOTES.length} note(s) from disk.`);
    } catch {
      setNotes(DEFAULT_NOTES);
      setStatus('Created a starter note set for this workspace.');
      await saveNotes(DEFAULT_NOTES);
    } finally {
      setReady(true);
    }
  }, [api?.fs, saveNotes, storageBaseDir]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) {
        return;
      }
      await loadNotes();
    })();

    return () => {
      cancelled = true;
    };
  }, [loadNotes]);

  const addNote = useCallback(async () => {
    const trimmedTitle = draftTitle.trim();
    const trimmedBody = draftBody.trim();

    if (!trimmedTitle && !trimmedBody) {
      setStatus('Type a title or body before adding a note.');
      return;
    }

    const nextNote: QuickNote = {
      id: createId(),
      title: trimmedTitle || 'Untitled note',
      body: trimmedBody || ' ',
      updatedAt: new Date().toISOString(),
    };
    const nextNotes = [nextNote, ...notes];

    setNotes(nextNotes);
    setDraftTitle('');
    setDraftBody('');
    setStatus(`Added "${nextNote.title}".`);
    await saveNotes(nextNotes);
  }, [draftBody, draftTitle, notes, saveNotes]);

  const deleteNote = useCallback(async (noteId: string) => {
    const nextNotes = notes.filter(note => note.id !== noteId);
    setNotes(nextNotes);
    setStatus(nextNotes.length > 0 ? 'Note removed.' : 'All notes cleared.');
    await saveNotes(nextNotes);
  }, [notes, saveNotes]);

  const restoreDefaults = useCallback(async () => {
    setNotes(DEFAULT_NOTES);
    setStatus('Restored the starter note set.');
    await saveNotes(DEFAULT_NOTES);
  }, [saveNotes]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: '100%',
        color: 'var(--overlay-text-primary)',
        fontFamily: 'var(--overlay-font-ui)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: 16,
          borderRadius: 18,
          border: `1px solid ${border}`,
          background: 'var(--overlay-bg-panel)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${accent}22`,
                border: `1px solid ${accent}66`,
              }}
            >
              <Sparkles size={15} style={{ color: accent }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{plugin.name}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>
                {notes.length} note{notes.length === 1 ? '' : 's'} saved locally
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: muted, marginTop: 8, lineHeight: 1.6, maxWidth: 760 }}>
            A portable scratchpad example. It demonstrates app-local storage, autosave-friendly state transitions,
            and a responsive layout that stays usable in the manager preview and the panel tab host.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => void api?.refreshPlugins?.()} style={toolbarButton(accent, false)}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button onClick={() => void api?.openPluginsFolder?.()} style={toolbarButton(accent, true)}>
            <FolderOpen size={14} />
            Open Folder
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'minmax(280px, 0.9fr) minmax(320px, 1.1fr)',
          gap: 12,
          alignItems: 'start',
        }}
      >
        <section
          style={{
            borderRadius: 18,
            border: `1px solid ${border}`,
            background: 'var(--overlay-bg-panel)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>New note</div>
            <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>Stored under app-local data by default.</div>
          </div>

          <label style={fieldLabelStyle}>
            Title
            <input
              value={draftTitle}
              onChange={event => setDraftTitle(event.target.value)}
              placeholder="Team ideas, bugs, or reminders"
              style={textInputStyle}
            />
          </label>

          <label style={fieldLabelStyle}>
            Body
            <textarea
              value={draftBody}
              onChange={event => setDraftBody(event.target.value)}
              placeholder="Write a short note..."
              rows={compact ? 4 : 7}
              style={textAreaStyle}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => void addNote()} style={toolbarButton(accent, true)}>
              <Plus size={14} />
              Add Note
            </button>
            <button onClick={() => void restoreDefaults()} style={toolbarButton(accent, false)}>
              <RefreshCw size={14} />
              Restore Defaults
            </button>
          </div>

          <div style={{ fontSize: 11, color: muted, lineHeight: 1.6 }}>
            Storage target:
            <div style={{ marginTop: 4, wordBreak: 'break-word' }}>{storageSummary}</div>
          </div>
        </section>

        <section
          style={{
            borderRadius: 18,
            border: `1px solid ${border}`,
            background: 'var(--overlay-bg-panel)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Notes</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>
                {ready ? 'Ready for editing' : 'Loading...'}
              </div>
            </div>
            <div style={{ fontSize: 11, color: muted }}>
              {notes.length} item{notes.length === 1 ? '' : 's'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notes.map(note => (
              <article
                key={note.id}
                style={{
                  borderRadius: 14,
                  border: `1px solid ${border}`,
                  background: 'var(--overlay-bg-card)',
                  padding: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, wordBreak: 'break-word' }}>{note.title}</div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                      Updated {formatTimestamp(note.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => void deleteNote(note.id)}
                    title="Delete note"
                    style={iconButtonStyle}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--overlay-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {note.body}
                </div>
              </article>
            ))}
          </div>

          {notes.length === 0 && (
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: '1px dashed var(--overlay-border)',
                color: muted,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              No notes yet. Add one from the editor on the left, or restore the starter set.
            </div>
          )}

          <div style={{ fontSize: 11, color: status.includes('unavailable') ? '#fca5a5' : muted, lineHeight: 1.6 }}>
            {status}
          </div>
        </section>
      </div>
    </div>
  );
}

function toolbarButton(accent: string, primary: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: '8px 12px',
    border: `1px solid ${primary ? accent : 'var(--overlay-border)'}`,
    background: primary ? `${accent}22` : 'var(--overlay-bg-card)',
    color: primary ? 'var(--overlay-accent-contrast)' : 'var(--overlay-text-secondary)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  };
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  fontSize: 12,
  fontWeight: 700,
};

const textInputStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-bg-card)',
  color: 'var(--overlay-text-primary)',
  padding: '10px 12px',
  fontSize: 13,
  outline: 'none',
};

const textAreaStyle: React.CSSProperties = {
  ...textInputStyle,
  resize: 'vertical',
  minHeight: 132,
  lineHeight: 1.6,
};

const iconButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-bg-card)',
  color: 'var(--overlay-text-muted)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

export default definePlugin({
  id: 'quick-notes',
  name: 'Quick Notes',
  description: 'Portable scratchpad example with app-local persistence and a responsive two-column layout.',
  component: QuickNotes,
});
