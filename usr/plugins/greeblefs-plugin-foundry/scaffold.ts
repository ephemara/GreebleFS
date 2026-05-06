export type PluginFoundryTargetLane = 'plugins' | 'packages';
export type PluginFoundrySourceVisibility = 'open' | 'hybrid' | 'compiled' | 'private';
export type PluginFoundryStarterKitId =
  | 'panel-plugin'
  | 'open-plugin-kit'
  | 'workflow-tool'
  | 'preview-workbench'
  | 'library-package';

export interface PluginFoundryStarterKitDefinition {
  id: PluginFoundryStarterKitId;
  title: string;
  eyebrow: string;
  summary: string;
  lane: PluginFoundryTargetLane;
  category: string;
  description: string;
  visibility: PluginFoundrySourceVisibility;
  requiresEntry: boolean;
  exportsModule: boolean;
}

export interface PluginFoundryDraft {
  starterKitId: PluginFoundryStarterKitId;
  targetLane: PluginFoundryTargetLane;
  name: string;
  id: string;
  version: string;
  description: string;
  category: string;
  tagsText: string;
  sourceVisibility: PluginFoundrySourceVisibility;
  moduleExportId: string;
  includeReadme: boolean;
  includeUiDependency: boolean;
  includeToolsDependency: boolean;
  defaultOpen: boolean;
  keepMounted: boolean;
  permissionFsRead: boolean;
  permissionFsWrite: boolean;
  permissionFsWatch: boolean;
  includeOpenExplorerIntent: boolean;
  workflowId: string;
  workflowTitle: string;
  workflowDescription: string;
  workflowContextsText: string;
  workflowDefaultSize: 'sm' | 'md' | 'lg' | 'xl';
  previewLaneId: string;
  previewTitle: string;
  previewDescription: string;
  previewExtensionsText: string;
  previewKindsText: string;
  previewEditable: boolean;
  previewSave: boolean;
  previewWorkflowTabs: boolean;
  exportSymbolName: string;
  readmeTitle: string;
  revealAfterCreate: boolean;
  overwriteExisting: boolean;
}

export interface PluginFoundryValidationIssue {
  level: 'error' | 'warning';
  field: string;
  message: string;
}

export interface PluginFoundryGeneratedFile {
  label: string;
  relativePath: string;
  path: string;
  language: 'toml' | 'tsx' | 'ts' | 'md';
  content: string;
}

export interface PluginFoundryBlueprint {
  starterKit: PluginFoundryStarterKitDefinition;
  packageId: string;
  packageName: string;
  packagePath: string;
  manifestPath: string;
  targetLane: PluginFoundryTargetLane;
  packageKind: 'plugin' | 'library';
  sourceVisibility: PluginFoundrySourceVisibility;
  exportModuleId?: string;
  entryPath?: string;
  files: PluginFoundryGeneratedFile[];
  issues: PluginFoundryValidationIssue[];
  dependencies: Array<{
    id: string;
    version: string;
    importAs: string;
  }>;
}

export const PLUGIN_FOUNDRY_STARTER_KITS: PluginFoundryStarterKitDefinition[] = [
  {
    id: 'panel-plugin',
    title: 'Panel Plugin',
    eyebrow: 'Panel',
    summary: 'A sharp shared-ui panel with storage-backed draft state.',
    lane: 'plugins',
    category: 'First-party Experiments',
    description: 'Starter for a visible package plugin panel.',
    visibility: 'private',
    requiresEntry: true,
    exportsModule: false,
  },
  {
    id: 'open-plugin-kit',
    title: 'Open Plugin Kit',
    eyebrow: 'Open Source',
    summary: 'A panel plugin that also exports source helpers to other plugins.',
    lane: 'plugins',
    category: 'First-party Developer Tools',
    description: 'Starter for a panel plugin with an open cross-plugin export surface.',
    visibility: 'open',
    requiresEntry: true,
    exportsModule: true,
  },
  {
    id: 'workflow-tool',
    title: 'Workflow Tool',
    eyebrow: 'Workflow',
    summary: 'A panel plus an explorer workflow contribution stub.',
    lane: 'plugins',
    category: 'First-party Automation',
    description: 'Starter for a panel plugin that launches an explorer workflow.',
    visibility: 'private',
    requiresEntry: true,
    exportsModule: false,
  },
  {
    id: 'preview-workbench',
    title: 'Preview Workbench',
    eyebrow: 'Preview',
    summary: 'A package plugin with a preview lane and a matching manager panel.',
    lane: 'plugins',
    category: 'First-party Workbenches',
    description: 'Starter for a preview lane workbench package.',
    visibility: 'private',
    requiresEntry: true,
    exportsModule: false,
  },
  {
    id: 'library-package',
    title: 'Library Package',
    eyebrow: 'Library',
    summary: 'A reusable dependency package under usr/packages.',
    lane: 'packages',
    category: 'First-party Libraries',
    description: 'Starter for a bare-importable shared package.',
    visibility: 'open',
    requiresEntry: false,
    exportsModule: true,
  },
];

const DEFAULT_TAGS = {
  plugins: 'first-party, plugin, foundry',
  packages: 'first-party, library, foundry',
};

export function createDefaultPluginFoundryDraft(): PluginFoundryDraft {
  return {
    starterKitId: 'panel-plugin',
    targetLane: 'plugins',
    name: 'Neon Slate Studio',
    id: 'neon-slate-studio',
    version: '1',
    description: 'A dense first-party starter built through Plugin Foundry.',
    category: 'First-party Experiments',
    tagsText: DEFAULT_TAGS.plugins,
    sourceVisibility: 'private',
    moduleExportId: '',
    includeReadme: true,
    includeUiDependency: true,
    includeToolsDependency: true,
    defaultOpen: false,
    keepMounted: true,
    permissionFsRead: false,
    permissionFsWrite: false,
    permissionFsWatch: false,
    includeOpenExplorerIntent: true,
    workflowId: 'rename-slate',
    workflowTitle: 'Rename Slate',
    workflowDescription: 'A starter explorer workflow emitted by Plugin Foundry.',
    workflowContextsText: 'background, entry',
    workflowDefaultSize: 'lg',
    previewLaneId: 'studio-preview',
    previewTitle: 'Studio Preview',
    previewDescription: 'A starter preview workbench emitted by Plugin Foundry.',
    previewExtensionsText: 'md, txt',
    previewKindsText: 'text',
    previewEditable: true,
    previewSave: true,
    previewWorkflowTabs: true,
    exportSymbolName: 'createStudioStarter',
    readmeTitle: 'Plugin Foundry Starter',
    revealAfterCreate: true,
    overwriteExisting: false,
  };
}

export function applyStarterKitDefaults(
  currentDraft: PluginFoundryDraft,
  starterKitId: PluginFoundryStarterKitId,
): PluginFoundryDraft {
  const starterKit = getPluginFoundryStarterKit(starterKitId);
  const baseId = sanitizeSlug(currentDraft.id || currentDraft.name, 'plugin-foundry-starter');
  const nextId = starterKitId === 'library-package'
    ? baseId.replace(/^greeblefs-/, '')
    : baseId;
  const previewLaneId = sanitizeSlug(currentDraft.previewLaneId || currentDraft.name, 'studio-preview');
  const workflowId = sanitizeSlug(currentDraft.workflowId || currentDraft.name, 'rename-slate');

  return {
    ...currentDraft,
    starterKitId,
    targetLane: starterKit.lane,
    category: starterKit.category,
    sourceVisibility: starterKit.visibility,
    includeUiDependency: starterKit.id !== 'library-package',
    includeToolsDependency: starterKit.id !== 'library-package',
    includeReadme: true,
    defaultOpen: false,
    keepMounted: true,
    permissionFsRead: starterKitId === 'preview-workbench',
    permissionFsWrite: false,
    permissionFsWatch: false,
    includeOpenExplorerIntent: true,
    id: nextId,
    tagsText: starterKit.lane === 'packages' ? DEFAULT_TAGS.packages : DEFAULT_TAGS.plugins,
    moduleExportId: starterKit.exportsModule
      ? buildDefaultModuleExportId(starterKitId, nextId)
      : '',
    exportSymbolName: buildDefaultExportSymbolName(nextId),
    workflowId,
    workflowTitle: titleCaseSlug(workflowId),
    workflowDescription: 'A starter explorer workflow emitted by Plugin Foundry.',
    previewLaneId,
    previewTitle: titleCaseSlug(previewLaneId),
    previewDescription: 'A starter preview workbench emitted by Plugin Foundry.',
  };
}

export function getPluginFoundryStarterKit(
  starterKitId: PluginFoundryStarterKitId,
): PluginFoundryStarterKitDefinition {
  return PLUGIN_FOUNDRY_STARTER_KITS.find((kit) => kit.id === starterKitId)
    ?? PLUGIN_FOUNDRY_STARTER_KITS[0];
}

export function normalizePluginFoundryPath(path: string): '/' | '\\' {
  const slashIndex = path.lastIndexOf('/');
  const backslashIndex = path.lastIndexOf('\\');
  return backslashIndex > slashIndex ? '\\' : '/';
}

export function joinPluginFoundryPath(basePath: string, ...segments: string[]): string {
  const separator = normalizePluginFoundryPath(basePath);
  const base = String(basePath ?? '').replace(/[\\/]+$/g, '');
  const suffix = segments
    .flatMap((segment) => String(segment ?? '').trim().split(/[\\/]+/g))
    .filter(Boolean)
    .join(separator);
  return suffix ? `${base}${separator}${suffix}` : base;
}

export function resolveUsrRoot(pluginDirectory: string): string {
  const separator = normalizePluginFoundryPath(pluginDirectory);
  const segments = String(pluginDirectory ?? '').split(/[\\/]+/g);
  const usrIndex = segments.findIndex((segment) => segment.toLowerCase() === 'usr');
  if (usrIndex < 0) {
    return String(pluginDirectory ?? '').replace(/[\\/]+$/g, '');
  }
  return segments.slice(0, usrIndex + 1).join(separator);
}

export function sanitizeSlug(value: string, fallback: string): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function titleCaseSlug(value: string): string {
  return sanitizeSlug(value, 'untitled')
    .split('-')
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ');
}

export function pascalCaseSlug(value: string): string {
  return titleCaseSlug(value).replace(/\s+/g, '');
}

export function parseListText(value: string, splitPattern: RegExp): string[] {
  return String(value ?? '')
    .split(splitPattern)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseTagsText(value: string): string[] {
  return [...new Set(parseListText(value, /[\n\r,;]+/g).map(tag => sanitizeSlug(tag, 'tag')))];
}

export function parsePreviewExtensionsText(value: string): string[] {
  return [...new Set(
    parseListText(value, /[\n\r,;\s]+/g)
      .map(extension => extension.replace(/^\.+/, '').toLowerCase())
      .filter(Boolean),
  )];
}

export function parsePreviewKindsText(value: string): string[] {
  return [...new Set(
    parseListText(value, /[\n\r,;\s]+/g)
      .map(kind => kind.toLowerCase())
      .filter(Boolean),
  )];
}

export function parseWorkflowContextsText(value: string): Array<'background' | 'entry'> {
  const parsed = parseListText(value, /[\n\r,;\s]+/g)
    .map(context => context.toLowerCase())
    .filter((context): context is 'background' | 'entry' => context === 'background' || context === 'entry');
  return parsed.length > 0 ? [...new Set(parsed)] : ['background'];
}

export function buildPluginFoundryBlueprint(options: {
  usrRoot: string;
  draft: PluginFoundryDraft;
}): PluginFoundryBlueprint {
  const starterKit = getPluginFoundryStarterKit(options.draft.starterKitId);
  const packageId = sanitizeSlug(options.draft.id || options.draft.name, 'plugin-foundry-starter');
  const packageName = options.draft.name.trim() || titleCaseSlug(packageId);
  const targetLane = options.draft.targetLane || starterKit.lane;
  const packageKind = starterKit.id === 'library-package' ? 'library' : 'plugin';
  const packagePath = joinPluginFoundryPath(options.usrRoot, targetLane, packageId);
  const manifestPath = joinPluginFoundryPath(packagePath, 'extension.toml');
  const sourceVisibility = starterKit.id === 'library-package'
    ? 'open'
    : options.draft.sourceVisibility;
  const dependencies = buildDependencies(options.draft, starterKit);
  const exportModuleId = starterKit.exportsModule
    ? normalizeModuleExportId(options.draft.moduleExportId, starterKit.id, packageId)
    : undefined;
  const issues = validatePluginFoundryDraft({
    starterKit,
    draft: options.draft,
    packageId,
    exportModuleId,
  });
  const files: PluginFoundryGeneratedFile[] = [];

  files.push({
    label: 'Package Manifest',
    relativePath: 'extension.toml',
    path: manifestPath,
    language: 'toml',
    content: buildManifestContent({
      starterKit,
      draft: options.draft,
      packageId,
      packageName,
      packageKind,
      sourceVisibility,
      exportModuleId,
      dependencies,
    }),
  });

  if (options.draft.includeReadme) {
    files.push({
      label: 'Package README',
      relativePath: 'README.md',
      path: joinPluginFoundryPath(packagePath, 'README.md'),
      language: 'md',
      content: buildReadmeContent({
        starterKit,
        draft: options.draft,
        packageId,
        packageName,
        packageKind,
        exportModuleId,
      }),
    });
  }

  let entryPath: string | undefined;

  if (starterKit.id === 'library-package') {
    files.push({
      label: 'Library Entry',
      relativePath: 'src/index.ts',
      path: joinPluginFoundryPath(packagePath, 'src/index.ts'),
      language: 'ts',
      content: buildLibraryModuleContent({
        packageId,
        packageName,
        exportSymbolName: normalizeExportSymbolName(options.draft.exportSymbolName, packageId),
      }),
    });
  } else {
    entryPath = 'index.tsx';
    files.push({
      label: 'Panel Entry',
      relativePath: 'index.tsx',
      path: joinPluginFoundryPath(packagePath, 'index.tsx'),
      language: 'tsx',
      content: buildPanelPluginContent({
        starterKit,
        packageId,
        packageName,
        description: options.draft.description,
        exportSymbolName: normalizeExportSymbolName(options.draft.exportSymbolName, packageId),
        exportModuleId,
      }),
    });

    if (starterKit.id === 'open-plugin-kit') {
      files.push({
        label: 'Open Export Surface',
        relativePath: 'exports.ts',
        path: joinPluginFoundryPath(packagePath, 'exports.ts'),
        language: 'ts',
        content: buildOpenPluginExportModule({
          packageId,
          packageName,
          exportSymbolName: normalizeExportSymbolName(options.draft.exportSymbolName, packageId),
        }),
      });
    }

    if (starterKit.id === 'workflow-tool') {
      const workflowFileName = `${sanitizeSlug(options.draft.workflowId, 'rename-slate')}Workflow.tsx`;
      files.push({
        label: 'Workflow Surface',
        relativePath: `workflows/${workflowFileName}`,
        path: joinPluginFoundryPath(packagePath, 'workflows', workflowFileName),
        language: 'tsx',
        content: buildWorkflowContent({
          workflowTitle: options.draft.workflowTitle.trim() || titleCaseSlug(options.draft.workflowId),
          workflowDescription: options.draft.workflowDescription.trim() || 'A starter workflow emitted by Plugin Foundry.',
          packageName,
        }),
      });
    }

    if (starterKit.id === 'preview-workbench') {
      const previewFileName = `${sanitizeSlug(options.draft.previewLaneId, 'studio-preview')}Workbench.tsx`;
      files.push({
        label: 'Preview Renderer',
        relativePath: `preview/${previewFileName}`,
        path: joinPluginFoundryPath(packagePath, 'preview', previewFileName),
        language: 'tsx',
        content: buildPreviewWorkbenchContent({
          previewTitle: options.draft.previewTitle.trim() || titleCaseSlug(options.draft.previewLaneId),
          previewDescription: options.draft.previewDescription.trim() || 'A starter preview workbench emitted by Plugin Foundry.',
        }),
      });
    }
  }

  return {
    starterKit,
    packageId,
    packageName,
    packagePath,
    manifestPath,
    targetLane,
    packageKind,
    sourceVisibility,
    exportModuleId,
    entryPath,
    files,
    issues,
    dependencies,
  };
}

function buildDependencies(
  draft: PluginFoundryDraft,
  starterKit: PluginFoundryStarterKitDefinition,
): Array<{ id: string; version: string; importAs: string }> {
  const dependencies: Array<{ id: string; version: string; importAs: string }> = [];
  if (starterKit.id !== 'library-package') {
    dependencies.push({
      id: 'greeblefs-ui',
      version: '^1.1.0',
      importAs: '@greeblefs/ui',
    });
  }
  if (starterKit.id !== 'library-package') {
    dependencies.push({
      id: 'greeblefs-plugin-tools',
      version: '^1.0.0',
      importAs: '@greeblefs/plugin-tools',
    });
  }
  return dependencies;
}

function validatePluginFoundryDraft(options: {
  starterKit: PluginFoundryStarterKitDefinition;
  draft: PluginFoundryDraft;
  packageId: string;
  exportModuleId?: string;
}): PluginFoundryValidationIssue[] {
  const issues: PluginFoundryValidationIssue[] = [];

  if (!options.packageId) {
    issues.push({
      level: 'error',
      field: 'id',
      message: 'Package id is required.',
    });
  }

  if (!options.draft.name.trim()) {
    issues.push({
      level: 'error',
      field: 'name',
      message: 'Package name is required.',
    });
  }

  if (options.starterKit.exportsModule && !options.exportModuleId) {
    issues.push({
      level: 'error',
      field: 'moduleExportId',
      message: 'This starter needs a valid bare import export id.',
    });
  }

  if (
    options.starterKit.id === 'preview-workbench'
    && parsePreviewKindsText(options.draft.previewKindsText).length === 0
  ) {
    issues.push({
      level: 'error',
      field: 'previewKindsText',
      message: 'Preview workbenches need at least one preview kind.',
    });
  }

  if (
    options.starterKit.id === 'workflow-tool'
    && !sanitizeSlug(options.draft.workflowId, '')
  ) {
    issues.push({
      level: 'error',
      field: 'workflowId',
      message: 'Workflow tools need a workflow id.',
    });
  }

  if (
    options.starterKit.id !== 'library-package'
    && options.draft.sourceVisibility === 'compiled'
    && options.starterKit.exportsModule
  ) {
    issues.push({
      level: 'warning',
      field: 'sourceVisibility',
      message: 'Compiled-source plugins cannot be imported as source by other plugins.',
    });
  }

  return issues;
}

function buildManifestContent(options: {
  starterKit: PluginFoundryStarterKitDefinition;
  draft: PluginFoundryDraft;
  packageId: string;
  packageName: string;
  packageKind: 'plugin' | 'library';
  sourceVisibility: PluginFoundrySourceVisibility;
  exportModuleId?: string;
  dependencies: Array<{ id: string; version: string; importAs: string }>;
}): string {
  const lines: string[] = [];
  const description = options.draft.description.trim() || options.starterKit.description;
  const category = options.draft.category.trim() || options.starterKit.category;
  const tags = parseTagsText(options.draft.tagsText);

  lines.push(`id = ${quoteToml(options.packageId)}`);
  lines.push(`version = ${quoteToml(options.draft.version.trim() || '1')}`);
  lines.push(`name = ${quoteToml(options.packageName)}`);
  lines.push(`description = ${quoteToml(description)}`);
  lines.push(`packageKind = ${quoteToml(options.packageKind)}`);

  if (options.packageKind === 'plugin' && options.starterKit.requiresEntry) {
    lines.push(`entry = ${quoteToml('index.tsx')}`);
    lines.push(`defaultOpen = ${options.draft.defaultOpen ? 'true' : 'false'}`);
    lines.push(`keepMounted = ${options.draft.keepMounted ? 'true' : 'false'}`);
  }

  lines.push(`category = ${quoteToml(category)}`);
  if (tags.length > 0) {
    lines.push(`tags = [${tags.map(quoteToml).join(', ')}]`);
  }

  lines.push('');
  lines.push('[source]');
  lines.push(`visibility = ${quoteToml(options.sourceVisibility)}`);

  if (options.packageKind === 'plugin') {
    const permissionLines = buildPermissionLines(options.draft);
    if (permissionLines.length > 0) {
      lines.push('');
      lines.push('[permissions]');
      lines.push(...permissionLines);
    }
  }

  if (options.exportModuleId) {
    lines.push('');
    lines.push('[exports.modules]');
    lines.push(`${quoteToml(options.exportModuleId)} = ${quoteToml(resolveExportEntry(options.starterKit.id))}`);
  }

  options.dependencies.forEach((dependency) => {
    lines.push('');
    lines.push('[[dependencies]]');
    lines.push(`id = ${quoteToml(dependency.id)}`);
    lines.push(`version = ${quoteToml(dependency.version)}`);
    lines.push(`importAs = ${quoteToml(dependency.importAs)}`);
    lines.push('required = true');
  });

  if (options.starterKit.id === 'workflow-tool') {
    const workflowId = sanitizeSlug(options.draft.workflowId, 'rename-slate');
    const workflowTitle = options.draft.workflowTitle.trim() || titleCaseSlug(workflowId);
    const workflowDescription = options.draft.workflowDescription.trim() || 'A starter workflow emitted by Plugin Foundry.';
    const workflowFileName = `${workflowId}Workflow.tsx`;
    lines.push('');
    lines.push('[[contributions.workflows]]');
    lines.push(`id = ${quoteToml(workflowId)}`);
    lines.push(`title = ${quoteToml(workflowTitle)}`);
    lines.push(`description = ${quoteToml(workflowDescription)}`);
    lines.push(`renderer = ${quoteToml(`workflows/${workflowFileName}`)}`);
    lines.push(`contexts = [${parseWorkflowContextsText(options.draft.workflowContextsText).map(quoteToml).join(', ')}]`);
    lines.push(`defaultSize = ${quoteToml(options.draft.workflowDefaultSize)}`);
  }

  if (options.starterKit.id === 'preview-workbench') {
    const previewLaneId = sanitizeSlug(options.draft.previewLaneId, 'studio-preview');
    const previewTitle = options.draft.previewTitle.trim() || titleCaseSlug(previewLaneId);
    const previewFileName = `${previewLaneId}Workbench.tsx`;
    const extensions = parsePreviewExtensionsText(options.draft.previewExtensionsText);
    const previewKinds = parsePreviewKindsText(options.draft.previewKindsText);

    lines.push('');
    lines.push('[[contributions.previewLanes]]');
    lines.push(`id = ${quoteToml(previewLaneId)}`);
    lines.push(`title = ${quoteToml(previewTitle)}`);
    lines.push(`renderer = ${quoteToml(`preview/${previewFileName}`)}`);
    lines.push('priority = 720');
    lines.push('');
    lines.push('[contributions.previewLanes.match]');
    lines.push(`appliesTo = ${quoteToml('file')}`);
    lines.push(`extensions = [${extensions.map(quoteToml).join(', ')}]`);
    lines.push('fileNames = []');
    lines.push(`previewKinds = [${previewKinds.map(quoteToml).join(', ')}]`);
    lines.push('');
    lines.push('[contributions.previewLanes.workbenchChrome]');
    lines.push('includePreviewTab = true');
    lines.push(`includeEditTab = ${options.draft.previewEditable ? 'true' : 'false'}`);
    lines.push('topBarDensity = "compact"');
    lines.push('');
    lines.push('[contributions.previewLanes.capabilities]');
    lines.push(`editable = ${options.draft.previewEditable ? 'true' : 'false'}`);
    lines.push(`save = ${options.draft.previewSave ? 'true' : 'false'}`);
    lines.push('export = false');
    lines.push(`workflowTabs = ${options.draft.previewWorkflowTabs ? 'true' : 'false'}`);
    lines.push('contextMenu = true');
    lines.push('prefetch = true');
    lines.push('closeGuard = false');
  }

  return `${lines.join('\n').trim()}\n`;
}

function buildPermissionLines(draft: PluginFoundryDraft): string[] {
  const lines: string[] = [];
  if (draft.permissionFsRead) {
    lines.push('fsRead = true');
  }
  if (draft.permissionFsWrite) {
    lines.push('fsWrite = true');
  }
  if (draft.permissionFsWatch) {
    lines.push('fsWatch = true');
  }
  if (draft.includeOpenExplorerIntent) {
    lines.push('launchIntents = ["open-explorer"]');
  }
  return lines;
}

function resolveExportEntry(starterKitId: PluginFoundryStarterKitId): string {
  return starterKitId === 'library-package' ? 'src/index.ts' : 'exports.ts';
}

function buildReadmeContent(options: {
  starterKit: PluginFoundryStarterKitDefinition;
  draft: PluginFoundryDraft;
  packageId: string;
  packageName: string;
  packageKind: 'plugin' | 'library';
  exportModuleId?: string;
}): string {
  const lines = [
    `# ${options.draft.readmeTitle.trim() || options.packageName}`,
    '',
    `${options.packageName} was scaffolded by GreebleFS Plugin Foundry as a ${options.starterKit.title.toLowerCase()}.`,
    '',
    `- Package id: \`${options.packageId}\``,
    `- Lane: \`usr/${options.starterKit.lane}\``,
    `- Kind: \`${options.packageKind}\``,
    `- Source visibility: \`${options.starterKit.id === 'library-package' ? 'open' : options.draft.sourceVisibility}\``,
  ];
  if (options.exportModuleId) {
    lines.push(`- Bare import: \`${options.exportModuleId}\``);
  }
  lines.push('');
  lines.push('## Next Moves');
  lines.push('');
  lines.push('- Tune the manifest metadata and dependency list.');
  lines.push('- Replace the starter UI or export helpers with real product logic.');
  lines.push('- Refresh plugins in GreebleFS so the new package is picked up immediately.');
  lines.push('');
  return `${lines.join('\n')}`.trim() + '\n';
}

function buildPanelPluginContent(options: {
  starterKit: PluginFoundryStarterKitDefinition;
  packageId: string;
  packageName: string;
  description: string;
  exportSymbolName: string;
  exportModuleId?: string;
}): string {
  const title = options.packageName;
  const description = options.description.trim() || options.starterKit.description;
  const componentName = `${pascalCaseSlug(options.packageId)}Panel`;
  const importExportSurface = options.starterKit.id === 'open-plugin-kit'
    ? `import { ${options.exportSymbolName}, starterSignals } from './exports';\n`
    : '';
  const exportSnippet = options.starterKit.id === 'open-plugin-kit'
    ? `
  const exported = React.useMemo(
    () => ${options.exportSymbolName}(plugin.id, api.host?.files ? 'host-file-lane' : 'hostless'),
    [api.host, plugin.id],
  );
`
    : '';
  const exportCardSnippet = options.starterKit.id === 'open-plugin-kit'
    ? `
        React.createElement(GreebleCard, null,
          React.createElement(GreebleCardHeader, {
            title: 'Open Export Surface',
            meta: ${quoteJsString(options.exportModuleId ?? '')},
          }),
          React.createElement(GreebleInline, { gap: 6 },
            ...starterSignals.map((signal) =>
              React.createElement(GreeblePill, { key: signal }, signal),
            ),
          ),
          React.createElement('div', null, exported.label),
        ),
`
    : '';

  return `
import React from 'react';
import { FolderOpen, RefreshCcw, Sparkles } from 'lucide-react';
import { definePlugin } from 'overlayterm-plugin';
import {
  GreebleButton,
  GreebleCard,
  GreebleCardHeader,
  GreebleHero,
  GreebleInline,
  GreebleKpiStrip,
  GreeblePill,
  GreebleStatusNotice,
  GreebleTextArea,
  GreebleWorkflowShell,
} from '@greeblefs/ui';
import { createPluginStore } from '@greeblefs/plugin-tools';
${importExportSurface}

const panelStore = {
  path: 'panel-state.json',
  defaults: {
    note: 'Ship something weird.',
    launchCount: 0,
  },
};

function ${componentName}({ plugin, api }) {
  const store = React.useMemo(
    () => createPluginStore(api, panelStore),
    [api],
  );
  const [panelState, setPanelState] = React.useState(panelStore.defaults);
  const [loaded, setLoaded] = React.useState(false);
${exportSnippet}

  React.useEffect(() => {
    let cancelled = false;
    store.load().then((nextState) => {
      if (!cancelled) {
        React.startTransition(() => {
          setPanelState({
            note: typeof nextState.note === 'string' ? nextState.note : panelStore.defaults.note,
            launchCount: typeof nextState.launchCount === 'number' ? nextState.launchCount + 1 : 1,
          });
          setLoaded(true);
        });
      }
    }).catch(() => {
      if (!cancelled) {
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  React.useEffect(() => {
    if (!loaded) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void store.save(panelState).catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loaded, panelState, store]);

  return React.createElement(
    GreebleWorkflowShell,
    {
      title: ${quoteJsString(title)},
      eyebrow: ${quoteJsString(options.starterKit.eyebrow)},
      actions: React.createElement(GreebleInline, { gap: 6 },
        React.createElement(GreebleButton, {
          type: 'button',
          onClick: () => void api.refreshPlugins(),
        }, React.createElement(RefreshCcw, { size: 14 }), 'Refresh'),
        React.createElement(GreebleButton, {
          type: 'button',
          onClick: () => void api.host.explorer.openPath(plugin.pluginDirectory).catch(() => undefined),
        }, React.createElement(FolderOpen, { size: 14 }), 'Open Folder'),
      ),
    },
    React.createElement(GreebleHero, {
      title: ${quoteJsString(title)},
      eyebrow: 'Plugin Foundry Starter',
      metric: 'v1',
    }, ${quoteJsString(description)}),
    React.createElement(GreebleKpiStrip, {
      metrics: [
        { label: 'Launches', value: String(panelState.launchCount) },
        { label: 'Storage', value: 'Live' },
        { label: 'Root', value: plugin.pluginRoot.endsWith('packages') ? 'Packages' : 'Plugins' },
      ],
    }),
    React.createElement(GreebleStatusNotice, {
      tone: 'success',
      title: 'Starter Ready',
    }, 'This panel already runs on shared UI, plugin storage, and refresh hooks.'),
    React.createElement(GreebleCard, null,
      React.createElement(GreebleCardHeader, {
        title: 'Persistent Note',
        meta: plugin.id,
      }),
      React.createElement(GreebleTextArea, {
        value: panelState.note,
        onChange: (event) => setPanelState((currentState) => ({
          ...currentState,
          note: event.target.value,
        })),
      }),
    ),
${exportCardSnippet}
  );
}

export default definePlugin({
  name: ${quoteJsString(title)},
  description: ${quoteJsString(description)},
  component: ${componentName},
});
`.trim() + '\n';
}

function buildOpenPluginExportModule(options: {
  packageId: string;
  packageName: string;
  exportSymbolName: string;
}): string {
  return `
export const starterSignals = ['open', 'shared', 'source-ready'];

export function ${options.exportSymbolName}(pluginId: string, transport: string) {
  return {
    pluginId,
    transport,
    label: ${quoteJsString(`${options.packageName} is exposing a reusable source surface.`)},
  };
}
`.trim() + '\n';
}

function buildWorkflowContent(options: {
  workflowTitle: string;
  workflowDescription: string;
  packageName: string;
}): string {
  const componentName = `${pascalCaseSlug(options.workflowTitle)}Workflow`;
  return `
import React from 'react';
import { defineWorkflow } from 'overlayterm-plugin';
import {
  GreebleButton,
  GreebleFieldLabel,
  GreebleInput,
  GreebleStatusNotice,
  GreebleWorkflowShell,
} from '@greeblefs/ui';

function ${componentName}() {
  const [value, setValue] = React.useState('');
  return React.createElement(
    GreebleWorkflowShell,
    {
      title: ${quoteJsString(options.workflowTitle)},
      eyebrow: ${quoteJsString(options.packageName)},
      footer: React.createElement(GreebleButton, { type: 'button' }, 'Run'),
    },
    React.createElement(GreebleStatusNotice, { tone: 'warning', title: 'Starter Workflow' }, ${quoteJsString(options.workflowDescription)}),
    React.createElement(GreebleFieldLabel, { label: 'Rename Pattern' },
      React.createElement(GreebleInput, {
        value,
        placeholder: 'shot-{index}',
        onChange: (event) => setValue(event.target.value),
      }),
    ),
  );
}

export default defineWorkflow({
  component: ${componentName},
  descriptor: {
    title: ${quoteJsString(options.workflowTitle)},
    description: ${quoteJsString(options.workflowDescription)},
    contexts: ['background', 'entry'],
    defaultSize: 'lg',
  },
});
`.trim() + '\n';
}

function buildPreviewWorkbenchContent(options: {
  previewTitle: string;
  previewDescription: string;
}): string {
  const componentName = `${pascalCaseSlug(options.previewTitle)}Workbench`;
  return `
import React from 'react';
import { definePreviewLane } from 'overlayterm-plugin';
import {
  GreebleCard,
  GreebleCardHeader,
  GreebleStatusNotice,
  GreebleWorkflowShell,
} from '@greeblefs/ui';

function ${componentName}({ file }) {
  return React.createElement(
    GreebleWorkflowShell,
    {
      title: ${quoteJsString(options.previewTitle)},
      eyebrow: 'Preview Starter',
    },
    React.createElement(GreebleStatusNotice, {
      tone: 'success',
      title: 'Preview Lane Ready',
    }, ${quoteJsString(options.previewDescription)}),
    React.createElement(GreebleCard, null,
      React.createElement(GreebleCardHeader, {
        title: file?.name ?? 'No file',
        meta: file?.extension ?? 'unknown',
      }),
      React.createElement('div', null, file?.path ?? 'Attach this workbench to a preview match rule.'),
    ),
  );
}

export default definePreviewLane({
  component: ${componentName},
});
`.trim() + '\n';
}

function buildLibraryModuleContent(options: {
  packageId: string;
  packageName: string;
  exportSymbolName: string;
}): string {
  return `
export const ${options.exportSymbolName}Version = '1.0.0';

export function ${options.exportSymbolName}(name: string) {
  return {
    id: ${quoteJsString(options.packageId)},
    label: \`\${name} from ${options.packageName}\`,
    tags: ['library', 'plugin-foundry', 'starter'],
  };
}
`.trim() + '\n';
}

function normalizeModuleExportId(
  value: string,
  starterKitId: PluginFoundryStarterKitId,
  packageId: string,
): string {
  const trimmed = String(value ?? '').trim();
  return trimmed || buildDefaultModuleExportId(starterKitId, packageId);
}

function buildDefaultModuleExportId(
  starterKitId: PluginFoundryStarterKitId,
  packageId: string,
): string {
  return starterKitId === 'library-package'
    ? `@greeblefs/${packageId}`
    : `@greeblefs/${packageId}/scaffold`;
}

function normalizeExportSymbolName(value: string, packageId: string): string {
  const trimmed = String(value ?? '').trim();
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(trimmed)
    ? trimmed
    : buildDefaultExportSymbolName(packageId);
}

function buildDefaultExportSymbolName(packageId: string): string {
  return `create${pascalCaseSlug(packageId)}Preset`;
}

function quoteToml(value: string): string {
  return JSON.stringify(String(value ?? ''));
}

function quoteJsString(value: string): string {
  return JSON.stringify(String(value ?? ''));
}
