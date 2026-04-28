use std::process::{Command, Output};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TailscaleStatusSnapshot {
    pub cli_available: bool,
    pub version: Option<String>,
    pub backend_state: Option<String>,
    pub connected: bool,
    pub running: bool,
    pub auth_url: Option<String>,
    pub hostname: Option<String>,
    pub dns_name: Option<String>,
    pub tailscale_ipv4: Option<String>,
    pub tailscale_ipv6: Option<String>,
    pub tailnet_name: Option<String>,
    pub tailnet_domain: Option<String>,
    pub magic_dns_enabled: bool,
    pub cert_domains: Vec<String>,
    pub cert_https_ready: bool,
    pub peer_count: usize,
    pub online_peer_count: usize,
    pub user_login_name: Option<String>,
    pub user_display_name: Option<String>,
    pub health_messages: Vec<String>,
    pub diagnostic_message: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TailscaleConnectRequest {
    pub hostname: Option<String>,
    pub login_server: Option<String>,
    pub auth_key: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TailscaleShareTarget {
    pub preferred_host: String,
    pub cert_domain: Option<String>,
    pub https_ready: bool,
}

#[command]
#[specta::specta]
pub async fn tailscale_get_status() -> Result<TailscaleStatusSnapshot, String> {
    Ok(get_tailscale_status_snapshot())
}

#[command]
#[specta::specta]
pub async fn tailscale_connect(
    request: TailscaleConnectRequest,
) -> Result<TailscaleStatusSnapshot, String> {
    let status_before = get_tailscale_status_snapshot();
    if !status_before.cli_available {
        return Err(status_before
            .diagnostic_message
            .unwrap_or_else(|| "Tailscale CLI is not installed or not on PATH.".to_string()));
    }

    let hostname = normalize_cli_string(request.hostname);
    let login_server = normalize_cli_string(request.login_server);
    let auth_key = normalize_cli_string(request.auth_key);

    if status_before.connected {
        if login_server.is_some() {
            return Err(
                "Switching to a custom Tailscale control server requires disconnecting this node first."
                    .to_string(),
            );
        }

        if let Some(hostname) = hostname {
            run_tailscale_command(
                "tailscale set",
                &["set".to_string(), format!("--hostname={hostname}")],
            )?;
        } else if auth_key.is_some() {
            return Err(
                "An auth key is only used while connecting a disconnected node.".to_string(),
            );
        }

        return Ok(get_tailscale_status_snapshot());
    }

    let mut args = Vec::new();
    let command_label;

    if let Some(auth_key) = auth_key {
        command_label = "tailscale up";
        args.push("up".to_string());
        args.push(format!("--auth-key={auth_key}"));
    } else {
        command_label = "tailscale login";
        args.push("login".to_string());
    }

    if let Some(hostname) = hostname {
        args.push(format!("--hostname={hostname}"));
    }

    if let Some(login_server) = login_server {
        args.push(format!("--login-server={login_server}"));
    }

    let output = run_tailscale_command(command_label, &args)?;
    let combined_output = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    let mut status_after = get_tailscale_status_snapshot();
    if status_after.auth_url.is_none() {
        status_after.auth_url = extract_auth_url_from_text(&combined_output);
    }

    Ok(status_after)
}

#[command]
#[specta::specta]
pub async fn tailscale_disconnect() -> Result<TailscaleStatusSnapshot, String> {
    let status_before = get_tailscale_status_snapshot();
    if !status_before.cli_available {
        return Err(status_before
            .diagnostic_message
            .unwrap_or_else(|| "Tailscale CLI is not installed or not on PATH.".to_string()));
    }

    run_tailscale_command("tailscale down", &["down".to_string()])?;
    Ok(get_tailscale_status_snapshot())
}

pub(crate) fn get_tailscale_share_target() -> Result<TailscaleShareTarget, String> {
    let status = get_tailscale_status_snapshot();
    if !status.cli_available {
        return Err(status
            .diagnostic_message
            .unwrap_or_else(|| "Tailscale CLI is not installed or not on PATH.".to_string()));
    }

    if !status.connected {
        return Err(
            status
                .diagnostic_message
                .unwrap_or_else(|| {
                    "Tailscale is not connected on this machine. Connect the node first from Settings > Mobile."
                        .to_string()
                }),
        );
    }

    let cert_domain = status.cert_domains.first().cloned();
    let preferred_host = get_tailscale_preferred_host(&status).ok_or_else(|| {
        "Tailscale is connected, but no reachable tailnet hostname or IP was found.".to_string()
    })?;

    Ok(TailscaleShareTarget {
        preferred_host,
        cert_domain: cert_domain.clone(),
        https_ready: cert_domain.is_some(),
    })
}

pub(crate) async fn generate_tailscale_tls(
    cert_domain: &str,
) -> Result<axum_server::tls_rustls::RustlsConfig, String> {
    let certificate_dir =
        std::env::temp_dir().join(format!("greeblefs-tailscale-cert-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&certificate_dir)
        .map_err(|error| format!("Failed to create Tailscale certificate temp dir: {error}"))?;

    let cert_path = certificate_dir.join("certificate.pem");
    let key_path = certificate_dir.join("certificate.key");

    let args = vec![
        "cert".to_string(),
        format!("--cert-file={}", cert_path.display()),
        format!("--key-file={}", key_path.display()),
        cert_domain.to_string(),
    ];

    let certificate_result = async {
        run_tailscale_command("tailscale cert", &args)?;

        let cert_pem = std::fs::read(&cert_path)
            .map_err(|error| format!("Failed to read generated Tailscale certificate: {error}"))?;
        let key_pem = std::fs::read(&key_path)
            .map_err(|error| format!("Failed to read generated Tailscale key: {error}"))?;

        axum_server::tls_rustls::RustlsConfig::from_pem(cert_pem, key_pem)
            .await
            .map_err(|error| format!("Failed to build Tailscale TLS config: {error}"))
    }
    .await;

    let _ = std::fs::remove_file(&cert_path);
    let _ = std::fs::remove_file(&key_path);
    let _ = std::fs::remove_dir(&certificate_dir);

    certificate_result
}

pub(crate) fn get_tailscale_status_snapshot() -> TailscaleStatusSnapshot {
    let mut snapshot = TailscaleStatusSnapshot {
        cli_available: false,
        version: None,
        backend_state: None,
        connected: false,
        running: false,
        auth_url: None,
        hostname: None,
        dns_name: None,
        tailscale_ipv4: None,
        tailscale_ipv6: None,
        tailnet_name: None,
        tailnet_domain: None,
        magic_dns_enabled: false,
        cert_domains: Vec::new(),
        cert_https_ready: false,
        peer_count: 0,
        online_peer_count: 0,
        user_login_name: None,
        user_display_name: None,
        health_messages: Vec::new(),
        diagnostic_message: None,
    };

    match run_tailscale_command(
        "tailscale version --json",
        &["version".to_string(), "--json".to_string()],
    ) {
        Ok(output) => {
            snapshot.cli_available = true;
            if let Ok(value) = serde_json::from_slice::<Value>(&output.stdout) {
                snapshot.version = get_string_field(&value, "short")
                    .or_else(|| get_string_field(&value, "majorMinorPatch"))
                    .or_else(|| get_string_field(&value, "long"));
            }
        }
        Err(error) => {
            snapshot.diagnostic_message = Some(error);
            return snapshot;
        }
    }

    match run_tailscale_command(
        "tailscale status --json",
        &["status".to_string(), "--json".to_string()],
    ) {
        Ok(output) => {
            let parsed = match serde_json::from_slice::<Value>(&output.stdout) {
                Ok(value) => value,
                Err(error) => {
                    snapshot.diagnostic_message =
                        Some(format!("Failed to parse tailscale status output: {error}"));
                    return snapshot;
                }
            };

            snapshot.backend_state = get_string_field(&parsed, "BackendState");
            snapshot.running = snapshot.backend_state.as_deref() == Some("Running");
            snapshot.auth_url = get_string_field(&parsed, "AuthURL");
            snapshot.tailscale_ipv4 = get_primary_ip(
                parsed.pointer("/Self/TailscaleIPs"),
                parsed.get("TailscaleIPs"),
                false,
            );
            snapshot.tailscale_ipv6 = get_primary_ip(
                parsed.pointer("/Self/TailscaleIPs"),
                parsed.get("TailscaleIPs"),
                true,
            );
            snapshot.hostname = parsed
                .pointer("/Self/HostName")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            snapshot.dns_name = parsed
                .pointer("/Self/DNSName")
                .and_then(Value::as_str)
                .map(trim_dns_name);
            snapshot.cert_domains = get_string_array_field(&parsed, "CertDomains")
                .into_iter()
                .map(trim_dns_name)
                .collect();
            snapshot.cert_https_ready = !snapshot.cert_domains.is_empty();
            snapshot.tailnet_name = parsed
                .pointer("/CurrentTailnet/Name")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            snapshot.tailnet_domain = parsed
                .pointer("/CurrentTailnet/MagicDNSSuffix")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
                .or_else(|| get_string_field(&parsed, "MagicDNSSuffix"));
            snapshot.magic_dns_enabled = parsed
                .pointer("/CurrentTailnet/MagicDNSEnabled")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let raw_health_messages = get_string_array_field(&parsed, "Health");

            let peer_map = parsed.get("Peer").and_then(Value::as_object);
            snapshot.peer_count = peer_map.map(|peers| peers.len()).unwrap_or(0);
            snapshot.online_peer_count = peer_map
                .map(|peers| {
                    peers
                        .values()
                        .filter(|peer| peer.get("Online").and_then(Value::as_bool) == Some(true))
                        .count()
                })
                .unwrap_or(0);

            let user_id = parsed.pointer("/Self/UserID").and_then(Value::as_u64);
            if let Some(user_id) = user_id {
                let user_key = user_id.to_string();
                if let Some(user_entry) = parsed.pointer(&format!("/User/{user_key}")) {
                    snapshot.user_login_name = user_entry
                        .get("LoginName")
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned);
                    snapshot.user_display_name = user_entry
                        .get("DisplayName")
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned);
                }
            }

            snapshot.connected = snapshot.running
                && snapshot.auth_url.is_none()
                && (snapshot.tailscale_ipv4.is_some()
                    || snapshot.tailscale_ipv6.is_some()
                    || snapshot.dns_name.is_some());

            let (health_messages, non_blocking_note) =
                suppress_non_blocking_windows_dns_health_messages(raw_health_messages, &snapshot);
            snapshot.health_messages = health_messages;
            if snapshot.diagnostic_message.is_none() {
                snapshot.diagnostic_message = non_blocking_note;
            }

            if !snapshot.connected && snapshot.diagnostic_message.is_none() {
                if let Some(auth_url) = snapshot.auth_url.clone() {
                    snapshot.diagnostic_message = Some(format!(
                        "This node still needs browser authentication. Complete the Tailscale login flow: {auth_url}"
                    ));
                } else if let Some(backend_state) = snapshot.backend_state.clone() {
                    snapshot.diagnostic_message = Some(format!(
                        "Tailscale backend state is {backend_state}. Connect the node before using tailnet mobile share."
                    ));
                }
            }
        }
        Err(error) => {
            snapshot.diagnostic_message = Some(error);
        }
    }

    snapshot
}

fn get_tailscale_preferred_host(status: &TailscaleStatusSnapshot) -> Option<String> {
    status
        .cert_domains
        .first()
        .cloned()
        .or_else(|| status.dns_name.clone())
        .or_else(|| status.tailscale_ipv4.clone())
}

fn suppress_non_blocking_windows_dns_health_messages(
    messages: Vec<String>,
    status: &TailscaleStatusSnapshot,
) -> (Vec<String>, Option<String>) {
    let preferred_host = match status.connected {
        true => get_tailscale_preferred_host(status),
        false => None,
    };
    let Some(preferred_host) = preferred_host else {
        return (messages, None);
    };

    let has_windows_dns_access_denied_warning = messages
        .iter()
        .any(|message| is_windows_tailscale_dns_access_denied_message(message));
    if !has_windows_dns_access_denied_warning {
        return (messages, None);
    }

    let mut suppressed_any_message = false;
    let filtered_messages: Vec<String> = messages
        .into_iter()
        .filter(|message| {
            let should_suppress =
                is_windows_tailscale_dns_access_denied_message(message)
                    || (has_windows_dns_access_denied_warning
                        && is_generic_windows_access_denied_message(message));
            suppressed_any_message |= should_suppress;
            !should_suppress
        })
        .collect();

    let diagnostic_note = if suppressed_any_message && filtered_messages.is_empty() {
        Some(format!(
            "Windows blocked Tailscale from overriding local DNS, but mobile share can still use the active tailnet route at {preferred_host}."
        ))
    } else {
        None
    };

    (filtered_messages, diagnostic_note)
}

fn is_windows_tailscale_dns_access_denied_message(message: &str) -> bool {
    let normalized = message.trim().to_ascii_lowercase();
    normalized.contains("failed to set the dns configuration of your device")
        && normalized.contains("access is denied")
}

fn is_generic_windows_access_denied_message(message: &str) -> bool {
    message.trim().eq_ignore_ascii_case("access is denied.")
}

fn normalize_cli_string(value: Option<String>) -> Option<String> {
    value.and_then(|entry| {
        let trimmed = entry.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    })
}

fn run_tailscale_command(display_label: &str, args: &[String]) -> Result<Output, String> {
    let output = Command::new("tailscale")
        .args(args)
        .output()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                "Tailscale CLI is not installed or not on PATH.".to_string()
            } else {
                format!("Failed to run {display_label}: {error}")
            }
        })?;

    if output.status.success() {
        return Ok(output);
    }

    let combined_output = summarize_command_output(&output);
    if combined_output.is_empty() {
        Err(format!(
            "{display_label} failed with status {}.",
            output.status
        ))
    } else {
        Err(format!("{display_label} failed: {combined_output}"))
    }
}

fn summarize_command_output(output: &Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !stderr.is_empty() && !stdout.is_empty() {
        format!("{stderr} | {stdout}")
    } else if !stderr.is_empty() {
        stderr
    } else {
        stdout
    }
}

fn get_string_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
}

fn get_string_array_field(value: &Value, key: &str) -> Vec<String> {
    value
        .get(key)
        .and_then(Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|entry| !entry.is_empty())
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn get_primary_ip(
    primary_source: Option<&Value>,
    fallback_source: Option<&Value>,
    want_ipv6: bool,
) -> Option<String> {
    primary_source
        .and_then(Value::as_array)
        .or_else(|| fallback_source.and_then(Value::as_array))
        .and_then(|entries| {
            entries
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .find(|entry| entry.contains(':') == want_ipv6)
                .map(ToOwned::to_owned)
        })
}

fn trim_dns_name(value: impl AsRef<str>) -> String {
    value.as_ref().trim().trim_end_matches('.').to_string()
}

fn extract_auth_url_from_text(value: &str) -> Option<String> {
    value
        .split_whitespace()
        .map(|token| {
            token.trim_matches(|char: char| matches!(char, '"' | '\'' | ',' | ';' | ')' | '('))
        })
        .find(|token| token.starts_with("https://"))
        .map(ToOwned::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connected_tailscale_status_snapshot() -> TailscaleStatusSnapshot {
        TailscaleStatusSnapshot {
            cli_available: true,
            version: Some("1.96.3".to_string()),
            backend_state: Some("Running".to_string()),
            connected: true,
            running: true,
            auth_url: None,
            hostname: Some("TAYK47".to_string()),
            dns_name: Some("tayk47.tail04e752.ts.net".to_string()),
            tailscale_ipv4: Some("100.79.119.3".to_string()),
            tailscale_ipv6: Some("fd7a:115c:a1e0::7901:7703".to_string()),
            tailnet_name: Some("taylorofkipp@gmail.com".to_string()),
            tailnet_domain: Some("tail04e752.ts.net".to_string()),
            magic_dns_enabled: true,
            cert_domains: vec!["tayk47.tail04e752.ts.net".to_string()],
            cert_https_ready: true,
            peer_count: 7,
            online_peer_count: 1,
            user_login_name: Some("taylorofkipp@gmail.com".to_string()),
            user_display_name: Some("Taylor K".to_string()),
            health_messages: Vec::new(),
            diagnostic_message: None,
        }
    }

    #[test]
    fn suppresses_non_blocking_windows_dns_access_denied_health_messages() {
        let status = connected_tailscale_status_snapshot();
        let (health_messages, diagnostic_note) = suppress_non_blocking_windows_dns_health_messages(
            vec![
                "Tailscale failed to set the DNS configuration of your device: Access is denied."
                    .to_string(),
                "Access is denied.".to_string(),
            ],
            &status,
        );

        assert!(health_messages.is_empty());
        let diagnostic_note =
            diagnostic_note.expect("connected mobile share should emit a non-blocking note");
        assert!(diagnostic_note.contains("Windows blocked Tailscale from overriding local DNS"));
        assert!(diagnostic_note.contains("tayk47.tail04e752.ts.net"));
    }

    #[test]
    fn keeps_generic_access_denied_health_without_dns_specific_companion_message() {
        let status = connected_tailscale_status_snapshot();
        let health_messages = vec!["Access is denied.".to_string()];

        let (filtered_health_messages, diagnostic_note) =
            suppress_non_blocking_windows_dns_health_messages(health_messages.clone(), &status);

        assert_eq!(filtered_health_messages, health_messages);
        assert!(diagnostic_note.is_none());
    }
}
