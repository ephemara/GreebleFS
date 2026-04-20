export interface ExplorerDraftSerializer<T> {
  deserialize: (raw: string) => T | null;
  serialize: (draft: T) => string;
}

export type ExplorerEditValidator<T> = (draft: T) => string | null;

const EXPLORER_EDIT_DRAFT_STORAGE_PREFIX = "greeblefs:explorer-edit-draft:v1:";

export function createStringExplorerDraftSerializer(): ExplorerDraftSerializer<string> {
  return {
    deserialize: (raw) => raw,
    serialize: (draft) => draft,
  };
}

export function createJsonExplorerDraftSerializer<T>(): ExplorerDraftSerializer<T> {
  return {
    deserialize: (raw) => {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    serialize: (draft) => JSON.stringify(draft),
  };
}

export function loadExplorerEditDraft<T>(
  scope: string,
  path: string,
  serializer: ExplorerDraftSerializer<T>,
): T | null {
  const storage = getExplorerEditDraftStorage();
  if (!storage) {
    return null;
  }

  try {
    const rawDraft = storage.getItem(buildExplorerEditDraftStorageKey(scope, path));
    if (!rawDraft) {
      return null;
    }
    return serializer.deserialize(rawDraft);
  } catch {
    return null;
  }
}

export function persistExplorerEditDraft<T>(
  scope: string,
  path: string,
  draft: T,
  serializer: ExplorerDraftSerializer<T>,
): void {
  const storage = getExplorerEditDraftStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      buildExplorerEditDraftStorageKey(scope, path),
      serializer.serialize(draft),
    );
  } catch {
    // Ignore storage failures; the in-memory editor state is still preserved.
  }
}

export function clearExplorerEditDraft(scope: string, path: string): void {
  const storage = getExplorerEditDraftStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(buildExplorerEditDraftStorageKey(scope, path));
  } catch {
    // Ignore storage failures.
  }
}

export function moveExplorerEditDraft(
  scope: string,
  fromPath: string,
  toPath: string,
): void {
  const storage = getExplorerEditDraftStorage();
  if (!storage) {
    return;
  }

  const sourceKey = buildExplorerEditDraftStorageKey(scope, fromPath);
  const targetKey = buildExplorerEditDraftStorageKey(scope, toPath);
  try {
    const rawDraft = storage.getItem(sourceKey);
    if (rawDraft == null) {
      return;
    }
    storage.setItem(targetKey, rawDraft);
    storage.removeItem(sourceKey);
  } catch {
    // Ignore storage failures.
  }
}

export function validateExplorerEditDraft<T>(
  draft: T,
  validator?: ExplorerEditValidator<T>,
): {
  accepted: boolean;
  error: string | null;
} {
  if (!validator) {
    return {
      accepted: true,
      error: null,
    };
  }

  try {
    const validationError = validator(draft);
    return validationError
      ? {
          accepted: false,
          error: validationError,
        }
      : {
          accepted: true,
          error: null,
        };
  } catch (error) {
    return {
      accepted: false,
      error: normalizeExplorerEditError(error),
    };
  }
}

export function buildExplorerDraftPreservedMessage(error: unknown): string {
  const detail = normalizeExplorerEditError(error);
  return detail
    ? `${detail} Draft preserved; use Save to retry.`
    : "Save failed. Draft preserved; use Save to retry.";
}

function buildExplorerEditDraftStorageKey(scope: string, path: string): string {
  return `${EXPLORER_EDIT_DRAFT_STORAGE_PREFIX}${encodeURIComponent(scope)}::${encodeURIComponent(path)}`;
}

function getExplorerEditDraftStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function normalizeExplorerEditError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || String(error);
  }
  return String(error);
}
