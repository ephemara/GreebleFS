import { nanoid } from "nanoid";
import { create } from "zustand";

import type { MobileLayoutSettings } from "../src/config/mobileLayout";
import type { MobileTabId } from "./mobileShared";

const MOBILE_PATH_MEMORY_STORAGE_KEY = "greeblefs.mobile.pathMemory.v1";
const MOBILE_PINNED_PATH_LIMIT = 12;
const MOBILE_RECENT_PATH_LIMIT = 10;

export type MobileTransferDirection = "upload" | "download";
export type MobileTransferPhase =
  | "queued"
  | "running"
  | "handoff"
  | "completed"
  | "error"
  | "canceled";

export interface MobileTransferEntry {
  id: string;
  direction: MobileTransferDirection;
  displayName: string;
  targetPath: string;
  sourceLabel: string;
  phase: MobileTransferPhase;
  createdAt: number;
  updatedAt: number;
  bytesTransferred: number;
  bytesTotal: number | null;
  progress: number | null;
  message: string | null;
  fileUrl: string | null;
  files?: File[];
}

interface MobileStoreState {
  activeTab: MobileTabId;
  explorerPath: string;
  pinnedPaths: string[];
  recentPaths: string[];
  transfers: MobileTransferEntry[];
  layoutOverrides: Partial<MobileLayoutSettings>;
  setActiveTab: (tab: MobileTabId) => void;
  setExplorerPath: (path: string) => void;
  pinPath: (path: string) => void;
  unpinPath: (path: string) => void;
  recordRecentPath: (path: string) => void;
  clearRecentPaths: () => void;
  patchLayoutOverrides: (patch: Partial<MobileLayoutSettings>) => void;
  resetLayoutOverrides: () => void;
  createTransfer: (
    draft: Omit<MobileTransferEntry, "id" | "createdAt" | "updatedAt">,
  ) => string;
  patchTransfer: (
    transferId: string,
    patch: Partial<MobileTransferEntry>,
  ) => void;
  clearFinishedTransfers: () => void;
}

interface MobilePathMemorySnapshot {
  pinnedPaths: string[];
  recentPaths: string[];
}

function normalizeMobileStoredPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function dedupeMobileStoredPaths(paths: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths) {
    const normalized = normalizeMobileStoredPath(path);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

function readMobilePathMemorySnapshot(): MobilePathMemorySnapshot {
  if (typeof window === "undefined") {
    return { pinnedPaths: [], recentPaths: [] };
  }
  try {
    const raw = window.localStorage.getItem(MOBILE_PATH_MEMORY_STORAGE_KEY);
    if (!raw) {
      return { pinnedPaths: [], recentPaths: [] };
    }
    const parsed = JSON.parse(raw) as Partial<MobilePathMemorySnapshot>;
    return {
      pinnedPaths: dedupeMobileStoredPaths(parsed.pinnedPaths ?? [], MOBILE_PINNED_PATH_LIMIT),
      recentPaths: dedupeMobileStoredPaths(parsed.recentPaths ?? [], MOBILE_RECENT_PATH_LIMIT),
    };
  } catch {
    return { pinnedPaths: [], recentPaths: [] };
  }
}

function writeMobilePathMemorySnapshot(snapshot: MobilePathMemorySnapshot): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      MOBILE_PATH_MEMORY_STORAGE_KEY,
      JSON.stringify({
        pinnedPaths: dedupeMobileStoredPaths(snapshot.pinnedPaths, MOBILE_PINNED_PATH_LIMIT),
        recentPaths: dedupeMobileStoredPaths(snapshot.recentPaths, MOBILE_RECENT_PATH_LIMIT),
      }),
    );
  } catch {
    // Best-effort session comfort; private browsing storage failures should not break the app.
  }
}

const initialPathMemory = readMobilePathMemorySnapshot();

export const useMobileStore = create<MobileStoreState>((set) => ({
  activeTab: "explorer",
  explorerPath: "",
  pinnedPaths: initialPathMemory.pinnedPaths,
  recentPaths: initialPathMemory.recentPaths,
  transfers: [],
  layoutOverrides: {},
  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },
  setExplorerPath: (path) => {
    set({ explorerPath: path });
  },
  pinPath: (path) => {
    const normalizedPath = normalizeMobileStoredPath(path);
    if (!normalizedPath) {
      return;
    }
    set((state) => {
      const pinnedPaths = dedupeMobileStoredPaths(
        [normalizedPath, ...state.pinnedPaths],
        MOBILE_PINNED_PATH_LIMIT,
      );
      const next = {
        pinnedPaths,
        recentPaths: state.recentPaths,
      };
      writeMobilePathMemorySnapshot(next);
      return next;
    });
  },
  unpinPath: (path) => {
    const normalizedPath = normalizeMobileStoredPath(path);
    set((state) => {
      const pinnedPaths = state.pinnedPaths.filter((candidate) => candidate !== normalizedPath);
      const next = {
        pinnedPaths,
        recentPaths: state.recentPaths,
      };
      writeMobilePathMemorySnapshot(next);
      return next;
    });
  },
  recordRecentPath: (path) => {
    const normalizedPath = normalizeMobileStoredPath(path);
    if (!normalizedPath) {
      return;
    }
    set((state) => {
      const recentPaths = dedupeMobileStoredPaths(
        [normalizedPath, ...state.recentPaths],
        MOBILE_RECENT_PATH_LIMIT,
      );
      const next = {
        pinnedPaths: state.pinnedPaths,
        recentPaths,
      };
      writeMobilePathMemorySnapshot(next);
      return next;
    });
  },
  clearRecentPaths: () => {
    set((state) => {
      const next = {
        pinnedPaths: state.pinnedPaths,
        recentPaths: [],
      };
      writeMobilePathMemorySnapshot(next);
      return next;
    });
  },
  patchLayoutOverrides: (patch) => {
    set((state) => ({
      layoutOverrides: {
        ...state.layoutOverrides,
        ...patch,
      },
    }));
  },
  resetLayoutOverrides: () => {
    set({ layoutOverrides: {} });
  },
  createTransfer: (draft) => {
    const transferId = nanoid();
    const now = Date.now();
    const nextTransfer: MobileTransferEntry = {
      ...draft,
      id: transferId,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      transfers: [nextTransfer, ...state.transfers],
    }));
    return transferId;
  },
  patchTransfer: (transferId, patch) => {
    set((state) => ({
      transfers: state.transfers.map((transfer) =>
        transfer.id === transferId
          ? {
              ...transfer,
              ...patch,
              updatedAt: Date.now(),
            }
          : transfer,
      ),
    }));
  },
  clearFinishedTransfers: () => {
    set((state) => ({
      transfers: state.transfers.filter((transfer) =>
        !["completed", "canceled"].includes(transfer.phase),
      ),
    }));
  },
}));
