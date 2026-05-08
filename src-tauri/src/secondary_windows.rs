use std::collections::{BTreeMap, HashSet};
use std::sync::Mutex;
use std::{thread, time::Duration};

use log::warn;
use tauri::{
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

pub const EXPLORER_PICKER_WINDOW_ID: &str = "explorer-picker";
pub const EXPLORER_PICKER_WINDOW_LABEL: &str = "picker";
pub const FILE_OPERATIONS_WINDOW_ID: &str = "file-operations";
pub const FILE_OPERATIONS_WINDOW_LABEL: &str = "file-operations";
pub const SECONDARY_WINDOW_LABEL_PREFIX: &str = "secondary-";
pub const SECONDARY_PANEL_WINDOW_LABEL_PREFIX: &str = "secondary-panel-";
pub const SECONDARY_PLUGIN_PANEL_WINDOW_LABEL_PREFIX: &str = "secondary-plugin-panel-";
pub const SECONDARY_ACTION_WIDGET_WINDOW_LABEL_PREFIX: &str = "secondary-action-widget-";
pub const SECONDARY_LOOKDEV_WINDOW_LABEL_PREFIX: &str = "secondary-lookdev-";
pub const SECONDARY_WINDOW_DESCRIPTOR_EVENT: &str = "greeblefs:secondary-window:descriptor";
pub const SECONDARY_WINDOW_CLOSED_EVENT: &str = "greeblefs:secondary-window:closed";
pub const SECONDARY_WINDOW_DOCK_BACK_EVENT: &str = "greeblefs:secondary-window:dock-back";
const SECONDARY_WINDOW_MAIN_THREAD_DEFER_MS: u64 = 35;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SecondaryWindowSurfaceKind {
    ExplorerPicker,
    FileOperations,
    Panel,
    PluginPanel,
    ActionWidget,
    Lookdev,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SecondaryWindowPresentation {
    FramelessWidget,
    ToolWindow,
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryWindowSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryWindowDockTarget {
    pub surface_id: String,
    pub restore_placement: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryWindowOpenRequest {
    pub window_id: String,
    pub surface_kind: SecondaryWindowSurfaceKind,
    pub presentation: SecondaryWindowPresentation,
    pub title: String,
    pub initial_size: Option<SecondaryWindowSize>,
    pub min_size: Option<SecondaryWindowSize>,
    pub source_window_label: Option<String>,
    pub dock_target: Option<SecondaryWindowDockTarget>,
    pub payload_json: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryWindowDescriptor {
    pub window_id: String,
    pub window_label: String,
    pub surface_kind: SecondaryWindowSurfaceKind,
    pub presentation: SecondaryWindowPresentation,
    pub title: String,
    pub initial_size: SecondaryWindowSize,
    pub min_size: SecondaryWindowSize,
    pub remember_bounds: bool,
    pub source_window_label: Option<String>,
    pub dock_target: Option<SecondaryWindowDockTarget>,
    pub payload_json: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SecondaryWindowClosedReason {
    Closed,
    OpenFailed,
    StaleDescriptor,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryWindowDragSessionRequest {
    pub source_window_id: String,
    pub source_window_label: Option<String>,
    pub surface_id: Option<String>,
    pub payload_json: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryWindowClosedEvent {
    pub window_id: String,
    pub window_label: String,
    pub close_reason: SecondaryWindowClosedReason,
    pub descriptor: SecondaryWindowDescriptor,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SecondaryWindowDockBackEvent {
    pub window_id: String,
    pub window_label: String,
    pub dock_target: SecondaryWindowDockTarget,
    pub descriptor: SecondaryWindowDescriptor,
}

#[derive(Debug, Default)]
pub struct SecondaryWindowManagerState {
    descriptors_by_window_id: Mutex<BTreeMap<String, SecondaryWindowDescriptor>>,
    pending_window_labels: Mutex<HashSet<String>>,
    suppressed_closed_window_ids: Mutex<HashSet<String>>,
    active_drag_session: Mutex<Option<SecondaryWindowDragSessionRequest>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct SecondaryWindowPolicy {
    initial_size: SecondaryWindowSize,
    min_size: SecondaryWindowSize,
    skip_taskbar: bool,
    transparent: bool,
    always_on_top: bool,
    remember_bounds: bool,
}

#[tauri::command]
#[specta::specta]
pub fn secondary_window_open(
    app: AppHandle,
    state: tauri::State<'_, SecondaryWindowManagerState>,
    request: SecondaryWindowOpenRequest,
) -> Result<SecondaryWindowDescriptor, String> {
    let descriptor = normalize_secondary_window_descriptor(request)?;
    state.store_descriptor(descriptor.clone());

    let existing_window = app.get_webview_window(&descriptor.window_label).is_some();
    if existing_window {
        schedule_secondary_window_activation(&app, descriptor.window_label.clone())?;
    } else if state.mark_window_label_pending(&descriptor.window_label) {
        if let Err(error) = schedule_secondary_window_launch(&app, descriptor.window_label.clone())
        {
            state.clear_pending_window_label(&descriptor.window_label);
            state.remove_descriptor_by_window_label(&descriptor.window_label);
            return Err(error);
        }
    }
    emit_optional_event(&app, SECONDARY_WINDOW_DESCRIPTOR_EVENT, descriptor.clone());
    Ok(descriptor)
}

#[tauri::command]
#[specta::specta]
pub fn secondary_window_focus(app: AppHandle, window_id: String) -> Result<(), String> {
    let descriptor = resolve_descriptor_for_window_id(&app, &window_id)?;
    let state = app.state::<SecondaryWindowManagerState>();
    let Some(window) = app.get_webview_window(&descriptor.window_label) else {
        if state.is_window_label_pending(&descriptor.window_label) {
            return Ok(());
        }
        let removed_descriptor = state
            .remove_descriptor(&descriptor.window_id)
            .unwrap_or_else(|| descriptor.clone());
        state.clear_pending_window_label(&removed_descriptor.window_label);
        emit_secondary_window_closed_event(
            &app,
            removed_descriptor.clone(),
            SecondaryWindowClosedReason::StaleDescriptor,
        );
        return Err(format!(
            "secondary window not found: {}",
            removed_descriptor.window_id
        ));
    };
    window
        .show()
        .map_err(|error| format!("failed to show secondary window: {error}"))?;
    if let Err(error) = window.set_focus() {
        warn!(
            "failed to focus secondary window {}: {error}",
            descriptor.window_label
        );
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn secondary_window_close(app: AppHandle, window_id: String) -> Result<(), String> {
    let Ok(descriptor) = resolve_descriptor_for_window_id(&app, &window_id) else {
        return Ok(());
    };
    let Some(window) = app.get_webview_window(&descriptor.window_label) else {
        let state = app.state::<SecondaryWindowManagerState>();
        let removed_descriptor = state
            .remove_descriptor(&descriptor.window_id)
            .unwrap_or(descriptor);
        state.clear_pending_window_label(&removed_descriptor.window_label);
        emit_secondary_window_closed_event(
            &app,
            removed_descriptor,
            SecondaryWindowClosedReason::Closed,
        );
        return Ok(());
    };
    window.close().map_err(|error| {
        format!(
            "failed to close secondary window {}: {error}",
            descriptor.window_id
        )
    })?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn secondary_window_dock_back(
    app: AppHandle,
    state: tauri::State<'_, SecondaryWindowManagerState>,
    window_id: String,
) -> Result<(), String> {
    let descriptor = resolve_descriptor_for_window_id(&app, &window_id)?;
    let dock_target = descriptor
        .dock_target
        .clone()
        .filter(|target| !target.surface_id.trim().is_empty())
        .ok_or_else(|| "secondary window is not dock-back capable".to_string())?;

    match descriptor.surface_kind {
        SecondaryWindowSurfaceKind::Panel | SecondaryWindowSurfaceKind::PluginPanel => {}
        _ => return Err("secondary window is not dock-back capable".to_string()),
    }

    state.suppress_closed_event(&descriptor.window_id);
    state.remove_descriptor(&descriptor.window_id);
    state.clear_pending_window_label(&descriptor.window_label);
    emit_optional_event(
        &app,
        SECONDARY_WINDOW_DOCK_BACK_EVENT,
        SecondaryWindowDockBackEvent {
            window_id: descriptor.window_id.clone(),
            window_label: descriptor.window_label.clone(),
            dock_target,
            descriptor: descriptor.clone(),
        },
    );

    if let Some(window) = app.get_webview_window(&descriptor.window_label) {
        window
            .close()
            .map_err(|error| format!("failed to close dock-back window: {error}"))?;
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn secondary_window_begin_drag_session(
    state: tauri::State<'_, SecondaryWindowManagerState>,
    request: SecondaryWindowDragSessionRequest,
) -> SecondaryWindowDragSessionRequest {
    state.set_drag_session(request.clone());
    request
}

#[tauri::command]
#[specta::specta]
pub fn secondary_window_complete_drag_session(
    state: tauri::State<'_, SecondaryWindowManagerState>,
    window_id: String,
) -> Option<SecondaryWindowDragSessionRequest> {
    state.take_drag_session_matching_window_id(&window_id)
}

#[tauri::command]
#[specta::specta]
pub fn secondary_window_get_current_descriptor(
    window: WebviewWindow,
    state: tauri::State<'_, SecondaryWindowManagerState>,
) -> Option<SecondaryWindowDescriptor> {
    state.find_descriptor_by_window_label(window.label())
}

#[tauri::command]
#[specta::specta]
pub fn secondary_window_list_descriptors(
    state: tauri::State<'_, SecondaryWindowManagerState>,
) -> Vec<SecondaryWindowDescriptor> {
    state.list_descriptors()
}

impl SecondaryWindowManagerState {
    pub fn store_descriptor(&self, descriptor: SecondaryWindowDescriptor) {
        let mut descriptors_by_window_id = self
            .descriptors_by_window_id
            .lock()
            .expect("secondary window descriptor registry poisoned");
        descriptors_by_window_id.retain(|_, existing_descriptor| {
            existing_descriptor.window_label != descriptor.window_label
        });
        descriptors_by_window_id.insert(descriptor.window_id.clone(), descriptor);
    }

    pub fn mark_window_label_pending(&self, window_label: &str) -> bool {
        self.pending_window_labels
            .lock()
            .expect("secondary window pending registry poisoned")
            .insert(window_label.to_string())
    }

    pub fn clear_pending_window_label(&self, window_label: &str) {
        self.pending_window_labels
            .lock()
            .expect("secondary window pending registry poisoned")
            .remove(window_label);
    }

    pub fn is_window_label_pending(&self, window_label: &str) -> bool {
        self.pending_window_labels
            .lock()
            .expect("secondary window pending registry poisoned")
            .contains(window_label)
    }

    pub fn remove_descriptor(&self, window_id: &str) -> Option<SecondaryWindowDescriptor> {
        self.descriptors_by_window_id
            .lock()
            .expect("secondary window descriptor registry poisoned")
            .remove(window_id)
    }

    pub fn remove_descriptor_by_window_label(
        &self,
        window_label: &str,
    ) -> Option<SecondaryWindowDescriptor> {
        let mut descriptors_by_window_id = self
            .descriptors_by_window_id
            .lock()
            .expect("secondary window descriptor registry poisoned");
        let matching_window_ids = descriptors_by_window_id
            .iter()
            .filter_map(|(window_id, descriptor)| {
                (descriptor.window_label == window_label).then(|| window_id.clone())
            })
            .collect::<Vec<_>>();

        let mut removed_descriptor = None;
        for window_id in matching_window_ids {
            removed_descriptor = descriptors_by_window_id.remove(&window_id);
        }
        removed_descriptor
    }

    pub fn list_descriptors(&self) -> Vec<SecondaryWindowDescriptor> {
        self.descriptors_by_window_id
            .lock()
            .expect("secondary window descriptor registry poisoned")
            .values()
            .cloned()
            .collect()
    }

    pub fn find_descriptor_by_window_id(
        &self,
        window_id: &str,
    ) -> Option<SecondaryWindowDescriptor> {
        self.descriptors_by_window_id
            .lock()
            .expect("secondary window descriptor registry poisoned")
            .get(window_id)
            .cloned()
    }

    pub fn find_descriptor_by_window_label(
        &self,
        window_label: &str,
    ) -> Option<SecondaryWindowDescriptor> {
        self.descriptors_by_window_id
            .lock()
            .expect("secondary window descriptor registry poisoned")
            .values()
            .find(|descriptor| descriptor.window_label == window_label)
            .cloned()
    }

    pub fn suppress_closed_event(&self, window_id: &str) {
        self.suppressed_closed_window_ids
            .lock()
            .expect("secondary window suppression registry poisoned")
            .insert(window_id.to_string());
    }

    fn should_emit_closed_event(&self, window_id: &str) -> bool {
        !self
            .suppressed_closed_window_ids
            .lock()
            .expect("secondary window suppression registry poisoned")
            .remove(window_id)
    }

    fn set_drag_session(&self, request: SecondaryWindowDragSessionRequest) {
        *self
            .active_drag_session
            .lock()
            .expect("secondary window drag session registry poisoned") = Some(request);
    }

    fn take_drag_session_matching_window_id(
        &self,
        window_id: &str,
    ) -> Option<SecondaryWindowDragSessionRequest> {
        let mut guard = self
            .active_drag_session
            .lock()
            .expect("secondary window drag session registry poisoned");
        if guard
            .as_ref()
            .is_some_and(|session| session.source_window_id == window_id)
        {
            return guard.take();
        }
        None
    }
}

fn normalize_secondary_window_descriptor(
    request: SecondaryWindowOpenRequest,
) -> Result<SecondaryWindowDescriptor, String> {
    let trimmed_window_id = request.window_id.trim();
    if trimmed_window_id.is_empty() {
        return Err("secondary window id is required".to_string());
    }

    let title = request.title.trim();
    if title.is_empty() {
        return Err("secondary window title is required".to_string());
    }

    let sanitized_window_id = sanitize_secondary_window_id(trimmed_window_id);
    if sanitized_window_id.is_empty() {
        return Err(
            "secondary window id must contain at least one ASCII letter or digit".to_string(),
        );
    }

    let policy = resolve_secondary_window_policy(
        &request.surface_kind,
        &request.presentation,
        request.initial_size,
        request.min_size,
    );
    let window_label = resolve_secondary_window_label(&sanitized_window_id, &request.surface_kind);

    Ok(SecondaryWindowDescriptor {
        window_id: trimmed_window_id.to_string(),
        window_label,
        surface_kind: request.surface_kind,
        presentation: request.presentation,
        title: title.to_string(),
        initial_size: policy.initial_size,
        min_size: policy.min_size,
        remember_bounds: policy.remember_bounds,
        source_window_label: request
            .source_window_label
            .and_then(|value| trim_to_option(&value)),
        dock_target: request.dock_target.and_then(normalize_dock_target),
        payload_json: request.payload_json,
    })
}

fn build_secondary_window(
    app: &AppHandle,
    descriptor: &SecondaryWindowDescriptor,
) -> Result<WebviewWindow, String> {
    let policy = resolve_secondary_window_policy(
        &descriptor.surface_kind,
        &descriptor.presentation,
        Some(descriptor.initial_size),
        Some(descriptor.min_size),
    );
    let window = WebviewWindowBuilder::new(
        app,
        &descriptor.window_label,
        WebviewUrl::App("index.html".into()),
    )
    .title(&descriptor.title)
    .inner_size(
        descriptor.initial_size.width as f64,
        descriptor.initial_size.height as f64,
    )
    .min_inner_size(
        descriptor.min_size.width as f64,
        descriptor.min_size.height as f64,
    )
    .visible(false)
    .focused(true)
    .focusable(true)
    .decorations(false)
    .transparent(policy.transparent)
    .always_on_top(policy.always_on_top)
    .skip_taskbar(policy.skip_taskbar)
    .shadow(false)
    .resizable(true)
    .build()
    .map_err(|error| format!("failed to build secondary window: {error}"))?;

    let app_handle = app.clone();
    let descriptor_window_label = descriptor.window_label.clone();
    let descriptor_for_event = descriptor.clone();
    window.on_window_event(move |event| {
        if !matches!(event, WindowEvent::Destroyed) {
            return;
        }

        let state = app_handle.state::<SecondaryWindowManagerState>();
        state.clear_pending_window_label(&descriptor_window_label);
        let removed_descriptor = state
            .remove_descriptor_by_window_label(&descriptor_window_label)
            .unwrap_or_else(|| descriptor_for_event.clone());
        if !state.should_emit_closed_event(&removed_descriptor.window_id) {
            return;
        }

        emit_secondary_window_closed_event(
            &app_handle,
            removed_descriptor,
            SecondaryWindowClosedReason::Closed,
        );
    });

    Ok(window)
}

fn schedule_secondary_window_launch(app: &AppHandle, window_label: String) -> Result<(), String> {
    let app_handle = app.clone();
    thread::Builder::new()
        .name("greeblefs-secondary-window-launch".to_string())
        .spawn(move || {
            thread::sleep(Duration::from_millis(SECONDARY_WINDOW_MAIN_THREAD_DEFER_MS));
            let app_for_error = app_handle.clone();
            let app_for_main_thread = app_handle.clone();
            let window_label_for_error = window_label.clone();
            if let Err(error) = app_handle.run_on_main_thread(move || {
                let state = app_for_main_thread.state::<SecondaryWindowManagerState>();
                let Some(descriptor) = state.find_descriptor_by_window_label(&window_label) else {
                    state.clear_pending_window_label(&window_label);
                    return;
                };

                let result = open_or_focus_secondary_window_on_main_thread(
                    &app_for_main_thread,
                    &state,
                    &descriptor,
                );
                state.clear_pending_window_label(&window_label);

                if let Err(error) = result {
                    warn!(
                        "failed to open secondary window {}: {error}",
                        descriptor.window_label
                    );
                    let removed_descriptor = state
                        .remove_descriptor_by_window_label(&descriptor.window_label)
                        .unwrap_or_else(|| descriptor.clone());
                    emit_secondary_window_closed_event(
                        &app_for_main_thread,
                        removed_descriptor,
                        SecondaryWindowClosedReason::OpenFailed,
                    );
                }
            }) {
                warn!("failed to schedule secondary window launch on main thread: {error}");
                let state = app_for_error.state::<SecondaryWindowManagerState>();
                state.clear_pending_window_label(&window_label_for_error);
                if let Some(removed_descriptor) =
                    state.remove_descriptor_by_window_label(&window_label_for_error)
                {
                    emit_secondary_window_closed_event(
                        &app_for_error,
                        removed_descriptor,
                        SecondaryWindowClosedReason::OpenFailed,
                    );
                }
            }
        })
        .map(|_| ())
        .map_err(|error| format!("failed to spawn secondary window launcher: {error}"))
}

fn schedule_secondary_window_activation(
    app: &AppHandle,
    window_label: String,
) -> Result<(), String> {
    let app_handle = app.clone();
    thread::Builder::new()
        .name("greeblefs-secondary-window-activation".to_string())
        .spawn(move || {
            thread::sleep(Duration::from_millis(SECONDARY_WINDOW_MAIN_THREAD_DEFER_MS));
            let app_for_main_thread = app_handle.clone();
            if let Err(error) = app_handle.run_on_main_thread(move || {
                let state = app_for_main_thread.state::<SecondaryWindowManagerState>();
                let Some(descriptor) = state.find_descriptor_by_window_label(&window_label) else {
                    return;
                };

                if let Err(error) = open_or_focus_secondary_window_on_main_thread(
                    &app_for_main_thread,
                    &state,
                    &descriptor,
                ) {
                    warn!(
                        "failed to activate secondary window {}: {error}",
                        descriptor.window_label
                    );
                    let removed_descriptor = state
                        .remove_descriptor_by_window_label(&descriptor.window_label)
                        .unwrap_or_else(|| descriptor.clone());
                    emit_secondary_window_closed_event(
                        &app_for_main_thread,
                        removed_descriptor,
                        SecondaryWindowClosedReason::StaleDescriptor,
                    );
                }
            }) {
                warn!("failed to schedule secondary window activation on main thread: {error}");
            }
        })
        .map(|_| ())
        .map_err(|error| format!("failed to spawn secondary window activator: {error}"))
}

fn open_or_focus_secondary_window_on_main_thread(
    app: &AppHandle,
    state: &SecondaryWindowManagerState,
    descriptor: &SecondaryWindowDescriptor,
) -> Result<(), String> {
    let window = if let Some(existing_window) = app.get_webview_window(&descriptor.window_label) {
        existing_window
    } else {
        build_secondary_window(app, descriptor)?
    };

    if let Err(error) = window.set_title(&descriptor.title) {
        warn!(
            "failed to set secondary window title for {}: {error}",
            descriptor.window_label
        );
    }
    if let Err(error) = window.show() {
        state.suppress_closed_event(&descriptor.window_id);
        let _ = window.close();
        return Err(format!("failed to show secondary window: {error}"));
    }
    if let Err(error) = window.set_focus() {
        warn!(
            "failed to focus secondary window {} after open: {error}",
            descriptor.window_label
        );
    }

    Ok(())
}

fn resolve_secondary_window_policy(
    surface_kind: &SecondaryWindowSurfaceKind,
    presentation: &SecondaryWindowPresentation,
    requested_initial_size: Option<SecondaryWindowSize>,
    requested_min_size: Option<SecondaryWindowSize>,
) -> SecondaryWindowPolicy {
    let defaults = match surface_kind {
        SecondaryWindowSurfaceKind::ExplorerPicker => SecondaryWindowPolicy {
            initial_size: SecondaryWindowSize {
                width: 760,
                height: 520,
            },
            min_size: SecondaryWindowSize {
                width: 520,
                height: 360,
            },
            skip_taskbar: true,
            transparent: false,
            always_on_top: false,
            remember_bounds: false,
        },
        SecondaryWindowSurfaceKind::FileOperations => SecondaryWindowPolicy {
            initial_size: SecondaryWindowSize {
                width: 880,
                height: 620,
            },
            min_size: SecondaryWindowSize {
                width: 640,
                height: 420,
            },
            skip_taskbar: true,
            transparent: false,
            always_on_top: false,
            remember_bounds: true,
        },
        SecondaryWindowSurfaceKind::Panel | SecondaryWindowSurfaceKind::PluginPanel => {
            SecondaryWindowPolicy {
                initial_size: SecondaryWindowSize {
                    width: 1040,
                    height: 760,
                },
                min_size: SecondaryWindowSize {
                    width: 720,
                    height: 480,
                },
                skip_taskbar: matches!(presentation, SecondaryWindowPresentation::FramelessWidget),
                transparent: false,
                always_on_top: false,
                remember_bounds: true,
            }
        }
        SecondaryWindowSurfaceKind::ActionWidget => SecondaryWindowPolicy {
            initial_size: SecondaryWindowSize {
                width: 440,
                height: 340,
            },
            min_size: SecondaryWindowSize {
                width: 320,
                height: 220,
            },
            skip_taskbar: true,
            transparent: true,
            always_on_top: true,
            remember_bounds: false,
        },
        SecondaryWindowSurfaceKind::Lookdev => SecondaryWindowPolicy {
            initial_size: SecondaryWindowSize {
                width: 1240,
                height: 860,
            },
            min_size: SecondaryWindowSize {
                width: 760,
                height: 560,
            },
            skip_taskbar: false,
            transparent: false,
            always_on_top: false,
            remember_bounds: true,
        },
    };

    let requested_min_size = requested_min_size.unwrap_or(defaults.min_size);
    let min_size = SecondaryWindowSize {
        width: requested_min_size.width.max(240),
        height: requested_min_size.height.max(180),
    };
    let requested_initial_size = requested_initial_size.unwrap_or(defaults.initial_size);
    let initial_size = SecondaryWindowSize {
        width: requested_initial_size.width.max(min_size.width),
        height: requested_initial_size.height.max(min_size.height),
    };

    SecondaryWindowPolicy {
        initial_size,
        min_size,
        ..defaults
    }
}

fn resolve_secondary_window_label(
    sanitized_window_id: &str,
    surface_kind: &SecondaryWindowSurfaceKind,
) -> String {
    match sanitized_window_id {
        EXPLORER_PICKER_WINDOW_ID => EXPLORER_PICKER_WINDOW_LABEL.to_string(),
        FILE_OPERATIONS_WINDOW_ID => FILE_OPERATIONS_WINDOW_LABEL.to_string(),
        _ => {
            let prefix = match surface_kind {
                SecondaryWindowSurfaceKind::Panel => SECONDARY_PANEL_WINDOW_LABEL_PREFIX,
                SecondaryWindowSurfaceKind::PluginPanel => {
                    SECONDARY_PLUGIN_PANEL_WINDOW_LABEL_PREFIX
                }
                SecondaryWindowSurfaceKind::ActionWidget => {
                    SECONDARY_ACTION_WIDGET_WINDOW_LABEL_PREFIX
                }
                SecondaryWindowSurfaceKind::Lookdev => SECONDARY_LOOKDEV_WINDOW_LABEL_PREFIX,
                _ => SECONDARY_WINDOW_LABEL_PREFIX,
            };
            format!("{prefix}{sanitized_window_id}")
        }
    }
}

fn normalize_dock_target(value: SecondaryWindowDockTarget) -> Option<SecondaryWindowDockTarget> {
    let surface_id = value.surface_id.trim();
    if surface_id.is_empty() {
        return None;
    }

    Some(SecondaryWindowDockTarget {
        surface_id: surface_id.to_string(),
        restore_placement: value.restore_placement.as_deref().and_then(trim_to_option),
    })
}

fn sanitize_secondary_window_id(value: &str) -> String {
    let mut normalized = String::with_capacity(value.len());
    let mut last_was_dash = false;
    for character in value.chars() {
        let normalized_character = character.to_ascii_lowercase();
        if normalized_character.is_ascii_alphanumeric() {
            normalized.push(normalized_character);
            last_was_dash = false;
            continue;
        }

        if !last_was_dash {
            normalized.push('-');
            last_was_dash = true;
        }
    }

    normalized.trim_matches('-').to_string()
}

fn trim_to_option(value: &str) -> Option<String> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn resolve_descriptor_for_window_id(
    app: &AppHandle,
    window_id: &str,
) -> Result<SecondaryWindowDescriptor, String> {
    let state = app.state::<SecondaryWindowManagerState>();
    state
        .find_descriptor_by_window_id(window_id)
        .ok_or_else(|| format!("secondary window descriptor not found: {window_id}"))
}

fn emit_optional_event<T: serde::Serialize + Clone>(app: &AppHandle, event: &str, payload: T) {
    let _ = app.emit(event, payload);
}

fn emit_secondary_window_closed_event(
    app: &AppHandle,
    descriptor: SecondaryWindowDescriptor,
    close_reason: SecondaryWindowClosedReason,
) {
    emit_optional_event(
        app,
        SECONDARY_WINDOW_CLOSED_EVENT,
        SecondaryWindowClosedEvent {
            window_id: descriptor.window_id.clone(),
            window_label: descriptor.window_label.clone(),
            close_reason,
            descriptor,
        },
    );
}

pub fn should_window_label_remember_bounds(label: &str) -> bool {
    #[cfg(not(test))]
    let is_primary_shell_label = label == crate::window_commands::MAIN_WINDOW_LABEL
        || label == crate::wayland_dock::WAYLAND_DOCK_WINDOW_LABEL;

    #[cfg(test)]
    let is_primary_shell_label = label == "main" || label == "dock";

    is_primary_shell_label
        || label == FILE_OPERATIONS_WINDOW_LABEL
        || label.starts_with(SECONDARY_PANEL_WINDOW_LABEL_PREFIX)
        || label.starts_with(SECONDARY_PLUGIN_PANEL_WINDOW_LABEL_PREFIX)
        || label.starts_with(SECONDARY_LOOKDEV_WINDOW_LABEL_PREFIX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_secondary_window_policies_by_kind() {
        let picker_policy = resolve_secondary_window_policy(
            &SecondaryWindowSurfaceKind::ExplorerPicker,
            &SecondaryWindowPresentation::FramelessWidget,
            None,
            None,
        );
        assert_eq!(
            picker_policy,
            SecondaryWindowPolicy {
                initial_size: SecondaryWindowSize {
                    width: 760,
                    height: 520,
                },
                min_size: SecondaryWindowSize {
                    width: 520,
                    height: 360,
                },
                skip_taskbar: true,
                transparent: false,
                always_on_top: false,
                remember_bounds: false,
            }
        );

        let action_widget_policy = resolve_secondary_window_policy(
            &SecondaryWindowSurfaceKind::ActionWidget,
            &SecondaryWindowPresentation::FramelessWidget,
            None,
            None,
        );
        assert!(action_widget_policy.always_on_top);
        assert!(action_widget_policy.transparent);
        assert!(!action_widget_policy.remember_bounds);

        let lookdev_policy = resolve_secondary_window_policy(
            &SecondaryWindowSurfaceKind::Lookdev,
            &SecondaryWindowPresentation::ToolWindow,
            None,
            None,
        );
        assert_eq!(
            lookdev_policy,
            SecondaryWindowPolicy {
                initial_size: SecondaryWindowSize {
                    width: 1240,
                    height: 860,
                },
                min_size: SecondaryWindowSize {
                    width: 760,
                    height: 560,
                },
                skip_taskbar: false,
                transparent: false,
                always_on_top: false,
                remember_bounds: true,
            }
        );
    }

    #[test]
    fn duplicate_window_ids_resolve_stable_labels() {
        assert_eq!(
            resolve_secondary_window_label(
                &sanitize_secondary_window_id(EXPLORER_PICKER_WINDOW_ID),
                &SecondaryWindowSurfaceKind::ExplorerPicker,
            ),
            EXPLORER_PICKER_WINDOW_LABEL
        );
        assert_eq!(
            resolve_secondary_window_label("notes-panel", &SecondaryWindowSurfaceKind::Panel,),
            "secondary-panel-notes-panel"
        );
        assert_eq!(
            resolve_secondary_window_label("lookdev", &SecondaryWindowSurfaceKind::Lookdev,),
            "secondary-lookdev-lookdev"
        );
    }

    #[test]
    fn dock_back_requires_panel_surface_kind_and_surface_id() {
        let picker_descriptor = normalize_secondary_window_descriptor(SecondaryWindowOpenRequest {
            window_id: EXPLORER_PICKER_WINDOW_ID.to_string(),
            surface_kind: SecondaryWindowSurfaceKind::ExplorerPicker,
            presentation: SecondaryWindowPresentation::FramelessWidget,
            title: "Picker".to_string(),
            initial_size: None,
            min_size: None,
            source_window_label: Some("main".to_string()),
            dock_target: Some(SecondaryWindowDockTarget {
                surface_id: "explorer".to_string(),
                restore_placement: Some("center".to_string()),
            }),
            payload_json: None,
        })
        .expect("picker descriptor should normalize");
        assert!(!matches!(
            picker_descriptor.surface_kind,
            SecondaryWindowSurfaceKind::Panel | SecondaryWindowSurfaceKind::PluginPanel
        ));

        let panel_descriptor = normalize_secondary_window_descriptor(SecondaryWindowOpenRequest {
            window_id: "settings-panel".to_string(),
            surface_kind: SecondaryWindowSurfaceKind::Panel,
            presentation: SecondaryWindowPresentation::ToolWindow,
            title: "Settings".to_string(),
            initial_size: None,
            min_size: None,
            source_window_label: Some("main".to_string()),
            dock_target: Some(SecondaryWindowDockTarget {
                surface_id: "settings".to_string(),
                restore_placement: Some("right-sidebar".to_string()),
            }),
            payload_json: None,
        })
        .expect("panel descriptor should normalize");
        assert_eq!(
            panel_descriptor
                .dock_target
                .expect("dock target should exist")
                .surface_id,
            "settings"
        );
    }

    #[test]
    fn remember_bounds_filter_only_tracks_persistent_window_labels() {
        assert!(should_window_label_remember_bounds("main"));
        assert!(should_window_label_remember_bounds("dock"));
        assert!(should_window_label_remember_bounds("file-operations"));
        assert!(should_window_label_remember_bounds("secondary-panel-notes"));
        assert!(should_window_label_remember_bounds(
            "secondary-plugin-panel-sketchfab"
        ));
        assert!(should_window_label_remember_bounds(
            "secondary-lookdev-lookdev"
        ));
        assert!(!should_window_label_remember_bounds("picker"));
        assert!(!should_window_label_remember_bounds(
            "secondary-action-widget-clock"
        ));
    }

    #[test]
    fn descriptor_registry_keeps_one_descriptor_per_window_label() {
        let state = SecondaryWindowManagerState::default();
        let first_descriptor = normalize_secondary_window_descriptor(SecondaryWindowOpenRequest {
            window_id: "Settings!".to_string(),
            surface_kind: SecondaryWindowSurfaceKind::Panel,
            presentation: SecondaryWindowPresentation::ToolWindow,
            title: "Settings".to_string(),
            initial_size: None,
            min_size: None,
            source_window_label: Some("main".to_string()),
            dock_target: Some(SecondaryWindowDockTarget {
                surface_id: "settings".to_string(),
                restore_placement: Some("right-sidebar".to_string()),
            }),
            payload_json: None,
        })
        .expect("first descriptor should normalize");
        let second_descriptor = normalize_secondary_window_descriptor(SecondaryWindowOpenRequest {
            window_id: "settings".to_string(),
            surface_kind: SecondaryWindowSurfaceKind::Panel,
            presentation: SecondaryWindowPresentation::ToolWindow,
            title: "Settings".to_string(),
            initial_size: None,
            min_size: None,
            source_window_label: Some("main".to_string()),
            dock_target: Some(SecondaryWindowDockTarget {
                surface_id: "settings".to_string(),
                restore_placement: Some("right-sidebar".to_string()),
            }),
            payload_json: None,
        })
        .expect("second descriptor should normalize");

        assert_eq!(
            first_descriptor.window_label,
            second_descriptor.window_label
        );

        state.store_descriptor(first_descriptor.clone());
        state.store_descriptor(second_descriptor.clone());

        assert!(state
            .find_descriptor_by_window_id(&first_descriptor.window_id)
            .is_none());
        assert_eq!(state.list_descriptors().len(), 1);
        assert_eq!(
            state
                .find_descriptor_by_window_label(&second_descriptor.window_label)
                .expect("descriptor should be stored by label")
                .window_id,
            second_descriptor.window_id
        );

        let removed_descriptor = state
            .remove_descriptor_by_window_label(&second_descriptor.window_label)
            .expect("descriptor should be removable by label");
        assert_eq!(removed_descriptor.window_id, second_descriptor.window_id);
        assert!(state.list_descriptors().is_empty());
    }

    #[test]
    fn pending_window_registry_deduplicates_by_window_label() {
        let state = SecondaryWindowManagerState::default();
        let window_label = "secondary-panel-settings";

        assert!(state.mark_window_label_pending(window_label));
        assert!(!state.mark_window_label_pending(window_label));
        assert!(state.is_window_label_pending(window_label));

        state.clear_pending_window_label(window_label);
        assert!(!state.is_window_label_pending(window_label));
    }
}
