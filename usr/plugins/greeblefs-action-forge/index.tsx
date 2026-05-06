import React from 'react';
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FolderOpen,
  Layers3,
  RefreshCcw,
  Sparkles,
  TerminalSquare,
  WandSparkles,
} from 'lucide-react';
import {
  definePlugin,
} from 'overlayterm-plugin';
import {
  ExplorerWorkflowButton,
  ExplorerWorkflowEmptyState,
  ExplorerWorkflowFieldGrid,
  ExplorerWorkflowInput,
  ExplorerWorkflowMetaStrip,
  ExplorerWorkflowSection,
  ExplorerWorkflowStatusNotice,
} from '@greeblefs/ui';

import {
  ACTION_FORGE_CONTEXT_LABELS,
  ACTION_FORGE_MODE_CATALOG,
  buildActionBlueprint,
  createDefaultActionForgeDraft,
  deriveDefaultBody,
  deriveDefaultEntryRelativePath,
  joinPath,
  resolveActionsRoot,
  sanitizeSlug,
  titleCaseSlug,
  type ActionForgeDraft,
  type ActionForgeMenuContext,
  type ActionPackSummary,
} from './templates';

type DirectoryListingEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

type ForgeStatus =
  | { kind: 'idle' }
  | { kind: 'saving'; message: string }
  | { kind: 'success'; message: string; path: string }
  | { kind: 'error'; message: string };

const DRAFT_STORAGE_PATH = 'drafts/action-forge.json';

function normalizeDirectoryEntry(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value;
  const name = typeof record.name === 'string' ? record.name : '';
  const path = typeof record.path === 'string' ? record.path : '';
  const isDirectory = record.isDirectory === true || record.is_dir === true;
  if (!name || !path) {
    return null;
  }
  return { name, path, isDirectory };
}

function formatCount(count) {
  return `${count} ${count === 1 ? 'action' : 'actions'}`;
}

function formatModeBadge(modeId) {
  return ACTION_FORGE_MODE_CATALOG.find((mode) => mode.id === modeId)?.badge ?? 'ACT';
}

function copyText(text) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return Promise.resolve(false);
  }
  return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
}

function readTomlStringField(sourceText, fieldName) {
  const match = sourceText.match(new RegExp(`^\\s*${fieldName}\\s*=\\s*"([^"]*)"`, 'm'));
  return match?.[1]?.trim() || '';
}

async function statPath(api, path) {
  try {
    return await api.host.files.stat(path);
  } catch {
    return { exists: false, isDirectory: false, path, size: 0, modifiedMs: null, extension: null };
  }
}

async function listDirectoryEntries(api, path) {
  try {
    const listing = await api.host.files.listDirectory(path, false);
    return Array.isArray(listing.entries)
      ? listing.entries.map(normalizeDirectoryEntry).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

async function loadPackSummary(api, packEntry) {
  const manifestPath = joinPath(packEntry.path, 'action-pack.toml');
  const readmePath = joinPath(packEntry.path, 'README.md');
  const actionsPath = joinPath(packEntry.path, 'actions');
  const [manifestStat, readmeStat, actionEntries] = await Promise.all([
    statPath(api, manifestPath),
    statPath(api, readmePath),
    listDirectoryEntries(api, actionsPath),
  ]);
  let name = titleCaseSlug(packEntry.name);
  let description = '';
  if (manifestStat.exists) {
    try {
      const manifestText = await api.host.files.readText(manifestPath);
      name = readTomlStringField(manifestText, 'name') || name;
      description = readTomlStringField(manifestText, 'description') || '';
    } catch {
      // Ignore manifest read errors and keep directory-derived metadata.
    }
  }
  return {
    id: sanitizeSlug(packEntry.name, 'actions-pack'),
    name,
    path: packEntry.path,
    manifestPath,
    readmePath,
    actionsPath,
    actionCount: actionEntries.filter((entry) => entry.isDirectory).length,
    hasManifest: manifestStat.exists,
    hasReadme: readmeStat.exists,
    description: description || undefined,
  };
}

function packIdToDraft(pack) {
  return {
    newPackName: pack.name,
    newPackId: pack.id,
  };
}

function resolveToneForStatus(status) {
  if (status.kind === 'error') {
    return 'danger';
  }
  if (status.kind === 'success') {
    return 'success';
  }
  if (status.kind === 'saving') {
    return 'warning';
  }
  return 'neutral';
}

function ActionForgePanel({ plugin, api }) {
  const [packs, setPacks] = React.useState([]);
  const [draft, setDraft] = React.useState(() => createDefaultActionForgeDraft());
  const [status, setStatus] = React.useState({ kind: 'idle' });
  const [loadingPacks, setLoadingPacks] = React.useState(true);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [scriptTouched, setScriptTouched] = React.useState(false);
  const [entryPathTouched, setEntryPathTouched] = React.useState(false);
  const [packIdTouched, setPackIdTouched] = React.useState(false);
  const [actionIdTouched, setActionIdTouched] = React.useState(false);
  const [copiedPreviewLabel, setCopiedPreviewLabel] = React.useState('');

  const actionsRoot = React.useMemo(
    () => resolveActionsRoot(plugin.pluginDirectory),
    [plugin.pluginDirectory],
  );
  const selectedPack = packs.find((pack) => pack.id === draft.selectedPackId) ?? null;
  const blueprint = React.useMemo(
    () => buildActionBlueprint({ actionsRoot, draft, selectedPack }),
    [actionsRoot, draft, selectedPack],
  );
  const issues = blueprint.issues;
  const blockingIssues = issues.filter((issue) => issue.level === 'error');

  React.useEffect(() => {
    let cancelled = false;
    async function loadDraft() {
      try {
        const saved = await api.storage?.readTextFile(DRAFT_STORAGE_PATH);
        if (!saved) {
          return;
        }
        const parsed = JSON.parse(saved);
        if (!cancelled && parsed && typeof parsed === 'object') {
          React.startTransition(() => {
            setDraft((currentDraft) => ({
              ...currentDraft,
              ...parsed,
            }));
          });
        }
      } catch {
        // Draft loading is best-effort.
      }
    }
    void loadDraft();
    return () => {
      cancelled = true;
    };
  }, [api.storage]);

  React.useEffect(() => {
    if (!api.storage) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void api.storage.writeTextFile(
        DRAFT_STORAGE_PATH,
        JSON.stringify(draft, null, 2),
      ).catch(() => undefined);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [api.storage, draft]);

  React.useEffect(() => {
    if (draft.packMode === 'existing' && selectedPack && !packIdTouched) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        ...packIdToDraft(selectedPack),
      }));
    }
  }, [draft.packMode, packIdTouched, selectedPack]);

  React.useEffect(() => {
    if (draft.packMode === 'new' && !packIdTouched) {
      const nextPackId = sanitizeSlug(
        draft.newPackId || draft.newPackName,
        'custom-actions-pack',
      );
      if (nextPackId !== draft.newPackId) {
        setDraft((currentDraft) => ({ ...currentDraft, newPackId: nextPackId }));
      }
    }
  }, [draft.newPackId, draft.newPackName, draft.packMode, packIdTouched]);

  React.useEffect(() => {
    if (!actionIdTouched) {
      const nextActionId = sanitizeSlug(
        draft.actionId || draft.actionName,
        'custom-action',
      );
      if (nextActionId !== draft.actionId) {
        setDraft((currentDraft) => ({ ...currentDraft, actionId: nextActionId }));
      }
    }
  }, [actionIdTouched, draft.actionId, draft.actionName]);

  React.useEffect(() => {
    if (!entryPathTouched) {
      const nextEntryPath = deriveDefaultEntryRelativePath(draft.mode, draft.actionId);
      if (nextEntryPath !== draft.entryRelativePath) {
        setDraft((currentDraft) => ({ ...currentDraft, entryRelativePath: nextEntryPath }));
      }
    }
  }, [draft.actionId, draft.entryRelativePath, draft.mode, entryPathTouched]);

  React.useEffect(() => {
    if (!scriptTouched) {
      const nextBody = deriveDefaultBody(draft.mode, draft.actionName.trim() || 'Action');
      if (draft.mode === 'inline-shell' && nextBody !== draft.shellBody) {
        setDraft((currentDraft) => ({ ...currentDraft, shellBody: nextBody }));
      }
      if (draft.mode !== 'workflow' && draft.mode !== 'binary' && nextBody !== draft.scriptBody) {
        setDraft((currentDraft) => ({ ...currentDraft, scriptBody: nextBody }));
      }
    }
  }, [
    draft.actionName,
    draft.mode,
    draft.scriptBody,
    draft.shellBody,
    scriptTouched,
  ]);

  const refreshPacks = React.useCallback(async () => {
    setLoadingPacks(true);
    try {
      const packEntries = (await listDirectoryEntries(api, actionsRoot))
        .filter((entry) => entry.isDirectory);
      const nextPacks = await Promise.all(
        packEntries.map((packEntry) => loadPackSummary(api, packEntry)),
      );
      nextPacks.sort((left, right) => left.name.localeCompare(right.name));
      setPacks(nextPacks);
      setDraft((currentDraft) => {
        if (currentDraft.packMode !== 'existing') {
          return currentDraft;
        }
        const selectedStillExists = nextPacks.some(
          (pack) => pack.id === currentDraft.selectedPackId,
        );
        return selectedStillExists
          ? currentDraft
          : {
            ...currentDraft,
            selectedPackId: nextPacks[0]?.id ?? '',
          };
      });
    } finally {
      setLoadingPacks(false);
    }
  }, [actionsRoot, api]);

  React.useEffect(() => {
    void refreshPacks();
  }, [refreshPacks]);

  async function writeGeneratedFiles() {
    if (blockingIssues.length > 0) {
      setStatus({
        kind: 'error',
        message: blockingIssues[0]?.message || 'Fix the action issues before creating files.',
      });
      return;
    }
    setStatus({ kind: 'saving', message: 'Writing pack and action files…' });
    try {
      const existingAction = await statPath(api, blueprint.actionPath);
      if (existingAction.exists && !draft.overwriteExisting) {
        setStatus({
          kind: 'error',
          message: `Action "${blueprint.actionId}" already exists in ${blueprint.packId}. Enable overwrite to replace it.`,
        });
        return;
      }

      for (const file of blueprint.files) {
        await api.host.files.writeText(file.path, file.content);
      }

      await refreshPacks();
      await Promise.resolve(api.notification.sendNotification({
        title: 'Action Forge',
        body: `${blueprint.actionName} is now live in ${blueprint.packId}.`,
      })).catch(() => undefined);

      if (draft.revealAfterCreate) {
        await api.host.explorer.openPath(blueprint.actionPath).catch(() => undefined);
      }

      setStatus({
        kind: 'success',
        message: `Created ${blueprint.actionName} in ${blueprint.packId}.`,
        path: blueprint.actionPath,
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: String(error),
      });
    }
  }

  async function openPath(path) {
    await api.host.explorer.openPath(path).catch((error) => {
      setStatus({ kind: 'error', message: String(error) });
    });
  }

  async function handleCopyPreview(label, content) {
    const copied = await copyText(content);
    if (copied) {
      setCopiedPreviewLabel(label);
      window.setTimeout(() => setCopiedPreviewLabel(''), 1200);
    } else {
      setStatus({
        kind: 'error',
        message: `Could not copy ${label.toLowerCase()} to the clipboard.`,
      });
    }
  }

  const actionFilePreview = blueprint.files.find((file) => file.label === 'Action Manifest')
    ?? blueprint.files[blueprint.files.length - 1];
  const scriptFilePreview = blueprint.files.find((file) => file.label !== 'Action Manifest'
    && file.label !== 'Pack Manifest'
    && file.label !== 'Pack README');

  return (
    <section style={panelStyle}>
      <header style={headerStyle}>
        <div style={headerTitleRowStyle}>
          <div style={titleClusterStyle}>
            <div style={iconPlateStyle}>
              <WandSparkles size={18} />
            </div>
            <div style={{ display: 'grid', gap: 2 }}>
              <div style={titleStyle}>Action Forge</div>
              <ExplorerWorkflowMetaStrip>
                <span>{loadingPacks ? 'Scanning packs' : `${packs.length} packs`}</span>
                <span>{loadingPacks ? '...' : formatCount(packs.reduce((sum, pack) => sum + pack.actionCount, 0))}</span>
                <span>{actionsRoot}</span>
              </ExplorerWorkflowMetaStrip>
            </div>
          </div>
          <div style={toolbarStyle}>
            <ExplorerWorkflowButton
              tone="ghost"
              type="button"
              onClick={() => void refreshPacks()}
            >
              <RefreshCcw size={14} />
              Refresh
            </ExplorerWorkflowButton>
            <ExplorerWorkflowButton
              tone="ghost"
              type="button"
              onClick={() => void openPath(actionsRoot)}
            >
              <FolderOpen size={14} />
              Actions Root
            </ExplorerWorkflowButton>
            <ExplorerWorkflowButton
              tone="ghost"
              type="button"
              onClick={() => setShowAdvanced((current) => !current)}
            >
              <Layers3 size={14} />
              {showAdvanced ? 'Compact' : 'Advanced'}
            </ExplorerWorkflowButton>
          </div>
        </div>
        <ExplorerWorkflowStatusNotice tone={resolveToneForStatus(status)}>
          {status.kind === 'idle'
            ? 'Ready'
            : status.message}
        </ExplorerWorkflowStatusNotice>
      </header>

      <div style={contentGridStyle}>
        <div style={leftColumnStyle}>
          <ExplorerWorkflowSection title="Pack">
            <div style={toggleRowStyle}>
              <ModeToggleButton
                active={draft.packMode === 'existing'}
                label="Existing"
                onClick={() => setDraft((currentDraft) => ({
                  ...currentDraft,
                  packMode: 'existing',
                  selectedPackId: currentDraft.selectedPackId || packs[0]?.id || '',
                }))}
              />
              <ModeToggleButton
                active={draft.packMode === 'new'}
                label="New"
                onClick={() => setDraft((currentDraft) => ({
                  ...currentDraft,
                  packMode: 'new',
                }))}
              />
            </div>

            {draft.packMode === 'existing' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <select
                  value={draft.selectedPackId}
                  onChange={(event) => {
                    const nextPack = packs.find((pack) => pack.id === event.currentTarget.value) ?? null;
                    setPackIdTouched(false);
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      selectedPackId: event.currentTarget.value,
                      ...(nextPack ? packIdToDraft(nextPack) : {}),
                    }));
                  }}
                  style={selectStyle}
                >
                  {packs.length === 0 ? (
                    <option value="">No packs found</option>
                  ) : null}
                  {packs.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name} · {formatCount(pack.actionCount)}
                    </option>
                  ))}
                </select>
                {selectedPack ? (
                  <div style={packCardStyle}>
                    <div style={packCardTitleStyle}>{selectedPack.name}</div>
                    <div style={packCardMetaStyle}>{selectedPack.id}</div>
                    <div style={packCardMetaStyle}>
                      {selectedPack.description || selectedPack.path}
                    </div>
                    <div style={packActionRowStyle}>
                      <ExplorerWorkflowButton
                        tone="ghost"
                        type="button"
                        onClick={() => void openPath(selectedPack.path)}
                      >
                        <ExternalLink size={13} />
                        Open Pack
                      </ExplorerWorkflowButton>
                      <ExplorerWorkflowButton
                        tone="ghost"
                        type="button"
                        onClick={() => void copyText(selectedPack.path)}
                      >
                        <Copy size={13} />
                        Copy Path
                      </ExplorerWorkflowButton>
                    </div>
                  </div>
                ) : (
                  <ExplorerWorkflowEmptyState>
                    No packs yet in `usr/actions`.
                  </ExplorerWorkflowEmptyState>
                )}
              </div>
            ) : (
              <ExplorerWorkflowFieldGrid columns={showAdvanced ? 2 : 1}>
                <Field label="Pack Name">
                  <ExplorerWorkflowInput
                    value={draft.newPackName}
                    onChange={(event) => {
                      const nextName = event.currentTarget.value;
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        newPackName: nextName,
                        newPackId: packIdTouched
                          ? currentDraft.newPackId
                          : sanitizeSlug(nextName, 'custom-actions-pack'),
                      }));
                    }}
                    placeholder="Custom Actions Pack"
                  />
                </Field>
                <Field label="Pack Id">
                  <ExplorerWorkflowInput
                    value={draft.newPackId}
                    onChange={(event) => {
                      setPackIdTouched(true);
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        newPackId: sanitizeSlug(event.currentTarget.value, 'custom-actions-pack'),
                      }));
                    }}
                    placeholder="custom-actions-pack"
                  />
                </Field>
                <Field label="Description" span={showAdvanced ? 2 : 1}>
                  <textarea
                    value={draft.newPackDescription}
                    onChange={(event) => setDraft((currentDraft) => ({
                      ...currentDraft,
                      newPackDescription: event.currentTarget.value,
                    }))}
                    style={textAreaStyle}
                    rows={3}
                  />
                </Field>
                {showAdvanced ? (
                  <>
                    <Field label="Author">
                      <ExplorerWorkflowInput
                        value={draft.packAuthor}
                        onChange={(event) => setDraft((currentDraft) => ({
                          ...currentDraft,
                          packAuthor: event.currentTarget.value,
                        }))}
                        placeholder="Studio / Team"
                      />
                    </Field>
                    <Field label="Pack Tags">
                      <ExplorerWorkflowInput
                        value={draft.packTagsText}
                        onChange={(event) => setDraft((currentDraft) => ({
                          ...currentDraft,
                          packTagsText: event.currentTarget.value,
                        }))}
                        placeholder="custom, actions"
                      />
                    </Field>
                  </>
                ) : null}
              </ExplorerWorkflowFieldGrid>
            )}
          </ExplorerWorkflowSection>

          <ExplorerWorkflowSection title="Action">
            <ExplorerWorkflowFieldGrid columns={showAdvanced ? 2 : 1}>
              <Field label="Action Name">
                <ExplorerWorkflowInput
                  value={draft.actionName}
                  onChange={(event) => {
                    const nextName = event.currentTarget.value;
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      actionName: nextName,
                      actionId: actionIdTouched
                        ? currentDraft.actionId
                        : sanitizeSlug(nextName, 'custom-action'),
                    }));
                  }}
                  placeholder="Selection Snapshot"
                />
              </Field>
              <Field label="Action Id">
                <ExplorerWorkflowInput
                  value={draft.actionId}
                  onChange={(event) => {
                    setActionIdTouched(true);
                    const nextActionId = sanitizeSlug(event.currentTarget.value, 'custom-action');
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      actionId: nextActionId,
                      entryRelativePath: entryPathTouched
                        ? currentDraft.entryRelativePath
                        : deriveDefaultEntryRelativePath(currentDraft.mode, nextActionId),
                    }));
                  }}
                  placeholder="selection-snapshot"
                />
              </Field>
              <Field label="Description" span={showAdvanced ? 2 : 1}>
                <textarea
                  value={draft.actionDescription}
                  onChange={(event) => setDraft((currentDraft) => ({
                    ...currentDraft,
                    actionDescription: event.currentTarget.value,
                  }))}
                  style={textAreaStyle}
                  rows={3}
                />
              </Field>
              {showAdvanced ? (
                <>
                  <Field label="Icon">
                    <ExplorerWorkflowInput
                      value={draft.iconName}
                      onChange={(event) => setDraft((currentDraft) => ({
                        ...currentDraft,
                        iconName: event.currentTarget.value,
                      }))}
                      placeholder="Sparkles"
                    />
                  </Field>
                  <Field label="Tags">
                    <ExplorerWorkflowInput
                      value={draft.actionTagsText}
                      onChange={(event) => setDraft((currentDraft) => ({
                        ...currentDraft,
                        actionTagsText: event.currentTarget.value,
                      }))}
                      placeholder="custom, selection"
                    />
                  </Field>
                </>
              ) : null}
            </ExplorerWorkflowFieldGrid>

            <Field label="Mode">
              <div style={modeGridStyle}>
                {ACTION_FORGE_MODE_CATALOG.map((mode) => (
                  <ModeCard
                    key={mode.id}
                    mode={mode}
                    active={draft.mode === mode.id}
                    onClick={() => {
                      setScriptTouched(false);
                      setEntryPathTouched(false);
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        mode: mode.id,
                        outputTarget: mode.family === 'workflow'
                          ? currentDraft.outputTarget
                          : currentDraft.outputTarget,
                        entryRelativePath: deriveDefaultEntryRelativePath(mode.id, currentDraft.actionId),
                        runtimeOverride: mode.defaultInterpreter ?? '',
                        scriptBody: deriveDefaultBody(mode.id, currentDraft.actionName || 'Action'),
                        shellBody: deriveDefaultBody('inline-shell', currentDraft.actionName || 'Action'),
                      }));
                    }}
                  />
                ))}
              </div>
            </Field>
          </ExplorerWorkflowSection>
        </div>

        <div style={centerColumnStyle}>
          <ExplorerWorkflowSection title="Trigger">
            <Field label="Contexts">
              <div style={toggleWrapStyle}>
                {Object.entries(ACTION_FORGE_CONTEXT_LABELS).map(([contextId, label]) => {
                  const typedContextId = contextId;
                  const active = draft.contexts.includes(typedContextId);
                  return (
                    <ModeToggleButton
                      key={typedContextId}
                      active={active}
                      label={label}
                      onClick={() => {
                        setDraft((currentDraft) => {
                          const nextContexts = active
                            ? currentDraft.contexts.filter((context) => context !== typedContextId)
                            : [...currentDraft.contexts, typedContextId];
                          return {
                            ...currentDraft,
                            contexts: nextContexts,
                          };
                        });
                      }}
                    />
                  );
                })}
              </div>
            </Field>

            <ExplorerWorkflowFieldGrid columns={showAdvanced ? 3 : 2}>
              <Field label="Applies To">
                <select
                  value={draft.appliesTo}
                  onChange={(event) => setDraft((currentDraft) => ({
                    ...currentDraft,
                    appliesTo: event.currentTarget.value,
                  }))}
                  style={selectStyle}
                >
                  <option value="any">Any</option>
                  <option value="file">Files</option>
                  <option value="directory">Folders</option>
                </select>
              </Field>
              <Field label="Output">
                <select
                  value={draft.outputTarget}
                  onChange={(event) => setDraft((currentDraft) => ({
                    ...currentDraft,
                    outputTarget: event.currentTarget.value,
                  }))}
                  style={selectStyle}
                  disabled={draft.mode === 'workflow'}
                >
                  <option value="task-center">Task Center</option>
                  <option value="preview-terminal">Preview Terminal</option>
                  <option value="native-terminal">Native Terminal</option>
                  <option value="silent">Silent</option>
                </select>
              </Field>
              {showAdvanced ? (
                <Field label="Extensions">
                  <ExplorerWorkflowInput
                    value={draft.extensionsText}
                    onChange={(event) => setDraft((currentDraft) => ({
                      ...currentDraft,
                      extensionsText: event.currentTarget.value,
                    }))}
                    placeholder="zip, png, psd"
                  />
                </Field>
              ) : null}
            </ExplorerWorkflowFieldGrid>

            <ExplorerWorkflowFieldGrid columns={showAdvanced ? 4 : 2}>
              <Field label="Min Count">
                <ExplorerWorkflowInput
                  value={draft.minCountText}
                  onChange={(event) => setDraft((currentDraft) => ({
                    ...currentDraft,
                    minCountText: event.currentTarget.value,
                  }))}
                  placeholder="1"
                />
              </Field>
              <Field label="Max Count">
                <ExplorerWorkflowInput
                  value={draft.maxCountText}
                  onChange={(event) => setDraft((currentDraft) => ({
                    ...currentDraft,
                    maxCountText: event.currentTarget.value,
                  }))}
                  placeholder="1"
                />
              </Field>
              <Field label="Allow Files">
                <BooleanToggle
                  value={draft.allowFiles}
                  onChange={(value) => setDraft((currentDraft) => ({
                    ...currentDraft,
                    allowFiles: value,
                  }))}
                />
              </Field>
              <Field label="Allow Folders">
                <BooleanToggle
                  value={draft.allowDirectories}
                  onChange={(value) => setDraft((currentDraft) => ({
                    ...currentDraft,
                    allowDirectories: value,
                  }))}
                />
              </Field>
            </ExplorerWorkflowFieldGrid>
          </ExplorerWorkflowSection>

          <ExplorerWorkflowSection title={draft.mode === 'workflow' ? 'Workflow' : 'Authoring'}>
            {draft.mode === 'workflow' ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <Field label="Workflow Id">
                  <ExplorerWorkflowInput
                    value={draft.workflowId}
                    onChange={(event) => setDraft((currentDraft) => ({
                      ...currentDraft,
                      workflowId: event.currentTarget.value,
                    }))}
                    placeholder="plugin.workflow-id"
                  />
                </Field>
                <Field label="Payload JSON">
                  <textarea
                    value={draft.workflowPayloadText}
                    onChange={(event) => setDraft((currentDraft) => ({
                      ...currentDraft,
                      workflowPayloadText: event.currentTarget.value,
                    }))}
                    style={codeTextAreaStyle}
                    rows={8}
                  />
                </Field>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {draft.mode === 'inline-shell' ? (
                  <Field label="Shell Body">
                    <textarea
                      value={draft.shellBody}
                      onChange={(event) => {
                        setScriptTouched(true);
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          shellBody: event.currentTarget.value,
                        }));
                      }}
                      style={codeTextAreaStyle}
                      rows={12}
                    />
                  </Field>
                ) : draft.mode === 'binary' ? (
                  <Field label="Binary Entry">
                    <ExplorerWorkflowInput
                      value={draft.entryRelativePath}
                      onChange={(event) => {
                        setEntryPathTouched(true);
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          entryRelativePath: event.currentTarget.value,
                        }));
                      }}
                      placeholder="bin/custom-tool.exe"
                    />
                  </Field>
                ) : (
                  <Field label={`${formatModeBadge(draft.mode)} Body`}>
                    <textarea
                      value={draft.scriptBody}
                      onChange={(event) => {
                        setScriptTouched(true);
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          scriptBody: event.currentTarget.value,
                        }));
                      }}
                      style={codeTextAreaStyle}
                      rows={draft.mode === 'cargo-rust' ? 16 : 12}
                    />
                  </Field>
                )}

                <div style={buttonClusterStyle}>
                  <ExplorerWorkflowButton
                    tone="ghost"
                    type="button"
                    onClick={() => {
                      setScriptTouched(false);
                      const nextBody = deriveDefaultBody(
                        draft.mode,
                        draft.actionName.trim() || 'Action',
                      );
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        scriptBody: nextBody,
                        shellBody: deriveDefaultBody('inline-shell', currentDraft.actionName.trim() || 'Action'),
                      }));
                    }}
                  >
                    <Sparkles size={14} />
                    Reset Template
                  </ExplorerWorkflowButton>
                  {showAdvanced ? (
                    <ExplorerWorkflowButton
                      tone="ghost"
                      type="button"
                      onClick={() => {
                        setEntryPathTouched(false);
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          entryRelativePath: deriveDefaultEntryRelativePath(
                            currentDraft.mode,
                            currentDraft.actionId,
                          ),
                        }));
                      }}
                      disabled={draft.mode === 'inline-shell' || draft.mode === 'workflow'}
                    >
                      <ChevronRight size={14} />
                      Reset Entry
                    </ExplorerWorkflowButton>
                  ) : null}
                </div>

                {showAdvanced ? (
                  <ExplorerWorkflowFieldGrid columns={2}>
                    <Field label="Entry Path">
                      <ExplorerWorkflowInput
                        value={draft.entryRelativePath}
                        onChange={(event) => {
                          setEntryPathTouched(true);
                          setDraft((currentDraft) => ({
                            ...currentDraft,
                            entryRelativePath: event.currentTarget.value,
                          }));
                        }}
                        placeholder="python/selection-snapshot.py"
                        disabled={draft.mode === 'inline-shell' || draft.mode === 'workflow'}
                      />
                    </Field>
                    <Field label="Runtime Override">
                      <ExplorerWorkflowInput
                        value={draft.runtimeOverride}
                        onChange={(event) => setDraft((currentDraft) => ({
                          ...currentDraft,
                          runtimeOverride: event.currentTarget.value,
                        }))}
                        placeholder="powershell / bun / python3"
                        disabled={draft.mode === 'workflow' || draft.mode === 'cargo-rust' || draft.mode === 'binary'}
                      />
                    </Field>
                    <Field label="Args (one per line)">
                      <textarea
                        value={draft.argsText}
                        onChange={(event) => setDraft((currentDraft) => ({
                          ...currentDraft,
                          argsText: event.currentTarget.value,
                        }))}
                        style={codeTextAreaStyle}
                        rows={5}
                        disabled={draft.mode === 'workflow'}
                      />
                    </Field>
                    <Field label="Env (KEY=value)">
                      <textarea
                        value={draft.envText}
                        onChange={(event) => setDraft((currentDraft) => ({
                          ...currentDraft,
                          envText: event.currentTarget.value,
                        }))}
                        style={codeTextAreaStyle}
                        rows={5}
                        disabled={draft.mode === 'workflow'}
                      />
                    </Field>
                  </ExplorerWorkflowFieldGrid>
                ) : null}
              </div>
            )}
          </ExplorerWorkflowSection>

          <ExplorerWorkflowSection title="Create">
            <div style={buttonClusterStyle}>
              <ExplorerWorkflowButton
                tone="accent"
                type="button"
                onClick={() => void writeGeneratedFiles()}
                disabled={blockingIssues.length > 0 || status.kind === 'saving'}
              >
                <TerminalSquare size={15} />
                {draft.overwriteExisting ? 'Create / Replace' : 'Create Action'}
              </ExplorerWorkflowButton>
              <ExplorerWorkflowButton
                tone="ghost"
                type="button"
                onClick={() => setDraft(() => createDefaultActionForgeDraft())}
              >
                Reset Draft
              </ExplorerWorkflowButton>
            </div>
            <div style={toggleRowStyle}>
              <BooleanToggle
                label="Overwrite Existing"
                value={draft.overwriteExisting}
                onChange={(value) => setDraft((currentDraft) => ({
                  ...currentDraft,
                  overwriteExisting: value,
                }))}
              />
              <BooleanToggle
                label="Reveal After Create"
                value={draft.revealAfterCreate}
                onChange={(value) => setDraft((currentDraft) => ({
                  ...currentDraft,
                  revealAfterCreate: value,
                }))}
              />
            </div>
          </ExplorerWorkflowSection>
        </div>

        <div style={rightColumnStyle}>
          <ExplorerWorkflowSection title="Preview">
            <div style={previewPathCardStyle}>
              <div style={previewPathLabelStyle}>Pack</div>
              <code style={pathCodeStyle}>{blueprint.packPath}</code>
              <div style={previewPathLabelStyle}>Action</div>
              <code style={pathCodeStyle}>{blueprint.actionPath}</code>
            </div>

            {issues.length > 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {issues.map((issue) => (
                  <ExplorerWorkflowStatusNotice
                    key={`${issue.field}:${issue.message}`}
                    tone={issue.level === 'error' ? 'danger' : 'warning'}
                  >
                    <strong>{issue.field}</strong>
                    {' '}
                    {issue.message}
                  </ExplorerWorkflowStatusNotice>
                ))}
              </div>
            ) : null}

            <PreviewCard
              label={actionFilePreview?.label || 'Action Manifest'}
              path={actionFilePreview?.path || blueprint.actionManifestPath}
              content={actionFilePreview?.content || ''}
              copied={copiedPreviewLabel === (actionFilePreview?.label || 'Action Manifest')}
              onCopy={() => void handleCopyPreview(
                actionFilePreview?.label || 'Action Manifest',
                actionFilePreview?.content || '',
              )}
            />

            {scriptFilePreview ? (
              <PreviewCard
                label={scriptFilePreview.label}
                path={scriptFilePreview.path}
                content={scriptFilePreview.content}
                copied={copiedPreviewLabel === scriptFilePreview.label}
                onCopy={() => void handleCopyPreview(scriptFilePreview.label, scriptFilePreview.content)}
              />
            ) : null}

            <PreviewCard
              label="File Plan"
              path={`${blueprint.packId} / ${blueprint.actionId}`}
              content={blueprint.files.map((file) => file.path).join('\n')}
              copied={copiedPreviewLabel === 'File Plan'}
              onCopy={() => void handleCopyPreview(
                'File Plan',
                blueprint.files.map((file) => file.path).join('\n'),
              )}
            />
          </ExplorerWorkflowSection>

          <ExplorerWorkflowSection title="Tokens">
            <div style={tokenGridStyle}>
              {ACTION_TOKENS.map((token) => (
                <button
                  key={token.key}
                  type="button"
                  onClick={() => void copyText(token.key)}
                  style={tokenCardStyle}
                  title={token.description}
                >
                  <code style={tokenKeyStyle}>{token.key}</code>
                  <span style={tokenDescriptionStyle}>{token.description}</span>
                </button>
              ))}
            </div>
          </ExplorerWorkflowSection>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children, span = 1 }) {
  return (
    <label style={{ ...fieldStyle, gridColumn: span > 1 ? `span ${span}` : undefined }}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

function ModeCard({ mode, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...modeCardStyle,
        borderColor: active
          ? 'var(--overlay-explorer-chip-active-border)'
          : 'var(--overlay-border)',
        background: active
          ? 'var(--overlay-explorer-chip-active-bg)'
          : 'var(--overlay-bg-panel)',
        color: active
          ? 'var(--overlay-explorer-chip-active-text)'
          : 'var(--overlay-text-primary)',
      }}
    >
      <span style={modeBadgeStyle}>{mode.badge}</span>
      <span style={{ display: 'grid', gap: 4, textAlign: 'left' }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{mode.label}</span>
        <span style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
          {mode.family}
        </span>
      </span>
    </button>
  );
}

function ModeToggleButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...pillButtonStyle,
        background: active
          ? 'var(--overlay-explorer-chip-active-bg)'
          : 'var(--overlay-bg-panel)',
        borderColor: active
          ? 'var(--overlay-explorer-chip-active-border)'
          : 'var(--overlay-border)',
        color: active
          ? 'var(--overlay-explorer-chip-active-text)'
          : 'var(--overlay-text-primary)',
      }}
    >
      {label}
    </button>
  );
}

function BooleanToggle({ label, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        ...booleanToggleStyle,
        background: value
          ? 'var(--overlay-explorer-chip-active-bg)'
          : 'var(--overlay-bg-panel)',
        borderColor: value
          ? 'var(--overlay-explorer-chip-active-border)'
          : 'var(--overlay-border)',
        color: value
          ? 'var(--overlay-explorer-chip-active-text)'
          : 'var(--overlay-text-primary)',
      }}
    >
      <span>{label || (value ? 'On' : 'Off')}</span>
      <span style={booleanToggleKnobStyle}>{value ? <Check size={12} /> : null}</span>
    </button>
  );
}

function PreviewCard({ label, path, content, onCopy, copied }) {
  return (
    <div style={previewCardStyle}>
      <div style={previewCardHeaderStyle}>
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <strong style={{ fontSize: 12 }}>{label}</strong>
          <code style={previewPathInlineStyle}>{path}</code>
        </div>
        <ExplorerWorkflowButton tone="ghost" type="button" onClick={onCopy}>
          <Copy size={13} />
          {copied ? 'Copied' : 'Copy'}
        </ExplorerWorkflowButton>
      </div>
      <pre style={previewPreStyle}>{content}</pre>
    </div>
  );
}

const ACTION_TOKENS = [
  { key: 'GREEBLEFS_PRIMARY_PATH', description: 'Primary entry path' },
  { key: 'GREEBLEFS_SELECTED_COUNT', description: 'Selected entry count' },
  { key: 'GREEBLEFS_CURRENT_LOCATION', description: 'Current explorer location' },
  { key: 'GREEBLEFS_ACTION_CONTEXT_FILE', description: 'JSON context payload path' },
  { key: 'GREEBLEFS_ACTION_PACK_ID', description: 'Pack id' },
  { key: 'GREEBLEFS_ACTION_ID', description: 'Action id' },
  { key: 'GREEBLEFS_ACTION_ROOT', description: 'Action folder root' },
];

const panelStyle = {
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  height: '100%',
  minHeight: 0,
  background: 'var(--overlay-bg-primary)',
  color: 'var(--overlay-text-primary)',
  fontFamily: 'var(--overlay-font-ui, sans-serif)',
};

const headerStyle = {
  display: 'grid',
  gap: 12,
  padding: 16,
  borderBottom: '1px solid var(--overlay-border)',
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-panel) 86%, transparent), var(--overlay-bg-primary))',
};

const headerTitleRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
};

const titleClusterStyle = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
};

const iconPlateStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 38,
  height: 38,
  borderRadius: 12,
  border: '1px solid var(--overlay-explorer-chip-active-border)',
  background: 'color-mix(in srgb, var(--overlay-explorer-chip-active-bg) 88%, transparent)',
  color: 'var(--overlay-explorer-chip-active-text)',
};

const titleStyle = {
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: '0.02em',
};

const toolbarStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const contentGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(290px, 1fr) minmax(360px, 1.15fr) minmax(320px, 1fr)',
  gap: 14,
  minHeight: 0,
  padding: 14,
  overflow: 'auto',
};

const leftColumnStyle = {
  display: 'grid',
  gap: 14,
  alignContent: 'start',
};

const centerColumnStyle = {
  display: 'grid',
  gap: 14,
  alignContent: 'start',
};

const rightColumnStyle = {
  display: 'grid',
  gap: 14,
  alignContent: 'start',
};

const fieldStyle = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
};

const fieldLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--overlay-text-muted)',
};

const selectStyle = {
  width: '100%',
  minHeight: 38,
  padding: '0 10px',
  border: '1px solid var(--overlay-explorer-input-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  background: 'var(--overlay-explorer-input-bg)',
  color: 'var(--overlay-text-primary)',
  font: 'inherit',
};

const textAreaStyle = {
  width: '100%',
  minHeight: 0,
  resize: 'vertical',
  border: '1px solid var(--overlay-explorer-input-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  background: 'var(--overlay-explorer-input-bg)',
  color: 'var(--overlay-text-primary)',
  padding: '10px 12px',
  font: 'inherit',
  boxSizing: 'border-box',
};

const codeTextAreaStyle = {
  ...textAreaStyle,
  fontFamily: 'var(--overlay-font-mono, ui-monospace, monospace)',
  fontSize: 11.5,
  lineHeight: 1.55,
};

const toggleRowStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const toggleWrapStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const buttonClusterStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const pillButtonStyle = {
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-bg-panel)',
  color: 'var(--overlay-text-primary)',
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
};

const booleanToggleStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minHeight: 34,
  padding: '0 10px 0 12px',
  borderRadius: 999,
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-bg-panel)',
  color: 'var(--overlay-text-primary)',
  cursor: 'pointer',
  fontSize: 11.5,
  fontWeight: 700,
};

const booleanToggleKnobStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 20,
  height: 20,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--overlay-bg-primary) 72%, transparent)',
};

const modeGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
  gap: 8,
};

const modeCardStyle = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  alignItems: 'center',
  gap: 10,
  minHeight: 60,
  padding: 10,
  borderRadius: 14,
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-bg-panel)',
  cursor: 'pointer',
};

const modeBadgeStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 34,
  height: 34,
  borderRadius: 10,
  background: 'color-mix(in srgb, var(--overlay-bg-primary) 72%, transparent)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
};

const packCardStyle = {
  display: 'grid',
  gap: 6,
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-bg-primary)',
};

const packCardTitleStyle = {
  fontSize: 13,
  fontWeight: 800,
};

const packCardMetaStyle = {
  fontSize: 11,
  color: 'var(--overlay-text-muted)',
  overflowWrap: 'anywhere',
};

const packActionRowStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 4,
};

const previewCardStyle = {
  display: 'grid',
  gap: 0,
  borderRadius: 14,
  overflow: 'hidden',
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-bg-panel)',
};

const previewCardHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  padding: '10px 12px',
  borderBottom: '1px solid var(--overlay-border)',
};

const previewPreStyle = {
  margin: 0,
  padding: 12,
  maxHeight: 280,
  overflow: 'auto',
  fontSize: 11.5,
  lineHeight: 1.55,
  fontFamily: 'var(--overlay-font-mono, ui-monospace, monospace)',
  color: 'var(--overlay-text-primary)',
};

const previewPathInlineStyle = {
  fontSize: 10.5,
  color: 'var(--overlay-text-muted)',
  fontFamily: 'var(--overlay-font-mono, ui-monospace, monospace)',
  overflowWrap: 'anywhere',
};

const previewPathCardStyle = {
  display: 'grid',
  gap: 6,
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-bg-primary)',
};

const previewPathLabelStyle = {
  fontSize: 10.5,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--overlay-text-muted)',
  fontWeight: 700,
};

const pathCodeStyle = {
  fontSize: 11,
  color: 'var(--overlay-text-primary)',
  fontFamily: 'var(--overlay-font-mono, ui-monospace, monospace)',
  overflowWrap: 'anywhere',
};

const tokenGridStyle = {
  display: 'grid',
  gap: 8,
};

const tokenCardStyle = {
  display: 'grid',
  gap: 4,
  padding: 10,
  borderRadius: 12,
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-bg-primary)',
  textAlign: 'left',
  cursor: 'pointer',
};

const tokenKeyStyle = {
  fontSize: 11,
  color: 'var(--overlay-text-primary)',
  fontFamily: 'var(--overlay-font-mono, ui-monospace, monospace)',
};

const tokenDescriptionStyle = {
  fontSize: 11,
  color: 'var(--overlay-text-muted)',
};

export default definePlugin({
  name: 'Action Forge',
  description: 'Create GreebleFS explorer actions directly into usr/actions.',
  keepMounted: true,
  component: ActionForgePanel,
});
