// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

const COMMANDS: &[&str] = &[
  "windowmgr_register_manifest",
  "windowmgr_start_session",
  "windowmgr_start_inline_session",
  "windowmgr_show_session",
  "windowmgr_hide_session",
  "windowmgr_update_session_bounds",
  "windowmgr_set_reserved_insets",
  "windowmgr_stop_session",
  "windowmgr_stop_host_sessions",
  "windowmgr_list_sessions",
  "windowmgr_drag_begin",
  "windowmgr_drag_get_session",
  "windowmgr_drag_end",
  "windowmgr_drag_drop",
];

fn main() {
  tauri_plugin::Builder::new(COMMANDS).build();
}
