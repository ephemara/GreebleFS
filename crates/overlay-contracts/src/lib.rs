use std::collections::BTreeMap;

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
    vec![
        ThemeManifest {
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
                tags: vec!["default".to_string(), "workbench".to_string()],
            },
            design_tokens: vec![
                ThemeDesignToken {
                    id: "accent-operator".to_string(),
                    name: "Accent".to_string(),
                    kind: ThemeTokenKind::Color,
                    value: ThemeValue::String("#6366f1".to_string()),
                },
                ThemeDesignToken {
                    id: "panel-spacing".to_string(),
                    name: "Panel Spacing".to_string(),
                    kind: ThemeTokenKind::Spacing,
                    value: ThemeValue::Number(serde_json::Number::from(8)),
                },
            ],
            layout_primitives: vec![
                ThemeLayoutPrimitive {
                    id: "operator-stack".to_string(),
                    name: "Operator Stack".to_string(),
                    kind: ThemeLayoutPrimitiveKind::Stack,
                    props: BTreeMap::from([("gap".to_string(), ThemeValue::Number(serde_json::Number::from(8)))]),
                },
                ThemeLayoutPrimitive {
                    id: "operator-dock".to_string(),
                    name: "Operator Dock".to_string(),
                    kind: ThemeLayoutPrimitiveKind::Dock,
                    props: BTreeMap::from([("side".to_string(), ThemeValue::String("right".to_string()))]),
                },
            ],
            navigation_patterns: vec![ThemeNavigationPattern {
                id: "operator-tabs".to_string(),
                name: "Operator Tabs".to_string(),
                kind: ThemeNavigationPatternKind::Tabbed,
                axis: ThemeNavigationAxis::Horizontal,
                props: BTreeMap::from([
                    ("defaultSurface".to_string(), ThemeValue::String("terminal".to_string())),
                    ("focusRing".to_string(), ThemeValue::String("chrome".to_string())),
                ]),
            }],
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
                label: "Workbench".to_string(),
                kind: ThemeRenderStyleKind::VsCodeWorkbench,
                entry_module: "renderers/default.tsx".to_string(),
                supports_live_swap: true,
                description: Some("Built-in workbench renderer placeholder".to_string()),
            }],
            default_layout_primitive_id: Some("operator-stack".to_string()),
            default_navigation_pattern_id: Some("operator-tabs".to_string()),
            default_animation_profile_id: Some("default-motion".to_string()),
            default_icon_pack_id: Some("system-icons".to_string()),
            default_render_style_id: Some("default-render".to_string()),
        },
        ThemeManifest {
            id: "aqua-light".to_string(),
            name: "Aqua Light".to_string(),
            extends: Some("operator".to_string()),
            presentation: ThemePresentation {
                density: ThemeDensity::Comfortable,
                chrome_style: ThemeChromeStyle::Floating,
                icon_style: ThemeIconStyle::Vector,
                motion_style: ThemeMotionStyle::Fluid,
                corner_radius: 14,
                panel_spacing: 10,
            },
            compatibility: ThemeCompatibility {
                shell_blueprints: vec![ShellBlueprintId::ClassicDock],
                tags: vec!["light".to_string(), "aqua".to_string(), "chrome".to_string()],
            },
            design_tokens: vec![
                ThemeDesignToken {
                    id: "aqua-accent".to_string(),
                    name: "Accent".to_string(),
                    kind: ThemeTokenKind::Color,
                    value: ThemeValue::String("#2a9df4".to_string()),
                },
                ThemeDesignToken {
                    id: "aqua-radius".to_string(),
                    name: "Card Radius".to_string(),
                    kind: ThemeTokenKind::Radius,
                    value: ThemeValue::Number(serde_json::Number::from(12)),
                },
            ],
            layout_primitives: vec![ThemeLayoutPrimitive {
                id: "aqua-shell".to_string(),
                name: "Aqua Shell".to_string(),
                kind: ThemeLayoutPrimitiveKind::Split,
                    props: BTreeMap::from([(
                        "primaryRatio".to_string(),
                        ThemeValue::Number(serde_json::Number::from_f64(0.62).expect("valid ratio")),
                    )]),
            }],
            navigation_patterns: vec![ThemeNavigationPattern {
                id: "aqua-cascade".to_string(),
                name: "Aqua Cascade".to_string(),
                kind: ThemeNavigationPatternKind::Spatial,
                axis: ThemeNavigationAxis::Both,
                    props: BTreeMap::from([("breadcrumb".to_string(), ThemeValue::Boolean(true))]),
            }],
            animation_profiles: vec![ThemeAnimationProfile {
                id: "aqua-sheen".to_string(),
                name: "Aqua Sheen".to_string(),
                duration_ms: 220,
                easing: "ease-out".to_string(),
                intensity: 42,
            }],
            icon_packs: vec![ThemeIconPackManifest {
                id: "aqua-icons".to_string(),
                name: "Aqua Icons".to_string(),
                style: ThemeIconPackStyle::Vector,
            }],
            render_styles: vec![ThemeRenderStyleManifest {
                id: "aqua-render".to_string(),
                label: "Aqua Glass".to_string(),
                kind: ThemeRenderStyleKind::VsCodeWorkbench,
                entry_module: "renderers/aqua-light.tsx".to_string(),
                supports_live_swap: true,
                description: Some("Bright Aqua chrome and translucent panels.".to_string()),
            }],
            default_layout_primitive_id: Some("aqua-shell".to_string()),
            default_navigation_pattern_id: Some("aqua-cascade".to_string()),
            default_animation_profile_id: Some("aqua-sheen".to_string()),
            default_icon_pack_id: Some("aqua-icons".to_string()),
            default_render_style_id: Some("aqua-render".to_string()),
        },
        ThemeManifest {
            id: "plasma-flow".to_string(),
            name: "Plasma Flow".to_string(),
            extends: Some("operator".to_string()),
            presentation: ThemePresentation {
                density: ThemeDensity::Comfortable,
                chrome_style: ThemeChromeStyle::Floating,
                icon_style: ThemeIconStyle::Vector,
                motion_style: ThemeMotionStyle::Dramatic,
                corner_radius: 12,
                panel_spacing: 10,
            },
            compatibility: ThemeCompatibility {
                shell_blueprints: vec![ShellBlueprintId::ClassicDock],
                tags: vec!["neon".to_string(), "plasma".to_string(), "cyber".to_string()],
            },
            design_tokens: vec![
                ThemeDesignToken {
                    id: "plasma-accent".to_string(),
                    name: "Accent".to_string(),
                    kind: ThemeTokenKind::Color,
                    value: ThemeValue::String("#59e3ff".to_string()),
                },
                ThemeDesignToken {
                    id: "plasma-motion".to_string(),
                    name: "Motion".to_string(),
                    kind: ThemeTokenKind::Motion,
                    value: ThemeValue::Number(serde_json::Number::from(240)),
                },
            ],
            layout_primitives: vec![ThemeLayoutPrimitive {
                id: "plasma-grid".to_string(),
                name: "Plasma Grid".to_string(),
                kind: ThemeLayoutPrimitiveKind::Grid,
                    props: BTreeMap::from([("cellSize".to_string(), ThemeValue::Number(serde_json::Number::from(140)))]),
            }],
            navigation_patterns: vec![ThemeNavigationPattern {
                id: "plasma-trail".to_string(),
                name: "Plasma Trail".to_string(),
                kind: ThemeNavigationPatternKind::Xmb,
                axis: ThemeNavigationAxis::Horizontal,
                    props: BTreeMap::from([("categoryDepth".to_string(), ThemeValue::Number(serde_json::Number::from(2)))]),
            }],
            animation_profiles: vec![ThemeAnimationProfile {
                id: "plasma-surge".to_string(),
                name: "Plasma Surge".to_string(),
                duration_ms: 240,
                easing: "ease-out".to_string(),
                intensity: 62,
            }],
            icon_packs: vec![ThemeIconPackManifest {
                id: "plasma-icons".to_string(),
                name: "Plasma Icons".to_string(),
                style: ThemeIconPackStyle::Vector,
            }],
            render_styles: vec![ThemeRenderStyleManifest {
                id: "plasma-render".to_string(),
                label: "Plasma Lab".to_string(),
                kind: ThemeRenderStyleKind::VsCodeWorkbench,
                entry_module: "renderers/plasma-flow.tsx".to_string(),
                supports_live_swap: true,
                description: Some("Neon dark shell with crisp panels.".to_string()),
            }],
            default_layout_primitive_id: Some("plasma-grid".to_string()),
            default_navigation_pattern_id: Some("plasma-trail".to_string()),
            default_animation_profile_id: Some("plasma-surge".to_string()),
            default_icon_pack_id: Some("plasma-icons".to_string()),
            default_render_style_id: Some("plasma-render".to_string()),
        },
        ThemeManifest {
            id: "vintage-macintosh".to_string(),
            name: "Vintage Macintosh".to_string(),
            extends: Some("operator".to_string()),
            presentation: ThemePresentation {
                density: ThemeDensity::Comfortable,
                chrome_style: ThemeChromeStyle::Ornate,
                icon_style: ThemeIconStyle::Skeuomorphic,
                motion_style: ThemeMotionStyle::Dramatic,
                corner_radius: 10,
                panel_spacing: 12,
            },
            compatibility: ThemeCompatibility {
                shell_blueprints: vec![ShellBlueprintId::RetroDesktop],
                tags: vec!["vintage".to_string(), "macintosh".to_string(), "crt".to_string()],
            },
            design_tokens: vec![
                ThemeDesignToken {
                    id: "vintage-accent".to_string(),
                    name: "Accent".to_string(),
                    kind: ThemeTokenKind::Color,
                    value: ThemeValue::String("#506f42".to_string()),
                },
                ThemeDesignToken {
                    id: "vintage-radius".to_string(),
                    name: "Bezel Radius".to_string(),
                    kind: ThemeTokenKind::Radius,
                    value: ThemeValue::Number(serde_json::Number::from(10)),
                },
            ],
            layout_primitives: vec![ThemeLayoutPrimitive {
                id: "vintage-window".to_string(),
                name: "Vintage Window".to_string(),
                kind: ThemeLayoutPrimitiveKind::Freeform,
                    props: BTreeMap::from([("bezel".to_string(), ThemeValue::Boolean(true))]),
            }],
            navigation_patterns: vec![ThemeNavigationPattern {
                id: "vintage-desktop".to_string(),
                name: "Vintage Desktop".to_string(),
                kind: ThemeNavigationPatternKind::Hierarchy,
                axis: ThemeNavigationAxis::Vertical,
                    props: BTreeMap::from([("menuBar".to_string(), ThemeValue::Boolean(true))]),
            }],
            animation_profiles: vec![ThemeAnimationProfile {
                id: "vintage-power-on".to_string(),
                name: "Power On".to_string(),
                duration_ms: 300,
                easing: "ease-in-out".to_string(),
                intensity: 58,
            }],
            icon_packs: vec![ThemeIconPackManifest {
                id: "vintage-icons".to_string(),
                name: "Vintage Icons".to_string(),
                style: ThemeIconPackStyle::Skeuomorphic,
            }],
            render_styles: vec![ThemeRenderStyleManifest {
                id: "vintage-render".to_string(),
                label: "Vintage Desktop".to_string(),
                kind: ThemeRenderStyleKind::DesktopWindowManager,
                entry_module: "renderers/vintage-macintosh.tsx".to_string(),
                supports_live_swap: true,
                description: Some("Desktop chrome tuned for retro Macintosh shells.".to_string()),
            }],
            default_layout_primitive_id: Some("vintage-window".to_string()),
            default_navigation_pattern_id: Some("vintage-desktop".to_string()),
            default_animation_profile_id: Some("vintage-power-on".to_string()),
            default_icon_pack_id: Some("vintage-icons".to_string()),
            default_render_style_id: Some("vintage-render".to_string()),
        },
        ThemeManifest {
            id: "vista-glass".to_string(),
            name: "Vista Glass".to_string(),
            extends: Some("github-dark".to_string()),
            presentation: ThemePresentation {
                density: ThemeDensity::Comfortable,
                chrome_style: ThemeChromeStyle::Floating,
                icon_style: ThemeIconStyle::Skeuomorphic,
                motion_style: ThemeMotionStyle::Fluid,
                corner_radius: 16,
                panel_spacing: 10,
            },
            compatibility: ThemeCompatibility {
                shell_blueprints: vec![ShellBlueprintId::ClassicDock],
                tags: vec!["glass".to_string(), "aero".to_string(), "blue".to_string()],
            },
            design_tokens: vec![
                ThemeDesignToken {
                    id: "vista-accent".to_string(),
                    name: "Accent".to_string(),
                    kind: ThemeTokenKind::Color,
                    value: ThemeValue::String("#7dd3ff".to_string()),
                },
                ThemeDesignToken {
                    id: "vista-shadow".to_string(),
                    name: "Overlay Shadow".to_string(),
                    kind: ThemeTokenKind::Shadow,
                    value: ThemeValue::String("0 20px 64px rgba(0, 0, 0, 0.44)".to_string()),
                },
            ],
            layout_primitives: vec![ThemeLayoutPrimitive {
                id: "vista-glass-shell".to_string(),
                name: "Vista Glass Shell".to_string(),
                kind: ThemeLayoutPrimitiveKind::Dock,
                    props: BTreeMap::from([("chrome".to_string(), ThemeValue::String("frosted".to_string()))]),
            }],
            navigation_patterns: vec![ThemeNavigationPattern {
                id: "vista-breadcrumbs".to_string(),
                name: "Vista Breadcrumbs".to_string(),
                kind: ThemeNavigationPatternKind::Palette,
                axis: ThemeNavigationAxis::Horizontal,
                    props: BTreeMap::from([("searchFirst".to_string(), ThemeValue::Boolean(true))]),
            }],
            animation_profiles: vec![ThemeAnimationProfile {
                id: "vista-bloom".to_string(),
                name: "Vista Bloom".to_string(),
                duration_ms: 260,
                easing: "ease-out".to_string(),
                intensity: 54,
            }],
            icon_packs: vec![ThemeIconPackManifest {
                id: "vista-icons".to_string(),
                name: "Vista Icons".to_string(),
                style: ThemeIconPackStyle::Skeuomorphic,
            }],
            render_styles: vec![ThemeRenderStyleManifest {
                id: "vista-render".to_string(),
                label: "Vista Glass".to_string(),
                kind: ThemeRenderStyleKind::VsCodeWorkbench,
                entry_module: "renderers/vista-glass.tsx".to_string(),
                supports_live_swap: true,
                description: Some("Glossy Aero-inspired render style for glass shells.".to_string()),
            }],
            default_layout_primitive_id: Some("vista-glass-shell".to_string()),
            default_navigation_pattern_id: Some("vista-breadcrumbs".to_string()),
            default_animation_profile_id: Some("vista-bloom".to_string()),
            default_icon_pack_id: Some("vista-icons".to_string()),
            default_render_style_id: Some("vista-render".to_string()),
        },
    ]
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
    fn exposes_all_shipped_theme_manifests() {
        let manifests = built_in_theme_manifests();
        let ids = manifests.iter().map(|manifest| manifest.id.as_str()).collect::<Vec<_>>();

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

        let vista = manifests.iter().find(|manifest| manifest.id == "vista-glass").unwrap();
        let operator = manifests.iter().find(|manifest| manifest.id == "operator").unwrap();
        assert_eq!(operator.default_layout_primitive_id.as_deref(), Some("operator-stack"));
        assert_eq!(operator.default_navigation_pattern_id.as_deref(), Some("operator-tabs"));
        assert_eq!(operator.default_animation_profile_id.as_deref(), Some("default-motion"));
        assert_eq!(operator.default_icon_pack_id.as_deref(), Some("system-icons"));
        assert_eq!(vista.default_render_style_id.as_deref(), Some("vista-render"));
        assert_eq!(vista.render_styles[0].kind, ThemeRenderStyleKind::VsCodeWorkbench);
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
