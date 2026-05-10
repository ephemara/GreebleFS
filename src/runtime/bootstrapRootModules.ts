import type { ComponentType } from "react";

export type BootstrapRootId = "app" | "fileOperations" | "explorerPicker";

export type BootstrapRootComponent = ComponentType<Record<string, unknown>>;

type BootstrapRootModule = {
    default: BootstrapRootComponent;
};

const productionBootstrapRootLoaders = {
    app: () => import("../App") as Promise<BootstrapRootModule>,
    fileOperations: () => import("../windows/FileOperationsWindowApp") as Promise<BootstrapRootModule>,
    explorerPicker: () => import("../windows/PickerWindowApp") as Promise<BootstrapRootModule>,
} satisfies Record<BootstrapRootId, () => Promise<BootstrapRootModule>>;

export async function loadProductionBootstrapRoot(rootId: BootstrapRootId) {
    const module = await productionBootstrapRootLoaders[rootId]();
    return module.default;
}
