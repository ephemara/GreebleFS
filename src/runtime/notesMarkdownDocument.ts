import { Marked } from 'marked';
import {
  Mark,
  Node,
  getExtensionField,
  mergeAttributes,
  resolveExtensions,
  textblockTypeInputRule,
  wrappingInputRule,
  type AnyExtension,
  type Extensions,
  type JSONContent,
  type MarkdownParseHelpers,
  type MarkdownParseResult,
  type MarkdownRendererHelpers,
  type MarkdownToken,
  type MarkdownTokenizer,
} from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Heading } from '@tiptap/extension-heading';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { Underline } from '@tiptap/extension-underline';
import { Strike } from '@tiptap/extension-strike';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { ListKit } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockquote: {
      toggleBlockquote: () => ReturnType;
    };
    code: {
      toggleCode: () => ReturnType;
    };
    codeBlock: {
      toggleCodeBlock: (attributes?: { language?: string | null }) => ReturnType;
    };
    hardBreak: {
      setHardBreak: () => ReturnType;
    };
  }
}

interface NotesMarkdownExtensionDefinition {
  name: string;
  tokenNames: string[];
  parseMarkdown?: (token: MarkdownToken, helpers: MarkdownParseHelpers) => MarkdownParseResult;
  renderMarkdown?: (node: JSONContent, helpers: MarkdownRendererHelpers, ctx: RenderContext) => string;
  markdownTokenizer?: MarkdownTokenizer;
}

interface RenderContext {
  parentType?: string;
  previousNode?: JSONContent | null;
  nextNode?: JSONContent | null;
  index?: number;
  meta?: Record<string, unknown>;
}

interface MarkdownRenderHelpers extends MarkdownRendererHelpers {
  renderChild: (node: JSONContent, index: number) => string;
  indent: (text: string) => string;
}

const Blockquote = Node.create({
  name: 'blockquote',

  group: 'block',

  content: 'block+',

  defining: true,

  parseHTML() {
    return [{ tag: 'blockquote' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['blockquote', mergeAttributes(HTMLAttributes), 0];
  },

  parseMarkdown: (token, helpers) => {
    if (token.type !== 'blockquote') {
      return [];
    }

    return helpers.createNode(
      'blockquote',
      undefined,
      helpers.parseChildren(token.tokens || []),
    );
  },

  renderMarkdown: (node, helpers, _ctx) => {
    const renderedChildren = helpers.renderChildren(node.content ?? [], '\n\n');

    return renderedChildren
      .split('\n')
      .map((line) => (line.length > 0 ? `> ${line}` : '>'))
      .join('\n');
  },

  addCommands() {
    return {
      toggleBlockquote:
        () =>
        ({ commands }) => commands.toggleWrap(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-b': () => this.editor.commands.toggleBlockquote(),
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^\s*>\s$/,
        type: this.type,
      }),
    ];
  },
});

const Code = Mark.create({
  name: 'code',

  excludes: '_',

  code: true,

  parseHTML() {
    return [{ tag: 'code' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['code', mergeAttributes(HTMLAttributes), 0];
  },

  parseMarkdown: (token, helpers) => {
    if (token.type !== 'codespan') {
      return [];
    }

    return helpers.applyMark(
      'code',
      [helpers.createTextNode(token.text ?? '')],
    );
  },

  renderMarkdown: (node, helpers) => {
    return `\`${helpers.renderChildren(node)}\``;
  },

  addCommands() {
    return {
      toggleCode:
        () =>
        ({ commands }) => commands.toggleMark(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-e': () => this.editor.commands.toggleCode(),
    };
  },
});

const CodeBlock = Node.create({
  name: 'codeBlock',

  group: 'block',

  content: 'text*',

  marks: '',

  code: true,

  defining: true,

  addAttributes() {
    return {
      language: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'pre' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'pre',
      mergeAttributes(HTMLAttributes),
      [
        'code',
        node.attrs.language ? { 'data-language': node.attrs.language } : {},
        0,
      ],
    ];
  },

  parseMarkdown: (token, helpers) => {
    if (token.type !== 'code') {
      return [];
    }

    return helpers.createNode(
      'codeBlock',
      { language: typeof (token as { lang?: unknown }).lang === 'string' ? (token as { lang?: string }).lang ?? null : null },
      token.text ? [helpers.createTextNode(token.text)] : [],
    );
  },

  renderMarkdown: (node) => {
    const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
    const code = Array.isArray(node.content)
      ? node.content
          .map((child) => child.text ?? '')
          .join('')
      : '';

    return `\`\`\`${language}\n${code}\n\`\`\``;
  },

  addCommands() {
    return {
      toggleCodeBlock:
        (attributes) =>
        ({ commands }) => commands.toggleNode(this.name, 'paragraph', attributes),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-c': () => this.editor.commands.toggleCodeBlock(),
    };
  },

  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^```([a-z0-9_-]+)?\s$/i,
        type: this.type,
        getAttributes: (match) => ({
          language: match[1] || null,
        }),
      }),
    ];
  },
});

const HardBreak = Node.create({
  name: 'hardBreak',

  inline: true,

  group: 'inline',

  selectable: false,

  atom: true,

  parseHTML() {
    return [{ tag: 'br' }];
  },

  renderHTML() {
    return ['br'];
  },

  parseMarkdown: (token, helpers) => {
    if (token.type !== 'br') {
      return [];
    }

    return helpers.createNode('hardBreak');
  },

  renderMarkdown: () => {
    return '\\\n';
  },

  addCommands() {
    return {
      setHardBreak:
        () =>
        ({ commands }) => commands.insertContent({ type: this.name }),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Shift-Enter': () => this.editor.commands.setHardBreak(),
    };
  },
});

const Link = Mark.create({
  name: 'link',

  inclusive: false,

  addAttributes() {
    return {
      href: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[href]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(
        { rel: 'noreferrer noopener', target: '_blank' },
        HTMLAttributes,
      ),
      0,
    ];
  },

  parseMarkdown: (token, helpers) => {
    if (token.type !== 'link') {
      return [];
    }

    const content = token.tokens?.length
      ? helpers.parseInline(token.tokens)
      : [helpers.createTextNode(token.text ?? '')];

    return helpers.applyMark(
      'link',
      content,
      {
        href: (token as { href?: string }).href ?? null,
        title: (token as { title?: string | null }).title ?? null,
      },
    );
  },

  renderMarkdown: (node, helpers) => {
    const label = helpers.renderChildren(node);
    const href = typeof node.attrs?.href === 'string' ? node.attrs.href : '';
    const title = typeof node.attrs?.title === 'string' && node.attrs.title.length > 0
      ? ` "${node.attrs.title}"`
      : '';

    return href ? `[${label}](${href}${title})` : label;
  },
});

export const notesMarkdownEditorExtensions: Extensions = [
  Document,
  Paragraph,
  Text,
  Heading.configure({ levels: [1, 2, 3, 4] }),
  Bold,
  Italic,
  Underline,
  Strike,
  Blockquote,
  Code,
  CodeBlock,
  HardBreak,
  Link,
  ListKit.configure({
    taskItem: {
      nested: true,
    },
  }),
  TableKit.configure({
    table: {
      resizable: true,
      renderWrapper: true,
      cellMinWidth: 120,
    },
    tableCell: {},
    tableHeader: {},
    tableRow: {},
  }),
];

export function parseNotesMarkdownToDocument(markdown: string): JSONContent {
  const runtime = getNotesMarkdownRuntime();
  const content = runtime.parseBlockTokens(runtime.marked.lexer(markdown));

  return {
    type: 'doc',
    content: content.length > 0
      ? content
      : [{ type: 'paragraph', content: [] }],
  };
}

export function renderNotesDocumentToMarkdown(document: JSONContent): string {
  const runtime = getNotesMarkdownRuntime();
  return runtime.renderNode(document, {}).replace(/\n{3,}/g, '\n\n').trimEnd();
}

interface NotesMarkdownRuntime {
  marked: Marked;
  definitionsByName: Map<string, NotesMarkdownExtensionDefinition>;
  tokenDefinitionLookup: Map<string, NotesMarkdownExtensionDefinition[]>;
  parseBlockTokens: (tokens: MarkdownToken[]) => JSONContent[];
  renderNode: (node: JSONContent, ctx: RenderContext) => string;
}

let cachedNotesMarkdownRuntime: NotesMarkdownRuntime | null = null;

function getNotesMarkdownRuntime(): NotesMarkdownRuntime {
  if (cachedNotesMarkdownRuntime) {
    return cachedNotesMarkdownRuntime;
  }

  const resolvedExtensions = resolveExtensions(notesMarkdownEditorExtensions);
  const definitions = resolvedExtensions.map(createNotesMarkdownExtensionDefinition);
  const definitionsByName = new Map<string, NotesMarkdownExtensionDefinition>(
    definitions.map((definition: NotesMarkdownExtensionDefinition) => [definition.name, definition] as const),
  );
  const tokenDefinitionLookup = new Map<string, NotesMarkdownExtensionDefinition[]>();

  for (const definition of definitions) {
    for (const tokenName of definition.tokenNames) {
      const currentDefinitions = tokenDefinitionLookup.get(tokenName) ?? [];
      currentDefinitions.push(definition);
      tokenDefinitionLookup.set(tokenName, currentDefinitions);
    }
  }

  const marked = new Marked({
    gfm: true,
    breaks: true,
  });

  const customTokenizers = definitions
    .filter((definition: NotesMarkdownExtensionDefinition) => definition.markdownTokenizer)
    .map((definition: NotesMarkdownExtensionDefinition) => {
      const tokenizer = definition.markdownTokenizer!;

      return {
        name: tokenizer.name,
        level: tokenizer.level,
        start: tokenizer.start,
        tokenizer(this: { lexer: { inlineTokens: (src: string) => MarkdownToken[]; blockTokens: (src: string) => MarkdownToken[] } }, source: string, tokens: MarkdownToken[]) {
          return tokenizer.tokenize(source, tokens, this.lexer);
        },
      };
    });

  if (customTokenizers.length > 0) {
    marked.use({ extensions: customTokenizers as never[] });
  }

  const parseToken = (token: MarkdownToken, mode: 'block' | 'inline'): JSONContent[] => {
    if (token.type === 'space') {
      return [];
    }

    const matchingDefinitions = tokenDefinitionLookup.get(token.type ?? '') ?? [];
    const parseHelpers: MarkdownParseHelpers = {
      parseInline: (tokens) => parseTokens(tokens, 'inline'),
      parseChildren: (tokens) => parseTokens(tokens, 'block'),
      parseBlockChildren: (tokens) => parseTokens(tokens, 'block'),
      createTextNode: (text, marks) => ({
        type: 'text',
        text,
        ...(marks && marks.length > 0 ? { marks } : {}),
      }),
      createNode: (type, attrs, content) => ({
        type,
        ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
        ...(Array.isArray(content) ? { content } : {}),
      }),
      applyMark: (mark, content, attrs) => ({
        mark,
        content,
        ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
      }),
    };

    for (const definition of matchingDefinitions) {
      if (!definition.parseMarkdown) {
        continue;
      }

      const result = normalizeMarkdownParseResult(
        definition.parseMarkdown(token, parseHelpers),
      );

      if (result.length > 0) {
        return result;
      }
    }

    return fallbackParseToken(token, mode, parseHelpers);
  };

  const parseTokens = (tokens: MarkdownToken[], mode: 'block' | 'inline'): JSONContent[] => {
    const content: JSONContent[] = [];

    for (const token of tokens) {
      content.push(...parseToken(token, mode));
    }

    return content;
  };

  const renderNode = (node: JSONContent, ctx: RenderContext): string => {
    if (node.type === 'text') {
      return renderTextNode(node, ctx, definitionsByName, renderNode);
    }

    const definition = definitionsByName.get(node.type || '');
    const helpers = createMarkdownRenderHelpers(node, ctx, renderNode);

    if (definition?.renderMarkdown) {
      return definition.renderMarkdown(node, helpers, ctx);
    }

    if (Array.isArray(node.content)) {
      return helpers.renderChildren(node.content);
    }

    return '';
  };

  cachedNotesMarkdownRuntime = {
    marked,
    definitionsByName,
    tokenDefinitionLookup,
    parseBlockTokens: (tokens) => parseTokens(tokens, 'block'),
    renderNode,
  };

  return cachedNotesMarkdownRuntime as NotesMarkdownRuntime;
}

function createNotesMarkdownExtensionDefinition(extension: AnyExtension): NotesMarkdownExtensionDefinition {
  const context = {
    name: extension.name,
    options: extension.options,
    storage: {},
    editor: null,
    type: null,
  };

  const parseMarkdown = getExtensionField<
    ((token: MarkdownToken, helpers: MarkdownParseHelpers) => MarkdownParseResult) | undefined
  >(extension, 'parseMarkdown', context as never);
  const renderMarkdown = getExtensionField<
    ((node: JSONContent, helpers: MarkdownRendererHelpers, ctx: RenderContext) => string) | undefined
  >(extension, 'renderMarkdown', context as never);
  const markdownTokenizer = getExtensionField<MarkdownTokenizer | undefined>(
    extension,
    'markdownTokenizer',
    context as never,
  );
  const markdownTokenName = getExtensionField<string | undefined>(
    extension,
    'markdownTokenName',
    context as never,
  );

  return {
    name: extension.name,
    tokenNames: [extension.name, markdownTokenName].filter(Boolean) as string[],
    parseMarkdown,
    renderMarkdown,
    markdownTokenizer,
  };
}

function normalizeMarkdownParseResult(result: MarkdownParseResult): JSONContent[] {
  if (Array.isArray(result)) {
    return result.flatMap((entry) => normalizeMarkdownParseResult(entry));
  }

  if ('mark' in result) {
    return (result.content ?? []).map((childNode) => ({
      ...childNode,
      marks: [
        ...(childNode.marks ?? []),
        {
          type: result.mark,
          ...(result.attrs ? { attrs: result.attrs } : {}),
        },
      ],
    }));
  }

  return [result];
}

function fallbackParseToken(
  token: MarkdownToken,
  mode: 'block' | 'inline',
  helpers: MarkdownParseHelpers,
): JSONContent[] {
  const rawText = token.raw ?? token.text ?? '';

  if (mode === 'inline') {
    return [helpers.createTextNode(rawText)];
  }

  if (!rawText.trim()) {
    return [];
  }

  return [
    helpers.createNode('paragraph', undefined, [
      helpers.createTextNode(rawText),
    ]),
  ];
}

function createMarkdownRenderHelpers(
  parentNode: JSONContent,
  parentContext: RenderContext,
  renderNode: (node: JSONContent, ctx: RenderContext) => string,
): MarkdownRenderHelpers {
  const renderChildren = (
    input: JSONContent | JSONContent[] = [],
    separator = '',
  ): string => {
    const childNodes = Array.isArray(input)
      ? input
      : Array.isArray(input.content)
        ? input.content
        : [];

    return childNodes
      .map((childNode, index) =>
        renderNode(childNode, {
          parentType: parentNode.type,
          previousNode: index > 0 ? childNodes[index - 1] : null,
          nextNode: index < childNodes.length - 1 ? childNodes[index + 1] : null,
          index,
          meta: {
            ...parentContext.meta,
            parentAttrs: parentNode.attrs,
          },
        }))
      .join(separator);
  };

  return {
    renderChildren,
    renderChild: (childNode, index) =>
      renderNode(childNode, {
        parentType: parentNode.type,
        previousNode: Array.isArray(parentNode.content) && index > 0
          ? parentNode.content[index - 1]
          : null,
        nextNode: Array.isArray(parentNode.content) && index < (parentNode.content.length - 1)
          ? parentNode.content[index + 1]
          : null,
        index,
        meta: {
          ...parentContext.meta,
          parentAttrs: parentNode.attrs,
        },
      }),
    wrapInBlock: (prefix, content) =>
      content
        .split('\n')
        .map((line) => `${prefix}${line}`)
        .join('\n'),
    indent: (text) =>
      text
        .split('\n')
        .map((line) => (line.length > 0 ? `  ${line}` : '  '))
        .join('\n'),
  };
}

function renderTextNode(
  node: JSONContent,
  ctx: RenderContext,
  definitionsByName: Map<string, NotesMarkdownExtensionDefinition>,
  renderNode: (node: JSONContent, ctx: RenderContext) => string,
): string {
  const baseTextNode: JSONContent = {
    type: 'text',
    text: node.text ?? '',
  };
  const marks = node.marks ?? [];

  if (marks.length === 0) {
    const textDefinition = definitionsByName.get('text');
    return textDefinition?.renderMarkdown
      ? textDefinition.renderMarkdown(baseTextNode, createMarkdownRenderHelpers(baseTextNode, ctx, renderNode), ctx)
      : (node.text ?? '');
  }

  const renderMarkedText = (markIndex: number, currentNode: JSONContent): string => {
    if (markIndex >= marks.length) {
      const textDefinition = definitionsByName.get('text');
      return textDefinition?.renderMarkdown
        ? textDefinition.renderMarkdown(currentNode, createMarkdownRenderHelpers(currentNode, ctx, renderNode), ctx)
        : (currentNode.text ?? '');
    }

    const currentMark = marks[markIndex];
    const markDefinition = definitionsByName.get(currentMark.type);
    const nestedNode: JSONContent = {
      type: currentMark.type,
      ...(currentMark.attrs ? { attrs: currentMark.attrs } : {}),
      content: [{
        ...currentNode,
        marks: marks.slice(markIndex + 1),
      }],
    };
    const helpers = createMarkdownRenderHelpers(nestedNode, ctx, renderNode);

    return markDefinition?.renderMarkdown
      ? markDefinition.renderMarkdown(nestedNode, helpers, ctx)
      : renderMarkedText(markIndex + 1, currentNode);
  };

  return renderMarkedText(0, baseTextNode);
}
