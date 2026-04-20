import React from 'react';
import { ZenControlHandlerResolver } from './controlRegistry';
import { useZenWorkspaceStore } from './store';
import { ZenModuleId } from './types';

export const useZenControlBindings = (
    moduleId: ZenModuleId,
    resolver: ZenControlHandlerResolver
) => {
    const registerControlHandlers = useZenWorkspaceStore((state) => state.registerControlHandlers);
    const unregisterControlHandlers = useZenWorkspaceStore((state) => state.unregisterControlHandlers);
    const resolverRef = React.useRef(resolver);
    const scopeId = React.useId();

    React.useEffect(() => {
        resolverRef.current = resolver;
    }, [resolver]);

    React.useEffect(() => {
        const proxyResolver: ZenControlHandlerResolver = (context) => resolverRef.current(context);
        registerControlHandlers(moduleId, scopeId, proxyResolver);

        return () => {
            unregisterControlHandlers(moduleId, scopeId);
        };
    }, [moduleId, registerControlHandlers, scopeId, unregisterControlHandlers]);
};
