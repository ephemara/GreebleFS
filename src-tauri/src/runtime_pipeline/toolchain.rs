//! Host-side toolchain probing for the polyglot runtime pipeline.
//!
//! v1 reports presence + version of the standard Go toolchain, TinyGo, Cargo /
//! Rust, a future C compiler probe, and Python. We never invoke `go install`
//! or auto-bootstrap toolchains here — that lives in `scripts/go/bootstrap.sh`
//! so the host stays free of network and write side-effects.

use std::process::Command;

use serde::Serialize;

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeToolchainStatus {
    pub go: ToolchainProbe,
    pub tinygo: ToolchainProbe,
    pub cargo: ToolchainProbe,
    pub rustc: ToolchainProbe,
    pub wasm_bindgen: ToolchainProbe,
    pub cc: ToolchainProbe,
    pub python: ToolchainProbe,
    pub manifest_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ToolchainProbe {
    pub id: String,
    pub installed: bool,
    pub version: Option<String>,
    pub executable_path: Option<String>,
    pub error: Option<String>,
}

impl ToolchainProbe {
    fn missing(id: impl Into<String>, error: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            installed: false,
            version: None,
            executable_path: None,
            error: Some(error.into()),
        }
    }
}

pub fn probe_runtime_toolchains() -> RuntimeToolchainStatus {
    RuntimeToolchainStatus {
        go: probe_simple_command("go", &["version"], parse_go_version),
        tinygo: probe_simple_command("tinygo", &["version"], parse_tinygo_version),
        cargo: probe_simple_command("cargo", &["--version"], parse_cargo_version),
        rustc: probe_simple_command("rustc", &["--version"], parse_rustc_version),
        wasm_bindgen: probe_simple_command(
            "wasm-bindgen",
            &["--version"],
            parse_wasm_bindgen_version,
        ),
        cc: probe_simple_command("cc", &["--version"], parse_cc_version),
        python: probe_simple_command("python3", &["--version"], parse_python_version),
        manifest_path: locate_pinned_toolchain_manifest(),
    }
}

fn locate_pinned_toolchain_manifest() -> Option<String> {
    // The repo-owned pinned manifest. In release builds we still resolve the
    // dev-time path so the host can surface guidance even when the artifact is
    // not bundled. Frontend code is expected to gracefully degrade.
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").ok()?;
    let candidate = std::path::Path::new(&manifest_dir).join("../toolchains/go/toolchains.json");
    if candidate.exists() {
        Some(candidate.to_string_lossy().to_string())
    } else {
        None
    }
}

fn probe_simple_command(
    program: &str,
    args: &[&str],
    parse_version: fn(&str) -> Option<String>,
) -> ToolchainProbe {
    let executable_path = which::which(program)
        .ok()
        .map(|path| path.to_string_lossy().to_string());

    let output = match Command::new(program).args(args).output() {
        Ok(output) => output,
        Err(error) => {
            return ToolchainProbe::missing(program, format!("not found on PATH: {error}"));
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return ToolchainProbe {
            id: program.to_string(),
            installed: true,
            version: None,
            executable_path,
            error: Some(format!(
                "{} {} exited with status {}: {}",
                program,
                args.join(" "),
                output.status,
                stderr.trim()
            )),
        };
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = if stdout.trim().is_empty() {
        stderr
    } else {
        stdout
    };
    let version = parse_version(&combined);

    ToolchainProbe {
        id: program.to_string(),
        installed: true,
        version,
        executable_path,
        error: None,
    }
}

fn parse_go_version(output: &str) -> Option<String> {
    // `go version go1.24.0 linux/amd64`
    output
        .split_whitespace()
        .find(|token| token.starts_with("go1.") || token.starts_with("go2."))
        .map(|token| token.trim_start_matches("go").to_string())
}

fn parse_tinygo_version(output: &str) -> Option<String> {
    // `tinygo version 0.31.2 linux/amd64 (using go version go1.24.0 ...)`
    let trimmed = output.trim();
    let mut iterator = trimmed.split_whitespace();
    while let Some(token) = iterator.next() {
        if token == "version" {
            return iterator.next().map(|raw| raw.to_string());
        }
    }
    None
}

fn parse_python_version(output: &str) -> Option<String> {
    // `Python 3.12.4`
    output
        .split_whitespace()
        .find(|token| {
            token
                .chars()
                .next()
                .map(|c| c.is_ascii_digit())
                .unwrap_or(false)
        })
        .map(|token| token.to_string())
}

fn parse_cargo_version(output: &str) -> Option<String> {
    // `cargo 1.88.0 (873a06493 2025-05-10)`
    output
        .split_whitespace()
        .find(|token| {
            token
                .chars()
                .next()
                .is_some_and(|character| character.is_ascii_digit())
        })
        .map(|token| token.to_string())
}

fn parse_rustc_version(output: &str) -> Option<String> {
    // `rustc 1.88.0 (6b00bc388 2025-06-23)`
    parse_cargo_version(output)
}

fn parse_cc_version(output: &str) -> Option<String> {
    output
        .lines()
        .next()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
}

fn parse_wasm_bindgen_version(output: &str) -> Option<String> {
    // `wasm-bindgen 0.2.95`
    parse_cargo_version(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_go_version_string() {
        assert_eq!(
            parse_go_version("go version go1.24.0 linux/amd64"),
            Some("1.24.0".to_string())
        );
    }

    #[test]
    fn parses_tinygo_version_string() {
        assert_eq!(
            parse_tinygo_version("tinygo version 0.31.2 linux/amd64"),
            Some("0.31.2".to_string())
        );
    }

    #[test]
    fn parses_python_version_string() {
        assert_eq!(
            parse_python_version("Python 3.12.4"),
            Some("3.12.4".to_string())
        );
    }

    #[test]
    fn parses_cargo_version_string() {
        assert_eq!(
            parse_cargo_version("cargo 1.88.0 (873a06493 2025-05-10)"),
            Some("1.88.0".to_string())
        );
    }

    #[test]
    fn parses_rustc_version_string() {
        assert_eq!(
            parse_rustc_version("rustc 1.88.0 (6b00bc388 2025-06-23)"),
            Some("1.88.0".to_string())
        );
    }

    #[test]
    fn parses_wasm_bindgen_version_string() {
        assert_eq!(
            parse_wasm_bindgen_version("wasm-bindgen 0.2.95"),
            Some("0.2.95".to_string())
        );
    }
}
