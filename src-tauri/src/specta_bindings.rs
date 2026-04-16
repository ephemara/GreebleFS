use std::{fs, path::PathBuf};

use crate::archive_ops::{
    FsArchiveExtractionMode, FsArchiveExtractionRequest, FsArchiveExtractionResult,
};
use crate::cloud_commands::{
    CloudAccountSummary, CloudAccountsSnapshot, CloudAuthSession, CloudAuthStatus, CloudBreadcrumb,
    CloudDirectoryListing, CloudProviderConfigurationSource, CloudProviderConfigurationStatus,
};
use crate::desktop_integration::{NativeIconRequest, NativeIconResponse};
use crate::explorer_pro_commands::{
    ExplorerDuplicateGroup, ExplorerDuplicateScanStartResponse, ExplorerDuplicateScanStatus,
    ExplorerPathTagAssignment, ExplorerSavedSearchRecord, ExplorerSavedSearchSaveRequest,
    ExplorerTagMutationMode, ExplorerTagMutationRequest, ExplorerTagRecord, ExplorerTagSnapshot,
    ExplorerTrashActionRecord, ExplorerTrashRestoreResult, ExplorerTrashedEntryRecord,
    FsBatchRenameItem, FsBatchRenameResult,
};
use crate::fs_commands::{
    DriveInfo, EntryStorageInfo, ExplorerTaskHistoryClearScope, ExplorerTaskKind,
    ExplorerTaskProgressEvent, ExplorerTaskRecord, ExplorerTaskStatus, FileEntry,
    FileSearchContentCacheStatus, FileSearchDiagnostics, FileSearchExecutionStrategy,
    FileSearchMatchKind, FileSearchResponse, FileSearchResult, FileTransferOperation,
    FileTransferResult, FsRuntimeCachePolicy, FsWriteFileContent,
};
use crate::linux_graphics::{
    LinuxDisplayBackend, LinuxDisplayBackendPreference, LinuxDisplayBackendStatus,
};
use crate::plugin_commands::{PluginBackendResult, PluginDirectoryWatchEvent};
use crate::python_commands::{
    PythonActionResponse, PythonBoilerplateFiles, PythonCommandResult, PythonExecutionMode,
    PythonExecutionRequest, PythonInterpreterDescriptor, PythonPackageInstallRequest,
    PythonRuntimeConfig, PythonRuntimeStatus,
};
use crate::screenshot_commands::{
    SavedScreenshot, ScreenshotAnnotatedExportResult, ScreenshotAnnotation, ScreenshotPreview,
    ScreenshotRegion,
};
use crate::terminal::{ExternalTerminalRequest, TerminalWriteRequest};
use crate::wayland_dock::{WaylandDockAnchor, WaylandDockHostStatus};
use overlay_contracts::{
    ExplorerLayoutMode, LayoutBackBehavior, LayoutBarPosition, LayoutBehaviorConfig,
    LayoutChromeConfig, LayoutControlDockConfig, LayoutDockSide, LayoutInteractionConfig,
    LayoutManifest, LayoutModeExitTarget, LayoutPinnedPanel, LayoutProfile, LayoutProgressOwner,
    LayoutSurfaceOwner, ShellBlueprint, ThemeChromeStyle, ThemeDensity, ThemeIconStyle,
    ThemeMotionStyle, ThemePresentation, WorkbenchPreset,
};
use specta_typescript::{BigIntExportBehavior, Typescript};
use tauri_specta::{collect_commands, collect_events, Builder};

pub const TAURI_TYPESCRIPT_BINDINGS_PATH: &str = "../src/generated/tauri.ts";

pub fn export_bindings() -> Result<PathBuf, String> {
    let output_path = bindings_output_path();
    app_specta_builder()
        .export(
            &Typescript::default().bigint(BigIntExportBehavior::Number),
            &output_path,
        )
        .map_err(|error| format!("Failed to export Tauri Specta bindings: {error}"))?;
    sanitize_generated_typescript(&output_path)?;
    Ok(output_path)
}

pub fn bindings_output_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(TAURI_TYPESCRIPT_BINDINGS_PATH)
}

pub fn app_specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            crate::terminal::terminal_spawn,
            crate::terminal::terminal_write,
            crate::terminal::terminal_write_many,
            crate::terminal::terminal_resize,
            crate::terminal::terminal_kill,
            crate::terminal::terminal_open_external,
            crate::cloud_commands::cloud_list_accounts,
            crate::cloud_commands::cloud_set_provider_configuration,
            crate::cloud_commands::cloud_clear_provider_configuration,
            crate::cloud_commands::cloud_begin_auth,
            crate::cloud_commands::cloud_poll_auth,
            crate::cloud_commands::cloud_disconnect_account,
            crate::cloud_commands::cloud_list_dir,
            crate::cloud_commands::cloud_open_file,
            crate::cloud_commands::cloud_read_text_file,
            crate::cloud_commands::cloud_read_file_base64,
            crate::cloud_commands::cloud_write_file,
            crate::cloud_commands::cloud_create_file,
            crate::cloud_commands::cloud_create_directory,
            crate::cloud_commands::cloud_rename_path,
            crate::cloud_commands::cloud_delete_path,
            crate::cloud_commands::cloud_transfer_items,
            crate::fs_commands::fs_list_dir,
            crate::fs_commands::fs_get_drives,
            crate::fs_commands::fs_measure_entry_sizes,
            crate::entry_size_cache::fs_watch_entry_size_root,
            crate::entry_size_cache::fs_unwatch_entry_size_root,
            crate::fs_commands::fs_read_text_file,
            crate::fs_commands::fs_open_file,
            crate::fs_commands::fs_open_archive,
            crate::fs_commands::fs_extract_archive,
            crate::fs_commands::fs_open_with_dialog,
            crate::fs_commands::fs_open_as_admin,
            crate::fs_commands::fs_reveal_in_explorer,
            crate::fs_commands::fs_show_item_properties,
            crate::fs_commands::fs_delete,
            crate::fs_commands::fs_rename,
            crate::fs_commands::fs_move,
            crate::fs_commands::fs_copy,
            crate::explorer_pro_commands::fs_trash,
            crate::explorer_pro_commands::fs_restore_recent_trash_action,
            crate::explorer_pro_commands::fs_batch_rename,
            crate::explorer_pro_commands::fs_find_duplicates_start,
            crate::explorer_pro_commands::fs_find_duplicates_poll,
            crate::explorer_pro_commands::fs_find_duplicates_cancel,
            crate::fs_commands::fs_plan_transfer_items,
            crate::fs_commands::fs_transfer_items,
            crate::fs_commands::fs_list_explorer_tasks,
            crate::fs_commands::fs_clear_explorer_task_history,
            crate::fs_commands::fs_retry_explorer_task,
            crate::fs_commands::fs_cancel_explorer_task,
            crate::fs_commands::fs_create_dir,
            crate::fs_commands::fs_read_file_base64,
            crate::fs_commands::fs_read_image_thumbnail,
            crate::fs_commands::fs_write_file,
            crate::fs_commands::fs_get_runtime_cache_policy,
            crate::fs_commands::fs_list_dir_uncached,
            crate::fs_commands::fs_cancel_search_entries,
            crate::fs_commands::fs_search_entries,
            crate::fs_commands::fs_search_entries_with_diagnostics,
            crate::fs_commands::git_exec,
            crate::fs_commands::fs_get_home_dir,
            crate::fs_commands::fs_is_process_elevated,
            crate::explorer_pro_commands::explorer_tags_list,
            crate::explorer_pro_commands::explorer_tags_set_for_paths,
            crate::explorer_pro_commands::explorer_saved_searches_list,
            crate::explorer_pro_commands::explorer_saved_searches_save,
            crate::explorer_pro_commands::explorer_saved_searches_delete,
            crate::desktop_integration::fs_resolve_native_icons,
            crate::desktop_integration::fs_start_native_file_drag,
            crate::screenshot_commands::screenshot_capture_preview,
            crate::screenshot_commands::screenshot_save_region,
            crate::screenshot_commands::screenshot_export_annotated,
            crate::screenshot_commands::screenshot_copy_region_to_clipboard,
            crate::screenshot_commands::screenshot_copy_image_to_clipboard,
            crate::screenshot_commands::screenshot_read_gallery_thumbnail,
            crate::python_commands::python_get_runtime_status,
            crate::python_commands::python_bootstrap_runtime,
            crate::python_commands::python_install_packages,
            crate::python_commands::python_execute,
            crate::plugin_commands::plugin_run_backend,
            crate::plugin_commands::plugin_watch_directory,
            crate::plugin_commands::plugin_unwatch_directory,
            crate::startup_commands::startup_get_launch_at_startup,
            crate::startup_commands::startup_get_linux_display_backend_status,
            crate::startup_commands::startup_set_launch_at_startup,
            crate::startup_commands::startup_set_linux_display_backend_preference,
            crate::window_commands::tray_set_visible,
            crate::window_commands::window_get_linux_display_server,
            crate::window_commands::window_get_wayland_dock_host_status,
            crate::window_commands::window_set_blur,
            crate::window_commands::window_set_taskbar_visibility,
            crate::window_commands::window_apply_mode,
            crate::window_commands::window_apply_wayland_dock_layout,
            crate::domain_commands::domain_list_shell_blueprints,
            crate::domain_commands::domain_list_theme_manifests,
            crate::domain_commands::domain_list_workbench_presets,
        ])
        .events(collect_events![
            crate::fs_commands::ExplorerTaskProgressEvent
        ])
        .typ::<ShellBlueprint>()
        .typ::<overlay_contracts::ThemeTokenKind>()
        .typ::<overlay_contracts::ThemeLayoutPrimitiveKind>()
        .typ::<overlay_contracts::ThemeNavigationPatternKind>()
        .typ::<overlay_contracts::ThemeNavigationAxis>()
        .typ::<NativeIconRequest>()
        .typ::<NativeIconResponse>()
        .typ::<CloudProviderConfigurationSource>()
        .typ::<CloudProviderConfigurationStatus>()
        .typ::<CloudAccountSummary>()
        .typ::<CloudAccountsSnapshot>()
        .typ::<CloudAuthSession>()
        .typ::<CloudAuthStatus>()
        .typ::<CloudBreadcrumb>()
        .typ::<CloudDirectoryListing>()
        .typ::<FileEntry>()
        .typ::<FsArchiveExtractionMode>()
        .typ::<FsArchiveExtractionRequest>()
        .typ::<FsArchiveExtractionResult>()
        .typ::<DriveInfo>()
        .typ::<EntryStorageInfo>()
        .typ::<ExplorerTaskProgressEvent>()
        .typ::<ExplorerTaskKind>()
        .typ::<ExplorerTaskStatus>()
        .typ::<ExplorerTaskHistoryClearScope>()
        .typ::<ExplorerTaskRecord>()
        .typ::<FsRuntimeCachePolicy>()
        .typ::<FsWriteFileContent>()
        .typ::<ExplorerTagRecord>()
        .typ::<ExplorerPathTagAssignment>()
        .typ::<ExplorerTagSnapshot>()
        .typ::<ExplorerTagMutationMode>()
        .typ::<ExplorerTagMutationRequest>()
        .typ::<ExplorerSavedSearchRecord>()
        .typ::<ExplorerSavedSearchSaveRequest>()
        .typ::<ExplorerTrashedEntryRecord>()
        .typ::<ExplorerTrashActionRecord>()
        .typ::<ExplorerTrashRestoreResult>()
        .typ::<FsBatchRenameItem>()
        .typ::<FsBatchRenameResult>()
        .typ::<ExplorerDuplicateScanStartResponse>()
        .typ::<ExplorerDuplicateGroup>()
        .typ::<ExplorerDuplicateScanStatus>()
        .typ::<FileTransferOperation>()
        .typ::<FileTransferResult>()
        .typ::<FileSearchMatchKind>()
        .typ::<FileSearchResult>()
        .typ::<FileSearchExecutionStrategy>()
        .typ::<FileSearchContentCacheStatus>()
        .typ::<FileSearchDiagnostics>()
        .typ::<FileSearchResponse>()
        .typ::<PluginBackendResult>()
        .typ::<PluginDirectoryWatchEvent>()
        .typ::<PythonRuntimeConfig>()
        .typ::<PythonPackageInstallRequest>()
        .typ::<PythonExecutionMode>()
        .typ::<PythonExecutionRequest>()
        .typ::<PythonInterpreterDescriptor>()
        .typ::<PythonBoilerplateFiles>()
        .typ::<PythonRuntimeStatus>()
        .typ::<PythonCommandResult>()
        .typ::<PythonActionResponse>()
        .typ::<SavedScreenshot>()
        .typ::<ScreenshotRegion>()
        .typ::<ScreenshotAnnotation>()
        .typ::<ScreenshotAnnotatedExportResult>()
        .typ::<ScreenshotPreview>()
        .typ::<ExternalTerminalRequest>()
        .typ::<TerminalWriteRequest>()
        .typ::<LinuxDisplayBackend>()
        .typ::<LinuxDisplayBackendPreference>()
        .typ::<LinuxDisplayBackendStatus>()
        .typ::<WaylandDockAnchor>()
        .typ::<WaylandDockHostStatus>()
        .typ::<ThemeDensity>()
        .typ::<ThemeChromeStyle>()
        .typ::<ThemeIconStyle>()
        .typ::<ThemeMotionStyle>()
        .typ::<ThemePresentation>()
        .typ::<overlay_contracts::ThemeCompatibility>()
        .typ::<overlay_contracts::ThemeDesignToken>()
        .typ::<overlay_contracts::ThemeLayoutPrimitive>()
        .typ::<overlay_contracts::ThemeNavigationPattern>()
        .typ::<overlay_contracts::ThemeAnimationProfile>()
        .typ::<overlay_contracts::ThemeIconPackStyle>()
        .typ::<overlay_contracts::ThemeIconPackManifest>()
        .typ::<overlay_contracts::ThemeRenderStyleManifest>()
        .typ::<overlay_contracts::ThemeManifest>()
        .typ::<LayoutBarPosition>()
        .typ::<LayoutDockSide>()
        .typ::<ExplorerLayoutMode>()
        .typ::<LayoutPinnedPanel>()
        .typ::<LayoutChromeConfig>()
        .typ::<LayoutControlDockConfig>()
        .typ::<LayoutBehaviorConfig>()
        .typ::<LayoutSurfaceOwner>()
        .typ::<LayoutBackBehavior>()
        .typ::<LayoutModeExitTarget>()
        .typ::<LayoutProgressOwner>()
        .typ::<LayoutInteractionConfig>()
        .typ::<LayoutProfile>()
        .typ::<LayoutManifest>()
        .typ::<WorkbenchPreset>()
        .typ::<yazi_specta::YaziBindingStatus>()
        .typ::<yazi_specta::YaziCrateName>()
        .typ::<yazi_specta::YaziBindingManifestEntry>()
        .typ::<yazi_specta::YaziBindingManifest>()
        .typ::<yazi_specta::YaziFsSortBy>()
        .typ::<yazi_specta::YaziFsSortFallback>()
        .typ::<yazi_specta::YaziFsErrorDto>()
        .typ::<yazi_specta::YaziFsFolderStageDto>()
        .typ::<yazi_specta::YaziParserTaskSummary>()
        .typ::<yazi_specta::YaziParserSortOpt>()
        .typ::<yazi_specta::YaziParserHiddenOpt>()
        .typ::<yazi_specta::YaziParserHiddenOptState>()
        .typ::<yazi_specta::YaziSchedulerFetchProg>()
        .typ::<yazi_specta::YaziSchedulerFileProgCopy>()
        .typ::<yazi_specta::YaziSchedulerFileProgCut>()
        .typ::<yazi_specta::YaziSchedulerFileProgLink>()
        .typ::<yazi_specta::YaziSchedulerFileProgHardlink>()
        .typ::<yazi_specta::YaziSchedulerFileProgDelete>()
        .typ::<yazi_specta::YaziSchedulerFileProgTrash>()
        .typ::<yazi_specta::YaziSchedulerFileProgDownload>()
        .typ::<yazi_specta::YaziSchedulerFileProgUpload>()
        .typ::<yazi_specta::YaziSchedulerPluginProgEntry>()
        .typ::<yazi_specta::YaziSchedulerPreloadProg>()
        .typ::<yazi_specta::YaziSchedulerProcessProgBlock>()
        .typ::<yazi_specta::YaziSchedulerProcessProgOrphan>()
        .typ::<yazi_specta::YaziSchedulerProcessProgBg>()
        .typ::<yazi_specta::YaziSchedulerSizeProg>()
        .typ::<yazi_specta::YaziSchedulerTaskProg>()
        .typ::<yazi_specta::YaziSchedulerTaskSnap>()
        .constant("YAZI_BINDINGS_MANIFEST", yazi_specta::binding_manifest())
        .constant(
            "OVERLAY_THEME_MANIFESTS",
            overlay_contracts::built_in_theme_manifests(),
        )
        .constant(
            "OVERLAY_WORKBENCH_PRESETS",
            overlay_contracts::built_in_workbench_presets(),
        )
}

fn sanitize_generated_typescript(path: &PathBuf) -> Result<(), String> {
    let source = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read generated Specta bindings: {error}"))?;
    let sanitized = source
        .replace(
            "import {\n\tinvoke as TAURI_INVOKE,\n\tChannel as TAURI_CHANNEL,\n} from \"@tauri-apps/api/core\";",
            "import { invoke as TAURI_INVOKE } from \"@tauri-apps/api/core\";",
        )
        .replace(
            "export type ThemeDesignToken = { id: string; name: string; kind: ThemeTokenKind; value: any }",
            "export type ThemeValue = string | number | boolean | null | ThemeValue[] | { [key: string]: ThemeValue };\nexport type ThemeDesignToken = { id: string; name: string; kind: ThemeTokenKind; value: ThemeValue }",
        )
        .replace(
            "export type ThemeLayoutPrimitive = { id: string; name: string; kind: ThemeLayoutPrimitiveKind; props: Partial<{ [key in string]: any }> }",
            "export type ThemeLayoutPrimitive = { id: string; name: string; kind: ThemeLayoutPrimitiveKind; props: Partial<{ [key in string]: ThemeValue }> }",
        )
        .replace(
            "export type ThemeNavigationPattern = { id: string; name: string; kind: ThemeNavigationPatternKind; axis: ThemeNavigationAxis; props: Partial<{ [key in string]: any }> }",
            "export type ThemeNavigationPattern = { id: string; name: string; kind: ThemeNavigationPatternKind; axis: ThemeNavigationAxis; props: Partial<{ [key in string]: ThemeValue }> }",
        )
        .replace("function __makeEvents__<", "export function __makeEvents__<");

    if sanitized != source {
        fs::write(path, sanitized)
            .map_err(|error| format!("Failed to write sanitized Specta bindings: {error}"))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{bindings_output_path, sanitize_generated_typescript};
    use std::fs;

    #[test]
    fn sanitize_generated_typescript_removes_channel_import_and_exports_event_helper() {
        let tempdir = tempfile::tempdir().expect("tempdir");
        let path = tempdir.path().join("tauri.ts");
        fs::write(
            &path,
            "import {\n\tinvoke as TAURI_INVOKE,\n\tChannel as TAURI_CHANNEL,\n} from \"@tauri-apps/api/core\";\nfunction __makeEvents__<T>() {}\n",
        )
        .expect("seed generated bindings");

        sanitize_generated_typescript(&path).expect("sanitize generated bindings");

        let sanitized = fs::read_to_string(&path).expect("read sanitized bindings");
        assert!(
            !sanitized.contains("Channel as TAURI_CHANNEL"),
            "sanitizer should remove the unused Channel import"
        );
        assert!(
            sanitized.contains("import { invoke as TAURI_INVOKE } from \"@tauri-apps/api/core\";"),
            "sanitizer should collapse the import to the invoke binding"
        );
        assert!(
            sanitized.contains("export function __makeEvents__<T>() {}"),
            "sanitizer should export the generated event helper"
        );
    }

    #[test]
    fn bindings_output_path_targets_frontend_generated_contract() {
        let output_path = bindings_output_path();
        let normalized = output_path.to_string_lossy().replace('\\', "/");

        assert!(
            normalized.ends_with("/src/generated/tauri.ts"),
            "unexpected bindings output path: {normalized}"
        );
    }

    #[test]
    fn sanitize_generated_typescript_preserves_recursive_theme_value_contract() {
        let tempdir = tempfile::tempdir().expect("tempdir");
        let path = tempdir.path().join("tauri.ts");
        fs::write(
            &path,
            "export type ThemeDesignToken = { id: string; name: string; kind: ThemeTokenKind; value: any }\nexport type ThemeLayoutPrimitive = { id: string; name: string; kind: ThemeLayoutPrimitiveKind; props: Partial<{ [key in string]: any }> }\nexport type ThemeNavigationPattern = { id: string; name: string; kind: ThemeNavigationPatternKind; axis: ThemeNavigationAxis; props: Partial<{ [key in string]: any }> }\n",
        )
        .expect("seed generated bindings");

        sanitize_generated_typescript(&path).expect("sanitize generated bindings");

        let sanitized = fs::read_to_string(&path).expect("read sanitized bindings");
        assert!(
            sanitized.contains("export type ThemeValue = string | number | boolean | null | ThemeValue[] | { [key: string]: ThemeValue };"),
            "sanitizer should emit a recursive ThemeValue contract"
        );
        assert!(
            sanitized.contains("value: ThemeValue }"),
            "theme design token values should use the recursive ThemeValue type"
        );
        assert!(
            sanitized.contains("props: Partial<{ [key in string]: ThemeValue }> }"),
            "theme primitive and navigation props should use the recursive ThemeValue type"
        );
    }
}
