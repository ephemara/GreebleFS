import { nanoid } from "nanoid";
import { create } from "zustand";

import type { MobileTabId } from "./mobileShared";

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
  transfers: MobileTransferEntry[];
  setActiveTab: (tab: MobileTabId) => void;
  setExplorerPath: (path: string) => void;
  createTransfer: (
    draft: Omit<MobileTransferEntry, "id" | "createdAt" | "updatedAt">,
  ) => string;
  patchTransfer: (
    transferId: string,
    patch: Partial<MobileTransferEntry>,
  ) => void;
  clearFinishedTransfers: () => void;
}

export const useMobileStore = create<MobileStoreState>((set) => ({
  activeTab: "explorer",
  explorerPath: "",
  transfers: [],
  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },
  setExplorerPath: (path) => {
    set({ explorerPath: path });
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
