import type { BootstrapRootId } from "./bootstrapRootModules";

export async function loadProductionBootstrapRoot(rootId: BootstrapRootId): Promise<never> {
    throw new Error(`Production bootstrap root loader was requested during Vite dev: ${rootId}`);
}
