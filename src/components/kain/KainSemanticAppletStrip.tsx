import { useMemo } from "react";
import type { KainLatticeCatalog } from "@/runtime/kainLatticeCatalog";
import type { KainUiScaffold } from "@/runtime/kainUiScaffold";
import {
  buildKainSemanticUiRegistry,
  selectKainSemanticUiMounts,
} from "@/runtime/kainSemanticUiRuntime";
import { KainSemanticSurfaceHost } from "./KainSemanticSurfaceHost";

export const KAIN_TOP_BAR_TRAILING_APPLET_SLOT = "workbench.topbar.trailing";

interface KainSemanticAppletStripProps {
  scaffold: KainUiScaffold | null;
  latticeCatalog: KainLatticeCatalog | null;
  mountSlot?: string;
}

export function KainSemanticAppletStrip({
  scaffold,
  latticeCatalog,
  mountSlot = KAIN_TOP_BAR_TRAILING_APPLET_SLOT,
}: KainSemanticAppletStripProps) {
  const registry = useMemo(
    () => buildKainSemanticUiRegistry(scaffold, latticeCatalog),
    [scaffold, latticeCatalog],
  );
  const appletMounts = useMemo(
    () => selectKainSemanticUiMounts(registry, {
      kind: "shell-applet",
      mountSlot,
    }),
    [mountSlot, registry],
  );

  if (appletMounts.length === 0) {
    return null;
  }

  return (
    <div
      data-kain-semantic-applet-strip="true"
      data-kain-semantic-applet-slot={mountSlot}
      data-kain-semantic-applet-count={appletMounts.length}
      data-kain-semantic-applet-packages={appletMounts.map((mount) => mount.packageId ?? "none").join("|")}
      data-gfs-window-drag-exclusion="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "100%",
        gap: 4,
        padding: "0 4px",
        borderLeft: "1px solid var(--overlay-workbench-chrome-border)",
        flexShrink: 0,
      }}
    >
      {appletMounts.map((mount) => (
        <KainSemanticSurfaceHost
          key={mount.id}
          scaffold={scaffold}
          latticeCatalog={latticeCatalog}
          mountId={mount.id}
          variant="applet"
          showActionStatus={false}
        />
      ))}
    </div>
  );
}
