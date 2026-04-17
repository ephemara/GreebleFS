import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  rustCargoTestPackagePlatformRules,
  rustCargoTestWorkspaceDefinitions,
} from './rust-cargo-test-suite.config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const configuredCargoTestTargetRoot =
  process.env.GREEBLEFS_CARGO_TEST_TARGET_ROOT ?? process.env.OVERLAYTERM_CARGO_TEST_TARGET_ROOT;
const defaultCargoTestTargetRoot = configuredCargoTestTargetRoot
  ? path.resolve(configuredCargoTestTargetRoot)
  : path.join(projectRoot, 'target-tests', 'cargo');

function parseCommandLine(argv) {
  const selectedWorkspaceIds = new Set();
  const passthroughCargoArgs = [];
  let shouldListPackages = false;
  let shouldCompileOnly = false;
  let shouldFailFast = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--') {
      passthroughCargoArgs.push(...argv.slice(index + 1));
      break;
    }

    if (argument === '--list') {
      shouldListPackages = true;
      continue;
    }

    if (argument === '--no-run') {
      shouldCompileOnly = true;
      continue;
    }

    if (argument === '--fail-fast') {
      shouldFailFast = true;
      continue;
    }

    if (argument === '--workspace') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('Missing value after --workspace');
      }
      selectedWorkspaceIds.add(nextValue);
      index += 1;
      continue;
    }

    if (argument.startsWith('--workspace=')) {
      selectedWorkspaceIds.add(argument.slice('--workspace='.length));
      continue;
    }

    throw new Error(`Unsupported argument: ${argument}`);
  }

  return {
    passthroughCargoArgs,
    selectedWorkspaceIds,
    shouldCompileOnly,
    shouldFailFast,
    shouldListPackages,
  };
}

function relativeManifestPath(manifestPath) {
  return path.relative(projectRoot, manifestPath).split(path.sep).join('/');
}

function loadWorkspacePackages(workspaceDefinition) {
  const absoluteManifestPath = path.join(projectRoot, workspaceDefinition.manifestPath);
  const metadataOutput = execFileSync(
    'cargo',
    ['metadata', '--manifest-path', absoluteManifestPath, '--no-deps', '--format-version', '1'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );

  const metadata = JSON.parse(metadataOutput);
  const workspaceMemberIds = new Set(metadata.workspace_members);

  return metadata.packages
    .filter((pkg) => workspaceMemberIds.has(pkg.id))
    .map((pkg) => ({
      manifestPath: pkg.manifest_path,
      manifestPathRelative: relativeManifestPath(pkg.manifest_path),
      name: pkg.name,
      workspaceId: workspaceDefinition.id,
      workspaceDisplayName: workspaceDefinition.displayName,
    }))
    .sort((left, right) => left.manifestPathRelative.localeCompare(right.manifestPathRelative));
}

function platformRuleForPackage(packageDefinition) {
  return rustCargoTestPackagePlatformRules.find((rule) =>
    packageDefinition.manifestPathRelative.startsWith(rule.manifestPathPrefix),
  );
}

function isPackageSupportedOnHost(packageDefinition) {
  const platformRule = platformRuleForPackage(packageDefinition);
  if (!platformRule) {
    return { supported: true };
  }

  if (platformRule.supportedPlatforms.includes(process.platform)) {
    return { supported: true };
  }

  return {
    supported: false,
    skipReason: `${platformRule.skipReason}; current host is ${process.platform}`,
  };
}

function targetDirForPackage(packageDefinition) {
  return path.join(
    defaultCargoTestTargetRoot,
    process.platform,
    packageDefinition.workspaceId,
  );
}

function cargoArgumentsForPackage(packageDefinition, commandLine) {
  const cargoArguments = ['test', '--manifest-path', packageDefinition.manifestPath];

  if (commandLine.shouldCompileOnly) {
    cargoArguments.push('--no-run');
  }

  cargoArguments.push('--target-dir', targetDirForPackage(packageDefinition));
  cargoArguments.push(...commandLine.passthroughCargoArgs);

  return cargoArguments;
}

function runCargoTest(packageDefinition, commandLine) {
  const cargoArguments = cargoArgumentsForPackage(packageDefinition, commandLine);
  console.log(`\n[run] ${packageDefinition.name} (${packageDefinition.manifestPathRelative})`);
  const result = spawnSync('cargo', cargoArguments, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function selectedWorkspaceDefinitions(commandLine) {
  if (commandLine.selectedWorkspaceIds.size === 0) {
    return rustCargoTestWorkspaceDefinitions;
  }

  return rustCargoTestWorkspaceDefinitions.filter((workspaceDefinition) =>
    commandLine.selectedWorkspaceIds.has(workspaceDefinition.id),
  );
}

function deduplicatePackages(packages) {
  const packageMap = new Map();

  for (const packageDefinition of packages) {
    const existingPackage = packageMap.get(packageDefinition.manifestPathRelative);
    if (!existingPackage) {
      packageMap.set(packageDefinition.manifestPathRelative, {
        ...packageDefinition,
        discoveredFromWorkspaceIds: [packageDefinition.workspaceId],
      });
      continue;
    }

    existingPackage.discoveredFromWorkspaceIds.push(packageDefinition.workspaceId);
    if (
      packageDefinition.workspaceId === 'vendored-yazi' &&
      packageDefinition.manifestPathRelative.startsWith('crates/fileexplorer/crates/')
    ) {
      existingPackage.workspaceId = packageDefinition.workspaceId;
      existingPackage.workspaceDisplayName = packageDefinition.workspaceDisplayName;
    }
  }

  return [...packageMap.values()].sort((left, right) =>
    left.manifestPathRelative.localeCompare(right.manifestPathRelative),
  );
}

function main() {
  const commandLine = parseCommandLine(process.argv.slice(2));
  const workspaces = selectedWorkspaceDefinitions(commandLine);
  const packages = deduplicatePackages(workspaces.flatMap(loadWorkspacePackages));

  if (packages.length === 0) {
    throw new Error('No Rust packages were discovered for the requested workspace selection.');
  }

  console.log(
    `Running Rust cargo suite on ${process.platform} across ${packages.length} packages in ${workspaces.length} workspaces.`,
  );

  if (commandLine.shouldListPackages) {
    for (const packageDefinition of packages) {
      const support = isPackageSupportedOnHost(packageDefinition);
      const statusLabel = support.supported ? 'supported' : `skipped: ${support.skipReason}`;
      console.log(`${packageDefinition.name} :: ${packageDefinition.manifestPathRelative} :: ${statusLabel}`);
    }
    return;
  }

  const failedPackages = [];
  const skippedPackages = [];
  let passedPackageCount = 0;

  for (const packageDefinition of packages) {
    const support = isPackageSupportedOnHost(packageDefinition);
    if (!support.supported) {
      skippedPackages.push({ packageDefinition, reason: support.skipReason });
      console.log(
        `\n[skip] ${packageDefinition.name} (${packageDefinition.manifestPathRelative}) - ${support.skipReason}`,
      );
      continue;
    }

    const status = runCargoTest(packageDefinition, commandLine);
    if (status === 0) {
      passedPackageCount += 1;
      continue;
    }

    failedPackages.push({ packageDefinition, status });
    if (commandLine.shouldFailFast) {
      break;
    }
  }

  console.log('\nRust cargo suite summary');
  console.log(`  passed: ${passedPackageCount}`);
  console.log(`  skipped: ${skippedPackages.length}`);
  console.log(`  failed: ${failedPackages.length}`);

  if (skippedPackages.length > 0) {
    console.log('Skipped packages:');
    for (const { packageDefinition, reason } of skippedPackages) {
      console.log(`  - ${packageDefinition.name}: ${reason}`);
    }
  }

  if (failedPackages.length > 0) {
    console.log('Failed packages:');
    for (const { packageDefinition, status } of failedPackages) {
      console.log(`  - ${packageDefinition.name}: exit status ${status}`);
    }
    process.exit(1);
  }
}

main();
