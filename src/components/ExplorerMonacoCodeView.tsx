import type { EditorProps } from '@monaco-editor/react';
import React, { Suspense, useCallback, useEffect, useRef } from 'react';

import {
  applyExplorerMonacoTheme,
  resolveExplorerMonacoThemeId,
  type ExplorerMonacoEditorOptions,
} from '../config/explorerMonaco';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  clampSearchFocusLine,
  findSearchFocusColumns,
  type EditorSearchFocusTarget,
} from './fileExplorerSearchFocus';

const LazyMonacoEditor = React.lazy(async () => {
  const module = await import('@monaco-editor/react');
  return { default: module.default as React.ComponentType<EditorProps> };
});

const MONACO_FIND_WITH_ARGS_ACTION = 'editor.actions.findWithArgs';

export interface ExplorerMonacoCursorPosition {
  lineNumber: number;
  column: number;
}

function applyEditorSearchFocus(
  editor: any,
  monaco: any,
  focusTarget: EditorSearchFocusTarget | null,
) {
  editor.layout?.();

  if (!focusTarget) {
    return;
  }

  const model = editor.getModel?.();
  if (!model) {
    return;
  }

  const lineNumber = clampSearchFocusLine(
    focusTarget.lineNumber,
    model.getLineCount(),
  );
  const lineContent = model.getLineContent(lineNumber);
  const { startColumn, endColumn } = findSearchFocusColumns(
    lineContent,
    focusTarget.searchString,
  );

  if (focusTarget.searchString) {
    const range = new monaco.Range(
      lineNumber,
      startColumn,
      lineNumber,
      endColumn,
    );
    editor.setSelection?.(range);
    editor.revealRangeInCenter?.(range);
    editor.focus?.();
    void editor.getAction?.(MONACO_FIND_WITH_ARGS_ACTION)?.run({
      searchString: focusTarget.searchString,
      isRegex: false,
      matchWholeWord: false,
      isCaseSensitive: false,
      findInSelection: false,
    });
    return;
  }

  editor.setPosition?.({ lineNumber, column: 1 });
  editor.revealLineInCenter?.(lineNumber);
  editor.focus?.();
}

function EditorFallback({ label }: { label: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--overlay-explorer-code-bg)',
        color: 'var(--overlay-text-muted)',
        fontSize: 11,
      }}
    >
      {label}
    </div>
  );
}

export function ExplorerMonacoCodeView({
  appearance,
  path,
  value,
  language,
  focusTarget,
  onChange,
  onCursorPositionChange,
  options,
}: {
  appearance?: ResolvedOverlayAppearance;
  path: string;
  value: string;
  language: string;
  focusTarget: EditorSearchFocusTarget | null;
  onChange?: (value: string) => void;
  onCursorPositionChange?: (position: ExplorerMonacoCursorPosition) => void;
  options: ExplorerMonacoEditorOptions;
}) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const cursorListenerRef = useRef<{ dispose(): void } | null>(null);
  const monacoThemeId = resolveExplorerMonacoThemeId(appearance);

  const publishCursorPosition = useCallback(
    (editor: any) => {
      const position = editor.getPosition?.();
      if (!position) {
        return;
      }
      onCursorPositionChange?.({
        lineNumber: position.lineNumber,
        column: position.column,
      });
    },
    [onCursorPositionChange],
  );

  const handleMount = useCallback(
    (editor: any, monaco: any) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      applyExplorerMonacoTheme(monaco, appearance);
      cursorListenerRef.current?.dispose?.();
      cursorListenerRef.current =
        editor.onDidChangeCursorPosition?.(
          (event: { position: ExplorerMonacoCursorPosition }) => {
            onCursorPositionChange?.({
              lineNumber: event.position.lineNumber,
              column: event.position.column,
            });
          },
        ) ?? null;
      publishCursorPosition(editor);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          editor.layout?.();
          applyEditorSearchFocus(editor, monaco, focusTarget);
          publishCursorPosition(editor);
        });
      });
    },
    [appearance, focusTarget, onCursorPositionChange, publishCursorPosition],
  );

  const handleBeforeMount = useCallback(
    (monaco: any) => {
      applyExplorerMonacoTheme(monaco, appearance);
    },
    [appearance],
  );

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) {
      return;
    }

    applyExplorerMonacoTheme(monacoRef.current, appearance);
    const frame = window.requestAnimationFrame(() => {
      applyEditorSearchFocus(editorRef.current, monacoRef.current, focusTarget);
      publishCursorPosition(editorRef.current);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [appearance, focusTarget?.requestId, path, publishCursorPosition, value]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }
    publishCursorPosition(editorRef.current);
  }, [path, publishCursorPosition, value]);

  useEffect(
    () => () => {
      cursorListenerRef.current?.dispose?.();
      cursorListenerRef.current = null;
    },
    [],
  );

  return (
    <Suspense fallback={<EditorFallback label="Loading editor..." />}>
      <LazyMonacoEditor
        path={path}
        height="100%"
        language={language || 'plaintext'}
        value={value}
        theme={monacoThemeId}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        saveViewState
        onChange={onChange ? (nextValue) => onChange(nextValue ?? '') : undefined}
        options={options}
      />
    </Suspense>
  );
}
