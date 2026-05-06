use quote::ToTokens;
use serde::Serialize;
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use syn::{File, ImplItem, Item, TraitItem, UseTree, Visibility};

#[derive(Debug, Clone, Serialize)]
pub struct PublicApiRegistryDocument {
    pub package_count: usize,
    pub total_item_count: usize,
    pub total_function_count: usize,
    pub total_method_count: usize,
    pub total_reexport_count: usize,
    pub packages: Vec<PublicApiPackageRecord>,
}

#[derive(Debug, Clone, Serialize)]
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

#[derive(Debug, Clone, Serialize)]
pub struct PublicApiEntrypointRecord {
    pub target_name: String,
    pub target_kind: String,
    pub src_path: String,
}

#[derive(Debug, Clone, Serialize)]
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

#[derive(Debug, Clone, Serialize)]
pub struct ApiBloatPressureReport {
    pub scoring_formula: String,
    pub package_count: usize,
    pub packages: Vec<ApiBloatPressureRecord>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ApiBloatPressureRecord {
    pub package_name: String,
    pub score: usize,
    pub priority: String,
    pub item_count: usize,
    pub callable_count: usize,
    pub reexport_count: usize,
    pub notes: Vec<String>,
}

pub fn collect_public_api_registry(
    workspace_root: &Path,
    packages: &[super::CargoPackage],
) -> PublicApiRegistryDocument {
    let mut package_records = packages
        .iter()
        .filter_map(|package| collect_package_public_api(workspace_root, package))
        .collect::<Vec<_>>();
    package_records.sort_by(|left, right| left.package_name.cmp(&right.package_name));

    PublicApiRegistryDocument {
        package_count: package_records.len(),
        total_item_count: package_records
            .iter()
            .map(|package| package.item_count)
            .sum(),
        total_function_count: package_records
            .iter()
            .map(|package| package.function_count)
            .sum(),
        total_method_count: package_records
            .iter()
            .map(|package| package.method_count)
            .sum(),
        total_reexport_count: package_records
            .iter()
            .map(|package| package.reexport_count)
            .sum(),
        packages: package_records,
    }
}

pub fn render_public_api_summary(document: &PublicApiRegistryDocument) -> String {
    let mut output = String::new();
    use std::fmt::Write as _;

    writeln!(output, "# Public API Proof").unwrap();
    writeln!(output).unwrap();
    writeln!(output, "- Packages scanned: {}", document.package_count).unwrap();
    writeln!(output, "- Public API items: {}", document.total_item_count).unwrap();
    writeln!(
        output,
        "- Public functions: {}",
        document.total_function_count
    )
    .unwrap();
    writeln!(output, "- Public methods: {}", document.total_method_count).unwrap();
    writeln!(
        output,
        "- Public reexports: {}",
        document.total_reexport_count
    )
    .unwrap();
    writeln!(output).unwrap();

    writeln!(output, "## Top Public Surfaces").unwrap();
    let mut packages = document.packages.clone();
    packages.sort_by(|left, right| {
        right
            .item_count
            .cmp(&left.item_count)
            .then_with(|| left.package_name.cmp(&right.package_name))
    });
    for package in packages.iter().take(10) {
        writeln!(
            output,
            "- `{}`: {} items, {} functions, {} methods, {} reexports",
            package.package_name,
            package.item_count,
            package.function_count,
            package.method_count,
            package.reexport_count
        )
        .unwrap();
    }

    output
}

pub fn derive_api_bloat_pressure_report(
    document: &PublicApiRegistryDocument,
) -> ApiBloatPressureReport {
    let mut packages = document
        .packages
        .iter()
        .map(derive_api_bloat_pressure_record)
        .collect::<Vec<_>>();
    packages.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.package_name.cmp(&right.package_name))
    });

    ApiBloatPressureReport {
        scoring_formula: "score = (callable_count * 4) + (reexport_count * 2) + item_count"
            .to_string(),
        package_count: packages.len(),
        packages,
    }
}

pub fn render_api_bloat_pressure_summary(report: &ApiBloatPressureReport) -> String {
    let mut output = String::new();
    use std::fmt::Write as _;

    writeln!(output, "# API Bloat Pressure").unwrap();
    writeln!(output).unwrap();
    writeln!(output, "- Packages ranked: {}", report.package_count).unwrap();
    writeln!(output, "- Formula: `{}`", report.scoring_formula).unwrap();
    writeln!(output).unwrap();

    writeln!(output, "## Highest Pressure").unwrap();
    for package in report.packages.iter().take(12) {
        writeln!(
            output,
            "- `{}`: score {}, priority {}, callable {}, reexports {}, items {}",
            package.package_name,
            package.score,
            package.priority,
            package.callable_count,
            package.reexport_count,
            package.item_count
        )
        .unwrap();
    }

    output
}

fn collect_package_public_api(
    workspace_root: &Path,
    package: &super::CargoPackage,
) -> Option<PublicApiPackageRecord> {
    let package_root = Path::new(&package.manifest_path).parent()?.to_path_buf();
    let relevant_targets = package
        .targets
        .iter()
        .filter_map(|target| {
            let target_kind = preferred_target_kind(&target.kind)?;
            Some((target, target_kind))
        })
        .collect::<Vec<_>>();

    if relevant_targets.is_empty() {
        return None;
    }

    let mut collector = PublicApiCollector::new(workspace_root);
    let mut entrypoints = Vec::new();
    for (target, target_kind) in relevant_targets {
        let src_path = PathBuf::from(&target.src_path);
        if !src_path.exists() {
            continue;
        }
        entrypoints.push(PublicApiEntrypointRecord {
            target_name: target.name.clone(),
            target_kind: target_kind.to_string(),
            src_path: super::relative_workspace_path(&src_path, workspace_root),
        });
        collector.scan_file(&src_path, &target.name, target_kind, &[]);
    }

    if collector.items.is_empty() && entrypoints.is_empty() {
        return None;
    }

    collector.items.sort_by(|left, right| {
        left.target_name
            .cmp(&right.target_name)
            .then_with(|| left.item_path.cmp(&right.item_path))
            .then_with(|| left.kind.cmp(&right.kind))
    });

    Some(PublicApiPackageRecord {
        package_name: package.name.clone(),
        package_path: super::relative_workspace_path(&package_root, workspace_root),
        entrypoints,
        item_count: collector.items.len(),
        function_count: collector
            .items
            .iter()
            .filter(|item| item.kind == "function" || item.kind == "trait_function")
            .count(),
        method_count: collector
            .items
            .iter()
            .filter(|item| item.kind == "method" || item.kind == "trait_method")
            .count(),
        reexport_count: collector
            .items
            .iter()
            .filter(|item| item.kind == "reexport")
            .count(),
        items: collector.items,
    })
}

fn derive_api_bloat_pressure_record(package: &PublicApiPackageRecord) -> ApiBloatPressureRecord {
    let callable_count = package.function_count + package.method_count;
    let score = (callable_count * 4) + (package.reexport_count * 2) + package.item_count;
    let priority = if score >= 1000 {
        "critical"
    } else if score >= 600 {
        "high"
    } else if score >= 250 {
        "medium"
    } else {
        "low"
    };

    let mut notes = Vec::new();
    if callable_count >= 100 {
        notes.push("callable surface is very large".to_string());
    }
    if package.reexport_count >= 50 {
        notes.push("reexport layer is heavy".to_string());
    }
    if package.item_count >= 200 {
        notes.push("overall public surface is broad".to_string());
    }
    if notes.is_empty() {
        notes.push("public surface is comparatively contained".to_string());
    }

    ApiBloatPressureRecord {
        package_name: package.package_name.clone(),
        score,
        priority: priority.to_string(),
        item_count: package.item_count,
        callable_count,
        reexport_count: package.reexport_count,
        notes,
    }
}

struct PublicApiCollector<'a> {
    workspace_root: &'a Path,
    visited_paths: BTreeSet<String>,
    items: Vec<PublicApiItemRecord>,
}

impl<'a> PublicApiCollector<'a> {
    fn new(workspace_root: &'a Path) -> Self {
        Self {
            workspace_root,
            visited_paths: BTreeSet::new(),
            items: Vec::new(),
        }
    }

    fn scan_file(
        &mut self,
        file_path: &Path,
        target_name: &str,
        target_kind: &str,
        module_segments: &[String],
    ) {
        let canonical_key = file_path.to_string_lossy().to_string();
        if !self.visited_paths.insert(canonical_key) {
            return;
        }
        super::emit_rerun_if_changed(file_path);

        let Ok(source) = fs::read_to_string(file_path) else {
            return;
        };
        let Ok(parsed_file) = syn::parse_file(&source) else {
            return;
        };

        self.scan_items(
            &parsed_file,
            file_path,
            target_name,
            target_kind,
            module_segments,
            true,
        );
    }

    fn scan_items(
        &mut self,
        parsed_file: &File,
        file_path: &Path,
        target_name: &str,
        target_kind: &str,
        module_segments: &[String],
        current_scope_public: bool,
    ) {
        for item in &parsed_file.items {
            self.scan_item(
                item,
                file_path,
                target_name,
                target_kind,
                module_segments,
                current_scope_public,
            );
        }
    }

    fn scan_item(
        &mut self,
        item: &Item,
        file_path: &Path,
        target_name: &str,
        target_kind: &str,
        module_segments: &[String],
        current_scope_public: bool,
    ) {
        match item {
            Item::Fn(item_fn) if current_scope_public && is_public_visibility(&item_fn.vis) => {
                self.push_item(
                    target_name,
                    target_kind,
                    "function",
                    "definition",
                    module_segments,
                    &item_fn.sig.ident.to_string(),
                    compact_tokens(item_fn.sig.to_token_stream().to_string()),
                    file_path,
                    "",
                );
            }
            Item::Struct(item_struct)
                if current_scope_public && is_public_visibility(&item_struct.vis) =>
            {
                self.push_item(
                    target_name,
                    target_kind,
                    "struct",
                    "definition",
                    module_segments,
                    &item_struct.ident.to_string(),
                    compact_tokens(item_struct.to_token_stream().to_string()),
                    file_path,
                    "",
                );
            }
            Item::Enum(item_enum)
                if current_scope_public && is_public_visibility(&item_enum.vis) =>
            {
                self.push_item(
                    target_name,
                    target_kind,
                    "enum",
                    "definition",
                    module_segments,
                    &item_enum.ident.to_string(),
                    compact_tokens(item_enum.to_token_stream().to_string()),
                    file_path,
                    "",
                );
            }
            Item::Trait(item_trait)
                if current_scope_public && is_public_visibility(&item_trait.vis) =>
            {
                let trait_name = item_trait.ident.to_string();
                self.push_item(
                    target_name,
                    target_kind,
                    "trait",
                    "definition",
                    module_segments,
                    &trait_name,
                    compact_tokens(item_trait.to_token_stream().to_string()),
                    file_path,
                    "",
                );
                for trait_item in &item_trait.items {
                    if let TraitItem::Fn(trait_fn) = trait_item {
                        self.push_item(
                            target_name,
                            target_kind,
                            "trait_method",
                            "definition",
                            module_segments,
                            &trait_fn.sig.ident.to_string(),
                            compact_tokens(trait_fn.sig.to_token_stream().to_string()),
                            file_path,
                            &trait_name,
                        );
                    }
                }
            }
            Item::Type(item_type)
                if current_scope_public && is_public_visibility(&item_type.vis) =>
            {
                self.push_item(
                    target_name,
                    target_kind,
                    "type_alias",
                    "definition",
                    module_segments,
                    &item_type.ident.to_string(),
                    compact_tokens(item_type.to_token_stream().to_string()),
                    file_path,
                    "",
                );
            }
            Item::Const(item_const)
                if current_scope_public && is_public_visibility(&item_const.vis) =>
            {
                self.push_item(
                    target_name,
                    target_kind,
                    "const",
                    "definition",
                    module_segments,
                    &item_const.ident.to_string(),
                    compact_tokens(item_const.to_token_stream().to_string()),
                    file_path,
                    "",
                );
            }
            Item::Static(item_static)
                if current_scope_public && is_public_visibility(&item_static.vis) =>
            {
                self.push_item(
                    target_name,
                    target_kind,
                    "static",
                    "definition",
                    module_segments,
                    &item_static.ident.to_string(),
                    compact_tokens(item_static.to_token_stream().to_string()),
                    file_path,
                    "",
                );
            }
            Item::Use(item_use) if current_scope_public && is_public_visibility(&item_use.vis) => {
                for reexport in flatten_use_tree(&item_use.tree, Vec::new()) {
                    self.push_item(
                        target_name,
                        target_kind,
                        "reexport",
                        "reexport",
                        module_segments,
                        &reexport.exported_name,
                        format!("pub use {};", reexport.source_path),
                        file_path,
                        "",
                    );
                }
            }
            Item::Impl(item_impl) if current_scope_public && item_impl.trait_.is_none() => {
                let owner_type = compact_tokens(item_impl.self_ty.to_token_stream().to_string());
                for impl_item in &item_impl.items {
                    if let ImplItem::Fn(method) = impl_item {
                        if is_public_visibility(&method.vis) {
                            self.push_item(
                                target_name,
                                target_kind,
                                "method",
                                "definition",
                                module_segments,
                                &method.sig.ident.to_string(),
                                compact_tokens(method.sig.to_token_stream().to_string()),
                                file_path,
                                &owner_type,
                            );
                        }
                    }
                }
            }
            Item::Mod(item_mod) => {
                let child_is_public = current_scope_public && is_public_visibility(&item_mod.vis);
                let mut child_segments = module_segments.to_vec();
                child_segments.push(item_mod.ident.to_string());

                if child_is_public {
                    self.push_item(
                        target_name,
                        target_kind,
                        "module",
                        "definition",
                        module_segments,
                        &item_mod.ident.to_string(),
                        compact_tokens(item_mod.to_token_stream().to_string()),
                        file_path,
                        "",
                    );
                }

                if let Some((_, items)) = &item_mod.content {
                    if child_is_public {
                        let inline_file = File {
                            shebang: None,
                            attrs: Vec::new(),
                            items: items.clone(),
                        };
                        self.scan_items(
                            &inline_file,
                            file_path,
                            target_name,
                            target_kind,
                            &child_segments,
                            child_is_public,
                        );
                    }
                } else if child_is_public {
                    if let Some(module_file_path) =
                        resolve_module_file(file_path, &item_mod.ident.to_string())
                    {
                        self.scan_file(
                            &module_file_path,
                            target_name,
                            target_kind,
                            &child_segments,
                        );
                    }
                }
            }
            _ => {}
        }
    }

    fn push_item(
        &mut self,
        target_name: &str,
        target_kind: &str,
        kind: &str,
        source_kind: &str,
        module_segments: &[String],
        item_name: &str,
        signature: String,
        file_path: &Path,
        owner_type: &str,
    ) {
        self.items.push(PublicApiItemRecord {
            target_name: target_name.to_string(),
            target_kind: target_kind.to_string(),
            kind: kind.to_string(),
            source_kind: source_kind.to_string(),
            module_path: display_module_path(module_segments),
            item_path: display_item_path(module_segments, item_name),
            signature,
            file_path: super::relative_workspace_path(file_path, self.workspace_root),
            owner_type: owner_type.to_string(),
        });
    }
}

struct ReexportLeaf {
    exported_name: String,
    source_path: String,
}

fn flatten_use_tree(tree: &UseTree, prefix: Vec<String>) -> Vec<ReexportLeaf> {
    match tree {
        UseTree::Path(path) => {
            let mut next_prefix = prefix;
            next_prefix.push(path.ident.to_string());
            flatten_use_tree(&path.tree, next_prefix)
        }
        UseTree::Name(name) => {
            let mut source_segments = prefix;
            source_segments.push(name.ident.to_string());
            vec![ReexportLeaf {
                exported_name: name.ident.to_string(),
                source_path: source_segments.join("::"),
            }]
        }
        UseTree::Rename(rename) => {
            let mut source_segments = prefix;
            source_segments.push(rename.ident.to_string());
            vec![ReexportLeaf {
                exported_name: rename.rename.to_string(),
                source_path: source_segments.join("::"),
            }]
        }
        UseTree::Glob(_) => {
            let mut source_segments = prefix;
            source_segments.push("*".to_string());
            vec![ReexportLeaf {
                exported_name: "*".to_string(),
                source_path: source_segments.join("::"),
            }]
        }
        UseTree::Group(group) => group
            .items
            .iter()
            .flat_map(|item| flatten_use_tree(item, prefix.clone()))
            .collect(),
    }
}

fn resolve_module_file(current_file_path: &Path, module_name: &str) -> Option<PathBuf> {
    let file_stem = current_file_path.file_stem()?.to_str()?;
    let parent_dir = current_file_path.parent()?;
    let module_base_dir = match file_stem {
        "lib" | "main" | "mod" => parent_dir.to_path_buf(),
        other => parent_dir.join(other),
    };

    let direct_file = module_base_dir.join(format!("{module_name}.rs"));
    if direct_file.exists() {
        return Some(direct_file);
    }

    let mod_file = module_base_dir.join(module_name).join("mod.rs");
    if mod_file.exists() {
        return Some(mod_file);
    }

    None
}

fn preferred_target_kind(kinds: &[String]) -> Option<&str> {
    if kinds
        .iter()
        .any(|kind| kind == "lib" || kind == "rlib" || kind == "cdylib")
    {
        Some("lib")
    } else if kinds.iter().any(|kind| kind == "bin") {
        Some("bin")
    } else {
        None
    }
}

fn is_public_visibility(visibility: &Visibility) -> bool {
    matches!(visibility, Visibility::Public(_))
}

fn display_module_path(module_segments: &[String]) -> String {
    if module_segments.is_empty() {
        "crate".to_string()
    } else {
        format!("crate::{}", module_segments.join("::"))
    }
}

fn display_item_path(module_segments: &[String], item_name: &str) -> String {
    if module_segments.is_empty() {
        format!("crate::{item_name}")
    } else {
        format!("crate::{}::{item_name}", module_segments.join("::"))
    }
}

fn compact_tokens(raw: String) -> String {
    raw.split_whitespace().collect::<Vec<_>>().join(" ")
}
