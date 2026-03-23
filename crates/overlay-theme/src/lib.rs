use overlay_contracts::ShellBlueprintId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeDensity {
    Compact,
    #[default]
    Comfortable,
    Immersive,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeChromeStyle {
    Minimal,
    Ornate,
    #[default]
    Floating,
    System,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeIconStyle {
    System,
    #[default]
    Vector,
    Pixel,
    Skeuomorphic,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeMotionStyle {
    Snappy,
    #[default]
    Fluid,
    Dramatic,
    Instant,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ThemePresentation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub density: Option<ThemeDensity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chrome_style: Option<ThemeChromeStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_style: Option<ThemeIconStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub motion_style: Option<ThemeMotionStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub corner_radius: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub panel_spacing: Option<u16>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ThemeCompatibility {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shell_blueprints: Vec<ShellBlueprintId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ThemeManifest {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extends: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presentation: Option<ThemePresentation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub compatibility: Option<ThemeCompatibility>,
}

pub fn is_theme_compatible_with_shell(
    manifest: &ThemeManifest,
    shell_blueprint: ShellBlueprintId,
) -> bool {
    manifest
        .compatibility
        .as_ref()
        .map(|compatibility| {
            compatibility.shell_blueprints.is_empty()
                || compatibility.shell_blueprints.contains(&shell_blueprint)
        })
        .unwrap_or(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_compatibility_defaults_to_universal_support() {
        let manifest = ThemeManifest {
            id: "operator".into(),
            name: "Operator".into(),
            ..ThemeManifest::default()
        };

        assert!(is_theme_compatible_with_shell(
            &manifest,
            ShellBlueprintId::ClassicDock
        ));
        assert!(is_theme_compatible_with_shell(
            &manifest,
            ShellBlueprintId::RetroDesktop
        ));
    }

    #[test]
    fn honors_explicit_shell_compatibility() {
        let manifest: ThemeManifest = serde_json::from_str(
            r#"{
              "id": "vintage-macintosh",
              "name": "Vintage Macintosh",
              "compatibility": {
                "shellBlueprints": ["retro-desktop"],
                "tags": ["retro", "desktop"]
              }
            }"#,
        )
        .unwrap();

        assert!(is_theme_compatible_with_shell(
            &manifest,
            ShellBlueprintId::RetroDesktop
        ));
        assert!(!is_theme_compatible_with_shell(
            &manifest,
            ShellBlueprintId::ClassicDock
        ));
    }
}
