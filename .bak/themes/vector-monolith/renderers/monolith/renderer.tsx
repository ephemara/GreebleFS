import { MonolithScopedStyles } from './components/scoped-styles';
import { renderAppMonolithShell } from './modes/app-shell';
import { renderDockMonolithShell } from './modes/dock-shell';

export function renderVectorMonolithShell(host) {
  const shell = host.layout.windowMode === 'overlay'
    ? renderDockMonolithShell(host)
    : renderAppMonolithShell(host);

  return (
    <>
      <MonolithScopedStyles />
      {shell}
    </>
  );
}
