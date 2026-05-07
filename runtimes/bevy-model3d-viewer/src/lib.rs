use std::f32::consts::FRAC_PI_2;

use bevy::{
    asset::UnapprovedPathMode,
    camera::primitives::{Aabb, Sphere},
    camera::Exposure,
    core_pipeline::tonemapping::Tonemapping,
    ecs::message::MessageReader,
    gltf::GltfAssetLabel,
    input::mouse::{AccumulatedMouseMotion, MouseWheel},
    light::GlobalAmbientLight,
    prelude::*,
    render::view::Hdr,
    window::{PresentMode, WindowResolution},
};
use js_sys::Reflect;
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{Document, Element, HtmlCanvasElement, HtmlDivElement, HtmlElement};

const BRIDGE_GLOBAL: &str = "__greeblefsRuntimeHostBridge";
const DEFAULT_CLEAR: Color = Color::srgb(0.018, 0.022, 0.028);

#[derive(Clone, Debug, Resource)]
struct ViewerLaunch {
    canvas_selector: String,
    asset_url: String,
    file_name: String,
    extension: String,
}

#[derive(Debug, Resource)]
struct ViewerCameraRig {
    target: Vec3,
    distance: f32,
    yaw: f32,
    pitch: f32,
    min_distance: f32,
    max_distance: f32,
    fitted: bool,
    auto_rotate: bool,
}

impl Default for ViewerCameraRig {
    fn default() -> Self {
        Self {
            target: Vec3::ZERO,
            distance: 4.0,
            yaw: -0.42,
            pitch: -0.28,
            min_distance: 0.05,
            max_distance: 800.0,
            fitted: false,
            auto_rotate: true,
        }
    }
}

#[derive(Debug, Resource)]
struct ViewerRenderOptions {
    exposure: f32,
    show_grid: bool,
}

impl Default for ViewerRenderOptions {
    fn default() -> Self {
        Self {
            exposure: 1.0,
            show_grid: true,
        }
    }
}

#[derive(Component)]
struct ViewerCamera;

#[derive(Component)]
struct ViewerGrid;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen(js_name = mountPanel)]
pub fn mount_panel_js(bridge_token: String) -> Result<(), JsValue> {
    mount_panel(bridge_token)
}

#[wasm_bindgen]
pub fn mount_panel(bridge_token: String) -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    let document = document()?;
    let host = find_mount_host(&document, &bridge_token)?;
    let launch = build_viewer_mount(&document, &host, &bridge_token)?;
    run_bevy_viewer(launch);
    Ok(())
}

#[wasm_bindgen(js_name = unmountPanel)]
pub fn unmount_panel_js(bridge_token: String) -> Result<(), JsValue> {
    unmount_panel(bridge_token)
}

#[wasm_bindgen]
pub fn unmount_panel(bridge_token: String) -> Result<(), JsValue> {
    let document = document()?;
    if let Some(container) = document.get_element_by_id(&container_id(&bridge_token)) {
        container.remove();
    }
    Ok(())
}

fn run_bevy_viewer(launch: ViewerLaunch) {
    let canvas_selector = launch.canvas_selector.clone();
    App::new()
        .insert_resource(ClearColor(DEFAULT_CLEAR))
        .insert_resource(launch)
        .init_resource::<ViewerCameraRig>()
        .init_resource::<ViewerRenderOptions>()
        .add_plugins(
            DefaultPlugins
                .set(WindowPlugin {
                    primary_window: Some(Window {
                        title: "GreebleFS Bevy 3D Viewer".into(),
                        canvas: Some(canvas_selector.into()),
                        fit_canvas_to_parent: true,
                        prevent_default_event_handling: false,
                        present_mode: PresentMode::AutoVsync,
                        resolution: WindowResolution::new(640, 420),
                        ..default()
                    }),
                    ..default()
                })
                .set(AssetPlugin {
                    unapproved_path_mode: UnapprovedPathMode::Allow,
                    ..default()
                }),
        )
        .add_systems(Startup, setup_viewer)
        .add_systems(
            Update,
            (
                orbit_camera_input,
                render_option_input,
                fit_camera_to_loaded_scene,
                sync_camera_transform,
                sync_grid_visibility,
            ),
        )
        .run();
}

fn setup_viewer(
    mut commands: Commands,
    asset_server: Res<AssetServer>,
    launch: Res<ViewerLaunch>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    commands.spawn((
        Name::new("GreebleFS Bevy Preview Camera"),
        Camera3d::default(),
        Camera::default(),
        Hdr,
        Tonemapping::AcesFitted,
        Exposure { ev100: 11.0 },
        Transform::from_xyz(2.8, 1.8, 3.8).looking_at(Vec3::ZERO, Vec3::Y),
        ViewerCamera,
    ));

    commands.spawn((
        Name::new("GreebleFS Bevy Key Light"),
        DirectionalLight {
            illuminance: 18_000.0,
            shadows_enabled: true,
            ..default()
        },
        Transform::from_xyz(3.0, 5.0, 4.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));

    commands.insert_resource(GlobalAmbientLight {
        color: Color::srgb(0.72, 0.78, 0.86),
        brightness: 420.0,
        affects_lightmapped_meshes: true,
    });

    commands.spawn((
        Name::new("GreebleFS Ground Grid"),
        Mesh3d(meshes.add(Plane3d::default().mesh().size(16.0, 16.0))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::srgba(0.12, 0.15, 0.18, 0.42),
            perceptual_roughness: 0.88,
            metallic: 0.0,
            alpha_mode: AlphaMode::Blend,
            ..default()
        })),
        Transform::from_xyz(0.0, -0.002, 0.0),
        ViewerGrid,
    ));

    let scene_path = if supports_bevy_gltf_scene(&launch.extension) {
        GltfAssetLabel::Scene(0).from_asset(launch.asset_url.clone())
    } else {
        GltfAssetLabel::Scene(0).from_asset(unsupported_data_uri())
    };

    commands.spawn((
        Name::new(format!("Preview {}", launch.file_name)),
        SceneRoot(asset_server.load(scene_path)),
        Transform::default(),
    ));
}

fn orbit_camera_input(
    time: Res<Time>,
    mouse_buttons: Res<ButtonInput<MouseButton>>,
    keys: Res<ButtonInput<KeyCode>>,
    mouse_motion: Res<AccumulatedMouseMotion>,
    mut mouse_wheel_events: MessageReader<MouseWheel>,
    mut rig: ResMut<ViewerCameraRig>,
) {
    let pitch_limit = FRAC_PI_2 - 0.02;
    if mouse_buttons.pressed(MouseButton::Left) {
        rig.yaw -= mouse_motion.delta.x * 0.006;
        rig.pitch = (rig.pitch - mouse_motion.delta.y * 0.004).clamp(-pitch_limit, pitch_limit);
        rig.auto_rotate = false;
    }

    if mouse_buttons.pressed(MouseButton::Right) {
        let pan_scale = rig.distance * 0.0015;
        let yaw_rotation = Quat::from_rotation_y(rig.yaw);
        let right = yaw_rotation * Vec3::X;
        let up = Vec3::Y;
        rig.target += right * (-mouse_motion.delta.x * pan_scale);
        rig.target += up * (mouse_motion.delta.y * pan_scale);
        rig.auto_rotate = false;
    }

    for wheel in mouse_wheel_events.read() {
        let zoom = (1.0_f32 - wheel.y * 0.12).clamp(0.18, 2.5);
        rig.distance = (rig.distance * zoom).clamp(rig.min_distance, rig.max_distance);
        rig.auto_rotate = false;
    }

    if keys.just_pressed(KeyCode::Space) {
        rig.auto_rotate = !rig.auto_rotate;
    }

    if keys.just_pressed(KeyCode::KeyF) {
        rig.fitted = false;
    }

    if rig.auto_rotate {
        rig.yaw += time.delta_secs() * 0.18;
    }
}

fn render_option_input(
    keys: Res<ButtonInput<KeyCode>>,
    mut options: ResMut<ViewerRenderOptions>,
    mut clear: ResMut<ClearColor>,
    mut exposures: Query<&mut Exposure, With<ViewerCamera>>,
) {
    if keys.just_pressed(KeyCode::Digit1) {
        options.exposure = 1.0;
        clear.0 = DEFAULT_CLEAR;
    }
    if keys.just_pressed(KeyCode::Digit2) {
        options.exposure = 1.35;
        clear.0 = Color::srgb(0.035, 0.038, 0.042);
    }
    if keys.just_pressed(KeyCode::Digit3) {
        options.exposure = 0.72;
        clear.0 = Color::srgb(0.006, 0.008, 0.012);
    }
    if keys.just_pressed(KeyCode::KeyG) {
        options.show_grid = !options.show_grid;
    }
    if options.is_changed() {
        for mut exposure in &mut exposures {
            exposure.ev100 = match options.exposure {
                exposure if exposure > 1.2 => 10.2,
                exposure if exposure < 0.8 => 12.4,
                _ => 11.0,
            };
        }
    }
}

fn fit_camera_to_loaded_scene(
    meshes: Query<(&GlobalTransform, Option<&Aabb>), With<Mesh3d>>,
    mut rig: ResMut<ViewerCameraRig>,
    mut projection_query: Query<&mut Projection, With<ViewerCamera>>,
) {
    if rig.fitted {
        return;
    }
    if meshes.is_empty() || meshes.iter().any(|(_, maybe_aabb)| maybe_aabb.is_none()) {
        return;
    }

    let mut min = Vec3A::splat(f32::MAX);
    let mut max = Vec3A::splat(f32::MIN);
    for (transform, maybe_aabb) in &meshes {
        let aabb = maybe_aabb.expect("checked above");
        let sphere = Sphere {
            center: Vec3A::from(transform.transform_point(Vec3::from(aabb.center))),
            radius: transform.radius_vec3a(aabb.half_extents),
        };
        let world_aabb = Aabb::from(sphere);
        min = min.min(world_aabb.min());
        max = max.max(world_aabb.max());
    }

    let center = Vec3::from((min + max) * 0.5);
    let radius = Vec3::from(max - min).length().max(0.01) * 0.5;
    rig.target = center;
    rig.distance = (radius * 3.1).clamp(0.6, 800.0);
    rig.min_distance = (radius * 0.06).max(0.02);
    rig.max_distance = (radius * 18.0).max(20.0);
    rig.fitted = true;

    for mut projection in &mut projection_query {
        if let Projection::Perspective(perspective) = &mut *projection {
            perspective.far = perspective.far.max(radius * 30.0);
            perspective.near = (radius * 0.0008).clamp(0.001, 0.1);
        }
    }
}

fn sync_camera_transform(
    rig: Res<ViewerCameraRig>,
    mut cameras: Query<&mut Transform, With<ViewerCamera>>,
) {
    if !rig.is_changed() {
        return;
    }
    let rotation = Quat::from_euler(EulerRot::YXZ, rig.yaw, rig.pitch, 0.0);
    for mut transform in &mut cameras {
        transform.translation = rig.target + rotation * Vec3::new(0.0, 0.0, rig.distance);
        transform.look_at(rig.target, Vec3::Y);
    }
}

fn sync_grid_visibility(
    options: Res<ViewerRenderOptions>,
    mut grids: Query<&mut Visibility, With<ViewerGrid>>,
) {
    if !options.is_changed() {
        return;
    }
    for mut visibility in &mut grids {
        *visibility = if options.show_grid {
            Visibility::Visible
        } else {
            Visibility::Hidden
        };
    }
}

fn supports_bevy_gltf_scene(extension: &str) -> bool {
    matches!(
        extension.trim().to_ascii_lowercase().as_str(),
        "glb" | "gltf"
    )
}

fn unsupported_data_uri() -> String {
    "data:model/gltf+json;base64,eyJhc3NldCI6eyJ2ZXJzaW9uIjoiMi4wIn0sInNjZW5lIjowLCJzY2VuZXMiOlt7Im5vZGVzIjpbXX1dLCJub2RlcyI6W119".to_string()
}

fn document() -> Result<Document, JsValue> {
    web_sys::window()
        .ok_or_else(|| JsValue::from_str("window unavailable"))?
        .document()
        .ok_or_else(|| JsValue::from_str("document unavailable"))
}

fn find_mount_host(document: &Document, bridge_token: &str) -> Result<Element, JsValue> {
    let selector = format!(r#"[data-bridge-token="{bridge_token}"]"#);
    document
        .query_selector(&selector)?
        .ok_or_else(|| JsValue::from_str("wasm panel mount host missing"))
}

fn build_viewer_mount(
    document: &Document,
    host: &Element,
    bridge_token: &str,
) -> Result<ViewerLaunch, JsValue> {
    host.set_inner_html("");
    if let Some(host_element) = host.dyn_ref::<HtmlElement>() {
        let style = host_element.style();
        style.set_property("position", "relative")?;
        style.set_property("overflow", "hidden")?;
        style.set_property("background", "#05070a")?;
    }

    let container = document
        .create_element("div")?
        .dyn_into::<HtmlDivElement>()?;
    container.set_id(&container_id(bridge_token));
    let container_style = container.style();
    container_style.set_property("position", "absolute")?;
    container_style.set_property("inset", "0")?;
    container_style.set_property("min-width", "0")?;
    container_style.set_property("min-height", "0")?;

    let canvas = document
        .create_element("canvas")?
        .dyn_into::<HtmlCanvasElement>()?;
    canvas.set_id(&canvas_id(bridge_token));
    let canvas_style = canvas.style();
    canvas_style.set_property("position", "absolute")?;
    canvas_style.set_property("inset", "0")?;
    canvas_style.set_property("width", "100%")?;
    canvas_style.set_property("height", "100%")?;
    canvas_style.set_property("display", "block")?;

    let hud = document
        .create_element("div")?
        .dyn_into::<HtmlDivElement>()?;
    let hud_style = hud.style();
    hud_style.set_property("position", "absolute")?;
    hud_style.set_property("left", "8px")?;
    hud_style.set_property("right", "8px")?;
    hud_style.set_property("bottom", "8px")?;
    hud_style.set_property("display", "flex")?;
    hud_style.set_property("justify-content", "space-between")?;
    hud_style.set_property("gap", "8px")?;
    hud_style.set_property("pointer-events", "none")?;
    hud_style.set_property(
        "font",
        "10px ui-monospace, SFMono-Regular, Consolas, monospace",
    )?;
    hud_style.set_property("color", "rgba(226, 235, 245, 0.82)")?;
    hud_style.set_property("letter-spacing", "0")?;
    hud.set_inner_html(
        r#"<span style="padding:5px 7px;border:1px solid rgba(148,170,196,.22);background:rgba(5,8,12,.72);border-radius:7px">PBR / WGPU</span><span style="padding:5px 7px;border:1px solid rgba(148,170,196,.22);background:rgba(5,8,12,.72);border-radius:7px">LMB orbit · RMB pan · wheel zoom · F fit · G grid · 1/2/3 light</span>"#,
    );

    container.append_child(&canvas)?;
    container.append_child(&hud)?;
    host.append_child(&container)?;

    let context = runtime_context(bridge_token)?;
    let file = Reflect::get(
        &Reflect::get(&context, &"surfaceContext".into())?,
        &"file".into(),
    )?;

    Ok(ViewerLaunch {
        canvas_selector: format!("#{}", canvas_id(bridge_token)),
        asset_url: string_property(&file, "assetUrl").unwrap_or_default(),
        file_name: string_property(&file, "name").unwrap_or_else(|| "model".to_string()),
        extension: string_property(&file, "extension").unwrap_or_default(),
    })
}

fn runtime_context(bridge_token: &str) -> Result<JsValue, JsValue> {
    let window = web_sys::window().ok_or_else(|| JsValue::from_str("window unavailable"))?;
    let registry = Reflect::get(&window, &BRIDGE_GLOBAL.into())?;
    let entry = Reflect::get(&registry, &bridge_token.into())?;
    Reflect::get(&entry, &"context".into())
}

fn string_property(value: &JsValue, property: &str) -> Option<String> {
    Reflect::get(value, &property.into()).ok()?.as_string()
}

fn container_id(bridge_token: &str) -> String {
    format!("greeblefs-bevy-model3d-{bridge_token}")
}

fn canvas_id(bridge_token: &str) -> String {
    format!("greeblefs-bevy-model3d-canvas-{bridge_token}")
}
