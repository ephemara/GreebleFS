'use strict';

const path = require('node:path');

class Disposable {
  constructor(callback) {
    this.callback = callback;
  }

  dispose() {
    if (!this.callback) {
      return;
    }
    const callback = this.callback;
    this.callback = null;
    callback();
  }

  static from(...items) {
    return new Disposable(() => {
      for (const item of items) {
        item?.dispose?.();
      }
    });
  }
}

class EventEmitter {
  constructor() {
    this.listeners = new Set();
    this.event = (listener) => {
      if (typeof listener !== 'function') {
        return new Disposable();
      }
      this.listeners.add(listener);
      return new Disposable(() => this.listeners.delete(listener));
    };
  }

  fire(value) {
    for (const listener of [...this.listeners]) {
      listener(value);
    }
  }

  dispose() {
    this.listeners.clear();
  }
}

class CancellationToken {
  constructor() {
    this.isCancellationRequested = false;
    this._emitter = new EventEmitter();
    this.onCancellationRequested = this._emitter.event;
  }

  _cancel() {
    if (this.isCancellationRequested) {
      return;
    }
    this.isCancellationRequested = true;
    this._emitter.fire(undefined);
  }
}

class CancellationTokenSource {
  constructor() {
    this.token = new CancellationToken();
  }

  cancel() {
    this.token._cancel();
  }

  dispose(cancel = false) {
    if (cancel) {
      this.cancel();
    }
  }
}

class Uri {
  constructor(scheme, authority, uriPath, query = '', fragment = '') {
    this.scheme = String(scheme || 'file');
    this.authority = String(authority || '');
    this.path = String(uriPath || '');
    this.query = String(query || '');
    this.fragment = String(fragment || '');
    this.fsPath = this.scheme === 'file' ? this.path : this.path;
  }

  toString() {
    const query = this.query ? `?${this.query}` : '';
    const fragment = this.fragment ? `#${this.fragment}` : '';
    if (this.scheme === 'file') {
      const normalized = this.fsPath.replace(/\\/g, '/');
      return `file://${normalized}${query}${fragment}`;
    }
    const authority = this.authority ? `//${this.authority}` : '';
    return `${this.scheme}:${authority}${this.path}${query}${fragment}`;
  }

  toJSON() {
    return {
      $type: 'Uri',
      scheme: this.scheme,
      authority: this.authority,
      path: this.path,
      fsPath: this.fsPath,
      query: this.query,
      fragment: this.fragment,
    };
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
      const parsed = new URL(raw);
      return Uri.file(decodeURIComponent(parsed.pathname.replace(/^\/([A-Za-z]:)/, '$1')));
    }
    try {
      const parsed = new URL(raw);
      return new Uri(
        parsed.protocol.replace(/:$/, ''),
        parsed.hostname || '',
        decodeURIComponent(parsed.pathname || ''),
        parsed.search.replace(/^\?/, ''),
        parsed.hash.replace(/^#/, ''),
      );
    } catch {
      const match = raw.match(/^([A-Za-z][A-Za-z0-9+.-]*):(.*)$/);
      if (!match) {
        return Uri.file(raw);
      }
      return new Uri(match[1], '', match[2], '', '');
    }
  }
}

class Position {
  constructor(line, character) {
    this.line = Math.max(0, Number.isFinite(Number(line)) ? Number(line) : 0);
    this.character = Math.max(0, Number.isFinite(Number(character)) ? Number(character) : 0);
  }

  isBefore(other) {
    const target = other instanceof Position ? other : new Position(other?.line, other?.character);
    return this.line < target.line || (this.line === target.line && this.character < target.character);
  }

  isBeforeOrEqual(other) {
    return this.isBefore(other) || this.isEqual(other);
  }

  isAfter(other) {
    const target = other instanceof Position ? other : new Position(other?.line, other?.character);
    return this.line > target.line || (this.line === target.line && this.character > target.character);
  }

  isAfterOrEqual(other) {
    return this.isAfter(other) || this.isEqual(other);
  }

  isEqual(other) {
    const target = other instanceof Position ? other : new Position(other?.line, other?.character);
    return this.line === target.line && this.character === target.character;
  }

  compareTo(other) {
    if (this.isBefore(other)) {
      return -1;
    }
    if (this.isAfter(other)) {
      return 1;
    }
    return 0;
  }

  translate(lineDeltaOrChange = 0, characterDelta = 0) {
    if (typeof lineDeltaOrChange === 'object') {
      return new Position(
        this.line + Number(lineDeltaOrChange.lineDelta || 0),
        this.character + Number(lineDeltaOrChange.characterDelta || 0),
      );
    }
    return new Position(this.line + Number(lineDeltaOrChange || 0), this.character + Number(characterDelta || 0));
  }

  with(lineOrChange = this.line, character = this.character) {
    if (typeof lineOrChange === 'object') {
      return new Position(lineOrChange.line ?? this.line, lineOrChange.character ?? this.character);
    }
    return new Position(lineOrChange, character);
  }
}

function positionFrom(value) {
  return value instanceof Position ? value : new Position(value?.line, value?.character);
}

class Range {
  constructor(startOrStartLine, startOrStartCharacter, endLine, endCharacter) {
    if (startOrStartLine && typeof startOrStartLine === 'object' && startOrStartCharacter && typeof startOrStartCharacter === 'object') {
      this.start = positionFrom(startOrStartLine);
      this.end = positionFrom(startOrStartCharacter);
      return;
    }
    this.start = new Position(startOrStartLine, startOrStartCharacter);
    this.end = new Position(endLine, endCharacter);
  }

  get isEmpty() {
    return this.start.isEqual(this.end);
  }

  get isSingleLine() {
    return this.start.line === this.end.line;
  }

  contains(positionOrRange) {
    if (positionOrRange instanceof Range || positionOrRange?.start) {
      const range = rangeFrom(positionOrRange);
      return this.contains(range.start) && this.contains(range.end);
    }
    const position = positionFrom(positionOrRange);
    return position.isAfterOrEqual(this.start) && position.isBeforeOrEqual(this.end);
  }

  isEqual(other) {
    const range = rangeFrom(other);
    return this.start.isEqual(range.start) && this.end.isEqual(range.end);
  }

  intersection(other) {
    const range = rangeFrom(other);
    const start = this.start.isAfter(range.start) ? this.start : range.start;
    const end = this.end.isBefore(range.end) ? this.end : range.end;
    return start.isAfter(end) ? undefined : new Range(start, end);
  }

  union(other) {
    const range = rangeFrom(other);
    const start = this.start.isBefore(range.start) ? this.start : range.start;
    const end = this.end.isAfter(range.end) ? this.end : range.end;
    return new Range(start, end);
  }

  with(startOrChange = this.start, end = this.end) {
    if (startOrChange && typeof startOrChange === 'object' && !('line' in startOrChange) && (startOrChange.start || startOrChange.end)) {
      return new Range(startOrChange.start ?? this.start, startOrChange.end ?? this.end);
    }
    return new Range(startOrChange, end);
  }
}

function rangeFrom(value) {
  return value instanceof Range ? value : new Range(value?.start, value?.end);
}

class Selection extends Range {
  constructor(anchorOrStart, activeOrEnd, endLine, endCharacter) {
    if (anchorOrStart && typeof anchorOrStart === 'object' && activeOrEnd && typeof activeOrEnd === 'object') {
      const anchor = positionFrom(anchorOrStart);
      const active = positionFrom(activeOrEnd);
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
    this.supportThemeIcons = false;
    this.supportHtml = false;
  }

  appendMarkdown(value) {
    this.value += String(value ?? '');
    return this;
  }

  appendText(value) {
    this.value += String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/\./g, '\\.')
      .replace(/!/g, '\\!');
    return this;
  }

  toString() {
    return this.value;
  }
}

class ThemeIcon {
  constructor(id, color) {
    this.id = id;
    this.color = color;
  }
}

const TreeItemCollapsibleState = Object.freeze({
  None: 0,
  Collapsed: 1,
  Expanded: 2,
});

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

class FileSystemError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'FileSystemError';
    this.code = code;
  }

  static FileNotFound(message = 'File not found') {
    return new FileSystemError(message, 'FileNotFound');
  }

  static FileNotADirectory(message = 'File not a directory') {
    return new FileSystemError(message, 'FileNotADirectory');
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

  static Unavailable(message = 'Unavailable') {
    return new FileSystemError(message, 'Unavailable');
  }
}

const DiagnosticSeverity = Object.freeze({
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
});

class Diagnostic {
  constructor(range, message, severity = DiagnosticSeverity.Error) {
    this.range = rangeFrom(range);
    this.message = String(message ?? '');
    this.severity = severity;
  }
}

class TextEdit {
  constructor(range, newText) {
    this.range = rangeFrom(range);
    this.newText = String(newText ?? '');
  }

  static replace(range, newText) {
    return new TextEdit(range, newText);
  }

  static insert(position, newText) {
    const range = new Range(positionFrom(position), positionFrom(position));
    return new TextEdit(range, newText);
  }

  static delete(range) {
    return new TextEdit(range, '');
  }
}

class WorkspaceEdit {
  constructor() {
    this._editsByUri = new Map();
  }

  replace(uri, range, newText) {
    this._push(uri, TextEdit.replace(range, newText));
  }

  insert(uri, position, newText) {
    this._push(uri, TextEdit.insert(position, newText));
  }

  delete(uri, range) {
    this._push(uri, TextEdit.delete(range));
  }

  set(uri, edits) {
    const key = uriIdentity(uri);
    this._editsByUri.set(key, {
      uri,
      edits: Array.isArray(edits) ? edits.map(textEditFrom) : [],
    });
  }

  get(uri) {
    return this._editsByUri.get(uriIdentity(uri))?.edits || [];
  }

  has(uri) {
    return this._editsByUri.has(uriIdentity(uri));
  }

  entries() {
    return [...this._editsByUri.values()].map((entry) => [entry.uri, entry.edits]);
  }

  _push(uri, edit) {
    const key = uriIdentity(uri);
    const entry = this._editsByUri.get(key) || { uri, edits: [] };
    entry.edits.push(edit);
    this._editsByUri.set(key, entry);
  }
}

function textEditFrom(value) {
  return value instanceof TextEdit ? value : new TextEdit(value?.range, value?.newText);
}

function uriIdentity(uri) {
  if (uri instanceof Uri) {
    return `${uri.scheme}:${uri.fsPath || uri.path || uri.toString()}`;
  }
  return String(uri || '');
}

module.exports = {
  CancellationToken,
  CancellationTokenSource,
  Diagnostic,
  DiagnosticSeverity,
  Disposable,
  EventEmitter,
  FileSystemError,
  MarkdownString,
  Position,
  Range,
  Selection,
  TextEdit,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  WorkspaceEdit,
  positionFrom,
  rangeFrom,
  textEditFrom,
};
