//! Shared editor asset browser UI.
//!
//! UE5-style content browser for unified viewport.
//!
//! FEATURES:
//! - Folder tree sidebar (collapsible)
//! - Asset grid with thumbnails
//! - Search/filter bar
//! - Ctrl+Space toggle
//! - Right-click context menu
//! - Drag-to-viewport spawning

#![allow(dead_code)]

use base64::{engine::general_purpose, Engine as _};
use bevy::prelude::*;
use bevy_egui::{egui, EguiContexts, EguiPrimaryContextPass};
use egui::{ColorImage, TextureHandle};
use egui_file_dialog::FileDialog;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::dock::DockWorkspaceState;
use crate::notifications::EditorNotificationEvent;
use crate::panels::PANEL_CONTENT_BROWSER;

// =============================================================================
// TYPES
// =============================================================================

/// Asset type indicator
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AssetType {
    Mesh,
    Material,
    Alpha,
    Texture,
    Scene,
}

fn handle_kernel_sync_event(
    mut events: MessageReader<KernelSyncEvent>,
    mut browser: ResMut<BrowserState>,
    filesystem: Res<AssetBrowserFilesystemConfig>,
) {
    for event in events.read() {
        handle_kernel_sync(&mut browser, &filesystem, &event.json_path);
    }
}

fn handle_toggle_browser_event(
    mut events: MessageReader<ToggleBrowserEvent>,
    mut browser: ResMut<BrowserState>,
    workspace: Option<ResMut<DockWorkspaceState>>,
) {
    let mut workspace = workspace;
    for _ in events.read() {
        if let Some(workspace) = workspace.as_deref_mut() {
            workspace.open = true;
            workspace.focus_tab(PANEL_CONTENT_BROWSER);
            browser.is_open = true;
        } else {
            handle_toggle_browser(&mut browser);
        }
    }
}

impl AssetType {
    pub fn color(&self) -> egui::Color32 {
        match self {
            AssetType::Mesh => egui::Color32::from_rgb(0, 200, 255), // Cyan
            AssetType::Material => egui::Color32::from_rgb(100, 200, 100), // Green
            AssetType::Alpha => egui::Color32::from_rgb(180, 100, 255), // Purple
            AssetType::Texture => egui::Color32::from_rgb(255, 180, 50), // Orange
            AssetType::Scene => egui::Color32::from_rgb(255, 100, 100), // Red
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            AssetType::Mesh => "MESH",
            AssetType::Material => "MAT",
            AssetType::Alpha => "ALPHA",
            AssetType::Texture => "TEX",
            AssetType::Scene => "SCENE",
        }
    }
}

/// Single asset entry in the browser
#[derive(Debug, Clone)]
pub struct AssetEntry {
    pub id: String,
    pub name: String,
    pub asset_type: AssetType,
    pub source: String,
    pub file_path: Option<String>,
    pub thumbnail_base64: Option<String>,
    pub size_bytes: Option<u64>,
}

/// Folder in the asset tree
#[derive(Debug, Clone, Default)]
pub struct BrowserFolder {
    pub name: String,
    pub children: HashMap<String, BrowserFolder>,
    pub assets: Vec<AssetEntry>,
}

impl BrowserFolder {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            children: HashMap::new(),
            assets: Vec::new(),
        }
    }

    /// Add asset to folder, creating subfolders as needed
    pub fn add_asset(&mut self, path: &[&str], asset: AssetEntry) {
        if path.is_empty() {
            self.assets.push(asset);
        } else {
            let folder_name = path[0];
            let child = self
                .children
                .entry(folder_name.to_string())
                .or_insert_with(|| BrowserFolder::new(folder_name));
            child.add_asset(&path[1..], asset);
        }
    }

    /// Count total assets in this folder and all children
    pub fn asset_count(&self) -> usize {
        self.assets.len()
            + self
                .children
                .values()
                .map(|c| c.asset_count())
                .sum::<usize>()
    }
}

/// Context menu state
#[derive(Debug, Clone)]
pub struct ContextMenuState {
    pub position: egui::Pos2,
    pub asset_id: String,
}

// =============================================================================
// RESOURCES
// =============================================================================

#[derive(Resource, Debug, Clone)]
pub struct AssetBrowserFilesystemConfig {
    pub assets_root: PathBuf,
    pub imports_subdir: String,
    pub root_label: String,
}

impl Default for AssetBrowserFilesystemConfig {
    fn default() -> Self {
        Self {
            assets_root: workspace_assets_dir(),
            imports_subdir: "Imports".to_string(),
            root_label: "Assets".to_string(),
        }
    }
}

#[derive(Resource)]
pub(crate) struct AssetImportDialogState {
    file_dialog: FileDialog,
}

impl Default for AssetImportDialogState {
    fn default() -> Self {
        let file_dialog = FileDialog::new()
            .id("kos_asset_import_dialog")
            .default_size([920.0, 620.0])
            .add_file_filter_extensions("3D Assets", vec!["glb", "gltf"]);

        Self { file_dialog }
    }
}

/// Main browser state resource
#[derive(Resource)]
pub struct BrowserState {
    pub is_open: bool,
    pub search_query: String,
    pub active_path: Vec<String>,
    pub expanded_folders: HashSet<String>,
    pub root_folder: BrowserFolder,
    pub selected_asset: Option<String>,
    pub context_menu: Option<ContextMenuState>,
    pub last_sync_time: f64,
    /// Cache for decoded thumbnails (TextureHandle)
    pub thumbnail_cache: HashMap<String, egui::TextureHandle>,
}

impl Default for BrowserState {
    fn default() -> Self {
        let mut root = BrowserFolder::new("Assets");

        // Add some default folders
        root.children
            .insert("Imports".to_string(), BrowserFolder::new("Imports"));
        root.children
            .insert("Materials".to_string(), BrowserFolder::new("Materials"));
        root.children
            .insert("Alphas".to_string(), BrowserFolder::new("Alphas"));

        Self {
            is_open: false,
            search_query: String::new(),
            active_path: vec!["Assets".to_string()],
            expanded_folders: {
                let mut set = HashSet::new();
                set.insert("Assets".to_string());
                set
            },
            root_folder: root,
            selected_asset: None,
            context_menu: None,
            last_sync_time: 0.0,
            thumbnail_cache: HashMap::new(),
        }
    }
}

impl BrowserState {
    /// Get current folder based on active path
    pub fn current_folder(&self) -> &BrowserFolder {
        let mut current = &self.root_folder;
        for (i, segment) in self.active_path.iter().enumerate() {
            if i == 0 {
                continue;
            }
            if let Some(child) = current.children.get(segment) {
                current = child;
            } else {
                return &self.root_folder;
            }
        }
        current
    }

    /// Get filtered assets based on search query
    pub fn get_display_assets(&self) -> Vec<&AssetEntry> {
        if self.search_query.is_empty() {
            self.current_folder().assets.iter().collect()
        } else {
            // Search all assets
            let query = self.search_query.to_lowercase();
            self.collect_all_assets(&self.root_folder)
                .into_iter()
                .filter(|a| a.name.to_lowercase().contains(&query))
                .collect()
        }
    }

    fn collect_all_assets<'a>(&self, folder: &'a BrowserFolder) -> Vec<&'a AssetEntry> {
        let mut assets: Vec<&AssetEntry> = folder.assets.iter().collect();
        for child in folder.children.values() {
            assets.extend(self.collect_all_assets(child));
        }
        assets
    }

    /// Navigate to a folder path
    pub fn navigate_to(&mut self, path: Vec<String>) {
        self.active_path = path.clone();
        self.expanded_folders.insert(path.join("/"));
    }

    /// Toggle folder expansion
    pub fn toggle_folder(&mut self, path: &str) {
        if self.expanded_folders.contains(path) {
            self.expanded_folders.remove(path);
        } else {
            self.expanded_folders.insert(path.to_string());
        }
    }
}

// =============================================================================
// EVENTS
// =============================================================================

/// Request to spawn an asset in the viewport
#[derive(Event, Clone, Debug)]
pub struct SpawnFromBrowserEvent {
    pub asset_id: String,
    pub asset_type: AssetType,
    pub file_path: Option<String>,
}
impl bevy::prelude::Message for SpawnFromBrowserEvent {}

#[derive(Event, Clone, Debug)]
pub struct AssetBrowserImportRequest {
    pub asset_id: String,
    pub file_path: String,
    pub position: Vec3,
}
impl bevy::prelude::Message for AssetBrowserImportRequest {}

#[derive(Event, Clone, Debug)]
pub struct KernelSyncEvent {
    pub json_path: String,
}
impl bevy::prelude::Message for KernelSyncEvent {}

#[derive(Event, Clone, Debug)]
pub struct ToggleBrowserEvent;
impl bevy::prelude::Message for ToggleBrowserEvent {}

/// Request to set an asset as active for editing
#[derive(Event, Clone, Debug)]
pub struct SetActiveAssetEvent {
    pub asset_id: String,
}
impl bevy::prelude::Message for SetActiveAssetEvent {}

// =============================================================================
// PLUGIN
// =============================================================================

pub struct AssetBrowserPlugin;

impl Plugin for AssetBrowserPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<BrowserState>()
            .init_resource::<AssetBrowserFilesystemConfig>()
            .init_resource::<AssetImportDialogState>()
            .add_message::<SpawnFromBrowserEvent>()
            .add_message::<AssetBrowserImportRequest>()
            .add_message::<SetActiveAssetEvent>()
            .add_message::<KernelSyncEvent>()
            .add_message::<ToggleBrowserEvent>()
            .add_systems(Startup, browser_local_scan_startup)
            .add_systems(EguiPrimaryContextPass, browser_ui_system)
            .add_systems(
                Update,
                (
                    browser_keyboard_system,
                    emit_import_requests_from_browser,
                    handle_kernel_sync_event,
                    handle_toggle_browser_event,
                ),
            );
    }
}

// =============================================================================
// THEME COLORS (Modern Dark Theme)
// =============================================================================

mod theme {
    use bevy_egui::egui::Color32;

    pub const BG_DARK: Color32 = Color32::from_rgb(18, 18, 22);
    pub const BG_MEDIUM: Color32 = Color32::from_rgb(28, 28, 35);
    pub const BG_LIGHT: Color32 = Color32::from_rgb(38, 38, 48);
    pub const BG_HOVER: Color32 = Color32::from_rgb(50, 50, 65);
    pub const BG_SELECTED: Color32 = Color32::from_rgb(45, 85, 145);

    pub const ACCENT: Color32 = Color32::from_rgb(80, 160, 255);
    pub const ACCENT_DIM: Color32 = Color32::from_rgb(60, 120, 200);

    pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(230, 230, 235);
    pub const TEXT_SECONDARY: Color32 = Color32::from_rgb(140, 140, 150);
    pub const TEXT_DIM: Color32 = Color32::from_rgb(90, 90, 100);

    pub const BORDER: Color32 = Color32::from_rgb(55, 55, 65);
    pub const BORDER_LIGHT: Color32 = Color32::from_rgb(70, 70, 80);

    // Asset type colors
    pub const MESH_COLOR: Color32 = Color32::from_rgb(80, 200, 255);
    pub const MATERIAL_COLOR: Color32 = Color32::from_rgb(120, 220, 120);
    pub const ALPHA_COLOR: Color32 = Color32::from_rgb(200, 130, 255);
    pub const TEXTURE_COLOR: Color32 = Color32::from_rgb(255, 200, 80);
    pub const SCENE_COLOR: Color32 = Color32::from_rgb(255, 120, 120);
}

// =============================================================================
// SYSTEMS
// =============================================================================

/// Main browser UI system - runs in EguiPrimaryContextPass
fn browser_ui_system(
    mut contexts: EguiContexts,
    mut browser: ResMut<BrowserState>,
    filesystem: Res<AssetBrowserFilesystemConfig>,
    mut import_dialog: ResMut<AssetImportDialogState>,
    mut spawn_events: MessageWriter<SpawnFromBrowserEvent>,
    mut notifications: MessageWriter<EditorNotificationEvent>,
    workspace: Option<Res<DockWorkspaceState>>,
) -> Result {
    let ctx = contexts.ctx_mut()?;

    if workspace.as_deref().is_some_and(|workspace| workspace.open) {
        return Ok(());
    }

    if !browser.is_open {
        return Ok(());
    }

    // Style the panel
    let frame = egui::Frame::new()
        .fill(theme::BG_DARK)
        .inner_margin(egui::Margin::same(0));

    egui::TopBottomPanel::bottom("asset_browser")
        .resizable(true)
        .default_height(280.0)
        .min_height(100.0)
        .max_height(800.0)
        .frame(frame)
        .show(ctx, |ui| {
            // Close on Escape
            if ui.input(|i| i.key_pressed(egui::Key::Escape)) {
                browser.is_open = false;
                return;
            }

            render_browser_workspace_panel(
                ui,
                &mut browser,
                &filesystem,
                &mut import_dialog,
                &mut spawn_events,
                &mut notifications,
                false,
            );
        });

    Ok(())
}

pub(crate) fn render_browser_workspace_panel(
    ui: &mut egui::Ui,
    browser: &mut BrowserState,
    filesystem: &AssetBrowserFilesystemConfig,
    import_dialog: &mut AssetImportDialogState,
    spawn_events: &mut MessageWriter<SpawnFromBrowserEvent>,
    notifications: &mut MessageWriter<EditorNotificationEvent>,
    inside_dock: bool,
) {
    ui.add_space(4.0);
    render_header_bar(ui, browser, filesystem, import_dialog, inside_dock);

    ui.add_space(2.0);
    let rect = ui.available_rect_before_wrap();
    ui.painter().line_segment(
        [rect.left_top(), egui::pos2(rect.right(), rect.top())],
        egui::Stroke::new(1.0, theme::BORDER),
    );
    ui.add_space(4.0);

    ui.horizontal(|ui| {
        render_sidebar(ui, browser);

        let rect = ui.available_rect_before_wrap();
        ui.painter().line_segment(
            [rect.left_top(), egui::pos2(rect.left(), rect.bottom())],
            egui::Stroke::new(1.0, theme::BORDER),
        );
        ui.add_space(8.0);

        render_asset_grid(ui, browser, spawn_events);
    });

    update_import_dialog(ui, browser, filesystem, import_dialog, notifications);
}

/// Render the top header bar with title, search, and controls
fn render_header_bar(
    ui: &mut egui::Ui,
    browser: &mut BrowserState,
    filesystem: &AssetBrowserFilesystemConfig,
    import_dialog: &mut AssetImportDialogState,
    inside_dock: bool,
) {
    ui.horizontal(|ui| {
        ui.spacing_mut().item_spacing.x = 12.0;

        // Title
        ui.label(
            egui::RichText::new("CONTENT BROWSER")
                .color(theme::ACCENT)
                .size(13.0)
                .strong(),
        );

        ui.add_space(8.0);

        // Action buttons with custom styling
        if styled_button(ui, "⬆ IMPORT", theme::BG_LIGHT).clicked() {
            import_dialog.file_dialog.pick_multiple();
        }

        if styled_button(ui, "↻ REFRESH", theme::BG_LIGHT).clicked() {
            scan_local_imports_into_browser(browser, filesystem);
        }

        // Search bar (centered)
        ui.add_space(20.0);

        let search_frame = egui::Frame::new()
            .fill(theme::BG_MEDIUM)
            .stroke(egui::Stroke::new(1.0, theme::BORDER))
            .corner_radius(6.0)
            .inner_margin(egui::Margin::symmetric(8, 4));

        search_frame.show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("🔍").color(theme::TEXT_DIM));
                ui.add(
                    egui::TextEdit::singleline(&mut browser.search_query)
                        .hint_text(egui::RichText::new("Search assets...").color(theme::TEXT_DIM))
                        .desired_width(250.0)
                        .frame(false)
                        .text_color(theme::TEXT_PRIMARY),
                );
            });
        });

        // Right side controls
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if !inside_dock {
                if ui
                    .add(
                        egui::Button::new(
                            egui::RichText::new("✕")
                                .color(theme::TEXT_SECONDARY)
                                .size(14.0),
                        )
                        .fill(egui::Color32::TRANSPARENT)
                        .stroke(egui::Stroke::NONE),
                    )
                    .clicked()
                {
                    browser.is_open = false;
                }

                ui.add_space(12.0);
            }

            // Asset count
            ui.label(
                egui::RichText::new(format!("{} items", browser.root_folder.asset_count()))
                    .color(theme::TEXT_DIM)
                    .size(11.0),
            );
        });
    });
}

/// Styled button helper
fn styled_button(ui: &mut egui::Ui, text: &str, bg: egui::Color32) -> egui::Response {
    ui.add(
        egui::Button::new(
            egui::RichText::new(text)
                .color(theme::TEXT_PRIMARY)
                .size(11.0),
        )
        .fill(bg)
        .stroke(egui::Stroke::new(1.0, theme::BORDER))
        .corner_radius(4.0),
    )
}

/// Render the folder tree sidebar
fn render_sidebar(ui: &mut egui::Ui, browser: &mut BrowserState) {
    let sidebar_frame = egui::Frame::new()
        .fill(theme::BG_MEDIUM)
        .inner_margin(egui::Margin::same(8));

    sidebar_frame.show(ui, |ui| {
        ui.vertical(|ui| {
            egui::ScrollArea::vertical()
                .id_salt("browser_tree")
                .max_width(200.0)
                .show(ui, |ui| {
                    ui.set_min_width(180.0);

                    // Folders header
                    ui.label(
                        egui::RichText::new("FOLDERS")
                            .color(theme::TEXT_DIM)
                            .size(10.0)
                            .strong(),
                    );
                    ui.add_space(8.0);

                    render_folder_tree_modern(ui, browser, vec![browser.root_folder.name.clone()]);
                });
        });
    });
}

/// Render the asset grid with thumbnails
fn render_asset_grid(
    ui: &mut egui::Ui,
    browser: &mut BrowserState,
    spawn_events: &mut MessageWriter<SpawnFromBrowserEvent>,
) {
    egui::ScrollArea::both()
        .id_salt("browser_grid")
        .show(ui, |ui| {
            // Breadcrumb path
            ui.horizontal(|ui| {
                for (i, crumb) in browser.active_path.clone().iter().enumerate() {
                    if i > 0 {
                        ui.label(egui::RichText::new("›").color(theme::TEXT_DIM));
                    }
                    let is_current = i == browser.active_path.len() - 1;
                    let text_color = if is_current {
                        theme::ACCENT
                    } else {
                        theme::TEXT_SECONDARY
                    };

                    if ui
                        .add(
                            egui::Label::new(
                                egui::RichText::new(crumb).color(text_color).size(12.0),
                            )
                            .sense(egui::Sense::click()),
                        )
                        .clicked()
                    {
                        let new_path = browser.active_path[..=i].to_vec();
                        browser.navigate_to(new_path);
                    }
                }
            });

            ui.add_space(12.0);

            // Asset grid
            let assets: Vec<AssetEntry> =
                browser.get_display_assets().into_iter().cloned().collect();

            if assets.is_empty() {
                // Empty state
                ui.vertical_centered(|ui| {
                    ui.add_space(60.0);
                    ui.label(egui::RichText::new("📂").color(theme::TEXT_DIM).size(48.0));
                    ui.add_space(12.0);
                    ui.label(
                        egui::RichText::new("No assets in this folder")
                            .color(theme::TEXT_DIM)
                            .size(14.0),
                    );
                    ui.add_space(8.0);
                    ui.label(
                        egui::RichText::new("Drop files here or use IMPORT")
                            .color(theme::TEXT_DIM)
                            .size(11.0),
                    );
                });
            } else {
                // Grid layout
                let grid_width = ui.available_width();
                let card_size = 100.0;
                let spacing = 12.0;
                let columns = ((grid_width / (card_size + spacing)) as usize).max(1);

                egui::Grid::new("asset_grid")
                    .num_columns(columns)
                    .spacing([spacing, spacing])
                    .show(ui, |ui| {
                        for (i, asset) in assets.iter().enumerate() {
                            render_asset_card_modern(ui, asset, browser, spawn_events);
                            if (i + 1) % columns == 0 {
                                ui.end_row();
                            }
                        }
                    });
            }
        });
}

/// Modern folder tree rendering
fn render_folder_tree_modern(ui: &mut egui::Ui, browser: &mut BrowserState, path: Vec<String>) {
    let path_str = path.join("/");
    let is_expanded = browser.expanded_folders.contains(&path_str);
    let is_active = browser.active_path.join("/") == path_str;

    let folder_name = path.last().cloned().unwrap_or_default();

    let folder = get_folder_at_path(&browser.root_folder, &path);
    let has_children = folder.map(|f| !f.children.is_empty()).unwrap_or(false);
    let item_count = folder.map(|f| f.assets.len()).unwrap_or(0);

    let _bg_color = if is_active {
        theme::BG_SELECTED
    } else {
        egui::Color32::TRANSPARENT
    };

    let _response = ui.horizontal(|ui| {
        // Background highlight
        let rect = ui.available_rect_before_wrap();
        if is_active {
            ui.painter().rect_filled(
                egui::Rect::from_min_size(rect.min, egui::vec2(ui.available_width(), 22.0)),
                4.0,
                theme::BG_SELECTED,
            );
        }

        // Expand arrow
        let arrow = if is_expanded { "▾" } else { "▸" };
        if has_children {
            if ui
                .add(
                    egui::Label::new(egui::RichText::new(arrow).color(theme::TEXT_DIM).size(10.0))
                        .sense(egui::Sense::click()),
                )
                .clicked()
            {
                browser.toggle_folder(&path_str);
            }
        } else {
            ui.add_space(12.0);
        }

        // Folder icon
        let icon = if is_active { "📂" } else { "📁" };
        ui.label(egui::RichText::new(icon).size(12.0));

        // Folder name
        let text_color = if is_active {
            theme::TEXT_PRIMARY
        } else {
            theme::TEXT_SECONDARY
        };
        let response = ui.add(
            egui::Label::new(
                egui::RichText::new(&folder_name)
                    .color(text_color)
                    .size(12.0),
            )
            .sense(egui::Sense::click()),
        );

        if response.clicked() {
            browser.navigate_to(path.clone());
        }

        // Item count badge
        if item_count > 0 {
            ui.label(
                egui::RichText::new(format!("{}", item_count))
                    .size(9.0)
                    .color(theme::TEXT_DIM),
            );
        }
    });

    // Children (if expanded)
    if is_expanded {
        if let Some(folder) = get_folder_at_path(&browser.root_folder, &path) {
            let mut child_names: Vec<_> = folder.children.keys().cloned().collect();
            child_names.sort();

            ui.indent(&path_str, |ui| {
                for child_name in child_names {
                    let mut child_path = path.clone();
                    child_path.push(child_name);
                    render_folder_tree_modern(ui, browser, child_path);
                }
            });
        }
    }
}

fn update_import_dialog(
    ui: &mut egui::Ui,
    browser: &mut BrowserState,
    filesystem: &AssetBrowserFilesystemConfig,
    import_dialog: &mut AssetImportDialogState,
    notifications: &mut MessageWriter<EditorNotificationEvent>,
) {
    import_dialog.file_dialog.update(ui.ctx());

    let Some(selected_paths) = import_dialog.file_dialog.take_picked_multiple() else {
        return;
    };

    let summary = import_files_into_browser(&selected_paths, browser, filesystem);
    emit_import_summary_notifications(notifications, &summary);
}

/// Modern asset card with thumbnail support
fn render_asset_card_modern(
    ui: &mut egui::Ui,
    asset: &AssetEntry,
    browser: &mut BrowserState,
    spawn_events: &mut MessageWriter<SpawnFromBrowserEvent>,
) {
    let is_selected = browser.selected_asset.as_ref() == Some(&asset.id);
    let card_size = egui::vec2(96.0, 110.0);
    let thumb_size = 72.0;

    let (rect, response) = ui.allocate_exact_size(card_size, egui::Sense::click());

    if response.hovered() || is_selected {
        let bg = if is_selected {
            theme::BG_SELECTED
        } else {
            theme::BG_HOVER
        };
        ui.painter().rect_filled(rect, 6.0, bg);
    }

    // Border
    let border_color = if is_selected {
        theme::ACCENT
    } else {
        theme::BORDER
    };
    ui.painter().rect_stroke(
        rect,
        6.0,
        egui::Stroke::new(1.0, border_color),
        egui::StrokeKind::Outside,
    );

    // Thumbnail area
    let thumb_rect = egui::Rect::from_min_size(
        rect.min + egui::vec2((card_size.x - thumb_size) / 2.0, 6.0),
        egui::vec2(thumb_size, thumb_size),
    );

    // Thumbnail background
    ui.painter().rect_filled(thumb_rect, 4.0, theme::BG_DARK);

    // RENDER THUMBNAIL (Cache check)
    let mut has_image = false;
    if let Some(base64_data) = &asset.thumbnail_base64 {
        if !browser.thumbnail_cache.contains_key(&asset.id) {
            // Decode and load texture
            if let Ok(texture) = decode_base64_to_texture(ui.ctx(), &asset.id, base64_data) {
                browser.thumbnail_cache.insert(asset.id.clone(), texture);
            }
        }

        if let Some(texture) = browser.thumbnail_cache.get(&asset.id) {
            ui.painter().image(
                texture.id(),
                thumb_rect,
                egui::Rect::from_min_max(egui::pos2(0.0, 0.0), egui::pos2(1.0, 1.0)),
                egui::Color32::WHITE,
            );
            has_image = true;
        }
    }

    if !has_image {
        // Fallback to icon
        let (type_color, icon) = match asset.asset_type {
            AssetType::Mesh => (theme::MESH_COLOR, "⬡"),
            AssetType::Material => (theme::MATERIAL_COLOR, "◉"),
            AssetType::Alpha => (theme::ALPHA_COLOR, "▣"),
            AssetType::Texture => (theme::TEXTURE_COLOR, "▦"),
            AssetType::Scene => (theme::SCENE_COLOR, "◈"),
        };

        ui.painter().text(
            thumb_rect.center(),
            egui::Align2::CENTER_CENTER,
            icon,
            egui::FontId::proportional(28.0),
            type_color,
        );
    }

    // Type indicator bar at bottom of thumbnail
    let (type_color, _) = match asset.asset_type {
        AssetType::Mesh => (theme::MESH_COLOR, "⬡"),
        AssetType::Material => (theme::MATERIAL_COLOR, "◉"),
        AssetType::Alpha => (theme::ALPHA_COLOR, "▣"),
        AssetType::Texture => (theme::TEXTURE_COLOR, "▦"),
        AssetType::Scene => (theme::SCENE_COLOR, "◈"),
    };
    let bar_rect = egui::Rect::from_min_size(
        egui::pos2(thumb_rect.left(), thumb_rect.bottom() - 3.0),
        egui::vec2(thumb_size, 3.0),
    );
    ui.painter().rect_filled(bar_rect, 0.0, type_color);

    // Asset name (truncated)
    let name_rect = egui::Rect::from_min_size(
        egui::pos2(rect.left() + 4.0, thumb_rect.bottom() + 4.0),
        egui::vec2(card_size.x - 8.0, 16.0),
    );

    let truncated_name = if asset.name.len() > 12 {
        format!("{}...", &asset.name[..10])
    } else {
        asset.name.clone()
    };

    ui.painter().text(
        name_rect.center(),
        egui::Align2::CENTER_CENTER,
        &truncated_name,
        egui::FontId::proportional(10.0),
        if is_selected {
            theme::TEXT_PRIMARY
        } else {
            theme::TEXT_SECONDARY
        },
    );

    // Type label
    let type_rect = egui::Rect::from_min_size(
        egui::pos2(rect.left() + 4.0, name_rect.bottom()),
        egui::vec2(card_size.x - 8.0, 12.0),
    );

    ui.painter().text(
        type_rect.center(),
        egui::Align2::CENTER_CENTER,
        asset.asset_type.label(),
        egui::FontId::proportional(8.0),
        theme::TEXT_DIM,
    );

    // Handle clicks
    if response.clicked() {
        browser.selected_asset = Some(asset.id.clone());
    }
    if response.double_clicked() {
        spawn_events.write(SpawnFromBrowserEvent {
            asset_id: asset.id.clone(),
            asset_type: asset.asset_type,
            file_path: asset.file_path.clone(),
        });
    }

    // Tooltip on hover + context menu (chained since on_hover_ui returns Self)
    response
        .on_hover_ui(|ui| {
            ui.label(egui::RichText::new(&asset.name).strong());
            ui.label(format!("Type: {:?}", asset.asset_type));
            if let Some(size) = asset.size_bytes {
                ui.label(format!("Size: {:.1} KB", size as f64 / 1024.0));
            }
            ui.separator();
            ui.label(
                egui::RichText::new("Double-click to open")
                    .small()
                    .italics(),
            );
        })
        .context_menu(|ui| {
            ui.set_min_width(150.0);

            if ui.button("📦 Open in Sculpt").clicked() {
                spawn_events.write(SpawnFromBrowserEvent {
                    asset_id: asset.id.clone(),
                    asset_type: asset.asset_type,
                    file_path: asset.file_path.clone(),
                });
                ui.close();
            }
            if ui.button("🎨 Open in Painter").clicked() {
                ui.close();
            }
            ui.separator();
            if ui.button("📋 Copy Path").clicked() {
                if let Some(path) = &asset.file_path {
                    ui.ctx().copy_text(path.clone());
                }
                ui.close();
            }
            ui.separator();
            if ui
                .add(egui::Button::new("🗑 Delete").fill(egui::Color32::from_rgb(80, 30, 30)))
                .clicked()
            {
                // Future: delete asset
                ui.close();
            }
        });
}

/// Render folder tree recursively (legacy - keeping for compatibility)
fn render_folder_tree(ui: &mut egui::Ui, browser: &mut BrowserState, path: Vec<String>) {
    let path_str = path.join("/");
    let is_expanded = browser.expanded_folders.contains(&path_str);
    let is_active = browser.active_path.join("/") == path_str;

    let folder_name = path.last().cloned().unwrap_or_default();

    // Get folder reference (need to navigate the tree)
    let folder = get_folder_at_path(&browser.root_folder, &path);
    let has_children = folder.map(|f| !f.children.is_empty()).unwrap_or(false);
    let item_count = folder.map(|f| f.assets.len()).unwrap_or(0);

    ui.horizontal(|ui| {
        // Expand arrow
        let arrow = if is_expanded { "▼" } else { "▶" };
        let arrow_btn = if has_children {
            ui.small_button(arrow)
        } else {
            ui.add_enabled(false, egui::Button::new(" ").small())
        };
        if arrow_btn.clicked() && has_children {
            browser.toggle_folder(&path_str);
        }

        // Folder icon + name
        let icon = if is_active { "📂" } else { "📁" };
        let label = format!("{} {}", icon, folder_name);

        let response = ui.selectable_label(is_active, label);
        if response.clicked() {
            browser.navigate_to(path.clone());
        }

        // Item count
        if item_count > 0 {
            ui.label(
                egui::RichText::new(format!("({})", item_count))
                    .small()
                    .color(egui::Color32::GRAY),
            );
        }
    });

    // Children (if expanded)
    if is_expanded {
        if let Some(folder) = get_folder_at_path(&browser.root_folder, &path) {
            let mut child_names: Vec<_> = folder.children.keys().cloned().collect();
            child_names.sort();

            ui.vertical(|ui| {
                ui.indent(&path_str, |ui| {
                    for child_name in child_names {
                        let mut child_path = path.clone();
                        child_path.push(child_name);
                        render_folder_tree(ui, browser, child_path);
                    }
                });
            });
        }
    }
}

/// Get folder at path
fn get_folder_at_path<'a>(root: &'a BrowserFolder, path: &[String]) -> Option<&'a BrowserFolder> {
    let mut current = root;
    for (i, segment) in path.iter().enumerate() {
        if i == 0 {
            continue;
        } // Skip "Content"
        current = current.children.get(segment)?;
    }
    Some(current)
}

/// Render single asset card
fn render_asset_card(
    ui: &mut egui::Ui,
    asset: &AssetEntry,
    selected: &mut Option<String>,
    spawn_events: &mut MessageWriter<SpawnFromBrowserEvent>,
) {
    let is_selected = selected.as_ref() == Some(&asset.id);
    let size = egui::vec2(80.0, 100.0);

    let response = ui.allocate_ui(size, |ui| {
        ui.vertical_centered(|ui| {
            // Thumbnail area
            let thumb_size = 64.0;
            let (rect, _) =
                ui.allocate_exact_size(egui::vec2(thumb_size, thumb_size), egui::Sense::hover());

            // Background
            let bg_color = if is_selected {
                egui::Color32::from_rgb(60, 60, 80)
            } else {
                egui::Color32::from_rgb(30, 30, 30)
            };
            ui.painter().rect_filled(rect, 4.0, bg_color);

            // Icon based on type
            let icon = match asset.asset_type {
                AssetType::Mesh => "📦",
                AssetType::Material => "🎨",
                AssetType::Alpha => "🖼",
                AssetType::Texture => "🏞",
                AssetType::Scene => "🌐",
            };
            ui.painter().text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                icon,
                egui::FontId::proportional(24.0),
                egui::Color32::GRAY,
            );

            // Type indicator bar at bottom
            let bar_rect = egui::Rect::from_min_size(
                rect.left_bottom() - egui::vec2(0.0, 3.0),
                egui::vec2(thumb_size, 3.0),
            );
            ui.painter()
                .rect_filled(bar_rect, 0.0, asset.asset_type.color());

            // Name
            ui.add_space(4.0);
            ui.label(
                egui::RichText::new(&asset.name)
                    .small()
                    .color(if is_selected {
                        egui::Color32::WHITE
                    } else {
                        egui::Color32::LIGHT_GRAY
                    }),
            );

            // Type label
            ui.label(
                egui::RichText::new(asset.asset_type.label())
                    .small()
                    .color(egui::Color32::DARK_GRAY),
            );
        });
    });

    // Handle clicks
    let response = response.response.interact(egui::Sense::click());
    if response.clicked() {
        *selected = Some(asset.id.clone());
    }
    if response.double_clicked() {
        // Spawn asset
        spawn_events.write(SpawnFromBrowserEvent {
            asset_id: asset.id.clone(),
            asset_type: asset.asset_type,
            file_path: asset.file_path.clone(),
        });
    }

    // Context menu
    response.context_menu(|ui| {
        if ui.button("📦 Open in Sculpt").clicked() {
            spawn_events.write(SpawnFromBrowserEvent {
                asset_id: asset.id.clone(),
                asset_type: asset.asset_type,
                file_path: asset.file_path.clone(),
            });
            ui.close();
        }
        if ui.button("🎨 Open in Painter").clicked() {
            // Future: route to painter
            ui.close();
        }
        ui.separator();
        if ui.button("🗑 Delete").clicked() {
            // Future: delete asset
            ui.close();
        }
    });
}

/// Keyboard handling - Ctrl+Space toggle
fn browser_keyboard_system(keyboard: Res<ButtonInput<KeyCode>>, mut browser: ResMut<BrowserState>) {
    // Ctrl+Space to toggle
    let ctrl = keyboard.pressed(KeyCode::ControlLeft) || keyboard.pressed(KeyCode::ControlRight);
    if ctrl && keyboard.just_pressed(KeyCode::Space) {
        browser.is_open = !browser.is_open;
        info!("Asset Browser toggled: {}", browser.is_open);
    }
}

/// Handle spawning assets from browser
fn emit_import_requests_from_browser(
    mut events: MessageReader<SpawnFromBrowserEvent>,
    mut import_requests: MessageWriter<AssetBrowserImportRequest>,
) {
    for event in events.read() {
        if let Some(path) = event.file_path.clone() {
            import_requests.write(AssetBrowserImportRequest {
                asset_id: event.asset_id.clone(),
                file_path: path,
                position: Vec3::ZERO,
            });
        }
    }
}

#[derive(Default)]
struct AssetImportSummary {
    imported_count: usize,
    skipped_count: usize,
    error_messages: Vec<String>,
}

fn emit_import_summary_notifications(
    notifications: &mut MessageWriter<EditorNotificationEvent>,
    summary: &AssetImportSummary,
) {
    if summary.imported_count > 0 {
        notifications.write(EditorNotificationEvent::success(format!(
            "Imported {} asset(s) into the content browser",
            summary.imported_count
        )));
    }

    if summary.skipped_count > 0 {
        notifications.write(EditorNotificationEvent::warning(format!(
            "Skipped {} unsupported or duplicate asset(s)",
            summary.skipped_count
        )));
    }

    for error in summary.error_messages.iter().take(3) {
        notifications.write(EditorNotificationEvent::error(error.clone()));
    }
}

fn import_files_into_browser(
    selected_paths: &[PathBuf],
    browser: &mut BrowserState,
    filesystem: &AssetBrowserFilesystemConfig,
) -> AssetImportSummary {
    let imports_dir = filesystem.assets_root.join(&filesystem.imports_subdir);
    let mut summary = AssetImportSummary::default();

    if let Err(error) = std::fs::create_dir_all(&imports_dir) {
        summary
            .error_messages
            .push(format!("Failed to prepare import directory {:?}: {error}", imports_dir));
        return summary;
    }

    for source_path in selected_paths {
        if !source_path.is_file() {
            summary.skipped_count += 1;
            continue;
        }

        let Some(extension) = source_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
        else {
            summary.skipped_count += 1;
            continue;
        };

        if extension != "glb" && extension != "gltf" {
            summary.skipped_count += 1;
            continue;
        }

        let Some(file_name) = source_path.file_name() else {
            summary.skipped_count += 1;
            continue;
        };

        let preferred_destination = imports_dir.join(file_name);
        let destination_path = unique_import_destination_path(&preferred_destination);

        match std::fs::copy(source_path, &destination_path) {
            Ok(_) => {
                summary.imported_count += 1;
            }
            Err(error) => {
                summary.error_messages.push(format!(
                    "Failed to import {}: {error}",
                    source_path.display()
                ));
            }
        }
    }

    if summary.imported_count > 0 {
        scan_local_imports_into_browser(browser, filesystem);
    }

    summary
}

fn unique_import_destination_path(preferred_path: &Path) -> PathBuf {
    if !preferred_path.exists() {
        return preferred_path.to_path_buf();
    }

    let stem = preferred_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("ImportedAsset");
    let extension = preferred_path.extension().and_then(|value| value.to_str());
    let parent = preferred_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));

    for index in 1..10_000 {
        let file_name = match extension {
            Some(extension) => format!("{stem}_{index}.{extension}"),
            None => format!("{stem}_{index}"),
        };
        let candidate = parent.join(file_name);
        if !candidate.exists() {
            return candidate;
        }
    }

    preferred_path.to_path_buf()
}

fn browser_local_scan_startup(
    mut browser: ResMut<BrowserState>,
    filesystem: Res<AssetBrowserFilesystemConfig>,
) {
    scan_local_imports_into_browser(&mut browser, &filesystem);
}

fn scan_local_imports_into_browser(
    browser: &mut BrowserState,
    filesystem: &AssetBrowserFilesystemConfig,
) {
    let imports_fs_path = filesystem.assets_root.join(&filesystem.imports_subdir);

    let _ = std::fs::create_dir_all(&imports_fs_path);

    browser.root_folder = BrowserFolder::new(&filesystem.root_label);
    browser.active_path = vec![filesystem.root_label.clone()];
    browser.expanded_folders.clear();
    browser
        .expanded_folders
        .insert(filesystem.root_label.clone());
    browser
        .root_folder
        .children
        .insert("Imports".to_string(), BrowserFolder::new("Imports"));
    browser
        .root_folder
        .children
        .insert("Materials".to_string(), BrowserFolder::new("Materials"));
    browser
        .root_folder
        .children
        .insert("Alphas".to_string(), BrowserFolder::new("Alphas"));

    if let Ok(entries) = std::fs::read_dir(&imports_fs_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let ext = path
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();
            if ext != "glb" && ext != "gltf" {
                continue;
            }

            let file_name = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("Untitled");
            let asset_path = Path::new(&filesystem.imports_subdir).join(file_name);
            let asset_path_str = asset_path.to_string_lossy().replace('\\', "/");

            let size_bytes = std::fs::metadata(&path).ok().map(|m| m.len());

            let entry = AssetEntry {
                id: asset_path_str.clone(),
                name: file_name.to_string(),
                asset_type: AssetType::Mesh,
                source: "Imports".to_string(),
                file_path: Some(asset_path_str),
                thumbnail_base64: None,
                size_bytes,
            };

            browser.root_folder.add_asset(&["Imports"], entry);
        }
    }
}

fn workspace_assets_dir() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .ancestors()
        .find_map(|dir| {
            let candidate = Path::new(dir).join("assets");
            candidate.is_dir().then_some(candidate)
        })
        .unwrap_or_else(|| PathBuf::from("assets"))
}

// =============================================================================
// LEASH MESSAGE HANDLING
// =============================================================================

pub fn handle_kernel_sync(
    browser: &mut BrowserState,
    filesystem: &AssetBrowserFilesystemConfig,
    json_path: &str,
) {
    info!("Syncing kernel storage from: {}", json_path);

    scan_local_imports_into_browser(browser, filesystem);

    // Read JSON file
    if let Ok(contents) = std::fs::read_to_string(json_path) {
        if let Ok(data) = serde_json::from_str::<serde_json::Value>(&contents) {
            // Parse artifacts
            if let Some(artifacts) = data.get("artifacts").and_then(|a| a.as_array()) {
                for artifact in artifacts {
                    let entry = AssetEntry {
                        id: artifact
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string(),
                        name: artifact
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Untitled")
                            .to_string(),
                        asset_type: AssetType::Mesh,
                        source: artifact
                            .get("source")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Imports")
                            .to_string(),
                        file_path: artifact
                            .get("filePath")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        thumbnail_base64: artifact
                            .get("thumbnail")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        size_bytes: artifact.get("size").and_then(|v| v.as_u64()),
                    };
                    let folder = entry.source.clone();
                    browser.root_folder.add_asset(&[folder.as_str()], entry);
                }
            }

            // Parse materials
            if let Some(materials) = data.get("materials").and_then(|a| a.as_array()) {
                for material in materials {
                    let entry = AssetEntry {
                        id: material
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string(),
                        name: material
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Untitled")
                            .to_string(),
                        asset_type: AssetType::Material,
                        source: "Materials".to_string(),
                        file_path: None,
                        thumbnail_base64: material
                            .get("preview")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        size_bytes: None,
                    };
                    browser.root_folder.add_asset(&["Materials"], entry);
                }
            }

            // Parse alphas
            if let Some(alphas) = data.get("alphas").and_then(|a| a.as_array()) {
                for alpha in alphas {
                    let entry = AssetEntry {
                        id: alpha
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string(),
                        name: alpha
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Untitled")
                            .to_string(),
                        asset_type: AssetType::Alpha,
                        source: "Alphas".to_string(),
                        file_path: alpha
                            .get("url")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        thumbnail_base64: alpha
                            .get("preview")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        size_bytes: None,
                    };
                    browser.root_folder.add_asset(&["Alphas"], entry);
                }
            }

            info!(
                "Kernel sync complete: {} total assets",
                browser.root_folder.asset_count()
            );
        }
    }
}

/// Toggle browser visibility from the local runtime
pub fn handle_toggle_browser(browser: &mut BrowserState) {
    browser.is_open = !browser.is_open;
    info!("Asset browser toggled: {}", browser.is_open);
}

/// Helper to decode base64 PNG/JPG to egui TextureHandle
fn decode_base64_to_texture(
    ctx: &egui::Context,
    id: &str,
    base64_str: &str,
) -> std::result::Result<TextureHandle, String> {
    // Strip header if present (e.g. data:image/png;base64,)
    let base64_clean = if let Some(pos) = base64_str.find(',') {
        &base64_str[pos + 1..]
    } else {
        base64_str
    };

    let data = general_purpose::STANDARD
        .decode(base64_clean)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let format = image::guess_format(&data).map_err(|e| format!("Image format error: {}", e))?;
    let image = image::load_from_memory_with_format(&data, format)
        .map_err(|e| format!("Image load error: {}", e))?;

    let rgba = image.to_rgba8();
    let pixels = rgba.as_flat_samples();

    let color_image = ColorImage::from_rgba_unmultiplied(
        [image.width() as usize, image.height() as usize],
        pixels.as_slice(),
    );

    Ok(ctx.load_texture(
        format!("asset_thumb_{}", id),
        color_image,
        egui::TextureOptions::LINEAR,
    ))
}
