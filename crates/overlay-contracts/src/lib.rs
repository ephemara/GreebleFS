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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ThemeCompatibility {
    pub shell_blueprints: Vec<ShellBlueprintId>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeTokenKind {
    Color,
    Typography,
    Spacing,
    Radius,
    Shadow,
    Motion,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ThemeDesignToken {
    pub id: String,
    pub name: String,
    pub kind: ThemeTokenKind,
    pub value: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeLayoutPrimitiveKind {
    Stack,
    Grid,
    Split,
    Dock,
    Freeform,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ThemeLayoutPrimitive {
    pub id: String,
    pub name: String,
    pub kind: ThemeLayoutPrimitiveKind,
    pub props: std::collections::BTreeMap<String, String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeNavigationPatternKind {
    Xmb,
    Tabbed,
    Hierarchy,
    Palette,
    Spatial,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeNavigationAxis {
    Horizontal,
    Vertical,
    Both,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ThemeNavigationPattern {
    pub id: String,
    pub name: String,
    pub kind: ThemeNavigationPatternKind,
    pub axis: ThemeNavigationAxis,
    pub props: std::collections::BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ThemeAnimationProfile {
    pub id: String,
    pub name: String,
    pub duration_ms: u32,
    pub easing: String,
    pub intensity: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeIconPackStyle {
    System,
    Vector,
    Pixel,
    Skeuomorphic,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ThemeIconPackManifest {
    pub id: String,
    pub name: String,
    pub style: ThemeIconPackStyle,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ThemeRenderStyleManifest {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub entry_module: String,
    pub supports_live_swap: bool,
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ThemeManifest {
    pub id: String,
    pub name: String,
    pub extends: Option<String>,
    pub presentation: ThemePresentation,
    pub compatibility: ThemeCompatibility,
    pub design_tokens: Vec<ThemeDesignToken>,
    pub layout_primitives: Vec<ThemeLayoutPrimitive>,
    pub navigation_patterns: Vec<ThemeNavigationPattern>,
    pub animation_profiles: Vec<ThemeAnimationProfile>,
    pub icon_packs: Vec<ThemeIconPackManifest>,
    pub render_styles: Vec<ThemeRenderStyleManifest>,
    pub default_render_style_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum LayoutBarPosition {
    Top,
    Bottom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum LayoutDockSide {
    Left,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ExplorerLayoutMode {
    Full,
    CompactDock,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LayoutPinnedPanel {
    pub panel_id: String,
    pub side: LayoutDockSide,
    pub size: u16,
    pub mode: ExplorerLayoutMode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LayoutChromeConfig {
    pub bar_position: LayoutBarPosition,
    pub show_settings_shortcut: bool,
    pub show_panel_menu: bool,
    pub show_blur_toggle: bool,
    pub show_shortcut_badge: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LayoutControlDockConfig {
    pub enabled: bool,
    pub side: LayoutDockSide,
    pub inset: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LayoutBehaviorConfig {
    pub cycle_order: u16,
    pub default_active_panel_id: String,
    pub enforced_open_panel_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LayoutProfile {
    pub id: String,
    pub label: String,
    pub description: String,
    pub shell_blueprint: ShellBlueprintId,
    pub chrome: LayoutChromeConfig,
    pub control_dock: LayoutControlDockConfig,
    pub pinned_panels: Vec<LayoutPinnedPanel>,
    pub behavior: LayoutBehaviorConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LayoutManifest {
    pub version: u16,
    pub extends_built_ins: bool,
    pub profiles: Vec<LayoutProfile>,
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

pub fn built_in_theme_manifests() -> Vec<ThemeManifest> {
    vec![ThemeManifest {
        id: "operator".to_string(),
        name: "Operator".to_string(),
        extends: None,
        presentation: ThemePresentation {
            density: ThemeDensity::Comfortable,
            chrome_style: ThemeChromeStyle::Floating,
            icon_style: ThemeIconStyle::Vector,
            motion_style: ThemeMotionStyle::Fluid,
            corner_radius: 12,
            panel_spacing: 8,
        },
        compatibility: ThemeCompatibility {
            shell_blueprints: vec![],
            tags: vec!["default".to_string()],
        },
        design_tokens: vec![],
        layout_primitives: vec![],
        navigation_patterns: vec![],
        animation_profiles: vec![ThemeAnimationProfile {
            id: "default-motion".to_string(),
            name: "Default Motion".to_string(),
            duration_ms: 180,
            easing: "ease-in-out".to_string(),
            intensity: 50,
        }],
        icon_packs: vec![ThemeIconPackManifest {
            id: "system-icons".to_string(),
            name: "System Icons".to_string(),
            style: ThemeIconPackStyle::System,
        }],
        render_styles: vec![ThemeRenderStyleManifest {
            id: "default-render".to_string(),
            label: "Default Render".to_string(),
            kind: "vs-code-workbench".to_string(),
            entry_module: "renderers/default.tsx".to_string(),
            supports_live_swap: true,
            description: Some("Built-in renderer placeholder".to_string()),
        }],
        default_render_style_id: Some("default-render".to_string()),
    }]
}

pub fn built_in_workbench_presets() -> Vec<WorkbenchPreset> {
    vec![WorkbenchPreset {
        id: "xmb-media-deck".to_string(),
        label: "XMB Media Deck".to_string(),
        description: "Cross-axis shell".to_string(),
        shell_blueprint: ShellBlueprintId::XmbCrossMedia,
        navigation_model: ShellNavigationModel::CrossAxis,
        preferred_theme_ids: vec!["operator".to_string()],
        panel_bindings: vec![WorkbenchPanelBinding {
            panel_id: "terminal".to_string(),
            region: WorkbenchRegionId::Primary,
            order: 0,
            default_open: true,
            preferred_size: None,
        }],
        window_profile: WorkbenchWindowProfile {
            mode: WorkbenchWindowMode::Fullscreen,
            anchor: Some("center".to_string()),
            aspect_ratio: Some("16:9".to_string()),
        },
        input_profile: WorkbenchInputProfile {
            mode: WorkbenchInputMode::Controller,
            density: ThemeDensity::Immersive,
            directional_navigation: true,
            pointer_gestures: false,
        },
    }]
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
