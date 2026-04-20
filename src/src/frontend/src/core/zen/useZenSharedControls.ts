import { useZenWorkspaceStore } from './store';

export const useZenSharedControls = () => {
    const interaction = useZenWorkspaceStore((state) => state.interaction);
    const setSharedGizmoMode = useZenWorkspaceStore((state) => state.setSharedGizmoMode);
    const setSharedTransformSpace = useZenWorkspaceStore((state) => state.setSharedTransformSpace);
    const toggleSharedTransformSpace = useZenWorkspaceStore((state) => state.toggleSharedTransformSpace);
    const setSharedSnapEnabled = useZenWorkspaceStore((state) => state.setSharedSnapEnabled);
    const toggleSharedSnapEnabled = useZenWorkspaceStore((state) => state.toggleSharedSnapEnabled);
    const resolveNextValue = <T,>(value: T | ((previous: T) => T), previous: T): T =>
        typeof value === 'function'
            ? (value as (previous: T) => T)(previous)
            : value;

    return {
        ...interaction,
        setGizmoMode: (value: typeof interaction.gizmoMode | ((previous: typeof interaction.gizmoMode) => typeof interaction.gizmoMode)) =>
            setSharedGizmoMode(resolveNextValue(value, interaction.gizmoMode)),
        setTransformSpace: (value: typeof interaction.transformSpace | ((previous: typeof interaction.transformSpace) => typeof interaction.transformSpace)) =>
            setSharedTransformSpace(resolveNextValue(value, interaction.transformSpace)),
        toggleTransformSpace: toggleSharedTransformSpace,
        setSnapEnabled: (value: boolean | ((previous: boolean) => boolean)) =>
            setSharedSnapEnabled(resolveNextValue(value, interaction.snapEnabled)),
        toggleSnapEnabled: toggleSharedSnapEnabled
    };
};
