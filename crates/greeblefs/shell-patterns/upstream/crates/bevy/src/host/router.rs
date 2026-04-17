use bevy::ecs::system::SystemParam;
use bevy::prelude::*;
use bevy::window::{PrimaryWindow, WindowPosition};
use bevy_panorbit_camera::PanOrbitCamera;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::time::Duration;

use super::engine::{HostEngineCatalog, HostEngineDockTarget, HostEngineState};
use crate::editor_ui::SetRuntimeDiagnosticsEnabledEvent;
use crate::tools::{
    focus_paint_surface, resolve_paint_center_uv, BrushSettings, BrushStrokeEvent,
    CursorMovedEvent, MainCamera, PaintClearEvent, PaintClearPayload, PaintStrokeEvent,
    PaintStrokePayload, PaintToolState, RedoEvent, RemeshEvent, SculptCursorState, SculptUiState,
    SnapshotEvent, SubdivideEvent, SwitchBrushEvent, UndoEvent,
};
use crate::viewport::materials::{
    get_material_by_kernel_id, get_material_by_name, AssignMaterialToEntityEvent,
    CreateMaterialEvent, DisplayMode, GlobalDisplayMode, MaterialLibrary, SetDisplayModeEvent,
};
use crate::viewport::selection::{
    DeleteSelectedEvent, DuplicateSelectedEvent, FocusSelectionEvent, GizmoMode, SetGizmoModeEvent,
};
use crate::viewport::{
    ActiveTool, ImportGltfEvent, LayerInfo, PrimitiveType, SelectObjectEvent, SelectionState,
    SpawnPrimitiveEvent, ToggleLockEvent, ToggleVisibilityEvent,
};
use k_os_ui::{
    DockWorkspaceState, DockWorkspaceTab, EditorNotificationEvent, EditorNotificationLevel,
    UiSurfacesHudState, PANEL_CONTENT_BROWSER, PANEL_RUNTIME_DIAGNOSTICS, PANEL_UI_SURFACES,
    PANEL_VIEWPORT,
};

pub struct HostRoutePlugin;

impl Plugin for HostRoutePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<HostRouteCatalog>()
            .init_resource::<HostViewportRouteState>()
            .add_message::<HostRouteRequest>()
            .add_message::<HostRouteResponse>()
            .add_message::<HostWindowCommandEvent>()
            .add_message::<HostOrbitCameraEvent>()
            .add_message::<HostZoomCameraEvent>()
            .add_message::<HostEntityTransformCommandEvent>()
            .add_systems(PreUpdate, route_host_requests)
            .add_systems(
                PreUpdate,
                (
                    apply_host_window_commands,
                    apply_host_orbit_camera_commands,
                    apply_host_zoom_camera_commands,
                    apply_host_entity_transform_commands,
                )
                    .after(route_host_requests),
            )
            .add_systems(Update, log_host_route_failures);
    }
}

#[derive(Resource, Clone, Debug)]
pub struct HostRouteCatalog {
    routes: BTreeMap<String, HostRouteCatalogEntry>,
    legacy_aliases: BTreeMap<String, String>,
}

impl Default for HostRouteCatalog {
    fn default() -> Self {
        let mut routes = BTreeMap::new();
        let mut legacy_aliases = BTreeMap::new();

        register_route(
            &mut routes,
            &mut legacy_aliases,
            "host.viewport.sync",
            "Resize and reposition the Bevy host window to match the unified viewport surface.",
            &["sync_bevy_window"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "host.window.visibility",
            "Toggle host window visibility.",
            &["set_bevy_visible"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "host.ui.egui_only",
            "Toggle host UI-only mode for viewport mirroring workflows.",
            &["leash_egui_only"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "host.ui.debug",
            "Toggle the Bevy runtime diagnostics overlay.",
            &["leash_debug_ui"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "host.dock.focus_tab",
            "Focus a dock tab in the shared editor shell.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "host.notification.push",
            "Push a toast notification through the shared editor notification lane.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "engine.domain.activate",
            "Activate an editor engine domain mirrored from the legacy reference app families.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.camera.rotate_orbit",
            "Rotate the unified viewport camera through PanOrbitCamera.",
            &["leash_cam_rotate"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.camera.zoom",
            "Zoom the unified viewport camera through PanOrbitCamera.",
            &["leash_cam_zoom"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.cursor.move",
            "Forward a viewport cursor update into the Bevy sculpt/input surface.",
            &["leash_cursor"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.sculpt.stroke",
            "Forward a sculpt stroke request into the Bevy sculpt toolchain.",
            &["leash_brush"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.paint.stroke",
            "Forward a PBR paint stroke request into the Bevy paint toolchain.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.paint.clear",
            "Clear a PBR paint channel or the full paint session.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.sculpt.snapshot",
            "Capture a sculpt snapshot.",
            &["leash_snapshot"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.sculpt.undo",
            "Undo the latest sculpt action.",
            &["leash_undo"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.sculpt.redo",
            "Redo the latest sculpt action.",
            &["leash_redo"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.material.wireframe.set",
            "Set global wireframe overlay state for the unified viewport.",
            &["leash_wireframe"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.sculpt.symmetry.set",
            "Set sculpt symmetry state stored by the Bevy sculpt UI resource.",
            &["leash_symmetry"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.import.primitive",
            "Spawn a primitive in the unified viewport.",
            &["leash_load_primitive"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.import.gltf",
            "Import a glTF or glb asset into the unified viewport.",
            &["leash_load_model"],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.tool.set_active",
            "Switch the active unified viewport tool mode.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.selection.select",
            "Select an object by stable layer id.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.selection.transform",
            "Transform a selected or targeted object in the unified viewport.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.selection.delete",
            "Delete the current selection.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.selection.duplicate",
            "Duplicate the current selection.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.selection.focus",
            "Frame the active selection in the unified viewport camera.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.gizmo.mode.set",
            "Set the viewport transform gizmo mode.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.layer.visibility.toggle",
            "Toggle object visibility by stable layer id.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.layer.lock.toggle",
            "Toggle object lock state by stable layer id.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.material.create",
            "Create a viewport material entry in the Bevy material library.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.material.assign",
            "Assign a named or kernel-backed material to a targeted object.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.material.display_mode.set",
            "Set the global viewport display mode and optional wireframe overlay.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.sculpt.subdivide",
            "Subdivide the active sculpt mesh.",
            &[],
        );
        register_route(
            &mut routes,
            &mut legacy_aliases,
            "viewport.sculpt.remesh",
            "Remesh the active sculpt mesh.",
            &[],
        );

        Self {
            routes,
            legacy_aliases,
        }
    }
}

impl HostRouteCatalog {
    pub fn resolve_entry(&self, route_key: &str) -> Option<&HostRouteCatalogEntry> {
        if let Some(entry) = self.routes.get(route_key) {
            return Some(entry);
        }

        self.legacy_aliases
            .get(route_key)
            .and_then(|canonical_key| self.routes.get(canonical_key))
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct HostRouteCatalogEntry {
    pub canonical_key: String,
    pub description: String,
    pub legacy_aliases: Vec<String>,
}

#[derive(Resource, Clone, Debug)]
pub struct HostViewportRouteState {
    pub window_bounds: Option<HostViewportWindowBounds>,
    pub window_visible: bool,
    pub egui_only: bool,
    pub diagnostics_enabled: bool,
    pub last_route_key: Option<String>,
    pub last_error: Option<String>,
}

impl Default for HostViewportRouteState {
    fn default() -> Self {
        Self {
            window_bounds: None,
            window_visible: true,
            egui_only: false,
            diagnostics_enabled: true,
            last_route_key: None,
            last_error: None,
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct HostViewportWindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub enum HostRouteSource {
    #[default]
    Internal,
    LegacyViewportHost,
    ExternalTool,
}

#[derive(Event, Clone, Debug, Serialize, Deserialize)]
pub struct HostRouteRequest {
    pub route_key: String,
    #[serde(default)]
    pub payload: Value,
    #[serde(default)]
    pub correlation_id: Option<String>,
    #[serde(default)]
    pub source: HostRouteSource,
}
impl Message for HostRouteRequest {}

#[derive(Event, Clone, Debug, Serialize)]
pub struct HostRouteResponse {
    pub requested_route_key: String,
    pub canonical_route_key: Option<String>,
    pub correlation_id: Option<String>,
    pub success: bool,
    pub detail: String,
}
impl Message for HostRouteResponse {}

#[derive(Event, Clone, Copy, Debug)]
enum HostWindowCommandEvent {
    SyncBounds(HostViewportWindowBounds),
    SetVisibility(bool),
}
impl Message for HostWindowCommandEvent {}

#[derive(Event, Clone, Copy, Debug)]
struct HostOrbitCameraEvent {
    yaw_delta: f32,
    pitch_delta: f32,
}
impl Message for HostOrbitCameraEvent {}

#[derive(Event, Clone, Copy, Debug)]
struct HostZoomCameraEvent {
    radius_delta: f32,
}
impl Message for HostZoomCameraEvent {}

#[derive(Debug, Deserialize)]
struct VisibilityPayload {
    visible: bool,
}

#[derive(Debug, Deserialize)]
struct EnabledPayload {
    enabled: bool,
}

#[derive(Debug, Deserialize)]
struct WindowSyncPayload {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Debug, Deserialize)]
struct CameraRotatePayload {
    dx: f32,
    dy: f32,
    #[serde(default = "default_camera_rotate_sensitivity")]
    sensitivity: f32,
}

#[derive(Debug, Deserialize)]
struct CameraZoomPayload {
    delta: f32,
    #[serde(default = "default_camera_zoom_scale")]
    zoom_scale: f32,
}

#[derive(Debug, Deserialize)]
struct CursorPayload {
    x: f32,
    y: f32,
}

#[derive(Debug, Deserialize)]
struct BrushStrokePayload {
    #[serde(default)]
    tool: Option<u8>,
    #[serde(default)]
    kernel: Option<String>,
    #[serde(default)]
    brush_id: Option<String>,
    #[serde(default)]
    radius: Option<f32>,
    #[serde(default)]
    intensity: Option<f32>,
    x: f32,
    y: f32,
    #[serde(default)]
    dx: Option<f32>,
    #[serde(default)]
    dy: Option<f32>,
}

#[derive(Debug, Deserialize)]
struct SymmetryPayload {
    #[serde(default)]
    axis: Option<u8>,
    #[serde(default)]
    axis_name: Option<String>,
    #[serde(default)]
    enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct ImportGltfPayload {
    path: String,
    #[serde(default)]
    position: Option<[f32; 3]>,
}

#[derive(Debug, Deserialize)]
struct PrimitiveImportPayload {
    primitive_type: Value,
    #[serde(default)]
    position: Option<[f32; 3]>,
    #[serde(default = "default_primitive_size")]
    size: f32,
}

#[derive(Debug, Deserialize)]
struct ActiveToolPayload {
    tool: String,
}

#[derive(Debug, Deserialize)]
struct LayerEntityPayload {
    layer_id: u64,
}

#[derive(Debug, Deserialize)]
struct SelectionPayload {
    layer_id: u64,
    #[serde(default)]
    add_to_selection: bool,
}

#[derive(Debug, Deserialize, Default)]
struct RemeshPayload {
    #[serde(default = "default_remesh_resolution")]
    resolution: u32,
}

#[derive(Debug, Deserialize)]
struct DockFocusPayload {
    tab_key: String,
}

#[derive(Debug, Deserialize)]
struct NotificationPayload {
    message: String,
    #[serde(default)]
    level: Option<String>,
    #[serde(default)]
    duration_secs: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct EngineDomainActivatePayload {
    domain_key: String,
    #[serde(default)]
    tool_key: Option<String>,
    #[serde(default)]
    focus_preferred_tab: Option<bool>,
    #[serde(default)]
    notify: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct SelectionTransformPayload {
    #[serde(default)]
    layer_id: Option<u64>,
    #[serde(default)]
    use_active_selection: bool,
    #[serde(default)]
    translation: Option<[f32; 3]>,
    #[serde(default)]
    rotation_degrees: Option<[f32; 3]>,
    #[serde(default)]
    scale: Option<[f32; 3]>,
    #[serde(default)]
    absolute: bool,
}

#[derive(Debug, Deserialize)]
struct GizmoModePayload {
    mode: String,
}

#[derive(Debug, Deserialize)]
struct MaterialCreatePayload {
    name: String,
    base_color: [f32; 4],
    #[serde(default = "default_material_roughness")]
    roughness: f32,
    #[serde(default)]
    metallic: f32,
}

#[derive(Debug, Deserialize)]
struct MaterialAssignPayload {
    #[serde(default)]
    layer_id: Option<u64>,
    #[serde(default)]
    use_active_selection: bool,
    #[serde(default)]
    material_name: Option<String>,
    #[serde(default)]
    material_kernel_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DisplayModePayload {
    mode: String,
    #[serde(default)]
    wireframe: Option<bool>,
}

#[derive(Event, Clone, Copy, Debug)]
struct HostEntityTransformCommandEvent {
    entity: Entity,
    translation: Option<Vec3>,
    rotation: Option<Quat>,
    scale: Option<Vec3>,
    absolute: bool,
}
impl Message for HostEntityTransformCommandEvent {}

#[derive(SystemParam)]
struct HostRouteDispatchMessages<'w> {
    responses: MessageWriter<'w, HostRouteResponse>,
    window_events: MessageWriter<'w, HostWindowCommandEvent>,
    diagnostics_events: MessageWriter<'w, SetRuntimeDiagnosticsEnabledEvent>,
    orbit_camera_events: MessageWriter<'w, HostOrbitCameraEvent>,
    zoom_camera_events: MessageWriter<'w, HostZoomCameraEvent>,
    cursor_events: MessageWriter<'w, CursorMovedEvent>,
    brush_events: MessageWriter<'w, BrushStrokeEvent>,
    paint_stroke_events: MessageWriter<'w, PaintStrokeEvent>,
    paint_clear_events: MessageWriter<'w, PaintClearEvent>,
    undo_events: MessageWriter<'w, UndoEvent>,
    redo_events: MessageWriter<'w, RedoEvent>,
    snapshot_events: MessageWriter<'w, SnapshotEvent>,
    subdivide_events: MessageWriter<'w, SubdivideEvent>,
    remesh_events: MessageWriter<'w, RemeshEvent>,
    switch_brush_events: MessageWriter<'w, SwitchBrushEvent>,
    import_gltf_events: MessageWriter<'w, ImportGltfEvent>,
    spawn_primitive_events: MessageWriter<'w, SpawnPrimitiveEvent>,
    select_object_events: MessageWriter<'w, SelectObjectEvent>,
    toggle_visibility_events: MessageWriter<'w, ToggleVisibilityEvent>,
    toggle_lock_events: MessageWriter<'w, ToggleLockEvent>,
    create_material_events: MessageWriter<'w, CreateMaterialEvent>,
    assign_material_events: MessageWriter<'w, AssignMaterialToEntityEvent>,
    display_mode_events: MessageWriter<'w, SetDisplayModeEvent>,
    set_gizmo_mode_events: MessageWriter<'w, SetGizmoModeEvent>,
    focus_selection_events: MessageWriter<'w, FocusSelectionEvent>,
    delete_selected_events: MessageWriter<'w, DeleteSelectedEvent>,
    duplicate_selected_events: MessageWriter<'w, DuplicateSelectedEvent>,
    notification_events: MessageWriter<'w, EditorNotificationEvent>,
    entity_transform_events: MessageWriter<'w, HostEntityTransformCommandEvent>,
}

#[derive(SystemParam)]
struct HostRouteMutableState<'w> {
    route_state: ResMut<'w, HostViewportRouteState>,
    active_tool: ResMut<'w, ActiveTool>,
    brush_settings: ResMut<'w, BrushSettings>,
    paint_tool_state: ResMut<'w, PaintToolState>,
    sculpt_ui_state: ResMut<'w, SculptUiState>,
    global_display_mode: ResMut<'w, GlobalDisplayMode>,
    dock_workspace: ResMut<'w, DockWorkspaceState>,
    ui_surfaces_hud: ResMut<'w, UiSurfacesHudState>,
    engine_state: ResMut<'w, HostEngineState>,
}

fn route_host_requests(
    mut requests: MessageReader<HostRouteRequest>,
    catalog: Res<HostRouteCatalog>,
    engine_catalog: Res<HostEngineCatalog>,
    material_library: Res<MaterialLibrary>,
    selection_state: Res<SelectionState>,
    cursor_state: Res<SculptCursorState>,
    mut dispatch: HostRouteDispatchMessages,
    mut mutable_state: HostRouteMutableState,
    layer_query: Query<(Entity, &LayerInfo)>,
) {
    for request in requests.read() {
        mutable_state.route_state.last_route_key = Some(request.route_key.clone());
        mutable_state.route_state.last_error = None;

        let Some(catalog_entry) = catalog.resolve_entry(&request.route_key) else {
            let detail = format!("Unknown host route key: {}", request.route_key);
            mutable_state.route_state.last_error = Some(detail.clone());
            dispatch.responses.write(HostRouteResponse {
                requested_route_key: request.route_key.clone(),
                canonical_route_key: None,
                correlation_id: request.correlation_id.clone(),
                success: false,
                detail,
            });
            continue;
        };

        let canonical_key = catalog_entry.canonical_key.clone();
        let route_result = (|| -> Result<String, String> {
            match canonical_key.as_str() {
                "host.viewport.sync" => {
                    let payload: WindowSyncPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let bounds = HostViewportWindowBounds {
                        x: payload.x,
                        y: payload.y,
                        width: payload.width,
                        height: payload.height,
                    };
                    mutable_state.route_state.window_bounds = Some(bounds);
                    dispatch
                        .window_events
                        .write(HostWindowCommandEvent::SyncBounds(bounds));
                    Ok("Viewport sync command accepted".to_string())
                }
                "host.window.visibility" => {
                    let payload: VisibilityPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    mutable_state.route_state.window_visible = payload.visible;
                    dispatch
                        .window_events
                        .write(HostWindowCommandEvent::SetVisibility(payload.visible));
                    Ok(format!("Host window visibility set to {}", payload.visible))
                }
                "host.ui.egui_only" => {
                    let payload: EnabledPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    mutable_state.route_state.egui_only = payload.enabled;
                    Ok(format!(
                        "Host egui-only state recorded as {}",
                        mutable_state.route_state.egui_only
                    ))
                }
                "host.ui.debug" => {
                    let payload: EnabledPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    mutable_state.route_state.diagnostics_enabled = payload.enabled;
                    dispatch
                        .diagnostics_events
                        .write(SetRuntimeDiagnosticsEnabledEvent(payload.enabled));
                    Ok(format!(
                        "Runtime diagnostics overlay set to {}",
                        payload.enabled
                    ))
                }
                "host.dock.focus_tab" => {
                    let payload: DockFocusPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let dock_tab = parse_dock_tab(&payload.tab_key)?;
                    mutable_state.dock_workspace.focus_tab(dock_tab);
                    Ok(format!("Dock tab focused: {}", payload.tab_key))
                }
                "host.notification.push" => {
                    let payload: NotificationPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    dispatch.notification_events.write(EditorNotificationEvent {
                        level: parse_notification_level(payload.level.as_deref())?,
                        message: payload.message.clone(),
                        duration: Duration::from_secs(payload.duration_secs.unwrap_or(4)),
                    });
                    Ok("Notification queued".to_string())
                }
                "engine.domain.activate" => {
                    let payload: EngineDomainActivatePayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let domain = engine_catalog
                        .resolve_domain(&payload.domain_key)
                        .ok_or_else(|| format!("Unknown engine domain {}", payload.domain_key))?;

                    mutable_state.engine_state.active_domain_key = domain.domain_key.clone();
                    mutable_state.engine_state.active_tool_key = payload
                        .tool_key
                        .clone()
                        .or_else(|| domain.tool_keys.first().cloned());

                    if let Some(tool_key) = mutable_state.engine_state.active_tool_key.as_deref() {
                        if let Ok(tool) = parse_active_tool(tool_key) {
                            *mutable_state.active_tool = tool;
                            if tool == ActiveTool::Paint {
                                focus_paint_surface(
                                    &mut mutable_state.dock_workspace,
                                    &mut mutable_state.ui_surfaces_hud,
                                );
                            }
                        }
                    }

                    if payload.focus_preferred_tab.unwrap_or(true) {
                        mutable_state
                            .dock_workspace
                            .focus_tab(dock_tab_from_engine_target(domain.preferred_dock_target));
                    }

                    if payload.notify.unwrap_or(true) {
                        dispatch
                            .notification_events
                            .write(EditorNotificationEvent::info(format!(
                                "Engine domain active: {}",
                                domain.title
                            )));
                    }

                    Ok(format!(
                        "Engine domain active: {} ({:?})",
                        domain.title, domain.status
                    ))
                }
                "viewport.camera.rotate_orbit" => {
                    let payload: CameraRotatePayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    dispatch.orbit_camera_events.write(HostOrbitCameraEvent {
                        yaw_delta: -payload.dx * payload.sensitivity,
                        pitch_delta: -payload.dy * payload.sensitivity,
                    });
                    Ok("Orbit camera rotation command accepted".to_string())
                }
                "viewport.camera.zoom" => {
                    let payload: CameraZoomPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    dispatch.zoom_camera_events.write(HostZoomCameraEvent {
                        radius_delta: payload.delta * payload.zoom_scale,
                    });
                    Ok("Orbit camera zoom command accepted".to_string())
                }
                "viewport.cursor.move" => {
                    let payload: CursorPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    dispatch
                        .cursor_events
                        .write(CursorMovedEvent(Vec2::new(payload.x, payload.y)));
                    Ok("Viewport cursor update accepted".to_string())
                }
                "viewport.sculpt.stroke" => {
                    let payload: BrushStrokePayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let radius = payload
                        .radius
                        .unwrap_or(mutable_state.brush_settings.radius);
                    let intensity = payload
                        .intensity
                        .unwrap_or(mutable_state.brush_settings.intensity);
                    let tool = payload.tool.unwrap_or(mutable_state.brush_settings.tool);
                    let kernel = payload.kernel.clone();

                    mutable_state.brush_settings.tool = tool;
                    mutable_state.brush_settings.radius = radius;
                    mutable_state.brush_settings.intensity = intensity;
                    *mutable_state.active_tool = ActiveTool::Sculpt;

                    if let Some(brush_id) = payload.brush_id.clone().or(kernel.clone()) {
                        dispatch
                            .switch_brush_events
                            .write(SwitchBrushEvent { brush_id });
                    }

                    dispatch
                        .cursor_events
                        .write(CursorMovedEvent(Vec2::new(payload.x, payload.y)));
                    dispatch.brush_events.write(BrushStrokeEvent {
                        tool,
                        kernel,
                        radius,
                        intensity,
                        cursor_ndc: Vec2::new(payload.x, payload.y),
                        delta_ndc: match (payload.dx, payload.dy) {
                            (Some(dx), Some(dy)) => Some(Vec2::new(dx, dy)),
                            _ => None,
                        },
                    });

                    Ok("Viewport sculpt stroke accepted".to_string())
                }
                "viewport.paint.stroke" => {
                    let payload: PaintStrokePayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    mutable_state.paint_tool_state.apply_payload(&payload);
                    *mutable_state.active_tool = ActiveTool::Paint;
                    focus_paint_surface(
                        &mut mutable_state.dock_workspace,
                        &mut mutable_state.ui_surfaces_hud,
                    );

                    let target = resolve_route_paint_target_entity(
                        payload.layer_id,
                        payload.use_active_selection,
                        &selection_state,
                        &cursor_state,
                        &layer_query,
                    )?;

                    let center_uv = payload
                        .center_uv
                        .map(Vec2::from_array)
                        .or_else(|| resolve_paint_center_uv(&cursor_state))
                        .ok_or_else(|| {
                            "Paint stroke requires a center_uv or a visible surface hit".to_string()
                        })?;

                    dispatch.paint_stroke_events.write(
                        mutable_state
                            .paint_tool_state
                            .make_stroke_event(target, center_uv),
                    );
                    Ok("Viewport paint stroke accepted".to_string())
                }
                "viewport.paint.clear" => {
                    let payload: PaintClearPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    *mutable_state.active_tool = ActiveTool::Paint;
                    focus_paint_surface(
                        &mut mutable_state.dock_workspace,
                        &mut mutable_state.ui_surfaces_hud,
                    );

                    let target = resolve_route_paint_target_entity(
                        payload.layer_id,
                        payload.use_active_selection,
                        &selection_state,
                        &cursor_state,
                        &layer_query,
                    )?;

                    dispatch.paint_clear_events.write(
                        mutable_state
                            .paint_tool_state
                            .make_clear_event(target, payload.channel),
                    );
                    Ok("Viewport paint clear accepted".to_string())
                }
                "viewport.sculpt.snapshot" => {
                    dispatch.snapshot_events.write(SnapshotEvent);
                    Ok("Sculpt snapshot requested".to_string())
                }
                "viewport.sculpt.undo" => {
                    dispatch.undo_events.write(UndoEvent);
                    Ok("Sculpt undo requested".to_string())
                }
                "viewport.sculpt.redo" => {
                    dispatch.redo_events.write(RedoEvent);
                    Ok("Sculpt redo requested".to_string())
                }
                "viewport.material.wireframe.set" => {
                    let payload: EnabledPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    mutable_state.global_display_mode.show_wireframe = payload.enabled;
                    Ok(format!("Wireframe overlay set to {}", payload.enabled))
                }
                "viewport.sculpt.symmetry.set" => {
                    let payload: SymmetryPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    apply_symmetry_payload(&mut mutable_state.sculpt_ui_state, payload)?;
                    Ok(format!(
                        "Sculpt symmetry state is x={} y={} z={}",
                        mutable_state.sculpt_ui_state.symmetry_x,
                        mutable_state.sculpt_ui_state.symmetry_y,
                        mutable_state.sculpt_ui_state.symmetry_z
                    ))
                }
                "viewport.import.primitive" => {
                    let payload: PrimitiveImportPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let primitive_type = parse_primitive_type(&payload.primitive_type)?;
                    dispatch.spawn_primitive_events.write(SpawnPrimitiveEvent {
                        primitive_type,
                        position: array_vec3(payload.position.unwrap_or([0.0, 0.0, 0.0])),
                        size: payload.size,
                    });
                    Ok("Primitive import command accepted".to_string())
                }
                "viewport.import.gltf" => {
                    let payload: ImportGltfPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    dispatch.import_gltf_events.write(ImportGltfEvent {
                        path: payload.path,
                        position: array_vec3(payload.position.unwrap_or([0.0, 0.0, 0.0])),
                    });
                    Ok("glTF import command accepted".to_string())
                }
                "viewport.tool.set_active" => {
                    let payload: ActiveToolPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let tool = parse_active_tool(&payload.tool)?;
                    mutable_state.engine_state.active_tool_key = Some(payload.tool.clone());
                    *mutable_state.active_tool = tool;
                    if tool == ActiveTool::Paint {
                        focus_paint_surface(
                            &mut mutable_state.dock_workspace,
                            &mut mutable_state.ui_surfaces_hud,
                        );
                    }
                    Ok(format!(
                        "Active tool set to {:?}",
                        *mutable_state.active_tool
                    ))
                }
                "viewport.selection.select" => {
                    let payload: SelectionPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let entity = resolve_layer_entity(payload.layer_id, &layer_query)?;
                    dispatch.select_object_events.write(SelectObjectEvent {
                        entity,
                        add_to_selection: payload.add_to_selection,
                    });
                    Ok(format!("Selection routed to layer {}", payload.layer_id))
                }
                "viewport.selection.transform" => {
                    let payload: SelectionTransformPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let entity = resolve_route_target_entity(
                        payload.layer_id,
                        payload.use_active_selection,
                        &selection_state,
                        &layer_query,
                    )?;
                    dispatch
                        .entity_transform_events
                        .write(HostEntityTransformCommandEvent {
                            entity,
                            translation: payload.translation.map(array_vec3),
                            rotation: payload.rotation_degrees.map(euler_degrees_to_quat),
                            scale: payload.scale.map(array_vec3),
                            absolute: payload.absolute,
                        });
                    Ok("Selection transform command accepted".to_string())
                }
                "viewport.selection.delete" => {
                    dispatch.delete_selected_events.write(DeleteSelectedEvent);
                    Ok("Delete selection requested".to_string())
                }
                "viewport.selection.duplicate" => {
                    dispatch
                        .duplicate_selected_events
                        .write(DuplicateSelectedEvent);
                    Ok("Duplicate selection requested".to_string())
                }
                "viewport.selection.focus" => {
                    dispatch.focus_selection_events.write(FocusSelectionEvent);
                    Ok("Focus selection requested".to_string())
                }
                "viewport.gizmo.mode.set" => {
                    let payload: GizmoModePayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    dispatch
                        .set_gizmo_mode_events
                        .write(SetGizmoModeEvent(parse_gizmo_mode(&payload.mode)?));
                    Ok(format!("Gizmo mode set to {}", payload.mode))
                }
                "viewport.layer.visibility.toggle" => {
                    let payload: LayerEntityPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let entity = resolve_layer_entity(payload.layer_id, &layer_query)?;
                    dispatch
                        .toggle_visibility_events
                        .write(ToggleVisibilityEvent(entity));
                    Ok(format!(
                        "Visibility toggle routed to layer {}",
                        payload.layer_id
                    ))
                }
                "viewport.layer.lock.toggle" => {
                    let payload: LayerEntityPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let entity = resolve_layer_entity(payload.layer_id, &layer_query)?;
                    dispatch.toggle_lock_events.write(ToggleLockEvent(entity));
                    Ok(format!("Lock toggle routed to layer {}", payload.layer_id))
                }
                "viewport.material.create" => {
                    let payload: MaterialCreatePayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    dispatch.create_material_events.write(CreateMaterialEvent {
                        name: payload.name.clone(),
                        base_color: Color::srgba(
                            payload.base_color[0],
                            payload.base_color[1],
                            payload.base_color[2],
                            payload.base_color[3],
                        ),
                        roughness: payload.roughness,
                        metallic: payload.metallic,
                    });
                    Ok(format!("Material create requested: {}", payload.name))
                }
                "viewport.material.assign" => {
                    let payload: MaterialAssignPayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let entity = resolve_route_target_entity(
                        payload.layer_id,
                        payload.use_active_selection,
                        &selection_state,
                        &layer_query,
                    )?;
                    let material = if let Some(material_name) = payload.material_name.as_deref() {
                        get_material_by_name(&material_library, material_name)
                            .ok_or_else(|| format!("Unknown material name {}", material_name))?
                    } else if let Some(kernel_id) = payload.material_kernel_id.as_deref() {
                        get_material_by_kernel_id(&material_library, kernel_id)
                            .ok_or_else(|| format!("Unknown material kernel id {}", kernel_id))?
                    } else {
                        return Err(
                            "Material assign route requires material_name or material_kernel_id"
                                .to_string(),
                        );
                    };
                    dispatch
                        .assign_material_events
                        .write(AssignMaterialToEntityEvent { entity, material });
                    Ok("Material assignment requested".to_string())
                }
                "viewport.material.display_mode.set" => {
                    let payload: DisplayModePayload =
                        decode_payload(&canonical_key, request.payload.clone())?;
                    let display_mode = parse_display_mode(&payload.mode)?;
                    mutable_state.global_display_mode.mode = display_mode;
                    if let Some(wireframe) = payload.wireframe {
                        mutable_state.global_display_mode.show_wireframe = wireframe;
                    }
                    dispatch
                        .display_mode_events
                        .write(SetDisplayModeEvent(display_mode));
                    Ok(format!("Display mode set to {}", payload.mode))
                }
                "viewport.sculpt.subdivide" => {
                    dispatch.subdivide_events.write(SubdivideEvent);
                    Ok("Sculpt subdivide requested".to_string())
                }
                "viewport.sculpt.remesh" => {
                    let payload = if request.payload.is_null() {
                        RemeshPayload::default()
                    } else {
                        decode_payload(&canonical_key, request.payload.clone())?
                    };
                    dispatch.remesh_events.write(RemeshEvent {
                        resolution: payload.resolution.max(16),
                    });
                    Ok("Sculpt remesh requested".to_string())
                }
                _ => Err(format!("Host route {canonical_key} is not implemented yet")),
            }
        })();

        match route_result {
            Ok(detail) => {
                dispatch.responses.write(HostRouteResponse {
                    requested_route_key: request.route_key.clone(),
                    canonical_route_key: Some(canonical_key),
                    correlation_id: request.correlation_id.clone(),
                    success: true,
                    detail,
                });
            }
            Err(detail) => {
                mutable_state.route_state.last_error = Some(detail.clone());
                dispatch.responses.write(HostRouteResponse {
                    requested_route_key: request.route_key.clone(),
                    canonical_route_key: Some(canonical_key),
                    correlation_id: request.correlation_id.clone(),
                    success: false,
                    detail,
                });
            }
        }
    }
}

fn apply_host_window_commands(
    mut events: MessageReader<HostWindowCommandEvent>,
    mut window_query: Query<&mut Window, With<PrimaryWindow>>,
) {
    let Ok(mut window) = window_query.single_mut() else {
        return;
    };

    for event in events.read() {
        match *event {
            HostWindowCommandEvent::SyncBounds(bounds) => {
                window.position = WindowPosition::new(IVec2::new(bounds.x, bounds.y));
                window
                    .resolution
                    .set(bounds.width as f32, bounds.height as f32);
            }
            HostWindowCommandEvent::SetVisibility(visible) => {
                window.visible = visible;
            }
        }
    }
}

fn apply_host_orbit_camera_commands(
    mut events: MessageReader<HostOrbitCameraEvent>,
    mut camera_query: Query<&mut PanOrbitCamera, With<MainCamera>>,
) {
    let Ok(mut pan_orbit) = camera_query.single_mut() else {
        return;
    };

    for event in events.read() {
        pan_orbit.target_yaw += event.yaw_delta;
        pan_orbit.target_pitch += event.pitch_delta;
        pan_orbit.force_update = true;
    }
}

fn apply_host_zoom_camera_commands(
    mut events: MessageReader<HostZoomCameraEvent>,
    mut camera_query: Query<&mut PanOrbitCamera, With<MainCamera>>,
) {
    let Ok(mut pan_orbit) = camera_query.single_mut() else {
        return;
    };

    for event in events.read() {
        pan_orbit.target_radius = (pan_orbit.target_radius - event.radius_delta).max(0.1);
        pan_orbit.force_update = true;
    }
}

fn apply_host_entity_transform_commands(
    mut events: MessageReader<HostEntityTransformCommandEvent>,
    mut transform_query: Query<&mut Transform>,
) {
    for event in events.read() {
        let Ok(mut transform) = transform_query.get_mut(event.entity) else {
            continue;
        };

        if let Some(translation) = event.translation {
            if event.absolute {
                transform.translation = translation;
            } else {
                transform.translation += translation;
            }
        }

        if let Some(rotation) = event.rotation {
            if event.absolute {
                transform.rotation = rotation;
            } else {
                transform.rotation *= rotation;
            }
        }

        if let Some(scale) = event.scale {
            if event.absolute {
                transform.scale = scale;
            } else {
                transform.scale *= scale;
            }
        }
    }
}

fn log_host_route_failures(mut responses: MessageReader<HostRouteResponse>) {
    for response in responses.read() {
        if !response.success {
            warn!(
                "[host-router] route={} detail={}",
                response
                    .canonical_route_key
                    .as_deref()
                    .unwrap_or(&response.requested_route_key),
                response.detail
            );
        }
    }
}

fn register_route(
    routes: &mut BTreeMap<String, HostRouteCatalogEntry>,
    legacy_aliases: &mut BTreeMap<String, String>,
    canonical_key: &str,
    description: &str,
    aliases: &[&str],
) {
    let canonical_key_string = canonical_key.to_string();
    let alias_values = aliases
        .iter()
        .map(|alias| (*alias).to_string())
        .collect::<Vec<_>>();

    routes.insert(
        canonical_key_string.clone(),
        HostRouteCatalogEntry {
            canonical_key: canonical_key_string.clone(),
            description: description.to_string(),
            legacy_aliases: alias_values.clone(),
        },
    );

    for alias in alias_values {
        legacy_aliases.insert(alias, canonical_key_string.clone());
    }
}

fn decode_payload<T>(route_key: &str, payload: Value) -> Result<T, String>
where
    T: for<'de> Deserialize<'de>,
{
    serde_json::from_value(payload)
        .map_err(|error| format!("Invalid payload for route {route_key}: {error}"))
}

fn resolve_layer_entity(
    layer_id: u64,
    layer_query: &Query<(Entity, &LayerInfo)>,
) -> Result<Entity, String> {
    layer_query
        .iter()
        .find_map(|(entity, layer_info)| (layer_info.id == layer_id).then_some(entity))
        .ok_or_else(|| format!("No viewport entity found for layer id {}", layer_id))
}

fn resolve_route_target_entity(
    layer_id: Option<u64>,
    use_active_selection: bool,
    selection_state: &SelectionState,
    layer_query: &Query<(Entity, &LayerInfo)>,
) -> Result<Entity, String> {
    if let Some(layer_id) = layer_id {
        return resolve_layer_entity(layer_id, layer_query);
    }

    if use_active_selection || !selection_state.selection.is_empty() {
        return selection_state
            .primary
            .or_else(|| selection_state.selection.first().copied())
            .ok_or_else(|| "No active selection available".to_string());
    }

    Err("No route target entity provided".to_string())
}

fn resolve_route_paint_target_entity(
    layer_id: Option<u64>,
    use_active_selection: bool,
    selection_state: &SelectionState,
    cursor_state: &SculptCursorState,
    layer_query: &Query<(Entity, &LayerInfo)>,
) -> Result<Entity, String> {
    if let Some(layer_id) = layer_id {
        return resolve_layer_entity(layer_id, layer_query);
    }

    let selection_target = selection_state
        .primary
        .or_else(|| selection_state.selection.first().copied());
    let cursor_target = cursor_state.hit_entity;

    if use_active_selection {
        selection_target
            .or(cursor_target)
            .ok_or_else(|| "No paint target available".to_string())
    } else {
        cursor_target
            .or(selection_target)
            .ok_or_else(|| "No paint target available".to_string())
    }
}

fn apply_symmetry_payload(
    sculpt_ui_state: &mut SculptUiState,
    payload: SymmetryPayload,
) -> Result<(), String> {
    let enabled = payload.enabled.unwrap_or(true);

    if let Some(axis_name) = payload.axis_name {
        return match axis_name.to_ascii_uppercase().as_str() {
            "X" => {
                sculpt_ui_state.symmetry_x = enabled;
                Ok(())
            }
            "Y" => {
                sculpt_ui_state.symmetry_y = enabled;
                Ok(())
            }
            "Z" => {
                sculpt_ui_state.symmetry_z = enabled;
                Ok(())
            }
            other => Err(format!("Unknown symmetry axis name {}", other)),
        };
    }

    match payload.axis.unwrap_or(0) {
        0 => {
            sculpt_ui_state.symmetry_x = false;
            sculpt_ui_state.symmetry_y = false;
            sculpt_ui_state.symmetry_z = false;
            Ok(())
        }
        1 => {
            sculpt_ui_state.symmetry_x = enabled;
            Ok(())
        }
        2 => {
            sculpt_ui_state.symmetry_y = enabled;
            Ok(())
        }
        3 => {
            sculpt_ui_state.symmetry_z = enabled;
            Ok(())
        }
        other => Err(format!("Unknown symmetry axis value {}", other)),
    }
}

fn parse_primitive_type(raw_value: &Value) -> Result<PrimitiveType, String> {
    if let Some(value) = raw_value.as_u64() {
        return match value {
            0 => Ok(PrimitiveType::Cube),
            1 => Ok(PrimitiveType::Sphere),
            2 => Ok(PrimitiveType::Cylinder),
            3 => Ok(PrimitiveType::Plane),
            4 => Ok(PrimitiveType::Torus),
            5 => Ok(PrimitiveType::Cone),
            6 => Ok(PrimitiveType::Icosphere),
            7 => Ok(PrimitiveType::UVSphere),
            _ => Err(format!("Unknown primitive type id {}", value)),
        };
    }

    let Some(value) = raw_value.as_str() else {
        return Err("Primitive type must be a string or integer id".to_string());
    };

    match value.to_ascii_lowercase().as_str() {
        "cube" | "box" => Ok(PrimitiveType::Cube),
        "sphere" => Ok(PrimitiveType::Sphere),
        "cylinder" => Ok(PrimitiveType::Cylinder),
        "plane" => Ok(PrimitiveType::Plane),
        "torus" => Ok(PrimitiveType::Torus),
        "cone" => Ok(PrimitiveType::Cone),
        "icosphere" | "ico_sphere" => Ok(PrimitiveType::Icosphere),
        "uvsphere" | "uv_sphere" => Ok(PrimitiveType::UVSphere),
        other => Err(format!("Unknown primitive type {}", other)),
    }
}

fn parse_active_tool(tool_name: &str) -> Result<ActiveTool, String> {
    let normalized = tool_name.trim().to_ascii_lowercase();

    match normalized.as_str() {
        "viewport" | "view" | "camera" => return Ok(ActiveTool::Viewport),
        "sculpt" | "sculpting" => return Ok(ActiveTool::Sculpt),
        "paint" | "pbr" => return Ok(ActiveTool::Paint),
        _ => {}
    }

    if normalized.starts_with("sculpt.")
        || normalized.starts_with("sculpt/")
        || normalized.starts_with("sculpt-")
        || normalized.starts_with("sculpting.")
        || normalized.starts_with("sculpting/")
    {
        return Ok(ActiveTool::Sculpt);
    }

    if normalized.starts_with("paint.")
        || normalized.starts_with("paint/")
        || normalized.starts_with("paint-")
        || normalized.starts_with("surface.paint")
        || normalized.starts_with("surface-paint")
        || normalized.starts_with("pbr.")
        || normalized.starts_with("pbr/")
    {
        return Ok(ActiveTool::Paint);
    }

    Err(format!("Unknown active tool {}", normalized))
}

fn parse_dock_tab(tab_key: &str) -> Result<DockWorkspaceTab, String> {
    match tab_key.to_ascii_lowercase().as_str() {
        "viewport" => Ok(PANEL_VIEWPORT.to_string()),
        "content_browser" | "content-browser" | "browser" => Ok(PANEL_CONTENT_BROWSER.to_string()),
        "ui_surfaces" | "ui-surfaces" | "surfaces" => Ok(PANEL_UI_SURFACES.to_string()),
        "runtime" | "runtime_diagnostics" | "runtime-diagnostics" => {
            Ok(PANEL_RUNTIME_DIAGNOSTICS.to_string())
        }
        other => Err(format!("Unknown dock tab {}", other)),
    }
}

fn dock_tab_from_engine_target(target: HostEngineDockTarget) -> DockWorkspaceTab {
    match target {
        HostEngineDockTarget::Viewport => PANEL_VIEWPORT.to_string(),
        HostEngineDockTarget::ContentBrowser => PANEL_CONTENT_BROWSER.to_string(),
        HostEngineDockTarget::UiSurfaces => PANEL_UI_SURFACES.to_string(),
    }
}

fn parse_notification_level(level: Option<&str>) -> Result<EditorNotificationLevel, String> {
    match level.unwrap_or("info").to_ascii_lowercase().as_str() {
        "success" => Ok(EditorNotificationLevel::Success),
        "info" => Ok(EditorNotificationLevel::Info),
        "warning" | "warn" => Ok(EditorNotificationLevel::Warning),
        "error" => Ok(EditorNotificationLevel::Error),
        other => Err(format!("Unknown notification level {}", other)),
    }
}

fn parse_gizmo_mode(mode: &str) -> Result<GizmoMode, String> {
    match mode.to_ascii_lowercase().as_str() {
        "translate" | "move" => Ok(GizmoMode::Translate),
        "rotate" => Ok(GizmoMode::Rotate),
        "scale" => Ok(GizmoMode::Scale),
        other => Err(format!("Unknown gizmo mode {}", other)),
    }
}

fn parse_display_mode(mode: &str) -> Result<DisplayMode, String> {
    match mode.to_ascii_lowercase().as_str() {
        "rendered" | "pbr" => Ok(DisplayMode::Rendered),
        "solid" => Ok(DisplayMode::Solid),
        "matcap" => Ok(DisplayMode::Matcap),
        "wireframe" => Ok(DisplayMode::Wireframe),
        "flat" => Ok(DisplayMode::Flat),
        other => Err(format!("Unknown display mode {}", other)),
    }
}

fn array_vec3(values: [f32; 3]) -> Vec3 {
    Vec3::new(values[0], values[1], values[2])
}

fn euler_degrees_to_quat(values: [f32; 3]) -> Quat {
    Quat::from_euler(
        EulerRot::XYZ,
        values[0].to_radians(),
        values[1].to_radians(),
        values[2].to_radians(),
    )
}

fn default_camera_rotate_sensitivity() -> f32 {
    0.01
}

fn default_camera_zoom_scale() -> f32 {
    0.1
}

fn default_material_roughness() -> f32 {
    0.5
}

fn default_primitive_size() -> f32 {
    1.0
}

fn default_remesh_resolution() -> u32 {
    128
}
