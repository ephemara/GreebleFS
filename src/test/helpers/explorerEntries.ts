import type {
  ExplorerFileEntry,
  ExplorerFileTransferResult,
  ExplorerLocationListing,
} from "../../runtime/explorerBackend";

export function createTestExplorerFileEntry(
  overrides: Partial<ExplorerFileEntry> &
    Pick<ExplorerFileEntry, "name" | "path">,
): ExplorerFileEntry {
  const isDirectory = overrides.is_dir ?? false;
  const size = overrides.size ?? 0;
  const modified = overrides.modified ?? 0;
  const extension = overrides.extension ?? "";
  const isSymlink = overrides.is_symlink ?? false;
  const path = overrides.path;

  return {
    name: overrides.name,
    path,
    is_dir: isDirectory,
    size,
    modified,
    extension,
    is_hidden: overrides.is_hidden ?? false,
    is_symlink: isSymlink,
    entityId: overrides.entityId ?? `test:${path}`,
    identityKind: overrides.identityKind ?? "derived",
    contentRevision:
      overrides.contentRevision ??
      [
        path,
        isDirectory ? "dir" : "file",
        size,
        modified,
        extension,
        isSymlink ? "symlink" : "direct",
      ].join("::"),
  };
}

export function createTestExplorerLocationListing(args: {
  path: string;
  entries: ExplorerFileEntry[];
  kind?: ExplorerLocationListing["kind"];
  parentPath?: string | null;
  breadcrumbs?: ExplorerLocationListing["breadcrumbs"];
}): ExplorerLocationListing {
  return {
    kind: args.kind ?? "local",
    path: args.path,
    parentPath: args.parentPath ?? null,
    breadcrumbs: args.breadcrumbs ?? [],
    entries: args.entries,
  };
}

export function createTestExplorerTransferResult(
  overrides: Partial<ExplorerFileTransferResult> &
    Pick<
      ExplorerFileTransferResult,
      | "source_path"
      | "destination_path"
      | "operation"
      | "collision_policy"
      | "disposition"
    >,
): ExplorerFileTransferResult {
  return {
    source_path: overrides.source_path,
    destination_path: overrides.destination_path,
    operation: overrides.operation,
    collision_policy: overrides.collision_policy,
    disposition: overrides.disposition,
    entityId: overrides.entityId ?? `test:${overrides.destination_path}`,
    identityKind: overrides.identityKind ?? "derived",
    contentRevision:
      overrides.contentRevision ??
      [
        overrides.source_path,
        overrides.destination_path,
        overrides.operation,
        overrides.disposition,
      ].join("::"),
  };
}
