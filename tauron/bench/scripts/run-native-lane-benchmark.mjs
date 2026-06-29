// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptPath = fileURLToPath(import.meta.url)
const tauronRoot = path.resolve(path.dirname(scriptPath), '..', '..')
const targetDir =
  process.env.CARGO_TARGET_DIR ||
  path.join(tauronRoot, 'target', 'native-lane-benchmark-cargo')

const child = spawn(
  'cargo',
  ['run', '-p', 'tauri_bench', '--bin', 'run_native_lane_benchmark'],
  {
    cwd: tauronRoot,
    env: {
      ...process.env,
      CARGO_TARGET_DIR: targetDir
    },
    stdio: 'inherit',
    windowsHide: false
  }
)

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`native lane benchmark terminated by ${signal}`)
    process.exit(1)
  }
  process.exit(code ?? 1)
})

child.on('error', error => {
  console.error(error)
  process.exit(1)
})
