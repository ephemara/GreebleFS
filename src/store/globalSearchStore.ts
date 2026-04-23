import { create } from "zustand";
import {
  globalSearchPaletteConfig,
  shouldRunGlobalSearchQuery,
} from "../config/globalSearch";
import {
  cancelGlobalSearchScan,
  getGlobalSearchStatus,
  initGlobalSearch,
  queryGlobalSearch,
  startGlobalSearchScan,
  type GlobalSearchResultValue,
  type GlobalSearchStatusValue,
} from "../runtime/globalSearchBackend";

interface GlobalSearchStoreState {
  initialized: boolean;
  paletteSessionOpen: boolean;
  query: string;
  results: GlobalSearchResultValue[];
  status: GlobalSearchStatusValue | null;
  isSearching: boolean;
  lastError: string | null;
  openPaletteSession: () => Promise<void>;
  closePaletteSession: () => void;
  refreshStatus: () => Promise<void>;
  startScan: () => Promise<void>;
  cancelScan: () => Promise<void>;
  setQuery: (query: string, priorityPaths?: string[]) => void;
  clearQuery: () => void;
}

let statusPollTimer: ReturnType<typeof setTimeout> | null = null;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeSearchSequence = 0;

function clearStatusPolling() {
  if (statusPollTimer !== null) {
    clearTimeout(statusPollTimer);
    statusPollTimer = null;
  }
}

function clearSearchDebounce() {
  if (searchDebounceTimer !== null) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
}

export const useGlobalSearchStore = create<GlobalSearchStoreState>((set, get) => {
  const scheduleStatusPolling = () => {
    clearStatusPolling();
    const status = get().status;
    const interval = status?.isScanInProgress || status?.isCommitting
      ? globalSearchPaletteConfig.activeStatusPollIntervalMs
      : globalSearchPaletteConfig.idleStatusPollIntervalMs;
    statusPollTimer = setTimeout(() => {
      void get().refreshStatus().finally(() => {
        if (
          get().paletteSessionOpen
          || get().status?.isScanInProgress
          || get().status?.isCommitting
        ) {
          scheduleStatusPolling();
        }
      });
    }, interval);
  };

  return {
    initialized: false,
    paletteSessionOpen: false,
    query: "",
    results: [],
    status: null,
    isSearching: false,
    lastError: null,
    openPaletteSession: async () => {
      set({ paletteSessionOpen: true });

      try {
        const status = get().initialized
          ? await getGlobalSearchStatus()
          : await initGlobalSearch();
        set({
          initialized: true,
          status,
          lastError: null,
        });

        if (
          globalSearchPaletteConfig.autoStartScanOnPaletteOpenIfIndexMissing
          && !status.isScanInProgress
          && !status.isCommitting
          && (!status.isIndexValid || status.indexedItemCount === 0)
        ) {
          await get().startScan();
        }

        scheduleStatusPolling();
      } catch (error) {
        set({
          initialized: true,
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
    },
    closePaletteSession: () => {
      set({ paletteSessionOpen: false });
      clearSearchDebounce();
      if (!(get().status?.isScanInProgress || get().status?.isCommitting)) {
        clearStatusPolling();
      }
    },
    refreshStatus: async () => {
      try {
        const status = await getGlobalSearchStatus();
        set({
          status,
          initialized: true,
          lastError: null,
        });
      } catch (error) {
        set({
          initialized: true,
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
    },
    startScan: async () => {
      try {
        await startGlobalSearchScan();
        const status = await getGlobalSearchStatus();
        set({
          status,
          lastError: null,
        });
        scheduleStatusPolling();
      } catch (error) {
        set({
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
    },
    cancelScan: async () => {
      try {
        await cancelGlobalSearchScan();
        const status = await getGlobalSearchStatus();
        set({
          status,
          lastError: null,
        });
      } catch (error) {
        set({
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
    },
    setQuery: (query, priorityPaths = []) => {
      set({ query });
      clearSearchDebounce();
      activeSearchSequence += 1;
      const requestSequence = activeSearchSequence;

      if (!shouldRunGlobalSearchQuery(query)) {
        set({
          results: [],
          isSearching: false,
        });
        return;
      }

      set({ isSearching: true });
      searchDebounceTimer = setTimeout(() => {
        void queryGlobalSearch({
          query,
          priorityPaths,
        })
          .then((results) => {
            if (requestSequence !== activeSearchSequence) {
              return;
            }
            set({
              results,
              isSearching: false,
              lastError: null,
            });
          })
          .catch((error) => {
            if (requestSequence !== activeSearchSequence) {
              return;
            }
            set({
              results: [],
              isSearching: false,
              lastError: error instanceof Error ? error.message : String(error),
            });
          });
      }, globalSearchPaletteConfig.searchDebounceMs);
    },
    clearQuery: () => {
      clearSearchDebounce();
      activeSearchSequence += 1;
      set({
        query: "",
        results: [],
        isSearching: false,
      });
    },
  };
});
