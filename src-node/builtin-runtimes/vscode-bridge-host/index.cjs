'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const Module = require('node:module');

const ACTIONS = {
  activateExtension: 'vscode.activateExtension',
  executeCommand: 'vscode.executeCommand',
  getTreeView: 'vscode.getTreeView',
  refreshTreeView: 'vscode.refreshTreeView',
  listLoadedExtensions: 'vscode.listLoadedExtensions',
};

const TreeItemCollapsibleState = Object.freeze({
  None: 0,
  Collapsed: 1,
  Expanded: 2,
});

let packetCounter = 0;
let loadingExtension = null;

const pendingHostCalls = new Map();
const extensions = new Map();
const commands = new Map();
const treeProviders = new Map();
const outputChannels = new Map();

function nextRequestId(prefix) {
  packetCounter += 1;
  return `vscode-bridge-${prefix}-${packetCounter}`;
}

function writePacket(packet) {
  process.stdout.write(`${JSON.stringify(packet)}\n`);
}

function parseJson(value, fallback = null) {
  if (value == null || value === '') {
    return fallback;
  }
  return JSON.parse(value);
}

function stringifyPayload(payload) {
  if (payload === undefined) {
    return null;
  }
  return JSON.stringify(payload);
}

function resolvePackageMain(extensionRootPath, manifest) {
  const main = typeof manifest.main === 'string' && manifest.main.trim()
    ? manifest.main.trim()
    : './extension';
  const candidate = path.resolve(extensionRootPath, main);
  const candidates = [
    candidate,
    `${candidate}.js`,
    `${candidate}.cjs`,
    path.join(candidate, 'index.js'),
    path.join(candidate, 'index.cjs'),
  ];
  const found = candidates.find((entry) => fs.existsSync(entry));
  if (!found) {
    throw new Error(`Extension main entry was not found: ${candidate}`);
  }
  return found;
}

function normalizeExtensionRecord(payload) {
  const extensionId = String(payload.extensionId || '').trim();
  const extensionRootPath = String(payload.extensionRootPath || '').trim();
  const packageJsonPath = String(payload.packageJsonPath || '').trim();
  if (!extensionId || !extensionRootPath || !packageJsonPath) {
    throw new Error('VS Code bridge extension payload requires extensionId, extensionRootPath, and packageJsonPath.');
  }
  const manifest = payload.manifest && typeof payload.manifest === 'object'
    ? payload.manifest
    : JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return {
    extensionId,
    extensionRootPath,
    packageJsonPath,
    manifest,
    activationEvents: Array.isArray(manifest.activationEvents) ? manifest.activationEvents : [],
    activated: false,
    activating: null,
    exports: null,
    context: null,
    errors: [],
  };
}

function getOrCreateExtension(payload) {
  const normalized = normalizeExtensionRecord(payload);
  const existing = extensions.get(normalized.extensionId);
  if (existing) {
    existing.extensionRootPath = normalized.extensionRootPath;
    existing.packageJsonPath = normalized.packageJsonPath;
    existing.manifest = normalized.manifest;
    existing.activationEvents = normalized.activationEvents;
    return existing;
  }
  extensions.set(normalized.extensionId, normalized);
  return normalized;
}

function commandActivationEvent(commandId) {
  return `onCommand:${commandId}`;
}

function viewActivationEvent(viewId) {
  return `onView:${viewId}`;
}

function shouldActivateFor(extension, activationEvent) {
  if (extension.activated) {
    return false;
  }
  const events = extension.activationEvents;
  if (events.includes('*') || events.includes('onStartupFinished')) {
    return true;
  }
  return Boolean(activationEvent && events.includes(activationEvent));
}

function makeDisposable(dispose) {
  return {
    dispose: typeof dispose === 'function' ? dispose : () => undefined,
  };
}

class EventEmitter {
  constructor() {
    this.listeners = new Set();
    this.event = (listener) => {
      if (typeof listener !== 'function') {
        return makeDisposable();
      }
      this.listeners.add(listener);
      return makeDisposable(() => this.listeners.delete(listener));
    };
  }

  fire(value) {
    for (const listener of [...this.listeners]) {
      try {
        listener(value);
      } catch (error) {
        publishOutput('vscode-bridge', `event listener failed: ${String(error)}`);
      }
    }
  }

  dispose() {
    this.listeners.clear();
  }
}

class Disposable {
  constructor(callback) {
    this.callback = callback;
  }

  dispose() {
    if (this.callback) {
      const callback = this.callback;
      this.callback = null;
      callback();
    }
  }

  static from(...items) {
    return makeDisposable(() => {
      for (const item of items) {
        item?.dispose?.();
      }
    });
  }
}

class Uri {
  constructor(scheme, authority, uriPath, query = '', fragment = '') {
    this.scheme = scheme;
    this.authority = authority;
    this.path = uriPath;
    this.query = query;
    this.fragment = fragment;
    this.fsPath = scheme === 'file' ? uriPath : uriPath;
  }

  toString() {
    if (this.scheme === 'file') {
      return `file://${this.fsPath.replace(/\\/g, '/')}`;
    }
    return `${this.scheme}:${this.path}`;
  }

  with(change) {
    return new Uri(
      change.scheme ?? this.scheme,
      change.authority ?? this.authority,
      change.path ?? this.path,
      change.query ?? this.query,
      change.fragment ?? this.fragment,
    );
  }

  static file(fsPath) {
    return new Uri('file', '', String(fsPath || ''), '', '');
  }

  static parse(value) {
    const raw = String(value || '');
    if (raw.startsWith('file://')) {
      return Uri.file(raw.replace(/^file:\/\//, ''));
    }
    const match = raw.match(/^([A-Za-z][A-Za-z0-9+.-]*):(.*)$/);
    if (!match) {
      return Uri.file(raw);
    }
    return new Uri(match[1], '', match[2], '', '');
  }
}

class ThemeIcon {
  constructor(id, color) {
    this.id = id;
    this.color = color;
  }
}

class TreeItem {
  constructor(label, collapsibleState = TreeItemCollapsibleState.None) {
    if (label instanceof Uri) {
      this.resourceUri = label;
      this.label = path.basename(label.fsPath || label.path || label.toString());
    } else {
      this.label = label;
    }
    this.collapsibleState = collapsibleState;
  }
}

class Position {
  constructor(line, character) {
    this.line = Number.isFinite(line) ? Number(line) : 0;
    this.character = Number.isFinite(character) ? Number(character) : 0;
  }
}

class Range {
  constructor(startOrStartLine, startOrStartCharacter, endLine, endCharacter) {
    const looksLikePositionPair =
      startOrStartLine && typeof startOrStartLine === 'object'
      && startOrStartCharacter && typeof startOrStartCharacter === 'object'
      && Number.isFinite(startOrStartLine.line)
      && Number.isFinite(startOrStartLine.character)
      && Number.isFinite(startOrStartCharacter.line)
      && Number.isFinite(startOrStartCharacter.character);
    if (looksLikePositionPair) {
      this.start = startOrStartLine instanceof Position
        ? startOrStartLine
        : new Position(startOrStartLine.line, startOrStartLine.character);
      this.end = startOrStartCharacter instanceof Position
        ? startOrStartCharacter
        : new Position(startOrStartCharacter.line, startOrStartCharacter.character);
      return;
    }
    this.start = new Position(startOrStartLine, startOrStartCharacter);
    this.end = new Position(endLine, endCharacter);
  }
}

class Selection extends Range {
  constructor(anchorOrStart, activeOrEnd, endLine, endCharacter) {
    const looksLikePositionPair =
      anchorOrStart && typeof anchorOrStart === 'object'
      && activeOrEnd && typeof activeOrEnd === 'object'
      && Number.isFinite(anchorOrStart.line)
      && Number.isFinite(anchorOrStart.character)
      && Number.isFinite(activeOrEnd.line)
      && Number.isFinite(activeOrEnd.character);
    if (looksLikePositionPair) {
      const anchor = anchorOrStart instanceof Position
        ? anchorOrStart
        : new Position(anchorOrStart.line, anchorOrStart.character);
      const active = activeOrEnd instanceof Position
        ? activeOrEnd
        : new Position(activeOrEnd.line, activeOrEnd.character);
      super(anchor, active);
      this.anchor = anchor;
      this.active = active;
      return;
    }
    const anchor = new Position(anchorOrStart, activeOrEnd);
    const active = new Position(endLine, endCharacter);
    super(anchor, active);
    this.anchor = anchor;
    this.active = active;
  }
}

class MarkdownString {
  constructor(value = '', isTrusted = false) {
    this.value = String(value);
    this.isTrusted = Boolean(isTrusted);
  }

  toString() {
    return this.value;
  }
}

class FileSystemError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'FileSystemError';
    this.code = code;
  }

  static FileNotFound(message = 'File not found') {
    return new FileSystemError(message, 'FileNotFound');
  }

  static FileIsADirectory(message = 'File is a directory') {
    return new FileSystemError(message, 'FileIsADirectory');
  }

  static FileExists(message = 'File already exists') {
    return new FileSystemError(message, 'FileExists');
  }

  static NoPermissions(message = 'Insufficient permissions') {
    return new FileSystemError(message, 'NoPermissions');
  }
}

function createBridgeRuntimeState() {
  return {
    currentExecutionContext: null,
    textDocumentContentProviders: new Map(),
    fileSystemProviders: new Map(),
    workspaceFolders: [],
    textDocuments: [],
    activeTextEditor: null,
    visibleTextEditors: [],
    contextValues: new Map(),
    emitters: {
      didChangeActiveTextEditor: new EventEmitter(),
      didChangeVisibleTextEditors: new EventEmitter(),
      didChangeTextDocument: new EventEmitter(),
      didOpenTextDocument: new EventEmitter(),
      didCloseTextDocument: new EventEmitter(),
      didChangeConfiguration: new EventEmitter(),
      didChangeWorkspaceFolders: new EventEmitter(),
    },
  };
}

const bridgeRuntimeState = createBridgeRuntimeState();

function serializeValue(value) {
  if (value instanceof Uri) {
    return {
      $type: 'Uri',
      scheme: value.scheme,
      authority: value.authority,
      path: value.path,
      fsPath: value.fsPath,
      query: value.query,
      fragment: value.fragment,
    };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { $type: 'Uint8Array', data: Array.from(value) };
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry !== 'function') {
        out[key] = serializeValue(entry);
      }
    }
    return out;
  }
  return value;
}

function deserializeValue(value) {
  if (Array.isArray(value)) {
    return value.map(deserializeValue);
  }
  if (value && typeof value === 'object') {
    if (value.$type === 'Uri') {
      return value.scheme === 'file'
        ? Uri.file(value.fsPath || value.path || '')
        : new Uri(
            value.scheme || 'file',
            value.authority || '',
            value.path || value.fsPath || '',
            value.query || '',
            value.fragment || '',
          );
    }
    if (value.$type === 'Uint8Array' && Array.isArray(value.data)) {
      return Uint8Array.from(value.data);
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, deserializeValue(entry)]));
  }
  return value;
}

function normalizePositionLike(value) {
  if (value instanceof Position) {
    return value;
  }
  return new Position(value?.line ?? 0, value?.character ?? 0);
}

function normalizeRangeLike(value) {
  if (value instanceof Range) {
    return value;
  }
  return new Range(
    normalizePositionLike(value?.start),
    normalizePositionLike(value?.end),
  );
}

function lineOffsetsForText(text) {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

function positionAtOffset(text, offset) {
  const clampedOffset = Math.max(0, Math.min(Number(offset) || 0, text.length));
  const offsets = lineOffsetsForText(text);
  let low = 0;
  let high = offsets.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const lineOffset = offsets[middle];
    const nextOffset = middle + 1 < offsets.length ? offsets[middle + 1] : text.length + 1;
    if (clampedOffset < lineOffset) {
      high = middle - 1;
    } else if (clampedOffset >= nextOffset) {
      low = middle + 1;
    } else {
      return new Position(middle, clampedOffset - lineOffset);
    }
  }
  const line = Math.max(0, offsets.length - 1);
  return new Position(line, clampedOffset - offsets[line]);
}

function offsetAtPosition(text, positionLike) {
  const position = normalizePositionLike(positionLike);
  const offsets = lineOffsetsForText(text);
  const line = Math.max(0, Math.min(position.line, offsets.length - 1));
  const lineOffset = offsets[line];
  const nextOffset = line + 1 < offsets.length ? offsets[line + 1] : text.length + 1;
  return Math.max(lineOffset, Math.min(lineOffset + position.character, nextOffset - 1));
}

function uriIdentity(uri) {
  if (!(uri instanceof Uri)) {
    return String(uri || '');
  }
  return `${uri.scheme}:${uri.fsPath || uri.path || uri.toString()}`;
}

function findOpenDocumentByUri(uri) {
  const key = uriIdentity(uri);
  return bridgeRuntimeState.textDocuments.find((document) => uriIdentity(document.uri) === key) || null;
}

function isTextDocumentLike(value) {
  return Boolean(value)
    && typeof value === 'object'
    && value.uri instanceof Uri
    && typeof value.getText === 'function';
}

function removeOpenDocumentByUri(uri) {
  const key = uriIdentity(uri);
  bridgeRuntimeState.textDocuments = bridgeRuntimeState.textDocuments.filter(
    (document) => uriIdentity(document.uri) !== key,
  );
}

function inferLanguageId(filePath, executionContext) {
  const activeLanguageId = executionContext?.activeFileType?.languageId;
  if (typeof activeLanguageId === 'string' && activeLanguageId.trim()) {
    return activeLanguageId.trim();
  }
  const lowerPath = String(filePath || '').toLowerCase();
  const extension = path.extname(lowerPath);
  switch (extension) {
    case '.json':
      return 'json';
    case '.jsonc':
      return 'jsonc';
    case '.md':
      return 'markdown';
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'typescriptreact';
    case '.js':
      return 'javascript';
    case '.jsx':
      return 'javascriptreact';
    case '.html':
      return 'html';
    case '.css':
      return 'css';
    case '.yml':
    case '.yaml':
      return 'yaml';
    case '.toml':
      return 'toml';
    default:
      return 'plaintext';
  }
}

function createWorkspaceFolder(pathValue, index = 0) {
  const normalizedPath = String(pathValue || '').trim();
  if (!normalizedPath) {
    return null;
  }
  return {
    uri: Uri.file(normalizedPath),
    name: path.basename(normalizedPath) || normalizedPath,
    index,
  };
}

function resolveWorkspaceFoldersFromExecutionContext(executionContext) {
  const nextFolders = [];
  if (Array.isArray(executionContext?.roots)) {
    executionContext.roots.forEach((root, index) => {
      const folder = createWorkspaceFolder(root?.path, index);
      if (folder) {
        nextFolders.push(folder);
      }
    });
  }
  if (nextFolders.length > 0) {
    return nextFolders;
  }
  const fallbackPath = executionContext?.repoContext?.rootPath
    || executionContext?.cwd
    || executionContext?.activeDirectory
    || null;
  const fallbackFolder = createWorkspaceFolder(fallbackPath, 0);
  return fallbackFolder ? [fallbackFolder] : [];
}

function setWorkspaceFolders(nextFolders) {
  const previousKeys = new Set(
    bridgeRuntimeState.workspaceFolders?.map((folder) => uriIdentity(folder.uri)) || [],
  );
  const nextKeys = new Set(nextFolders.map((folder) => uriIdentity(folder.uri)));
  bridgeRuntimeState.workspaceFolders = nextFolders;
  const changed = previousKeys.size !== nextKeys.size
    || [...previousKeys].some((entry) => !nextKeys.has(entry));
  if (changed) {
    bridgeRuntimeState.emitters.didChangeWorkspaceFolders.fire({
      added: nextFolders,
      removed: [],
    });
  }
}

function documentTargetFromExecutionContext(executionContext) {
  const previewPath = executionContext?.previewSession?.resolvedPath
    || executionContext?.previewSession?.filePath
    || null;
  if (previewPath) {
    return {
      uri: Uri.file(previewPath),
      languageId: inferLanguageId(previewPath, executionContext),
    };
  }
  const focusedEntry = executionContext?.focusedEntry;
  if (focusedEntry && !focusedEntry.isDirectory && focusedEntry.path) {
    return {
      uri: Uri.file(focusedEntry.path),
      languageId: inferLanguageId(focusedEntry.path, executionContext),
    };
  }
  const selectedEntry = Array.isArray(executionContext?.selectedEntries)
    ? executionContext.selectedEntries.find((entry) => entry && !entry.isDirectory && entry.path)
    : null;
  if (selectedEntry?.path) {
    return {
      uri: Uri.file(selectedEntry.path),
      languageId: inferLanguageId(selectedEntry.path, executionContext),
    };
  }
  return null;
}

async function loadFileDocumentText(uri) {
  const filePath = toFsPath(uri);
  try {
    const fromHost = await hostCall('files.read_text', { path: filePath });
    return String(fromHost ?? '');
  } catch (hostError) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (fsError) {
      throw hostError || fsError;
    }
  }
}

function createTextDocument(options) {
  const uri = options.uri instanceof Uri ? options.uri : Uri.parse(options.uri);
  let textValue = String(options.text ?? '');
  let version = 1;
  let dirty = false;
  const document = {
    uri,
    fileName: uri.fsPath || uri.path || uri.toString(),
    languageId: String(options.languageId || 'plaintext'),
    get version() {
      return version;
    },
    get isDirty() {
      return dirty;
    },
    get isClosed() {
      return false;
    },
    get lineCount() {
      return lineOffsetsForText(textValue).length;
    },
    getText(range) {
      if (!range) {
        return textValue;
      }
      const normalizedRange = normalizeRangeLike(range);
      const startOffset = offsetAtPosition(textValue, normalizedRange.start);
      const endOffset = offsetAtPosition(textValue, normalizedRange.end);
      return textValue.slice(startOffset, endOffset);
    },
    positionAt(offset) {
      return positionAtOffset(textValue, offset);
    },
    offsetAt(position) {
      return offsetAtPosition(textValue, position);
    },
    save: async () => {
      if (typeof options.save === 'function') {
        await options.save(textValue);
        dirty = false;
      }
      return true;
    },
    _applyEdits(edits) {
      const sortedEdits = [...edits].sort((left, right) => right.startOffset - left.startOffset);
      for (const edit of sortedEdits) {
        textValue = `${textValue.slice(0, edit.startOffset)}${edit.text}${textValue.slice(edit.endOffset)}`;
      }
      version += 1;
      dirty = true;
      return textValue;
    },
  };
  return document;
}

function createTextEditor(document) {
  let selection = new Selection(document.positionAt(0), document.positionAt(0));
  return {
    document,
    get selection() {
      return selection;
    },
    set selection(value) {
      selection = value instanceof Selection
        ? value
        : new Selection(value?.anchor ?? value?.start, value?.active ?? value?.end);
    },
    get selections() {
      return [selection];
    },
    set selections(values) {
      if (Array.isArray(values) && values[0]) {
        this.selection = values[0];
      }
    },
    edit: async (callback) => {
      const pendingEdits = [];
      const builder = {
        replace(rangeLike, nextText) {
          const range = normalizeRangeLike(rangeLike);
          pendingEdits.push({
            range,
            startOffset: document.offsetAt(range.start),
            endOffset: document.offsetAt(range.end),
            text: String(nextText ?? ''),
          });
        },
      };
      await Promise.resolve(callback(builder));
      if (pendingEdits.length === 0) {
        return true;
      }
      document._applyEdits(pendingEdits);
      await document.save();
      bridgeRuntimeState.emitters.didChangeTextDocument.fire({
        document,
        contentChanges: pendingEdits.map((edit) => ({
          range: edit.range,
          rangeOffset: edit.startOffset,
          rangeLength: edit.endOffset - edit.startOffset,
          text: edit.text,
        })),
      });
      return true;
    },
    revealRange: () => undefined,
  };
}

async function openTextDocument(resource, options = {}) {
  if (isTextDocumentLike(resource)) {
    return resource;
  }
  const uri = resource instanceof Uri ? resource : Uri.parse(resource);
  const existingDocument = findOpenDocumentByUri(uri);
  if (existingDocument) {
    return existingDocument;
  }
  let text = '';
  let saveHandler = null;
  if (uri.scheme === 'file') {
    text = await loadFileDocumentText(uri);
    saveHandler = async (nextText) => {
      const filePath = toFsPath(uri);
      try {
        await hostCall('files.write_text', {
          path: filePath,
          content: nextText,
        });
      } catch (_hostError) {
        fs.writeFileSync(filePath, nextText, 'utf8');
      }
    };
  } else if (bridgeRuntimeState.textDocumentContentProviders.has(uri.scheme)) {
    const provider = bridgeRuntimeState.textDocumentContentProviders.get(uri.scheme);
    text = await Promise.resolve(
      provider.provideTextDocumentContent(uri, { isCancellationRequested: false }),
    );
  }
  const document = createTextDocument({
    uri,
    text,
    languageId: options.languageId || inferLanguageId(uri.fsPath || uri.path, bridgeRuntimeState.currentExecutionContext),
    save: saveHandler,
  });
  bridgeRuntimeState.textDocuments = [...bridgeRuntimeState.textDocuments, document];
  bridgeRuntimeState.emitters.didOpenTextDocument.fire(document);
  return document;
}

async function showTextDocument(target, options = {}) {
  const document = isTextDocumentLike(target)
    ? target
    : target && target.document
      ? target.document
      : await openTextDocument(target, options);
  const currentEditor = bridgeRuntimeState.activeTextEditor;
  if (currentEditor?.document && uriIdentity(currentEditor.document.uri) === uriIdentity(document.uri)) {
    return currentEditor;
  }
  const editor = createTextEditor(document);
  bridgeRuntimeState.activeTextEditor = editor;
  bridgeRuntimeState.visibleTextEditors = [editor];
  bridgeRuntimeState.emitters.didChangeActiveTextEditor.fire(editor);
  bridgeRuntimeState.emitters.didChangeVisibleTextEditors.fire([editor]);
  return editor;
}

async function applyExecutionContextPacket(packet) {
  const executionContext = parseJson(packet.executionContextJson, null);
  if (!executionContext || typeof executionContext !== 'object') {
    return;
  }
  bridgeRuntimeState.currentExecutionContext = executionContext;
  setWorkspaceFolders(resolveWorkspaceFoldersFromExecutionContext(executionContext));
  const target = documentTargetFromExecutionContext(executionContext);
  if (!target) {
    return;
  }
  try {
    await showTextDocument(target.uri, { languageId: target.languageId });
  } catch (error) {
    publishOutput(
      'vscode-bridge',
      `execution context document hydrate failed: ${String(error && error.stack ? error.stack : error)}`,
    );
  }
}

async function hostCall(methodId, payload) {
  const requestId = nextRequestId('host-call');
  const promise = new Promise((resolve, reject) => {
    pendingHostCalls.set(requestId, { resolve, reject });
  });
  writePacket({
    requestId,
    kind: 'host-call',
    methodId,
    payloadJson: stringifyPayload(payload),
  });
  return promise;
}

async function publishEvent(topic, payload) {
  const requestId = nextRequestId('publish');
  writePacket({
    requestId,
    kind: 'publish',
    payloadJson: stringifyPayload({
      topic,
      payloadJson: stringifyPayload(payload),
    }),
  });
}

function publishOutput(channel, value) {
  void publishEvent('ext.vscode-bridge-host.output', {
    channel,
    value: String(value),
    emittedAt: Date.now(),
  });
}

function publishTreeChanged(extensionId, viewId) {
  void publishEvent('ext.vscode-bridge-host.tree.changed', {
    extensionId,
    viewId,
    emittedAt: Date.now(),
  });
}

function createMemento() {
  const store = new Map();
  return {
    get: (key, fallback) => store.has(key) ? store.get(key) : fallback,
    update: async (key, value) => {
      if (value === undefined) {
        store.delete(key);
      } else {
        store.set(key, value);
      }
    },
    keys: () => [...store.keys()],
  };
}

function createExtensionContext(extension) {
  const subscriptions = [];
  return {
    subscriptions,
    extensionPath: extension.extensionRootPath,
    extensionUri: Uri.file(extension.extensionRootPath),
    globalStorageUri: Uri.file(path.join(extension.extensionRootPath, '.greeblefs-vscode-global')),
    logUri: Uri.file(path.join(extension.extensionRootPath, '.greeblefs-vscode-log')),
    storageUri: Uri.file(path.join(extension.extensionRootPath, '.greeblefs-vscode-storage')),
    workspaceState: createMemento(),
    globalState: createMemento(),
    secrets: {
      get: async () => undefined,
      store: async () => undefined,
      delete: async () => undefined,
      onDidChange: new EventEmitter().event,
    },
    asAbsolutePath: (relativePath) => path.resolve(extension.extensionRootPath, relativePath),
    extension: {
      id: extension.extensionId,
      extensionPath: extension.extensionRootPath,
      extensionUri: Uri.file(extension.extensionRootPath),
      packageJSON: extension.manifest,
      isActive: true,
      exports: undefined,
    },
  };
}

function createOutputChannel(name) {
  const id = String(name || 'output');
  const channel = {
    name: id,
    append: (value) => publishOutput(id, value),
    appendLine: (value) => publishOutput(id, `${value}\n`),
    clear: () => publishOutput(id, '[clear]'),
    show: () => publishOutput(id, '[show]'),
    hide: () => undefined,
    dispose: () => outputChannels.delete(id),
  };
  outputChannels.set(id, channel);
  return channel;
}

function normalizeTreeLabel(label) {
  if (label instanceof Uri) {
    return path.basename(label.fsPath || label.path || label.toString());
  }
  if (typeof label === 'string') {
    return label;
  }
  if (label && typeof label === 'object') {
    return String(label.label || label.name || '');
  }
  return String(label ?? '');
}

function normalizeTreeIcon(iconPath) {
  if (!iconPath) {
    return null;
  }
  if (iconPath instanceof ThemeIcon) {
    return { kind: 'theme-icon', id: iconPath.id };
  }
  if (iconPath instanceof Uri) {
    return { kind: 'uri', path: iconPath.fsPath || iconPath.path };
  }
  if (typeof iconPath === 'string') {
    return { kind: 'path', path: iconPath };
  }
  if (iconPath && typeof iconPath === 'object') {
    const light = iconPath.light instanceof Uri ? iconPath.light.fsPath : iconPath.light;
    const dark = iconPath.dark instanceof Uri ? iconPath.dark.fsPath : iconPath.dark;
    return { kind: 'themed-path', light, dark };
  }
  return null;
}

function normalizeTreeItem(viewRecord, element, treeItem) {
  const item = treeItem || element || {};
  viewRecord.handleCounter += 1;
  const handle = `${viewRecord.viewId}:${viewRecord.handleCounter}`;
  viewRecord.handles.set(handle, element);
  const resourceUri = item.resourceUri instanceof Uri
    ? item.resourceUri
    : (element?.resourceUri instanceof Uri ? element.resourceUri : null);
  const command = item.command && typeof item.command === 'object'
    ? {
        command: String(item.command.command || ''),
        title: String(item.command.title || item.command.command || ''),
        arguments: serializeValue(item.command.arguments || []),
      }
    : null;
  return {
    id: String(item.id || handle),
    handle,
    label: normalizeTreeLabel(item.label || resourceUri || element?.label || element?.resource || ''),
    description: item.description != null ? String(item.description) : null,
    tooltip: item.tooltip != null ? String(item.tooltip.value || item.tooltip) : null,
    icon: normalizeTreeIcon(item.iconPath || item.icon),
    collapsibleState: Number.isFinite(item.collapsibleState)
      ? Number(item.collapsibleState)
      : TreeItemCollapsibleState.None,
    command,
    contextValue: item.contextValue != null ? String(item.contextValue) : null,
  };
}

async function resolveTreeItems(extensionId, viewId, parentHandle) {
  const key = `${extensionId}:${viewId}`;
  const viewRecord = treeProviders.get(key);
  if (!viewRecord) {
    return { extensionId, viewId, items: [], missingProvider: true };
  }
  const parent = parentHandle ? viewRecord.handles.get(parentHandle) : undefined;
  if (!parentHandle) {
    viewRecord.handles.clear();
    viewRecord.handleCounter = 0;
  }
  const provider = viewRecord.provider;
  const children = await Promise.resolve(provider.getChildren ? provider.getChildren(parent) : []);
  const entries = Array.isArray(children) ? children : [];
  const items = [];
  for (const element of entries) {
    const treeItem = await Promise.resolve(provider.getTreeItem ? provider.getTreeItem(element) : element);
    items.push(normalizeTreeItem(viewRecord, element, treeItem));
  }
  return { extensionId, viewId, items, missingProvider: false };
}

async function executeBuiltinCommand(commandId, args) {
  switch (commandId) {
    case 'setContext': {
      const [key, value] = args;
      bridgeRuntimeState.contextValues.set(String(key || ''), value);
      return null;
    }
    case 'vscode.open': {
      const [resource] = args;
      const uri = resource instanceof Uri ? resource : Uri.parse(resource);
      if (uri.scheme === 'http' || uri.scheme === 'https') {
        await hostCall('explorer.open_path', { path: uri.toString() });
        return true;
      }
      await showTextDocument(uri);
      return true;
    }
    default:
      return undefined;
  }
}

function createVscodeApi(extension) {
  const api = {
    version: '1.90.0-greeblefs',
    Disposable,
    EventEmitter,
    Uri,
    ThemeIcon,
    TreeItem,
    TreeItemCollapsibleState,
    Position,
    Range,
    Selection,
    MarkdownString,
    FileSystemError,
    commands: {
      registerCommand(commandId, callback) {
        const id = String(commandId || '').trim();
        if (!id || typeof callback !== 'function') {
          return makeDisposable();
        }
        commands.set(id, { extensionId: extension.extensionId, callback });
        return makeDisposable(() => commands.delete(id));
      },
      executeCommand(commandId, ...args) {
        return executeCommand({
          extensionId: extension.extensionId,
          commandId,
          args,
        });
      },
      getCommands: async () => [...new Set([...commands.keys(), 'setContext', 'vscode.open'])],
    },
    window: {
      createTreeView(viewId, options = {}) {
        const id = String(viewId || '').trim();
        if (!id) {
          throw new Error('createTreeView requires a view id.');
        }
        const provider = options.treeDataProvider;
        registerTreeProvider(extension.extensionId, id, provider);
        const visibilityEmitter = new EventEmitter();
        const selectionEmitter = new EventEmitter();
        return {
          viewId: id,
          title: id,
          visible: true,
          onDidChangeVisibility: visibilityEmitter.event,
          onDidChangeSelection: selectionEmitter.event,
          reveal: async () => undefined,
          dispose: () => treeProviders.delete(`${extension.extensionId}:${id}`),
        };
      },
      registerTreeDataProvider(viewId, provider) {
        registerTreeProvider(extension.extensionId, String(viewId || ''), provider);
        return makeDisposable(() => treeProviders.delete(`${extension.extensionId}:${viewId}`));
      },
      get activeTextEditor() {
        return bridgeRuntimeState.activeTextEditor;
      },
      get visibleTextEditors() {
        return bridgeRuntimeState.visibleTextEditors;
      },
      onDidChangeActiveTextEditor: bridgeRuntimeState.emitters.didChangeActiveTextEditor.event,
      onDidChangeVisibleTextEditors: bridgeRuntimeState.emitters.didChangeVisibleTextEditors.event,
      showInformationMessage: async (message, ...items) => {
        await publishEvent('ext.vscode-bridge-host.notification', {
          extensionId: extension.extensionId,
          level: 'info',
          message: String(message || ''),
          items: items.map(String),
        });
        return items[0];
      },
      showWarningMessage: async (message, ...items) => {
        await publishEvent('ext.vscode-bridge-host.notification', {
          extensionId: extension.extensionId,
          level: 'warning',
          message: String(message || ''),
          items: items.map(String),
        });
        return items[0];
      },
      showErrorMessage: async (message, ...items) => {
        await publishEvent('ext.vscode-bridge-host.notification', {
          extensionId: extension.extensionId,
          level: 'error',
          message: String(message || ''),
          items: items.map(String),
        });
        return items[0];
      },
      showInputBox: async () => undefined,
      showTextDocument: async (resource, options) => showTextDocument(resource, options),
      createOutputChannel,
    },
    workspace: {
      fs: {
        readFile: async (uri) => Buffer.from(await hostCall('files.read_text', { path: toFsPath(uri) }), 'utf8'),
        writeFile: async (uri, content) => {
          await hostCall('files.write_text', {
            path: toFsPath(uri),
            content: Buffer.from(content).toString('utf8'),
          });
        },
        stat: (uri) => hostCall('files.stat', { path: toFsPath(uri) }),
        readDirectory: async (uri) => {
          const listing = await hostCall('files.list_directory', { path: toFsPath(uri), showHidden: true });
          return (listing.entries || []).map((entry) => [entry.name, entry.is_dir ? 2 : 1]);
        },
        createDirectory: (uri) => hostCall('files.create_directory', { path: toFsPath(uri) }),
        delete: (uri, options = {}) => hostCall('files.delete', {
          path: toFsPath(uri),
          recursive: options.recursive === true,
        }),
        rename: (oldUri, newUri) => hostCall('files.rename', {
          oldPath: toFsPath(oldUri),
          newPath: toFsPath(newUri),
        }),
      },
        getConfiguration: () => ({
          get: (_key, fallback) => fallback,
          has: () => false,
          inspect: () => undefined,
          update: async () => undefined,
        }),
      get rootPath() {
        return bridgeRuntimeState.workspaceFolders[0]?.uri.fsPath || undefined;
      },
      get workspaceFolders() {
        return bridgeRuntimeState.workspaceFolders;
      },
      get textDocuments() {
        return bridgeRuntimeState.textDocuments;
      },
      onDidChangeConfiguration: bridgeRuntimeState.emitters.didChangeConfiguration.event,
      onDidChangeWorkspaceFolders: bridgeRuntimeState.emitters.didChangeWorkspaceFolders.event,
      onDidChangeTextDocument: bridgeRuntimeState.emitters.didChangeTextDocument.event,
      onDidOpenTextDocument: bridgeRuntimeState.emitters.didOpenTextDocument.event,
      onDidCloseTextDocument: bridgeRuntimeState.emitters.didCloseTextDocument.event,
      openTextDocument: async (resource) => openTextDocument(resource),
      registerTextDocumentContentProvider(scheme, provider) {
        const normalizedScheme = String(scheme || '').trim();
        if (!normalizedScheme || !provider) {
          return makeDisposable();
        }
        bridgeRuntimeState.textDocumentContentProviders.set(normalizedScheme, provider);
        return makeDisposable(() => {
          bridgeRuntimeState.textDocumentContentProviders.delete(normalizedScheme);
        });
      },
      registerFileSystemProvider(scheme, provider) {
        const normalizedScheme = String(scheme || '').trim();
        if (!normalizedScheme || !provider) {
          return makeDisposable();
        }
        bridgeRuntimeState.fileSystemProviders.set(normalizedScheme, provider);
        return makeDisposable(() => {
          bridgeRuntimeState.fileSystemProviders.delete(normalizedScheme);
        });
      },
    },
    env: {
      appName: 'GreebleFS',
      uriScheme: 'greeblefs',
      language: 'en',
      clipboard: {
        readText: async () => '',
        writeText: async () => undefined,
      },
      openExternal: async (uri) => {
        const target = uri instanceof Uri && uri.scheme !== 'file'
          ? uri.toString()
          : toFsPath(uri);
        await hostCall('explorer.open_path', { path: target });
        return true;
      },
    },
    extensions: {
      getExtension: (id) => {
        const target = extensions.get(String(id || ''));
        return target ? target.context?.extension ?? null : null;
      },
      all: [],
    },
    ProgressLocation: { SourceControl: 1, Window: 10, Notification: 15 },
    FileType: { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 },
    FileChangeType: { Changed: 1, Created: 2, Deleted: 3 },
  };
  return api;
}

function toFsPath(value) {
  if (value instanceof Uri) {
    return value.fsPath || value.path;
  }
  if (value && typeof value === 'object') {
    return String(value.fsPath || value.path || value.toString?.() || '');
  }
  return String(value || '');
}

function registerTreeProvider(extensionId, viewId, provider) {
  if (!viewId || !provider) {
    return;
  }
  const key = `${extensionId}:${viewId}`;
  const viewRecord = {
    extensionId,
    viewId,
    provider,
    handles: new Map(),
    handleCounter: 0,
  };
  treeProviders.set(key, viewRecord);
  const changeEvent =
    (typeof provider.onDidChangeTreeData === 'function' && provider.onDidChangeTreeData)
    || (typeof provider.onDidChangeTreeData2 === 'function' && provider.onDidChangeTreeData2)
    || null;
  if (changeEvent) {
    changeEvent(() => publishTreeChanged(extensionId, viewId));
  }
}

async function activateExtension(payload, activationEvent) {
  const extension = getOrCreateExtension(payload);
  if (extension.activated) {
    return summarizeExtension(extension);
  }
  if (extension.activating) {
    await extension.activating;
    return summarizeExtension(extension);
  }
  if (!shouldActivateFor(extension, activationEvent)) {
    if (activationEvent) {
      extension.activationEvents.push(activationEvent);
    }
  }
  extension.activating = (async () => {
    const mainPath = resolvePackageMain(extension.extensionRootPath, extension.manifest);
    const context = createExtensionContext(extension);
    extension.context = context;
    loadingExtension = extension;
    try {
      const loaded = require(mainPath);
      extension.exports = loaded;
      if (loaded && typeof loaded.activate === 'function') {
        context.extension.exports = await Promise.resolve(loaded.activate(context));
      } else {
        context.extension.exports = loaded;
      }
      extension.activated = true;
      await publishEvent('ext.vscode-bridge-host.extension.activated', {
        extensionId: extension.extensionId,
        mainPath,
      });
    } catch (error) {
      extension.errors.push(String(error && error.stack ? error.stack : error));
      throw error;
    } finally {
      loadingExtension = null;
      extension.activating = null;
    }
  })();
  await extension.activating;
  return summarizeExtension(extension);
}

async function executeCommand(payload) {
  const commandId = String(payload.commandId || '').trim();
  if (!commandId) {
    throw new Error('executeCommand requires commandId.');
  }
  if (payload.extensionId && payload.extensionRootPath && payload.packageJsonPath) {
    await activateExtension(payload, commandActivationEvent(commandId));
  }
  const command = commands.get(commandId);
  const args = Array.isArray(payload.args) ? payload.args.map(deserializeValue) : [];
  if (!command) {
    const builtinResult = await executeBuiltinCommand(commandId, args);
    if (builtinResult !== undefined) {
      return serializeValue(builtinResult ?? null);
    }
    throw new Error(`VS Code command is not registered: ${commandId}`);
  }
  const result = await Promise.resolve(command.callback(...args));
  return serializeValue(result ?? null);
}

function summarizeExtension(extension) {
  return {
    extensionId: extension.extensionId,
    activated: extension.activated,
    commands: [...commands.entries()]
      .filter(([, entry]) => entry.extensionId === extension.extensionId)
      .map(([commandId]) => commandId),
    treeViews: [...treeProviders.values()]
      .filter((entry) => entry.extensionId === extension.extensionId)
      .map((entry) => entry.viewId),
    errors: extension.errors,
  };
}

async function handleAction(packet) {
  const payload = parseJson(packet.payloadJson, {});
  await applyExecutionContextPacket(packet);
  switch (packet.actionId) {
    case ACTIONS.activateExtension:
      return activateExtension(payload, payload.activationEvent || 'onStartupFinished');
    case ACTIONS.executeCommand:
      return executeCommand(payload);
    case ACTIONS.getTreeView: {
      const viewId = String(payload.viewId || '').trim();
      await activateExtension(payload, viewActivationEvent(viewId));
      return resolveTreeItems(payload.extensionId, viewId, payload.parentHandle || null);
    }
    case ACTIONS.refreshTreeView:
      publishTreeChanged(payload.extensionId, payload.viewId);
      return { extensionId: payload.extensionId, viewId: payload.viewId, refreshed: true };
    case ACTIONS.listLoadedExtensions:
      return {
        extensions: [...extensions.values()].map(summarizeExtension),
        commandIds: [...commands.keys()],
        treeViews: [...treeProviders.values()].map((entry) => ({
          extensionId: entry.extensionId,
          viewId: entry.viewId,
        })),
      };
    default:
      throw new Error(`Unknown VS Code bridge action: ${packet.actionId}`);
  }
}

const originalModuleLoad = Module._load;
Module._load = function patchedModuleLoad(request, parent, isMain) {
  if (request === 'vscode') {
    if (!loadingExtension) {
      throw new Error('The GreebleFS VS Code shim is only available while loading a bridged extension.');
    }
    if (!loadingExtension.vscodeApi) {
      loadingExtension.vscodeApi = createVscodeApi(loadingExtension);
    }
    return loadingExtension.vscodeApi;
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  let packet;
  try {
    packet = JSON.parse(trimmed);
  } catch (error) {
    writePacket({
      requestId: nextRequestId('parse-error'),
      kind: 'error',
      ok: false,
      error: `Failed to parse host packet: ${String(error)}`,
    });
    return;
  }

  if (packet.kind === 'host-response') {
    const pending = pendingHostCalls.get(packet.requestId);
    if (pending) {
      pendingHostCalls.delete(packet.requestId);
      if (packet.ok === false) {
        pending.reject(new Error(packet.error || 'Host call failed.'));
      } else {
        pending.resolve(parseJson(packet.resultJson, null));
      }
    }
    return;
  }

  if (packet.kind === 'shutdown') {
    process.exit(0);
    return;
  }

  if (packet.kind !== 'call') {
    return;
  }

  void (async () => {
    try {
      const result = await handleAction(packet);
      writePacket({
        requestId: packet.requestId,
        kind: 'response',
        ok: true,
        resultJson: stringifyPayload(result ?? null),
      });
    } catch (error) {
      writePacket({
        requestId: packet.requestId,
        kind: 'response',
        ok: false,
        error: String(error && error.stack ? error.stack : error),
      });
    }
  })();
});

writePacket({
  requestId: 'vscode-bridge-ready',
  kind: 'ready',
  ok: true,
  resultJson: stringifyPayload({
    runtime: 'vscode-bridge-host',
    pid: process.pid,
  }),
});
