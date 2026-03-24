import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StickyNote, ListTodo, Bug, MessageSquareText,
  Plus, Trash2, Pin, PinOff, Search, X, Check,
  Clock, Tag, Star, StarOff, Copy,
  ArrowUpDown,
} from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import {
  createExplorerDir,
  deleteExplorerPath,
  listExplorerDir,
  readExplorerTextFile,
  writeExplorerFile,
} from '../runtime/explorerBackend';

// ─── Constants ─────────────────────────────────────────────────────────────────

const BASE_PATH = 'M:\\Assets\\OverlayTerm';

const PALETTE = {
  bg: 'var(--overlay-bg-shell)',
  sidebar: 'var(--overlay-bg-sidebar)',
  panel: 'var(--overlay-bg-panel)',
  card: 'var(--overlay-bg-card)',
  cardHover: 'var(--overlay-bg-card-hover)',
  border: 'var(--overlay-border)',
  text: 'var(--overlay-text-primary)',
  muted: 'var(--overlay-text-muted)',
  accent: 'var(--overlay-accent)',
  green: 'var(--overlay-success)',
  red: 'var(--overlay-danger)',
  yellow: 'var(--overlay-warning)',
  blue: 'var(--overlay-info)',
  purple: 'var(--overlay-prompt)',
  orange: 'var(--overlay-warning)',
  cyan: 'var(--overlay-note)',
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type NoteCategory = 'notes' | 'todos' | 'bugs' | 'prompts';

interface NoteEntry {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  created: number;   // unix ms
  modified: number;  // unix ms
  pinned: boolean;
  starred: boolean;
  tags: string[];
  color: string;     // accent color override
  // to-do specific
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  // bug specific
  severity?: 'minor' | 'major' | 'critical' | 'blocker';
  status?: 'open' | 'in-progress' | 'resolved' | 'closed';
}

type SortMode = 'modified' | 'created' | 'alpha' | 'priority';

// ─── Category Config ───────────────────────────────────────────────────────────

interface CategoryConfig {
  id: NoteCategory;
  label: string;
  icon: React.ReactNode;
  folder: string;
  color: string;
  placeholder: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'notes',   label: 'Notes',   icon: <StickyNote size={13} />,       folder: 'notes',   color: PALETTE.blue,   placeholder: 'Quick note…' },
  { id: 'todos',   label: 'To-Do',   icon: <ListTodo size={13} />,         folder: 'todos',   color: PALETTE.green,  placeholder: 'New task…' },
  { id: 'bugs',    label: 'Bugs',    icon: <Bug size={13} />,              folder: 'bugs',    color: PALETTE.red,    placeholder: 'Bug description…' },
  { id: 'prompts', label: 'Prompts', icon: <MessageSquareText size={13} />, folder: 'prompts', color: PALETTE.purple, placeholder: 'Prompt template…' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: PALETTE.cyan,
  medium: PALETTE.yellow,
  high: PALETTE.orange,
  critical: PALETTE.red,
};

const STATUS_COLORS: Record<string, string> = {
  open: PALETTE.yellow,
  'in-progress': PALETTE.blue,
  resolved: PALETTE.green,
  closed: PALETTE.muted,
};

const TAG_COLORS = [PALETTE.blue, PALETTE.green, PALETTE.purple, PALETTE.orange, PALETTE.cyan, PALETTE.yellow];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'untitled';
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Serialize a NoteEntry to a markdown file with YAML-ish frontmatter
function serializeNote(note: NoteEntry): string {
  const meta = {
    id: note.id,
    title: note.title,
    category: note.category,
    created: note.created,
    modified: note.modified,
    pinned: note.pinned,
    starred: note.starred,
    tags: note.tags,
    color: note.color,
    ...(note.completed !== undefined && { completed: note.completed }),
    ...(note.priority && { priority: note.priority }),
    ...(note.severity && { severity: note.severity }),
    ...(note.status && { status: note.status }),
  };
  return `---\n${JSON.stringify(meta, null, 2)}\n---\n${note.content}`;
}

// Parse a markdown file back into a NoteEntry
function deserializeNote(raw: string): NoteEntry | null {
  try {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;
    const meta = JSON.parse(match[1]);
    return {
      id: meta.id,
      title: meta.title || 'Untitled',
      content: match[2],
      category: meta.category || 'notes',
      created: meta.created || Date.now(),
      modified: meta.modified || Date.now(),
      pinned: meta.pinned ?? false,
      starred: meta.starred ?? false,
      tags: meta.tags || [],
      color: meta.color || '',
      completed: meta.completed,
      priority: meta.priority,
      severity: meta.severity,
      status: meta.status,
    };
  } catch {
    return null;
  }
}

function getCategoryPath(cat: NoteCategory): string {
  const cfg = CATEGORIES.find(c => c.id === cat)!;
  return `${BASE_PATH}\\${cfg.folder}`;
}

function getNoteFilename(note: NoteEntry): string {
  return `${slugify(note.title)}_${note.id}.md`;
}

// ─── Storage Layer ─────────────────────────────────────────────────────────────

async function ensureDir(path: string): Promise<void> {
  try {
    await listExplorerDir(path, false);
  } catch {
    await createExplorerDir(path);
  }
}

async function loadAllNotes(category: NoteCategory): Promise<NoteEntry[]> {
  const dir = getCategoryPath(category);
  try {
    await ensureDir(dir);
    const files: Array<{ name: string; path: string; is_dir: boolean }> = await listExplorerDir(dir, false);
    const notes: NoteEntry[] = [];
    for (const f of files) {
      if (f.is_dir || !f.name.endsWith('.md')) continue;
      try {
        const raw = await readExplorerTextFile(f.path);
        const note = deserializeNote(raw);
        if (note) notes.push(note);
      } catch { /* skip corrupt files */ }
    }
    return notes;
  } catch {
    return [];
  }
}

async function saveNote(note: NoteEntry): Promise<void> {
  const dir = getCategoryPath(note.category);
  await ensureDir(dir);
  const filePath = `${dir}\\${getNoteFilename(note)}`;
  await writeExplorerFile(filePath, serializeNote(note));
}

async function deleteNoteFile(note: NoteEntry): Promise<void> {
  const dir = getCategoryPath(note.category);
  const filePath = `${dir}\\${getNoteFilename(note)}`;
  try {
    await deleteExplorerPath(filePath, false);
  } catch { /* already gone */ }
}

// When renaming, delete old file and write new one
async function renameAndSave(oldNote: NoteEntry, newNote: NoteEntry): Promise<void> {
  if (getNoteFilename(oldNote) !== getNoteFilename(newNote)) {
    await deleteNoteFile(oldNote);
  }
  await saveNote(newNote);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function NotesManager({ appearance }: { appearance?: ResolvedOverlayAppearance }) {
  const accent = appearance?.theme.palette.accent || PALETTE.accent;

  // ── State ──
  const [category, setCategory] = useState<NoteCategory>('notes');
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('modified');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [listWidth, setListWidth] = usePersistentPanelSize('overlayterm-notes-list-width', 280, 220, 440);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimer = useRef<number | null>(null);

  const selected = entries.find(e => e.id === selectedId) ?? null;
  const catConfig = CATEGORIES.find(c => c.id === category)!;

  // ── Load entries when category changes ──
  const reload = useCallback(async () => {
    setLoading(true);
    const loaded = await loadAllNotes(category);
    setEntries(loaded);
    setLoading(false);
  }, [category]);

  useEffect(() => {
    setSelectedId(null);
    setSearchQuery('');
    setFilterTag(null);
    setShowStarredOnly(false);
    reload();
  }, [category, reload]);

  // ── Auto-save debounced ──
  const scheduleAutoSave = useCallback((note: NoteEntry) => {
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(async () => {
      await saveNote(note);
    }, 800);
  }, []);

  // ── Create new entry ──
  const createEntry = useCallback(async () => {
    const now = Date.now();
    const newNote: NoteEntry = {
      id: generateId(),
      title: category === 'todos' ? 'New Task' : category === 'bugs' ? 'New Bug' : category === 'prompts' ? 'New Prompt' : 'New Note',
      content: '',
      category,
      created: now,
      modified: now,
      pinned: false,
      starred: false,
      tags: [],
      color: '',
      ...(category === 'todos' && { completed: false, priority: 'medium' as const }),
      ...(category === 'bugs' && { severity: 'major' as const, status: 'open' as const }),
    };
    await saveNote(newNote);
    setEntries(prev => [newNote, ...prev]);
    setSelectedId(newNote.id);
    setEditingTitle(newNote.id);
    setTitleDraft(newNote.title);
  }, [category]);

  // ── Update entry ──
  const updateEntry = useCallback((id: string, updates: Partial<NoteEntry>) => {
    setEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e, ...updates, modified: Date.now() };
      scheduleAutoSave(updated);
      return updated;
    }));
  }, [scheduleAutoSave]);

  // ── Delete entry ──
  const deleteEntry = useCallback(async (id: string) => {
    const note = entries.find(e => e.id === id);
    if (!note) return;
    await deleteNoteFile(note);
    setEntries(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [entries, selectedId]);

  // ── Duplicate entry ──
  const duplicateEntry = useCallback(async (id: string) => {
    const original = entries.find(e => e.id === id);
    if (!original) return;
    const now = Date.now();
    const clone: NoteEntry = {
      ...original,
      id: generateId(),
      title: `${original.title} (copy)`,
      created: now,
      modified: now,
      pinned: false,
    };
    await saveNote(clone);
    setEntries(prev => [clone, ...prev]);
    setSelectedId(clone.id);
  }, [entries]);

  // ── Rename commit ──
  const commitRename = useCallback(async () => {
    if (!editingTitle) return;
    const old = entries.find(e => e.id === editingTitle);
    if (!old) { setEditingTitle(null); return; }
    const newTitle = titleDraft.trim() || 'Untitled';
    const updated = { ...old, title: newTitle, modified: Date.now() };
    await renameAndSave(old, updated);
    setEntries(prev => prev.map(e => e.id === editingTitle ? updated : e));
    setEditingTitle(null);
  }, [editingTitle, titleDraft, entries]);

  // ── Filtering & sorting ──
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach(e => e.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    let list = [...entries];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (filterTag) list = list.filter(e => e.tags.includes(filterTag));
    if (showStarredOnly) list = list.filter(e => e.starred);

    // Sort
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    list.sort((a, b) => {
      // Pinned always first
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      switch (sortMode) {
        case 'modified': return b.modified - a.modified;
        case 'created': return b.created - a.created;
        case 'alpha': return a.title.localeCompare(b.title);
        case 'priority': {
          const ap = priorityOrder[a.priority ?? 'medium'] ?? 2;
          const bp = priorityOrder[b.priority ?? 'medium'] ?? 2;
          return ap - bp;
        }
        default: return 0;
      }
    });
    return list;
  }, [entries, searchQuery, sortMode, filterTag, showStarredOnly]);

  // ── Tag management for selected note ──
  const addTag = useCallback((tag: string) => {
    if (!selected) return;
    if (selected.tags.includes(tag)) return;
    updateEntry(selected.id, { tags: [...selected.tags, tag] });
  }, [selected, updateEntry]);

  const removeTag = useCallback((tag: string) => {
    if (!selected) return;
    updateEntry(selected.id, { tags: selected.tags.filter(t => t !== tag) });
  }, [selected, updateEntry]);

  // ── Keyboard shortcut: Ctrl+N for new ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createEntry();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [createEntry]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', background: PALETTE.bg, color: PALETTE.text, fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>
      {/* ══ LEFT: Category Sidebar ══ */}
      <div style={{ width: 52, background: PALETTE.sidebar, borderRight: `1px solid ${PALETTE.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 2, flexShrink: 0 }}>
        {CATEGORIES.map(cat => {
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              title={cat.label}
              style={{
                width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: isActive ? `${cat.color}20` : 'transparent',
                color: isActive ? cat.color : PALETTE.muted,
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = PALETTE.text; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = PALETTE.muted; } }}
            >
              {cat.icon}
              {/* Active indicator */}
              {isActive && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, borderRadius: '0 3px 3px 0', background: cat.color }} />}
            </button>
          );
        })}
      </div>

      {/* ══ MIDDLE: Entry List ══ */}
      <ResizablePane
        size={listWidth}
        minSize={220}
        maxSize={440}
        onSizeChange={setListWidth}
        borderColor={`${accent}55`}
        style={{ background: PALETTE.sidebar, borderRight: `1px solid ${PALETTE.border}`, display: 'flex', flexDirection: 'column' }}
      >
        {/* List Header */}
        <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${PALETTE.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: catConfig.color, display: 'flex' }}>{catConfig.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PALETTE.text }}>{catConfig.label}</span>
              <span style={{ fontSize: 10, color: PALETTE.muted, background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>{filtered.length}</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {/* Star filter */}
              <button
                onClick={() => setShowStarredOnly(!showStarredOnly)}
                title="Show starred only"
                style={{
                  background: showStarredOnly ? `${PALETTE.yellow}18` : 'none', border: 'none',
                  color: showStarredOnly ? PALETTE.yellow : PALETTE.muted, cursor: 'pointer', padding: 4, borderRadius: 4,
                }}
              >
                {showStarredOnly ? <Star size={12} /> : <StarOff size={12} />}
              </button>
              {/* Sort menu */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  title="Sort order"
                  style={{ background: 'none', border: 'none', color: PALETTE.muted, cursor: 'pointer', padding: 4, borderRadius: 4 }}
                >
                  <ArrowUpDown size={12} />
                </button>
                {showSortMenu && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', zIndex: 100,
                    background: PALETTE.card, border: `1px solid ${PALETTE.border}`, borderRadius: 6,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 140, overflow: 'hidden',
                  }}>
                    {([['modified', 'Last Modified'], ['created', 'Date Created'], ['alpha', 'Alphabetical'], ['priority', 'Priority']] as [SortMode, string][]).map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => { setSortMode(mode); setShowSortMenu(false); }}
                        style={{
                          display: 'block', width: '100%', padding: '7px 12px', textAlign: 'left',
                          background: sortMode === mode ? `${accent}18` : 'transparent',
                          border: 'none', color: sortMode === mode ? PALETTE.text : PALETTE.muted,
                          fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = sortMode === mode ? `${accent}18` : 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = sortMode === mode ? `${accent}18` : 'transparent'}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={createEntry}
                title={`New ${catConfig.label.replace(/s$/, '')} (Ctrl+N)`}
                style={{
                  background: `${catConfig.color}20`, border: `1px solid ${catConfig.color}40`,
                  color: catConfig.color, cursor: 'pointer', padding: 4, borderRadius: 4,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${catConfig.color}35`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${catConfig.color}20`; }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: PALETTE.bg, borderRadius: 6, padding: '4px 8px', border: `1px solid ${PALETTE.border}` }}>
            <Search size={12} style={{ color: PALETTE.muted, flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: PALETTE.text, fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif',
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: PALETTE.muted, cursor: 'pointer', padding: 0 }}>
                <X size={10} />
              </button>
            )}
          </div>

          {/* Tag filter pills */}
          {allTags.length > 0 && (
            <OverlayScrollArea style={{ maxHeight: 52 }} viewportStyle={{ maxHeight: 52 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {allTags.map((tag, i) => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                  style={{
                    padding: '1px 7px', borderRadius: 8, fontSize: 9, fontWeight: 600,
                    background: filterTag === tag ? `${TAG_COLORS[i % TAG_COLORS.length]}30` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${filterTag === tag ? TAG_COLORS[i % TAG_COLORS.length] + '60' : 'transparent'}`,
                    color: filterTag === tag ? TAG_COLORS[i % TAG_COLORS.length] : PALETTE.muted,
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
            </OverlayScrollArea>
          )}
        </div>

        {/* Entry List */}
        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: PALETTE.muted, fontSize: 12 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ color: PALETTE.muted, fontSize: 12, marginBottom: 8 }}>
                {searchQuery ? 'No results found.' : `No ${catConfig.label.toLowerCase()} yet.`}
              </div>
              {!searchQuery && (
                <button
                  onClick={createEntry}
                  style={{
                    background: `${catConfig.color}15`, border: `1px solid ${catConfig.color}30`,
                    color: catConfig.color, padding: '6px 14px', borderRadius: 6, fontSize: 11,
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  <Plus size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Create first {catConfig.label.replace(/s$/, '').toLowerCase()}
                </button>
              )}
            </div>
          ) : (
            filtered.map(entry => (
              <EntryListItem
                key={entry.id}
                entry={entry}
                isSelected={selectedId === entry.id}
                accent={catConfig.color}
                isEditingTitle={editingTitle === entry.id}
                titleDraft={editingTitle === entry.id ? titleDraft : ''}
                onSelect={() => setSelectedId(entry.id)}
                onStartRename={() => { setEditingTitle(entry.id); setTitleDraft(entry.title); }}
                onTitleDraftChange={setTitleDraft}
                onCommitRename={commitRename}
                onTogglePin={() => updateEntry(entry.id, { pinned: !entry.pinned })}
                onToggleStar={() => updateEntry(entry.id, { starred: !entry.starred })}
                onDelete={() => deleteEntry(entry.id)}
                onDuplicate={() => duplicateEntry(entry.id)}
                category={category}
              />
            ))
          )}
        </OverlayScrollArea>
      </ResizablePane>

      {/* ══ RIGHT: Editor ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: PALETTE.bg, overflow: 'hidden' }}>
        {!selected ? (
          <EmptyEditorState catConfig={catConfig} onCreateNew={createEntry} />
        ) : (
          <NoteEditor
            key={selected.id}
            note={selected}
            accent={catConfig.color}
            category={category}
            onUpdate={(updates) => updateEntry(selected.id, updates)}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            editorRef={editorRef}
          />
        )}
      </div>

      {/* Close sort menu on outside click */}
      {showSortMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowSortMenu(false)} />
      )}
    </div>
  );
}

// ─── Entry List Item ───────────────────────────────────────────────────────────

function EntryListItem({ entry, isSelected, accent, isEditingTitle, titleDraft, onSelect, onStartRename, onTitleDraftChange, onCommitRename, onTogglePin, onToggleStar, onDelete, onDuplicate, category }: {
  entry: NoteEntry;
  isSelected: boolean;
  accent: string;
  isEditingTitle: boolean;
  titleDraft: string;
  onSelect: () => void;
  onStartRename: () => void;
  onTitleDraftChange: (s: string) => void;
  onCommitRename: () => void;
  onTogglePin: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  category: NoteCategory;
}) {
  const [hovered, setHovered] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const preview = entry.content.split('\n')[0]?.slice(0, 80) || '';

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onStartRename}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 12px',
        cursor: 'pointer',
        background: isSelected ? `${accent}14` : hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        borderLeft: `2px solid ${isSelected ? accent : 'transparent'}`,
        borderBottom: `1px solid ${PALETTE.border}`,
        transition: 'background 0.1s, border-color 0.1s',
        position: 'relative',
      }}
    >
      {/* Pin indicator */}
      {entry.pinned && (
        <div style={{ position: 'absolute', top: 4, right: 4 }}>
          <Pin size={9} style={{ color: PALETTE.yellow, transform: 'rotate(45deg)' }} />
        </div>
      )}

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {/* To-do checkbox */}
        {category === 'todos' && (
          <button
            onClick={e => { e.stopPropagation(); /* handled in editor */ }}
            style={{
              width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${entry.completed ? PALETTE.green : PALETTE.muted}`,
              background: entry.completed ? PALETTE.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, padding: 0,
            }}
          >
            {entry.completed && <Check size={9} style={{ color: '#000' }} />}
          </button>
        )}

        {/* Bug status dot */}
        {category === 'bugs' && entry.status && (
          <div style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: STATUS_COLORS[entry.status] || PALETTE.muted,
          }} />
        )}

        {/* Title */}
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            value={titleDraft}
            onChange={e => onTitleDraftChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={e => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') { onTitleDraftChange(entry.title); onCommitRename(); } }}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, background: PALETTE.bg, border: `1px solid ${accent}`, borderRadius: 3,
              color: PALETTE.text, fontSize: 12, fontWeight: 600, padding: '1px 6px', outline: 'none',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          />
        ) : (
          <span style={{
            flex: 1, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textDecoration: entry.completed ? 'line-through' : 'none',
            color: entry.completed ? PALETTE.muted : PALETTE.text,
          }}>
            {entry.title}
          </span>
        )}

        {/* Star */}
        {(hovered || isSelected || entry.starred) && (
          <button
            onClick={e => { e.stopPropagation(); onToggleStar(); }}
            style={{ background: 'none', border: 'none', color: entry.starred ? PALETTE.yellow : PALETTE.muted, cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            {entry.starred ? <Star size={11} /> : <StarOff size={11} />}
          </button>
        )}
      </div>

      {/* Preview text */}
      {preview && (
        <div style={{ fontSize: 10, color: PALETTE.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
          {preview}
        </div>
      )}

      {/* Bottom row: meta + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: PALETTE.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={8} /> {formatDate(entry.modified)}
          </span>
          {/* Priority badge */}
          {entry.priority && (
            <span style={{
              fontSize: 8, fontWeight: 700, textTransform: 'uppercase', padding: '0 5px', borderRadius: 4,
              background: `${PRIORITY_COLORS[entry.priority]}20`,
              color: PRIORITY_COLORS[entry.priority],
              letterSpacing: '0.05em',
            }}>
              {entry.priority}
            </span>
          )}
          {/* Severity badge */}
          {entry.severity && (
            <span style={{
              fontSize: 8, fontWeight: 700, textTransform: 'uppercase', padding: '0 5px', borderRadius: 4,
              background: `${PRIORITY_COLORS[entry.severity] || PALETTE.muted}20`,
              color: PRIORITY_COLORS[entry.severity] || PALETTE.muted,
              letterSpacing: '0.05em',
            }}>
              {entry.severity}
            </span>
          )}
          {/* Tags */}
          {entry.tags.slice(0, 2).map((tag, i) => (
            <span key={tag} style={{ fontSize: 8, color: TAG_COLORS[i % TAG_COLORS.length], fontWeight: 500 }}>#{tag}</span>
          ))}
          {entry.tags.length > 2 && <span style={{ fontSize: 8, color: PALETTE.muted }}>+{entry.tags.length - 2}</span>}
        </div>

        {/* Hover actions */}
        {(hovered || isSelected) && (
          <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
            <button onClick={onTogglePin} title={entry.pinned ? 'Unpin' : 'Pin'} style={miniActionStyle}>
              {entry.pinned ? <PinOff size={10} /> : <Pin size={10} />}
            </button>
            <button onClick={onDuplicate} title="Duplicate" style={miniActionStyle}>
              <Copy size={10} />
            </button>
            <button onClick={onDelete} title="Delete" style={{ ...miniActionStyle, color: PALETTE.red }}>
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const miniActionStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: PALETTE.muted, cursor: 'pointer', padding: 2, borderRadius: 3,
};

// ─── Empty Editor State ────────────────────────────────────────────────────────

function EmptyEditorState({ catConfig, onCreateNew }: { catConfig: CategoryConfig; onCreateNew: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: PALETTE.muted }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${catConfig.color}10`, border: `1px solid ${catConfig.color}25`,
      }}>
        <span style={{ color: catConfig.color, transform: 'scale(2.5)', display: 'flex' }}>{catConfig.icon}</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: PALETTE.text, marginBottom: 4 }}>Select or create a {catConfig.label.replace(/s$/, '').toLowerCase()}</div>
        <div style={{ fontSize: 11, color: PALETTE.muted }}>Press <kbd style={kbdStyle}>Ctrl+N</kbd> to create new</div>
      </div>
      <button
        onClick={onCreateNew}
        style={{
          background: `${catConfig.color}18`, border: `1px solid ${catConfig.color}35`, color: catConfig.color,
          padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = `${catConfig.color}30`}
        onMouseLeave={e => e.currentTarget.style.background = `${catConfig.color}18`}
      >
        <Plus size={14} /> New {catConfig.label.replace(/s$/, '')}
      </button>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  fontSize: 9, fontFamily: 'monospace', background: 'rgba(255,255,255,0.06)',
  padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)',
};

// ─── Note Editor ───────────────────────────────────────────────────────────────

function NoteEditor({ note, accent, category, onUpdate, onAddTag, onRemoveTag, editorRef }: {
  note: NoteEntry;
  accent: string;
  category: NoteCategory;
  onUpdate: (updates: Partial<NoteEntry>) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const handleTagSubmit = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (tag) {
      onAddTag(tag);
      setTagInput('');
    }
    setShowTagInput(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Editor Header */}
      <div style={{ padding: '10px 20px', background: PALETTE.panel, borderBottom: `1px solid ${PALETTE.border}`, flexShrink: 0 }}>
        {/* Title */}
        <div style={{ fontSize: 16, fontWeight: 700, color: PALETTE.text, marginBottom: 8 }}>
          {note.title}
        </div>

        {/* Metadata Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: PALETTE.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} /> Modified {formatDate(note.modified)}
          </span>
          <span style={{ fontSize: 10, color: PALETTE.muted }}>•</span>
          <span style={{ fontSize: 10, color: PALETTE.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
            Created {formatDate(note.created)}
          </span>

          {/* To-Do: Priority selector */}
          {category === 'todos' && (
            <>
              <span style={{ fontSize: 10, color: PALETTE.muted }}>•</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: PALETTE.muted }}>Priority:</span>
                {(['low', 'medium', 'high', 'critical'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => onUpdate({ priority: p })}
                    style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '1px 6px', borderRadius: 4,
                      background: note.priority === p ? `${PRIORITY_COLORS[p]}25` : 'transparent',
                      border: `1px solid ${note.priority === p ? PRIORITY_COLORS[p] + '50' : 'transparent'}`,
                      color: note.priority === p ? PRIORITY_COLORS[p] : PALETTE.muted, cursor: 'pointer',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 10, color: PALETTE.muted }}>•</span>
              <button
                onClick={() => onUpdate({ completed: !note.completed })}
                style={{
                  fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                  background: note.completed ? `${PALETTE.green}15` : 'transparent',
                  border: `1px solid ${note.completed ? PALETTE.green + '40' : PALETTE.border}`,
                  color: note.completed ? PALETTE.green : PALETTE.muted,
                  padding: '2px 8px', borderRadius: 4, fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                <Check size={10} /> {note.completed ? 'Done' : 'Mark Done'}
              </button>
            </>
          )}

          {/* Bug: Severity & status */}
          {category === 'bugs' && (
            <>
              <span style={{ fontSize: 10, color: PALETTE.muted }}>•</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: PALETTE.muted }}>Severity:</span>
                {(['minor', 'major', 'critical', 'blocker'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => onUpdate({ severity: s })}
                    style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '1px 6px', borderRadius: 4,
                      background: note.severity === s ? `${PRIORITY_COLORS[s] || PALETTE.red}25` : 'transparent',
                      border: `1px solid ${note.severity === s ? (PRIORITY_COLORS[s] || PALETTE.red) + '50' : 'transparent'}`,
                      color: note.severity === s ? (PRIORITY_COLORS[s] || PALETTE.red) : PALETTE.muted, cursor: 'pointer',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 10, color: PALETTE.muted }}>•</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: PALETTE.muted }}>Status:</span>
                {(['open', 'in-progress', 'resolved', 'closed'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => onUpdate({ status: st })}
                    style={{
                      fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                      background: note.status === st ? `${STATUS_COLORS[st]}20` : 'transparent',
                      border: `1px solid ${note.status === st ? STATUS_COLORS[st] + '50' : 'transparent'}`,
                      color: note.status === st ? STATUS_COLORS[st] : PALETTE.muted, cursor: 'pointer',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          <Tag size={10} style={{ color: PALETTE.muted }} />
          {note.tags.map((tag, i) => (
            <span
              key={tag}
              style={{
                padding: '1px 8px', borderRadius: 8, fontSize: 9, fontWeight: 600,
                background: `${TAG_COLORS[i % TAG_COLORS.length]}18`,
                color: TAG_COLORS[i % TAG_COLORS.length],
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              #{tag}
              <button
                onClick={() => onRemoveTag(tag)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex', opacity: 0.7 }}
              >
                <X size={8} />
              </button>
            </span>
          ))}
          {showTagInput ? (
            <input
              autoFocus
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onBlur={handleTagSubmit}
              onKeyDown={e => { if (e.key === 'Enter') handleTagSubmit(); if (e.key === 'Escape') { setTagInput(''); setShowTagInput(false); } }}
              placeholder="tag name"
              style={{
                background: PALETTE.bg, border: `1px solid ${accent}`, borderRadius: 4,
                color: PALETTE.text, fontSize: 9, padding: '1px 6px', outline: 'none', width: 80,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            />
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              style={{
                background: 'rgba(255,255,255,0.04)', border: 'none', color: PALETTE.muted,
                fontSize: 9, padding: '1px 6px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              + tag
            </button>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <textarea
          ref={editorRef}
          value={note.content}
          onChange={e => onUpdate({ content: e.target.value })}
          placeholder={CATEGORIES.find(c => c.id === category)?.placeholder || 'Start writing…'}
          style={{
            flex: 1, width: '100%', background: 'transparent', border: 'none', outline: 'none',
            color: PALETTE.text, fontSize: 13, lineHeight: 1.7,
            padding: '16px 24px', resize: 'none',
            fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
          }}
        />
      </div>

      {/* Status Bar */}
      <div style={{
        padding: '4px 20px', background: PALETTE.panel, borderTop: `1px solid ${PALETTE.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: PALETTE.muted }}>
          {note.content.length} chars · {note.content.split(/\s+/).filter(Boolean).length} words · {note.content.split('\n').length} lines
        </span>
        <span style={{ fontSize: 9, color: `${accent}80`, display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: PALETTE.green, animation: 'notePulse 2s infinite' }} />
          Auto-saved
        </span>
      </div>

      <style>{`
        @keyframes notePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
