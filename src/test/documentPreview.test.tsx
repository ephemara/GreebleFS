import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  TextDocumentPreview,
  getDocumentPreviewKind,
  renderDocumentPreviewHtml,
  renderHtmlDocumentPreviewSrcDoc,
} from '../components/documentPreview';

describe('documentPreview', () => {
  it('detects markdown and html previewable documents', () => {
    expect(getDocumentPreviewKind('notes/readme.md')).toBe('markdown');
    expect(getDocumentPreviewKind('pages/index.html')).toBe('html');
    expect(getDocumentPreviewKind('src/app.ts')).toBe('none');
  });

  it('renders markdown into safe html', () => {
    const html = renderDocumentPreviewHtml('markdown', '# Title\n\n<script>alert(1)</script>\n\n[Docs](https://example.com)');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<a href="https://example.com">Docs</a>');
    expect(html).not.toContain('<script>');
  });

  it('uses explorer theme tokens for markdown preview surfaces', () => {
    const { container } = render(
      <TextDocumentPreview
        kind="markdown"
        content={`# Ship Notes

Inline \`code\`

\`\`\`ts
const value = 1;
\`\`\`

| Name | Value |
| --- | --- |
| Accent | Blue |`}
      />,
    );

    const root = screen.getByTestId('document-preview-root');
    const article = screen.getByTestId('document-preview-article');
    const styleTag = container.querySelector('style');

    expect(root).toHaveAttribute('data-document-preview-kind', 'markdown');
    expect(root).toHaveAttribute('data-native-text-selection-surface', 'true');
    expect(root).toHaveClass('overlay-native-scrollbar');
    expect(root.style.background).toBe('var(--overlay-explorer-preview-bg)');
    expect(root.style.userSelect).toBe('text');
    expect(root.style.cursor).toBe('text');
    expect(article.style.color).toBe('var(--overlay-text-primary)');
    expect(article.style.userSelect).toBe('text');
    expect(styleTag?.textContent).toContain(
      'background: var(--overlay-bg-panel-alt, var(--overlay-bg-panel));',
    );
    expect(styleTag?.textContent).toContain(
      'background: var(--overlay-bg-panel);',
    );
    expect(styleTag?.textContent).toContain(
      'border: 1px solid var(--overlay-border);',
    );
    expect(styleTag?.textContent).toContain(
      'scrollbar-color: var(--overlay-scrollbar-thumb) var(--overlay-scrollbar-track);',
    );
    expect(styleTag?.textContent).not.toContain('#171a22');
    expect(styleTag?.textContent).not.toContain('rgba(8, 12, 18, 0.9)');
    expect(styleTag?.textContent).not.toContain('rgba(255,255,255,0.06)');
  });

  it('builds sandboxed html preview documents with a local asset base', () => {
    const srcDoc = renderHtmlDocumentPreviewSrcDoc(
      `<html><head><style>body { color: red; }</style><script>alert(1)</script></head><body><h1>Hello</h1><img src="./poster.png" onerror="alert(1)" /><button onclick="alert(2)">Click</button></body></html>`,
      'C:\\workspace\\repo\\pages\\index.html',
    );

    expect(srcDoc).toContain('<base href="asset://localhost/');
    expect(srcDoc).toContain('data-greeblefs-scrollbars');
    expect(srcDoc).toContain('<style>body { color: red; }</style>');
    expect(srcDoc).not.toContain('<script>');
    expect(srcDoc).toContain('<img src="./poster.png">');
    expect(srcDoc).toContain('<button>Click</button>');
  });

  it('renders html previews inside an iframe instead of injecting them into the shell dom', () => {
    render(
      <TextDocumentPreview
        kind="html"
        content={`<html><body><h1>Hello</h1></body></html>`}
        sourcePath="C:\\workspace\\repo\\pages\\index.html"
      />,
    );

    expect(screen.queryByText('Hello')).toBeNull();
    const frame = screen.getByTitle('HTML document preview');
    expect(frame).toHaveAttribute('srcdoc');
    expect(frame.getAttribute('srcdoc')).toContain('<base href="asset://localhost/');
  });
});
