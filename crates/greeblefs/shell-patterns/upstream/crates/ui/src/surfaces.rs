use bevy::prelude::*;
use bevy_egui::{egui, EguiContexts, EguiPrimaryContextPass};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use crate::dock::DockWorkspaceState;

#[derive(Clone, Debug, Hash, PartialEq, Eq)]
pub struct UiSurfaceKey {
    pub app_key: String,
    pub surface_key: String,
}

impl UiSurfaceKey {
    pub fn new(app_key: impl Into<String>, surface_key: impl Into<String>) -> Self {
        Self {
            app_key: app_key.into(),
            surface_key: surface_key.into(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UiNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(default)]
    pub props: HashMap<String, Value>,
    #[serde(default)]
    pub children: Vec<UiNode>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UiDocV1 {
    pub version: u32,
    pub root: UiNode,
}

pub type UiDoc = UiDocV1;

#[derive(Clone)]
pub struct UiSurfaceInfo {
    pub key: UiSurfaceKey,
    pub title: String,
    pub fallback_doc: UiDoc,
}

#[derive(Resource, Default)]
pub struct UiSurfaceRegistry {
    surfaces: HashMap<UiSurfaceKey, UiSurfaceInfo>,
    cached: Vec<UiSurfaceInfo>,
    dirty: bool,
}

impl UiSurfaceRegistry {
    pub fn register(&mut self, info: UiSurfaceInfo) {
        self.surfaces.insert(info.key.clone(), info);
        self.dirty = true;
    }

    pub fn list(&mut self) -> &[UiSurfaceInfo] {
        if self.dirty {
            self.cached = self
                .surfaces
                .values()
                .cloned()
                .collect::<Vec<UiSurfaceInfo>>();
            self.cached.sort_by(|a, b| a.title.cmp(&b.title));
            self.dirty = false;
        }
        &self.cached
    }
}

#[derive(Resource, Default)]
pub struct UiDocStore {
    docs: HashMap<UiSurfaceKey, UiDoc>,
    load_attempted: HashSet<UiSurfaceKey>,
    pub last_error: Option<String>,
}

impl UiDocStore {
    pub fn get_or_load(&mut self, info: &UiSurfaceInfo) -> UiDoc {
        if let Some(doc) = self.docs.get(&info.key) {
            return doc.clone();
        }

        if !self.load_attempted.contains(&info.key) {
            self.load_attempted.insert(info.key.clone());

            match load_doc_override(&info.key) {
                Ok(Some(doc)) => {
                    if let Err(err) = validate_doc(&doc) {
                        self.last_error = Some(err);
                    } else {
                        self.docs.insert(info.key.clone(), doc.clone());
                        return doc;
                    }
                }
                Ok(None) => {}
                Err(e) => {
                    self.last_error = Some(e);
                }
            }
        }

        info.fallback_doc.clone()
    }

    pub fn set_override(&mut self, key: UiSurfaceKey, doc: UiDoc) {
        self.docs.insert(key.clone(), doc);
        self.load_attempted.insert(key);
    }
}

#[derive(Event, Clone, Debug)]
pub struct UiSurfaceAction {
    pub app_key: String,
    pub surface_key: String,
    pub node_id: String,
    pub action: String,
    pub payload: Value,
}

impl bevy::prelude::Message for UiSurfaceAction {}

pub struct UiRenderCtx<'a, 'w> {
    pub key: &'a UiSurfaceKey,
    pub registry: &'a UiWidgetRegistry,
    pub locals: &'a mut UiLocalState,
    pub actions: &'a mut MessageWriter<'w, UiSurfaceAction>,
}

impl<'a, 'w> UiRenderCtx<'a, 'w> {
    pub fn render_node(&mut self, ui: &mut egui::Ui, node: &UiNode) {
        if let Some(def) = self.registry.get(&node.node_type) {
            (def.render)(ui, node, self);
        } else {
            ui.colored_label(
                egui::Color32::from_rgb(255, 80, 80),
                format!("Unknown widget type: {}", node.node_type),
            );
        }
    }

    pub fn render_children(&mut self, ui: &mut egui::Ui, children: &[UiNode]) {
        for child in children {
            self.render_node(ui, child);
        }
    }

    pub fn emit_action(&mut self, node: &UiNode, action: impl Into<String>, payload: Value) {
        self.actions.write(UiSurfaceAction {
            app_key: self.key.app_key.clone(),
            surface_key: self.key.surface_key.clone(),
            node_id: node.id.clone(),
            action: action.into(),
            payload,
        });
    }
}

pub type UiWidgetRenderFn = for<'a, 'w> fn(&mut egui::Ui, &UiNode, &mut UiRenderCtx<'a, 'w>);

pub struct UiWidgetDefinition {
    pub title: &'static str,
    pub can_have_children: bool,
    pub render: UiWidgetRenderFn,
}

#[derive(Resource, Default)]
pub struct UiWidgetRegistry {
    map: HashMap<String, UiWidgetDefinition>,
}

impl UiWidgetRegistry {
    pub fn register(&mut self, type_name: impl Into<String>, def: UiWidgetDefinition) {
        self.map.insert(type_name.into(), def);
    }

    pub fn get(&self, type_name: &str) -> Option<&UiWidgetDefinition> {
        self.map.get(type_name)
    }

    pub fn list(&self) -> Vec<(&str, &UiWidgetDefinition)> {
        let mut items = self
            .map
            .iter()
            .map(|(k, v)| (k.as_str(), v))
            .collect::<Vec<_>>();
        items.sort_by(|a, b| a.1.title.cmp(b.1.title));
        items
    }
}

#[derive(Resource, Default)]
pub struct UiLocalState {
    values: HashMap<String, Value>,
}

impl UiLocalState {
    pub fn get(&self, node_id: &str) -> Option<&Value> {
        self.values.get(node_id)
    }

    pub fn set(&mut self, node_id: impl Into<String>, value: Value) {
        self.values.insert(node_id.into(), value);
    }
}

#[derive(Resource)]
pub struct UiSurfacesHudState {
    pub open: bool,
    pub active: Option<UiSurfaceKey>,
}

impl Default for UiSurfacesHudState {
    fn default() -> Self {
        Self {
            open: false,
            active: None,
        }
    }
}

pub struct UiSurfacesPlugin;

impl Plugin for UiSurfacesPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<UiSurfaceRegistry>()
            .init_resource::<UiWidgetRegistry>()
            .init_resource::<UiDocStore>()
            .init_resource::<UiLocalState>()
            .init_resource::<UiSurfacesHudState>()
            .add_message::<UiSurfaceAction>()
            .add_systems(Startup, ui_surfaces_bootstrap)
            .add_systems(Update, ui_surfaces_toggle_hud)
            .add_systems(EguiPrimaryContextPass, ui_surfaces_hud_system);
    }
}

fn ui_surfaces_bootstrap(
    mut registry: ResMut<UiSurfaceRegistry>,
    mut widgets: ResMut<UiWidgetRegistry>,
) {
    register_default_widgets(&mut widgets);

    let doc = UiDoc {
        version: 1,
        root: UiNode {
            id: "root".to_string(),
            node_type: "window".to_string(),
            props: HashMap::from([
                (
                    "title".to_string(),
                    Value::String("UI Surfaces (Runtime)".to_string()),
                ),
                (
                    "hint".to_string(),
                    Value::String("This window is rendered from a JSON surface doc.".to_string()),
                ),
            ]),
            children: vec![
                UiNode {
                    id: "row".to_string(),
                    node_type: "hbox".to_string(),
                    props: HashMap::new(),
                    children: vec![
                        UiNode {
                            id: "hello".to_string(),
                            node_type: "label".to_string(),
                            props: HashMap::from([(
                                "text".to_string(),
                                Value::String("Hello from a surface doc".to_string()),
                            )]),
                            children: vec![],
                        },
                        UiNode {
                            id: "spacer".to_string(),
                            node_type: "spacer".to_string(),
                            props: HashMap::from([(
                                "width".to_string(),
                                Value::Number(serde_json::Number::from(8)),
                            )]),
                            children: vec![],
                        },
                        UiNode {
                            id: "btn".to_string(),
                            node_type: "button".to_string(),
                            props: HashMap::from([
                                ("text".to_string(), Value::String("Ping".to_string())),
                                ("action".to_string(), Value::String("ping".to_string())),
                            ]),
                            children: vec![],
                        },
                    ],
                },
                UiNode {
                    id: "sep".to_string(),
                    node_type: "separator".to_string(),
                    props: HashMap::new(),
                    children: vec![],
                },
                UiNode {
                    id: "slider".to_string(),
                    node_type: "slider_f32".to_string(),
                    props: HashMap::from([
                        ("label".to_string(), Value::String("Value".to_string())),
                        ("min".to_string(), Value::Number(0.into())),
                        ("max".to_string(), Value::Number(1.into())),
                        (
                            "default".to_string(),
                            Value::Number(serde_json::Number::from_f64(0.5).unwrap()),
                        ),
                        ("action".to_string(), Value::String("set_value".to_string())),
                    ]),
                    children: vec![],
                },
            ],
        },
    };

    registry.register(UiSurfaceInfo {
        key: UiSurfaceKey::new("bevy", "runtime_demo"),
        title: "Runtime Demo".to_string(),
        fallback_doc: doc,
    });
}

fn ui_surfaces_toggle_hud(
    mut hud: ResMut<UiSurfacesHudState>,
    keyboard: Res<ButtonInput<KeyCode>>,
) {
    if keyboard.just_pressed(KeyCode::F10) {
        hud.open = !hud.open;
    }
}

fn ui_surfaces_hud_system(
    mut contexts: EguiContexts,
    mut hud: ResMut<UiSurfacesHudState>,
    mut surfaces: ResMut<UiSurfaceRegistry>,
    mut docs: ResMut<UiDocStore>,
    mut locals: ResMut<UiLocalState>,
    widgets: Res<UiWidgetRegistry>,
    mut actions: MessageWriter<UiSurfaceAction>,
    workspace: Option<Res<DockWorkspaceState>>,
) {
    if !hud.open {
        return;
    }

    if workspace.as_deref().is_some_and(|workspace| workspace.open) {
        return;
    }

    let Ok(ctx) = contexts.ctx_mut() else {
        return;
    };

    egui::Window::new("UI Studio (Bevy Runtime)")
        .default_open(true)
        .resizable(true)
        .show(ctx, |ui| {
            render_ui_surfaces_workspace_panel(
                ui,
                &mut hud,
                &mut surfaces,
                &mut docs,
                &mut locals,
                &widgets,
                &mut actions,
            );
        });
}

pub fn render_ui_surfaces_workspace_panel(
    ui: &mut egui::Ui,
    hud: &mut UiSurfacesHudState,
    surfaces: &mut UiSurfaceRegistry,
    docs: &mut UiDocStore,
    locals: &mut UiLocalState,
    widgets: &UiWidgetRegistry,
    actions: &mut MessageWriter<UiSurfaceAction>,
) {
    let list = surfaces.list();

    if hud.active.is_none() {
        hud.active = list.first().map(|s| s.key.clone());
    }

    ui.horizontal(|ui| {
        ui.label("surface:");

        let mut current = hud
            .active
            .as_ref()
            .map(|k| k.surface_key.clone())
            .unwrap_or_default();

        egui::ComboBox::from_id_salt("ui_surface_picker")
            .selected_text(current.clone())
            .show_ui(ui, |ui| {
                for s in list.iter() {
                    ui.selectable_value(&mut current, s.key.surface_key.clone(), s.title.clone());
                }
            });

        hud.active = list
            .iter()
            .find(|s| s.key.surface_key == current)
            .map(|s| s.key.clone());

        if ui.button("Reload Override").clicked() {
            if let Some(active) = hud.active.clone() {
                docs.docs.remove(&active);
                docs.load_attempted.remove(&active);
                docs.last_error = None;
            }
        }
    });

    if let Some(err) = docs.last_error.as_ref() {
        ui.colored_label(egui::Color32::from_rgb(255, 120, 80), err);
    }

    ui.separator();

    let active_key = hud
        .active
        .clone()
        .or_else(|| list.first().map(|s| s.key.clone()));
    let Some(active_key) = active_key else {
        ui.label("No surfaces registered.");
        return;
    };

    let Some(info) = list.iter().find(|s| s.key == active_key) else {
        ui.label("Active surface missing.");
        return;
    };

    let doc = docs.get_or_load(info);

    egui::Frame::NONE
        .fill(egui::Color32::from_rgb(14, 14, 18))
        .stroke(egui::Stroke::new(1.0, egui::Color32::from_rgb(28, 28, 35)))
        .corner_radius(egui::CornerRadius::same(8))
        .inner_margin(egui::Margin::same(10))
        .show(ui, |ui| {
            let mut rctx = UiRenderCtx {
                key: &info.key,
                registry: widgets,
                locals,
                actions,
            };
            rctx.render_node(ui, &doc.root);
        });
}

fn validate_doc(doc: &UiDoc) -> std::result::Result<(), String> {
    if doc.version != 1 {
        return Err(format!("Unsupported UiDoc version: {}", doc.version));
    }

    let mut ids = HashSet::<String>::new();
    let mut count = 0usize;

    fn walk(
        node: &UiNode,
        ids: &mut HashSet<String>,
        count: &mut usize,
        depth: usize,
    ) -> std::result::Result<(), String> {
        if depth > 128 {
            return Err("UiDoc too deep".to_string());
        }

        *count += 1;
        if *count > 50_000 {
            return Err("UiDoc too large".to_string());
        }

        if node.id.trim().is_empty() {
            return Err("UiNode missing id".to_string());
        }

        if !ids.insert(node.id.clone()) {
            return Err(format!("Duplicate UiNode id: {}", node.id));
        }

        for c in node.children.iter() {
            walk(c, ids, count, depth + 1)?;
        }

        Ok(())
    }

    walk(&doc.root, &mut ids, &mut count, 0)?;
    Ok(())
}

fn sanitize(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        "surface".to_string()
    } else {
        out
    }
}

fn override_path(key: &UiSurfaceKey) -> PathBuf {
    let app = sanitize(&key.app_key);
    let surface = sanitize(&key.surface_key);

    std::env::temp_dir()
        .join("kos-ui-doc")
        .join(app)
        .join(format!("{surface}.json"))
}

fn load_doc_override(key: &UiSurfaceKey) -> std::result::Result<Option<UiDoc>, String> {
    let path = override_path(key);
    if !path.exists() {
        return Ok(None);
    }

    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed reading UiDoc override {:?}: {e}", path))?;
    let doc: UiDoc =
        serde_json::from_str(&raw).map_err(|e| format!("Invalid UiDoc JSON {:?}: {e}", path))?;
    Ok(Some(doc))
}

fn get_prop_string(node: &UiNode, key: &str) -> Option<String> {
    node.props
        .get(key)
        .and_then(|v| v.as_str().map(|s| s.to_string()))
}

fn get_prop_f32(node: &UiNode, key: &str) -> Option<f32> {
    node.props
        .get(key)
        .and_then(|v| v.as_f64())
        .map(|v| v as f32)
}

fn get_prop_bool(node: &UiNode, key: &str) -> Option<bool> {
    node.props.get(key).and_then(|v| v.as_bool())
}

fn register_default_widgets(registry: &mut UiWidgetRegistry) {
    registry.register(
        "window",
        UiWidgetDefinition {
            title: "Window",
            can_have_children: true,
            render: |ui, node, ctx| {
                let title = get_prop_string(node, "title").unwrap_or_else(|| "Window".to_string());
                let hint = get_prop_string(node, "hint");

                egui::Window::new(title)
                    .resizable(true)
                    .show(ui.ctx(), |ui| {
                        if let Some(hint) = hint {
                            ui.label(egui::RichText::new(hint).weak());
                            ui.separator();
                        }
                        ctx.render_children(ui, &node.children);
                    });
            },
        },
    );

    registry.register(
        "hbox",
        UiWidgetDefinition {
            title: "HBox",
            can_have_children: true,
            render: |ui, node, ctx| {
                ui.horizontal(|ui| {
                    ctx.render_children(ui, &node.children);
                });
            },
        },
    );

    registry.register(
        "vbox",
        UiWidgetDefinition {
            title: "VBox",
            can_have_children: true,
            render: |ui, node, ctx| {
                ui.vertical(|ui| {
                    ctx.render_children(ui, &node.children);
                });
            },
        },
    );

    registry.register(
        "label",
        UiWidgetDefinition {
            title: "Label",
            can_have_children: false,
            render: |ui, node, _ctx| {
                let text = get_prop_string(node, "text").unwrap_or_default();
                ui.label(text);
            },
        },
    );

    registry.register(
        "separator",
        UiWidgetDefinition {
            title: "Separator",
            can_have_children: false,
            render: |ui, _node, _ctx| {
                ui.separator();
            },
        },
    );

    registry.register(
        "spacer",
        UiWidgetDefinition {
            title: "Spacer",
            can_have_children: false,
            render: |ui, node, _ctx| {
                let w = get_prop_f32(node, "width").unwrap_or(8.0);
                ui.add_space(w);
            },
        },
    );

    registry.register(
        "button",
        UiWidgetDefinition {
            title: "Button",
            can_have_children: false,
            render: |ui, node, ctx| {
                let text = get_prop_string(node, "text").unwrap_or_else(|| "Button".to_string());
                let action = get_prop_string(node, "action").unwrap_or_else(|| "click".to_string());

                if ui.button(text).clicked() {
                    ctx.emit_action(node, action, Value::Null);
                }
            },
        },
    );

    registry.register(
        "checkbox",
        UiWidgetDefinition {
            title: "Checkbox",
            can_have_children: false,
            render: |ui, node, ctx| {
                let label = get_prop_string(node, "label").unwrap_or_else(|| "".to_string());
                let action =
                    get_prop_string(node, "action").unwrap_or_else(|| "set_bool".to_string());

                let mut value = ctx
                    .locals
                    .get(&node.id)
                    .and_then(|v| v.as_bool())
                    .or_else(|| get_prop_bool(node, "default"))
                    .unwrap_or(false);

                if ui.checkbox(&mut value, label).changed() {
                    ctx.locals.set(node.id.clone(), Value::Bool(value));
                    ctx.emit_action(node, action, Value::Bool(value));
                }
            },
        },
    );

    registry.register(
        "slider_f32",
        UiWidgetDefinition {
            title: "Slider (f32)",
            can_have_children: false,
            render: |ui, node, ctx| {
                let label = get_prop_string(node, "label").unwrap_or_else(|| "".to_string());
                let action =
                    get_prop_string(node, "action").unwrap_or_else(|| "set_f32".to_string());

                let min = get_prop_f32(node, "min").unwrap_or(0.0);
                let max = get_prop_f32(node, "max").unwrap_or(1.0);

                let mut value = ctx
                    .locals
                    .get(&node.id)
                    .and_then(|v| v.as_f64())
                    .map(|v| v as f32)
                    .or_else(|| get_prop_f32(node, "default"))
                    .unwrap_or(0.0);

                let resp = ui.add(egui::Slider::new(&mut value, min..=max).text(label));
                if resp.changed() {
                    ctx.locals.set(
                        node.id.clone(),
                        Value::Number(serde_json::Number::from_f64(value as f64).unwrap()),
                    );
                    ctx.emit_action(
                        node,
                        action,
                        Value::Number(serde_json::Number::from_f64(value as f64).unwrap()),
                    );
                }
            },
        },
    );
}
