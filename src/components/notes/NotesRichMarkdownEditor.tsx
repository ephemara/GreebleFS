import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';

import type { ResolvedOverlayAppearance } from '../../config/appearance';
import {
  notesMarkdownEditorExtensions,
  parseNotesMarkdownToDocument,
  renderNotesDocumentToMarkdown,
} from '../../runtime/notesMarkdownDocument';
import { OverlayActionButton } from '../OverlayActionButton';

interface NotesRichMarkdownEditorProps {
  appearance: ResolvedOverlayAppearance;
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
}

export function NotesRichMarkdownEditor({
  appearance,
  markdown,
  onMarkdownChange,
}: NotesRichMarkdownEditorProps) {
  const lastAppliedMarkdownRef = useRef(markdown);
  const isApplyingExternalMarkdownRef = useRef(false);
  const editor = useEditor({
    extensions: notesMarkdownEditorExtensions,
    content: parseNotesMarkdownToDocument(markdown),
    autofocus: false,
    editorProps: {
      attributes: {
        class: 'notes-rich-editor-surface',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      if (isApplyingExternalMarkdownRef.current) {
        return;
      }

      const nextMarkdown = renderNotesDocumentToMarkdown(activeEditor.getJSON());
      lastAppliedMarkdownRef.current = nextMarkdown;
      onMarkdownChange(nextMarkdown);
    },
  }, []);

  useEffect(() => {
    if (!editor || markdown === lastAppliedMarkdownRef.current) {
      return;
    }

    isApplyingExternalMarkdownRef.current = true;
    editor.commands.setContent(parseNotesMarkdownToDocument(markdown), {
      emitUpdate: false,
    });
    lastAppliedMarkdownRef.current = markdown;
    isApplyingExternalMarkdownRef.current = false;
  }, [editor, markdown]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        height: '100%',
        minHeight: 0,
        background: 'var(--overlay-bg-panel)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          padding: '12px 14px',
          borderBottom: '1px solid var(--overlay-border)',
          background: 'color-mix(in srgb, var(--overlay-bg-panel) 85%, transparent)',
        }}
      >
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('paragraph') ?? false}
          disabled={!editor}
          label="P"
          onClick={() => editor?.chain().focus().setParagraph().run()}
        />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('heading', { level: 1 }) ?? false}
          disabled={!editor}
          label="H1"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('heading', { level: 2 }) ?? false}
          disabled={!editor}
          label="H2"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('heading', { level: 3 }) ?? false}
          disabled={!editor}
          label="H3"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarDivider />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('bold') ?? false}
          disabled={!editor}
          label="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('italic') ?? false}
          disabled={!editor}
          label="Italic"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('underline') ?? false}
          disabled={!editor}
          label="Underline"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('strike') ?? false}
          disabled={!editor}
          label="Strike"
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('code') ?? false}
          disabled={!editor}
          label="Inline Code"
          onClick={() => editor?.chain().focus().toggleCode().run()}
        />
        <ToolbarDivider />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('blockquote') ?? false}
          disabled={!editor}
          label="Quote"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('codeBlock') ?? false}
          disabled={!editor}
          label="Code Block"
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        />
        <ToolbarDivider />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('bulletList') ?? false}
          disabled={!editor}
          label="Bullet"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('orderedList') ?? false}
          disabled={!editor}
          label="Numbered"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('taskList') ?? false}
          disabled={!editor}
          label="Checklist"
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        />
        <ToolbarDivider />
        <ToolbarButton
          appearance={appearance}
          active={editor?.isActive('table') ?? false}
          disabled={!editor}
          label="Insert Table"
          onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        />
        <ToolbarButton
          appearance={appearance}
          disabled={!editor || !editor.isActive('table')}
          label="Add Row"
          onClick={() => editor?.chain().focus().addRowAfter().run()}
        />
        <ToolbarButton
          appearance={appearance}
          disabled={!editor || !editor.isActive('table')}
          label="Add Column"
          onClick={() => editor?.chain().focus().addColumnAfter().run()}
        />
        <ToolbarButton
          appearance={appearance}
          disabled={!editor || !editor.isActive('table')}
          label="Delete Table"
          onClick={() => editor?.chain().focus().deleteTable().run()}
        />
      </div>

      <div
        style={{
          position: 'relative',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <style>{`
          .notes-rich-editor-surface {
            min-height: 100%;
            height: 100%;
            padding: 24px 28px 96px;
            overflow-y: auto;
            outline: none;
            color: var(--overlay-text-primary);
            font-family: var(--overlay-font-ui, "IBM Plex Sans", system-ui, sans-serif);
            font-size: 14px;
            line-height: 1.75;
            background:
              linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-panel) 92%, transparent) 0%, transparent 200px),
              radial-gradient(circle at top right, color-mix(in srgb, ${appearance.theme.palette.accent} 14%, transparent), transparent 28%);
          }

          .notes-rich-editor-surface p,
          .notes-rich-editor-surface ul,
          .notes-rich-editor-surface ol,
          .notes-rich-editor-surface blockquote,
          .notes-rich-editor-surface pre,
          .notes-rich-editor-surface table {
            margin: 0 0 1em;
          }

          .notes-rich-editor-surface h1,
          .notes-rich-editor-surface h2,
          .notes-rich-editor-surface h3,
          .notes-rich-editor-surface h4 {
            margin: 1.15em 0 0.45em;
            line-height: 1.18;
            letter-spacing: -0.03em;
          }

          .notes-rich-editor-surface h1 { font-size: 2.05rem; }
          .notes-rich-editor-surface h2 { font-size: 1.65rem; }
          .notes-rich-editor-surface h3 { font-size: 1.35rem; }
          .notes-rich-editor-surface h4 { font-size: 1.15rem; }

          .notes-rich-editor-surface blockquote {
            margin-left: 0;
            padding: 12px 14px;
            border-left: 3px solid ${appearance.theme.palette.accent};
            background: color-mix(in srgb, var(--overlay-bg-card) 78%, transparent);
            color: var(--overlay-text-secondary, var(--overlay-text-primary));
          }

          .notes-rich-editor-surface code {
            padding: 0.12em 0.4em;
            border-radius: 8px;
            background: color-mix(in srgb, var(--overlay-bg-card) 88%, transparent);
            border: 1px solid var(--overlay-border);
            font-family: var(--overlay-font-mono, "JetBrains Mono", monospace);
            font-size: 0.92em;
          }

          .notes-rich-editor-surface pre {
            padding: 14px 16px;
            border-radius: 14px;
            background: color-mix(in srgb, var(--overlay-bg-shell) 78%, transparent);
            border: 1px solid var(--overlay-border);
            overflow: auto;
          }

          .notes-rich-editor-surface pre code {
            padding: 0;
            border: none;
            background: transparent;
          }

          .notes-rich-editor-surface ul,
          .notes-rich-editor-surface ol {
            padding-left: 1.45rem;
          }

          .notes-rich-editor-surface li {
            margin: 0.22em 0;
          }

          .notes-rich-editor-surface table {
            width: 100%;
            border-collapse: collapse;
          }

          .notes-rich-editor-surface th,
          .notes-rich-editor-surface td {
            min-width: 120px;
            padding: 8px 10px;
            border: 1px solid var(--overlay-border);
            text-align: left;
            vertical-align: top;
          }

          .notes-rich-editor-surface th {
            background: color-mix(in srgb, var(--overlay-bg-card) 85%, transparent);
          }

          .notes-rich-editor-surface a {
            color: ${appearance.theme.palette.accent};
          }

          .notes-rich-editor-surface .ProseMirror-selectednode {
            outline: 2px solid ${appearance.theme.palette.accent};
            outline-offset: 2px;
          }
        `}</style>
        <EditorContent editor={editor} />
        {editor?.isEmpty ? (
          <div
            style={{
              position: 'absolute',
              inset: '26px auto auto 30px',
              color: 'var(--overlay-text-muted)',
              pointerEvents: 'none',
              fontSize: 13,
            }}
          >
            Start with markdown, headings, tables, or a long-form note.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolbarButton({
  appearance,
  active = false,
  disabled = false,
  label,
  onClick,
}: {
  appearance: ResolvedOverlayAppearance;
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <OverlayActionButton
      appearance={appearance}
      tone={active ? 'accent' : 'quiet'}
      size="compact"
      active={active}
      disabled={disabled}
      onClick={onClick}
      style={{
        minWidth: 0,
        paddingInline: 10,
        letterSpacing: '0.04em',
        fontSize: 10,
        textTransform: 'none',
      }}
    >
      {label}
    </OverlayActionButton>
  );
}

function ToolbarDivider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        alignSelf: 'stretch',
        background: 'var(--overlay-border)',
        opacity: 0.7,
      }}
    />
  );
}
