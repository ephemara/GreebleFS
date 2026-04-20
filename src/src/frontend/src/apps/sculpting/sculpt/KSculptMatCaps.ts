export const MATCAPS = {
    EMERALD: 'EMERALD',
    ICE: 'ICE',
    GREY: 'GREY',
    SKIN: 'SKIN'
} as const;

export function getMatCapPresetIndex(type: string): number {
    switch (type) {
        case MATCAPS.EMERALD:
            return 0;
        case MATCAPS.ICE:
            return 1;
        case MATCAPS.GREY:
            return 2;
        case MATCAPS.SKIN:
            return 3;
        default:
            return 1;
    }
}
