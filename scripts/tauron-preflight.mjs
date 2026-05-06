import fs from "node:fs";
import path from "node:path";

const requiredTauronRelativeManifestPaths = [
  "Cargo.toml",
  path.join("crates", "tauri", "Cargo.toml"),
  path.join("crates", "tauri-build", "Cargo.toml"),
  path.join("crates", "tauri-codegen", "Cargo.toml"),
  path.join("crates", "tauri-macros", "Cargo.toml"),
  path.join("crates", "tauri-plugin", "Cargo.toml"),
  path.join("crates", "tauri-runtime", "Cargo.toml"),
  path.join("crates", "tauri-runtime-wry", "Cargo.toml"),
  path.join("crates", "tauri-utils", "Cargo.toml"),
];

function normalizePathForLogs(value) {
  return value.replace(/\\/g, "/");
}

export function resolveTauronRoot(projectRoot) {
  return path.resolve(projectRoot, "..", "tauron");
}

export function assertTauronForkAvailable(projectRoot) {
  const tauronRoot = resolveTauronRoot(projectRoot);
  const missingManifestPaths = requiredTauronRelativeManifestPaths
    .map((relativeManifestPath) => ({
      relativeManifestPath,
      absoluteManifestPath: path.join(tauronRoot, relativeManifestPath),
    }))
    .filter(({ absoluteManifestPath }) => !fs.existsSync(absoluteManifestPath));

  if (missingManifestPaths.length > 0) {
    const renderedMissingPaths = missingManifestPaths
      .map(({ absoluteManifestPath }) => `  - ${normalizePathForLogs(absoluteManifestPath)}`)
      .join("\n");

    throw new Error(
      [
        "GreebleFS now requires the sibling tauron fork for Rust-side Tauri crates.",
        `Expected tauron workspace root: ${normalizePathForLogs(tauronRoot)}`,
        "Missing required tauron manifest paths:",
        renderedMissingPaths,
        "Restore or clone the tauron workspace beside GreebleFS before running Cargo-backed scripts.",
      ].join("\n"),
    );
  }

  return {
    tauronRoot,
    requiredManifestPaths: requiredTauronRelativeManifestPaths.map((relativeManifestPath) =>
      path.join(tauronRoot, relativeManifestPath),
    ),
  };
}
