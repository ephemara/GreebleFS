use std::collections::BTreeMap;

use serde::{de::DeserializeOwned, Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum ShellBlueprintId {
    ClassicDock,
    IdeWorkbench,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ThemeValue {
    String(String),
    Number(serde_json::Number),
    Boolean(bool),
    Null,
    Array(Vec<ThemeValue>),
    Object(BTreeMap<String, ThemeValue>),
}

impl specta::Type for ThemeValue {
    fn inline(_: &mut specta::TypeCollection, _: specta::Generics) -> specta::datatype::DataType {
        specta::datatype::DataType::Any
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ThemeDesignToken {
    pub id: String,
    pub name: String,
    pub kind: ThemeTokenKind,
    pub value: ThemeValue,
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
    pub props: std::collections::BTreeMap<String, ThemeValue>,
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
    pub props: std::collections::BTreeMap<String, ThemeValue>,
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
pub enum ThemeRenderStyleKind {
    VsCodeWorkbench,
    Ps3Xmb,
    IosSpringboard,
    WiiChannels,
    DesktopWindowManager,
    Custom,
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
    pub kind: ThemeRenderStyleKind,
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
    pub default_layout_primitive_id: Option<String>,
    pub default_navigation_pattern_id: Option<String>,
    pub default_animation_profile_id: Option<String>,
    pub default_icon_pack_id: Option<String>,
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
    Dock,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum LayoutSurfaceOwner {
    ActivePanel,
    PinnedRail,
    Chrome,
    Session,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum LayoutBackBehavior {
    OverlayFirst,
    HistoryFirst,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum LayoutModeExitTarget {
    LastBrowseTarget,
    ShellDefault,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum LayoutProgressOwner {
    Inline,
    Session,
    History,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LayoutInteractionConfig {
    pub primary_axis_owner: LayoutSurfaceOwner,
    pub command_owner: LayoutSurfaceOwner,
    pub back_behavior: LayoutBackBehavior,
    pub mode_exit_target: LayoutModeExitTarget,
    pub progress_owner: LayoutProgressOwner,
    pub preserve_focus_anchor: bool,
    pub preserve_selection_anchor: bool,
    pub preserve_location_anchor: bool,
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
    pub interaction: LayoutInteractionConfig,
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
    pub label: String,
    pub description: String,
    pub navigation_model: ShellNavigationModel,
    pub surface_style: ShellSurfaceStyle,
    pub supports_pinned_panels: bool,
    pub supports_viewport_dock: bool,
    pub supports_panel_tabs: bool,
    pub supports_dual_screen: bool,
}

const SHIPPED_SHELL_BLUEPRINTS_JSON: &str =
    include_str!("../../../usr/domain/shell-blueprints.json");
const SHIPPED_THEME_MANIFESTS_JSON: &str =
    include_str!("../../../usr/domain/theme-manifests.json");
const SHIPPED_WORKBENCH_PRESETS_JSON: &str =
    include_str!("../../../usr/domain/workbench-presets.json");

fn parse_shipped_domain_catalog<T>(catalog_name: &str, json_text: &str) -> Vec<T>
where
    T: DeserializeOwned,
{
    serde_json::from_str(json_text).unwrap_or_else(|error| {
        panic!("failed to parse shipped domain catalog {catalog_name}: {error}")
    })
}

pub fn built_in_shell_blueprints() -> Vec<ShellBlueprint> {
    parse_shipped_domain_catalog("shell-blueprints", SHIPPED_SHELL_BLUEPRINTS_JSON)
}

pub fn built_in_theme_manifests() -> Vec<ThemeManifest> {
    parse_shipped_domain_catalog("theme-manifests", SHIPPED_THEME_MANIFESTS_JSON)
}

pub fn built_in_workbench_presets() -> Vec<WorkbenchPreset> {
    parse_shipped_domain_catalog("workbench-presets", SHIPPED_WORKBENCH_PRESETS_JSON)
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
    fn exposes_all_shipped_theme_manifests() {
        let manifests = built_in_theme_manifests();
        let ids = manifests
            .iter()
            .map(|manifest| manifest.id.as_str())
            .collect::<Vec<_>>();

        assert_eq!(
            ids,
            vec![
                "operator",
                "aqua-light",
                "plasma-flow",
                "vintage-macintosh",
                "vista-glass",
            ]
        );

        let vista = manifests
            .iter()
            .find(|manifest| manifest.id == "vista-glass")
            .unwrap();
        let operator = manifests
            .iter()
            .find(|manifest| manifest.id == "operator")
            .unwrap();
        assert_eq!(
            operator.default_layout_primitive_id.as_deref(),
            Some("operator-stack")
        );
        assert_eq!(
            operator.default_navigation_pattern_id.as_deref(),
            Some("operator-tabs")
        );
        assert_eq!(
            operator.default_animation_profile_id.as_deref(),
            Some("default-motion")
        );
        assert_eq!(
            operator.default_icon_pack_id.as_deref(),
            Some("system-icons")
        );
        assert_eq!(
            vista.default_render_style_id.as_deref(),
            Some("vista-render")
        );
        assert_eq!(
            vista.render_styles[0].kind,
            ThemeRenderStyleKind::VsCodeWorkbench
        );
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
