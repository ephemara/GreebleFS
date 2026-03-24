use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ShellBlueprintId {
    ClassicDock,
    XmbCrossMedia,
    RetroDesktop,
    TileStart,
    HandheldDualScreen,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ShellNavigationModel {
    Tabs,
    CrossAxis,
    Desktop,
    Tiles,
    StackedDualPane,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ShellSurfaceStyle {
    Glass,
    Solid,
    Skeuomorphic,
    Flat,
    Pixel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeDensity {
    Compact,
    Comfortable,
    Immersive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeChromeStyle {
    Minimal,
    Ornate,
    Floating,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeIconStyle {
    System,
    Vector,
    Pixel,
    Skeuomorphic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeMotionStyle {
    Snappy,
    Fluid,
    Dramatic,
    Instant,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ThemePresentation {
    pub density: ThemeDensity,
    pub chrome_style: ThemeChromeStyle,
    pub icon_style: ThemeIconStyle,
    pub motion_style: ThemeMotionStyle,
    pub corner_radius: u16,
    pub panel_spacing: u16,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum WorkbenchRegionId {
    Primary,
    Secondary,
    Rail,
    Dock,
    Desktop,
    Modal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum WorkbenchWindowMode {
    Overlay,
    Windowed,
    Fullscreen,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum WorkbenchInputMode {
    Keyboard,
    Pointer,
    Controller,
    Touch,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct WorkbenchPanelBinding {
    pub panel_id: String,
    pub region: WorkbenchRegionId,
    pub order: u16,
    pub default_open: bool,
    pub preferred_size: Option<u16>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct WorkbenchWindowProfile {
    pub mode: WorkbenchWindowMode,
    pub anchor: Option<String>,
    pub aspect_ratio: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct WorkbenchInputProfile {
    pub mode: WorkbenchInputMode,
    pub density: ThemeDensity,
    pub directional_navigation: bool,
    pub pointer_gestures: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct WorkbenchPreset {
    pub id: String,
    pub label: String,
    pub description: String,
    pub shell_blueprint: ShellBlueprintId,
    pub navigation_model: ShellNavigationModel,
    pub preferred_theme_ids: Vec<String>,
    pub panel_bindings: Vec<WorkbenchPanelBinding>,
    pub window_profile: WorkbenchWindowProfile,
    pub input_profile: WorkbenchInputProfile,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ShellBlueprint {
    pub id: ShellBlueprintId,
    pub label: &'static str,
    pub description: &'static str,
    pub navigation_model: ShellNavigationModel,
    pub surface_style: ShellSurfaceStyle,
    pub supports_pinned_panels: bool,
    pub supports_viewport_dock: bool,
    pub supports_panel_tabs: bool,
    pub supports_dual_screen: bool,
}

pub fn built_in_shell_blueprints() -> Vec<ShellBlueprint> {
    vec![
        ShellBlueprint {
            id: ShellBlueprintId::ClassicDock,
            label: "Classic Dock",
            description: "Single-workspace overlay shell with chrome, tabs, and optional docked panels.",
            navigation_model: ShellNavigationModel::Tabs,
            surface_style: ShellSurfaceStyle::Glass,
            supports_pinned_panels: true,
            supports_viewport_dock: true,
            supports_panel_tabs: true,
            supports_dual_screen: false,
        },
        ShellBlueprint {
            id: ShellBlueprintId::XmbCrossMedia,
            label: "XMB",
            description: "Cross-axis media bar with lateral category navigation and deep vertical stacks.",
            navigation_model: ShellNavigationModel::CrossAxis,
            surface_style: ShellSurfaceStyle::Glass,
            supports_pinned_panels: false,
            supports_viewport_dock: false,
            supports_panel_tabs: false,
            supports_dual_screen: false,
        },
        ShellBlueprint {
            id: ShellBlueprintId::RetroDesktop,
            label: "Retro Desktop",
            description: "Windowed desktop metaphor for classic Macintosh and Hackintosh-inspired shells.",
            navigation_model: ShellNavigationModel::Desktop,
            surface_style: ShellSurfaceStyle::Skeuomorphic,
            supports_pinned_panels: true,
            supports_viewport_dock: false,
            supports_panel_tabs: false,
            supports_dual_screen: false,
        },
        ShellBlueprint {
            id: ShellBlueprintId::TileStart,
            label: "Tile Start",
            description: "Grid-first shell optimized for touch-friendly launchers and dashboard surfaces.",
            navigation_model: ShellNavigationModel::Tiles,
            surface_style: ShellSurfaceStyle::Flat,
            supports_pinned_panels: false,
            supports_viewport_dock: true,
            supports_panel_tabs: false,
            supports_dual_screen: false,
        },
        ShellBlueprint {
            id: ShellBlueprintId::HandheldDualScreen,
            label: "Handheld Dual Screen",
            description: "Primary workspace paired with a persistent secondary surface for controls or navigation.",
            navigation_model: ShellNavigationModel::StackedDualPane,
            surface_style: ShellSurfaceStyle::Pixel,
            supports_pinned_panels: true,
            supports_viewport_dock: false,
            supports_panel_tabs: false,
            supports_dual_screen: true,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_shell_blueprint_ids_as_kebab_case() {
        let serialized = serde_json::to_string(&ShellBlueprintId::HandheldDualScreen).unwrap();
        assert_eq!(serialized, "\"handheld-dual-screen\"");
    }

    #[test]
    fn deserializes_workbench_preset_payload() {
        let payload = r#"{
          "id": "xmb-media-deck",
          "label": "XMB Media Deck",
          "description": "Cross-axis shell",
          "shellBlueprint": "xmb-cross-media",
          "navigationModel": "cross-axis",
          "preferredThemeIds": ["operator"],
          "panelBindings": [
            { "panelId": "terminal", "region": "primary", "order": 0, "defaultOpen": true }
          ],
          "windowProfile": { "mode": "fullscreen", "anchor": "center" },
          "inputProfile": {
            "mode": "controller",
            "density": "immersive",
            "directionalNavigation": true,
            "pointerGestures": false
          }
        }"#;

        let preset: WorkbenchPreset = serde_json::from_str(payload).unwrap();
        assert_eq!(preset.shell_blueprint, ShellBlueprintId::XmbCrossMedia);
        assert_eq!(preset.navigation_model, ShellNavigationModel::CrossAxis);
        assert_eq!(preset.panel_bindings.len(), 1);
    }
}
