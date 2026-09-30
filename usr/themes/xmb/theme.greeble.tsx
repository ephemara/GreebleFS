/**
 * XMB — Cross-Media Bar look (PS3-era): deep space blacks, luminous wave
 * blue, glowing selections. API-native theme: registers through the
 * greeblefs harness, applies through the theme bridge like any pack.
 */
import { defineGreebleExtension } from 'greeblefs';

export default defineGreebleExtension((fs) => {
  fs.registerTheme({
    id: 'xmb',
    title: 'XMB',
    description: 'Cross-media-bar look: deep blacks, wave blue, glowing focus.',
    author: 'GreebleFS',
    tags: ['api-native', 'dark', 'console', 'flagship'],
    extends: 'github-dark',
    tokens: {
      // Core surfaces
      appBackground: '#0b0b14',
      appBackgroundAlt: '#101020',
      shellBackground: '#0e0e18',
      shellBackgroundSolid: '#0e0e18',
      topBarBackground: '#121222',
      sidebarBackground: '#0d0d17',
      panelBackground: '#12121e',
      panelAltBackground: '#161624',
      cardBackground: '#151524',
      cardHoverBackground: '#1b1b2c',
      inputBackground: '#0a0a12',
      terminalBackground: '#080810',
      selectionBackground: '#1d3a5f',
      scrimBackground: 'rgba(4, 4, 10, 0.72)',
      // Text
      textPrimary: '#f2f5fa',
      textSecondary: '#aeb8cc',
      textMuted: '#6f7890',
      textDim: '#4a5268',
      // Borders + accent (XMB wave blue)
      border: '#23233a',
      borderStrong: '#33334f',
      accent: '#2e9bff',
      accentSoft: '#1d4e89',
      // Signature atmosphere as live CSS vars
      '--xmb-wave-speed': '1.4',
      '--xmb-wave-hue': '212',
      '--xmb-glow-strength': '0.85',
      '--xmb-clock-format': '24h',
    },
  });
});
