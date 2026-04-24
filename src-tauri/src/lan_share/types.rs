// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::collections::BTreeMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::sync::{Mutex, RwLock};

pub(super) const MDNS_SERVICE_TYPE: &str = "_http._tcp.local.";
pub(super) const MDNS_HOSTNAME: &str = "sfm.local.";
pub(super) const MDNS_DOMAIN: &str = "sfm.local";
pub(super) const MDNS_INSTANCE_NAME: &str = "Sigma File Manager";
pub(super) const HTTP_DEFAULT_PORT: u16 = 80;
pub(super) const HTTPS_DEFAULT_PORT: u16 = 443;
pub(super) const PORT_RANGE_START: u16 = 55000;
pub(super) const PORT_RANGE_END: u16 = 55999;
pub(super) const FTP_MAX_UPLOAD_BYTES: usize = 512 * 1024 * 1024;

pub(super) static FTP_HTML: &str = include_str!("../../assets/lan_share/lan_share_ftp.html");
pub(super) static STREAM_HTML: &str = include_str!("../../assets/lan_share/lan_share_stream.html");
pub(super) static APP_ICON_PNG: &[u8] = include_bytes!("../../icons/128x128.png");
pub(super) static APPLE_TOUCH_ICON_PNG: &[u8] = include_bytes!("../../icons/128x128@2x.png");

#[derive(Clone)]
pub(super) struct ShareState {
    pub(super) app_handle: AppHandle,
    pub(super) share_path: PathBuf,
    pub(super) file_hub: Option<Vec<PathBuf>>,
}

pub(super) struct ActiveServer {
    pub(super) http_shutdown: tokio::sync::watch::Sender<bool>,
    pub(super) http_task: tokio::task::JoinHandle<()>,
    pub(super) https_handle: Option<axum_server::Handle<SocketAddr>>,
    pub(super) https_task: Option<tokio::task::JoinHandle<()>>,
    pub(super) mdns_daemon: Option<mdns_sd::ServiceDaemon>,
}

pub(super) static ACTIVE_SERVER: once_cell::sync::Lazy<Arc<Mutex<Option<ActiveServer>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobileThemePaletteSnapshot {
    pub app_background: String,
    pub app_background_alt: String,
    pub shell_background: String,
    pub top_bar_background: String,
    pub panel_background: String,
    pub input_background: String,
    pub text_primary: String,
    pub text_muted: String,
    pub border: String,
    pub border_strong: String,
    pub accent: String,
    pub accent_strong: String,
    pub accent_soft: String,
}

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobileThemeMetricsSnapshot {
    pub control_radius: f64,
    pub panel_radius: f64,
    pub page_padding: f64,
    pub panel_gap: f64,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum MobileLayoutViewMode {
    IconsL,
    IconsM,
    IconsS,
    List,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum MobileLayoutSortBy {
    Name,
    Date,
    Size,
    Type,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum MobileLayoutSortOrder {
    Asc,
    Desc,
}

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobileThemeLayoutSnapshot {
    pub view_mode: MobileLayoutViewMode,
    pub grid_zoom: f64,
    pub show_hidden_files: bool,
    pub sort_by: MobileLayoutSortBy,
    pub sort_order: MobileLayoutSortOrder,
    pub directories_first: bool,
    pub show_tab_labels: bool,
}

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobileIconThemeSnapshot {
    pub id: String,
    pub name: String,
    pub file: String,
    pub folder: String,
    pub folder_expanded: String,
    pub icon_definitions: BTreeMap<String, String>,
    pub file_extensions: BTreeMap<String, String>,
    pub file_names: BTreeMap<String, String>,
    pub folder_names: BTreeMap<String, String>,
    pub folder_names_expanded: BTreeMap<String, String>,
    pub ui_icons: BTreeMap<String, String>,
}

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobileFolderIconRuleSnapshot {
    pub id: String,
    pub label: String,
    pub matchers: Vec<String>,
    pub icon: String,
}

#[derive(Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MobileThemeSnapshot {
    pub theme_id: String,
    pub theme_name: String,
    pub ui_font_family: String,
    pub mono_font_family: String,
    pub palette: MobileThemePaletteSnapshot,
    pub metrics: MobileThemeMetricsSnapshot,
    pub shadow: String,
    pub icon_theme: MobileIconThemeSnapshot,
    pub folder_icon_rules: Vec<MobileFolderIconRuleSnapshot>,
    pub default_folder_icon: String,
    pub layout: MobileThemeLayoutSnapshot,
}

impl Default for MobileThemeSnapshot {
    fn default() -> Self {
        Self {
            theme_id: "operator".to_string(),
            theme_name: "Operator".to_string(),
            ui_font_family: "\"Avenir Next\", \"SF Pro Display\", \"Helvetica Neue\", sans-serif"
                .to_string(),
            mono_font_family: "\"JetBrains Mono\", \"Fira Code\", \"Cascadia Code\", monospace"
                .to_string(),
            palette: MobileThemePaletteSnapshot {
                app_background: "#07111a".to_string(),
                app_background_alt: "#04070b".to_string(),
                shell_background: "rgba(10, 18, 28, 0.9)".to_string(),
                top_bar_background: "#101010".to_string(),
                panel_background: "rgba(16, 28, 40, 0.96)".to_string(),
                input_background: "rgba(8, 15, 24, 0.86)".to_string(),
                text_primary: "#edf4ff".to_string(),
                text_muted: "rgba(218, 232, 247, 0.74)".to_string(),
                border: "rgba(121, 167, 216, 0.18)".to_string(),
                border_strong: "rgba(121, 167, 216, 0.32)".to_string(),
                accent: "#79d6ff".to_string(),
                accent_strong: "#4fb8ff".to_string(),
                accent_soft: "rgba(121, 214, 255, 0.12)".to_string(),
            },
            metrics: MobileThemeMetricsSnapshot {
                control_radius: 16.0,
                panel_radius: 24.0,
                page_padding: 16.0,
                panel_gap: 14.0,
            },
            shadow: "0 18px 48px rgba(0, 0, 0, 0.34)".to_string(),
            icon_theme: MobileIconThemeSnapshot {
                id: "greeblefs_icon_theme".to_string(),
                name: "GreebleFS Icon Theme".to_string(),
                file: "txt".to_string(),
                folder: "folder".to_string(),
                folder_expanded: "folder_open".to_string(),
                icon_definitions: BTreeMap::from([
                    ("txt".to_string(), "/icons/txt.svg".to_string()),
                    ("folder".to_string(), "/icons/folder.svg".to_string()),
                    (
                        "folder_open".to_string(),
                        "/icons/folder_open.svg".to_string(),
                    ),
                    ("image".to_string(), "/icons/image.svg".to_string()),
                    ("video".to_string(), "/icons/video.svg".to_string()),
                    ("audio".to_string(), "/icons/audio.svg".to_string()),
                    ("pdf".to_string(), "/icons/pdf.svg".to_string()),
                    ("archive".to_string(), "/icons/archive.svg".to_string()),
                ]),
                file_extensions: BTreeMap::new(),
                file_names: BTreeMap::new(),
                folder_names: BTreeMap::new(),
                folder_names_expanded: BTreeMap::new(),
                ui_icons: BTreeMap::new(),
            },
            folder_icon_rules: Vec::new(),
            default_folder_icon: "folder".to_string(),
            layout: MobileThemeLayoutSnapshot {
                view_mode: MobileLayoutViewMode::IconsM,
                grid_zoom: 1.0,
                show_hidden_files: false,
                sort_by: MobileLayoutSortBy::Name,
                sort_order: MobileLayoutSortOrder::Asc,
                directories_first: true,
                show_tab_labels: true,
            },
        }
    }
}

pub(crate) static ACTIVE_MOBILE_THEME_SNAPSHOT: once_cell::sync::Lazy<
    Arc<RwLock<MobileThemeSnapshot>>,
> = once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(MobileThemeSnapshot::default())));

#[derive(Serialize, Deserialize, specta::Type)]
pub struct LanShareResult {
    pub address: String,
    pub preferred_address: String,
    pub mdns_address: Option<String>,
    pub ios_address: Option<String>,
    pub tailscale_address: Option<String>,
    pub tailscale_https_ready: bool,
}

#[derive(Serialize)]
pub(super) struct DirEntryInfo {
    pub(super) name: String,
    pub(super) is_dir: bool,
    pub(super) size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "fileId")]
    pub(super) file_id: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct ListQuery {
    pub(super) path: Option<String>,
}

#[derive(Deserialize)]
pub(super) struct UploadQuery {
    pub(super) path: Option<String>,
}
