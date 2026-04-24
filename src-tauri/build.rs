use std::collections::HashMap;
use std::env;
use std::path::{Path, PathBuf};

const CLOUD_PROVIDER_ENV_KEYS: [&str; 4] = [
    "GREEBLE_GOOGLE_DRIVE_CLIENT_ID",
    "GREEBLE_GOOGLE_DRIVE_CLIENT_SECRET",
    "GREEBLE_DROPBOX_CLIENT_ID",
    "GREEBLE_DROPBOX_CLIENT_SECRET",
];

fn main() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    let workspace_root = manifest_dir
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| manifest_dir.clone());
    let dotenv_paths = [
        workspace_root.join(".env"),
        workspace_root.join(".env.local"),
        manifest_dir.join(".env"),
        manifest_dir.join(".env.local"),
    ];

    for path in &dotenv_paths {
        println!("cargo:rerun-if-changed={}", path.display());
    }
    for key in CLOUD_PROVIDER_ENV_KEYS {
        println!("cargo:rerun-if-env-changed={key}");
    }

    let dotenv_values = load_dotenv_values(&dotenv_paths);
    for key in CLOUD_PROVIDER_ENV_KEYS {
        let bundled_value = env::var(key)
            .ok()
            .or_else(|| dotenv_values.get(key).cloned())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        if let Some(value) = bundled_value {
            println!("cargo:rustc-env={key}={value}");
        }
    }

    tauri_build::build()
}

fn load_dotenv_values(paths: &[PathBuf]) -> HashMap<String, String> {
    let mut values = HashMap::new();
    for path in paths {
        if !path.exists() {
            continue;
        }
        let Ok(iter) = dotenvy::from_path_iter(path) else {
            continue;
        };
        for item in iter.flatten() {
            values.insert(item.0, item.1);
        }
    }
    values
}
