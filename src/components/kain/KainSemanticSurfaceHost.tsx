import { useCallback, useMemo, useState } from "react";
import type { KainLatticeCatalog } from "@/runtime/kainLatticeCatalog";
import type { KainUiNode, KainUiScaffold } from "@/runtime/kainUiScaffold";
import {
  buildKainSemanticUiRegistry,
  resolveKainSemanticUiSurface,
} from "@/runtime/kainSemanticUiRuntime";
import { reloadKainTauronBridge } from "@/runtime/kainTauronBridge";
import { SettingsStatusPill } from "../settings/SettingsPrimitives";
import { KainUiRenderer } from "./KainUiRenderer";

interface KainSemanticSurfaceHostProps {
  scaffold: KainUiScaffold | null;
  latticeCatalog: KainLatticeCatalog | null;
  surfaceId?: string | null;
  mountId?: string | null;
  packageId?: string | null;
  onAction?: (actionId: string, node: KainUiNode) => void | Promise<void>;
}

export function KainSemanticSurfaceHost({
  scaffold,
  latticeCatalog,
  surfaceId,
  mountId,
  packageId,
  onAction,
}: KainSemanticSurfaceHostProps) {
  const [actionState, setActionState] = useState("idle");
  const registry = useMemo(
    () => buildKainSemanticUiRegistry(scaffold, latticeCatalog),
    [scaffold, latticeCatalog],
  );
  const { surface, mount } = useMemo(
    () => resolveKainSemanticUiSurface(scaffold, latticeCatalog, { surfaceId, mountId, packageId }),
    [scaffold, latticeCatalog, surfaceId, mountId, packageId],
  );

  const handleAction = useCallback(async (actionId: string, node: KainUiNode) => {
    setActionState("running");
    try {
      if (onAction) {
        await onAction(actionId, node);
      } else if (actionId === "kain.ui.reload") {
        await reloadKainTauronBridge({
          reason: "kain-semantic-surface-action",
          strategy: "restart-runtime",
        });
      }
      setActionState("ok");
    } catch {
      setActionState("error");
    }
  }, [onAction]);

  if (!surface) {
    return null;
  }

  return (
    <div
      data-kain-semantic-surface-host="true"
      data-kain-semantic-surface={surface.id}
      data-kain-semantic-mount={mount?.id ?? "direct"}
      data-kain-semantic-package={mount?.packageId ?? "none"}
      data-kain-semantic-component={mount?.componentId ?? "none"}
      data-kain-semantic-host-models={mount?.hostModels.length ?? 0}
      data-kain-semantic-actions={mount?.actions.length ?? 0}
      data-kain-semantic-registry-surfaces={registry.surfaces.length}
      data-kain-semantic-action-state={actionState}
    >
      <KainUiRenderer
        surface={surface}
        onAction={handleAction}
      />
      {actionState !== "idle" ? (
        <div data-kain-semantic-action-status="true">
          <SettingsStatusPill active={actionState === "ok"}>
            {actionState}
          </SettingsStatusPill>
        </div>
      ) : null}
    </div>
  );
}
