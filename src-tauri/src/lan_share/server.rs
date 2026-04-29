// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::net::SocketAddr;
use std::path::PathBuf;

use tauri::AppHandle;

use super::handlers::{build_ftp_router, build_stream_dir_router, build_stream_router};
use super::mdns::{register_mdns, unregister_mdns};
use super::mobile::build_mobile_router;
use super::network::{
    find_available_port, format_host_port, format_http_url, format_https_url, get_local_ipv4,
};
use super::streaming::canonicalize_hub_paths;
use super::tls::generate_self_signed_tls;
use super::types::{
    ActiveServer, LanShareResult, ShareState, ACTIVE_SERVER, HTTPS_DEFAULT_PORT, HTTP_DEFAULT_PORT,
    MDNS_DOMAIN,
};
use crate::tailscale_commands::{generate_tailscale_tls, get_tailscale_share_target};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ShareRemoteAccessMode {
    Lan,
    Tailscale,
}

fn normalize_remote_access_mode(value: Option<&str>) -> ShareRemoteAccessMode {
    match value.map(str::trim) {
        Some("tailscale") => ShareRemoteAccessMode::Tailscale,
        _ => ShareRemoteAccessMode::Lan,
    }
}

pub async fn start_lan_share(
    app_handle: AppHandle,
    path: String,
    share_mode: String,
    hub_paths: Option<Vec<String>>,
    remote_access_mode: Option<String>,
) -> Result<LanShareResult, String> {
    stop_lan_share_inner().await?;

    let hub_paths = hub_paths.filter(|paths| paths.len() >= 2);
    let remote_access_mode = normalize_remote_access_mode(remote_access_mode.as_deref());

    let state = if let Some(paths) = hub_paths {
        if share_mode != "stream" && share_mode != "mobile" {
            return Err("Multi-file share requires stream or mobile mode".into());
        }
        let canonical = canonicalize_hub_paths(&paths)?;
        let share_path = canonical[0]
            .parent()
            .ok_or_else(|| "Invalid hub path".to_string())?
            .to_path_buf();
        ShareState {
            app_handle: app_handle.clone(),
            share_path,
            file_hub: Some(canonical),
        }
    } else {
        let share_path = PathBuf::from(&path);
        if !share_path.exists() {
            return Err("Path does not exist".into());
        }
        ShareState {
            app_handle: app_handle.clone(),
            share_path,
            file_hub: None,
        }
    };

    let local_ip = match get_local_ipv4() {
        Ok(ip) => Some(ip),
        Err(_error) if remote_access_mode == ShareRemoteAccessMode::Tailscale => None,
        Err(error) => return Err(error),
    };
    let http_port = find_available_port(HTTP_DEFAULT_PORT, &[])?;
    let tailscale_target = match remote_access_mode {
        ShareRemoteAccessMode::Tailscale => Some(get_tailscale_share_target()?),
        // Keep LAN startup sovereign so a Tailscale install or DNS/cert issue
        // cannot block local QR generation or route selection.
        ShareRemoteAccessMode::Lan => None,
    };

    let is_directory = state.share_path.is_dir();
    let router = match share_mode.as_str() {
        "stream" if state.file_hub.is_some() => build_stream_dir_router(state.clone()),
        "stream" if is_directory => build_stream_dir_router(state.clone()),
        "stream" => build_stream_router(state.clone()),
        "ftp" => build_ftp_router(state.clone()),
        "mobile" if state.file_hub.is_some() => build_mobile_router(state.clone()),
        "mobile" if is_directory => build_mobile_router(state.clone()),
        "mobile" => return Err("Mobile share requires a directory or a multi-file hub".to_string()),
        _ => return Err(format!("Unknown share mode: {share_mode}")),
    };

    let https_router = router.clone();

    let (http_shutdown_tx, mut http_shutdown_rx) = tokio::sync::watch::channel(false);
    let http_addr = SocketAddr::from(([0, 0, 0, 0], http_port));
    let http_listener = tokio::net::TcpListener::bind(http_addr)
        .await
        .map_err(|err| format!("Failed to bind HTTP port {http_port}: {err}"))?;

    let http_task = tokio::spawn(async move {
        axum::serve(http_listener, router)
            .with_graceful_shutdown(async move {
                while http_shutdown_rx.changed().await.is_ok() {
                    if *http_shutdown_rx.borrow() {
                        break;
                    }
                }
            })
            .await
            .ok();
    });

    let (
        https_handle,
        https_task,
        local_https_address,
        tailscale_https_address,
        tailscale_https_ready,
    ) = match find_available_port(HTTPS_DEFAULT_PORT, &[http_port]) {
        Ok(https_port) => {
            let tls_result = match (remote_access_mode, tailscale_target.as_ref(), local_ip) {
                (ShareRemoteAccessMode::Tailscale, Some(tailscale_target), _)
                    if tailscale_target.https_ready =>
                {
                    match tailscale_target.cert_domain.as_deref() {
                        Some(cert_domain) => generate_tailscale_tls(cert_domain).await,
                        None => Err(
                            "Tailscale HTTPS was selected, but no certificate domain is available."
                                .to_string(),
                        ),
                    }
                }
                (_, _, Some(local_ip)) => generate_self_signed_tls(local_ip).await,
                _ => Err(
                    "No HTTPS certificate could be generated for the active mobile share."
                        .to_string(),
                ),
            };

            match tls_result {
                Ok(tls_config) => {
                    let handle = axum_server::Handle::new();
                    let shutdown_handle = handle.clone();
                    let https_addr = SocketAddr::from(([0, 0, 0, 0], https_port));
                    let local_https_address = match (remote_access_mode, local_ip) {
                        (ShareRemoteAccessMode::Lan, Some(local_ip)) => {
                            Some(format_https_url(&local_ip.to_string(), https_port))
                        }
                        _ => None,
                    };
                    let tailscale_https_address = match tailscale_target.as_ref() {
                        Some(target) if target.https_ready => {
                            Some(format_https_url(&target.preferred_host, https_port))
                        }
                        _ => None,
                    };

                    let task = tokio::spawn(async move {
                        axum_server::bind_rustls(https_addr, tls_config)
                            .handle(handle)
                            .serve(https_router.into_make_service())
                            .await
                            .ok();
                    });

                    (
                        Some((shutdown_handle, https_port)),
                        Some(task),
                        local_https_address,
                        tailscale_https_address,
                        tailscale_target
                            .as_ref()
                            .map(|target| target.https_ready)
                            .unwrap_or(false),
                    )
                }
                Err(err) => {
                    log::warn!("TLS setup failed (HTTP still works): {err}");
                    (None, None, None, None, false)
                }
            }
        }
        Err(_) => (None, None, None, None, false),
    };

    let mdns_daemon = match local_ip {
        Some(local_ip) => match register_mdns(http_port, local_ip) {
            Ok(daemon) => Some(daemon),
            Err(err) => {
                log::warn!("mDNS registration failed (sharing still works via IP): {err}");
                None
            }
        },
        None => None,
    };

    let has_mdns = mdns_daemon.is_some();

    let mdns_address = if has_mdns {
        Some(format_host_port(MDNS_DOMAIN, http_port))
    } else {
        None
    };

    let ios_address = match (remote_access_mode, &https_handle, has_mdns, local_ip) {
        (ShareRemoteAccessMode::Lan, Some((_, https_port)), true, _) => {
            Some(format_https_url(MDNS_DOMAIN, *https_port))
        }
        (ShareRemoteAccessMode::Lan, Some((_, https_port)), false, Some(local_ip)) => {
            Some(format_https_url(&local_ip.to_string(), *https_port))
        }
        _ => local_https_address,
    };

    let tailscale_address = if let Some(https_address) = tailscale_https_address {
        Some(https_address)
    } else {
        tailscale_target
            .as_ref()
            .map(|target| format_http_url(&target.preferred_host, http_port))
    };

    let mut server_lock = ACTIVE_SERVER.lock().await;
    *server_lock = Some(ActiveServer {
        http_shutdown: http_shutdown_tx,
        http_task,
        https_handle: https_handle.map(|(handle, _)| handle),
        https_task,
        mdns_daemon,
        share_path: state.share_path.clone(),
        file_hub: state.file_hub.clone(),
    });

    let address = match local_ip {
        Some(local_ip) => format_http_url(&local_ip.to_string(), http_port),
        None => tailscale_address
            .clone()
            .unwrap_or_else(|| format_http_url("127.0.0.1", http_port)),
    };
    let preferred_address = match remote_access_mode {
        ShareRemoteAccessMode::Tailscale => tailscale_address
            .clone()
            .or_else(|| ios_address.clone())
            .or_else(|| {
                mdns_address
                    .clone()
                    .map(|host| format_http_url(&host, HTTP_DEFAULT_PORT))
            })
            .unwrap_or_else(|| address.clone()),
        ShareRemoteAccessMode::Lan => ios_address
            .clone()
            .or_else(|| {
                mdns_address
                    .clone()
                    .map(|host| format_http_url(&host, HTTP_DEFAULT_PORT))
            })
            .unwrap_or_else(|| address.clone()),
    };

    Ok(LanShareResult {
        address,
        preferred_address,
        mdns_address,
        ios_address,
        tailscale_address,
        tailscale_https_ready,
    })
}

pub async fn stop_lan_share_inner() -> Result<(), String> {
    let mut server_lock = ACTIVE_SERVER.lock().await;
    if let Some(server) = server_lock.take() {
        let _ = server.http_shutdown.send(true);
        if let Some(handle) = server.https_handle {
            handle.graceful_shutdown(Some(std::time::Duration::from_secs(2)));
        }
        if let Some(ref daemon) = server.mdns_daemon {
            unregister_mdns(daemon);
        }
        let _ = server.http_task.await;
        if let Some(task) = server.https_task {
            let _ = task.await;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    Ok(())
}

pub fn get_local_ip() -> Result<String, String> {
    get_local_ipv4().map(|ip| ip.to_string())
}
