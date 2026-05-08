import type { KainUiGraph } from "@/runtime/kainUiGraph";
import type { KainAppManifest } from "@/runtime/kainManifest";
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
}: {
  graph: KainUiGraph | null;
  error: string | null;
  manifest: KainAppManifest | null;
  manifestError: string | null;
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
    </div>
  );
}
