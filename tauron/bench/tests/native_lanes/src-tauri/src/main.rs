// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{env, fs, path::PathBuf};
use tauri::{command, AppHandle, Manager, Runtime};

const RESULT_START: &str = "===== <TAURON_NATIVE_LANE_BENCH>";
const RESULT_END: &str = "===== </TAURON_NATIVE_LANE_BENCH>";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeLaneBenchConfig {
  invoke_iterations: u32,
  host_object_iterations: u32,
  payload_bytes: usize,
  stream_packets: u32,
  stream_packet_bytes: usize,
  stream_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeStreamBenchRequest {
  stream_id: String,
  packets: u32,
  packet_bytes: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativePooledBufferBenchRequest {
  stream_id: String,
  packets: u32,
  packet_bytes: usize,
  start_sequence: Option<u32>,
  webview_label: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeRingBenchRequest {
  ring_id: String,
  packets: u32,
  packet_bytes: usize,
  capacity: Option<usize>,
  webview_label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativePooledBufferBenchResult {
  packets: u64,
  bytes: u64,
  allocation_count: u64,
  reuse_count: u64,
  copy_count: u64,
  copied_bytes: u64,
  webview_post_time_total_us: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CpuSnapshot {
  timestamp_ms: u64,
  user_time_100ns: u64,
  kernel_time_100ns: u64,
}

#[command]
fn app_should_close(exit_code: i32) {
  std::process::exit(exit_code);
}

#[command]
fn bench_config() -> NativeLaneBenchConfig {
  NativeLaneBenchConfig {
    invoke_iterations: env_u32("TAURON_NATIVE_LANE_BENCH_INVOKE_ITERATIONS", 500),
    host_object_iterations: env_u32("TAURON_NATIVE_LANE_BENCH_HOST_ITERATIONS", 500),
    payload_bytes: env_usize("TAURON_NATIVE_LANE_BENCH_PAYLOAD_BYTES", 1024),
    stream_packets: env_u32("TAURON_NATIVE_LANE_BENCH_STREAM_PACKETS", 256),
    stream_packet_bytes: env_usize("TAURON_NATIVE_LANE_BENCH_STREAM_PACKET_BYTES", 16 * 1024),
    stream_id: "tauron-native-lane-bench-stream".to_string(),
  }
}

#[command]
fn invoke_echo_json(payload: Value) -> Value {
  payload
}

#[command]
fn start_native_stream_benchmark<R: Runtime>(
  app: AppHandle<R>,
  request: NativeStreamBenchRequest,
) -> Result<(), String> {
  let mut bytes = vec![0_u8; request.packet_bytes];
  for sequence in 0..request.packets {
    fill_packet(&mut bytes, sequence);
    tauri::native_stream::publish_byte_stream(
      &app,
      &request.stream_id,
      "native-lane-benchmark",
      &bytes,
    )?;
  }
  tauri::native_stream::flush_byte_stream(&app, &request.stream_id)
}

#[command]
fn start_native_buffer_pool_benchmark<R: Runtime>(
  app: AppHandle<R>,
  request: NativePooledBufferBenchRequest,
) -> Result<NativePooledBufferBenchResult, String> {
  let state = app.state::<tauri::native_buffer_pool::NativeBufferPoolState>();
  let webview_label = request.webview_label.unwrap_or_else(|| "main".to_string());
  let Some(webview_window) = app.get_webview_window(&webview_label) else {
    return Err(format!(
      "native buffer pool benchmark WebView not found for label '{webview_label}'"
    ));
  };

  let mut bytes = vec![0_u8; request.packet_bytes];
  let mut result = NativePooledBufferBenchResult {
    packets: 0,
    bytes: 0,
    allocation_count: 0,
    reuse_count: 0,
    copy_count: 0,
    copied_bytes: 0,
    webview_post_time_total_us: 0,
  };
  let start_sequence = request.start_sequence.unwrap_or(0);
  for packet_index in 0..request.packets {
    let sequence = start_sequence.saturating_add(packet_index);
    fill_packet(&mut bytes, sequence);
    let metrics = tauri::native_buffer_pool::post_pooled_packet_to_webview(
      webview_window.as_ref(),
      state.inner(),
      &webview_label,
      &request.stream_id,
      sequence as u64,
      &bytes,
    )?;
    result.packets = result.packets.saturating_add(1);
    result.bytes = result.bytes.saturating_add(bytes.len() as u64);
    result.allocation_count = result
      .allocation_count
      .saturating_add(metrics.allocation_count);
    result.reuse_count = result.reuse_count.saturating_add(metrics.reuse_count);
    result.copy_count = result.copy_count.saturating_add(metrics.copy_count);
    result.copied_bytes = result.copied_bytes.saturating_add(metrics.copied_bytes);
    result.webview_post_time_total_us = result
      .webview_post_time_total_us
      .saturating_add(metrics.webview_post_time_us);
  }
  Ok(result)
}

#[command]
fn start_native_ring_benchmark<R: Runtime>(
  app: AppHandle<R>,
  request: NativeRingBenchRequest,
) -> Result<tauri::native_ring::NativeRingPostMetrics, String> {
  tauri::native_ring::post_ring_benchmark(
    &app,
    &request.webview_label.unwrap_or_else(|| "main".to_string()),
    &request.ring_id,
    request.packets as u64,
    request.packet_bytes,
    request
      .capacity
      .unwrap_or(tauri::native_ring::DEFAULT_NATIVE_RING_CAPACITY),
  )
}

#[command]
fn bench_cpu_snapshot() -> Option<CpuSnapshot> {
  cpu_snapshot()
}

#[command]
fn record_benchmark_results(results: Value) -> Result<(), String> {
  let pretty = serde_json::to_string_pretty(&results)
    .map_err(|error| format!("failed to serialize benchmark results: {error}"))?;
  println!("{RESULT_START}");
  println!("{pretty}");
  println!("{RESULT_END}");

  if let Some(output_path) = env::var_os("TAURON_NATIVE_LANE_BENCH_OUTPUT") {
    let path = PathBuf::from(output_path);
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create output directory: {error}"))?;
    }
    fs::write(&path, pretty).map_err(|error| {
      format!(
        "failed to write benchmark output {}: {error}",
        path.display()
      )
    })?;
  }

  Ok(())
}

fn env_u32(name: &str, default_value: u32) -> u32 {
  env::var(name)
    .ok()
    .and_then(|value| value.parse::<u32>().ok())
    .unwrap_or(default_value)
}

fn env_usize(name: &str, default_value: usize) -> usize {
  env::var(name)
    .ok()
    .and_then(|value| value.parse::<usize>().ok())
    .unwrap_or(default_value)
}

fn fill_packet(bytes: &mut [u8], sequence: u32) {
  let seed = sequence as usize;
  for (index, byte) in bytes.iter_mut().enumerate() {
    *byte = ((seed.wrapping_add(index)) & 0xff) as u8;
  }
}

#[cfg(windows)]
fn cpu_snapshot() -> Option<CpuSnapshot> {
  use std::time::{SystemTime, UNIX_EPOCH};
  use windows::Win32::{
    Foundation::FILETIME,
    System::Threading::{GetCurrentProcess, GetProcessTimes},
  };

  fn filetime_to_u64(filetime: FILETIME) -> u64 {
    ((filetime.dwHighDateTime as u64) << 32) | filetime.dwLowDateTime as u64
  }

  let mut created_at = FILETIME::default();
  let mut exited_at = FILETIME::default();
  let mut kernel_time = FILETIME::default();
  let mut user_time = FILETIME::default();
  unsafe {
    GetProcessTimes(
      GetCurrentProcess(),
      &mut created_at,
      &mut exited_at,
      &mut kernel_time,
      &mut user_time,
    )
    .ok()?;
  }
  Some(CpuSnapshot {
    timestamp_ms: SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .ok()
      .map(|duration| duration.as_millis() as u64)
      .unwrap_or(0),
    user_time_100ns: filetime_to_u64(user_time),
    kernel_time_100ns: filetime_to_u64(kernel_time),
  })
}

#[cfg(not(windows))]
fn cpu_snapshot() -> Option<CpuSnapshot> {
  None
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      tauri::native_buffer_pool::register_native_control_handlers(app.handle())?;
      tauri::native_control::register_handler(app, "bench", "echoJson", |request| {
        Ok(request.args)
      })?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      app_should_close,
      bench_config,
      invoke_echo_json,
      start_native_stream_benchmark,
      start_native_buffer_pool_benchmark,
      start_native_ring_benchmark,
      bench_cpu_snapshot,
      record_benchmark_results,
    ])
    .run(tauri::generate_context!())
    .expect("error while running Tauron native lane benchmark");
}
