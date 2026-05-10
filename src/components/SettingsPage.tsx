import React, {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Bot,
  Cpu,
  FolderOpen,
  HardDrive,
  Home,
  Image,
  LayoutGrid,
  MonitorPlay,
  Palette,
  Puzzle,
  Settings2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Type,
  Volume2,
} from "@/components/AppIcons";
import { useShallow } from "zustand/react/shallow";
import { OverlayScrollArea } from "./OverlayScrollArea";
import { SettingsShell } from "./settings/SettingsShell";
import {
  SettingsActionButton,
  SettingsCompactActionButton,
  SettingsCompactSection,
  SettingsKeyValueRow,
  SettingsMetricStrip,
  SettingsRailButton,
} from "./settings/SettingsPrimitives";
import {
  settingsRailPathCatalog,
  settingsSectionCatalog,
  settingsSectionCategoryCatalog,
  type SettingsRailPathKey,
  type SettingsSectionKey,
} from "../config/settingsNavigation";
import { useSettingsStore } from "../store/settingsStore";
import type { SettingsPage as LegacySettingsPageComponent } from "./SettingsPageLegacy";

export type SettingsPageProps = ComponentProps<typeof LegacySettingsPageComponent>;

const LazySettingsPageLegacy = React.lazy(async () => {
  const module = await import("./SettingsPageLegacy");
  return { default: module.SettingsPage };
});

const SETTINGS_SECTION_ICONS: Partial<Record<SettingsSectionKey, ReactNode>> = {
  overview: <Settings2 size={12} />,
  system: <Cpu size={12} />,
  profiles: <Shield size={12} />,
  "kain-ui": <Bot size={12} />,
  models: <Sparkles size={12} />,
  terminal: <Terminal size={12} />,
  dock: <MonitorPlay size={12} />,
  explorer: <FolderOpen size={12} />,
  "context-menus": <Puzzle size={12} />,
  home: <Home size={12} />,
  layouts: <LayoutGrid size={12} />,
  appearance: <Palette size={12} />,
  icons: <Image size={12} />,
  audio: <Volume2 size={12} />,
  "theme-json": <Type size={12} />,
};

function resolveSettingsAppearance(appearance: SettingsPageProps["appearance"]) {
  const workbenchTheme = appearance.workbenchTheme;
  const accent =
    appearance.theme.palette.accent
    ?? appearance.baseTheme.palette.accent
    ?? "#8fd3ff";
  const text =
    appearance.theme.palette.textPrimary
    ?? appearance.baseTheme.palette.textPrimary
    ?? "var(--overlay-text-primary)";
  const muted =
    appearance.theme.palette.textMuted
    ?? appearance.baseTheme.palette.textMuted
    ?? "var(--overlay-text-muted)";
  const border =
    appearance.theme.palette.border
    ?? appearance.baseTheme.palette.border
    ?? "var(--overlay-workbench-settings-card-border)";

  return {
    accent,
    text,
    muted,
    border,
    fontFamily: appearance.fonts.ui,
    colorScheme:
      appearance.theme.palette.appBackground === "#ffffff" ? "light" : "dark",
    settingsStyle: workbenchTheme.settingsStyle,
    panelRadius: workbenchTheme.metrics.panelRadius,
    blurEnabled: false,
  };
}

function SettingsDeepSectionLoading() {
  return (
    <div
      className="flex h-full min-h-0 items-center justify-center px-4 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-55"
      style={{
        background: "var(--overlay-workbench-settings-bg)",
        color: "var(--overlay-text-muted)",
      }}
    >
      Loading Section
    </div>
  );
}

export function SettingsPage(props: SettingsPageProps) {
  const {
    activeRailPath,
    activeSection,
    activePluginSettingsSlotId,
    settings,
    setActiveRailPath,
    setActiveSection,
    setActivePluginSettingsSlotId,
    resetToDefaults,
  } = useSettingsStore(
    useShallow((state) => ({
      activeRailPath: state.activeRailPath,
      activeSection: state.activeSection,
      activePluginSettingsSlotId: state.activePluginSettingsSlotId,
      settings: state.settings,
      setActiveRailPath: state.setActiveRailPath,
      setActiveSection: state.setActiveSection,
      setActivePluginSettingsSlotId: state.setActivePluginSettingsSlotId,
      resetToDefaults: state.resetToDefaults,
    })),
  );

  const appearance = useMemo(
    () => resolveSettingsAppearance(props.appearance),
    [props.appearance],
  );
  const [railWidth, setRailWidth] = useState(208);
  const [legacyLoadAllowed, setLegacyLoadAllowed] = useState(false);

  const sectionByKey = useMemo(
    () =>
      new Map(
        settingsSectionCatalog.map((section) => [
          section.key as SettingsSectionKey,
          section,
        ]),
      ),
    [],
  );
  const sectionGroups = useMemo(
    () =>
      settingsSectionCategoryCatalog
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((category) => ({
          ...category,
          sections: category.sectionKeys
            .map((key) => sectionByKey.get(key))
            .filter((section): section is NonNullable<typeof section> => Boolean(section))
            .sort((left, right) => left.order - right.order),
        }))
        .filter((category) => category.sections.length > 0),
    [sectionByKey],
  );

  useEffect(() => {
    if (legacyLoadAllowed) {
      return;
    }

    if (activeRailPath !== "settings") {
      setActiveRailPath("settings");
      setActivePluginSettingsSlotId(null);
    }
    if (activeSection !== "overview") {
      setActiveSection("overview");
    }
  }, [
    activeRailPath,
    activeSection,
    legacyLoadAllowed,
    setActivePluginSettingsSlotId,
    setActiveRailPath,
    setActiveSection,
  ]);

  const visibleSection = legacyLoadAllowed ? activeSection : "overview";
  const activeSectionMeta =
    sectionByKey.get(visibleSection) ?? sectionByKey.get("overview")!;
  const activeRailPathDescriptor =
    settingsRailPathCatalog.find((path) => path.key === activeRailPath)
    ?? settingsRailPathCatalog[0];
  const activePluginSettingsSlot = props.pluginSettingsSlots?.find(
    (slot) => slot.id === activePluginSettingsSlotId,
  );

  if (
    legacyLoadAllowed
    && (activeRailPath !== "settings" || activeSection !== "overview")
  ) {
    return (
      <Suspense fallback={<SettingsDeepSectionLoading />}>
        <LazySettingsPageLegacy {...props} />
      </Suspense>
    );
  }

  const packageCount =
    props.themePackages.length
    + (props.appearancePacks?.length ?? 0)
    + (props.themeRecipePacks?.length ?? 0)
    + (props.themeEnginePacks?.length ?? 0)
    + (props.shellRenderers?.length ?? 0)
    + (props.iconThemePackages?.length ?? 0)
    + (props.soundPacks?.length ?? 0);
  const profileCount = props.usrProfileRuntimeSnapshot?.profiles.length ?? 0;
  const pluginSlotCount = props.pluginSettingsSlots?.length ?? 0;
  const enabledPluginCount = Object.values(settings.plugins.enablementByPluginId)
    .filter(Boolean)
    .length;

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        fontFamily: appearance.fontFamily,
        colorScheme: appearance.colorScheme,
      }}
    >
      <SettingsShell
        railWidth={railWidth}
        onRailWidthChange={setRailWidth}
        accent={appearance.accent}
        settingsStyle={appearance.settingsStyle}
        panelRadius={appearance.panelRadius}
        blurEnabled={appearance.blurEnabled}
        activeSectionKey="overview"
        activeArchetype={activeSectionMeta.archetype}
        preferredContentDensity="comfortable"
        rail={
          <>
            <div className="border-b px-2 py-2" style={{ borderColor: appearance.border }}>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <SlidersHorizontal size={12} style={{ color: appearance.muted }} />
                  <h1
                    className="truncate text-[12px] font-semibold uppercase"
                    style={{ color: appearance.text }}
                  >
                    Settings
                  </h1>
                </div>
                <span className="shrink-0 text-[9px] font-semibold uppercase opacity-45">
                  Fast
                </span>
              </div>
              <div
                className="mt-2 grid grid-cols-2 overflow-hidden rounded border p-0.5"
                style={{
                  borderColor: "var(--overlay-workbench-settings-badge-border)",
                  background: "var(--overlay-workbench-settings-badge-bg)",
                }}
              >
                {settingsRailPathCatalog
                  .slice()
                  .sort((left, right) => left.order - right.order)
                  .map((path) => {
                    const pathIsActive = activeRailPath === path.key;
                    return (
                      <button
                        key={path.key}
                        type="button"
                        aria-label={`${path.label} Path`}
                        onClick={() => {
                          setActiveRailPath(path.key as SettingsRailPathKey);
                          if (path.key === "plugins") {
                            setLegacyLoadAllowed(true);
                            setActivePluginSettingsSlotId(
                              props.pluginSettingsSlots?.[0]?.id ?? null,
                            );
                          } else {
                            setLegacyLoadAllowed(false);
                            setActiveSection("overview");
                          }
                        }}
                        className="h-6 rounded px-2 text-center text-[10px] font-semibold uppercase transition-colors"
                        data-settings-rail-path={path.label}
                        style={{
                          border: "1px solid transparent",
                          background: pathIsActive
                            ? "var(--overlay-workbench-chrome-button-active-bg)"
                            : "transparent",
                          color: appearance.text,
                        }}
                      >
                        {path.label}
                      </button>
                    );
                  })}
              </div>
            </div>

            <OverlayScrollArea
              style={{ flex: 1, minHeight: 0 }}
              viewportStyle={{ padding: "5px 6px 8px 6px" }}
            >
              <div className="space-y-2">
                {sectionGroups.map((category) => (
                  <div key={category.key} data-settings-rail-category={category.label}>
                    <div className="mb-1 px-2 text-[9px] font-semibold uppercase opacity-45">
                      {category.label}
                    </div>
                    <div className="space-y-1">
                      {category.sections.map((section) => (
                        <SettingsRailButton
                          key={section.key}
                          active={visibleSection === section.key}
                          icon={
                            SETTINGS_SECTION_ICONS[section.key as SettingsSectionKey]
                            ?? <Settings2 size={12} />
                          }
                          label={section.label}
                          subtitle={section.subtitle}
                          summary={section.overviewSummary}
                          accent={appearance.accent}
                          border={appearance.border}
                          text={appearance.text}
                          muted={appearance.muted}
                          onClick={() => {
                            setActiveRailPath("settings");
                            const sectionKey = section.key as SettingsSectionKey;
                            setLegacyLoadAllowed(sectionKey !== "overview");
                            setActiveSection(sectionKey);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </OverlayScrollArea>
          </>
        }
        header={
          <div
            className="border-b px-3 py-2"
            data-settings-summary-header="true"
            style={{
              borderColor: "var(--overlay-workbench-settings-card-border)",
              borderRadius:
                appearance.settingsStyle === "floating"
                || appearance.settingsStyle === "glass"
                  ? appearance.panelRadius
                  : 0,
              background: "var(--overlay-workbench-settings-card-bg)",
            }}
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="shrink-0 text-[10px] font-semibold uppercase opacity-45"
                  style={{ color: appearance.muted }}
                >
                  {activeRailPathDescriptor.label}
                </span>
                <span className="min-w-0 truncate text-[12px] font-semibold">
                  {activeSectionMeta.label}
                </span>
                <span
                  className="min-w-0 truncate text-[10px] opacity-55"
                  style={{ color: appearance.muted }}
                >
                  {activeSectionMeta.overviewSummary}
                </span>
              </div>
              <SettingsCompactActionButton
                type="button"
                onClick={() => resetToDefaults()}
                title="Reset Defaults"
              >
                Reset
              </SettingsCompactActionButton>
            </div>
          </div>
        }
      >
        <div className="space-y-2.5" data-settings-section="overview">
          <SettingsMetricStrip
            items={[
              {
                id: "theme",
                label: "Theme",
                value: settings.appearance.activeThemeId,
                tone: "accent",
              },
              {
                id: "profile",
                label: "Profiles",
                value: profileCount > 0 ? `${profileCount} loaded` : "Default",
              },
              {
                id: "packages",
                label: "Packs",
                value: packageCount,
              },
              {
                id: "plugins",
                label: "Plugins",
                value:
                  pluginSlotCount > 0
                    ? `${pluginSlotCount} slots`
                    : `${enabledPluginCount} enabled`,
              },
              {
                id: "mode",
                label: "Mode",
                value: settings.presentation.windowMode,
              },
              {
                id: "path",
                label: "Explorer",
                value: settings.explorer.defaultPath,
              },
            ]}
          />

          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
            <SettingsCompactSection title="Now" subtitle={activeSectionMeta.subtitle}>
              <div className="divide-y" style={{ borderColor: appearance.border }}>
                <SettingsKeyValueRow label="Shell" value={settings.terminal.shell} />
                <SettingsKeyValueRow label="Dock" value={settings.dock.activePresentationId} />
                <SettingsKeyValueRow label="Top Bar" value={settings.appearance.activeTopBarId ?? "Theme"} />
                <SettingsKeyValueRow label="Icon Pack" value={settings.appearance.activeIconThemeId ?? "Theme"} />
                <SettingsKeyValueRow label="GPU" value={settings.system.gpuTierMode} />
              </div>
            </SettingsCompactSection>

            <SettingsCompactSection
              title="Jumps"
              subtitle={activePluginSettingsSlot?.title ?? "Frequent sections"}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {(["system", "profiles", "appearance", "models", "explorer", "terminal"] as const).map((key) => {
                  const section = sectionByKey.get(key);
                  if (!section) {
                    return null;
                  }

                  return (
                    <SettingsActionButton
                      key={key}
                      type="button"
                      onClick={() => {
                        setLegacyLoadAllowed(true);
                        setActiveSection(key);
                      }}
                      className="justify-start"
                    >
                      {SETTINGS_SECTION_ICONS[key] ?? <Settings2 size={12} />}
                      <span className="truncate">{section.label}</span>
                    </SettingsActionButton>
                  );
                })}
              </div>
            </SettingsCompactSection>
          </div>

          <SettingsCompactSection title="Roots" subtitle="Managed content lanes">
            <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Themes", props.themePackagesDirectory, props.onOpenThemesFolder],
                ["Top Bars", props.topBarPackagesDirectory, props.onOpenTopBarsFolder],
                ["Shaders", props.shadersDirectory, props.onOpenShadersFolder],
                ["Wallpapers", props.wallpapersDirectory, props.onOpenWallpapersFolder],
                ["Animations", props.animationsDirectory, props.onOpenAnimationsFolder],
                ["Icons", props.iconThemePackagesDirectory, props.onOpenIconThemesFolder],
              ].map(([label, directory, openFolder]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => {
                    if (typeof openFolder === "function") {
                      void openFolder();
                    }
                  }}
                  className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded border px-2 py-1.5 text-left text-[10px]"
                  style={{
                    borderColor: "var(--overlay-workbench-settings-badge-border)",
                    background: "var(--overlay-workbench-settings-badge-bg)",
                    color: appearance.text,
                  }}
                  title={String(directory ?? "")}
                >
                  <HardDrive size={12} style={{ color: appearance.muted }} />
                  <span className="min-w-0">
                    <span className="block font-semibold uppercase">{String(label)}</span>
                    <span className="block truncate opacity-50">{String(directory ?? "Not configured")}</span>
                  </span>
                </button>
              ))}
            </div>
          </SettingsCompactSection>
        </div>
      </SettingsShell>
    </div>
  );
}
