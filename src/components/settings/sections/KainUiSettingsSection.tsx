import type { KainUiGraph } from "@/runtime/kainUiGraph";
import {
  SettingsRow,
  SettingsRowGroup,
  SettingsSectionBlock,
  SettingsStatusPill,
} from "../SettingsPrimitives";

export function KainUiSettingsSection({
  graph,
  error,
}: {
  graph: KainUiGraph | null;
  error: string | null;
}) {
  const settingsMode = graph?.settings.mode ?? "fallback";
  const categoryCount = graph?.settings.categories.length ?? 0;
  const hiddenSectionCount = graph?.settings.hiddenSectionKeys.length ?? 0;

  return (
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
  );
}
