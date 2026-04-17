use bevy::prelude::*;
use bevy_egui::{egui, EguiContexts, EguiPrimaryContextPass};
use egui_dock::{DockArea, DockState, NodeIndex, Style, TabViewer};

use crate::asset_browser::{
    render_browser_workspace_panel, AssetBrowserFilesystemConfig, AssetImportDialogState, BrowserState,
    SpawnFromBrowserEvent,
};
use crate::notifications::EditorNotificationEvent;
use crate::panels::{
    DockWorkspaceLayoutTemplate, KeyValuePanelStore, PanelLayoutNode, PanelSplitAxis,
    SuitePanelDefinition, SuitePanelKind, SuitePanelRegistry, PANEL_CONTENT_BROWSER,
    PANEL_UI_SURFACES, PANEL_VIEWPORT,
};
use crate::surfaces::{
    render_ui_surfaces_workspace_panel, UiDocStore, UiLocalState, UiSurfaceAction,
    UiSurfaceRegistry, UiSurfacesHudState, UiWidgetRegistry,
};

pub type DockWorkspaceTab = String;

#[derive(Resource)]
pub struct DockWorkspaceState {
    pub open: bool,
    pub dock_state: DockState<DockWorkspaceTab>,
    initialized_layout: bool,
}

impl Default for DockWorkspaceState {
    fn default() -> Self {
        Self {
            open: true,
            dock_state: DockState::new(vec![PANEL_VIEWPORT.to_string()]),
            initialized_layout: false,
        }
    }
}

impl DockWorkspaceState {
    pub fn focus_tab(&mut self, target: impl Into<String>) {
        let target = target.into();
        if let Some((surface, node, tab)) = self.dock_state.find_tab(&target) {
            self.dock_state.set_focused_node_and_surface((surface, node));
            self.dock_state.set_active_tab((surface, node, tab));
            return;
        }

        self.dock_state.push_to_focused_leaf(target);
    }
}

fn dock_style_from_egui(ui_style: &egui::Style) -> Style {
    let mut style = Style::from_egui(ui_style);
    style.dock_area_padding = Some(egui::Margin::ZERO);
    style.main_surface_border_stroke = egui::Stroke::NONE;
    style.main_surface_border_rounding = egui::CornerRadius::ZERO;
    style.tab.tab_body.bg_fill = egui::Color32::TRANSPARENT;
    style.tab.tab_body.stroke = egui::Stroke::NONE;
    style.tab.tab_body.corner_radius = egui::CornerRadius::ZERO;
    style
}

pub struct DockWorkspacePlugin;

impl Plugin for DockWorkspacePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<SuitePanelRegistry>()
            .init_resource::<DockWorkspaceLayoutTemplate>()
            .init_resource::<KeyValuePanelStore>()
            .init_resource::<DockWorkspaceState>()
            .add_systems(Startup, register_builtin_panels)
            .add_systems(Update, (toggle_workspace_dock, ensure_workspace_layout_initialized))
            .add_systems(EguiPrimaryContextPass, dock_workspace_system);
    }
}

fn register_builtin_panels(mut registry: ResMut<SuitePanelRegistry>) {
    registry.register(SuitePanelDefinition::new(
        PANEL_VIEWPORT,
        "Viewport",
        SuitePanelKind::Viewport,
    ));
    registry.register(SuitePanelDefinition::new(
        PANEL_CONTENT_BROWSER,
        "Content Browser",
        SuitePanelKind::AssetBrowser,
    ));
    registry.register(SuitePanelDefinition::new(
        PANEL_UI_SURFACES,
        "UI Surfaces",
        SuitePanelKind::UiSurfaceStudio,
    ));
}

fn toggle_workspace_dock(
    keyboard: Res<ButtonInput<KeyCode>>,
    mut workspace: ResMut<DockWorkspaceState>,
) {
    if keyboard.just_pressed(KeyCode::F9) {
        workspace.open = !workspace.open;
    }
}

fn ensure_workspace_layout_initialized(
    mut workspace: ResMut<DockWorkspaceState>,
    registry: Res<SuitePanelRegistry>,
    template: Res<DockWorkspaceLayoutTemplate>,
) {
    if workspace.initialized_layout {
        return;
    }

    workspace.dock_state = build_dock_state(&template, &registry);
    workspace.initialized_layout = true;
}

fn build_dock_state(
    template: &DockWorkspaceLayoutTemplate,
    registry: &SuitePanelRegistry,
) -> DockState<DockWorkspaceTab> {
    let root_tabs = first_leaf_tabs(&template.root, registry)
        .unwrap_or_else(|| vec![PANEL_VIEWPORT.to_string()]);
    let mut dock_state = DockState::new(root_tabs);
    apply_layout_node(
        dock_state.main_surface_mut(),
        NodeIndex::root(),
        &template.root,
        registry,
    );
    dock_state
}

fn first_leaf_tabs(
    node: &PanelLayoutNode,
    registry: &SuitePanelRegistry,
) -> Option<Vec<DockWorkspaceTab>> {
    match node {
        PanelLayoutNode::Leaf { panel_keys } => {
            let tabs = panel_keys
                .iter()
                .filter(|key| registry.contains(key))
                .cloned()
                .collect::<Vec<_>>();
            (!tabs.is_empty()).then_some(tabs)
        }
        PanelLayoutNode::Split { first, second, .. } => first_leaf_tabs(first, registry)
            .or_else(|| first_leaf_tabs(second, registry)),
    }
}

fn apply_layout_node(
    tree: &mut egui_dock::Tree<DockWorkspaceTab>,
    node_index: NodeIndex,
    node: &PanelLayoutNode,
    registry: &SuitePanelRegistry,
) {
    match node {
        PanelLayoutNode::Leaf { .. } => {}
        PanelLayoutNode::Split {
            axis,
            ratio,
            first,
            second,
        } => {
            let first_tabs = first_leaf_tabs(first, registry);
            let second_tabs = first_leaf_tabs(second, registry);

            match (first_tabs, second_tabs) {
                (Some(_), Some(second_tabs)) => {
                    let [first_node, second_node] = match axis {
                        PanelSplitAxis::Horizontal => tree.split_right(node_index, *ratio, second_tabs),
                        PanelSplitAxis::Vertical => tree.split_below(node_index, *ratio, second_tabs),
                    };
                    apply_layout_node(tree, first_node, first, registry);
                    apply_layout_node(tree, second_node, second, registry);
                }
                (Some(_), None) => apply_layout_node(tree, node_index, first, registry),
                (None, Some(_)) => apply_layout_node(tree, node_index, second, registry),
                (None, None) => {}
            }
        }
    }
}

fn dock_workspace_system(
    mut contexts: EguiContexts,
    mut workspace: ResMut<DockWorkspaceState>,
    registry: Res<SuitePanelRegistry>,
    mut browser: ResMut<BrowserState>,
    filesystem: Res<AssetBrowserFilesystemConfig>,
    mut import_dialog: ResMut<AssetImportDialogState>,
    mut spawn_events: MessageWriter<SpawnFromBrowserEvent>,
    mut notifications: MessageWriter<EditorNotificationEvent>,
    key_value_panels: Res<KeyValuePanelStore>,
    mut surfaces: ResMut<UiSurfaceRegistry>,
    mut docs: ResMut<UiDocStore>,
    mut locals: ResMut<UiLocalState>,
    widgets: Res<UiWidgetRegistry>,
    mut actions: MessageWriter<UiSurfaceAction>,
    mut surfaces_hud: ResMut<UiSurfacesHudState>,
) -> Result {
    if !workspace.open || !workspace.initialized_layout {
        return Ok(());
    }

    let ctx = contexts.ctx_mut()?;
    let mut viewer = DockWorkspaceViewer {
        registry: &registry,
        browser: &mut browser,
        filesystem: &filesystem,
        import_dialog: &mut import_dialog,
        spawn_events: &mut spawn_events,
        notifications: &mut notifications,
        key_value_panels: &key_value_panels,
        surfaces: &mut surfaces,
        docs: &mut docs,
        locals: &mut locals,
        widgets: &widgets,
        actions: &mut actions,
        surfaces_hud: &mut surfaces_hud,
    };

    let style = dock_style_from_egui(ctx.style().as_ref());
    DockArea::new(&mut workspace.dock_state)
        .style(style)
        .show_add_buttons(false)
        .show_close_buttons(false)
        .show(ctx, &mut viewer);

    Ok(())
}

struct DockWorkspaceViewer<'a, 'spawn, 'notify, 'action> {
    registry: &'a SuitePanelRegistry,
    browser: &'a mut BrowserState,
    filesystem: &'a AssetBrowserFilesystemConfig,
    import_dialog: &'a mut AssetImportDialogState,
    spawn_events: &'a mut MessageWriter<'spawn, SpawnFromBrowserEvent>,
    notifications: &'a mut MessageWriter<'notify, EditorNotificationEvent>,
    key_value_panels: &'a KeyValuePanelStore,
    surfaces: &'a mut UiSurfaceRegistry,
    docs: &'a mut UiDocStore,
    locals: &'a mut UiLocalState,
    widgets: &'a UiWidgetRegistry,
    actions: &'a mut MessageWriter<'action, UiSurfaceAction>,
    surfaces_hud: &'a mut UiSurfacesHudState,
}

impl TabViewer for DockWorkspaceViewer<'_, '_, '_, '_> {
    type Tab = DockWorkspaceTab;

    fn title(&mut self, tab: &mut Self::Tab) -> egui::WidgetText {
        self.registry
            .get(tab)
            .map(|definition| definition.title.clone().into())
            .unwrap_or_else(|| tab.clone().into())
    }

    fn ui(&mut self, ui: &mut egui::Ui, tab: &mut Self::Tab) {
        let Some(definition) = self.registry.get(tab).cloned() else {
            ui.colored_label(
                egui::Color32::from_rgb(255, 110, 110),
                format!("Unknown suite panel: {tab}"),
            );
            return;
        };

        match definition.kind {
            SuitePanelKind::Viewport => render_native_viewport_panel(ui),
            SuitePanelKind::AssetBrowser => {
                self.browser.is_open = true;
                render_browser_workspace_panel(
                    ui,
                    self.browser,
                    self.filesystem,
                    self.import_dialog,
                    self.spawn_events,
                    self.notifications,
                    true,
                );
            }
            SuitePanelKind::UiSurfaceStudio => {
                render_ui_surfaces_workspace_panel(
                    ui,
                    self.surfaces_hud,
                    self.surfaces,
                    self.docs,
                    self.locals,
                    self.widgets,
                    self.actions,
                );
            }
            SuitePanelKind::KeyValueTable => {
                render_key_value_panel(ui, &definition, self.key_value_panels);
            }
        }
    }

    fn is_closeable(&self, tab: &Self::Tab) -> bool {
        self.registry.get(tab).is_some_and(|definition| definition.closeable)
    }

    fn clear_background(&self, tab: &Self::Tab) -> bool {
        self.registry
            .get(tab)
            .is_none_or(|definition| definition.kind != SuitePanelKind::Viewport)
    }

    fn force_close(&mut self, tab: &mut Self::Tab) -> bool {
        self.registry.get(tab).is_none()
    }

    fn id(&mut self, tab: &mut Self::Tab) -> egui::Id {
        egui::Id::new(("kos_dock_tab", tab.as_str()))
    }
}

fn render_native_viewport_panel(ui: &mut egui::Ui) {
    let viewport_rect = ui.available_rect_before_wrap();
    ui.allocate_space(viewport_rect.size());

    let badge_rect = egui::Rect::from_min_size(
        viewport_rect.min + egui::vec2(12.0, 12.0),
        egui::vec2(216.0, 60.0),
    );
    ui.scope_builder(egui::UiBuilder::new().max_rect(badge_rect), |ui| {
        egui::Frame::new()
            .fill(egui::Color32::from_rgba_unmultiplied(10, 12, 18, 180))
            .stroke(egui::Stroke::new(
                1.0,
                egui::Color32::from_rgba_unmultiplied(70, 90, 120, 180),
            ))
            .corner_radius(egui::CornerRadius::same(8))
            .inner_margin(egui::Margin::same(10))
            .show(ui, |ui| {
                ui.label(
                    egui::RichText::new("Native Viewport")
                        .strong()
                        .color(egui::Color32::from_rgb(210, 220, 235)),
                );
                ui.label(
                    egui::RichText::new("Suite panels are now registered around the scene.")
                        .size(11.0)
                        .color(egui::Color32::from_rgb(150, 160, 175)),
                );
            });
    });
}

fn render_key_value_panel(
    ui: &mut egui::Ui,
    definition: &SuitePanelDefinition,
    store: &KeyValuePanelStore,
) {
    let Some(source_key) = definition.data_source_key.as_deref() else {
        ui.label("Panel has no data source.");
        return;
    };

    let Some(data) = store.get(source_key) else {
        ui.label("Panel data not available yet.");
        return;
    };

    if let Some(summary) = data.summary.as_ref() {
        ui.label(egui::RichText::new(summary).strong());
        ui.separator();
    }

    egui::ScrollArea::vertical().show(ui, |ui| {
        for row in data.rows.iter() {
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    egui::RichText::new(format!("{}:", row.label))
                        .color(egui::Color32::from_rgb(150, 160, 175)),
                );
                ui.label(row.value.as_str());
            });
        }
    });
}
