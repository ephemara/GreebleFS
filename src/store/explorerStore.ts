import { create } from 'zustand';

export interface ExplorerSessionSnapshot {
  currentPath: string;
  history: string[];
  historyIdx: number;
  sidebarWidth: number | null;
  search: string;
  searchIncludeContent: boolean;
}

export const defaultExplorerSession: ExplorerSessionSnapshot = {
  currentPath: '',
  history: [],
  historyIdx: -1,
  sidebarWidth: null,
  search: '',
  searchIncludeContent: true,
};

interface ExplorerStoreState {
  session: ExplorerSessionSnapshot;
  updateSession: (updates: Partial<ExplorerSessionSnapshot>) => void;
  resetSession: () => void;
}

export const useExplorerStore = create<ExplorerStoreState>((set) => ({
  session: defaultExplorerSession,
  updateSession: (updates) => set((state) => ({
    session: {
      ...state.session,
      ...updates,
    },
  })),
  resetSession: () => set({ session: defaultExplorerSession }),
}));
