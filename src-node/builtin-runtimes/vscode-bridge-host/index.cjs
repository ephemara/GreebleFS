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
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

function serializeValue(value) {
  if (value instanceof Uri) {
    return { $type: 'Uri', scheme: value.scheme, path: value.path, fsPath: value.fsPath };
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
      return Uri.file(value.fsPath || value.path || '');
    }
    if (value.$type === 'Uint8Array' && Array.isArray(value.data)) {
      return Uint8Array.from(value.data);
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, deserializeValue(entry)]));
  }
  return value;
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
    label: normalizeTreeLabel(item.label),
    description: item.description != null ? String(item.description) : null,
    tooltip: item.tooltip != null ? String(item.tooltip) : null,
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

function createVscodeApi(extension) {
  const api = {
    version: '1.90.0-greeblefs',
    Disposable,
    EventEmitter,
    Uri,
    ThemeIcon,
    TreeItem,
    TreeItemCollapsibleState,
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
      getCommands: async () => [...commands.keys()],
    },
    window: {
      createTreeView(viewId, options = {}) {
        const id = String(viewId || '').trim();
        if (!id) {
          throw new Error('createTreeView requires a view id.');
        }
        const provider = options.treeDataProvider;
        registerTreeProvider(extension.extensionId, id, provider);
        return {
          viewId: id,
          visible: true,
          onDidChangeVisibility: new EventEmitter().event,
          onDidChangeSelection: new EventEmitter().event,
          reveal: async () => undefined,
          dispose: () => treeProviders.delete(`${extension.extensionId}:${id}`),
        };
      },
      registerTreeDataProvider(viewId, provider) {
        registerTreeProvider(extension.extensionId, String(viewId || ''), provider);
        return makeDisposable(() => treeProviders.delete(`${extension.extensionId}:${viewId}`));
      },
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
      workspaceFolders: [],
      onDidChangeConfiguration: new EventEmitter().event,
      onDidChangeWorkspaceFolders: new EventEmitter().event,
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
        await hostCall('explorer.open_path', { path: toFsPath(uri) });
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
  if (typeof provider.onDidChangeTreeData === 'function') {
    provider.onDidChangeTreeData(() => publishTreeChanged(extensionId, viewId));
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
  if (!command) {
    throw new Error(`VS Code command is not registered: ${commandId}`);
  }
  const args = Array.isArray(payload.args) ? payload.args.map(deserializeValue) : [];
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
