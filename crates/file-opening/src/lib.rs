use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

/// Represents an application that can open a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenWithApp {
    /// Platform-specific identifier:
    /// - macOS: bundle ID (com.apple.Preview)
    /// - Windows: application name
    /// - Linux: desktop entry ID (org.gnome.Evince.desktop)
    pub id: String,

    /// Human-readable display name
    pub name: String,

    /// Optional: app icon as base64-encoded PNG (for future use)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

/// Result of attempting to open a file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum OpenResult {
    Success,
    FileNotFound { path: String },
    AppNotFound { app_id: String },
    PermissionDenied { path: String },
    PlatformError { message: String },
}

/// Trait for platform-specific file opening implementations
pub trait FileOpener: Send + Sync {
    /// Get list of applications that can open this file
    fn get_apps_for_file(&self, path: &Path) -> Result<Vec<OpenWithApp>, String>;

    /// Get list of apps that can open all provided files (intersection)
    fn get_apps_for_files(&self, paths: &[PathBuf]) -> Result<Vec<OpenWithApp>, String> {
        if paths.is_empty() {
            return Ok(vec![]);
        }

        // Get apps for first file
        let mut common_apps = self
            .get_apps_for_file(&paths[0])?
            .into_iter()
            .map(|app| (app.id.clone(), app))
            .collect::<HashMap<_, _>>();

        // Intersect with remaining files
        for path in &paths[1..] {
            let apps = self
                .get_apps_for_file(path)?
                .into_iter()
                .map(|app| app.id)
                .collect::<HashSet<_>>();

            common_apps.retain(|id, _| apps.contains(id));
        }

        let mut result: Vec<_> = common_apps.into_values().collect();
        result.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(result)
    }

    /// Open file with system default application
    fn open_with_default(&self, path: &Path) -> Result<OpenResult, String>;

    /// Open file with specific application
    fn open_with_app(&self, path: &Path, app_id: &str) -> Result<OpenResult, String>;

    /// Open multiple files with specific application
    fn open_files_with_app(
        &self,
        paths: &[PathBuf],
        app_id: &str,
    ) -> Result<Vec<OpenResult>, String> {
        paths
            .iter()
            .map(|path| self.open_with_app(path, app_id))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::{FileOpener, OpenResult, OpenWithApp};
    use std::collections::HashMap;
    use std::path::{Path, PathBuf};
    use std::sync::Mutex;

    struct MockOpener {
        apps_by_path: HashMap<PathBuf, Result<Vec<OpenWithApp>, String>>,
        open_calls: Mutex<Vec<(PathBuf, String)>>,
    }

    impl MockOpener {
        fn new(apps_by_path: HashMap<PathBuf, Result<Vec<OpenWithApp>, String>>) -> Self {
            Self {
                apps_by_path,
                open_calls: Mutex::new(Vec::new()),
            }
        }
    }

    impl FileOpener for MockOpener {
        fn get_apps_for_file(&self, path: &Path) -> Result<Vec<OpenWithApp>, String> {
            self.apps_by_path
                .get(path)
                .cloned()
                .unwrap_or_else(|| Ok(Vec::new()))
        }

        fn open_with_default(&self, _path: &Path) -> Result<OpenResult, String> {
            Ok(OpenResult::Success)
        }

        fn open_with_app(&self, path: &Path, app_id: &str) -> Result<OpenResult, String> {
            self.open_calls
                .lock()
                .expect("open_calls lock poisoned")
                .push((path.to_path_buf(), app_id.to_string()));
            Ok(OpenResult::Success)
        }
    }

    fn app(id: &str, name: &str) -> OpenWithApp {
        OpenWithApp {
            id: id.to_string(),
            name: name.to_string(),
            icon: None,
        }
    }

    #[test]
    fn get_apps_for_files_returns_empty_for_empty_input() {
        let opener = MockOpener::new(HashMap::new());
        let apps = opener
            .get_apps_for_files(&[])
            .expect("empty input should not fail");
        assert!(apps.is_empty());
    }

    #[test]
    fn get_apps_for_files_intersects_and_sorts_by_name() {
        let one = PathBuf::from("one.txt");
        let two = PathBuf::from("two.txt");
        let three = PathBuf::from("three.txt");

        let mut map = HashMap::new();
        map.insert(
            one.clone(),
            Ok(vec![
                app("zeta", "Zeta"),
                app("alpha", "Alpha"),
                app("gamma", "Gamma"),
            ]),
        );
        map.insert(
            two.clone(),
            Ok(vec![app("gamma", "Gamma"), app("alpha", "Alpha")]),
        );
        map.insert(
            three.clone(),
            Ok(vec![app("alpha", "Alpha"), app("omega", "Omega")]),
        );

        let opener = MockOpener::new(map);
        let apps = opener
            .get_apps_for_files(&[one, two, three])
            .expect("intersection should succeed");

        assert_eq!(apps.len(), 1);
        assert_eq!(apps[0].id, "alpha");
        assert_eq!(apps[0].name, "Alpha");
    }

    #[test]
    fn get_apps_for_files_propagates_errors() {
        let one = PathBuf::from("one.txt");
        let two = PathBuf::from("two.txt");
        let mut map = HashMap::new();
        map.insert(one.clone(), Ok(vec![app("alpha", "Alpha")]));
        map.insert(two.clone(), Err("registry failed".to_string()));

        let opener = MockOpener::new(map);
        let error = opener
            .get_apps_for_files(&[one, two])
            .expect_err("error should bubble up");
        assert!(error.contains("registry failed"));
    }

    #[test]
    fn open_files_with_app_calls_each_path() {
        let one = PathBuf::from("one.txt");
        let two = PathBuf::from("two.txt");
        let opener = MockOpener::new(HashMap::new());

        let results = opener
            .open_files_with_app(&[one.clone(), two.clone()], "editor")
            .expect("open_files_with_app should succeed");
        assert_eq!(results.len(), 2);
        assert!(matches!(results[0], OpenResult::Success));
        assert!(matches!(results[1], OpenResult::Success));

        let calls = opener.open_calls.lock().expect("open_calls lock poisoned");
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[0], (one, "editor".to_string()));
        assert_eq!(calls[1], (two, "editor".to_string()));
    }
}
