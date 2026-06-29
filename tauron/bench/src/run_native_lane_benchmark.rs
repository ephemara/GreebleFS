// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Runs the Tauron native-lane browser/WebView benchmark app and persists the
//! benchmark JSON emitted by that app.

use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::{
  env, fs,
  path::{Path, PathBuf},
  process::{Command, Stdio},
};

const RESULT_START: &str = "===== <TAURON_NATIVE_LANE_BENCH>";
const RESULT_END: &str = "===== </TAURON_NATIVE_LANE_BENCH>";

fn tauron_root() -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .parent()
    .expect("bench crate should live under tauron root")
    .to_path_buf()
}

fn default_output_path() -> PathBuf {
  tauron_root()
    .join("target")
    .join("native-lane-benchmark.json")
}

fn native_lane_manifest() -> PathBuf {
  tauron_root()
    .join("bench")
    .join("tests")
    .join("native_lanes")
    .join("src-tauri")
    .join("Cargo.toml")
}

fn parse_benchmark_json(stdout: &str) -> Result<Option<Value>> {
  let Some(marker_start) = stdout.find(RESULT_START) else {
    return Ok(None);
  };
  let start = marker_start + RESULT_START.len();
  let Some(end) = stdout[start..]
    .find(RESULT_END)
    .map(|offset| start + offset)
  else {
    return Ok(None);
  };
  let payload = stdout[start..end].trim();
  serde_json::from_str(payload)
    .context("failed to parse native lane benchmark JSON")
    .map(Some)
}

fn read_existing_json(path: &Path) -> Result<Value> {
  let file = fs::File::open(path)
    .with_context(|| format!("failed to open benchmark output {}", path.display()))?;
  serde_json::from_reader(file)
    .with_context(|| format!("failed to parse benchmark output {}", path.display()))
}

fn write_json(path: &Path, value: &Value) -> Result<()> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)
      .with_context(|| format!("failed to create output directory {}", parent.display()))?;
  }
  let file = fs::File::create(path)
    .with_context(|| format!("failed to create benchmark output {}", path.display()))?;
  serde_json::to_writer_pretty(file, value).context("failed to write benchmark JSON")
}

fn main() -> Result<()> {
  let output_path = env::var_os("TAURON_NATIVE_LANE_BENCH_OUTPUT")
    .map(PathBuf::from)
    .unwrap_or_else(default_output_path);
  let manifest_path = native_lane_manifest();

  println!("Starting Tauron native lane benchmark");
  println!("Manifest: {}", manifest_path.display());
  println!("Output: {}", output_path.display());

  let output = Command::new("cargo")
    .args([
      "run",
      "--release",
      "--manifest-path",
      manifest_path
        .to_str()
        .context("native lane manifest path contains invalid UTF-8")?,
    ])
    .env("TAURON_NATIVE_LANE_BENCH_OUTPUT", &output_path)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .output()
    .context("failed to run native lane benchmark app")?;

  let stdout = String::from_utf8_lossy(&output.stdout);
  let stderr = String::from_utf8_lossy(&output.stderr);
  print!("{stdout}");
  eprint!("{stderr}");

  if !output.status.success() {
    bail!(
      "native lane benchmark app exited with {:?}",
      output.status.code()
    );
  }

  let json = match parse_benchmark_json(&stdout)? {
    Some(json) => json,
    None if output_path.exists() => read_existing_json(&output_path)?,
    None => bail!("native lane benchmark output did not include JSON markers"),
  };
  write_json(&output_path, &json)?;
  println!(
    "Native lane benchmark results written to {}",
    output_path.display()
  );
  Ok(())
}
