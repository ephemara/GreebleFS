// Reconstructed Tauron guest binding (CJS): windowmgr. See windowmgr.js.
'use strict';
function getCurrentWindowMgrHostLabel() { return ''; }
function unavailable(op) {
  return new Error(`TAURON_GUEST_UNAVAILABLE: ${op} needs tauri-plugin-windowmgr plus the Tauron windowmgr guest transport.`);
}
async function startInlineWindowMgrSession(request) { void request; throw unavailable('startInlineWindowMgrSession'); }
async function showWindowMgrSession(request) { void request; throw unavailable('showWindowMgrSession'); }
async function hideWindowMgrSession(locator) { void locator; throw unavailable('hideWindowMgrSession'); }
async function stopWindowMgrSession(locator) { void locator; throw unavailable('stopWindowMgrSession'); }
async function updateWindowMgrSessionBounds(request) { void request; throw unavailable('updateWindowMgrSessionBounds'); }
function noopUnlisten() { return async () => undefined; }
async function onWindowMgrSessionStarted(l) { void l; return noopUnlisten(); }
async function onWindowMgrSessionShown(l) { void l; return noopUnlisten(); }
async function onWindowMgrSessionHidden(l) { void l; return noopUnlisten(); }
async function onWindowMgrSessionBoundsUpdated(l) { void l; return noopUnlisten(); }
async function onWindowMgrSessionExited(l) { void l; return noopUnlisten(); }
async function onWindowMgrSessionError(l) { void l; return noopUnlisten(); }
module.exports = {
  getCurrentWindowMgrHostLabel,
  startInlineWindowMgrSession, showWindowMgrSession, hideWindowMgrSession,
  stopWindowMgrSession, updateWindowMgrSessionBounds,
  onWindowMgrSessionStarted, onWindowMgrSessionShown, onWindowMgrSessionHidden,
  onWindowMgrSessionBoundsUpdated, onWindowMgrSessionExited, onWindowMgrSessionError,
};
