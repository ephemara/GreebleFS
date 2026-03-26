use overlay_contracts::{ShellBlueprintId, ThemeManifest};

pub use overlay_contracts::{
    LayoutPrimitiveKind, NavigationPatternKind, RenderStyleKind, ThemeAnimationProfile,
    ThemeChromeStyle, ThemeCompatibility, ThemeDensity, ThemeDesignToken, ThemeIconPackManifest,
    ThemeIconStyle, ThemeLayoutPrimitive, ThemeManifest as OverlayThemeManifest,
    ThemeMotionStyle, ThemeNavigationPattern, ThemePresentation, ThemeRenderStyleManifest,
    ThemeTokenKind,
};

pub fn is_theme_compatible_with_shell(
    manifest: &ThemeManifest,
    shell_blueprint: ShellBlueprintId,
) -> bool {
    manifest.compatibility.shell_blueprints.is_empty()
        || manifest
            .compatibility
            .shell_blueprints
            .contains(&shell_blueprint)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_compatibility_defaults_to_universal_support() {
        let manifest: ThemeManifest = serde_json::from_str(
            r#"{
              "id": "operator",
              "name": "Operator",
              "presentation": {
                "density": "comfortable",
                "chromeStyle": "floating",
                "iconStyle": "vector",
                "motionStyle": "fluid",
                "cornerRadius": 12,
                "panelSpacing": 8
              },
              "compatibility": { "shellBlueprints": [], "tags": [] },
              "designTokens": [],
              "layoutPrimitives": [],
              "navigationPatterns": [],
              "animationProfiles": [],
              "iconPacks": [],
              "renderStyles": []
            }"#,
        )
        .unwrap();

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
              "presentation": {
                "density": "comfortable",
                "chromeStyle": "floating",
                "iconStyle": "vector",
                "motionStyle": "fluid",
                "cornerRadius": 12,
                "panelSpacing": 8
              },
              "compatibility": {
                "shellBlueprints": ["retro-desktop"],
                "tags": ["retro", "desktop"]
              },
              "designTokens": [],
              "layoutPrimitives": [],
              "navigationPatterns": [],
              "animationProfiles": [],
              "iconPacks": [],
              "renderStyles": []
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
