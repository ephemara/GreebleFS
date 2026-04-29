// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use super::types::{HTTPS_DEFAULT_PORT, HTTP_DEFAULT_PORT, PORT_RANGE_END, PORT_RANGE_START};

pub(super) fn get_local_ipv4() -> Result<Ipv4Addr, String> {
    let interfaces = local_ip_address::list_afinet_netifas()
        .map_err(|err| format!("Failed to enumerate network interfaces: {err}"))?;
    let default_route_ipv4 = match local_ip_address::local_ip() {
        Ok(IpAddr::V4(ipv4)) => Some(ipv4),
        _ => None,
    };

    select_local_ipv4_from_sources(default_route_ipv4, &interfaces).ok_or_else(|| {
        "No suitable LAN IPv4 address found. Make sure you are connected to a local network.".into()
    })
}

fn select_local_ipv4_from_sources(
    default_route_ipv4: Option<Ipv4Addr>,
    interfaces: &[(String, IpAddr)],
) -> Option<Ipv4Addr> {
    if let Some(ipv4) = default_route_ipv4.filter(is_shareable_ipv4) {
        return Some(ipv4);
    }

    let mut best_ip: Option<Ipv4Addr> = None;
    let mut best_priority: u8 = 0;

    for (_name, ip) in interfaces {
        if let IpAddr::V4(ipv4) = ip {
            if !is_shareable_ipv4(ipv4) {
                continue;
            }

            let priority = lan_ip_priority(ipv4);
            if priority > best_priority {
                best_priority = priority;
                best_ip = Some(*ipv4);
            }
        }
    }

    best_ip
}

fn is_shareable_ipv4(ip: &Ipv4Addr) -> bool {
    !ip.is_loopback() && !ip.is_link_local() && !ip.is_unspecified() && !is_tailscale_cgnat_ipv4(ip)
}

fn is_tailscale_cgnat_ipv4(ip: &Ipv4Addr) -> bool {
    let octets = ip.octets();
    matches!(octets, [100, 64..=127, ..])
}

fn is_private_lan_ip(ip: &Ipv4Addr) -> bool {
    let octets = ip.octets();
    matches!(octets, [192, 168, ..] | [10, ..] | [172, 16..=31, ..])
}

fn lan_ip_priority(ip: &Ipv4Addr) -> u8 {
    let octets = ip.octets();
    match octets {
        [192, 168, ..] => 4,
        [10, ..] => 3,
        [172, 16..=31, ..] => 3,
        _ if is_private_lan_ip(ip) => 2,
        _ => 1,
    }
}

pub(super) fn find_available_port(preferred: u16, exclude: &[u16]) -> Result<u16, String> {
    if !exclude.contains(&preferred)
        && std::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], preferred))).is_ok()
    {
        return Ok(preferred);
    }

    for port in PORT_RANGE_START..=PORT_RANGE_END {
        if exclude.contains(&port) {
            continue;
        }
        if std::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port))).is_ok() {
            return Ok(port);
        }
    }
    Err("No available port found".into())
}

pub(super) fn format_http_url(host: &str, port: u16) -> String {
    if port == HTTP_DEFAULT_PORT {
        format!("http://{host}")
    } else {
        format!("http://{host}:{port}")
    }
}

pub(super) fn format_host_port(host: &str, port: u16) -> String {
    if port == HTTP_DEFAULT_PORT {
        host.to_string()
    } else {
        format!("{host}:{port}")
    }
}

pub(super) fn format_https_url(host: &str, port: u16) -> String {
    if port == HTTPS_DEFAULT_PORT {
        format!("https://{host}")
    } else {
        format!("https://{host}:{port}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn interface(name: &str, ip: Ipv4Addr) -> (String, IpAddr) {
        (name.to_string(), IpAddr::V4(ip))
    }

    #[test]
    fn prefers_the_default_route_ipv4_over_fallback_adapter_order() {
        let selected = select_local_ipv4_from_sources(
            Some(Ipv4Addr::new(172, 20, 10, 6)),
            &[
                interface("Ethernet", Ipv4Addr::new(192, 168, 56, 1)),
                interface("Wi-Fi", Ipv4Addr::new(172, 20, 10, 6)),
            ],
        );

        assert_eq!(selected, Some(Ipv4Addr::new(172, 20, 10, 6)));
    }

    #[test]
    fn ignores_a_tailscale_cgnat_default_route_candidate() {
        let selected = select_local_ipv4_from_sources(
            Some(Ipv4Addr::new(100, 79, 119, 3)),
            &[
                interface("Tailscale", Ipv4Addr::new(100, 79, 119, 3)),
                interface("Wi-Fi", Ipv4Addr::new(172, 20, 10, 6)),
            ],
        );

        assert_eq!(selected, Some(Ipv4Addr::new(172, 20, 10, 6)));
    }

    #[test]
    fn falls_back_to_the_best_non_tailscale_ipv4_when_default_route_is_missing() {
        let selected = select_local_ipv4_from_sources(
            None,
            &[
                interface("Tailscale", Ipv4Addr::new(100, 79, 119, 3)),
                interface("Local Area", Ipv4Addr::new(169, 254, 69, 80)),
                interface("Wi-Fi", Ipv4Addr::new(10, 0, 0, 8)),
            ],
        );

        assert_eq!(selected, Some(Ipv4Addr::new(10, 0, 0, 8)));
    }
}
