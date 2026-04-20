import React from 'react';
import {
    ZenControlPhase,
    matchesZenControlBinding,
    resolveZenControlBindings,
    shouldIgnoreZenKeyboardEvent
} from './controlRegistry';
import { useZenWorkspaceStore } from './store';

export const useZenGlobalControls = () => {
    const activeModuleId = useZenWorkspaceStore((state) => state.document.activeModuleId);
    const dispatchControlAction = useZenWorkspaceStore((state) => state.dispatchControlAction);
    const clearControlInteraction = useZenWorkspaceStore((state) => state.clearControlInteraction);

    React.useEffect(() => {
        const bindings = resolveZenControlBindings(activeModuleId);

        const dispatchMatchingBindings = (event: KeyboardEvent, phase: ZenControlPhase) => {
            if (shouldIgnoreZenKeyboardEvent(event)) {
                return;
            }

            const matchedBindings = bindings.filter((binding) => matchesZenControlBinding(binding, event, phase));
            if (matchedBindings.length === 0) {
                return;
            }

            const shouldPreventDefault = matchedBindings.some((binding) => binding.preventDefault !== false);
            if (shouldPreventDefault) {
                event.preventDefault();
            }

            matchedBindings.forEach((binding) => {
                dispatchControlAction(binding.actionId, phase, event, activeModuleId);
            });
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            dispatchMatchingBindings(event, 'down');
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            dispatchMatchingBindings(event, 'up');
        };

        const handleBlur = () => {
            clearControlInteraction();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [activeModuleId, clearControlInteraction, dispatchControlAction]);
};
