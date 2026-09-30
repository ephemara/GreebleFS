/**
 * Wii Menu look: bright channel-grid whites, Wii blue, soft playful
 * surfaces. API-native theme (harness -> bridge -> whole app).
 */
import { defineGreebleExtension } from 'greeblefs';

export default defineGreebleExtension((fs) => {
  fs.registerTheme({
    id: 'wii-menu',
    title: 'Wii Menu',
    description: 'Channel-grid look: bright whites, Wii blue, soft rounded surfaces.',
    author: 'GreebleFS',
    tags: ['api-native', 'light', 'console', 'flagship'],
    extends: 'github-dark',
    tokens: {
      appBackground: '#f4f6f8',
      appBackgroundAlt: '#e9edf1',
      shellBackground: '#fbfcfd',
      shellBackgroundSolid: '#fbfcfd',
      topBarBackground: '#ffffff',
      sidebarBackground: '#eef1f4',
      panelBackground: '#ffffff',
      panelAltBackground: '#f0f3f6',
      cardBackground: '#ffffff',
      cardHoverBackground: '#e8f1fa',
      inputBackground: '#ffffff',
      terminalBackground: '#20242a',
      selectionBackground: '#bfe3f7',
      scrimBackground: 'rgba(255, 255, 255, 0.6)',
      textPrimary: '#1d2733',
      textSecondary: '#4a5a6c',
      textMuted: '#7d8ea0',
      textDim: '#a5b3c2',
      border: '#d5dde4',
      borderStrong: '#b9c5d1',
      accent: '#34beed',
      accentSoft: '#a8dcf5',
      '--wii-channel-radius': '18',
      '--wii-cursor': 'pointer',
      '--wii-bubble-speed': '1.0',
    },
  });
});
