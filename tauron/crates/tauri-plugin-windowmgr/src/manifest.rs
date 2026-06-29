use crate::types::{ExecutableSpec, WindowMgrError, WindowMgrManifest};
use std::collections::HashMap;

pub fn validate_manifest(
  manifest: WindowMgrManifest,
) -> Result<HashMap<String, ExecutableSpec>, WindowMgrError> {
  let mut executable_map = HashMap::new();

  for executable in manifest.executables {
    if executable.id.trim().is_empty() {
      return Err(WindowMgrError::ManifestValidationFailed {
        message: "Executable spec is missing a non-empty id".to_string(),
      });
    }

    if executable.executable_path.trim().is_empty() {
      return Err(WindowMgrError::ManifestValidationFailed {
        message: format!("Executable '{}' is missing executablePath", executable.id),
      });
    }

    if executable_map
      .insert(executable.id.clone(), executable)
      .is_some()
    {
      return Err(WindowMgrError::ManifestValidationFailed {
        message: "Manifest contains duplicate executable ids".to_string(),
      });
    }
  }

  Ok(executable_map)
}

#[cfg(test)]
mod tests {
  use super::validate_manifest;
  use crate::types::{ExecutableSpec, WindowMgrManifest};

  fn executable(id: &str, executable_path: &str) -> ExecutableSpec {
    ExecutableSpec {
      id: id.to_string(),
      display_name: None,
      executable_path: executable_path.to_string(),
      args: Vec::new(),
      working_directory: None,
      backend_preference: Default::default(),
      short_name: None,
      icon: None,
      color: None,
      extra: Default::default(),
    }
  }

  #[test]
  fn accepts_valid_manifest() {
    let manifest = WindowMgrManifest {
      executables: vec![executable("cursor", "C:\\Cursor.exe")],
    };

    let validated = validate_manifest(manifest).expect("manifest should validate");

    assert!(validated.contains_key("cursor"));
  }

  #[test]
  fn rejects_duplicate_executable_ids() {
    let manifest = WindowMgrManifest {
      executables: vec![
        executable("cursor", "C:\\Cursor.exe"),
        executable("cursor", "C:\\Cursor2.exe"),
      ],
    };

    let error = validate_manifest(manifest).expect_err("manifest should reject duplicate ids");
    assert!(matches!(
      error,
      crate::types::WindowMgrError::ManifestValidationFailed { .. }
    ));
  }
}
