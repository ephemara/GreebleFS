import type {
  TailscaleConnectRequest,
  TailscaleStatusSnapshot,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export async function getTailscaleStatus(): Promise<TailscaleStatusSnapshot> {
  return unwrapTauriResult(await commands.tailscaleGetStatus());
}

export async function connectTailscale(
  request: TailscaleConnectRequest,
): Promise<TailscaleStatusSnapshot> {
  return unwrapTauriResult(await commands.tailscaleConnect(request));
}

export async function disconnectTailscale(): Promise<TailscaleStatusSnapshot> {
  return unwrapTauriResult(await commands.tailscaleDisconnect());
}
