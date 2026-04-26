use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DriveClassification {
    System,
    Home,
    External,
    Network,
    Optical,
    Virtual,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub id: String,
    pub path: String,
    pub label: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub classification: DriveClassification,
    pub volume_id: String,
    pub file_system_type: Option<String>,
    pub is_removable: bool,
    pub is_network: bool,
    pub is_read_only: bool,
    pub supports_scan: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg(target_os = "linux")]
struct LinuxMountInfo {
    mount_id: u64,
    parent_id: u64,
    major: u32,
    minor: u32,
    source: String,
    mount_point: PathBuf,
    file_system_type: String,
    mount_options: Vec<String>,
    super_options: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[cfg(target_os = "linux")]
struct LinuxUDisksMetadata {
    file_system_type: Option<String>,
    label: Option<String>,
    is_read_only: Option<bool>,
    is_removable: Option<bool>,
    hint_system: Option<bool>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[cfg(target_os = "macos")]
struct MacDiskInfoMetadata {
    volume_name: Option<String>,
    file_system_type: Option<String>,
    read_only: Option<bool>,
    removable: Option<bool>,
    ejectable: Option<bool>,
    internal: Option<bool>,
    protocol: Option<String>,
}

pub fn list_local_volumes() -> Result<Vec<DriveInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        return list_windows_volumes();
    }

    #[cfg(target_os = "linux")]
    {
        return list_linux_volumes();
    }

    #[cfg(target_os = "macos")]
    {
        return list_macos_volumes();
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        Ok(vec![fallback_root_drive_info()])
    }
}

pub fn is_same_volume(root: &Path, candidate: &Path) -> bool {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        return unix_device_id(root)
            .zip(unix_device_id(candidate))
            .is_some_and(|(left, right)| left == right);
    }

    #[cfg(target_os = "windows")]
    {
        return windows_volume_root(root)
            .zip(windows_volume_root(candidate))
            .is_some_and(|(left, right)| left.eq_ignore_ascii_case(&right));
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        root == candidate
    }
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn unix_drive_capacity(path: &Path) -> (u64, u64) {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let Ok(path_bytes) = CString::new(path.as_os_str().as_bytes()) else {
        return (0, 0);
    };

    let mut stats = unsafe { std::mem::zeroed::<libc::statvfs>() };
    let status = unsafe { libc::statvfs(path_bytes.as_ptr(), &mut stats) };
    if status != 0 {
        return (0, 0);
    }

    let block_size = stats.f_bsize as u64;
    let total_bytes = (stats.f_blocks as u64).saturating_mul(block_size);
    let free_bytes = (stats.f_bavail as u64).saturating_mul(block_size);
    (total_bytes, free_bytes)
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn unix_device_id(path: &Path) -> Option<u64> {
    use std::os::unix::fs::MetadataExt;

    std::fs::metadata(path).ok().map(|metadata| metadata.dev())
}

#[cfg(target_os = "linux")]
fn list_linux_volumes() -> Result<Vec<DriveInfo>, String> {
    let mountinfo = std::fs::read_to_string("/proc/self/mountinfo")
        .map_err(|error| format!("Failed to read /proc/self/mountinfo: {error}"))?;
    let mounts = parse_linux_mountinfo(&mountinfo);
    let home_dir = dirs::home_dir();
    let home_dir_path = home_dir.as_deref();
    let mut seen_paths = HashSet::new();
    let mut drives = Vec::new();

    for mount in mounts {
        let mount_path_string = mount.mount_point.to_string_lossy().to_string();
        if mount_path_string.is_empty() || !mount.mount_point.is_dir() {
            continue;
        }

        let is_root = mount.mount_point == Path::new("/");
        let is_home_mount = home_dir_path.is_some_and(|home| home == mount.mount_point);
        if !is_root && !is_home_mount && !should_surface_linux_mount(&mount) {
            continue;
        }

        if !seen_paths.insert(mount_path_string.clone()) {
            continue;
        }
        drives.push(build_linux_drive_info(&mount, home_dir_path));
    }

    if let Some(home) = home_dir_path {
        if home.is_dir() {
            let home_path = home.to_string_lossy().to_string();
            if seen_paths.insert(home_path.clone()) {
                drives.push(build_unix_home_alias(home));
            }
        }
    }

    sort_drive_infos(&mut drives);
    Ok(drives)
}

#[cfg(target_os = "linux")]
fn build_linux_drive_info(mount: &LinuxMountInfo, home_dir: Option<&Path>) -> DriveInfo {
    let metadata = linux_query_udisks_metadata(&mount.source);
    let mount_path = mount.mount_point.to_string_lossy().to_string();
    let volume_id = format!("linux:{}:{}", mount.major, mount.minor);
    let is_network = linux_is_network_filesystem(&mount.file_system_type)
        || linux_is_network_source(&mount.source);
    let is_optical = linux_is_optical_mount(mount);
    let removable_hint = metadata
        .as_ref()
        .and_then(|value| value.is_removable)
        .or_else(|| linux_sysfs_removable_flag(&mount.source))
        .unwrap_or(false);
    let is_removable = removable_hint
        || (!is_network && mount_path != "/" && is_external_mount_path(&mount.mount_point));
    let is_read_only = metadata
        .as_ref()
        .and_then(|value| value.is_read_only)
        .unwrap_or_else(|| mount.mount_options.iter().any(|option| option == "ro"));
    let file_system_type = metadata
        .as_ref()
        .and_then(|value| value.file_system_type.clone())
        .or_else(|| Some(mount.file_system_type.clone()));
    let classification = if home_dir.is_some_and(|home| home == mount.mount_point) {
        DriveClassification::Home
    } else if is_network {
        DriveClassification::Network
    } else if is_optical {
        DriveClassification::Optical
    } else if is_removable || is_external_mount_path(&mount.mount_point) {
        DriveClassification::External
    } else if mount_path == "/" || mount.source.starts_with("/dev/") {
        DriveClassification::System
    } else if metadata.as_ref().and_then(|value| value.hint_system) == Some(false) {
        DriveClassification::External
    } else {
        DriveClassification::Virtual
    };
    let label = if mount_path == "/" {
        "Root".to_string()
    } else if home_dir.is_some_and(|home| home == mount.mount_point) {
        "Home".to_string()
    } else {
        metadata
            .as_ref()
            .and_then(|value| value.label.clone())
            .or_else(|| {
                mount
                    .mount_point
                    .file_name()
                    .and_then(OsStr::to_str)
                    .map(|value| value.to_string())
            })
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| mount_path.clone())
    };
    let (total_bytes, free_bytes) = unix_drive_capacity(&mount.mount_point);

    DriveInfo {
        id: format!("local:{volume_id}:{mount_path}"),
        path: mount_path,
        label,
        total_bytes,
        free_bytes,
        classification,
        volume_id,
        file_system_type,
        is_removable,
        is_network,
        is_read_only,
        supports_scan: mount.mount_point.is_dir(),
    }
}

#[cfg(target_os = "linux")]
fn should_surface_linux_mount(mount: &LinuxMountInfo) -> bool {
    let mount_path = mount.mount_point.to_string_lossy();
    if mount_path.starts_with("/proc")
        || mount_path.starts_with("/sys")
        || mount_path.starts_with("/dev")
        || mount_path.starts_with("/run/user")
        || mount_path.starts_with("/snap")
    {
        return false;
    }
    if linux_is_pseudo_filesystem(&mount.file_system_type) {
        return false;
    }
    if linux_is_network_filesystem(&mount.file_system_type)
        || linux_is_network_source(&mount.source)
    {
        return true;
    }
    if is_external_mount_path(&mount.mount_point) {
        return true;
    }
    mount.source.starts_with("/dev/")
}

#[cfg(target_os = "linux")]
fn linux_is_pseudo_filesystem(file_system_type: &str) -> bool {
    matches!(
        file_system_type,
        "autofs"
            | "bpf"
            | "cgroup"
            | "cgroup2"
            | "configfs"
            | "debugfs"
            | "devpts"
            | "devtmpfs"
            | "efivarfs"
            | "fusectl"
            | "hugetlbfs"
            | "mqueue"
            | "overlay"
            | "proc"
            | "pstore"
            | "ramfs"
            | "securityfs"
            | "selinuxfs"
            | "squashfs"
            | "sysfs"
            | "tmpfs"
            | "tracefs"
    )
}

#[cfg(target_os = "linux")]
fn linux_is_network_filesystem(file_system_type: &str) -> bool {
    matches!(
        file_system_type,
        "9p" | "afpfs"
            | "cifs"
            | "davfs"
            | "davfs2"
            | "fuse.rclone"
            | "fuse.sshfs"
            | "gvfsd-fuse"
            | "nfs"
            | "nfs4"
            | "smb3"
            | "smbfs"
            | "sshfs"
            | "webdav"
    )
}

#[cfg(target_os = "linux")]
fn linux_is_network_source(source: &str) -> bool {
    source.starts_with("//")
        || source.starts_with("\\\\")
        || source.contains(":/")
        || source.starts_with("smb://")
        || source.starts_with("afp://")
        || source.starts_with("dav://")
        || source.starts_with("sshfs#")
}

#[cfg(target_os = "linux")]
fn linux_is_optical_mount(mount: &LinuxMountInfo) -> bool {
    mount.file_system_type == "iso9660"
        || mount.file_system_type == "udf"
        || mount.source.starts_with("/dev/sr")
        || mount.source.starts_with("/dev/cd")
}

#[cfg(target_os = "linux")]
fn linux_sysfs_removable_flag(device_path: &str) -> Option<bool> {
    let block_device_name = linux_block_device_name(device_path)?;
    let sysfs_path = Path::new("/sys/block")
        .join(block_device_name)
        .join("removable");
    match std::fs::read_to_string(sysfs_path).ok()?.trim() {
        "0" => Some(false),
        "1" => Some(true),
        _ => None,
    }
}

#[cfg(target_os = "linux")]
fn linux_block_device_name(device_path: &str) -> Option<String> {
    let name = device_path.strip_prefix("/dev/")?;
    if name.starts_with("mapper/") {
        return None;
    }

    let trimmed = if let Some(value) = name.strip_prefix("nvme") {
        let suffix = value.rsplit_once('p')?;
        format!("nvme{}", suffix.0)
    } else if let Some(value) = name.strip_prefix("mmcblk") {
        let suffix = value.rsplit_once('p')?;
        format!("mmcblk{}", suffix.0)
    } else {
        name.trim_end_matches(char::is_numeric).to_string()
    };

    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

#[cfg(target_os = "linux")]
fn linux_query_udisks_metadata(device_path: &str) -> Option<LinuxUDisksMetadata> {
    if !device_path.starts_with("/dev/") {
        return None;
    }
    let output = Command::new("udisksctl")
        .args(["info", "-b", device_path])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8(output.stdout).ok()?;
    let mut metadata = LinuxUDisksMetadata::default();
    for line in stdout.lines() {
        let trimmed = line.trim();
        let Some((key, value)) = trimmed.split_once(':') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        match key {
            "IdLabel" => {
                if !value.is_empty() {
                    metadata.label = Some(value.to_string());
                }
            }
            "IdType" => {
                if !value.is_empty() {
                    metadata.file_system_type = Some(value.to_string());
                }
            }
            "ReadOnly" => metadata.is_read_only = parse_bool_token(value),
            "HintSystem" => metadata.hint_system = parse_bool_token(value),
            "Drive.Removable" | "Drive.MediaRemovable" => {
                metadata.is_removable = parse_bool_token(value).or(metadata.is_removable);
            }
            _ => {}
        }
    }
    Some(metadata)
}

#[cfg(target_os = "linux")]
fn parse_linux_mountinfo(contents: &str) -> Vec<LinuxMountInfo> {
    contents
        .lines()
        .filter_map(parse_linux_mountinfo_line)
        .collect()
}

#[cfg(target_os = "linux")]
fn parse_linux_mountinfo_line(line: &str) -> Option<LinuxMountInfo> {
    let (left, right) = line.split_once(" - ")?;
    let left_parts = left.split_whitespace().collect::<Vec<_>>();
    if left_parts.len() < 6 {
        return None;
    }
    let right_parts = right.split_whitespace().collect::<Vec<_>>();
    if right_parts.len() < 3 {
        return None;
    }
    let (major, minor) = left_parts[2].split_once(':')?;
    let mount_id = left_parts[0].parse::<u64>().ok()?;
    let parent_id = left_parts[1].parse::<u64>().ok()?;
    let major = major.parse::<u32>().ok()?;
    let minor = minor.parse::<u32>().ok()?;
    let mount_point = PathBuf::from(unmangle_mount_escape(left_parts[4]));
    let mount_options = left_parts[5]
        .split(',')
        .map(str::to_string)
        .collect::<Vec<_>>();
    let file_system_type = unmangle_mount_escape(right_parts[0]);
    let source = unmangle_mount_escape(right_parts[1]);
    let super_options = right_parts[2]
        .split(',')
        .map(str::to_string)
        .collect::<Vec<_>>();
    Some(LinuxMountInfo {
        mount_id,
        parent_id,
        major,
        minor,
        source,
        mount_point,
        file_system_type,
        mount_options,
        super_options,
    })
}

#[cfg(target_os = "linux")]
fn unmangle_mount_escape(value: &str) -> String {
    value
        .replace(r"\011", "\t")
        .replace(r"\012", "\n")
        .replace(r"\040", " ")
        .replace(r"\043", "#")
        .replace(r"\134", "\\")
}

#[cfg(target_os = "macos")]
fn list_macos_volumes() -> Result<Vec<DriveInfo>, String> {
    use std::ffi::CStr;

    let mut mounts_ptr: *mut libc::statfs = std::ptr::null_mut();
    let mount_count = unsafe { libc::getmntinfo(&mut mounts_ptr, libc::MNT_NOWAIT) };
    if mount_count <= 0 {
        return Ok(vec![fallback_root_drive_info()]);
    }

    let home_dir = dirs::home_dir();
    let home_dir_path = home_dir.as_deref();
    let mut seen_paths = HashSet::new();
    let mut drives = Vec::new();

    for index in 0..mount_count as usize {
        let mount = unsafe { &*mounts_ptr.add(index) };
        let mount_path = unsafe { CStr::from_ptr(mount.f_mntonname.as_ptr()) }
            .to_string_lossy()
            .to_string();
        if mount_path.is_empty() {
            continue;
        }
        let source = unsafe { CStr::from_ptr(mount.f_mntfromname.as_ptr()) }
            .to_string_lossy()
            .to_string();
        let file_system_type = unsafe { CStr::from_ptr(mount.f_fstypename.as_ptr()) }
            .to_string_lossy()
            .to_string();
        let mount_path_buf = PathBuf::from(&mount_path);
        if !mount_path_buf.is_dir() {
            continue;
        }

        let is_root = mount_path == "/";
        let is_home_mount = home_dir_path.is_some_and(|home| home == mount_path_buf);
        let is_network = macos_is_network_filesystem(&file_system_type) || source.starts_with("//");
        let is_surface_candidate =
            is_root || is_home_mount || is_network || is_external_mount_path(&mount_path_buf);
        if !is_surface_candidate {
            continue;
        }
        if !seen_paths.insert(mount_path.clone()) {
            continue;
        }

        let diskutil = macos_diskutil_info(&mount_path);
        let removable = diskutil
            .as_ref()
            .and_then(|value| value.removable.or(value.ejectable))
            .unwrap_or_else(|| {
                !is_root && !is_home_mount && !is_network && mount_path.starts_with("/Volumes/")
            });
        let read_only = diskutil
            .as_ref()
            .and_then(|value| value.read_only)
            .unwrap_or_else(|| mount.f_flags & libc::MNT_RDONLY != 0);
        let classification = if is_home_mount {
            DriveClassification::Home
        } else if is_network {
            DriveClassification::Network
        } else if removable {
            DriveClassification::External
        } else if is_root {
            DriveClassification::System
        } else {
            DriveClassification::Unknown
        };
        let label = if is_root {
            "Root".to_string()
        } else if is_home_mount {
            "Home".to_string()
        } else {
            diskutil
                .as_ref()
                .and_then(|value| value.volume_name.clone())
                .or_else(|| {
                    mount_path_buf
                        .file_name()
                        .and_then(OsStr::to_str)
                        .map(str::to_string)
                })
                .unwrap_or_else(|| mount_path.clone())
        };
        let (total_bytes, free_bytes) = unix_drive_capacity(&mount_path_buf);
        let volume_id = unix_device_id(&mount_path_buf)
            .map(|value| format!("macos:{value}"))
            .unwrap_or_else(|| format!("macos:{source}:{mount_path}"));

        drives.push(DriveInfo {
            id: format!("local:{volume_id}:{mount_path}"),
            path: mount_path,
            label,
            total_bytes,
            free_bytes,
            classification,
            volume_id,
            file_system_type: diskutil
                .as_ref()
                .and_then(|value| value.file_system_type.clone())
                .or_else(|| Some(file_system_type)),
            is_removable: removable,
            is_network,
            is_read_only: read_only,
            supports_scan: true,
        });
    }

    if let Some(home) = home_dir_path {
        if home.is_dir() {
            let home_path = home.to_string_lossy().to_string();
            if seen_paths.insert(home_path.clone()) {
                drives.push(build_unix_home_alias(home));
            }
        }
    }

    if drives.is_empty() {
        drives.push(fallback_root_drive_info());
    }
    sort_drive_infos(&mut drives);
    Ok(drives)
}

#[cfg(target_os = "macos")]
fn macos_is_network_filesystem(file_system_type: &str) -> bool {
    matches!(file_system_type, "afpfs" | "nfs" | "smbfs" | "webdav")
}

#[cfg(target_os = "macos")]
fn macos_diskutil_info(mount_path: &str) -> Option<MacDiskInfoMetadata> {
    let output = Command::new("diskutil")
        .args(["info", mount_path])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8(output.stdout).ok()?;
    let mut metadata = MacDiskInfoMetadata::default();
    for line in stdout.lines() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        match key {
            "Volume Name" => {
                if !value.is_empty() {
                    metadata.volume_name = Some(value.to_string());
                }
            }
            "File System Personality" => {
                if !value.is_empty() {
                    metadata.file_system_type = Some(value.to_string());
                }
            }
            "Read-Only Media" => metadata.read_only = parse_bool_token(value),
            "Removable Media" => metadata.removable = parse_bool_token(value),
            "Ejectable" => metadata.ejectable = parse_bool_token(value),
            "Device Location" => metadata.internal = parse_internal_token(value),
            "Protocol" => {
                if !value.is_empty() {
                    metadata.protocol = Some(value.to_string());
                }
            }
            _ => {}
        }
    }
    Some(metadata)
}

#[cfg(target_os = "windows")]
fn list_windows_volumes() -> Result<Vec<DriveInfo>, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows_sys::Win32::Storage::FileSystem::{
        GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDriveStringsW, GetVolumeInformationW,
        DRIVE_CDROM, DRIVE_FIXED, DRIVE_RAMDISK, DRIVE_REMOTE, DRIVE_REMOVABLE,
        FILE_READ_ONLY_VOLUME,
    };

    let mut buffer = vec![0u16; 512];
    let length = unsafe { GetLogicalDriveStringsW(buffer.len() as u32, buffer.as_mut_ptr()) };
    if length == 0 {
        return Err("Failed to enumerate Windows volumes.".to_string());
    }

    let mut drives = Vec::new();
    let mut start = 0;
    for index in 0..length as usize {
        if buffer[index] != 0 {
            continue;
        }
        if index <= start {
            start = index + 1;
            continue;
        }

        let drive_string = OsString::from_wide(&buffer[start..index])
            .to_string_lossy()
            .to_string();
        start = index + 1;
        if drive_string.is_empty() {
            continue;
        }

        let drive_root = drive_string;
        let drive_path = drive_root.trim_end_matches('\\').to_string();
        let drive_wide = drive_root
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect::<Vec<_>>();
        let mut total_bytes = 0_u64;
        let mut free_bytes = 0_u64;
        unsafe {
            GetDiskFreeSpaceExW(
                drive_wide.as_ptr(),
                std::ptr::null_mut(),
                &mut total_bytes,
                &mut free_bytes,
            );
        }

        let mut volume_name_buffer = vec![0u16; 256];
        let mut file_system_buffer = vec![0u16; 256];
        let mut volume_serial_number = 0_u32;
        let mut file_system_flags = 0_u32;
        unsafe {
            GetVolumeInformationW(
                drive_wide.as_ptr(),
                volume_name_buffer.as_mut_ptr(),
                volume_name_buffer.len() as u32,
                &mut volume_serial_number,
                std::ptr::null_mut(),
                &mut file_system_flags,
                file_system_buffer.as_mut_ptr(),
                file_system_buffer.len() as u32,
            );
        }

        let drive_type = unsafe { GetDriveTypeW(drive_wide.as_ptr()) };
        let classification = match drive_type {
            DRIVE_REMOTE => DriveClassification::Network,
            DRIVE_REMOVABLE => DriveClassification::External,
            DRIVE_CDROM => DriveClassification::Optical,
            DRIVE_FIXED | DRIVE_RAMDISK => DriveClassification::System,
            _ => DriveClassification::Unknown,
        };
        let label = utf16_buffer_to_string(&volume_name_buffer)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| drive_path.clone());
        let file_system_type =
            utf16_buffer_to_string(&file_system_buffer).filter(|value| !value.is_empty());
        let volume_id = format!("windows:{volume_serial_number:08X}");

        drives.push(DriveInfo {
            id: format!("local:{volume_id}:{drive_path}"),
            path: drive_path.clone(),
            label,
            total_bytes,
            free_bytes,
            classification,
            volume_id,
            file_system_type,
            is_removable: drive_type == DRIVE_REMOVABLE || drive_type == DRIVE_CDROM,
            is_network: drive_type == DRIVE_REMOTE,
            is_read_only: file_system_flags & FILE_READ_ONLY_VOLUME != 0,
            supports_scan: true,
        });
    }

    sort_drive_infos(&mut drives);
    Ok(drives)
}

#[cfg(target_os = "windows")]
fn utf16_buffer_to_string(buffer: &[u16]) -> Option<String> {
    let end = buffer.iter().position(|value| *value == 0)?;
    Some(
        std::ffi::OsString::from_wide(&buffer[..end])
            .to_string_lossy()
            .to_string(),
    )
}

#[cfg(target_os = "windows")]
fn windows_volume_root(path: &Path) -> Option<String> {
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use windows_sys::Win32::Storage::FileSystem::GetVolumePathNameW;

    let wide_path = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let mut buffer = vec![0u16; 512];
    let success =
        unsafe { GetVolumePathNameW(wide_path.as_ptr(), buffer.as_mut_ptr(), buffer.len() as u32) };
    if success == 0 {
        return None;
    }
    let end = buffer.iter().position(|value| *value == 0)?;
    Some(
        std::ffi::OsString::from_wide(&buffer[..end])
            .to_string_lossy()
            .to_string(),
    )
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn build_unix_home_alias(home_dir: &Path) -> DriveInfo {
    let (total_bytes, free_bytes) = unix_drive_capacity(home_dir);
    let volume_id = unix_device_id(home_dir)
        .map(|value| format!("unix:{value}"))
        .unwrap_or_else(|| format!("unix:{}", home_dir.to_string_lossy()));
    let path = home_dir.to_string_lossy().to_string();
    DriveInfo {
        id: format!("local:{volume_id}:{path}"),
        path,
        label: "Home".to_string(),
        total_bytes,
        free_bytes,
        classification: DriveClassification::Home,
        volume_id,
        file_system_type: None,
        is_removable: false,
        is_network: false,
        is_read_only: false,
        supports_scan: home_dir.is_dir(),
    }
}

fn fallback_root_drive_info() -> DriveInfo {
    DriveInfo {
        id: "local:fallback:/".to_string(),
        path: "/".to_string(),
        label: "Root".to_string(),
        total_bytes: 0,
        free_bytes: 0,
        classification: DriveClassification::System,
        volume_id: "fallback:/".to_string(),
        file_system_type: None,
        is_removable: false,
        is_network: false,
        is_read_only: false,
        supports_scan: true,
    }
}

fn is_external_mount_path(path: &Path) -> bool {
    path.starts_with("/run/media")
        || path.starts_with("/media")
        || path.starts_with("/mnt")
        || path.starts_with("/Volumes")
}

fn sort_drive_infos(drives: &mut [DriveInfo]) {
    drives.sort_by(|left, right| {
        drive_sort_rank(left.classification)
            .cmp(&drive_sort_rank(right.classification))
            .then_with(|| left.label.to_lowercase().cmp(&right.label.to_lowercase()))
            .then_with(|| left.path.cmp(&right.path))
    });
}

fn drive_sort_rank(classification: DriveClassification) -> u8 {
    match classification {
        DriveClassification::Home => 0,
        DriveClassification::System => 1,
        DriveClassification::External => 2,
        DriveClassification::Network => 3,
        DriveClassification::Optical => 4,
        DriveClassification::Virtual => 5,
        DriveClassification::Unknown => 6,
    }
}

fn parse_bool_token(value: &str) -> Option<bool> {
    match value.trim().to_ascii_lowercase().as_str() {
        "0" | "false" | "no" | "off" => Some(false),
        "1" | "true" | "yes" | "on" => Some(true),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
fn parse_internal_token(value: &str) -> Option<bool> {
    match value.trim().to_ascii_lowercase().as_str() {
        "internal" => Some(true),
        "external" => Some(false),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "linux")]
    #[test]
    fn parses_linux_mountinfo_entries() {
        let entries = parse_linux_mountinfo(
            "36 25 8:1 / / rw,relatime - ext4 /dev/nvme0n1p1 rw\n\
             61 36 8:17 / /run/media/alice/USB\\040Drive rw,nosuid,nodev - vfat /dev/sdb1 rw,uid=1000\n",
        );
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].mount_id, 36);
        assert_eq!(entries[0].parent_id, 25);
        assert_eq!(entries[0].major, 8);
        assert_eq!(entries[0].minor, 1);
        assert_eq!(entries[0].mount_point, PathBuf::from("/"));
        assert_eq!(entries[0].source, "/dev/nvme0n1p1");
        assert_eq!(entries[0].file_system_type, "ext4");
        assert_eq!(
            entries[1].mount_point,
            PathBuf::from("/run/media/alice/USB Drive")
        );
        assert_eq!(entries[1].source, "/dev/sdb1");
        assert_eq!(entries[1].file_system_type, "vfat");
    }

    #[test]
    fn drive_info_serializes_rich_fields() {
        let drive = DriveInfo {
            id: "local:test:/".to_string(),
            path: "/".to_string(),
            label: "Root".to_string(),
            total_bytes: 512,
            free_bytes: 128,
            classification: DriveClassification::System,
            volume_id: "unix:1".to_string(),
            file_system_type: Some("ext4".to_string()),
            is_removable: false,
            is_network: false,
            is_read_only: false,
            supports_scan: true,
        };
        let json = serde_json::to_string(&drive).expect("serialization should succeed");
        assert!(json.contains("\"classification\":\"system\""));
        assert!(json.contains("\"volumeId\":\"unix:1\""));
        assert!(json.contains("\"supportsScan\":true"));
    }
}
