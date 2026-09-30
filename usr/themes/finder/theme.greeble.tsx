/**
 * Finder look (macOS): refined light neutrals, graphite chrome, system
 * blue. API-native theme (harness -> bridge -> whole app).
 */
import { defineGreebleExtension } from 'greeblefs';

export default defineGreebleExtension((fs) => {
  fs.registerTheme({
    id: 'finder',
    title: 'Finder',
    description: 'macOS file-browser look: graphite chrome, system blue.',
    author: 'GreebleFS',
    tags: ['api-native', 'light', 'desktop', 'flagship'],
    extends: 'github-dark',
    tokens: {
      appBackground: '#ececee',
      appBackgroundAlt: '#e2e2e6',
      shellBackground: '#f5f5f7',
      shellBackgroundSolid: '#f5f5f7',
      topBarBackground: '#f5f5f7',
      sidebarBackground: '#e8e8ec',
      panelBackground: '#ffffff',
      panelAltBackground: '#f5f5f7',
      cardBackground: '#ffffff',
      cardHoverBackground: '#eef0f3',
      inputBackground: '#ffffff',
      terminalBackground: '#1e1e22',
      selectionBackground: '#c9d8e8',
      scrimBackground: 'rgba(240, 240, 244, 0.6)',
      textPrimary: '#1d1d1f',
      textSecondary: '#515154',
      textMuted: '#86868b',
      textDim: '#aeaeb2',
      border: '#d2d2d7',
      borderStrong: '#b9b9be',
      accent: '#007aff',
      accentSoft: '#a9cdfb',
      '--finder-sidebar-width': '220',
      '--finder-icon-grid': '96',
    },
  });
});
