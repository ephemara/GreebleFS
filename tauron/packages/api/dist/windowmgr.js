// Reconstructed Tauron guest binding: windowmgr.
//
// See transport.js header for why this file exists. Window-manager sessions
// (external HWND attach proofs) fail fast with TAURON_GUEST_UNAVAILABLE;
// event subscriptions resolve to no-op unlisten callbacks so proof surfaces
// mount without a host. getCurrentWindowMgrHostLabel returns '' so the
// wrapper falls back to its default host label (src/runtime/windowMgr.ts).

export function getCurrentWindowMgrHostLabel() {
  return '';
}

function unavailable(op) {
  return new Error(
    `TAURON_GUEST_UNAVAILABLE: ${op} needs tauri-plugin-windowmgr plus the ` +
      'Tauron windowmgr guest transport (tauron/packages/api/dist).',
  );
}

export async function startInlineWindowMgrSession(request) {
  void request;
  throw unavailable('startInlineWindowMgrSession');
}

export async function showWindowMgrSession(request) {
  void request;
  throw unavailable('showWindowMgrSession');
}

export async function hideWindowMgrSession(locator) {
  void locator;
  throw unavailable('hideWindowMgrSession');
}

export async function stopWindowMgrSession(locator) {
  void locator;
  throw unavailable('stopWindowMgrSession');
}

export async function updateWindowMgrSessionBounds(request) {
  void request;
  throw unavailable('updateWindowMgrSessionBounds');
}

function noopUnlisten() {
  return async () => undefined;
}

export async function onWindowMgrSessionStarted(listener) {
  void listener;
  return noopUnlisten();
}

export async function onWindowMgrSessionShown(listener) {
  void listener;
  return noopUnlisten();
}

export async function onWindowMgrSessionHidden(listener) {
  void listener;
  return noopUnlisten();
}

export async function onWindowMgrSessionBoundsUpdated(listener) {
  void listener;
  return noopUnlisten();
}

export async function onWindowMgrSessionExited(listener) {
  void listener;
  return noopUnlisten();
}

export async function onWindowMgrSessionError(listener) {
  void listener;
  return noopUnlisten();
}
