use std::env;
use std::path::{Path, PathBuf};
use std::process;

use greeble_lib::runtime_pipeline::{
    build_extension_source, inspect_extension_source, install_extension_bundle_into,
    pack_extension_source, resolve_default_bundle_output_path, resolve_extension_install_root,
    ExtensionBuildResult, ExtensionInspection, ExtensionInstallResult, ExtensionPackResult,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
struct ExtensionDevInspection {
    inspection: ExtensionInspection,
    default_build_directory: String,
    default_bundle_path: String,
}

#[derive(Debug, Serialize)]
struct ExtensionInstallSummary {
    managed_content_root: String,
    install_root: String,
    result: ExtensionInstallResult,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let mut args = env::args().skip(1).collect::<Vec<_>>();
    let Some(command) = args.first().cloned() else {
        return Err(root_usage());
    };
    if command != "ext" {
        return Err(format!(
            "Unsupported greeble command `{command}`.\n\n{}",
            root_usage()
        ));
    }
    args.remove(0);

    let Some(subcommand) = args.first().cloned() else {
        return Err(extension_usage());
    };
    args.remove(0);

    match subcommand.as_str() {
        "dev" => run_extension_dev(args),
        "inspect" => run_extension_inspect(args),
        "build" => run_extension_build(args),
        "pack" => run_extension_pack(args),
        "install" => run_extension_install(args),
        _ => Err(format!(
            "Unsupported greeble ext subcommand `{subcommand}`.\n\n{}",
            extension_usage()
        )),
    }
}

fn run_extension_dev(mut args: Vec<String>) -> Result<(), String> {
    let json = take_flag(&mut args, "--json");
    reject_unknown_flags(&args)?;
    if args.len() != 1 {
        return Err(format!(
            "`greeble ext dev` expects exactly one <source-directory>.\n\n{}",
            extension_usage()
        ));
    }

    let source_directory = PathBuf::from(&args[0]);
    if !source_directory.is_dir() {
        return Err(format!(
            "`greeble ext dev` expects a source directory, got {}",
            source_directory.display()
        ));
    }

    let inspection = inspect_extension_source(&source_directory)?;
    let summary = ExtensionDevInspection {
        inspection,
        default_build_directory: resolve_default_build_directory(&source_directory)
            .to_string_lossy()
            .to_string(),
        default_bundle_path: resolve_default_bundle_output_path(&source_directory)
            .to_string_lossy()
            .to_string(),
    };

    if json {
        print_json(&summary)?;
    } else {
        println!("extension id: {}", summary.inspection.manifest.id);
        println!("manifest: {}", summary.inspection.manifest_path);
        println!("entries: {}", summary.inspection.entry_count);
        println!(
            "default build directory: {}",
            summary.default_build_directory
        );
        println!("default bundle path: {}", summary.default_bundle_path);
    }
    Ok(())
}

fn run_extension_inspect(mut args: Vec<String>) -> Result<(), String> {
    let json = take_flag(&mut args, "--json");
    reject_unknown_flags(&args)?;
    if args.len() != 1 {
        return Err(format!(
            "`greeble ext inspect` expects exactly one <path>.\n\n{}",
            extension_usage()
        ));
    }

    let inspection = inspect_extension_source(Path::new(&args[0]))?;
    if json {
        print_json(&inspection)?;
    } else {
        println!("source kind: {}", inspection.source_kind);
        println!("manifest: {}", inspection.manifest_path);
        println!("extension id: {}", inspection.manifest.id);
        println!(
            "api version: {}",
            inspection
                .manifest
                .api_version
                .as_deref()
                .unwrap_or("unspecified")
        );
        println!("entries: {}", inspection.entry_count);
    }
    Ok(())
}

fn run_extension_build(mut args: Vec<String>) -> Result<(), String> {
    let include_debug_sources = take_flag(&mut args, "--include-debug-sources");
    let json = take_flag(&mut args, "--json");
    reject_unknown_flags(&args)?;
    if args.is_empty() || args.len() > 2 {
        return Err(format!(
            "`greeble ext build` expects <source-directory> and an optional [output-directory].\n\n{}",
            extension_usage()
        ));
    }

    let source_directory = PathBuf::from(&args[0]);
    let output_directory = args
        .get(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| resolve_default_build_directory(&source_directory));
    let result =
        build_extension_source(&source_directory, &output_directory, include_debug_sources)?;
    print_build_result(&result, json)?;
    Ok(())
}

fn run_extension_pack(mut args: Vec<String>) -> Result<(), String> {
    let include_debug_sources = take_flag(&mut args, "--include-debug-sources");
    let json = take_flag(&mut args, "--json");
    reject_unknown_flags(&args)?;
    if args.is_empty() || args.len() > 2 {
        return Err(format!(
            "`greeble ext pack` expects <source-directory> and an optional [output-bundle].\n\n{}",
            extension_usage()
        ));
    }

    let source_directory = PathBuf::from(&args[0]);
    let output_path = args
        .get(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| resolve_default_bundle_output_path(&source_directory));
    let result = pack_extension_source(&source_directory, &output_path, include_debug_sources)?;
    print_pack_result(&result, json)?;
    Ok(())
}

fn run_extension_install(mut args: Vec<String>) -> Result<(), String> {
    let replace_existing = take_flag(&mut args, "--replace-existing");
    let json = take_flag(&mut args, "--json");
    reject_unknown_flags(&args)?;
    if args.is_empty() || args.len() > 2 {
        return Err(format!(
            "`greeble ext install` expects <bundle-path> and an optional [managed-content-root].\n\n{}",
            extension_usage()
        ));
    }

    let bundle_path = PathBuf::from(&args[0]);
    let managed_content_root = match args.get(1) {
        Some(path) => PathBuf::from(path),
        None => default_managed_content_root()?,
    };
    let install_root = resolve_extension_install_root(&managed_content_root);
    let result = install_extension_bundle_into(&bundle_path, &install_root, replace_existing)?;
    let summary = ExtensionInstallSummary {
        managed_content_root: managed_content_root.to_string_lossy().to_string(),
        install_root: install_root.to_string_lossy().to_string(),
        result,
    };

    if json {
        print_json(&summary)?;
    } else {
        println!("bundle: {}", summary.result.bundle_path);
        println!("managed content root: {}", summary.managed_content_root);
        println!("install root: {}", summary.install_root);
        println!("installed extension id: {}", summary.result.manifest.id);
        println!("install directory: {}", summary.result.install_directory);
    }
    Ok(())
}

fn resolve_default_build_directory(source_directory: &Path) -> PathBuf {
    source_directory.join(".greeble-build")
}

fn default_managed_content_root() -> Result<PathBuf, String> {
    env::current_dir()
        .map(|current_directory| current_directory.join("usr"))
        .map_err(|error| {
            format!("Failed to resolve current directory for default usr root: {error}")
        })
}

fn take_flag(args: &mut Vec<String>, flag: &str) -> bool {
    if let Some(index) = args.iter().position(|candidate| candidate == flag) {
        args.remove(index);
        true
    } else {
        false
    }
}

fn reject_unknown_flags(args: &[String]) -> Result<(), String> {
    if let Some(flag) = args.iter().find(|argument| argument.starts_with('-')) {
        return Err(format!(
            "Unsupported flag `{flag}`.\n\n{}",
            extension_usage()
        ));
    }
    Ok(())
}

fn print_build_result(result: &ExtensionBuildResult, json: bool) -> Result<(), String> {
    if json {
        print_json(result)
    } else {
        println!("source directory: {}", result.source_directory);
        println!("staging directory: {}", result.staging_directory);
        println!("manifest: {}", result.manifest_path);
        println!("extension id: {}", result.manifest.id);
        Ok(())
    }
}

fn print_pack_result(result: &ExtensionPackResult, json: bool) -> Result<(), String> {
    if json {
        print_json(result)
    } else {
        println!("source directory: {}", result.source_directory);
        println!("bundle path: {}", result.bundle_path);
        println!("extension id: {}", result.manifest.id);
        Ok(())
    }
}

fn print_json<T: Serialize>(value: &T) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Failed to serialize CLI output: {error}"))?;
    println!("{json}");
    Ok(())
}

fn root_usage() -> String {
    [
        "Usage:",
        "  greeble ext <dev|inspect|build|pack|install> ...",
        "",
        "Run `greeble ext` for extension-platform subcommands.",
    ]
    .join("\n")
}

fn extension_usage() -> String {
    [
        "Usage:",
        "  greeble ext dev <source-directory> [--json]",
        "  greeble ext inspect <path> [--json]",
        "  greeble ext build <source-directory> [output-directory] [--include-debug-sources] [--json]",
        "  greeble ext pack <source-directory> [output-bundle.gfsx] [--include-debug-sources] [--json]",
        "  greeble ext install <bundle-path> [managed-content-root] [--replace-existing] [--json]",
        "",
        "Notes:",
        "  - `install` defaults the managed-content root to `<cwd>/usr` when omitted.",
        "  - installed bundles land under `<managed-content-root>/plugins/<extension-id>`.",
    ]
    .join("\n")
}
