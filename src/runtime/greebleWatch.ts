/**
 * greebleWatch — closes the hot-reload loop without any Rust changes.
 *
 * The backend already watches one directory at a time
 * (`plugin_watch_directory`, emitting `overlay://plugins-changed` with
 * `{root, kind, paths}`). This module:
 *  1. starts the watch on a content root (themes dir: factory themes),
 *  2. debounces events, re-runs tracked factory owners under that root,
 *  3. notifies the host (App refreshes its package catalogs).
 *
 * Single-slot limit: the backend holds ONE active watcher — the last
 * `start` wins. Call once, main window only.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { reloadAllGreebleFactoryOwnersUnderRoot } from './greebleFactory';

export const GREEBLE_WATCH_EVENT = 'overlay://plugins-changed';

export interface GreebleWatchEventPayload {
  root?: string;
  kind?: string;
  paths?: string[];
}

export interface GreebleWatchOptions {
  /** Directory to watch (e.g. the managed themes root). */
  directory: string;
  /** Directories the backend should ignore (node_modules, .git, …). */
  ignoredDirectories?: string[];
  /** Quiet period before reloads fire. */
  debounceMs?: number;
  /** Called after factory owners reload (host refreshes catalogs). */
  onChanged?: (paths: string[]) => void;
}

const DEFAULT_IGNORED = [
  'node_modules',
  '.git',
  '.cache',
  'target',
  'dist',
];

export async function startGreebleContentWatch(
  options: GreebleWatchOptions,
): Promise<() => void> {
  const debounceMs = options.debounceMs ?? 500;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingPaths: string[] = [];
  let stopped = false;

  try {
    await invoke('plugin_watch_directory', {
      path: options.directory,
      ignoredDirectories: options.ignoredDirectories ?? DEFAULT_IGNORED,
    });
  } catch (error) {
    console.warn(`GreebleFS: content watch failed for "${options.directory}"`, error);
    return () => {};
  }

  const flush = async () => {
    timer = null;
    if (stopped) return;
    const paths = pendingPaths;
    pendingPaths = [];
    try {
      await reloadAllGreebleFactoryOwnersUnderRoot(options.directory);
    } catch (error) {
      console.warn('GreebleFS: factory hot reload failed', error);
    }
    try {
      options.onChanged?.(paths);
    } catch (error) {
      console.warn('GreebleFS: watch onChanged handler failed', error);
    }
  };

  const unlisten = await listen<GreebleWatchEventPayload>(
    GREEBLE_WATCH_EVENT,
    event => {
      pendingPaths.push(...(event.payload?.paths ?? []));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), debounceMs);
    },
  ).catch(error => {
    console.warn('GreebleFS: watch subscribe failed', error);
    return () => {};
  });

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    unlisten();
  };
}
