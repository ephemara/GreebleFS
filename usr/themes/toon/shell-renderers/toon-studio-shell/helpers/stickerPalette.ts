export const TOON_GROUP_SWATCHES = [
  {
    background: 'linear-gradient(180deg, rgba(255, 214, 226, 0.92) 0%, rgba(255, 243, 198, 0.96) 100%)',
    border: 'rgba(255, 150, 184, 0.34)',
    shadow: '0 14px 30px rgba(255, 150, 184, 0.18)',
    text: '#3A3952',
  },
  {
    background: 'linear-gradient(180deg, rgba(183, 234, 206, 0.92) 0%, rgba(255, 250, 217, 0.96) 100%)',
    border: 'rgba(120, 204, 166, 0.34)',
    shadow: '0 14px 30px rgba(120, 204, 166, 0.16)',
    text: '#334548',
  },
  {
    background: 'linear-gradient(180deg, rgba(197, 225, 255, 0.94) 0%, rgba(230, 215, 255, 0.96) 100%)',
    border: 'rgba(115, 185, 255, 0.34)',
    shadow: '0 14px 30px rgba(115, 185, 255, 0.18)',
    text: '#2D3B56',
  },
];

export function pickToonGroupSwatch(index) {
  return TOON_GROUP_SWATCHES[index % TOON_GROUP_SWATCHES.length];
}
