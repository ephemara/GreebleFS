import { describe, expect, it } from 'vitest';
import {
    advanceZenSequencer,
    createZenSequencerState,
    patchZenSequencerTransport,
    setZenSequencerActiveSource,
    syncZenSequencerSource
} from './sequencer';

describe('zen sequencer helpers', () => {
    it('adopts the first available source as the active transport source', () => {
        const state = syncZenSequencerSource(createZenSequencerState(), 'cloner', {
            label: 'K-Cloner',
            duration: 8,
            fps: 60,
            loop: true,
            available: true
        });

        expect(state.activeSourceModuleId).toBe('cloner');
        expect(state.duration).toBe(8);
        expect(state.fps).toBe(60);
        expect(state.loop).toBe(true);
    });

    it('defaults source labels from the module registry', () => {
        const state = syncZenSequencerSource(createZenSequencerState(), 'cloner', {
            duration: 4,
            fps: 30,
            loop: true,
            available: true
        });

        expect(state.sources.cloner?.label).toBe('K-CLONER');
    });

    it('switches transport metadata when the active source changes', () => {
        const withCloner = syncZenSequencerSource(createZenSequencerState(), 'cloner', {
            label: 'K-Cloner',
            duration: 6,
            fps: 30,
            loop: true,
            available: true
        });
        const withRig = syncZenSequencerSource(withCloner, 'rig', {
            label: 'K-Rig',
            duration: 12,
            fps: 24,
            loop: false,
            available: true
        });
        const focused = setZenSequencerActiveSource(withRig, 'rig');

        expect(focused.activeSourceModuleId).toBe('rig');
        expect(focused.duration).toBe(12);
        expect(focused.fps).toBe(24);
        expect(focused.loop).toBe(false);
    });

    it('keeps transport metadata pinned to the active source when another source updates', () => {
        const withCloner = syncZenSequencerSource(createZenSequencerState(), 'cloner', {
            label: 'K-Cloner',
            duration: 6,
            fps: 30,
            loop: true,
            available: true
        });
        const withRig = syncZenSequencerSource(withCloner, 'rig', {
            label: 'K-Rig',
            duration: 12,
            fps: 24,
            loop: false,
            available: true
        });
        const focusedRig = setZenSequencerActiveSource(withRig, 'rig');
        const updatedCloner = syncZenSequencerSource(focusedRig, 'cloner', {
            fps: 60
        });

        expect(updatedCloner.activeSourceModuleId).toBe('rig');
        expect(updatedCloner.fps).toBe(24);
        expect(updatedCloner.sources.cloner?.fps).toBe(60);
    });

    it('falls back to another available source when the active one becomes unavailable', () => {
        const withCloner = syncZenSequencerSource(createZenSequencerState(), 'cloner', {
            label: 'K-Cloner',
            duration: 6,
            fps: 30,
            loop: true,
            available: true
        });
        const withRig = syncZenSequencerSource(withCloner, 'rig', {
            label: 'K-Rig',
            duration: 12,
            fps: 24,
            loop: false,
            available: true
        });
        const unavailableCloner = syncZenSequencerSource(withRig, 'cloner', {
            available: false,
            duration: 0
        });

        expect(unavailableCloner.activeSourceModuleId).toBe('rig');
        expect(unavailableCloner.duration).toBe(12);
        expect(unavailableCloner.fps).toBe(24);
        expect(unavailableCloner.loop).toBe(false);
    });

    it('clamps or wraps time based on the active source loop mode', () => {
        const looping = patchZenSequencerTransport(
            syncZenSequencerSource(createZenSequencerState(), 'cloner', {
                duration: 5,
                fps: 30,
                loop: true,
                available: true
            }),
            {
                currentTime: 7.5
            }
        );
        const nonLooping = patchZenSequencerTransport(
            syncZenSequencerSource(createZenSequencerState(), 'rig', {
                duration: 5,
                fps: 30,
                loop: false,
                available: true
            }),
            {
                currentTime: 7.5
            }
        );

        expect(looping.currentTime).toBeCloseTo(2.5);
        expect(nonLooping.currentTime).toBe(5);
    });

    it('advances playback and stops at the end for non-looping sources', () => {
        const playing = patchZenSequencerTransport(
            syncZenSequencerSource(createZenSequencerState(), 'rig', {
                duration: 2,
                fps: 30,
                loop: false,
                available: true
            }),
            {
                isPlaying: true,
                currentTime: 1.9
            }
        );
        const advanced = advanceZenSequencer(playing, 0.2);

        expect(advanced.currentTime).toBe(2);
        expect(advanced.isPlaying).toBe(false);
    });
});
