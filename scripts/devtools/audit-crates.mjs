import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..", "..");
const cratesRoot = path.join(repoRoot, "crates");
const srcTauriManifest = path.join(repoRoot, "src-tauri", "Cargo.toml");

const supportedTargets = [
  { label: "windows", triple: "x86_64-pc-windows-msvc" },
  { label: "macos", triple: "x86_64-apple-darwin" },
  { label: "linux", triple: "x86_64-unknown-linux-gnu" },
];

const currentTargetByPlatform = {
  win32: "windows",
  darwin: "macos",
  linux: "linux",
};

function toRepoRelative(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function findCargoTomls(directory) {
  const discovered = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      discovered.push(...findCargoTomls(absolutePath));
      continue;
    }
    if (entry.isFile() && entry.name === "Cargo.toml") {
      discovered.push(absolutePath);
    }
  }
  return discovered;
}

function readCargoPackageName(manifestPath) {
  const content = readFileSync(manifestPath, "utf8");
  const packageSectionMatch = content.match(/^\[package\][\s\S]*?(?=^\[|\Z)/m);
  if (!packageSectionMatch) {
    return null;
  }
  const nameMatch = packageSectionMatch[0].match(/^\s*name\s*=\s*"([^"]+)"/m);
  return nameMatch ? nameMatch[1] : null;
}

function loadCargoMetadata(targetTriple) {
  const raw = execFileSync(
    "cargo",
    [
      "metadata",
      "--format-version",
      "1",
      "--manifest-path",
      srcTauriManifest,
      "--filter-platform",
      targetTriple,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
    },
  );

  return JSON.parse(raw);
}

function computeReachableLocalPackageSet(metadata) {
  const nodesById = new Map(metadata.resolve.nodes.map((node) => [node.id, node]));
  const reachableIds = new Set();
  const stack = [metadata.resolve.root];

  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || reachableIds.has(id)) {
      continue;
    }
    reachableIds.add(id);

    const node = nodesById.get(id);
    if (!node) {
      continue;
    }

    for (const dependency of node.deps) {
      if (dependency.pkg && !reachableIds.has(dependency.pkg)) {
        stack.push(dependency.pkg);
      }
    }
  }

  const reachableManifestSet = new Set();
  for (const pkg of metadata.packages) {
    if (!reachableIds.has(pkg.id)) {
      continue;
    }
    const manifestPath = path.normalize(pkg.manifest_path);
    if (manifestPath.startsWith(path.normalize(cratesRoot + path.sep))) {
      reachableManifestSet.add(toRepoRelative(manifestPath));
    }
  }

  return reachableManifestSet;
}

const packageEntries = findCargoTomls(cratesRoot)
  .map((manifestPath) => {
    const packageName = readCargoPackageName(manifestPath);
    if (!packageName) {
      return null;
    }
    const relativeManifestPath = toRepoRelative(manifestPath);
    const topLevelDirectory = relativeManifestPath.split("/")[1];
    return {
      packageName,
      relativeManifestPath,
      topLevelDirectory,
    };
  })
  .filter(Boolean)
  .sort((left, right) =>
    left.relativeManifestPath.localeCompare(right.relativeManifestPath),
  );

const reachableByTarget = new Map();
for (const target of supportedTargets) {
  const metadata = loadCargoMetadata(target.triple);
  reachableByTarget.set(target.label, computeReachableLocalPackageSet(metadata));
}

const directCrateDirectories = readdirSync(cratesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

const currentTarget = currentTargetByPlatform[process.platform] ?? supportedTargets[0].label;

const packageRows = packageEntries.map((entry) => {
  const activeTargets = supportedTargets
    .filter((target) => reachableByTarget.get(target.label).has(entry.relativeManifestPath))
    .map((target) => target.label);

  return {
    ...entry,
    activeTargets,
    activeOnCurrentTarget: activeTargets.includes(currentTarget),
  };
});

const topLevelSummary = directCrateDirectories.map((directoryName) => {
  const packages = packageRows.filter(
    (entry) => entry.topLevelDirectory === directoryName,
  );

  const dormantPackages = packages.filter((entry) => entry.activeTargets.length === 0);
  const activePackages = packages.filter((entry) => entry.activeTargets.length > 0);

  let classification = "dormant";
  if (directoryName === "tauri-plugins") {
    classification = "staging";
  } else if (activePackages.length > 0) {
    classification = dormantPackages.length > 0 ? "mixed" : "active";
  } else if (packages.length === 0) {
    classification = "dormant";
  }

  return {
    directoryName,
    classification,
    activePackages: activePackages.map((entry) => ({
      packageName: entry.packageName,
      relativeManifestPath: entry.relativeManifestPath,
      activeTargets: entry.activeTargets,
    })),
    dormantPackages: dormantPackages.map((entry) => ({
      packageName: entry.packageName,
      relativeManifestPath: entry.relativeManifestPath,
    })),
  };
});

const audit = {
  currentTarget,
  supportedTargets: supportedTargets.map((target) => target.label),
  topLevelSummary,
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
  process.exit(0);
}

const lines = [];
lines.push(`Current target: ${currentTarget}`);
lines.push("");
lines.push("Top-level crates summary:");

for (const group of topLevelSummary) {
  lines.push(`- ${group.directoryName}: ${group.classification}`);
  for (const pkg of group.activePackages) {
    lines.push(
      `  - active: ${pkg.packageName} (${pkg.relativeManifestPath}) -> ${pkg.activeTargets.join(", ")}`,
    );
  }
  for (const pkg of group.dormantPackages) {
    lines.push(
      `  - dormant: ${pkg.packageName} (${pkg.relativeManifestPath})`,
    );
  }
}

process.stdout.write(`${lines.join("\n")}\n`);
