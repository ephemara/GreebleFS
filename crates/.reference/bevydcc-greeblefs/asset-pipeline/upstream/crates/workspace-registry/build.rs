mod build_integration;
mod build_public_api;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Deserialize)]
struct CargoMetadataDocument {
    packages: Vec<CargoPackage>,
    workspace_root: String,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct CargoPackage {
    name: String,
    version: String,
    description: Option<String>,
    manifest_path: String,
    dependencies: Vec<CargoDependency>,
    targets: Vec<CargoTarget>,
    features: BTreeMap<String, Vec<String>>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct CargoDependency {
    name: String,
    path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CargoTarget {
    name: String,
    kind: Vec<String>,
    src_path: String,
}

#[derive(Debug, Clone, Default)]
struct WorkspaceConfig {
    registry_version: u32,
    aggregator_packages: Vec<String>,
    default_host_support: Vec<String>,
    inference: InferenceConfig,
    external_manifests: BTreeMap<String, String>,
    overrides: BTreeMap<String, PackageOverride>,
}

#[derive(Debug, Clone, Default)]
struct InferenceConfig {
    aggregator_threshold: usize,
    backend_dependency_markers: Vec<String>,
    bevy_dependency_markers: Vec<String>,
    zen_dependency_markers: Vec<String>,
    gpu_dependency_markers: Vec<String>,
    kain_dependency_markers: Vec<String>,
    game_prefixes: Vec<String>,
    zen_prefixes: Vec<String>,
    kos_prefixes: Vec<String>,
}

#[derive(Debug, Clone, Default)]
struct PackageOverride {
    roles: Vec<String>,
    capabilities: Vec<String>,
    hosts: Vec<String>,
    notes: Vec<String>,
    stability_tier: Option<String>,
    recommended_entrypoints: Vec<String>,
    adapter_targets: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct WorkspaceRegistryDocument {
    registry_version: u32,
    workspace_root: String,
    package_count: usize,
    local_dependency_edge_count: usize,
    aggregator_packages: Vec<String>,
    data_sources: Vec<String>,
    packages: Vec<WorkspacePackageRecord>,
    external_manifests: Vec<WorkspaceExternalManifestRecord>,
    artifacts: Vec<WorkspaceArtifactRecord>,
}

#[derive(Debug, Clone, Serialize)]
struct WorkspacePackageRecord {
    name: String,
    version: String,
    description: String,
    manifest_path: String,
    package_path: String,
    target_names: Vec<String>,
    target_kinds: Vec<String>,
    features: Vec<String>,
    workspace_dependencies: Vec<String>,
    local_dependency_count: usize,
    roles: Vec<String>,
    capabilities: Vec<String>,
    hosts: Vec<String>,
    artifact_ids: Vec<String>,
    artifact_count: usize,
    notes: Vec<String>,
    metadata_sources: Vec<String>,
    is_aggregator: bool,
}

#[derive(Debug, Clone, Serialize)]
struct WorkspaceExternalManifestRecord {
    key: String,
    owner_package: String,
    relative_path: String,
    format: String,
    item_count: usize,
    item_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct WorkspaceArtifactRecord {
    id: String,
    label: String,
    kind: String,
    owner_package: String,
    manifest_key: String,
    source_path: String,
    compiled_path: String,
    namespace: String,
    runtime_kind: String,
    host_kind: String,
    domain: String,
    tags: Vec<String>,
}

fn main() {
    let workspace_manifest = locate_workspace_manifest();
    let cargo_metadata = load_cargo_metadata(&workspace_manifest);
    let workspace_root = PathBuf::from(&cargo_metadata.workspace_root);
    let config = WorkspaceConfig::from_root_metadata(cargo_metadata.metadata.as_ref());

    emit_rerun_if_changed(&workspace_manifest);
    for package in &cargo_metadata.packages {
        emit_rerun_if_changed(Path::new(&package.manifest_path));
    }

    let (external_manifests, artifacts) =
        collect_external_registry_inputs(&workspace_root, &config.external_manifests);
    let packages = build_package_records(&cargo_metadata, &config, &artifacts);
    let local_dependency_edge_count = packages
        .iter()
        .map(|package| package.local_dependency_count)
        .sum();

    let registry_document = WorkspaceRegistryDocument {
        registry_version: config.registry_version,
        workspace_root: ".".to_string(),
        package_count: packages.len(),
        local_dependency_edge_count,
        aggregator_packages: config.aggregator_packages.clone(),
        data_sources: vec![
            "cargo metadata --format-version 1 --no-deps".to_string(),
            "workspace.metadata.kos".to_string(),
            "package.metadata.kos".to_string(),
            "k-os-kain manifests".to_string(),
            "zen manifests".to_string(),
        ],
        packages,
        external_manifests,
        artifacts,
    };

    let generated_root = PathBuf::from("generated");
    let json_root = generated_root.join("json");
    let proof_root = generated_root.join("proof");
    fs::create_dir_all(&json_root).expect("create generated json directory");
    fs::create_dir_all(&proof_root).expect("create generated proof directory");

    let json_path = json_root.join("workspace_registry.json");
    let proof_path = proof_root.join("workspace_registry_summary.md");
    let public_api_json_path = json_root.join("public_api_registry.json");
    let public_api_proof_path = proof_root.join("public_api_registry_summary.md");
    let api_bloat_json_path = json_root.join("api_bloat_pressure.json");
    let api_bloat_proof_path = proof_root.join("api_bloat_pressure_summary.md");
    let integration_json_path = json_root.join("integration_registry.json");
    let integration_proof_path = proof_root.join("integration_registry_summary.md");
    let adapter_json_path = json_root.join("adapter_manifests.json");
    let adapter_proof_path = proof_root.join("adapter_manifests_summary.md");
    let json_content = serde_json::to_string_pretty(&registry_document)
        .expect("serialize workspace registry")
        + "\n";
    let proof_content = render_proof_summary(&registry_document);
    let public_api_document =
        build_public_api::collect_public_api_registry(&workspace_root, &cargo_metadata.packages);
    let public_api_json_content = serde_json::to_string_pretty(&public_api_document)
        .expect("serialize public api registry")
        + "\n";
    let public_api_proof_content =
        build_public_api::render_public_api_summary(&public_api_document);
    let api_bloat_report = build_public_api::derive_api_bloat_pressure_report(&public_api_document);
    let api_bloat_json_content = serde_json::to_string_pretty(&api_bloat_report)
        .expect("serialize api bloat pressure")
        + "\n";
    let api_bloat_proof_content =
        build_public_api::render_api_bloat_pressure_summary(&api_bloat_report);
    let integration_registry = build_integration::build_integration_registry(
        &config,
        &registry_document,
        &public_api_document,
        &api_bloat_report,
    );
    let integration_json_content = serde_json::to_string_pretty(&integration_registry)
        .expect("serialize integration registry")
        + "\n";
    let integration_proof_content =
        build_integration::render_integration_registry_summary(&integration_registry);
    let adapter_manifests = build_integration::build_adapter_manifests(&integration_registry);
    let adapter_json_content = serde_json::to_string_pretty(&adapter_manifests)
        .expect("serialize adapter manifests")
        + "\n";
    let adapter_proof_content =
        build_integration::render_adapter_manifests_summary(&adapter_manifests);

    write_if_changed(&json_path, &json_content).expect("write workspace registry json");
    write_if_changed(&proof_path, &proof_content).expect("write workspace registry proof");
    write_if_changed(&public_api_json_path, &public_api_json_content)
        .expect("write public api registry json");
    write_if_changed(&public_api_proof_path, &public_api_proof_content)
        .expect("write public api registry proof");
    write_if_changed(&api_bloat_json_path, &api_bloat_json_content)
        .expect("write api bloat pressure json");
    write_if_changed(&api_bloat_proof_path, &api_bloat_proof_content)
        .expect("write api bloat pressure proof");
    write_if_changed(&integration_json_path, &integration_json_content)
        .expect("write integration registry json");
    write_if_changed(&integration_proof_path, &integration_proof_content)
        .expect("write integration registry proof");
    write_if_changed(&adapter_json_path, &adapter_json_content)
        .expect("write adapter manifests json");
    write_if_changed(&adapter_proof_path, &adapter_proof_content)
        .expect("write adapter manifests proof");
}

impl WorkspaceConfig {
    fn from_root_metadata(root_metadata: Option<&Value>) -> Self {
        let Some(kos) = root_metadata.and_then(|metadata| metadata.get("kos")) else {
            return Self {
                registry_version: 1,
                ..Self::default()
            };
        };

        let inference = kos.get("inference");
        let external_manifests = kos
            .get("external_manifests")
            .and_then(Value::as_object)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|(key, value)| {
                        value.as_str().map(|path| (key.clone(), path.to_string()))
                    })
                    .collect::<BTreeMap<_, _>>()
            })
            .unwrap_or_default();
        let overrides = kos
            .get("overrides")
            .and_then(Value::as_object)
            .map(|items| {
                items
                    .iter()
                    .map(|(package_name, value)| {
                        (package_name.clone(), PackageOverride::from_json(value))
                    })
                    .collect::<BTreeMap<_, _>>()
            })
            .unwrap_or_default();

        Self {
            registry_version: kos
                .get("registry_version")
                .and_then(Value::as_u64)
                .unwrap_or(1) as u32,
            aggregator_packages: string_vec(kos.get("aggregator_packages")),
            default_host_support: string_vec(kos.get("default_host_support")),
            inference: InferenceConfig {
                aggregator_threshold: inference
                    .and_then(|value| value.get("aggregator_threshold"))
                    .and_then(Value::as_u64)
                    .unwrap_or(8) as usize,
                backend_dependency_markers: string_vec(
                    inference.and_then(|value| value.get("backend_dependency_markers")),
                ),
                bevy_dependency_markers: string_vec(
                    inference.and_then(|value| value.get("bevy_dependency_markers")),
                ),
                zen_dependency_markers: string_vec(
                    inference.and_then(|value| value.get("zen_dependency_markers")),
                ),
                gpu_dependency_markers: string_vec(
                    inference.and_then(|value| value.get("gpu_dependency_markers")),
                ),
                kain_dependency_markers: string_vec(
                    inference.and_then(|value| value.get("kain_dependency_markers")),
                ),
                game_prefixes: string_vec(inference.and_then(|value| value.get("game_prefixes"))),
                zen_prefixes: string_vec(inference.and_then(|value| value.get("zen_prefixes"))),
                kos_prefixes: string_vec(inference.and_then(|value| value.get("kos_prefixes"))),
            },
            external_manifests,
            overrides,
        }
    }
}

impl PackageOverride {
    fn from_json(value: &Value) -> Self {
        Self {
            roles: string_vec(value.get("roles")),
            capabilities: string_vec(value.get("capabilities")),
            hosts: string_vec(value.get("hosts")),
            notes: string_vec(value.get("notes")),
            stability_tier: value
                .get("stability_tier")
                .and_then(Value::as_str)
                .map(str::to_string),
            recommended_entrypoints: string_vec(value.get("recommended_entrypoints")),
            adapter_targets: string_vec(value.get("adapter_targets")),
        }
    }
}

fn locate_workspace_manifest() -> PathBuf {
    let current_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    for candidate in current_dir.ancestors() {
        let manifest_path = candidate.join("Cargo.toml");
        if !manifest_path.exists() {
            continue;
        }
        let Ok(contents) = fs::read_to_string(&manifest_path) else {
            continue;
        };
        if contents.contains("[workspace]") {
            return manifest_path;
        }
    }
    panic!(
        "failed to locate workspace Cargo.toml from {}",
        current_dir.display()
    );
}

fn load_cargo_metadata(workspace_manifest: &Path) -> CargoMetadataDocument {
    let cargo_executable = env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());
    let output = Command::new(cargo_executable)
        .arg("metadata")
        .arg("--format-version")
        .arg("1")
        .arg("--no-deps")
        .arg("--manifest-path")
        .arg(workspace_manifest)
        .current_dir(
            workspace_manifest
                .parent()
                .expect("workspace manifest should have a parent directory"),
        )
        .output()
        .expect("run cargo metadata");
    if !output.status.success() {
        panic!(
            "cargo metadata failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
    serde_json::from_slice(&output.stdout).expect("parse cargo metadata json")
}

fn build_package_records(
    cargo_metadata: &CargoMetadataDocument,
    config: &WorkspaceConfig,
    artifacts: &[WorkspaceArtifactRecord],
) -> Vec<WorkspacePackageRecord> {
    let workspace_root = Path::new(&cargo_metadata.workspace_root);
    let workspace_package_names = cargo_metadata
        .packages
        .iter()
        .map(|package| package.name.clone())
        .collect::<BTreeSet<_>>();

    let mut packages = Vec::new();
    for package in &cargo_metadata.packages {
        let manifest_path = Path::new(&package.manifest_path);
        let package_path = manifest_path
            .parent()
            .expect("package manifest should have a parent directory");
        let workspace_dependencies =
            collect_workspace_dependencies(package, &workspace_package_names);
        let target_names = unique_strings(package.targets.iter().map(|target| target.name.clone()));
        let target_kinds = unique_strings(
            package
                .targets
                .iter()
                .flat_map(|target| target.kind.iter().cloned()),
        );
        let features = unique_strings(package.features.keys().cloned());
        let artifact_ids = unique_strings(
            artifacts
                .iter()
                .filter(|artifact| artifact.owner_package == package.name)
                .map(|artifact| artifact.id.clone()),
        );

        let mut roles = BTreeSet::new();
        let mut capabilities = BTreeSet::new();
        let mut hosts = BTreeSet::new();
        let mut notes = Vec::new();
        let mut metadata_sources = BTreeSet::new();
        metadata_sources.insert("cargo_metadata".to_string());

        if target_kinds.iter().any(|kind| kind == "lib") {
            roles.insert("library".to_string());
        }
        if target_kinds.iter().any(|kind| kind == "bin") {
            roles.insert("binary".to_string());
        }
        if target_kinds.iter().any(|kind| kind == "custom-build") {
            capabilities.insert("build-script".to_string());
        }
        if prefix_match(&package.name, &config.inference.game_prefixes) {
            roles.insert("game-module".to_string());
            capabilities.insert("game".to_string());
            metadata_sources.insert("workspace_metadata.inference".to_string());
        }
        if prefix_match(&package.name, &config.inference.kos_prefixes) {
            capabilities.insert("k-os".to_string());
            metadata_sources.insert("workspace_metadata.inference".to_string());
        }
        if prefix_match(&package.name, &config.inference.zen_prefixes) {
            capabilities.insert("zen".to_string());
            hosts.insert("zen".to_string());
            metadata_sources.insert("workspace_metadata.inference".to_string());
        }
        if dependency_marker_match(package, &config.inference.gpu_dependency_markers) {
            capabilities.insert("gpu".to_string());
            metadata_sources.insert("workspace_metadata.inference".to_string());
        }
        if package.name == "k-os-kain"
            || dependency_marker_match(package, &config.inference.kain_dependency_markers)
        {
            capabilities.insert("kain".to_string());
            metadata_sources.insert("workspace_metadata.inference".to_string());
        }
        if package.name == "k-os-backend"
            || dependency_marker_match(package, &config.inference.backend_dependency_markers)
        {
            hosts.insert("backend".to_string());
            metadata_sources.insert("workspace_metadata.inference".to_string());
        }
        if package.name == "k-os-bevy"
            || dependency_marker_match(package, &config.inference.bevy_dependency_markers)
        {
            hosts.insert("bevy".to_string());
            metadata_sources.insert("workspace_metadata.inference".to_string());
        }
        if package.name == "zen"
            || dependency_marker_match(package, &config.inference.zen_dependency_markers)
        {
            hosts.insert("zen".to_string());
            metadata_sources.insert("workspace_metadata.inference".to_string());
        }

        let is_aggregator = config
            .aggregator_packages
            .iter()
            .any(|name| name == &package.name)
            || (workspace_dependencies.len() >= config.inference.aggregator_threshold
                && target_kinds.iter().any(|kind| kind == "bin"));
        if is_aggregator {
            roles.insert("aggregator".to_string());
            if hosts.is_empty() {
                merge_string_set(&mut hosts, &config.default_host_support);
            }
            metadata_sources.insert("workspace_metadata.inference".to_string());
        }
        if !artifact_ids.is_empty() {
            capabilities.insert("artifact-provider".to_string());
            metadata_sources.insert("manifest_extraction".to_string());
        }

        if let Some(package_metadata) = package.metadata.as_ref().and_then(|value| value.get("kos"))
        {
            let package_override = PackageOverride::from_json(package_metadata);
            merge_override(
                &package_override,
                &mut roles,
                &mut capabilities,
                &mut hosts,
                &mut notes,
            );
            metadata_sources.insert("package.metadata.kos".to_string());
        }
        if let Some(workspace_override) = config.overrides.get(&package.name) {
            merge_override(
                workspace_override,
                &mut roles,
                &mut capabilities,
                &mut hosts,
                &mut notes,
            );
            metadata_sources.insert("workspace_metadata.override".to_string());
        }

        packages.push(WorkspacePackageRecord {
            name: package.name.clone(),
            version: package.version.clone(),
            description: package.description.clone().unwrap_or_default(),
            manifest_path: relative_workspace_path(manifest_path, workspace_root),
            package_path: relative_workspace_path(package_path, workspace_root),
            target_names,
            target_kinds,
            features,
            local_dependency_count: workspace_dependencies.len(),
            workspace_dependencies,
            roles: roles.into_iter().collect(),
            capabilities: capabilities.into_iter().collect(),
            hosts: hosts.into_iter().collect(),
            artifact_count: artifact_ids.len(),
            artifact_ids,
            notes,
            metadata_sources: metadata_sources.into_iter().collect(),
            is_aggregator,
        });
    }

    packages.sort_by(|left, right| left.name.cmp(&right.name));
    packages
}

fn collect_workspace_dependencies(
    package: &CargoPackage,
    workspace_package_names: &BTreeSet<String>,
) -> Vec<String> {
    unique_strings(
        package
            .dependencies
            .iter()
            .filter(|dependency| {
                dependency.path.is_some() && workspace_package_names.contains(&dependency.name)
            })
            .map(|dependency| dependency.name.clone()),
    )
}

fn collect_external_registry_inputs(
    workspace_root: &Path,
    external_manifests: &BTreeMap<String, String>,
) -> (
    Vec<WorkspaceExternalManifestRecord>,
    Vec<WorkspaceArtifactRecord>,
) {
    let mut manifests = Vec::new();
    let mut artifacts = Vec::new();

    for (key, relative_path) in external_manifests {
        let manifest_path = workspace_root.join(relative_path);
        emit_rerun_if_changed(&manifest_path);
        match key.as_str() {
            "kain_spirv_sources" => {
                let (manifest, new_artifacts) =
                    load_kain_spirv_sources_manifest(key, relative_path, &manifest_path);
                manifests.push(manifest);
                artifacts.extend(new_artifacts);
            }
            "kain_runtime_apps" => {
                let (manifest, new_artifacts) =
                    load_kain_runtime_apps_manifest(key, relative_path, &manifest_path);
                manifests.push(manifest);
                artifacts.extend(new_artifacts);
            }
            "kain_upstream_capabilities" => {
                let (manifest, new_artifacts) =
                    load_kain_upstream_capabilities_manifest(key, relative_path, &manifest_path);
                manifests.push(manifest);
                artifacts.extend(new_artifacts);
            }
            "zen_runtime" => {
                let (manifest, new_artifacts) =
                    load_zen_runtime_manifest(key, relative_path, &manifest_path);
                manifests.push(manifest);
                artifacts.extend(new_artifacts);
            }
            "zen_modules" => {
                let (manifest, new_artifacts) =
                    load_zen_modules_manifest(key, relative_path, &manifest_path);
                manifests.push(manifest);
                artifacts.extend(new_artifacts);
            }
            "zen_host_api" => {
                let (manifest, new_artifacts) =
                    load_zen_host_api_manifest(key, relative_path, &manifest_path);
                manifests.push(manifest);
                artifacts.extend(new_artifacts);
            }
            _ => manifests.push(WorkspaceExternalManifestRecord {
                key: key.clone(),
                owner_package: infer_owner_package(key).to_string(),
                relative_path: relative_path.clone(),
                format: path_format(relative_path),
                item_count: 0,
                item_ids: Vec::new(),
            }),
        }
    }

    manifests.sort_by(|left, right| left.key.cmp(&right.key));
    artifacts.sort_by(|left, right| {
        left.owner_package
            .cmp(&right.owner_package)
            .then_with(|| left.kind.cmp(&right.kind))
            .then_with(|| left.id.cmp(&right.id))
    });
    (manifests, artifacts)
}

fn load_kain_spirv_sources_manifest(
    key: &str,
    relative_path: &str,
    manifest_path: &Path,
) -> (
    WorkspaceExternalManifestRecord,
    Vec<WorkspaceArtifactRecord>,
) {
    let items = read_json_array(manifest_path);
    let mut item_ids = Vec::new();
    let mut artifacts = Vec::new();

    for item in items {
        let Some(id) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        let label = item
            .get("label")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| title_case(id));
        let target = item
            .get("target")
            .and_then(Value::as_str)
            .unwrap_or("artifact");
        let domain = item
            .get("domain")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let source_path = item
            .get("source_path")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let compiled_path = item
            .get("compiled_path")
            .and_then(Value::as_str)
            .unwrap_or_default();

        item_ids.push(id.to_string());
        artifacts.push(WorkspaceArtifactRecord {
            id: id.to_string(),
            label,
            kind: if target == "spirv" {
                "spirv_shader".to_string()
            } else {
                target.to_string()
            },
            owner_package: "k-os-kain".to_string(),
            manifest_key: key.to_string(),
            source_path: source_path.to_string(),
            compiled_path: compiled_path.to_string(),
            namespace: String::new(),
            runtime_kind: String::new(),
            host_kind: String::new(),
            domain: domain.to_string(),
            tags: unique_strings([target.to_string(), domain.to_string()]),
        });
    }

    (
        WorkspaceExternalManifestRecord {
            key: key.to_string(),
            owner_package: "k-os-kain".to_string(),
            relative_path: relative_path.to_string(),
            format: "json".to_string(),
            item_count: item_ids.len(),
            item_ids,
        },
        artifacts,
    )
}

fn load_kain_runtime_apps_manifest(
    key: &str,
    relative_path: &str,
    manifest_path: &Path,
) -> (
    WorkspaceExternalManifestRecord,
    Vec<WorkspaceArtifactRecord>,
) {
    let items = read_json_array(manifest_path);
    let mut item_ids = Vec::new();
    let mut artifacts = Vec::new();

    for item in items {
        let Some(id) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        let label = item
            .get("label")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| title_case(id));
        let source_path = item
            .get("source_path")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let runtime_kind = item
            .get("runtime_kind")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let host_kind = item
            .get("host_kind")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let namespace = item
            .get("namespace")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let (compiled_path, tags) = item
            .get("outputs")
            .and_then(Value::as_array)
            .map(|outputs| {
                let primary_path = outputs
                    .iter()
                    .find_map(|output| output.get("path").and_then(Value::as_str))
                    .unwrap_or_default()
                    .to_string();
                let output_targets = unique_strings(outputs.iter().filter_map(|output| {
                    output
                        .get("target")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                }));
                (primary_path, output_targets)
            })
            .unwrap_or_else(|| (String::new(), Vec::new()));

        item_ids.push(id.to_string());
        artifacts.push(WorkspaceArtifactRecord {
            id: id.to_string(),
            label,
            kind: "runtime_app".to_string(),
            owner_package: "k-os-kain".to_string(),
            manifest_key: key.to_string(),
            source_path: source_path.to_string(),
            compiled_path,
            namespace: namespace.to_string(),
            runtime_kind: runtime_kind.to_string(),
            host_kind: host_kind.to_string(),
            domain: String::new(),
            tags,
        });
    }

    (
        WorkspaceExternalManifestRecord {
            key: key.to_string(),
            owner_package: "k-os-kain".to_string(),
            relative_path: relative_path.to_string(),
            format: "json".to_string(),
            item_count: item_ids.len(),
            item_ids,
        },
        artifacts,
    )
}

fn load_kain_upstream_capabilities_manifest(
    key: &str,
    relative_path: &str,
    manifest_path: &Path,
) -> (
    WorkspaceExternalManifestRecord,
    Vec<WorkspaceArtifactRecord>,
) {
    let items = read_json_array(manifest_path);
    let mut item_ids = Vec::new();
    let mut artifacts = Vec::new();

    for item in items {
        let Some(id) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        let label = item
            .get("label")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| title_case(id));
        let category = item
            .get("category")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let integration_status = item
            .get("integration_status")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let summary = item
            .get("summary")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let tags = unique_strings(
            item.get("compile_targets")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .chain(
                    item.get("runtime_kinds")
                        .and_then(Value::as_array)
                        .into_iter()
                        .flatten()
                        .filter_map(Value::as_str)
                        .map(str::to_string),
                )
                .chain(
                    item.get("host_kinds")
                        .and_then(Value::as_array)
                        .into_iter()
                        .flatten()
                        .filter_map(Value::as_str)
                        .map(str::to_string),
                )
                .chain([category.to_string(), integration_status.to_string()]),
        );

        item_ids.push(id.to_string());
        artifacts.push(WorkspaceArtifactRecord {
            id: id.to_string(),
            label,
            kind: "kain_upstream_capability".to_string(),
            owner_package: "k-os-kain".to_string(),
            manifest_key: key.to_string(),
            source_path: relative_path.to_string(),
            compiled_path: String::new(),
            namespace: summary.to_string(),
            runtime_kind: integration_status.to_string(),
            host_kind: String::new(),
            domain: category.to_string(),
            tags,
        });
    }

    (
        WorkspaceExternalManifestRecord {
            key: key.to_string(),
            owner_package: "k-os-kain".to_string(),
            relative_path: relative_path.to_string(),
            format: "json".to_string(),
            item_count: item_ids.len(),
            item_ids,
        },
        artifacts,
    )
}

fn load_zen_runtime_manifest(
    key: &str,
    relative_path: &str,
    manifest_path: &Path,
) -> (
    WorkspaceExternalManifestRecord,
    Vec<WorkspaceArtifactRecord>,
) {
    let document = read_toml_value(manifest_path);
    let mut item_ids = Vec::new();
    let mut artifacts = Vec::new();

    for manifest_reference in [
        toml_string_at(&document, &["kain", "ui", "modules_manifest_path"]),
        toml_string_at(&document, &["kain", "ui", "workspace_manifest_path"]),
        toml_string_at(&document, &["kain", "ui", "theme_manifest_path"]),
        toml_string_at(&document, &["kain", "ui", "host_api_path"]),
    ]
    .into_iter()
    .flatten()
    {
        item_ids.push(manifest_reference);
    }

    if let Some(active_shell) = toml_string_at(&document, &["kain", "ui", "active_shell"]) {
        item_ids.push(format!("active_shell:{active_shell}"));
    }

    let shader_id = toml_string_at(&document, &["renderer", "post", "shader_id"]);
    let shader_source_path = toml_string_at(&document, &["renderer", "post", "shader_source_path"]);
    let shader_compiled_path =
        toml_string_at(&document, &["renderer", "post", "shader_compiled_path"]);
    if let Some(shader_id) = shader_id {
        item_ids.push(format!("post_shader:{shader_id}"));
        artifacts.push(WorkspaceArtifactRecord {
            id: shader_id.clone(),
            label: "Zen Post Process Shader".to_string(),
            kind: "zen_post_process_shader".to_string(),
            owner_package: "zen".to_string(),
            manifest_key: key.to_string(),
            source_path: shader_source_path.unwrap_or_default(),
            compiled_path: shader_compiled_path.unwrap_or_default(),
            namespace: String::new(),
            runtime_kind: String::new(),
            host_kind: "zen".to_string(),
            domain: "renderer".to_string(),
            tags: vec!["post-process".to_string()],
        });
    }

    (
        WorkspaceExternalManifestRecord {
            key: key.to_string(),
            owner_package: "zen".to_string(),
            relative_path: relative_path.to_string(),
            format: "toml".to_string(),
            item_count: item_ids.len(),
            item_ids,
        },
        artifacts,
    )
}

fn load_zen_modules_manifest(
    key: &str,
    relative_path: &str,
    manifest_path: &Path,
) -> (
    WorkspaceExternalManifestRecord,
    Vec<WorkspaceArtifactRecord>,
) {
    let document = read_toml_value(manifest_path);
    let shells = document
        .get("shells")
        .and_then(toml::Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut item_ids = Vec::new();
    let mut artifacts = Vec::new();

    for shell in shells {
        let Some(key_value) = shell.get("key").and_then(toml::Value::as_str) else {
            continue;
        };
        let label = shell
            .get("label")
            .and_then(toml::Value::as_str)
            .unwrap_or(key_value);
        let source_path = shell
            .get("source_path")
            .and_then(toml::Value::as_str)
            .unwrap_or_default();
        let root_component = shell
            .get("root_component")
            .and_then(toml::Value::as_str)
            .unwrap_or_default();
        let tags = shell
            .get("tags")
            .and_then(toml::Value::as_array)
            .map(|items| {
                unique_strings(
                    items
                        .iter()
                        .filter_map(toml::Value::as_str)
                        .map(str::to_string),
                )
            })
            .unwrap_or_default();

        item_ids.push(key_value.to_string());
        artifacts.push(WorkspaceArtifactRecord {
            id: key_value.to_string(),
            label: label.to_string(),
            kind: "zen_shell".to_string(),
            owner_package: "zen".to_string(),
            manifest_key: key.to_string(),
            source_path: source_path.to_string(),
            compiled_path: String::new(),
            namespace: root_component.to_string(),
            runtime_kind: String::new(),
            host_kind: "zen".to_string(),
            domain: "ui".to_string(),
            tags,
        });
    }

    (
        WorkspaceExternalManifestRecord {
            key: key.to_string(),
            owner_package: "zen".to_string(),
            relative_path: relative_path.to_string(),
            format: "toml".to_string(),
            item_count: item_ids.len(),
            item_ids,
        },
        artifacts,
    )
}

fn load_zen_host_api_manifest(
    key: &str,
    relative_path: &str,
    manifest_path: &Path,
) -> (
    WorkspaceExternalManifestRecord,
    Vec<WorkspaceArtifactRecord>,
) {
    let document = read_toml_value(manifest_path);
    let mut item_ids = Vec::new();
    let mut artifacts = Vec::new();

    if let Some(actions) = document.get("actions").and_then(toml::Value::as_array) {
        for action in actions {
            let Some(key_value) = action.get("key").and_then(toml::Value::as_str) else {
                continue;
            };
            let label = action
                .get("label")
                .and_then(toml::Value::as_str)
                .unwrap_or(key_value);
            let behavior = action
                .get("behavior")
                .and_then(toml::Value::as_str)
                .unwrap_or_default();
            item_ids.push(key_value.to_string());
            artifacts.push(WorkspaceArtifactRecord {
                id: key_value.to_string(),
                label: label.to_string(),
                kind: "zen_host_action".to_string(),
                owner_package: "zen".to_string(),
                manifest_key: key.to_string(),
                source_path: relative_path.to_string(),
                compiled_path: String::new(),
                namespace: behavior.to_string(),
                runtime_kind: String::new(),
                host_kind: "zen".to_string(),
                domain: "host_api".to_string(),
                tags: Vec::new(),
            });
        }
    }

    if let Some(bindings) = document.get("bindings").and_then(toml::Value::as_array) {
        for binding in bindings {
            let Some(key_value) = binding.get("key").and_then(toml::Value::as_str) else {
                continue;
            };
            let label = binding
                .get("label")
                .and_then(toml::Value::as_str)
                .unwrap_or(key_value);
            let handler = binding
                .get("handler")
                .and_then(toml::Value::as_str)
                .unwrap_or_default();
            let widget = binding
                .get("widget")
                .and_then(toml::Value::as_str)
                .unwrap_or_default();
            item_ids.push(key_value.to_string());
            artifacts.push(WorkspaceArtifactRecord {
                id: key_value.to_string(),
                label: label.to_string(),
                kind: "zen_host_binding".to_string(),
                owner_package: "zen".to_string(),
                manifest_key: key.to_string(),
                source_path: relative_path.to_string(),
                compiled_path: String::new(),
                namespace: handler.to_string(),
                runtime_kind: String::new(),
                host_kind: "zen".to_string(),
                domain: "host_api".to_string(),
                tags: if widget.is_empty() {
                    Vec::new()
                } else {
                    vec![widget.to_string()]
                },
            });
        }
    }

    (
        WorkspaceExternalManifestRecord {
            key: key.to_string(),
            owner_package: "zen".to_string(),
            relative_path: relative_path.to_string(),
            format: "toml".to_string(),
            item_count: item_ids.len(),
            item_ids: unique_strings(item_ids),
        },
        artifacts,
    )
}

fn render_proof_summary(document: &WorkspaceRegistryDocument) -> String {
    let mut output = String::new();
    writeln!(output, "# Workspace Registry Proof").unwrap();
    writeln!(output).unwrap();
    writeln!(output, "- Registry version: {}", document.registry_version).unwrap();
    writeln!(
        output,
        "- Workspace package count: {}",
        document.package_count
    )
    .unwrap();
    writeln!(
        output,
        "- Workspace-local dependency edges: {}",
        document.local_dependency_edge_count
    )
    .unwrap();
    writeln!(
        output,
        "- Aggregators: {}",
        document.aggregator_packages.join(", ")
    )
    .unwrap();
    writeln!(
        output,
        "- External manifests: {}",
        document.external_manifests.len()
    )
    .unwrap();
    writeln!(
        output,
        "- Extracted artifacts: {}",
        document.artifacts.len()
    )
    .unwrap();
    writeln!(output).unwrap();

    writeln!(output, "## External Manifests").unwrap();
    for manifest in &document.external_manifests {
        writeln!(
            output,
            "- `{}` -> `{}` (owner `{}`, {} items)",
            manifest.key, manifest.relative_path, manifest.owner_package, manifest.item_count
        )
        .unwrap();
    }
    writeln!(output).unwrap();

    writeln!(output, "## Top Dependency Hubs").unwrap();
    let mut packages = document.packages.clone();
    packages.sort_by(|left, right| {
        right
            .local_dependency_count
            .cmp(&left.local_dependency_count)
            .then_with(|| left.name.cmp(&right.name))
    });
    for package in packages.iter().take(8) {
        writeln!(
            output,
            "- `{}`: {} local deps, hosts [{}], capabilities [{}]",
            package.name,
            package.local_dependency_count,
            package.hosts.join(", "),
            package.capabilities.join(", ")
        )
        .unwrap();
    }
    writeln!(output).unwrap();

    writeln!(output, "## Artifact Providers").unwrap();
    let mut artifact_packages = document
        .packages
        .iter()
        .filter(|package| package.artifact_count > 0)
        .collect::<Vec<_>>();
    artifact_packages.sort_by(|left, right| {
        right
            .artifact_count
            .cmp(&left.artifact_count)
            .then_with(|| left.name.cmp(&right.name))
    });
    for package in artifact_packages {
        writeln!(
            output,
            "- `{}`: {} artifacts via [{}]",
            package.name,
            package.artifact_count,
            package.metadata_sources.join(", ")
        )
        .unwrap();
    }

    output
}

fn read_json_array(path: &Path) -> Vec<Value> {
    let Ok(contents) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&contents) else {
        return Vec::new();
    };
    value.as_array().cloned().unwrap_or_default()
}

fn read_toml_value(path: &Path) -> toml::Value {
    let Ok(contents) = fs::read_to_string(path) else {
        return toml::Value::Table(toml::map::Map::new());
    };
    contents
        .parse::<toml::Value>()
        .unwrap_or_else(|_| toml::Value::Table(toml::map::Map::new()))
}

fn toml_string_at(document: &toml::Value, path: &[&str]) -> Option<String> {
    let mut current = document;
    for segment in path {
        current = current.get(*segment)?;
    }
    current.as_str().map(str::to_string)
}

fn merge_override(
    package_override: &PackageOverride,
    roles: &mut BTreeSet<String>,
    capabilities: &mut BTreeSet<String>,
    hosts: &mut BTreeSet<String>,
    notes: &mut Vec<String>,
) {
    merge_string_set(roles, &package_override.roles);
    merge_string_set(capabilities, &package_override.capabilities);
    merge_string_set(hosts, &package_override.hosts);
    notes.extend(package_override.notes.iter().cloned());
    notes.sort();
    notes.dedup();
}

fn merge_string_set(target: &mut BTreeSet<String>, values: &[String]) {
    for value in values {
        if !value.is_empty() {
            target.insert(value.clone());
        }
    }
}

fn prefix_match(value: &str, prefixes: &[String]) -> bool {
    prefixes.iter().any(|prefix| value.starts_with(prefix))
}

fn dependency_marker_match(package: &CargoPackage, markers: &[String]) -> bool {
    package
        .dependencies
        .iter()
        .any(|dependency| markers.iter().any(|marker| dependency.name == *marker))
}

fn infer_owner_package(key: &str) -> &'static str {
    if key.starts_with("kain_") {
        "k-os-kain"
    } else if key.starts_with("zen_") {
        "zen"
    } else {
        "workspace"
    }
}

fn relative_workspace_path(path: &Path, workspace_root: &Path) -> String {
    path.strip_prefix(workspace_root)
        .map(normalize_path)
        .unwrap_or_else(|_| normalize_path(path))
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn path_format(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_else(|| "unknown".to_string())
}

fn string_vec(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|items| unique_strings(items.iter().filter_map(Value::as_str).map(str::to_string)))
        .unwrap_or_default()
}

fn unique_strings<I>(values: I) -> Vec<String>
where
    I: IntoIterator<Item = String>,
{
    values
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn title_case(value: &str) -> String {
    value
        .split(['_', '-', '.'])
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => format!(
                    "{}{}",
                    first.to_ascii_uppercase(),
                    chars.as_str().to_ascii_lowercase()
                ),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn emit_rerun_if_changed(path: &Path) {
    println!("cargo:rerun-if-changed={}", path.display());
}

fn write_if_changed(path: &Path, content: &str) -> std::io::Result<()> {
    match fs::read_to_string(path) {
        Ok(existing) if existing == content => Ok(()),
        _ => fs::write(path, content),
    }
}
