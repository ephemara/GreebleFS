use std::{
    env,
    fs,
    path::Path,
};

const NVIDIA_VENDOR_ID: &str = "0x10de";
const SYSFS_DRM_ROOT: &str = "/sys/class/drm";
const SYS_MODULE_ROOT: &str = "/sys/module";
const NVIDIA_MODULE_NAMES: [&str; 2] = ["nvidia", "nvidia_drm"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LinuxDisplayBackend {
    Wayland,
    X11,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct LinuxWebkitNvidiaWorkaroundPlan {
    disable_dmabuf_renderer: bool,
    disable_nv_explicit_sync: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LinuxGraphicsEnvironmentSnapshot {
    gdk_backend: Option<String>,
    xdg_session_type: Option<String>,
    display: Option<String>,
    wayland_display: Option<String>,
    webkit_disable_dmabuf_renderer: Option<String>,
    nv_disable_explicit_sync: Option<String>,
}

impl LinuxGraphicsEnvironmentSnapshot {
    fn from_process_environment() -> Self {
        Self {
            gdk_backend: read_trimmed_env_var("GDK_BACKEND"),
            xdg_session_type: read_trimmed_env_var("XDG_SESSION_TYPE").map(|value| value.to_ascii_lowercase()),
            display: read_trimmed_env_var("DISPLAY"),
            wayland_display: read_trimmed_env_var("WAYLAND_DISPLAY"),
            webkit_disable_dmabuf_renderer: read_trimmed_env_var("WEBKIT_DISABLE_DMABUF_RENDERER"),
            nv_disable_explicit_sync: read_trimmed_env_var("__NV_DISABLE_EXPLICIT_SYNC"),
        }
    }
}

fn read_trimmed_env_var(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn resolve_linux_display_backend(
    environment: &LinuxGraphicsEnvironmentSnapshot,
) -> Option<LinuxDisplayBackend> {
    if let Some(gdk_backend) = environment.gdk_backend.as_deref() {
        for backend in gdk_backend.split(',').map(|value| value.trim().to_ascii_lowercase()) {
            match backend.as_str() {
                "wayland" => return Some(LinuxDisplayBackend::Wayland),
                "x11" => return Some(LinuxDisplayBackend::X11),
                _ => {}
            }
        }
    }

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

fn resolve_linux_webkit_nvidia_workaround(
    environment: &LinuxGraphicsEnvironmentSnapshot,
    nvidia_gpu_detected: bool,
) -> Option<LinuxWebkitNvidiaWorkaroundPlan> {
    if !nvidia_gpu_detected {
        return None;
    }

    match resolve_linux_display_backend(environment) {
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

fn read_trimmed_file(path: &Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
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
pub(crate) fn apply_linux_webkit_nvidia_workaround() {
    let environment = LinuxGraphicsEnvironmentSnapshot::from_process_environment();
    let nvidia_gpu_detected =
        linux_nvidia_gpu_detected(Path::new(SYSFS_DRM_ROOT), Path::new(SYS_MODULE_ROOT));

    match resolve_linux_webkit_nvidia_workaround(&environment, nvidia_gpu_detected) {
        Some(plan) => {
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
        None => {}
    }
}

#[cfg(not(target_os = "linux"))]
pub(crate) fn apply_linux_webkit_nvidia_workaround() {}

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
        };

        assert_eq!(
            resolve_linux_display_backend(&environment),
            Some(LinuxDisplayBackend::Wayland)
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
        };

        assert_eq!(
            resolve_linux_webkit_nvidia_workaround(&environment, true),
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
        };

        assert_eq!(
            resolve_linux_webkit_nvidia_workaround(&environment, true),
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
        };

        assert_eq!(
            resolve_linux_webkit_nvidia_workaround(&environment, true),
            Some(LinuxWebkitNvidiaWorkaroundPlan {
                disable_dmabuf_renderer: false,
                disable_nv_explicit_sync: true,
            })
        );
    }

    #[test]
    fn returns_none_when_all_wayland_overrides_are_already_present() {
        let environment = LinuxGraphicsEnvironmentSnapshot {
            gdk_backend: Some("wayland".into()),
            xdg_session_type: Some("wayland".into()),
            display: None,
            wayland_display: Some("wayland-0".into()),
            webkit_disable_dmabuf_renderer: Some("1".into()),
            nv_disable_explicit_sync: Some("1".into()),
        };

        assert_eq!(
            resolve_linux_webkit_nvidia_workaround(&environment, true),
            None
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

        assert!(linux_nvidia_gpu_detected(drm_fixture.path(), sys_module_fixture.path()));
    }
}
