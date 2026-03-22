export interface OverlayPluginCommandContribution {
  id: string;
  pluginId: string;
  pluginName: string;
  name: string;
  command: string;
  description?: string;
  runOnSelect: boolean;
}

export interface OverlayPluginExplorerActionContribution {
  id: string;
  pluginId: string;
  pluginName: string;
  label: string;
  command: string;
  description?: string;
  appliesTo: 'any' | 'file' | 'directory';
  runOnSelect: boolean;
}

export interface OverlayPluginCommandContext {
  path: string;
  name: string;
  parent: string;
  extension: string;
  stem: string;
  isDirectory: boolean;
  pluginId: string;
  pluginName: string;
}

export interface OverlayTerminalCommandInjectionDetail {
  command: string;
  run?: boolean;
}

export function resolvePluginCommandTemplate(
  template: string,
  context: OverlayPluginCommandContext,
): string {
  const replacements: Record<string, string> = {
    '{path}': context.path,
    '{name}': context.name,
    '{parent}': context.parent,
    '{extension}': context.extension,
    '{stem}': context.stem,
    '{pluginId}': context.pluginId,
    '{pluginName}': context.pluginName,
    '{kind}': context.isDirectory ? 'directory' : 'file',
  };

  return Object.entries(replacements).reduce(
    (resolved, [token, value]) => resolved.split(token).join(value),
    template,
  );
}

export function dispatchTerminalCommand(command: string, run = false): void {
  if (typeof window === 'undefined' || !command.trim()) {
    return;
  }

  window.dispatchEvent(new CustomEvent<OverlayTerminalCommandInjectionDetail>('overlayterm:cmdinject', {
    detail: {
      command,
      run,
    },
  }));
}
