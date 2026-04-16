use std::{
    env, fs,
    path::{Path, PathBuf},
};

const NVIDIA_VENDOR_ID: &str = "0x10de";
const SYSFS_DRM_ROOT: &str = "/sys/class/drm";
const SYS_MODULE_ROOT: &str = "/sys/module";
const NVIDIA_MODULE_NAMES: [&str; 2] = ["nvidia", "nvidia_drm"];
const STARTUP_PREFERENCES_FILE_NAME: &str = "startup-preferences.json";
const STARTUP_PREFERENCES_DIRECTORY_NAME: &str = "GreebleFS";
const LEGACY_STARTUP_PREFERENCES_DIRECTORY_NAME: &str = "OverlayTerm";
const PRIMARY_DISPLAY_BACKEND_ENV_VAR: &str = "GREEBLEFS_LINUX_DISPLAY_BACKEND";
const LEGACY_DISPLAY_BACKEND_ENV_VAR: &str = "OVERLAYTERM_LINUX_DISPLAY_BACKEND";

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    serde::Serialize,
    serde::Deserialize,
    specta::Type,
)]
#[serde(rename_all = "lowercase")]
pub enum LinuxDisplayBackend {
    Wayland,
    X11,
}

impl LinuxDisplayBackend {
    pub(crate) fn as_env_value(self) -> &'static str {
        match self {
            Self::Wayland => "wayland",
            Self::X11 => "x11",
        }
    }

    pub(crate) fn as_label(self) -> &'static str {
        self.as_env_value()
    }
}

#[derive(
    Debug,
    Default,
    Clone,
    Copy,
    PartialEq,
    Eq,
    serde::Serialize,
    serde::Deserialize,
    specta::Type,
)]
#[serde(rename_all = "lowercase")]
pub enum LinuxDisplayBackendPreference {
    #[default]
    Auto,
    Wayland,
    X11,
}

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LinuxDisplayBackendStatus {
    pub available_backends: Vec<LinuxDisplayBackend>,
    pub session_backend: Option<LinuxDisplayBackend>,
    pub active_backend: Option<LinuxDisplayBackend>,
    pub preferred_backend: LinuxDisplayBackendPreference,
    pub auto_x11_fallback_active: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct LinuxWebkitNvidiaWorkaroundPlan {
    disable_dmabuf_renderer: bool,
    disable_nv_explicit_sync: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LinuxDisplayBackendSelectionReason {
    ExplicitGdkBackend,
    EnvironmentPreference,
    PersistedPreference,
    AutoNvidiaX11Fallback,
    SessionDefault,
    AvailabilityFallback,
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct LinuxDisplayBackendSelection {
    backend: Option<LinuxDisplayBackend>,
    reason: LinuxDisplayBackendSelectionReason,
    auto_x11_fallback_active: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LinuxGraphicsEnvironmentSnapshot {
    gdk_backend: Option<String>,
    xdg_session_type: Option<String>,
    display: Option<String>,
    wayland_display: Option<String>,
    webkit_disable_dmabuf_renderer: Option<String>,
    nv_disable_explicit_sync: Option<String>,
    app_display_backend_preference: Option<String>,
}

#[derive(Debug, Default, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartupPreferences {
    #[serde(default)]
    linux_display_backend_preference: LinuxDisplayBackendPreference,
}

impl LinuxGraphicsEnvironmentSnapshot {
    fn from_process_environment() -> Self {
        Self {
            gdk_backend: read_trimmed_env_var("GDK_BACKEND"),
            xdg_session_type: read_trimmed_env_var("XDG_SESSION_TYPE")
                .map(|value| value.to_ascii_lowercase()),
            display: read_trimmed_env_var("DISPLAY"),
            wayland_display: read_trimmed_env_var("WAYLAND_DISPLAY"),
            webkit_disable_dmabuf_renderer: read_trimmed_env_var("WEBKIT_DISABLE_DMABUF_RENDERER"),
            nv_disable_explicit_sync: read_trimmed_env_var("__NV_DISABLE_EXPLICIT_SYNC"),
            app_display_backend_preference: read_trimmed_env_var(PRIMARY_DISPLAY_BACKEND_ENV_VAR)
                .or_else(|| read_trimmed_env_var(LEGACY_DISPLAY_BACKEND_ENV_VAR)),
        }
    }
}

fn read_trimmed_env_var(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn read_trimmed_file(path: &Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn parse_linux_display_backend(value: &str) -> Option<LinuxDisplayBackend> {
    match value.trim().to_ascii_lowercase().as_str() {
        "wayland" => Some(LinuxDisplayBackend::Wayland),
        "x11" => Some(LinuxDisplayBackend::X11),
        _ => None,
    }
}

fn parse_linux_display_backend_preference(value: &str) -> Option<LinuxDisplayBackendPreference> {
    match value.trim().to_ascii_lowercase().as_str() {
        "auto" => Some(LinuxDisplayBackendPreference::Auto),
        "wayland" => Some(LinuxDisplayBackendPreference::Wayland),
        "x11" => Some(LinuxDisplayBackendPreference::X11),
        _ => None,
    }
}

fn resolve_backend_from_gdk_backend_value(gdk_backend: &str) -> Option<LinuxDisplayBackend> {
    gdk_backend
        .split(',')
        .find_map(parse_linux_display_backend)
}

fn resolve_active_linux_display_backend(
    environment: &LinuxGraphicsEnvironmentSnapshot,
) -> Option<LinuxDisplayBackend> {
    if let Some(gdk_backend) = environment.gdk_backend.as_deref() {
        if let Some(backend) = resolve_backend_from_gdk_backend_value(gdk_backend) {
            return Some(backend);
        }
    }

    resolve_linux_session_backend(environment)
}

fn resolve_linux_session_backend(
    environment: &LinuxGraphicsEnvironmentSnapshot,
) -> Option<LinuxDisplayBackend> {
    match environment.xdg_session_type.as_deref() {
        Some("wayland") if environment.wayland_display.is_some() => {
            return Some(LinuxDisplayBackend::Wayland)
        }
        Some("x11") if environment.display.is_some() => return Some(LinuxDisplayBackend::X11),
        _ => {}
    }

    if environment.wayland_display.is_some() {
        return Some(LinuxDisplayBackend::Wayland);
    }

    if environment.display.is_some() {
        return Some(LinuxDisplayBackend::X11);
    }

    None
}

fn collect_available_linux_display_backends(
    environment: &LinuxGraphicsEnvironmentSnapshot,
) -> Vec<LinuxDisplayBackend> {
    let mut backends = Vec::with_capacity(2);

    if environment.wayland_display.is_some() {
        backends.push(LinuxDisplayBackend::Wayland);
    }

    if environment.display.is_some() {
        backends.push(LinuxDisplayBackend::X11);
    }

    backends
}

fn select_preferred_available_backend(
    preferred_backend: LinuxDisplayBackend,
    available_backends: &[LinuxDisplayBackend],
) -> Option<LinuxDisplayBackend> {
    if available_backends.contains(&preferred_backend) {
        return Some(preferred_backend);
    }

    None
}

fn fallback_backend_for_unavailable_preference(
    preferred_backend: LinuxDisplayBackend,
    environment: &LinuxGraphicsEnvironmentSnapshot,
    available_backends: &[LinuxDisplayBackend],
) -> Option<LinuxDisplayBackend> {
    let session_backend = resolve_linux_session_backend(environment);
    if let Some(session_backend) = session_backend {
        if available_backends.contains(&session_backend) {
            return Some(session_backend);
        }
    }

    match preferred_backend {
        LinuxDisplayBackend::Wayland if available_backends.contains(&LinuxDisplayBackend::X11) => {
            Some(LinuxDisplayBackend::X11)
        }
        LinuxDisplayBackend::X11 if available_backends.contains(&LinuxDisplayBackend::Wayland) => {
            Some(LinuxDisplayBackend::Wayland)
        }
        _ => available_backends.first().copied(),
    }
}

fn resolve_linux_display_backend_selection(
    environment: &LinuxGraphicsEnvironmentSnapshot,
    preferred_backend: LinuxDisplayBackendPreference,
    nvidia_gpu_detected: bool,
) -> LinuxDisplayBackendSelection {
    if let Some(gdk_backend) = environment.gdk_backend.as_deref() {
        return LinuxDisplayBackendSelection {
            backend: resolve_backend_from_gdk_backend_value(gdk_backend),
            reason: LinuxDisplayBackendSelectionReason::ExplicitGdkBackend,
            auto_x11_fallback_active: false,
        };
    }

    let available_backends = collect_available_linux_display_backends(environment);
    let session_backend = resolve_linux_session_backend(environment);
    let has_wayland = available_backends.contains(&LinuxDisplayBackend::Wayland);
    let has_x11 = available_backends.contains(&LinuxDisplayBackend::X11);

    match preferred_backend {
        LinuxDisplayBackendPreference::Auto => {
            if nvidia_gpu_detected
                && session_backend == Some(LinuxDisplayBackend::Wayland)
                && has_wayland
                && has_x11
            {
                return LinuxDisplayBackendSelection {
                    backend: Some(LinuxDisplayBackend::X11),
                    reason: LinuxDisplayBackendSelectionReason::AutoNvidiaX11Fallback,
                    auto_x11_fallback_active: true,
                };
            }

            let backend = session_backend.or_else(|| available_backends.first().copied());
            LinuxDisplayBackendSelection {
                backend,
                reason: if backend.is_some() {
                    LinuxDisplayBackendSelectionReason::SessionDefault
                } else {
                    LinuxDisplayBackendSelectionReason::Unavailable
                },
                auto_x11_fallback_active: false,
            }
        }
        LinuxDisplayBackendPreference::Wayland => {
            let backend =
                select_preferred_available_backend(LinuxDisplayBackend::Wayland, &available_backends)
                    .or_else(|| {
                        fallback_backend_for_unavailable_preference(
                            LinuxDisplayBackend::Wayland,
                            environment,
                            &available_backends,
                        )
                    });
            LinuxDisplayBackendSelection {
                backend,
                reason: if backend == Some(LinuxDisplayBackend::Wayland) {
                    LinuxDisplayBackendSelectionReason::PersistedPreference
                } else if backend.is_some() {
                    LinuxDisplayBackendSelectionReason::AvailabilityFallback
                } else {
                    LinuxDisplayBackendSelectionReason::Unavailable
                },
                auto_x11_fallback_active: false,
            }
        }
        LinuxDisplayBackendPreference::X11 => {
            let backend =
                select_preferred_available_backend(LinuxDisplayBackend::X11, &available_backends)
                    .or_else(|| {
                        fallback_backend_for_unavailable_preference(
                            LinuxDisplayBackend::X11,
                            environment,
                            &available_backends,
                        )
                    });
            LinuxDisplayBackendSelection {
                backend,
                reason: if backend == Some(LinuxDisplayBackend::X11) {
                    LinuxDisplayBackendSelectionReason::PersistedPreference
                } else if backend.is_some() {
                    LinuxDisplayBackendSelectionReason::AvailabilityFallback
                } else {
                    LinuxDisplayBackendSelectionReason::Unavailable
                },
                auto_x11_fallback_active: false,
            }
        }
    }
}

fn resolve_linux_display_backend_preference_from_environment(
    environment: &LinuxGraphicsEnvironmentSnapshot,
) -> Option<LinuxDisplayBackendPreference> {
    environment
        .app_display_backend_preference
        .as_deref()
        .and_then(parse_linux_display_backend_preference)
}

fn startup_preferences_path_from_config_root(config_root: &Path) -> PathBuf {
    config_root
        .join(STARTUP_PREFERENCES_DIRECTORY_NAME)
        .join(STARTUP_PREFERENCES_FILE_NAME)
}

fn legacy_startup_preferences_path_from_config_root(config_root: &Path) -> PathBuf {
    config_root
        .join(LEGACY_STARTUP_PREFERENCES_DIRECTORY_NAME)
        .join(STARTUP_PREFERENCES_FILE_NAME)
}

fn read_startup_preferences_from_path(path: &Path) -> Option<StartupPreferences> {
    let source = fs::read_to_string(path).ok()?;
    serde_json::from_str::<StartupPreferences>(&source).ok()
}

fn load_startup_preferences_from_config_root(config_root: Option<&Path>) -> StartupPreferences {
    let Some(config_root) = config_root else {
        return StartupPreferences::default();
    };

    let primary_path = startup_preferences_path_from_config_root(config_root);
    if let Some(preferences) = read_startup_preferences_from_path(&primary_path) {
        return preferences;
    }

    let legacy_path = legacy_startup_preferences_path_from_config_root(config_root);
    read_startup_preferences_from_path(&legacy_path).unwrap_or_default()
}

fn current_startup_preferences() -> StartupPreferences {
    load_startup_preferences_from_config_root(dirs::config_dir().as_deref())
}

fn persist_startup_preferences(preferences: &StartupPreferences) -> Result<(), String> {
    let config_root =
        dirs::config_dir().ok_or_else(|| "Linux startup preferences require a config directory".to_string())?;
    let preferences_path = startup_preferences_path_from_config_root(&config_root);
    let preferences_directory = preferences_path
        .parent()
        .ok_or_else(|| "Linux startup preferences path is missing a parent directory".to_string())?;
    let serialized_preferences = serde_json::to_string_pretty(preferences)
        .map_err(|error| format!("Failed to serialize Linux startup preferences: {error}"))?;

    fs::create_dir_all(preferences_directory)
        .map_err(|error| format!("Failed to create Linux startup preferences directory: {error}"))?;
    fs::write(preferences_path, format!("{serialized_preferences}\n"))
        .map_err(|error| format!("Failed to write Linux startup preferences: {error}"))
}

fn preferred_backend_reason_label(
    selection_reason: LinuxDisplayBackendSelectionReason,
    preferred_backend: LinuxDisplayBackendPreference,
) -> &'static str {
    match selection_reason {
        LinuxDisplayBackendSelectionReason::ExplicitGdkBackend => "GDK_BACKEND override",
        LinuxDisplayBackendSelectionReason::EnvironmentPreference => {
            "GREEBLEFS_LINUX_DISPLAY_BACKEND override"
        }
        LinuxDisplayBackendSelectionReason::PersistedPreference => match preferred_backend {
            LinuxDisplayBackendPreference::Wayland => "saved startup preference",
            LinuxDisplayBackendPreference::X11 => "saved startup preference",
            LinuxDisplayBackendPreference::Auto => "automatic session selection",
        },
        LinuxDisplayBackendSelectionReason::AutoNvidiaX11Fallback => {
            "auto X11 fallback for NVIDIA WebKit on Wayland"
        }
        LinuxDisplayBackendSelectionReason::SessionDefault => "automatic session selection",
        LinuxDisplayBackendSelectionReason::AvailabilityFallback => {
            "requested backend unavailable; using available fallback"
        }
        LinuxDisplayBackendSelectionReason::Unavailable => "no graphical backend detected",
    }
}

fn resolve_linux_backend_preference_and_selection(
    environment: &LinuxGraphicsEnvironmentSnapshot,
    nvidia_gpu_detected: bool,
) -> (LinuxDisplayBackendPreference, LinuxDisplayBackendSelection) {
    if environment.gdk_backend.is_some() {
        return (
            resolve_linux_display_backend_preference_from_environment(environment)
                .unwrap_or_else(|| current_startup_preferences().linux_display_backend_preference),
            resolve_linux_display_backend_selection(
                environment,
                LinuxDisplayBackendPreference::Auto,
                nvidia_gpu_detected,
            ),
        );
    }

    if let Some(preference) = resolve_linux_display_backend_preference_from_environment(environment) {
        let mut selection =
            resolve_linux_display_backend_selection(environment, preference, nvidia_gpu_detected);
        if selection.reason == LinuxDisplayBackendSelectionReason::PersistedPreference {
            selection.reason = LinuxDisplayBackendSelectionReason::EnvironmentPreference;
        }
        return (preference, selection);
    }

    let preferences = current_startup_preferences();
    let preference = preferences.linux_display_backend_preference;
    (
        preference,
        resolve_linux_display_backend_selection(environment, preference, nvidia_gpu_detected),
    )
}

fn resolve_linux_webkit_nvidia_workaround(
    environment: &LinuxGraphicsEnvironmentSnapshot,
    active_backend: Option<LinuxDisplayBackend>,
    nvidia_gpu_detected: bool,
) -> Option<LinuxWebkitNvidiaWorkaroundPlan> {
    if !nvidia_gpu_detected {
        return None;
    }

    match active_backend {
        Some(LinuxDisplayBackend::Wayland) => {
            let disable_dmabuf_renderer = environment.webkit_disable_dmabuf_renderer.is_none();
            let disable_nv_explicit_sync = environment.nv_disable_explicit_sync.is_none();

            if disable_dmabuf_renderer || disable_nv_explicit_sync {
                Some(LinuxWebkitNvidiaWorkaroundPlan {
                    disable_dmabuf_renderer,
                    disable_nv_explicit_sync,
                })
            } else {
                None
            }
        }
        Some(LinuxDisplayBackend::X11) => {
            if environment.webkit_disable_dmabuf_renderer.is_none() {
                Some(LinuxWebkitNvidiaWorkaroundPlan {
                    disable_dmabuf_renderer: true,
                    disable_nv_explicit_sync: false,
                })
            } else {
                None
            }
        }
        None => None,
    }
}

fn linux_primary_gpu_is_nvidia(drm_root: &Path) -> bool {
    let entries = match fs::read_dir(drm_root) {
        Ok(entries) => entries,
        Err(_) => return false,
    };

    for entry in entries.flatten() {
        let Some(entry_name) = entry.file_name().to_str().map(|value| value.to_string()) else {
            continue;
        };
        if !entry_name.starts_with("card") {
            continue;
        }

        let device_root = entry.path().join("device");
        if !device_root.exists() {
            continue;
        }

        let boot_vga = read_trimmed_file(&device_root.join("boot_vga")).as_deref() == Some("1");
        let boot_display =
            read_trimmed_file(&device_root.join("boot_display")).as_deref() == Some("1");
        let is_boot_gpu = boot_vga || boot_display;
        if !is_boot_gpu {
            continue;
        }

        if read_trimmed_file(&device_root.join("vendor")).as_deref() == Some(NVIDIA_VENDOR_ID) {
            return true;
        }
    }

    false
}

fn linux_nvidia_kernel_module_loaded(sys_module_root: &Path) -> bool {
    NVIDIA_MODULE_NAMES
        .iter()
        .map(|module_name| sys_module_root.join(module_name))
        .any(|module_path| module_path.exists())
}

fn linux_nvidia_gpu_detected(drm_root: &Path, sys_module_root: &Path) -> bool {
    linux_primary_gpu_is_nvidia(drm_root) || linux_nvidia_kernel_module_loaded(sys_module_root)
}

#[cfg(target_os = "linux")]
pub(crate) fn current_linux_display_backend() -> Option<LinuxDisplayBackend> {
    current_linux_display_backend_status().active_backend
}

#[cfg(not(target_os = "linux"))]
pub(crate) fn current_linux_display_backend() -> Option<LinuxDisplayBackend> {
    None
}

pub(crate) fn current_linux_display_backend_status() -> LinuxDisplayBackendStatus {
    let environment = LinuxGraphicsEnvironmentSnapshot::from_process_environment();
    let nvidia_gpu_detected =
        linux_nvidia_gpu_detected(Path::new(SYSFS_DRM_ROOT), Path::new(SYS_MODULE_ROOT));
    let (preferred_backend, selection) =
        resolve_linux_backend_preference_and_selection(&environment, nvidia_gpu_detected);

    LinuxDisplayBackendStatus {
        available_backends: collect_available_linux_display_backends(&environment),
        session_backend: resolve_linux_session_backend(&environment),
        active_backend: selection.backend.or_else(|| resolve_active_linux_display_backend(&environment)),
        preferred_backend,
        auto_x11_fallback_active: selection.auto_x11_fallback_active,
    }
}

pub(crate) fn set_linux_display_backend_preference(
    preferred_backend: LinuxDisplayBackendPreference,
) -> Result<(), String> {
    persist_startup_preferences(&StartupPreferences {
        linux_display_backend_preference: preferred_backend,
    })
}

#[cfg(target_os = "linux")]
pub(crate) fn apply_linux_graphics_startup_configuration() {
    let environment = LinuxGraphicsEnvironmentSnapshot::from_process_environment();
    let nvidia_gpu_detected =
        linux_nvidia_gpu_detected(Path::new(SYSFS_DRM_ROOT), Path::new(SYS_MODULE_ROOT));
    let (preferred_backend, selection) =
        resolve_linux_backend_preference_and_selection(&environment, nvidia_gpu_detected);

    if environment.gdk_backend.is_none() {
        if let Some(selected_backend) = selection.backend {
            env::set_var("GDK_BACKEND", selected_backend.as_env_value());
            eprintln!(
                "GreebleFS: selected Linux display backend: {} ({})",
                selected_backend.as_label(),
                preferred_backend_reason_label(selection.reason, preferred_backend),
            );
        }
    }

    let configured_environment = LinuxGraphicsEnvironmentSnapshot::from_process_environment();
    let active_backend = resolve_active_linux_display_backend(&configured_environment);

    if let Some(plan) =
        resolve_linux_webkit_nvidia_workaround(&configured_environment, active_backend, nvidia_gpu_detected)
    {
        if plan.disable_dmabuf_renderer {
            env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            eprintln!(
                "GreebleFS: applied Linux NVIDIA WebKit workaround: WEBKIT_DISABLE_DMABUF_RENDERER=1"
            );
        }

        if plan.disable_nv_explicit_sync {
            env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
            eprintln!(
                "GreebleFS: applied Linux NVIDIA WebKit workaround: __NV_DISABLE_EXPLICIT_SYNC=1"
            );
        }
    }
}

#[cfg(not(target_os = "linux"))]
pub(crate) fn apply_linux_graphics_startup_configuration() {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    fn write_trimmed_fixture(root: &Path, relative_path: &str, value: &str) {
        let full_path = root.join(relative_path);
        fs::create_dir_all(full_path.parent().expect("fixture parent")).expect("fixture parent");
        fs::write(full_path, value).expect("fixture write");
    }

    #[test]
    fn resolves_wayland_backend_from_gdk_backend_priority() {
        let environment = LinuxGraphicsEnvironmentSnapshot {
            gdk_backend: Some("wayland,x11".into()),
            xdg_session_type: Some("x11".into()),
            display: Some(":0".into()),
            wayland_display: Some("wayland-0".into()),
            webkit_disable_dmabuf_renderer: None,
            nv_disable_explicit_sync: None,
            app_display_backend_preference: None,
        };

        assert_eq!(
            resolve_active_linux_display_backend(&environment),
            Some(LinuxDisplayBackend::Wayland)
        );
    }

    #[test]
    fn auto_prefers_x11_when_nvidia_wayland_has_xwayland_available() {
        let environment = LinuxGraphicsEnvironmentSnapshot {
            gdk_backend: None,
            xdg_session_type: Some("wayland".into()),
            display: Some(":0".into()),
            wayland_display: Some("wayland-0".into()),
            webkit_disable_dmabuf_renderer: None,
            nv_disable_explicit_sync: None,
            app_display_backend_preference: None,
        };

        assert_eq!(
            resolve_linux_display_backend_selection(
                &environment,
                LinuxDisplayBackendPreference::Auto,
                true,
            ),
            LinuxDisplayBackendSelection {
                backend: Some(LinuxDisplayBackend::X11),
                reason: LinuxDisplayBackendSelectionReason::AutoNvidiaX11Fallback,
                auto_x11_fallback_active: true,
            }
        );
    }

    #[test]
    fn preferred_wayland_falls_back_to_x11_when_only_x11_is_available() {
        let environment = LinuxGraphicsEnvironmentSnapshot {
            gdk_backend: None,
            xdg_session_type: Some("x11".into()),
            display: Some(":0".into()),
            wayland_display: None,
            webkit_disable_dmabuf_renderer: None,
            nv_disable_explicit_sync: None,
            app_display_backend_preference: None,
        };

        assert_eq!(
            resolve_linux_display_backend_selection(
                &environment,
                LinuxDisplayBackendPreference::Wayland,
                false,
            ),
            LinuxDisplayBackendSelection {
                backend: Some(LinuxDisplayBackend::X11),
                reason: LinuxDisplayBackendSelectionReason::AvailabilityFallback,
                auto_x11_fallback_active: false,
            }
        );
    }

    #[test]
    fn resolves_x11_workaround_for_nvidia_sessions() {
        let environment = LinuxGraphicsEnvironmentSnapshot {
            gdk_backend: Some("x11".into()),
            xdg_session_type: Some("x11".into()),
            display: Some(":0".into()),
            wayland_display: None,
            webkit_disable_dmabuf_renderer: None,
            nv_disable_explicit_sync: None,
            app_display_backend_preference: None,
        };

        assert_eq!(
            resolve_linux_webkit_nvidia_workaround(
                &environment,
                Some(LinuxDisplayBackend::X11),
                true,
            ),
            Some(LinuxWebkitNvidiaWorkaroundPlan {
                disable_dmabuf_renderer: true,
                disable_nv_explicit_sync: false,
            })
        );
    }

    #[test]
    fn resolves_wayland_workaround_for_nvidia_sessions() {
        let environment = LinuxGraphicsEnvironmentSnapshot {
            gdk_backend: Some("wayland".into()),
            xdg_session_type: Some("wayland".into()),
            display: Some(":0".into()),
            wayland_display: Some("wayland-0".into()),
            webkit_disable_dmabuf_renderer: None,
            nv_disable_explicit_sync: None,
            app_display_backend_preference: None,
        };

        assert_eq!(
            resolve_linux_webkit_nvidia_workaround(
                &environment,
                Some(LinuxDisplayBackend::Wayland),
                true,
            ),
            Some(LinuxWebkitNvidiaWorkaroundPlan {
                disable_dmabuf_renderer: true,
                disable_nv_explicit_sync: true,
            })
        );
    }

    #[test]
    fn respects_existing_wayland_overrides_individually() {
        let environment = LinuxGraphicsEnvironmentSnapshot {
            gdk_backend: Some("wayland".into()),
            xdg_session_type: Some("wayland".into()),
            display: None,
            wayland_display: Some("wayland-0".into()),
            webkit_disable_dmabuf_renderer: Some("1".into()),
            nv_disable_explicit_sync: None,
            app_display_backend_preference: None,
        };

        assert_eq!(
            resolve_linux_webkit_nvidia_workaround(
                &environment,
                Some(LinuxDisplayBackend::Wayland),
                true,
            ),
            Some(LinuxWebkitNvidiaWorkaroundPlan {
                disable_dmabuf_renderer: false,
                disable_nv_explicit_sync: true,
            })
        );
    }

    #[test]
    fn reads_legacy_startup_preferences_when_primary_file_is_missing() {
        let fixture = tempdir().expect("tempdir");
        let legacy_preferences_path = legacy_startup_preferences_path_from_config_root(fixture.path());
        fs::create_dir_all(legacy_preferences_path.parent().expect("legacy parent"))
            .expect("legacy preferences parent");
        fs::write(
            &legacy_preferences_path,
            "{\n  \"linuxDisplayBackendPreference\": \"x11\"\n}\n",
        )
        .expect("legacy preferences");

        let preferences = load_startup_preferences_from_config_root(Some(fixture.path()));

        assert_eq!(
            preferences.linux_display_backend_preference,
            LinuxDisplayBackendPreference::X11
        );
    }

    #[test]
    fn detects_primary_nvidia_gpu_from_sysfs() {
        let fixture = tempdir().expect("tempdir");
        write_trimmed_fixture(fixture.path(), "card1/device/vendor", NVIDIA_VENDOR_ID);
        write_trimmed_fixture(fixture.path(), "card1/device/boot_vga", "1\n");

        assert!(linux_primary_gpu_is_nvidia(fixture.path()));
    }

    #[test]
    fn falls_back_to_nvidia_kernel_module_detection() {
        let drm_fixture = tempdir().expect("drm tempdir");
        let sys_module_fixture = tempdir().expect("sys_module tempdir");
        let module_root = PathBuf::from(sys_module_fixture.path());
        fs::create_dir_all(module_root.join("nvidia")).expect("module fixture");

        assert!(linux_nvidia_gpu_detected(
            drm_fixture.path(),
            sys_module_fixture.path()
        ));
    }
}
