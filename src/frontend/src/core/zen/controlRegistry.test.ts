import { describe, expect, it } from 'vitest';
import {
    createZenControlInteractionState,
    reduceZenControlInteractionState,
    resolveZenControlProfile,
    resolveZenViewportPointerPolicy
} from './controlRegistry';
import { useZenWorkspaceStore } from './store';

describe('zen control registry', () => {
    it('resolves sculpt to the shared control stack and transform bindings', () => {
        const profile = resolveZenControlProfile('sculpt');
        const actionIds = profile.bindings.map((binding) => binding.actionId);

        expect(profile.primaryCrates).toContain('k-os-game-input');
        expect(profile.primaryCrates).toContain('k-os-game-camera');
        expect(profile.primaryCrates).toContain('k-os-gizmo');
        expect(actionIds).toContain('history.undo');
        expect(actionIds).toContain('camera.orbit.hold');
        expect(actionIds).toContain('gizmo.translate');
        expect(actionIds).toContain('menu.quick.toggle');
    });

    it('tracks shared orbit and gizmo state through interaction reductions', () => {
        const base = createZenControlInteractionState();
        const orbiting = reduceZenControlInteractionState(base, 'camera.orbit.hold', 'down', 'greeble');
        const rotating = reduceZenControlInteractionState(orbiting, 'gizmo.rotate', 'down', 'greeble');
        const released = reduceZenControlInteractionState(rotating, 'camera.orbit.hold', 'up', 'greeble');

        expect(orbiting.orbitModifierActive).toBe(true);
        expect(rotating.gizmoMode).toBe('rotate');
        expect(released.orbitModifierActive).toBe(false);
        expect(released.lastActionModuleId).toBe('greeble');
    });

    it('falls back from the active module to the viewport host when dispatching shared controls', () => {
        const store = useZenWorkspaceStore.getState();
        store.resetWorkspace('graphos');

        let hostDispatchCount = 0;
        store.registerControlHandlers('sculpt', 'test-host', (context) => {
            if (context.actionId === 'camera.orbit.hold') {
                hostDispatchCount += 1;
                expect(context.sourceModuleId).toBe('graphos');
                expect(context.targetModuleId).toBe('sculpt');
                return true;
            }
            return false;
        });

        const handled = store.dispatchControlAction(
            'camera.orbit.hold',
            'down',
            { key: 'Alt', altKey: true } as KeyboardEvent,
            'graphos'
        );

        expect(handled).toBe(true);
        expect(hostDispatchCount).toBe(1);
        expect(useZenWorkspaceStore.getState().interaction.orbitModifierActive).toBe(true);

        store.unregisterControlHandlers('sculpt', 'test-host');
        store.clearControlInteraction();
    });

    it('resolves viewport pointer policy through shared module data instead of host hardcoding', () => {
        expect(resolveZenViewportPointerPolicy('sculpt')).toBe('default-orbit');
        expect(resolveZenViewportPointerPolicy('greeble')).toBe('tool-primary-alt-orbit');
        expect(resolveZenViewportPointerPolicy('scatter')).toBe('tool-primary-alt-orbit');
        expect(resolveZenViewportPointerPolicy('cloner')).toBe('tool-primary-alt-orbit');
        expect(resolveZenViewportPointerPolicy('quantum')).toBe('passive-overlay');
        expect(resolveZenViewportPointerPolicy('graphos')).toBe('passive-overlay');
    });
});
