export const UNIVERSAL_VIEWPORT_BACKGROUND_HEX = '#69707a';

export const UNIVERSAL_VIEWPORT_BACKGROUND_IMAGE = [
    'radial-gradient(circle at 50% 14%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.14) 14%, rgba(255,255,255,0.04) 28%, rgba(255,255,255,0) 46%)',
    'linear-gradient(180deg, #8d949d 0%, #727982 25%, #555b63 58%, #393d44 100%)'
].join(', ');

export const UNIVERSAL_VIEWPORT_GRID_THEME = {
    elevation: -1,
    minCellSize: 0.25,
    minorDivisions: 160,
    majorLineEvery: 8,
    minExtent: 80,
    maxExtent: 20000,
    minorColor: 0x575e68,
    majorColor: 0x949ca6,
    minorOpacity: 0.26,
    majorOpacity: 0.5
} as const;
