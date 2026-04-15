import { defineThemeRenderer } from 'overlayterm-theme-renderer';
import { renderVectorMonolithShell } from './monolith/renderer';

export default defineThemeRenderer({
  name: 'Vector Monolith',
  apiVersion: 1,
  supportsLiveSwap: true,
  fallbackRuntime: 'desktop-stack',
  capabilities: {
    customScreens: true,
    wallpaperScene: true,
    surfaceAdapters: true,
  },
  surfaceOwnership: {
    chrome: true,
    launcher: true,
    contentFrame: true,
    pinnedPanels: true,
    wallpaper: true,
  },
  component({ host }) {
    return renderVectorMonolithShell(host);
  },
});
