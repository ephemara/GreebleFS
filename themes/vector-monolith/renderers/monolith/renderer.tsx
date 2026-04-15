import { renderAppMonolithShell } from './modes/app-shell';
import { renderDockMonolithShell } from './modes/dock-shell';

export function renderVectorMonolithShell(host) {
  if (host.layout.windowMode === 'overlay') {
    return renderDockMonolithShell(host);
  }
  return renderAppMonolithShell(host);
}
