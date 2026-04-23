import { create } from 'zustand';
import type {
  TailscaleStatusSnapshot,
} from '../generated/tauri';
import type { MobileRemoteAccessMode } from '../config/mobileAccess';
import { getTailscaleStatus } from '../runtime/tailscaleBackend';
import {
  formatMobileShareNotice,
  startMobileShareRuntime,
  stopMobileShareRuntime,
  type MobileShareSession,
} from '../runtime/mobileShareRuntime';

export type MobileSharePhase = 'idle' | 'starting' | 'running' | 'stopping';

interface MobileShareStoreState {
  phase: MobileSharePhase;
  session: MobileShareSession | null;
  lastNotice: string | null;
  lastError: string | null;
  tailscaleStatus: TailscaleStatusSnapshot | null;
  setPhase: (phase: MobileSharePhase) => void;
  setSession: (session: MobileShareSession | null) => void;
  setNotice: (message: string | null) => void;
  setError: (message: string | null) => void;
  setTailscaleStatus: (status: TailscaleStatusSnapshot | null) => void;
  reset: () => void;
}

const defaultMobileShareState: Pick<
  MobileShareStoreState,
  'phase' | 'session' | 'lastNotice' | 'lastError' | 'tailscaleStatus'
> = {
  phase: 'idle',
  session: null,
  lastNotice: null,
  lastError: null,
  tailscaleStatus: null,
};

export const useMobileShareStore = create<MobileShareStoreState>((set) => ({
  ...defaultMobileShareState,
  setPhase: (phase) => set({ phase }),
  setSession: (session) => set({ session }),
  setNotice: (lastNotice) => set({ lastNotice }),
  setError: (lastError) => set({ lastError }),
  setTailscaleStatus: (tailscaleStatus) => set({ tailscaleStatus }),
  reset: () => set({ ...defaultMobileShareState }),
}));

export function resetMobileShareState(): void {
  useMobileShareStore.getState().reset();
}

export function clearMobileShareFeedback(): void {
  useMobileShareStore.getState().setNotice(null);
  useMobileShareStore.getState().setError(null);
}

export function setMobileShareTailscaleStatus(
  status: TailscaleStatusSnapshot | null,
): void {
  useMobileShareStore.getState().setTailscaleStatus(status);
}

export async function refreshMobileShareTailscaleStatus(): Promise<TailscaleStatusSnapshot> {
  const status = await getTailscaleStatus();
  setMobileShareTailscaleStatus(status);
  return status;
}

export async function startMobileShareSession(args: {
  requestedPath: string;
  remoteAccessMode: MobileRemoteAccessMode;
  copyPreferredUrl?: boolean;
}): Promise<MobileShareSession> {
  const store = useMobileShareStore.getState();
  store.setPhase('starting');
  store.setError(null);
  store.setNotice(null);
  store.setSession(null);

  try {
    const result = await startMobileShareRuntime(args);
    store.setTailscaleStatus(result.tailscaleStatus);
    store.setSession(result.session);
    store.setPhase('running');
    store.setNotice(formatMobileShareNotice(result.session, result.copiedPreferredUrl));
    return result.session;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    store.setPhase('idle');
    store.setSession(null);
    store.setError(message);
    throw error;
  }
}

export async function stopMobileShareSession(): Promise<void> {
  const store = useMobileShareStore.getState();
  const previousSession = store.session;
  store.setPhase('stopping');
  store.setError(null);
  store.setNotice(null);

  try {
    await stopMobileShareRuntime();
    store.setPhase('idle');
    store.setSession(null);
    store.setNotice('Stopped the active mobile share server.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    store.setPhase(previousSession ? 'running' : 'idle');
    store.setSession(previousSession);
    store.setError(message);
    throw error;
  }
}
