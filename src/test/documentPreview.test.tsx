import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextDocumentPreview, getDocumentPreviewKind, renderDocumentPreviewHtml } from '../components/documentPreview';

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

  it('sanitizes unsafe html attributes from previews', () => {
    render(
      <TextDocumentPreview
        kind="html"
        content={`<h1>Hello</h1><img src="x" onerror="alert(1)" /><button onclick="alert(2)">Click</button>`}
      />,
    );

    expect(screen.getByText('Hello')).toBeInTheDocument();
    const button = screen.getByText('Click');
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveAttribute('onclick');

    const image = screen.getByRole('img');
    expect(image).not.toHaveAttribute('onerror');
  });
});
