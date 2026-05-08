import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type BridgePacket = {
  kind: string;
  requestId?: string;
  ok?: boolean;
  resultJson?: string;
  error?: string;
  methodId?: string;
  payloadJson?: string;
  actionId?: string;
};

type BridgeFixture = {
  rootPath: string;
  extensionRootPath: string;
  packageJsonPath: string;
  workspaceTargetPath: string;
  manifest: Record<string, unknown>;
  cleanup: () => void;
};

type BridgeHarness = {
  call: (
    actionId: string,
    payload: Record<string, unknown>,
    executionContext?: Record<string, unknown> | null,
  ) => Promise<unknown>;
  close: () => void;
  ready: Promise<{ runtime?: string; pid?: number }>;
};

const hostScriptPath = resolve(
  process.cwd(),
  'src-node',
  'builtin-runtimes',
  'vscode-bridge-host',
  'index.cjs',
);

function createBridgeFixture(): BridgeFixture {
  const rootPath = mkdtempSync(join(tmpdir(), 'greeblefs-vscode-bridge-'));
  const extensionRootPath = join(rootPath, 'tree-test');
  mkdirSync(extensionRootPath, { recursive: true });

  const packageJsonPath = join(extensionRootPath, 'package.json');
  const workspaceTargetPath = join(extensionRootPath, 'workspace-target.txt');
  const manifest = {
    name: 'tree-test',
    displayName: 'Tree Test',
    publisher: 'miaomiao222',
    version: '0.0.1',
    main: './extension.cjs',
    activationEvents: [
      'onView:jsonOutline',
      'onView:permissionTree',
      'onCommand:tree-test.hello',
      'onCommand:tree-test.returnUri',
      'onCommand:tree-test.showPackage',
      'onCommand:tree-test.workspaceAuthority',
      'onCommand:tree-test.trustAndProvider',
    ],
    contributes: {
      viewsContainers: {
        activitybar: [
          {
            id: 'tree-test',
            title: 'Tree Test',
          },
        ],
      },
      views: {
        'tree-test': [
          {
            id: 'jsonOutline',
            name: 'JSON Outline',
          },
          {
            id: 'permissionTree',
            name: 'Permission Tree',
          },
        ],
      },
      commands: [
        {
          command: 'tree-test.hello',
          title: 'Hello Tree Test',
        },
        {
          command: 'tree-test.returnUri',
          title: 'Return Uri',
        },
        {
          command: 'tree-test.showPackage',
          title: 'Show Package',
        },
        {
          command: 'tree-test.workspaceAuthority',
          title: 'Workspace Authority',
        },
        {
          command: 'tree-test.trustAndProvider',
          title: 'Trust And Provider',
        },
      ],
    },
  } satisfies Record<string, unknown>;

  writeFileSync(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  writeFileSync(workspaceTargetPath, 'alpha\nbeta\n', 'utf8');
  writeFileSync(
    join(extensionRootPath, 'extension.cjs'),
    `
'use strict';

const path = require('node:path');
const vscode = require('vscode');

class JsonOutlineProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.activeEditorChanges = 0;
    this._subscriptions = [];

    if (typeof vscode.window.onDidChangeActiveTextEditor !== 'function') {
      throw new Error('missing vscode.window.onDidChangeActiveTextEditor');
    }

    if (typeof vscode.workspace.onDidChangeTextDocument !== 'function') {
      throw new Error('missing vscode.workspace.onDidChangeTextDocument');
    }

    this._subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.activeEditorChanges += 1;
        this.refresh();
      }),
    );
    this._subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(() => {
        this.refresh();
      }),
    );
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  getChildren() {
    return [
      new vscode.TreeItem('json-outline-root', vscode.TreeItemCollapsibleState.None),
    ];
  }

  getTreeItem(element) {
    return element;
  }

  dispose() {
    for (const disposable of this._subscriptions) {
      disposable?.dispose?.();
    }
  }
}

class PermissionTreeProvider {
  getChildren() {
    throw vscode.FileSystemError.NoPermissions();
  }

  getTreeItem() {
    return new vscode.TreeItem('never rendered', vscode.TreeItemCollapsibleState.None);
  }
}

function activate(context) {
  const provider = new JsonOutlineProvider();
  context.subscriptions.push(provider);
  context.subscriptions.push(
    vscode.commands.registerCommand('tree-test.hello', () => 'hello from tree-test'),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('tree-test.returnUri', () =>
      new vscode.Uri('tree-test', 'authority', '/some/path', 'mode=demo', 'frag')),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('tree-test.showPackage', async () => {
      const packageUri = vscode.Uri.file(path.join(context.extensionPath, 'package.json'));
      const document = await vscode.workspace.openTextDocument(packageUri);
      const editor = await vscode.window.showTextDocument(document);
      return {
        fileName: editor.document.fileName,
        activeCount: provider.activeEditorChanges,
        visibleCount: vscode.window.visibleTextEditors.length,
      };
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('tree-test.workspaceAuthority', async () => {
      const targetUri = vscode.Uri.file(path.join(context.extensionPath, 'workspace-target.txt'));
      const watcher = vscode.workspace.createFileSystemWatcher('**/*.txt');
      const watcherCounts = { changed: 0, created: 0, deleted: 0 };
      watcher.onDidChange(() => {
        watcherCounts.changed += 1;
      });
      watcher.onDidCreate(() => {
        watcherCounts.created += 1;
      });
      watcher.onDidDelete(() => {
        watcherCounts.deleted += 1;
      });

      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.replace(
        targetUri,
        new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 4)),
        'BETA',
      );
      const applied = await vscode.workspace.applyEdit(workspaceEdit);
      const document = await vscode.workspace.openTextDocument(targetUri);
      const matches = await vscode.workspace.findFiles('**/*.txt');

      const diagnostics = vscode.languages.createDiagnosticCollection('tree-test');
      diagnostics.set(targetUri, [
        new vscode.Diagnostic(
          new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 5)),
          'sample diagnostic',
          vscode.DiagnosticSeverity.Warning,
        ),
      ]);

      return {
        applied,
        text: document.getText(),
        matches: matches.map((uri) => path.basename(uri.fsPath)),
        diagnostics: diagnostics.get(targetUri).map((diagnostic) => ({
          message: diagnostic.message,
          severity: diagnostic.severity,
        })),
        watcherCounts,
      };
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('tree-test.trustAndProvider', async () => {
      let grantCount = 0;
      const trustDisposable = vscode.workspace.onDidGrantWorkspaceTrust(() => {
        grantCount += 1;
      });

      const files = new Map();
      const provider = {
        readFile(uri) {
          return Buffer.from(files.get(uri.path) || '');
        },
        writeFile(uri, content) {
          files.set(uri.path, Buffer.from(content).toString('utf8'));
        },
        stat(uri) {
          return {
            type: files.has(uri.path) ? vscode.FileType.File : vscode.FileType.Directory,
            ctime: 1,
            mtime: 2,
            size: files.get(uri.path)?.length || 0,
          };
        },
        readDirectory() {
          return [...files.keys()].map((filePath) => [path.basename(filePath), vscode.FileType.File]);
        },
      };
      const providerDisposable = vscode.workspace.registerFileSystemProvider('memfs', provider, { isCaseSensitive: true });
      const uri = vscode.Uri.parse('memfs:/note.txt');
      await vscode.workspace.fs.writeFile(uri, Buffer.from('trusted virtual file'));
      const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
      const stat = await vscode.workspace.fs.stat(uri);
      const directory = await vscode.workspace.fs.readDirectory(vscode.Uri.parse('memfs:/'));
      const requestedTrust = await vscode.workspace.requestWorkspaceTrust();
      let unavailableCode = null;
      try {
        await vscode.workspace.fs.writeFile(vscode.Uri.parse('ghostfs:/blocked.txt'), Buffer.from('blocked'));
      } catch (error) {
        unavailableCode = error.code || error.name;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      trustDisposable.dispose();
      providerDisposable.dispose();
      return {
        isTrusted: vscode.workspace.isTrusted,
        requestedTrust,
        grantCount,
        content,
        statType: stat.type,
        directory,
        unavailableCode,
      };
    }),
  );
  vscode.window.createTreeView('jsonOutline', { treeDataProvider: provider });
  vscode.window.createTreeView('permissionTree', { treeDataProvider: new PermissionTreeProvider() });
  return { activated: true };
}

module.exports = { activate };
`.trimStart(),
    'utf8',
  );

  return {
    rootPath,
    extensionRootPath,
    packageJsonPath,
    workspaceTargetPath,
    manifest,
    cleanup: () => rmSync(rootPath, { recursive: true, force: true }),
  };
}

function createBridgeHarness(): BridgeHarness {
  const child = spawn(process.execPath, [hostScriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  }) as ChildProcessWithoutNullStreams;
  const pendingCalls = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();
  const stderrChunks: string[] = [];
  let requestCounter = 0;
  let readyResolved = false;

  child.stderr.on('data', (chunk) => {
    stderrChunks.push(String(chunk));
  });

  const close = () => {
    try {
      child.stdin.end();
    } catch {
      // ignore
    }
    try {
      child.kill();
    } catch {
      // ignore
    }
  };

  const ready = new Promise<{ runtime?: string; pid?: number }>((resolve, reject) => {
    const rl = createInterface({ input: child.stdout });

    const failAllPending = (error: Error) => {
      for (const pending of pendingCalls.values()) {
        pending.reject(error);
      }
      pendingCalls.clear();
    };

    child.once('error', (error) => {
      const errorObject = error instanceof Error ? error : new Error(String(error));
      failAllPending(errorObject);
      reject(errorObject);
    });

    child.once('exit', (code, signal) => {
      if (readyResolved) {
        return;
      }
      const errorObject = new Error(
        `VS Code bridge host exited before readiness (${code ?? 'null'}${signal ? `, ${signal}` : ''})\n${stderrChunks.join('')}`,
      );
      failAllPending(errorObject);
      reject(errorObject);
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      let packet: BridgePacket;
      try {
        packet = JSON.parse(trimmed) as BridgePacket;
      } catch (error) {
        const parseError = error instanceof Error ? error : new Error(String(error));
        failAllPending(parseError);
        reject(parseError);
        return;
      }

      if (packet.kind === 'ready') {
        readyResolved = true;
        const readyPayload = packet.resultJson
          ? (JSON.parse(packet.resultJson) as { runtime?: string; pid?: number })
          : {};
        resolve(readyPayload);
        return;
      }

      if (packet.kind === 'host-call') {
        void respondToHostCall(child, packet).catch((error) => {
          const hostCallError = error instanceof Error ? error : new Error(String(error));
          failAllPending(hostCallError);
        });
        return;
      }

      if (packet.kind !== 'response') {
        return;
      }

      const pending = packet.requestId ? pendingCalls.get(packet.requestId) : undefined;
      if (!pending) {
        return;
      }
      pendingCalls.delete(packet.requestId as string);
      if (packet.ok === false) {
        pending.reject(new Error(packet.error || 'VS Code bridge host returned an error.'));
        return;
      }
      pending.resolve(packet.resultJson ? JSON.parse(packet.resultJson) : null);
    });
  });

  return {
    ready,
    close,
    call(actionId, payload, executionContext = null) {
      const requestId = `test-${requestCounter += 1}`;
      const result = new Promise<unknown>((resolve, reject) => {
        pendingCalls.set(requestId, { resolve, reject });
      });

      child.stdin.write(
        `${JSON.stringify({
          kind: 'call',
          requestId,
          actionId,
          payloadJson: JSON.stringify(payload),
          executionContextJson: executionContext == null ? null : JSON.stringify(executionContext),
        })}\n`,
      );

      return result;
    },
  };
}

async function respondToHostCall(child: ChildProcessWithoutNullStreams, packet: BridgePacket) {
  const payload = packet.payloadJson ? JSON.parse(packet.payloadJson) as Record<string, unknown> : {};
  const pathValue = String(payload.path ?? payload.oldPath ?? payload.newPath ?? '');
  let response: unknown = null;

  switch (packet.methodId) {
    case 'files.read_text':
      response = readFileSync(pathValue, 'utf8');
      break;
    case 'files.write_text':
      writeFileSync(pathValue, String(payload.content ?? ''), 'utf8');
      break;
    case 'files.stat': {
      const stat = statSync(pathValue);
      response = {
        is_dir: stat.isDirectory(),
        size: stat.size,
        modified: stat.mtimeMs,
      };
      break;
    }
    case 'files.list_directory':
      response = {
        entries: readdirSync(pathValue, { withFileTypes: true }).map((entry) => ({
          name: entry.name,
          is_dir: entry.isDirectory(),
        })),
      };
      break;
    case 'files.create_directory':
      mkdirSync(pathValue, { recursive: true });
      break;
    case 'files.delete':
      rmSync(pathValue, { recursive: Boolean(payload.recursive), force: true });
      break;
    case 'files.rename':
      renameSync(String(payload.oldPath ?? ''), String(payload.newPath ?? ''));
      break;
    case 'explorer.open_path':
      response = { opened: true };
      break;
    default:
      throw new Error(`Unsupported bridge host call in test: ${packet.methodId ?? 'unknown'}`);
  }

  child.stdin.write(
    `${JSON.stringify({
      kind: 'host-response',
      requestId: packet.requestId,
      ok: true,
      resultJson: JSON.stringify(response),
    })}\n`,
  );
}

describe('vscode bridge host', () => {
  it('activates a tree view extension that listens for active editor changes and preserves custom Uri values', async () => {
    const fixture = createBridgeFixture();
    const harness = createBridgeHarness();

    try {
      const ready = await harness.ready;
      expect(ready.runtime).toBe('vscode-bridge-host');

      const extensionPayload = {
        extensionId: 'miaomiao222.tree-test',
        extensionRootPath: fixture.extensionRootPath,
        packageJsonPath: fixture.packageJsonPath,
        manifest: fixture.manifest,
        originalPath: join(fixture.rootPath, 'miaomiao222.tree-test-0.0.1.vsix'),
        main: './extension.cjs',
        activationEvents: [
          'onView:jsonOutline',
          'onView:permissionTree',
          'onCommand:tree-test.hello',
          'onCommand:tree-test.returnUri',
          'onCommand:tree-test.showPackage',
          'onCommand:tree-test.workspaceAuthority',
          'onCommand:tree-test.trustAndProvider',
        ],
      };

      const activation = await harness.call('vscode.activateExtension', {
        ...extensionPayload,
        activationEvent: 'onView:jsonOutline',
      }) as {
        activated?: boolean;
        extensionId?: string;
        commands?: string[];
        treeViews?: string[];
        errors?: string[];
      };

      expect(activation).toMatchObject({
        activated: true,
        extensionId: 'miaomiao222.tree-test',
        errors: [],
      });
      expect(activation.commands).toEqual(expect.arrayContaining([
        'tree-test.hello',
        'tree-test.returnUri',
        'tree-test.showPackage',
        'tree-test.workspaceAuthority',
        'tree-test.trustAndProvider',
      ]));
      expect(activation.treeViews).toEqual(expect.arrayContaining(['jsonOutline', 'permissionTree']));

      const treeView = await harness.call('vscode.getTreeView', {
        ...extensionPayload,
        viewId: 'jsonOutline',
        parentHandle: null,
        activationEvent: 'onView:jsonOutline',
      }) as {
        items?: Array<{ label?: string }>;
        missingProvider?: boolean;
      };

      expect(treeView.missingProvider).toBe(false);
      expect(treeView.items).toHaveLength(1);
      expect(treeView.items?.[0]?.label).toBe('json-outline-root');

      const permissionTree = await harness.call('vscode.getTreeView', {
        ...extensionPayload,
        viewId: 'permissionTree',
        parentHandle: null,
        activationEvent: 'onView:permissionTree',
      }) as {
        items?: Array<{ label?: string }>;
        missingProvider?: boolean;
        providerError?: string;
      };

      expect(permissionTree).toMatchObject({
        missingProvider: false,
        items: [],
      });
      expect(permissionTree.providerError).toContain('Insufficient permissions');

      const commandResult = await harness.call('vscode.executeCommand', {
        ...extensionPayload,
        commandId: 'tree-test.hello',
        args: [],
      });
      expect(commandResult).toBe('hello from tree-test');

      const openedPackage = await harness.call('vscode.executeCommand', {
        ...extensionPayload,
        commandId: 'tree-test.showPackage',
        args: [],
      }) as {
        fileName?: string;
        activeCount?: number;
        visibleCount?: number;
      };

      expect(openedPackage).toMatchObject({
        fileName: fixture.packageJsonPath,
        activeCount: 1,
        visibleCount: 1,
      });

      const customUri = await harness.call('vscode.executeCommand', {
        ...extensionPayload,
        commandId: 'tree-test.returnUri',
        args: [],
      }) as {
        $type?: string;
        scheme?: string;
        authority?: string;
        path?: string;
        fsPath?: string;
        query?: string;
        fragment?: string;
      };

      expect(customUri).toEqual({
        $type: 'Uri',
        scheme: 'tree-test',
        authority: 'authority',
        path: '/some/path',
        fsPath: '/some/path',
        query: 'mode=demo',
        fragment: 'frag',
      });

      const workspaceAuthority = await harness.call('vscode.executeCommand', {
        ...extensionPayload,
        commandId: 'tree-test.workspaceAuthority',
        args: [],
      }, {
        cwd: fixture.extensionRootPath,
        roots: [{ path: fixture.extensionRootPath }],
      }) as {
        applied?: boolean;
        text?: string;
        matches?: string[];
        diagnostics?: Array<{ message?: string; severity?: number }>;
        watcherCounts?: { changed?: number; created?: number; deleted?: number };
      };

      expect(workspaceAuthority).toMatchObject({
        applied: true,
        text: 'alpha\nBETA\n',
        diagnostics: [{ message: 'sample diagnostic', severity: 1 }],
        watcherCounts: { changed: 1, created: 0, deleted: 0 },
      });
      expect(workspaceAuthority.matches).toContain('workspace-target.txt');
      expect(readFileSync(fixture.workspaceTargetPath, 'utf8')).toBe('alpha\nBETA\n');

      const trustAndProvider = await harness.call('vscode.executeCommand', {
        ...extensionPayload,
        commandId: 'tree-test.trustAndProvider',
        args: [],
      }) as {
        isTrusted?: boolean;
        requestedTrust?: boolean;
        grantCount?: number;
        content?: string;
        statType?: number;
        directory?: Array<[string, number]>;
        unavailableCode?: string;
      };

      expect(trustAndProvider).toEqual({
        isTrusted: true,
        requestedTrust: true,
        grantCount: 1,
        content: 'trusted virtual file',
        statType: 1,
        directory: [['note.txt', 1]],
        unavailableCode: 'Unavailable',
      });
    } finally {
      harness.close();
      fixture.cleanup();
    }
  });
});
