import type { FileEntry } from "../generated/tauri";
import { resolveGreebleNativeLaneSelection } from "../config/nativeLaneMigration";
import {
  isExplorerNativePoolAvailable,
  listLocalExplorerDirectorySnapshotViaNativePool,
  recordExplorerNativePoolAttempt,
  recordExplorerNativePoolFallback,
  recordExplorerNativePoolSuccess,
} from "./explorerNativePool";
import {
  tryListExplorerPathIndexDirectory,
  warmExplorerPathIndexForPath,
} from "./explorerPathIndex";
import { commands, unwrapTauriResult } from "./tauriClient";

export interface LocalDirectoryListingOptions {
  showHidden?: boolean;
  bypassCache?: boolean;
  /**
   * Durable path-index reads are deliberately opt-in. Generic frontend catalog
   * discovery should use the live native-buffer listing lane without kicking
   * off recursive index builds during app startup.
   */
  allowPathIndex?: boolean;
  allowNativePool?: boolean;
}

export async function listLocalDirectoryEntriesFast(
  path: string,
  options: LocalDirectoryListingOptions = {},
): Promise<FileEntry[]> {
  const showHidden = options.showHidden ?? false;
  const bypassCache = options.bypassCache ?? false;
  const allowPathIndex = options.allowPathIndex ?? false;
  const allowNativePool = options.allowNativePool ?? true;

  if (!bypassCache && allowPathIndex) {
    warmExplorerPathIndexForPath(path);
    const indexedEntries = await tryListExplorerPathIndexDirectory({
      path,
      showHidden,
    });
    if (indexedEntries) {
      return indexedEntries;
    }
  }

  if (allowNativePool && shouldUseDirectoryListingNativeBufferPool()) {
    recordExplorerNativePoolAttempt("directoryListingSnapshots");
    try {
      const entries = await listLocalExplorerDirectorySnapshotViaNativePool({
        path,
        showHidden,
        bypassCache,
      });
      recordExplorerNativePoolSuccess("directoryListingSnapshots");
      return entries;
    } catch (error) {
      recordExplorerNativePoolFallback("directoryListingSnapshots", error);
    }
  }

  return unwrapTauriResult(
    bypassCache
      ? await commands.fsListDirUncached(path, showHidden)
      : await commands.fsListDir(path, showHidden),
  );
}

function shouldUseDirectoryListingNativeBufferPool(): boolean {
  return (
    resolveGreebleNativeLaneSelection(
      "directoryListingSnapshots",
      {},
      { nativeBufferPool: isExplorerNativePoolAvailable() },
    ).activeLane === "native_buffer_pool"
  );
}
