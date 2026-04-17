import { convertFileSrc } from '@tauri-apps/api/core';
import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

export type DocumentPreviewKind = 'none' | 'markdown' | 'html';

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function getDocumentPreviewKind(path: string): DocumentPreviewKind {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') {
    return 'markdown';
  }
  if (ext === 'html' || ext === 'htm') {
    return 'html';
  }
  return 'none';
}

export function renderDocumentPreviewHtml(kind: DocumentPreviewKind, content: string): string {
  if (kind === 'none') {
    return '';
  }

  const rendered = kind === 'markdown'
    ? marked.parse(content, { async: false })
    : content;

  if (kind === 'html') {
    return DOMPurify.sanitize(rendered, {
      USE_PROFILES: { html: true },
      WHOLE_DOCUMENT: true,
      FORBID_TAGS: ['script', 'iframe'],
    });
  }

  return DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe'],
    FORBID_ATTR: ['style'],
  });
}

function getDocumentPreviewAssetUrl(filePath: string): string {
  if (typeof window === 'undefined') {
    return filePath;
  }

  try {
    return convertFileSrc(filePath);
  } catch {
    const normalized = filePath.replace(/\\/g, '/');
    return normalized.startsWith('/')
      ? `file://${encodeURI(normalized)}`
      : `file:///${encodeURI(normalized)}`;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderHtmlDocumentPreviewSrcDoc(
  content: string,
  sourcePath?: string,
): string {
  const sanitizedDocument = renderDocumentPreviewHtml('html', content).trim();
  const baseHref = sourcePath ? getDocumentPreviewAssetUrl(sourcePath) : '';
  const headPrefix = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    baseHref ? `<base href="${escapeHtmlAttribute(baseHref)}" />` : '',
  ]
    .filter(Boolean)
    .join('');

  if (/<head(?:\s[^>]*)?>/i.test(sanitizedDocument)) {
    return sanitizedDocument.replace(
      /<head(?:\s[^>]*)?>/i,
      (match) => `${match}${headPrefix}`,
    );
  }

  return `<!doctype html><html><head>${headPrefix}</head><body>${sanitizedDocument}</body></html>`;
}

export function TextDocumentPreview({
  kind,
  content,
  sourcePath,
}: {
  kind: DocumentPreviewKind;
  content: string;
  sourcePath?: string;
}) {
  const htmlDocumentSrcDoc = useMemo(
    () => (kind === 'html' ? renderHtmlDocumentPreviewSrcDoc(content, sourcePath) : ''),
    [content, kind, sourcePath],
  );
  const html = useMemo(() => renderDocumentPreviewHtml(kind, content), [content, kind]);

  if (kind === 'html') {
    return (
      <div
        style={{
          height: '100%',
          background: '#11151d',
        }}
      >
        <iframe
          title="HTML document preview"
          sandbox=""
          srcDoc={htmlDocumentSrcDoc}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#ffffff',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="overlay-scrollbars-none"
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#171a22',
      }}
    >
      <style>{`
        [data-document-preview] h1,
        [data-document-preview] h2,
        [data-document-preview] h3,
        [data-document-preview] h4 {
          margin: 1.2em 0 0.5em;
          line-height: 1.25;
        }
        [data-document-preview] h1 { font-size: 1.9em; }
        [data-document-preview] h2 { font-size: 1.55em; }
        [data-document-preview] h3 { font-size: 1.25em; }
        [data-document-preview] p,
        [data-document-preview] ul,
        [data-document-preview] ol,
        [data-document-preview] blockquote {
          margin: 0.75em 0;
        }
        [data-document-preview] ul,
        [data-document-preview] ol {
          padding-left: 1.35em;
        }
        [data-document-preview] code {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          padding: 0.12em 0.36em;
          font-family: var(--overlay-font-mono, "JetBrains Mono", monospace);
          font-size: 0.95em;
        }
        [data-document-preview] pre {
          background: rgba(8, 12, 18, 0.9);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 14px 16px;
          overflow: auto;
          -ms-overflow-style: none;
          scrollbar-width: none;
          max-width: 100%;
        }
        [data-document-preview] pre::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
        [data-document-preview] pre code {
          background: transparent;
          border: none;
          padding: 0;
        }
        [data-document-preview] blockquote {
          border-left: 3px solid var(--overlay-accent, #7dd3fc);
          padding-left: 12px;
          color: var(--overlay-text-muted);
        }
        [data-document-preview] table {
          width: 100%;
          border-collapse: collapse;
          margin: 1em 0;
        }
        [data-document-preview] th,
        [data-document-preview] td {
          border: 1px solid rgba(255,255,255,0.08);
          padding: 8px 10px;
          text-align: left;
        }
        [data-document-preview] a {
          color: var(--overlay-accent, #7dd3fc);
        }
        [data-document-preview] img {
          max-width: 100%;
          border-radius: 10px;
        }
      `}</style>
      <div
        className="hide-scrollbar"
        style={{
          maxWidth: 920,
          margin: '0 auto',
          padding: '20px 24px 40px',
          color: 'var(--overlay-text-primary)',
          fontFamily: 'var(--overlay-font-ui)',
          lineHeight: 1.7,
          fontSize: 13,
          transition: 'opacity 0.18s ease',
        }}
      >
        <div
          data-document-preview
          style={{
            color: 'var(--overlay-text-primary)',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
