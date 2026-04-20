
export const PHYSICS_MODES = {
    ZERO_POINT: 0,
    BLACK_HOLE: 1,
    ION_STORM: 2,
    GALAXY: 3,
    LORENZ: 4,
    VAN_ALLEN: 5,
    AIZAWA: 6,
    BINARY_STAR: 7,
    QUASAR: 8,
    SUPERNOVA: 9,
    WARP: 10,
    SOLAR: 11,
    NEURAL: 12,
    FERROFLUID: 13,
    DATAMOSH: 14,
    FLUID_COUPLING: 17
} as const;

export type PhysicsMode = keyof typeof PHYSICS_MODES;
