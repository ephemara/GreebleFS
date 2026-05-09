import type { KainUiGraph } from "@/runtime/kainUiGraph";
import type { KainAppManifest } from "@/runtime/kainManifest";
import type { KainUiScaffold } from "@/runtime/kainUiScaffold";
import type { KainLatticeCatalog } from "@/runtime/kainLatticeCatalog";
import type { KainFfiCatalog } from "@/runtime/kainFfiCatalog";
import { KainUiRenderer } from "@/components/kain/KainUiRenderer";
import {
  SettingsRow,
  SettingsRowGroup,
  SettingsSectionBlock,
  SettingsStatusPill,
} from "../SettingsPrimitives";

export function KainUiSettingsSection({
  graph,
  error,
  manifest,
  manifestError,
  scaffold,
  scaffoldError,
  latticeCatalog,
  latticeCatalogError,
  ffiCatalog,
  ffiCatalogError,
}: {
  graph: KainUiGraph | null;
  error: string | null;
  manifest: KainAppManifest | null;
  manifestError: string | null;
  scaffold: KainUiScaffold | null;
  scaffoldError: string | null;
  latticeCatalog: KainLatticeCatalog | null;
  latticeCatalogError: string | null;
  ffiCatalog: KainFfiCatalog | null;
  ffiCatalogError: string | null;
}) {
  const settingsMode = graph?.settings.mode ?? "fallback";
  const categoryCount = graph?.settings.categories.length ?? 0;
  const hiddenSectionCount = graph?.settings.hiddenSectionKeys.length ?? 0;
  const capabilityCount = manifest?.capabilities.length ?? 0;
  const liveCapabilityCount = manifest?.capabilities.filter((capability) => capability.implemented).length ?? 0;
  const dispatchCount = manifest?.dispatch.length ?? 0;
  const artifactCount = manifest?.generatedArtifacts.length ?? 0;
  const pipelineCount = manifest?.pipelines.length ?? 0;
  const ffiLaneCount = manifest?.ffiLanes.length ?? 0;
  const manifestStatus = manifest ? "live" : "offline";
  const scaffoldStatus = scaffold ? "live" : "offline";
  const scaffoldSurfaceCount = scaffold?.surfaces.length ?? 0;
  const scaffoldPrimitiveCount = scaffold?.primitives.length ?? 0;
  const scaffoldTokenCount = scaffold?.tokens.length ?? 0;
  const scaffoldActionCount = scaffold?.actions.length ?? 0;
  const latticeStatus = latticeCatalog ? "live" : "offline";
  const latticePackageCount = latticeCatalog?.packages.length ?? 0;
  const latticePrimitiveCount = latticeCatalog?.primitives.length ?? 0;
  const latticeHostObjectCount = latticeCatalog?.hostObjects.length ?? 0;
  const latticeImportCount = latticeCatalog?.imports.length ?? 0;
  const nextLatticeMilestone = latticeCatalog?.milestones.find((milestone) => milestone.status === "next")
    ?? latticeCatalog?.milestones[0]
    ?? null;
  const ffiStatus = ffiCatalog ? "live" : "offline";
  const ffiCatalogLaneCount = ffiCatalog?.lanes.length ?? 0;
  const ffiImplementedLaneCount = ffiCatalog?.lanes.filter((lane) => lane.implemented).length ?? 0;
  const ffiAnalysisCount = ffiCatalog?.analysisPipelines.length ?? 0;
  const pythonFfiLane = ffiCatalog?.lanes.find((lane) => lane.id === "python") ?? null;
  const nextFfiLane = ffiCatalog?.lanes.find((lane) => !lane.implemented) ?? ffiCatalog?.lanes[0] ?? null;
  const previewSurface = scaffold?.surfaces[0] ?? null;
  const nextPipeline = manifest?.pipelines.find((pipeline) => pipeline.status === "next")
    ?? manifest?.pipelines[0]
    ?? null;

  return (
    <div
      className="space-y-3"
      data-kain-manifest-proof={manifestStatus}
      data-kain-manifest-kind={manifest?.kind ?? "missing"}
      data-kain-manifest-capabilities={capabilityCount}
      data-kain-manifest-dispatch={dispatchCount}
      data-kain-ui-scaffold-proof={scaffoldStatus}
      data-kain-ui-scaffold-surfaces={scaffoldSurfaceCount}
      data-kain-ui-scaffold-primitives={scaffoldPrimitiveCount}
      data-kain-lattice-proof={latticeStatus}
      data-kain-lattice-packages={latticePackageCount}
      data-kain-lattice-host-objects={latticeHostObjectCount}
      data-kain-ffi-proof={ffiStatus}
      data-kain-ffi-lanes={ffiCatalogLaneCount}
      data-kain-ffi-python={pythonFfiLane?.status ?? "missing"}
    >
      <SettingsSectionBlock
        title="Kain UI"
        subtitle={graph?.source ?? error ?? "Bridge pending"}
        badges={[graph ? "Live" : "Fallback", settingsMode]}
      >
        <SettingsRowGroup>
          <SettingsRow
            title="Theme"
            description={graph?.theme.activeThemeId ?? "Current settings store"}
            control={<SettingsStatusPill active={Boolean(graph)}>{graph ? "Kain" : "Store"}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Navigation"
            description={`${categoryCount} groups | ${hiddenSectionCount} tucked lanes`}
            control={<SettingsStatusPill active={settingsMode === "streamlined"}>{settingsMode}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Profile"
            description={graph?.profile.overlays?.join(" | ") ?? "Global app graph only"}
            control={<SettingsStatusPill>{graph?.profile.scope ?? "global"}</SettingsStatusPill>}
          />
        </SettingsRowGroup>
      </SettingsSectionBlock>

      <SettingsSectionBlock
        title="Kain Manifest"
        subtitle={manifest?.summary ?? manifestError ?? "Waiting for greeblefs.kain.manifest"}
        badges={[manifest ? "Manifest V1" : "No Manifest", `${liveCapabilityCount}/${capabilityCount} live`]}
      >
        <SettingsRowGroup>
          <SettingsRow
            title="Bridge"
            description={manifest?.bridge.entry ?? "No resident manifest response yet"}
            control={<SettingsStatusPill active={Boolean(manifest)}>{manifest?.bridge.supervisor ?? "pending"}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Dispatch"
            description={`${dispatchCount} endpoints | ${manifest?.dispatch.map((endpoint) => `${endpoint.namespace}.${endpoint.method}`).join(" | ") ?? "none"}`}
            control={<SettingsStatusPill active={dispatchCount > 0}>{dispatchCount}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Artifacts"
            description={`${artifactCount} generated lanes | ${manifest?.settingsSchemas.length ?? 0} settings schemas`}
            control={<SettingsStatusPill active={artifactCount > 0}>{artifactCount}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Pipelines"
            description={nextPipeline ? `${nextPipeline.label}: ${nextPipeline.summary}` : "No Kain-authored pipeline plan"}
            control={<SettingsStatusPill active={pipelineCount > 0}>{pipelineCount}</SettingsStatusPill>}
          />
          <SettingsRow
            title="FFI"
            description={manifest?.ffiLanes.map((lane) => lane.label).join(" | ") ?? "No FFI lanes reported"}
            control={<SettingsStatusPill active={ffiLaneCount > 0}>{ffiLaneCount}</SettingsStatusPill>}
          />
        </SettingsRowGroup>
      </SettingsSectionBlock>

      <SettingsSectionBlock
        title="Kain UI Scaffold"
        subtitle={scaffold?.summary ?? scaffoldError ?? "Waiting for greeblefs.ui.scaffold"}
        badges={[scaffold ? "Semantic V1" : "No Scaffold", `${scaffoldSurfaceCount} surfaces`]}
      >
        <SettingsRowGroup>
          <SettingsRow
            title="Stdlib"
            description={scaffold?.stdlib ?? "src-kain/stdlib/greeblefs/ui.kn"}
            control={<SettingsStatusPill active={Boolean(scaffold)}>{scaffold ? "loaded" : "pending"}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Renderer"
            description={scaffold?.renderer ?? "src/components/kain/KainUiRenderer.tsx"}
            control={<SettingsStatusPill active={Boolean(scaffold)}>{scaffold ? "wired" : "pending"}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Vocabulary"
            description={`${scaffoldPrimitiveCount} primitives | ${scaffoldTokenCount} tokens | ${scaffoldActionCount} actions`}
            control={<SettingsStatusPill active={scaffoldPrimitiveCount > 0}>{scaffoldPrimitiveCount}</SettingsStatusPill>}
          />
        </SettingsRowGroup>
        <div className="mt-3">
          <KainUiRenderer surface={previewSurface} />
        </div>
      </SettingsSectionBlock>

      <SettingsSectionBlock
        title="Kain Lattice"
        subtitle={latticeCatalog?.summary ?? latticeCatalogError ?? "Waiting for greeblefs.lattice.catalog"}
        badges={[latticeCatalog ? "QML-like" : "No Catalog", `${latticePackageCount} packages`]}
      >
        <SettingsRowGroup>
          <SettingsRow
            title="System"
            description={latticeCatalog ? `${latticeCatalog.name} | ${latticeCatalog.packageRoot}` : "Kain Lattice catalog pending"}
            control={<SettingsStatusPill active={Boolean(latticeCatalog)}>{latticeCatalog ? "live" : "pending"}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Vocabulary"
            description={`${latticePrimitiveCount} primitives | ${latticeImportCount} imports | ${latticeHostObjectCount} host objects`}
            control={<SettingsStatusPill active={latticePrimitiveCount > 0}>{latticePrimitiveCount}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Package"
            description={latticeCatalog?.packages[0] ? `${latticeCatalog.packages[0].title}: ${latticeCatalog.packages[0].summary}` : "No Lattice packages reported"}
            control={<SettingsStatusPill active={latticePackageCount > 0}>{latticePackageCount}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Next"
            description={nextLatticeMilestone ? `${nextLatticeMilestone.label}: ${nextLatticeMilestone.summary}` : "No Lattice milestone reported"}
            control={<SettingsStatusPill active={nextLatticeMilestone?.status === "next"}>{nextLatticeMilestone?.status ?? "pending"}</SettingsStatusPill>}
          />
        </SettingsRowGroup>
      </SettingsSectionBlock>

      <SettingsSectionBlock
        title="Kain FFI"
        subtitle={ffiCatalog?.summary ?? ffiCatalogError ?? "Waiting for greeblefs.ffi.catalog"}
        badges={[ffiCatalog ? "Bridge Map" : "No Catalog", `${ffiImplementedLaneCount}/${ffiCatalogLaneCount} live`]}
      >
        <SettingsRowGroup>
          <SettingsRow
            title="Registry"
            description={ffiCatalog ? `${ffiCatalog.name} | ${ffiCatalog.root}` : "Kain FFI catalog pending"}
            control={<SettingsStatusPill active={Boolean(ffiCatalog)}>{ffiCatalog ? "live" : "pending"}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Python"
            description={pythonFfiLane ? `${pythonFfiLane.bridge} | ${pythonFfiLane.hostPath}` : "Python sidecar hook pending"}
            control={<SettingsStatusPill active={pythonFfiLane?.implemented}>{pythonFfiLane?.status ?? "pending"}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Lanes"
            description={ffiCatalog?.lanes.map((lane) => lane.label).join(" | ") ?? "No FFI lanes reported"}
            control={<SettingsStatusPill active={ffiCatalogLaneCount > 0}>{ffiCatalogLaneCount}</SettingsStatusPill>}
          />
          <SettingsRow
            title="Next"
            description={nextFfiLane ? `${nextFfiLane.label}: ${nextFfiLane.nextAction}` : "No FFI lane plan reported"}
            control={<SettingsStatusPill active={ffiAnalysisCount > 0}>{ffiAnalysisCount}</SettingsStatusPill>}
          />
        </SettingsRowGroup>
      </SettingsSectionBlock>
    </div>
  );
}
