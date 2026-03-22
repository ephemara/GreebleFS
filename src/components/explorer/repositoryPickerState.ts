export interface RepositoryPickerConfirmationArgs {
  allowMultiple: boolean;
  currentPath: string;
  hasAnySelection: boolean;
  selectedDirectoryPaths: string[];
}

export function resolveRepositoryPickerConfirmationPaths({
  allowMultiple,
  currentPath,
  hasAnySelection,
  selectedDirectoryPaths,
}: RepositoryPickerConfirmationArgs): string[] {
  const selectedPaths = sanitizeRepositoryPickerPaths(selectedDirectoryPaths);
  if (selectedPaths.length > 0) {
    return allowMultiple ? selectedPaths : [selectedPaths[0]];
  }

  const normalizedCurrentPath = currentPath.trim();
  if (hasAnySelection || !normalizedCurrentPath) {
    return [];
  }

  return [normalizedCurrentPath];
}

export function getRepositoryPickerConfirmLabel(args: {
  allowMultiple: boolean;
  currentPath: string;
  hasAnySelection: boolean;
  selectedDirectoryCount: number;
}): string {
  if (args.selectedDirectoryCount > 0) {
    if (!args.allowMultiple || args.selectedDirectoryCount === 1) {
      return 'Add Selected Folder';
    }

    return `Add ${args.selectedDirectoryCount} Folders`;
  }

  if (!args.hasAnySelection && args.currentPath.trim()) {
    return 'Add Current Folder';
  }

  return 'Add Selected';
}

function sanitizeRepositoryPickerPaths(paths: string[]): string[] {
  const uniquePaths = new Set<string>();

  for (const path of paths) {
    const normalizedPath = path.trim();
    if (!normalizedPath || uniquePaths.has(normalizedPath)) {
      continue;
    }

    uniquePaths.add(normalizedPath);
  }

  return [...uniquePaths];
}
