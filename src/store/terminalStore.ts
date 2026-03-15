import { create } from 'zustand';
import { LazyStore } from '@tauri-apps/plugin-store';
import {
    createDefaultCommandBookmarks,
    createDefaultDirectoryBookmarks,
} from '../config/platform';

export interface Bookmark {
    id: string;
    name: string;
    value: string; // The directory path or the execution command
}

interface TerminalStoreState {
    isInitialized: boolean;
    directoryBookmarks: Bookmark[];
    commandBookmarks: Bookmark[];

    // Actions
    initStore: () => Promise<void>;

    // Directory Bookmarks
    addDirectoryBookmark: (bookmark: Bookmark) => Promise<void>;
    updateDirectoryBookmark: (bookmark: Bookmark) => Promise<void>;
    removeDirectoryBookmark: (id: string) => Promise<void>;

    // Command Bookmarks
    addCommandBookmark: (bookmark: Bookmark) => Promise<void>;
    updateCommandBookmark: (bookmark: Bookmark) => Promise<void>;
    removeCommandBookmark: (id: string) => Promise<void>;
}

// Initialize the Tauri Store on disk
const db = new LazyStore('.ultacode-terminal.dat');

// Initial defaults to inject if the store is empty (first run)
const DEFAULT_DIRECTORIES = createDefaultDirectoryBookmarks();
const DEFAULT_COMMANDS = createDefaultCommandBookmarks();

export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
    isInitialized: false,
    directoryBookmarks: [],
    commandBookmarks: [],

    initStore: async () => {
        if (get().isInitialized) return;

        let dirs = await db.get<Bookmark[]>('directory_bookmarks');
        let cmds = await db.get<Bookmark[]>('command_bookmarks');

        // Migration or First Run
        if (!dirs) {
            dirs = DEFAULT_DIRECTORIES;
            await db.set('directory_bookmarks', dirs);
            await db.save();
        }

        if (!cmds) {
            cmds = DEFAULT_COMMANDS;
            await db.set('command_bookmarks', cmds);
            await db.save();
        }

        set({
            directoryBookmarks: dirs,
            commandBookmarks: cmds,
            isInitialized: true
        });
    },

    // --- Directory Actions ---
    addDirectoryBookmark: async (bookmark) => {
        const dirs = [...get().directoryBookmarks, bookmark];
        await db.set('directory_bookmarks', dirs);
        await db.save();
        set({ directoryBookmarks: dirs });
    },

    updateDirectoryBookmark: async (bookmark) => {
        const dirs = get().directoryBookmarks.map(b => b.id === bookmark.id ? bookmark : b);
        await db.set('directory_bookmarks', dirs);
        await db.save();
        set({ directoryBookmarks: dirs });
    },

    removeDirectoryBookmark: async (id) => {
        const dirs = get().directoryBookmarks.filter(b => b.id !== id);
        await db.set('directory_bookmarks', dirs);
        await db.save();
        set({ directoryBookmarks: dirs });
    },

    // --- Command Actions ---
    addCommandBookmark: async (bookmark) => {
        const cmds = [...get().commandBookmarks, bookmark];
        await db.set('command_bookmarks', cmds);
        await db.save();
        set({ commandBookmarks: cmds });
    },

    updateCommandBookmark: async (bookmark) => {
        const cmds = get().commandBookmarks.map(b => b.id === bookmark.id ? bookmark : b);
        await db.set('command_bookmarks', cmds);
        await db.save();
        set({ commandBookmarks: cmds });
    },

    removeCommandBookmark: async (id) => {
        const cmds = get().commandBookmarks.filter(b => b.id !== id);
        await db.set('command_bookmarks', cmds);
        await db.save();
        set({ commandBookmarks: cmds });
    }
}));
