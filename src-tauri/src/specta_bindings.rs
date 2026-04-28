use std::{fs, path::PathBuf};

use crate::acceleration_runtime::{
    AccelerationProviderKind, AccelerationProviderStatus, AccelerationRoutingMode,
    AccelerationRuntimeRequest, AccelerationRuntimeStatusSnapshot, AccelerationWorkloadId,
    PythonAccelerationOnnxRuntimeProbe, PythonAccelerationOptionalModuleProbe,
    PythonAccelerationProbe, PythonAccelerationTorchProbe, PythonCudaDeviceInfo,
};
use crate::action_commands::{
    ActionExecutionDefinition, ActionExecutionRequest, ActionExecutionResult,
    ActionInvocationCapabilities, ActionInvocationContext, ActionInvocationEntry,
    ActionMenuContextKind, ActionOutputTarget, ActionPreviewContext, ActionRunnerKind,
    ActionSearchResultContext,
};
use crate::archive_ops::{
    FsArchiveExtractionMode, FsArchiveExtractionRequest, FsArchiveExtractionResult,
};
use crate::audio_commands::{
    AudioBatchProcessRequest, AudioBatchProcessResult, AudioPreviewAnalysis, AudioSilenceRegion,
    AudioTransformRequest, AudioTransformResult, AudioWaveformBucket,
};
use crate::audio_engine::{
    AudioDeckId, AudioDeckState, AudioEngineDeckRequest, AudioEngineGainRequest,
    AudioEngineLoadDeckRequest, AudioEngineLoadPluginRequest, AudioEngineLoopRegion,
    AudioEngineLoopRegionRequest, AudioEngineRateRequest, AudioEngineSeekRequest,
    AudioEngineSetArmedDeckRequest, AudioEngineSetPluginParameterRequest, AudioEngineStateEvent,
    AudioEngineStateSnapshot, AudioEngineSyncSelectionRequest, VstParameterState,
};
use crate::cloud_commands::{
    CloudAccountSummary, CloudAccountsSnapshot, CloudAuthSession, CloudAuthStatus, CloudBreadcrumb,
    CloudDirectoryListing, CloudProviderConfigurationSource, CloudProviderConfigurationStatus,
};
use crate::desktop_integration::{NativeIconRequest, NativeIconResponse};
use crate::explorer_pro_commands::{
    ExplorerDuplicateGroup, ExplorerDuplicateScanStartResponse, ExplorerDuplicateScanStatus,
    ExplorerPathTagAssignment, ExplorerSavedSearchRecord, ExplorerSavedSearchSaveRequest,
    ExplorerSearchMode, ExplorerTagMutationMode, ExplorerTagMutationRequest, ExplorerTagRecord,
    ExplorerTagSnapshot, ExplorerTrashActionRecord, ExplorerTrashRestoreResult,
    ExplorerTrashedEntryRecord, FsBatchRenameItem, FsBatchRenameMode, FsBatchRenamePreviewRow,
    FsBatchRenameRecipe, FsBatchRenameResult,
};
use crate::fs_commands::{
    DriveInfo, EntryStorageInfo, ExplorerTaskHistoryClearScope, ExplorerTaskKind,
    ExplorerTaskProgressEvent, ExplorerTaskRecord, ExplorerTaskStatus, FileEntry,
    FileSearchContentCacheStatus, FileSearchDiagnostics, FileSearchExecutionStrategy,
    FileSearchMatchKind, FileSearchResponse, FileSearchResult, FileTransferOperation,
    FileTransferResult, FsChecksumEntryInfo, FsItemPropertiesInfo, FsJumpFilterEntry,
    FsJumpFilterMatch, FsJumpFilterRequest, FsPermissionInfo, FsRuntimeCachePolicy,
    FsWriteFileContent,
};
use crate::gpu_runtime::{
    GpuEffectiveTier, GpuFallbackReason, GpuRuntimeConfiguration, GpuRuntimeStatusEvent,
    GpuRuntimeStatusSnapshot, GpuRuntimeWorkloadId, GpuRuntimeWorkloadStatus, GpuTierMode,
};
use crate::image_commands::{
    ImageAdjustmentState, ImageEditorExportRequest, ImageEditorExportResult,
    ImageEditorPreviewRequest, ImageEditorPreviewResult, ImageEditorSessionBootstrap,
    ImageEditorSessionCreateRequest, ImageFilterPresetDefinition, ImageFilterPresetId,
};
use crate::image_cutout_commands::{
    ImageCutoutApplyPromptsRequest, ImageCutoutCopyToClipboardRequest,
    ImageCutoutExportFilterState, ImageCutoutExportMode, ImageCutoutPreviewMask,
    ImageCutoutPromptKind, ImageCutoutPromptPoint, ImageCutoutProviderDiagnostics,
    ImageCutoutResetSessionRequest, ImageCutoutSessionOpenRequest, ImageCutoutSessionSnapshot,
    ImageCutoutStagedExportArtifact, ImageCutoutWorkflowMode,
};
use crate::lan_share::types::LanShareResult;
use crate::linux_graphics::{
    LinuxDisplayBackend, LinuxDisplayBackendPreference, LinuxDisplayBackendStatus,
    LinuxNvidiaWebkitWorkaroundMode,
};
use crate::pdf_commands::{
    PdfColorValue, PdfFormFieldDescriptor, PdfFormFieldKind, PdfFormFieldOptionDescriptor,
    PdfFormValueUpdate, PdfOverlayAnnotation, PdfOverlayAnnotationKind, PdfPageOverlayEdits,
    PdfPageRect, PdfPageRenderFitMode, PdfPageRenderRequest, PdfPageRenderResult, PdfPoint,
    PdfPreviewDocument, PdfPreviewPageDescriptor, PdfSaveEditsRequest, PdfSaveEditsResult,
};
use crate::plugin_commands::{PluginBackendResult, PluginDirectoryWatchEvent};
use crate::python_commands::{
    PythonActionResponse, PythonBoilerplateFiles, PythonCommandResult, PythonExecutionMode,
    PythonExecutionRequest, PythonInterpreterDescriptor, PythonPackageInstallRequest,
    PythonRuntimeConfig, PythonRuntimeStatus,
};
use crate::python_pyo3::{PythonEmbeddedSnippetRequest, PythonEmbeddedSnippetResponse};
use crate::python_sidecar::{
    PythonSidecarActionDescriptor, PythonSidecarActionRequest, PythonSidecarActionResponse,
    PythonSidecarPackagePreset, PythonSidecarStartResponse, PythonSidecarStatus,
    PythonSidecarWorkspaceManifest,
};
use crate::runtime_pipeline::command_runtime::{
    ExternalRuntimeCommandRequest, ExternalRuntimeCommandResult,
};
use crate::runtime_pipeline::commands::{
    RuntimeCallRequest, RuntimeDiscoveryRootDto, RuntimeListPackagesRequest,
    RuntimeListPackagesResponse, RuntimeOpenTuiRequest, RuntimePreparePackageRequest,
    RuntimePreparePackageResponse, RuntimeStartSidecarRequest, RuntimeStopSidecarRequest,
};
use crate::runtime_pipeline::discovery::{DiscoveredRuntimePackage, RuntimePackageOrigin};
use crate::runtime_pipeline::manifest::{
    RuntimeActionDescriptor, RuntimeCommandConfig, RuntimeCompiler, RuntimeKind, RuntimeManifest,
    RuntimePackagePermissions, RuntimePackagePreset, RuntimePanelConfig, RuntimeSidecarConfig,
    RuntimeTuiConfig,
};
use crate::runtime_pipeline::sidecar::{
    ExternalRuntimeSidecarCallResponse, ExternalRuntimeSidecarStatus,
};
use crate::runtime_pipeline::toolchain::{RuntimeToolchainStatus, ToolchainProbe};
use crate::runtime_pipeline::tui::ExternalRuntimeTuiLaunch;
use crate::screenshot_commands::{SavedScreenshot, ScreenshotRegion, ScreenshotStage};
use crate::semantic_search::{
    ExplorerSemanticFindSimilarRequest, ExplorerSemanticIndexBuildMode,
    ExplorerSemanticIndexBuildRequest, ExplorerSemanticIndexBuildStartResponse,
    ExplorerSemanticIndexSummary, ExplorerSemanticSearchDiagnostics,
    ExplorerSemanticSearchQueryKind, ExplorerSemanticSearchRequest, ExplorerSemanticSearchResponse,
    ExplorerSemanticSearchResult,
};
use crate::shader_preview_commands::{
    ExplorerShaderCompileRequest, ExplorerShaderCompileResult, ExplorerShaderDiagnostic,
    ExplorerShaderEntryPoint, ExplorerShaderPreviewDocument,
};
use crate::sqlite_commands::{SqliteDbInfo, SqliteTableInfo, SqliteTablePreview};
use crate::storage_commands::{
    StorageNodeKind, StoragePathSummary, StorageScanStartResponse, StorageScanStatus,
    StorageTreeNode, StorageTypeBucketSummary,
};
use crate::tailscale_commands::{TailscaleConnectRequest, TailscaleStatusSnapshot};
use crate::telemetry::{
    TelemetryCaptureMode, TelemetryConfig, TelemetryPayloadMode, TelemetryRecord,
    TelemetrySessionStatus, TelemetrySupportBundleResult,
};
use crate::terminal::{
    ExternalTerminalRequest, TerminalOutputStreamPacket, TerminalShellIntegrationRequest,
    TerminalShellIntegrationState, TerminalShellIntegrationStateEvent, TerminalShellKind,
    TerminalWriteRequest,
};
use crate::thumbnail_commands::{
    ExplorerEntryThumbnail, ExplorerEntryThumbnailRequest, ExplorerThumbnailArtifact,
    ExplorerThumbnailKind, ExplorerVideoHoverFrame,
};
use crate::video_commands::{
    ResolvedVideoPreviewSource, VideoPreviewSourceKind, VideoTrimExportRequest,
    VideoTrimExportResult,
};
use crate::video_engine::{
    VideoEngineLoadSourceRequest, VideoEngineLoopRegion, VideoEngineLoopRegionRequest,
    VideoEngineSeekRequest, VideoEngineStateEvent, VideoEngineStateSnapshot, VideoPlaybackBackend,
};
use crate::vst_commands::{VstPluginEntry, VstScanPath, VstScanPathKind};
use crate::vst_host_runtime::{
    VstEditorAttachMode, VstEditorHostRect, VstEditorSessionCreateRequest,
    VstEditorSessionRectRequest, VstEditorSessionState,
};
use crate::wayland_dock::{WaylandDockAnchor, WaylandDockHostStatus};
use greeble_ipc_contracts::{
    IpcArtifactDescriptor, IpcArtifactRef, IpcArtifactRetention, IpcRegisterArtifactPathRequest,
    IpcResourceHandle, IpcStreamHandle, IpcStreamPacketMetadata,
};
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
            crate::ipc_runtime::ipc_register_artifact_path,
            crate::ipc_runtime::ipc_release_artifact,
            crate::ipc_runtime::ipc_release_resource,
            crate::ipc_runtime::ipc_release_stream,
            crate::terminal::terminal_spawn,
            crate::terminal::terminal_open_output_stream,
            crate::terminal::terminal_write,
            crate::terminal::terminal_write_many,
            crate::terminal::terminal_resize,
            crate::terminal::terminal_kill,
            crate::terminal::terminal_register_shell_integration,
            crate::terminal::terminal_sync_cwd,
            crate::terminal::terminal_set_prompt_state,
            crate::terminal::terminal_open_external,
            crate::native_terminal::terminal_open_native,
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
            crate::remote_storage_commands::remote_list_connections,
            crate::remote_storage_commands::remote_upsert_connection,
            crate::remote_storage_commands::remote_delete_connection,
            crate::remote_storage_commands::remote_connect,
            crate::remote_storage_commands::remote_disconnect,
            crate::remote_storage_commands::remote_list_trusted_hosts,
            crate::remote_storage_commands::remote_trust_pending_host,
            crate::remote_storage_commands::remote_remove_trusted_host,
            crate::remote_storage_commands::remote_list_dir,
            crate::remote_storage_commands::remote_open_file,
            crate::remote_storage_commands::remote_read_text_file,
            crate::remote_storage_commands::remote_read_file_base64,
            crate::remote_storage_commands::remote_write_file,
            crate::remote_storage_commands::remote_create_file,
            crate::remote_storage_commands::remote_create_directory,
            crate::remote_storage_commands::remote_rename_path,
            crate::remote_storage_commands::remote_delete_path,
            crate::remote_storage_commands::remote_transfer_items,
            crate::share_commands::lan_share_start,
            crate::share_commands::lan_share_stop,
            crate::share_commands::lan_share_get_local_ip,
            crate::share_commands::mobile_share_set_theme_snapshot,
            crate::share_commands::mobile_push_get_config,
            crate::share_commands::mobile_push_register_subscription,
            crate::share_commands::mobile_push_unregister_subscription,
            crate::share_commands::mobile_push_send_download_notification,
            crate::tailscale_commands::tailscale_get_status,
            crate::tailscale_commands::tailscale_connect,
            crate::tailscale_commands::tailscale_disconnect,
            crate::sqlite_commands::sqlite_get_info,
            crate::sqlite_commands::sqlite_query_table,
            crate::sqlite_commands::sqlite_query_table_window,
            crate::fs_commands::fs_list_dir,
            crate::fs_commands::fs_get_drives,
            crate::fs_commands::fs_measure_entry_sizes,
            crate::fs_commands::fs_calculate_recursive_sizes,
            crate::fs_commands::fs_calculate_checksums,
            crate::fs_commands::fs_get_item_properties,
            crate::entry_size_cache::fs_watch_entry_size_root,
            crate::entry_size_cache::fs_unwatch_entry_size_root,
            crate::fs_commands::fs_read_text_file,
            crate::fs_commands::fs_open_file,
            crate::fs_commands::fs_open_archive,
            crate::fs_commands::fs_inspect_archive,
            crate::fs_commands::fs_list_archive_dir,
            crate::fs_commands::fs_materialize_archive_entry,
            crate::fs_commands::fs_extract_archive,
            crate::audio_commands::audio_analyze_preview,
            crate::audio_commands::audio_export_transform,
            crate::audio_commands::audio_batch_process,
            crate::audio_engine::audio_engine_prepare,
            crate::audio_engine::audio_engine_get_state,
            crate::audio_engine::audio_engine_load_deck,
            crate::audio_engine::audio_engine_unload_deck,
            crate::audio_engine::audio_engine_set_armed_deck,
            crate::audio_engine::audio_engine_play,
            crate::audio_engine::audio_engine_pause,
            crate::audio_engine::audio_engine_stop,
            crate::audio_engine::audio_engine_seek,
            crate::audio_engine::audio_engine_set_loop_region,
            crate::audio_engine::audio_engine_set_gain,
            crate::audio_engine::audio_engine_set_rate,
            crate::audio_engine::audio_engine_load_plugin,
            crate::audio_engine::audio_engine_clear_deck_plugin,
            crate::audio_engine::audio_engine_set_plugin_parameter,
            crate::audio_engine::audio_engine_sync_selection_to_armed_deck,
            crate::open_with::open_with_get_associated_programs,
            crate::open_with::open_with_launch_program,
            crate::fs_commands::fs_open_with_dialog,
            crate::fs_commands::fs_open_as_admin,
            crate::fs_commands::fs_reveal_in_explorer,
            crate::fs_commands::fs_show_item_properties,
            crate::fs_commands::fs_delete,
            crate::fs_commands::fs_delete_many,
            crate::fs_commands::fs_rename,
            crate::fs_commands::fs_move,
            crate::fs_commands::fs_copy,
            crate::explorer_pro_commands::fs_trash,
            crate::explorer_pro_commands::fs_restore_recent_trash_action,
            crate::explorer_pro_commands::fs_batch_rename_preview,
            crate::explorer_pro_commands::fs_batch_rename_apply,
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
            crate::thumbnail_commands::fs_read_entry_thumbnail,
            crate::thumbnail_commands::fs_read_entry_thumbnail_artifact,
            crate::fs_commands::fs_write_file,
            crate::fs_commands::fs_get_runtime_cache_policy,
            crate::fs_commands::fs_list_dir_uncached,
            crate::fs_commands::fs_cancel_search_entries,
            crate::fs_commands::fs_search_entries,
            crate::fs_commands::fs_search_entries_with_diagnostics,
            crate::fs_commands::fs_fuzzy_filter_entries,
            crate::fs_commands::git_exec,
            crate::fs_commands::fs_get_home_dir,
            crate::fs_commands::fs_is_process_elevated,
            crate::global_search::scan::global_search_init,
            crate::global_search::scan::global_search_get_status,
            crate::global_search::scan::global_search_start_scan,
            crate::global_search::scan::global_search_cancel_scan,
            crate::global_search::query::global_search_query,
            crate::global_search::query::global_search_query_paths,
            crate::explorer_pro_commands::explorer_tags_list,
            crate::explorer_pro_commands::explorer_tags_set_for_paths,
            crate::explorer_pro_commands::explorer_saved_searches_list,
            crate::explorer_pro_commands::explorer_saved_searches_save,
            crate::explorer_pro_commands::explorer_saved_searches_delete,
            crate::explorer_pro_commands::explorer_home_usage_list,
            crate::explorer_pro_commands::explorer_home_usage_record,
            crate::explorer_pro_commands::explorer_home_usage_clear,
            crate::semantic_search::explorer_semantic_index_get_summary,
            crate::semantic_search::explorer_semantic_index_build,
            crate::semantic_search::explorer_semantic_search,
            crate::semantic_search::explorer_semantic_find_similar,
            crate::desktop_integration::fs_resolve_native_icons,
            crate::desktop_integration::fs_start_native_file_drag,
            crate::screenshot_commands::screenshot_prepare_image_stage,
            crate::screenshot_commands::screenshot_finalize_image,
            crate::screenshot_commands::screenshot_copy_image_to_clipboard,
            crate::screenshot_commands::screenshot_delete_image_stage,
            crate::python_commands::python_get_runtime_status,
            crate::python_commands::python_bootstrap_runtime,
            crate::python_commands::python_install_packages,
            crate::python_commands::python_execute,
            crate::python_sidecar::python_get_sidecar_status,
            crate::python_sidecar::python_start_sidecar,
            crate::python_sidecar::python_stop_sidecar,
            crate::python_sidecar::python_sidecar_call,
            crate::python_pyo3::python_execute_embedded,
            crate::runtime_pipeline::commands::runtime_list_packages,
            crate::runtime_pipeline::commands::runtime_get_toolchain_status,
            crate::runtime_pipeline::commands::runtime_prepare_package,
            crate::runtime_pipeline::commands::runtime_start_sidecar,
            crate::runtime_pipeline::commands::runtime_stop_sidecar,
            crate::runtime_pipeline::commands::runtime_call,
            crate::runtime_pipeline::commands::runtime_run_command,
            crate::runtime_pipeline::commands::runtime_open_tui,
            crate::runtime_pipeline::commands::extension_host_get_api_schema,
            crate::runtime_pipeline::commands::extension_host_call,
            crate::runtime_pipeline::commands::extension_inspect,
            crate::runtime_pipeline::commands::extension_build,
            crate::runtime_pipeline::commands::extension_pack,
            crate::runtime_pipeline::commands::extension_install,
            crate::acceleration_runtime::acceleration_runtime_get_status,
            crate::action_commands::action_execute,
            crate::plugin_commands::plugin_run_backend,
            crate::plugin_commands::plugin_watch_directory,
            crate::plugin_commands::plugin_unwatch_directory,
            crate::vst_commands::vst_get_default_scan_paths,
            crate::vst_commands::vst_scan_plugins,
            crate::vst_host_runtime::vst_host_create_editor_session,
            crate::vst_host_runtime::vst_host_update_editor_session_rect,
            crate::vst_host_runtime::vst_host_focus_editor_session,
            crate::vst_host_runtime::vst_host_destroy_editor_session,
            crate::image_commands::image_editor_create_session,
            crate::image_commands::image_editor_render_preview,
            crate::image_commands::image_editor_export,
            crate::image_commands::image_editor_close_session,
            crate::image_cutout_commands::image_cutout_open_session,
            crate::image_cutout_commands::image_cutout_apply_prompts,
            crate::image_cutout_commands::image_cutout_reset_session,
            crate::image_cutout_commands::image_cutout_stage_export,
            crate::image_cutout_commands::image_cutout_copy_to_clipboard,
            crate::image_cutout_commands::image_cutout_close_session,
            crate::gpu_runtime::gpu_runtime_configure,
            crate::gpu_runtime::gpu_runtime_get_status,
            crate::pdf_commands::pdf_open_preview_document,
            crate::pdf_commands::pdf_render_preview_page,
            crate::pdf_commands::pdf_save_preview_edits,
            crate::pdf_commands::pdf_close_preview_document,
            crate::shader_preview_commands::shader_preview_inspect,
            crate::shader_preview_commands::shader_preview_compile,
            crate::video_commands::video_create_preview_proxy,
            crate::video_commands::video_export_trim,
            crate::video_commands::video_resolve_preview_source,
            crate::video_engine::video_engine_prepare,
            crate::video_engine::video_engine_get_state,
            crate::video_engine::video_engine_load_source,
            crate::video_engine::video_engine_play,
            crate::video_engine::video_engine_pause,
            crate::video_engine::video_engine_stop,
            crate::video_engine::video_engine_seek,
            crate::video_engine::video_engine_set_loop_region,
            crate::startup_commands::startup_get_launch_at_startup,
            crate::startup_commands::startup_get_linux_display_backend_status,
            crate::startup_commands::startup_resolve_managed_content_roots,
            crate::startup_commands::startup_set_launch_at_startup,
            crate::startup_commands::startup_set_linux_display_backend_preference,
            crate::startup_commands::startup_set_linux_nvidia_webkit_workaround_mode,
            crate::storage_commands::storage_scan_start,
            crate::storage_commands::storage_scan_poll,
            crate::storage_commands::storage_scan_list_directory,
            crate::storage_commands::storage_scan_cancel,
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
            crate::telemetry::telemetry_configure,
            crate::telemetry::telemetry_get_status,
            crate::telemetry::telemetry_get_recent_records,
            crate::telemetry::telemetry_record_frontend_batch,
            crate::telemetry::telemetry_export_support_bundle,
            crate::telemetry::telemetry_clear_sessions,
        ])
        .events(collect_events![
            crate::fs_commands::ExplorerTaskProgressEvent,
            crate::audio_engine::AudioEngineStateEvent,
            crate::video_engine::VideoEngineStateEvent,
            crate::terminal::TerminalShellIntegrationStateEvent,
            crate::gpu_runtime::GpuRuntimeStatusEvent,
            crate::telemetry::TelemetryRecordEvent
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
        .typ::<IpcArtifactRetention>()
        .typ::<IpcRegisterArtifactPathRequest>()
        .typ::<IpcArtifactRef>()
        .typ::<IpcArtifactDescriptor>()
        .typ::<IpcResourceHandle>()
        .typ::<IpcStreamHandle>()
        .typ::<IpcStreamPacketMetadata>()
        .typ::<CloudAccountSummary>()
        .typ::<CloudAccountsSnapshot>()
        .typ::<CloudAuthSession>()
        .typ::<CloudAuthStatus>()
        .typ::<CloudBreadcrumb>()
        .typ::<CloudDirectoryListing>()
        .typ::<SqliteDbInfo>()
        .typ::<SqliteTableInfo>()
        .typ::<SqliteTablePreview>()
        .typ::<TelemetryCaptureMode>()
        .typ::<TelemetryPayloadMode>()
        .typ::<TelemetryConfig>()
        .typ::<TelemetryRecord>()
        .typ::<TelemetrySessionStatus>()
        .typ::<TelemetrySupportBundleResult>()
        .typ::<FileEntry>()
        .typ::<LanShareResult>()
        .typ::<TailscaleStatusSnapshot>()
        .typ::<TailscaleConnectRequest>()
        .typ::<FsArchiveExtractionMode>()
        .typ::<FsArchiveExtractionRequest>()
        .typ::<FsArchiveExtractionResult>()
        .typ::<AudioWaveformBucket>()
        .typ::<AudioSilenceRegion>()
        .typ::<AudioPreviewAnalysis>()
        .typ::<AudioTransformRequest>()
        .typ::<AudioTransformResult>()
        .typ::<AudioBatchProcessRequest>()
        .typ::<AudioBatchProcessResult>()
        .typ::<AudioDeckId>()
        .typ::<AudioDeckState>()
        .typ::<AudioEngineLoopRegion>()
        .typ::<AudioEngineStateSnapshot>()
        .typ::<AudioEngineStateEvent>()
        .typ::<AudioEngineLoadDeckRequest>()
        .typ::<AudioEngineLoadPluginRequest>()
        .typ::<VstParameterState>()
        .typ::<AudioEngineDeckRequest>()
        .typ::<AudioEngineSeekRequest>()
        .typ::<AudioEngineLoopRegionRequest>()
        .typ::<AudioEngineGainRequest>()
        .typ::<AudioEngineRateRequest>()
        .typ::<AudioEngineSetArmedDeckRequest>()
        .typ::<AudioEngineSetPluginParameterRequest>()
        .typ::<AudioEngineSyncSelectionRequest>()
        .typ::<ActionRunnerKind>()
        .typ::<ActionOutputTarget>()
        .typ::<ActionMenuContextKind>()
        .typ::<ActionExecutionDefinition>()
        .typ::<ActionInvocationEntry>()
        .typ::<ActionPreviewContext>()
        .typ::<ActionSearchResultContext>()
        .typ::<ActionInvocationCapabilities>()
        .typ::<ActionInvocationContext>()
        .typ::<ActionExecutionRequest>()
        .typ::<ActionExecutionResult>()
        .typ::<DriveInfo>()
        .typ::<EntryStorageInfo>()
        .typ::<ExplorerTaskProgressEvent>()
        .typ::<ExplorerTaskKind>()
        .typ::<ExplorerTaskStatus>()
        .typ::<ExplorerTaskHistoryClearScope>()
        .typ::<ExplorerTaskRecord>()
        .typ::<FsRuntimeCachePolicy>()
        .typ::<FsWriteFileContent>()
        .typ::<ImageAdjustmentState>()
        .typ::<ImageFilterPresetId>()
        .typ::<ImageFilterPresetDefinition>()
        .typ::<ImageEditorSessionCreateRequest>()
        .typ::<ImageEditorSessionBootstrap>()
        .typ::<ImageEditorPreviewRequest>()
        .typ::<ImageEditorPreviewResult>()
        .typ::<ImageEditorExportRequest>()
        .typ::<ImageEditorExportResult>()
        .typ::<ImageCutoutPromptKind>()
        .typ::<ImageCutoutPromptPoint>()
        .typ::<ImageCutoutPreviewMask>()
        .typ::<ImageCutoutProviderDiagnostics>()
        .typ::<ImageCutoutWorkflowMode>()
        .typ::<ImageCutoutSessionOpenRequest>()
        .typ::<ImageCutoutApplyPromptsRequest>()
        .typ::<ImageCutoutResetSessionRequest>()
        .typ::<ImageCutoutExportFilterState>()
        .typ::<ImageCutoutExportMode>()
        .typ::<ImageCutoutCopyToClipboardRequest>()
        .typ::<ImageCutoutSessionSnapshot>()
        .typ::<ImageCutoutStagedExportArtifact>()
        .typ::<GpuTierMode>()
        .typ::<GpuEffectiveTier>()
        .typ::<GpuFallbackReason>()
        .typ::<GpuRuntimeWorkloadId>()
        .typ::<GpuRuntimeConfiguration>()
        .typ::<GpuRuntimeWorkloadStatus>()
        .typ::<GpuRuntimeStatusSnapshot>()
        .typ::<GpuRuntimeStatusEvent>()
        .typ::<PdfPreviewDocument>()
        .typ::<PdfPreviewPageDescriptor>()
        .typ::<PdfPageRenderFitMode>()
        .typ::<PdfPageRenderRequest>()
        .typ::<PdfPageRenderResult>()
        .typ::<PdfFormFieldKind>()
        .typ::<PdfFormFieldOptionDescriptor>()
        .typ::<PdfPageRect>()
        .typ::<PdfPoint>()
        .typ::<PdfColorValue>()
        .typ::<PdfFormFieldDescriptor>()
        .typ::<PdfOverlayAnnotationKind>()
        .typ::<PdfOverlayAnnotation>()
        .typ::<PdfPageOverlayEdits>()
        .typ::<PdfFormValueUpdate>()
        .typ::<PdfSaveEditsRequest>()
        .typ::<PdfSaveEditsResult>()
        .typ::<ExplorerTagRecord>()
        .typ::<ExplorerPathTagAssignment>()
        .typ::<ExplorerTagSnapshot>()
        .typ::<ExplorerTagMutationMode>()
        .typ::<ExplorerTagMutationRequest>()
        .typ::<ExplorerSearchMode>()
        .typ::<ExplorerSavedSearchRecord>()
        .typ::<ExplorerSavedSearchSaveRequest>()
        .typ::<ExplorerSemanticIndexBuildMode>()
        .typ::<ExplorerSemanticSearchQueryKind>()
        .typ::<ExplorerSemanticIndexSummary>()
        .typ::<ExplorerSemanticIndexBuildRequest>()
        .typ::<ExplorerSemanticIndexBuildStartResponse>()
        .typ::<ExplorerSemanticSearchRequest>()
        .typ::<ExplorerSemanticFindSimilarRequest>()
        .typ::<ExplorerSemanticSearchResult>()
        .typ::<ExplorerSemanticSearchDiagnostics>()
        .typ::<ExplorerSemanticSearchResponse>()
        .typ::<ExplorerTrashedEntryRecord>()
        .typ::<ExplorerTrashActionRecord>()
        .typ::<ExplorerTrashRestoreResult>()
        .typ::<FsBatchRenameItem>()
        .typ::<FsBatchRenameMode>()
        .typ::<FsBatchRenameRecipe>()
        .typ::<FsBatchRenamePreviewRow>()
        .typ::<FsBatchRenameResult>()
        .typ::<ExplorerDuplicateScanStartResponse>()
        .typ::<ExplorerDuplicateGroup>()
        .typ::<ExplorerDuplicateScanStatus>()
        .typ::<FsChecksumEntryInfo>()
        .typ::<FsPermissionInfo>()
        .typ::<FsItemPropertiesInfo>()
        .typ::<FsJumpFilterEntry>()
        .typ::<FsJumpFilterRequest>()
        .typ::<FsJumpFilterMatch>()
        .typ::<FileTransferOperation>()
        .typ::<FileTransferResult>()
        .typ::<FileSearchMatchKind>()
        .typ::<FileSearchResult>()
        .typ::<FileSearchExecutionStrategy>()
        .typ::<FileSearchContentCacheStatus>()
        .typ::<FileSearchDiagnostics>()
        .typ::<FileSearchResponse>()
        .typ::<ExplorerThumbnailKind>()
        .typ::<ExplorerVideoHoverFrame>()
        .typ::<ExplorerEntryThumbnail>()
        .typ::<ExplorerEntryThumbnailRequest>()
        .typ::<ExplorerThumbnailArtifact>()
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
        .typ::<PythonSidecarPackagePreset>()
        .typ::<PythonSidecarActionDescriptor>()
        .typ::<PythonSidecarWorkspaceManifest>()
        .typ::<PythonSidecarStatus>()
        .typ::<PythonSidecarStartResponse>()
        .typ::<PythonSidecarActionRequest>()
        .typ::<PythonSidecarActionResponse>()
        .typ::<AccelerationRoutingMode>()
        .typ::<AccelerationProviderKind>()
        .typ::<AccelerationWorkloadId>()
        .typ::<AccelerationRuntimeRequest>()
        .typ::<AccelerationProviderStatus>()
        .typ::<PythonCudaDeviceInfo>()
        .typ::<PythonAccelerationTorchProbe>()
        .typ::<PythonAccelerationOnnxRuntimeProbe>()
        .typ::<PythonAccelerationOptionalModuleProbe>()
        .typ::<PythonAccelerationProbe>()
        .typ::<AccelerationRuntimeStatusSnapshot>()
        .typ::<PythonEmbeddedSnippetRequest>()
        .typ::<PythonEmbeddedSnippetResponse>()
        .typ::<RuntimeKind>()
        .typ::<RuntimeCompiler>()
        .typ::<RuntimePackagePermissions>()
        .typ::<RuntimePackagePreset>()
        .typ::<RuntimeActionDescriptor>()
        .typ::<RuntimePanelConfig>()
        .typ::<RuntimeCommandConfig>()
        .typ::<RuntimeSidecarConfig>()
        .typ::<RuntimeTuiConfig>()
        .typ::<RuntimeManifest>()
        .typ::<RuntimePackageOrigin>()
        .typ::<DiscoveredRuntimePackage>()
        .typ::<RuntimeDiscoveryRootDto>()
        .typ::<RuntimeListPackagesRequest>()
        .typ::<RuntimeListPackagesResponse>()
        .typ::<RuntimePreparePackageRequest>()
        .typ::<RuntimePreparePackageResponse>()
        .typ::<RuntimeStartSidecarRequest>()
        .typ::<RuntimeStopSidecarRequest>()
        .typ::<RuntimeCallRequest>()
        .typ::<RuntimeOpenTuiRequest>()
        .typ::<ToolchainProbe>()
        .typ::<RuntimeToolchainStatus>()
        .typ::<ExternalRuntimeSidecarStatus>()
        .typ::<ExternalRuntimeSidecarCallResponse>()
        .typ::<ExternalRuntimeCommandRequest>()
        .typ::<ExternalRuntimeCommandResult>()
        .typ::<ExternalRuntimeTuiLaunch>()
        .typ::<ExplorerShaderPreviewDocument>()
        .typ::<ExplorerShaderEntryPoint>()
        .typ::<ExplorerShaderDiagnostic>()
        .typ::<ExplorerShaderCompileRequest>()
        .typ::<ExplorerShaderCompileResult>()
        .typ::<SavedScreenshot>()
        .typ::<ScreenshotRegion>()
        .typ::<ScreenshotStage>()
        .typ::<ExternalTerminalRequest>()
        .typ::<TerminalOutputStreamPacket>()
        .typ::<TerminalShellKind>()
        .typ::<TerminalShellIntegrationState>()
        .typ::<TerminalShellIntegrationRequest>()
        .typ::<TerminalShellIntegrationStateEvent>()
        .typ::<TerminalWriteRequest>()
        .typ::<VideoPreviewSourceKind>()
        .typ::<ResolvedVideoPreviewSource>()
        .typ::<VideoTrimExportRequest>()
        .typ::<VideoTrimExportResult>()
        .typ::<VideoPlaybackBackend>()
        .typ::<VideoEngineLoopRegion>()
        .typ::<VideoEngineStateSnapshot>()
        .typ::<VideoEngineStateEvent>()
        .typ::<VideoEngineLoadSourceRequest>()
        .typ::<VideoEngineSeekRequest>()
        .typ::<VideoEngineLoopRegionRequest>()
        .typ::<LinuxDisplayBackend>()
        .typ::<LinuxDisplayBackendPreference>()
        .typ::<LinuxDisplayBackendStatus>()
        .typ::<LinuxNvidiaWebkitWorkaroundMode>()
        .typ::<WaylandDockAnchor>()
        .typ::<WaylandDockHostStatus>()
        .typ::<VstScanPath>()
        .typ::<VstScanPathKind>()
        .typ::<VstPluginEntry>()
        .typ::<VstEditorAttachMode>()
        .typ::<VstEditorHostRect>()
        .typ::<VstEditorSessionState>()
        .typ::<VstEditorSessionCreateRequest>()
        .typ::<VstEditorSessionRectRequest>()
        .typ::<StorageNodeKind>()
        .typ::<StoragePathSummary>()
        .typ::<StorageScanStartResponse>()
        .typ::<StorageScanStatus>()
        .typ::<StorageTreeNode>()
        .typ::<StorageTypeBucketSummary>()
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
            "OVERLAY_SHELL_BLUEPRINTS",
            overlay_contracts::built_in_shell_blueprints(),
        )
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
    let mut sanitized = source.clone();

    if sanitized.contains("Channel as TAURI_CHANNEL") && !sanitized.contains("void TAURI_CHANNEL;")
    {
        sanitized = sanitized.replacen(
            "} from \"@tauri-apps/api/core\";",
            "} from \"@tauri-apps/api/core\";\nvoid TAURI_CHANNEL;",
            1,
        );
    }

    sanitized = sanitized
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
    fn sanitize_generated_typescript_preserves_channel_import_and_exports_event_helper() {
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
            sanitized.contains("Channel as TAURI_CHANNEL"),
            "sanitizer should preserve the generated Channel import for stream-capable bindings"
        );
        assert!(
            sanitized.contains("void TAURI_CHANNEL;"),
            "sanitizer should mark the generated Channel import as intentionally retained"
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
