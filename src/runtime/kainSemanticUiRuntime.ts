import type { KainLatticeCatalog, KainLatticePackage } from "./kainLatticeCatalog";
import type { KainUiAction, KainUiScaffold, KainUiSurface } from "./kainUiScaffold";

export interface KainSemanticUiMount {
  id: string;
  surfaceId: string;
  kind: string;
  title: string;
  source: string;
  packageId?: string;
  componentId?: string;
  mountSlot?: string;
  order: number;
  hostModels: string[];
  actions: string[];
  status: string;
}

export interface KainSemanticUiRegistry {
  surfaces: KainUiSurface[];
  mounts: KainSemanticUiMount[];
  actionsById: Record<string, KainUiAction>;
  packagesById: Record<string, KainLatticePackage>;
  hostModelIds: string[];
}

export interface KainSemanticUiSurfaceResolution {
  surface: KainUiSurface | null;
  mount: KainSemanticUiMount | null;
}

export interface KainSemanticUiMountSelector {
  kind?: string | null;
  mountSlot?: string | null;
  packageId?: string | null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function byMountOrder(left: KainSemanticUiMount, right: KainSemanticUiMount): number {
  return left.order - right.order || left.id.localeCompare(right.id);
}

function buildPackageLookup(catalog: KainLatticeCatalog | null): Record<string, KainLatticePackage> {
  const packages = catalog?.packages ?? [];
  return Object.fromEntries(packages.map((packageNode) => [packageNode.id, packageNode]));
}

function packageForSurface(
  surface: KainUiSurface,
  packagesById: Record<string, KainLatticePackage>,
): KainLatticePackage | null {
  if (surface.packageId && packagesById[surface.packageId]) {
    return packagesById[surface.packageId];
  }

  return Object.values(packagesById).find((packageNode) => packageNode.surfaces.includes(surface.id)) ?? null;
}

function buildMountForSurface(
  surface: KainUiSurface,
  packagesById: Record<string, KainLatticePackage>,
): KainSemanticUiMount {
  const packageNode = packageForSurface(surface, packagesById);
  const packageHostModels = packageNode?.hostModels ?? [];
  const packageActions = packageNode?.actions ?? [];
  const packageId = surface.packageId ?? packageNode?.id;

  return {
    id: surface.mountId ?? surface.id,
    surfaceId: surface.id,
    kind: surface.kind,
    title: surface.title,
    source: surface.source ?? packageNode?.entry ?? "",
    packageId,
    componentId: surface.componentId,
    mountSlot: surface.mountSlot,
    order: surface.order,
    hostModels: uniqueStrings([...surface.hostModels, ...packageHostModels]),
    actions: uniqueStrings([...surface.actions, ...packageActions]),
    status: packageNode ? "lattice-mounted" : "semantic-mounted",
  };
}

export function buildKainSemanticUiRegistry(
  scaffold: KainUiScaffold | null,
  latticeCatalog: KainLatticeCatalog | null,
): KainSemanticUiRegistry {
  const surfaces = scaffold?.surfaces ?? [];
  const packagesById = buildPackageLookup(latticeCatalog);
  const mounts = surfaces.map((surface) => buildMountForSurface(surface, packagesById));
  const actionsById = Object.fromEntries((scaffold?.actions ?? []).map((action) => [action.id, action]));
  const hostModelIds = uniqueStrings([
    ...mounts.flatMap((mount) => mount.hostModels),
    ...(latticeCatalog?.hostObjects.map((hostObject) => hostObject.id) ?? []),
  ]);

  return {
    surfaces,
    mounts,
    actionsById,
    packagesById,
    hostModelIds,
  };
}

export function selectKainSemanticUiMounts(
  registry: KainSemanticUiRegistry,
  selector: KainSemanticUiMountSelector = {},
): KainSemanticUiMount[] {
  return registry.mounts
    .filter((mount) => {
      if (selector.kind && mount.kind !== selector.kind) {
        return false;
      }
      if (selector.mountSlot && mount.mountSlot !== selector.mountSlot) {
        return false;
      }
      if (selector.packageId && mount.packageId !== selector.packageId) {
        return false;
      }
      return true;
    })
    .slice()
    .sort(byMountOrder);
}

export function resolveKainSemanticUiSurface(
  scaffold: KainUiScaffold | null,
  latticeCatalog: KainLatticeCatalog | null,
  request: {
    surfaceId?: string | null;
    mountId?: string | null;
    packageId?: string | null;
  } = {},
): KainSemanticUiSurfaceResolution {
  const registry = buildKainSemanticUiRegistry(scaffold, latticeCatalog);
  const requestedMount = request.mountId
    ? registry.mounts.find((mount) => mount.id === request.mountId) ?? null
    : null;
  const requestedSurface = request.surfaceId
    ? registry.surfaces.find((surface) => surface.id === request.surfaceId) ?? null
    : null;
  const packageSurface = request.packageId
    ? registry.surfaces.find((surface) => surface.packageId === request.packageId) ?? null
    : null;
  const surface = requestedSurface
    ?? (requestedMount ? registry.surfaces.find((item) => item.id === requestedMount.surfaceId) ?? null : null)
    ?? packageSurface
    ?? registry.surfaces[0]
    ?? null;
  const mount = surface
    ? registry.mounts.find((item) => item.surfaceId === surface.id) ?? null
    : requestedMount;

  return { surface, mount };
}
