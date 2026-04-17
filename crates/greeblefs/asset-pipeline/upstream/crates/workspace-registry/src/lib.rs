use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceRegistryDocument {
    pub registry_version: u32,
    pub workspace_root: String,
    pub package_count: usize,
    pub local_dependency_edge_count: usize,
    pub aggregator_packages: Vec<String>,
    pub data_sources: Vec<String>,
    pub packages: Vec<WorkspacePackageRecord>,
    pub external_manifests: Vec<WorkspaceExternalManifestRecord>,
    pub artifacts: Vec<WorkspaceArtifactRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicApiRegistryDocument {
    pub package_count: usize,
    pub total_item_count: usize,
    pub total_function_count: usize,
    pub total_method_count: usize,
    pub total_reexport_count: usize,
    pub packages: Vec<PublicApiPackageRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspacePackageRecord {
    pub name: String,
    pub version: String,
    pub description: String,
    pub manifest_path: String,
    pub package_path: String,
    pub target_names: Vec<String>,
    pub target_kinds: Vec<String>,
    pub features: Vec<String>,
    pub workspace_dependencies: Vec<String>,
    pub local_dependency_count: usize,
    pub roles: Vec<String>,
    pub capabilities: Vec<String>,
    pub hosts: Vec<String>,
    pub artifact_ids: Vec<String>,
    pub artifact_count: usize,
    pub notes: Vec<String>,
    pub metadata_sources: Vec<String>,
    pub is_aggregator: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceExternalManifestRecord {
    pub key: String,
    pub owner_package: String,
    pub relative_path: String,
    pub format: String,
    pub item_count: usize,
    pub item_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceArtifactRecord {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub owner_package: String,
    pub manifest_key: String,
    pub source_path: String,
    pub compiled_path: String,
    pub namespace: String,
    pub runtime_kind: String,
    pub host_kind: String,
    pub domain: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicApiPackageRecord {
    pub package_name: String,
    pub package_path: String,
    pub entrypoints: Vec<PublicApiEntrypointRecord>,
    pub item_count: usize,
    pub function_count: usize,
    pub method_count: usize,
    pub reexport_count: usize,
    pub items: Vec<PublicApiItemRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicApiEntrypointRecord {
    pub target_name: String,
    pub target_kind: String,
    pub src_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicApiItemRecord {
    pub target_name: String,
    pub target_kind: String,
    pub kind: String,
    pub source_kind: String,
    pub module_path: String,
    pub item_path: String,
    pub signature: String,
    pub file_path: String,
    pub owner_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiBloatPressureReport {
    pub scoring_formula: String,
    pub package_count: usize,
    pub packages: Vec<ApiBloatPressureRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiBloatPressureRecord {
    pub package_name: String,
    pub score: usize,
    pub priority: String,
    pub item_count: usize,
    pub callable_count: usize,
    pub reexport_count: usize,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationRegistryDocument {
    pub package_count: usize,
    pub host_api_count: usize,
    pub integration_count: usize,
    pub internal_count: usize,
    pub packages: Vec<IntegrationPackageRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationPackageRecord {
    pub package_name: String,
    pub stability_tier: String,
    pub capabilities: Vec<String>,
    pub adapter_targets: Vec<String>,
    pub recommended_entrypoints: Vec<String>,
    pub pressure_priority: String,
    pub pressure_score: usize,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterManifestsDocument {
    pub adapter_count: usize,
    pub adapters: Vec<AdapterManifestRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterManifestRecord {
    pub adapter_target: String,
    pub package_count: usize,
    pub packages: Vec<AdapterPackageBinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterPackageBinding {
    pub package_name: String,
    pub stability_tier: String,
    pub capabilities: Vec<String>,
    pub recommended_entrypoints: Vec<String>,
    pub pressure_priority: String,
}

static WORKSPACE_REGISTRY: OnceLock<WorkspaceRegistryDocument> = OnceLock::new();
static PUBLIC_API_REGISTRY: OnceLock<PublicApiRegistryDocument> = OnceLock::new();
static API_BLOAT_PRESSURE_REPORT: OnceLock<ApiBloatPressureReport> = OnceLock::new();
static INTEGRATION_REGISTRY: OnceLock<IntegrationRegistryDocument> = OnceLock::new();
static ADAPTER_MANIFESTS: OnceLock<AdapterManifestsDocument> = OnceLock::new();

pub fn workspace_registry_json() -> &'static str {
    include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/generated/json/workspace_registry.json"
    ))
}

pub fn workspace_registry() -> &'static WorkspaceRegistryDocument {
    WORKSPACE_REGISTRY.get_or_init(|| {
        serde_json::from_str(workspace_registry_json())
            .expect("generated workspace registry json should parse")
    })
}

pub fn public_api_registry_json() -> &'static str {
    include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/generated/json/public_api_registry.json"
    ))
}

pub fn public_api_registry() -> &'static PublicApiRegistryDocument {
    PUBLIC_API_REGISTRY.get_or_init(|| {
        serde_json::from_str(public_api_registry_json())
            .expect("generated public api registry json should parse")
    })
}

pub fn api_bloat_pressure_json() -> &'static str {
    include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/generated/json/api_bloat_pressure.json"
    ))
}

pub fn api_bloat_pressure_report() -> &'static ApiBloatPressureReport {
    API_BLOAT_PRESSURE_REPORT.get_or_init(|| {
        serde_json::from_str(api_bloat_pressure_json())
            .expect("generated api bloat pressure json should parse")
    })
}

pub fn integration_registry_json() -> &'static str {
    include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/generated/json/integration_registry.json"
    ))
}

pub fn integration_registry() -> &'static IntegrationRegistryDocument {
    INTEGRATION_REGISTRY.get_or_init(|| {
        serde_json::from_str(integration_registry_json())
            .expect("generated integration registry json should parse")
    })
}

pub fn adapter_manifests_json() -> &'static str {
    include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/generated/json/adapter_manifests.json"
    ))
}

pub fn adapter_manifests() -> &'static AdapterManifestsDocument {
    ADAPTER_MANIFESTS.get_or_init(|| {
        serde_json::from_str(adapter_manifests_json())
            .expect("generated adapter manifests json should parse")
    })
}

pub fn package_by_name(name: &str) -> Option<&'static WorkspacePackageRecord> {
    workspace_registry()
        .packages
        .iter()
        .find(|package| package.name == name)
}

pub fn external_manifest_by_key(key: &str) -> Option<&'static WorkspaceExternalManifestRecord> {
    workspace_registry()
        .external_manifests
        .iter()
        .find(|manifest| manifest.key == key)
}

pub fn artifacts_for_owner(owner_package: &str) -> Vec<&'static WorkspaceArtifactRecord> {
    workspace_registry()
        .artifacts
        .iter()
        .filter(|artifact| artifact.owner_package == owner_package)
        .collect()
}

pub fn packages_for_host(host: &str) -> Vec<&'static WorkspacePackageRecord> {
    workspace_registry()
        .packages
        .iter()
        .filter(|package| package.hosts.iter().any(|candidate| candidate == host))
        .collect()
}

pub fn public_api_for_package(package_name: &str) -> Option<&'static PublicApiPackageRecord> {
    public_api_registry()
        .packages
        .iter()
        .find(|package| package.package_name == package_name)
}

pub fn public_api_items_for_package(package_name: &str) -> Vec<&'static PublicApiItemRecord> {
    public_api_for_package(package_name)
        .map(|package| package.items.iter().collect())
        .unwrap_or_default()
}

pub fn api_bloat_pressure_for_package(
    package_name: &str,
) -> Option<&'static ApiBloatPressureRecord> {
    api_bloat_pressure_report()
        .packages
        .iter()
        .find(|package| package.package_name == package_name)
}

pub fn integration_contract_for_package(
    package_name: &str,
) -> Option<&'static IntegrationPackageRecord> {
    integration_registry()
        .packages
        .iter()
        .find(|package| package.package_name == package_name)
}

pub fn adapter_manifest_for_target(adapter_target: &str) -> Option<&'static AdapterManifestRecord> {
    adapter_manifests()
        .adapters
        .iter()
        .find(|adapter| adapter.adapter_target == adapter_target)
}
