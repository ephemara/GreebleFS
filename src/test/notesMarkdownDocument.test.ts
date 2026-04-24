import { describe, expect, it } from 'vitest';
import {
  parseNotesMarkdownToDocument,
  renderNotesDocumentToMarkdown,
} from '../runtime/notesMarkdownDocument';

describe('notes markdown document runtime', () => {
  it('round-trips the core markdown structures used by the notes panel', () => {
    const markdown = [
      '# Launch Pad',
      '',
      'This has **bold**, *italic*, ++underline++, ~~strike~~, `inline code`, and a [link](https://greeblefs.dev).',
      '',
      '> Pull references into one folder-first notebook.',
      '',
      '- alpha',
      '- beta',
      '',
      '- [x] shipped',
      '- [ ] next',
      '',
      '```ts',
      'const ready = true',
      '```',
      '',
      '| Name | Status |',
      '| --- | --- |',
      '| GreebleFS | active |',
    ].join('\n');

    const document = parseNotesMarkdownToDocument(markdown);
    const renderedMarkdown = renderNotesDocumentToMarkdown(document);

    expect(renderedMarkdown).toContain('# Launch Pad');
    expect(renderedMarkdown).toContain('**bold**');
    expect(renderedMarkdown).toContain('++underline++');
    expect(renderedMarkdown).toContain('[link](https://greeblefs.dev)');
    expect(renderedMarkdown).toContain('> Pull references into one folder-first notebook.');
    expect(renderedMarkdown).toContain('- [x] shipped');
    expect(renderedMarkdown).toContain('```ts');
    expect(renderedMarkdown).toMatch(/\|\s*Name\s*\|\s*Status\s*\|/);
  });
});
