use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum YaziBindingStatus {
    Direct,
    Bridged,
    Planned,
    Internal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum YaziCrateName {
    YaziActor,
    YaziAdapter,
    YaziBinding,
    YaziBoot,
    YaziBuild,
    YaziCli,
    YaziCodegen,
    YaziConfig,
    YaziCore,
    YaziDds,
    YaziEmulator,
    YaziFfi,
    YaziFm,
    YaziFs,
    YaziMacro,
    YaziPacking,
    YaziParser,
    YaziPlugin,
    YaziProxy,
    YaziScheduler,
    YaziSftp,
    YaziShared,
    YaziShim,
    YaziTerm,
    YaziTty,
    YaziVfs,
    YaziWatcher,
    YaziWidgets,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YaziBindingManifestEntry {
    pub crate_name: YaziCrateName,
    pub status: YaziBindingStatus,
    pub exported_types: Vec<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YaziBindingManifest {
    pub version: String,
    pub entries: Vec<YaziBindingManifestEntry>,
}

pub fn binding_manifest() -> YaziBindingManifest {
    YaziBindingManifest {
        version: "phase-1".to_string(),
        entries: vec![
            manifest_entry(YaziCrateName::YaziActor, YaziBindingStatus::Internal, &[], &["actor command internals"]),
            manifest_entry(YaziCrateName::YaziAdapter, YaziBindingStatus::Planned, &[], &["adapter and image bridge surface planned"]),
            manifest_entry(YaziCrateName::YaziBinding, YaziBindingStatus::Internal, &[], &["Lua binding internals"]),
            manifest_entry(YaziCrateName::YaziBoot, YaziBindingStatus::Planned, &[], &["boot/runtime handshake surface planned"]),
            manifest_entry(YaziCrateName::YaziBuild, YaziBindingStatus::Internal, &[], &["build helper crate"]),
            manifest_entry(YaziCrateName::YaziCli, YaziBindingStatus::Internal, &[], &["CLI-only surface"]),
            manifest_entry(YaziCrateName::YaziCodegen, YaziBindingStatus::Internal, &[], &["codegen helper crate"]),
            manifest_entry(YaziCrateName::YaziConfig, YaziBindingStatus::Planned, &[], &["config/theme bridge surface planned"]),
            manifest_entry(YaziCrateName::YaziCore, YaziBindingStatus::Internal, &[], &["runtime state internals"]),
            manifest_entry(YaziCrateName::YaziDds, YaziBindingStatus::Planned, &[], &["DDS payload bridge surface planned"]),
            manifest_entry(YaziCrateName::YaziEmulator, YaziBindingStatus::Planned, &[], &["terminal emulator bridge surface planned"]),
            manifest_entry(YaziCrateName::YaziFfi, YaziBindingStatus::Internal, &[], &["FFI handle internals"]),
            manifest_entry(YaziCrateName::YaziFm, YaziBindingStatus::Internal, &[], &["full TUI app crate"]),
            manifest_entry(
                YaziCrateName::YaziFs,
                YaziBindingStatus::Bridged,
                &["YaziFsSortBy", "YaziFsSortFallback", "YaziFsErrorDto", "YaziFsFolderStageDto"],
                &["file explorer sorting and stage contracts exported"],
            ),
            manifest_entry(YaziCrateName::YaziMacro, YaziBindingStatus::Internal, &[], &["macro crate"]),
            manifest_entry(YaziCrateName::YaziPacking, YaziBindingStatus::Planned, &[], &["archive/package bridge surface planned"]),
            manifest_entry(
                YaziCrateName::YaziParser,
                YaziBindingStatus::Bridged,
                &[
                    "YaziParserTaskSummary",
                    "YaziParserSortOpt",
                    "YaziParserHiddenOpt",
                    "YaziParserHiddenOptState",
                ],
                &["frontend-safe parser option DTOs exported"],
            ),
            manifest_entry(YaziCrateName::YaziPlugin, YaziBindingStatus::Planned, &[], &["plugin runtime bridge surface planned"]),
            manifest_entry(YaziCrateName::YaziProxy, YaziBindingStatus::Planned, &[], &["proxy bridge surface planned"]),
            manifest_entry(
                YaziCrateName::YaziScheduler,
                YaziBindingStatus::Bridged,
                &[
                    "YaziSchedulerFetchProg",
                    "YaziSchedulerFileProgCopy",
                    "YaziSchedulerFileProgCut",
                    "YaziSchedulerFileProgLink",
                    "YaziSchedulerFileProgHardlink",
                    "YaziSchedulerFileProgDelete",
                    "YaziSchedulerFileProgTrash",
                    "YaziSchedulerFileProgDownload",
                    "YaziSchedulerFileProgUpload",
                    "YaziSchedulerPluginProgEntry",
                    "YaziSchedulerPreloadProg",
                    "YaziSchedulerProcessProgBlock",
                    "YaziSchedulerProcessProgOrphan",
                    "YaziSchedulerProcessProgBg",
                    "YaziSchedulerSizeProg",
                    "YaziSchedulerTaskProg",
                    "YaziSchedulerTaskSnap",
                ],
                &["task progress bridge DTOs exported"],
            ),
            manifest_entry(YaziCrateName::YaziSftp, YaziBindingStatus::Planned, &[], &["SFTP bridge surface planned"]),
            manifest_entry(YaziCrateName::YaziShared, YaziBindingStatus::Planned, &[], &["shared URL/data bridge surface planned"]),
            manifest_entry(YaziCrateName::YaziShim, YaziBindingStatus::Internal, &[], &["platform shim internals"]),
            manifest_entry(YaziCrateName::YaziTerm, YaziBindingStatus::Planned, &[], &["terminal presentation bridge surface planned"]),
            manifest_entry(YaziCrateName::YaziTty, YaziBindingStatus::Internal, &[], &["TTY internals"]),
            manifest_entry(YaziCrateName::YaziVfs, YaziBindingStatus::Planned, &[], &["VFS service bridge surface planned"]),
            manifest_entry(YaziCrateName::YaziWatcher, YaziBindingStatus::Planned, &[], &["watcher event bridge surface planned"]),
            manifest_entry(YaziCrateName::YaziWidgets, YaziBindingStatus::Planned, &[], &["widget layout bridge surface planned"]),
        ],
    }
}

fn manifest_entry(
    crate_name: YaziCrateName,
    status: YaziBindingStatus,
    exported_types: &[&str],
    notes: &[&str],
) -> YaziBindingManifestEntry {
    YaziBindingManifestEntry {
        crate_name,
        status,
        exported_types: exported_types.iter().map(|value| (*value).to_string()).collect(),
        notes: notes.iter().map(|value| (*value).to_string()).collect(),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum YaziFsSortBy {
    None,
    Mtime,
    Btime,
    Extension,
    Alphabetical,
    Natural,
    Size,
    Random,
}

impl From<yazi_fs::SortBy> for YaziFsSortBy {
    fn from(value: yazi_fs::SortBy) -> Self {
        match value {
            yazi_fs::SortBy::None => Self::None,
            yazi_fs::SortBy::Mtime => Self::Mtime,
            yazi_fs::SortBy::Btime => Self::Btime,
            yazi_fs::SortBy::Extension => Self::Extension,
            yazi_fs::SortBy::Alphabetical => Self::Alphabetical,
            yazi_fs::SortBy::Natural => Self::Natural,
            yazi_fs::SortBy::Size => Self::Size,
            yazi_fs::SortBy::Random => Self::Random,
        }
    }
}

impl From<YaziFsSortBy> for yazi_fs::SortBy {
    fn from(value: YaziFsSortBy) -> Self {
        match value {
            YaziFsSortBy::None => Self::None,
            YaziFsSortBy::Mtime => Self::Mtime,
            YaziFsSortBy::Btime => Self::Btime,
            YaziFsSortBy::Extension => Self::Extension,
            YaziFsSortBy::Alphabetical => Self::Alphabetical,
            YaziFsSortBy::Natural => Self::Natural,
            YaziFsSortBy::Size => Self::Size,
            YaziFsSortBy::Random => Self::Random,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum YaziFsSortFallback {
    Alphabetical,
    Natural,
}

impl From<yazi_fs::SortFallback> for YaziFsSortFallback {
    fn from(value: yazi_fs::SortFallback) -> Self {
        match value {
            yazi_fs::SortFallback::Alphabetical => Self::Alphabetical,
            yazi_fs::SortFallback::Natural => Self::Natural,
        }
    }
}

impl From<YaziFsSortFallback> for yazi_fs::SortFallback {
    fn from(value: YaziFsSortFallback) -> Self {
        match value {
            YaziFsSortFallback::Alphabetical => Self::Alphabetical,
            YaziFsSortFallback::Natural => Self::Natural,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YaziFsErrorDto {
    pub kind: String,
    pub code: Option<i32>,
    pub message: Option<String>,
}

impl From<&yazi_fs::error::Error> for YaziFsErrorDto {
    fn from(value: &yazi_fs::error::Error) -> Self {
        Self {
            kind: value.kind_str().to_string(),
            code: value.raw_os_error(),
            message: Some(value.to_string()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum YaziFsFolderStageDto {
    Loading,
    Loaded,
    Failed { error: YaziFsErrorDto },
}

impl From<yazi_fs::FolderStage> for YaziFsFolderStageDto {
    fn from(value: yazi_fs::FolderStage) -> Self {
        match value {
            yazi_fs::FolderStage::Loading => Self::Loading,
            yazi_fs::FolderStage::Loaded => Self::Loaded,
            yazi_fs::FolderStage::Failed(error) => Self::Failed {
                error: YaziFsErrorDto::from(&error),
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YaziParserTaskSummary {
    pub total: u32,
    pub success: u32,
    pub failed: u32,
    pub percent: Option<f32>,
}

impl From<yazi_parser::app::TaskSummary> for YaziParserTaskSummary {
    fn from(value: yazi_parser::app::TaskSummary) -> Self {
        Self {
            total: value.total,
            success: value.success,
            failed: value.failed,
            percent: value.percent.map(|value| value.0),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum YaziParserHiddenOptState {
    #[default]
    None,
    Show,
    Hide,
    Toggle,
}

impl From<yazi_parser::mgr::HiddenOptState> for YaziParserHiddenOptState {
    fn from(value: yazi_parser::mgr::HiddenOptState) -> Self {
        match value {
            yazi_parser::mgr::HiddenOptState::None => Self::None,
            yazi_parser::mgr::HiddenOptState::Show => Self::Show,
            yazi_parser::mgr::HiddenOptState::Hide => Self::Hide,
            yazi_parser::mgr::HiddenOptState::Toggle => Self::Toggle,
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct YaziParserHiddenOpt {
    pub state: YaziParserHiddenOptState,
}

impl From<yazi_parser::mgr::HiddenOpt> for YaziParserHiddenOpt {
    fn from(value: yazi_parser::mgr::HiddenOpt) -> Self {
        Self {
            state: value.state.into(),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YaziParserSortOpt {
    pub by: Option<YaziFsSortBy>,
    pub reverse: Option<bool>,
    pub dir_first: Option<bool>,
    pub sensitive: Option<bool>,
    pub translit: Option<bool>,
    pub fallback: Option<YaziFsSortFallback>,
}

impl From<yazi_parser::mgr::SortOpt> for YaziParserSortOpt {
    fn from(value: yazi_parser::mgr::SortOpt) -> Self {
        Self {
            by: value.by.map(Into::into),
            reverse: value.reverse,
            dir_first: value.dir_first,
            sensitive: value.sensitive,
            translit: value.translit,
            fallback: value.fallback.map(Into::into),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct YaziSchedulerFetchProg {
    pub state: Option<bool>,
}

impl From<yazi_scheduler::fetch::FetchProg> for YaziSchedulerFetchProg {
    fn from(value: yazi_scheduler::fetch::FetchProg) -> Self {
        Self { state: value.state }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YaziSchedulerFileProgCopy {
    pub total_files: u32,
    pub success_files: u32,
    pub failed_files: u32,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub collected: Option<bool>,
    pub cleaned: Option<bool>,
}

impl From<yazi_scheduler::file::FileProgCopy> for YaziSchedulerFileProgCopy {
    fn from(value: yazi_scheduler::file::FileProgCopy) -> Self {
        Self {
            total_files: value.total_files,
            success_files: value.success_files,
            failed_files: value.failed_files,
            total_bytes: value.total_bytes,
            processed_bytes: value.processed_bytes,
            collected: value.collected,
            cleaned: value.cleaned,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YaziSchedulerFileProgCut {
    pub total_files: u32,
    pub success_files: u32,
    pub failed_files: u32,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub collected: Option<bool>,
    pub cleaned: Option<bool>,
}

impl From<yazi_scheduler::file::FileProgCut> for YaziSchedulerFileProgCut {
    fn from(value: yazi_scheduler::file::FileProgCut) -> Self {
        Self {
            total_files: value.total_files,
            success_files: value.success_files,
            failed_files: value.failed_files,
            total_bytes: value.total_bytes,
            processed_bytes: value.processed_bytes,
            collected: value.collected,
            cleaned: value.cleaned,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct YaziSchedulerFileProgLink {
    pub state: Option<bool>,
}

impl From<yazi_scheduler::file::FileProgLink> for YaziSchedulerFileProgLink {
    fn from(value: yazi_scheduler::file::FileProgLink) -> Self {
        Self { state: value.state }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct YaziSchedulerFileProgHardlink {
    pub total: u32,
    pub success: u32,
    pub failed: u32,
    pub collected: Option<bool>,
}

impl From<yazi_scheduler::file::FileProgHardlink> for YaziSchedulerFileProgHardlink {
    fn from(value: yazi_scheduler::file::FileProgHardlink) -> Self {
        Self {
            total: value.total,
            success: value.success,
            failed: value.failed,
            collected: value.collected,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YaziSchedulerFileProgDelete {
    pub total_files: u32,
    pub success_files: u32,
    pub failed_files: u32,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub collected: Option<bool>,
    pub cleaned: Option<bool>,
}

impl From<yazi_scheduler::file::FileProgDelete> for YaziSchedulerFileProgDelete {
    fn from(value: yazi_scheduler::file::FileProgDelete) -> Self {
        Self {
            total_files: value.total_files,
            success_files: value.success_files,
            failed_files: value.failed_files,
            total_bytes: value.total_bytes,
            processed_bytes: value.processed_bytes,
            collected: value.collected,
            cleaned: value.cleaned,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct YaziSchedulerFileProgTrash {
    pub state: Option<bool>,
    pub cleaned: Option<bool>,
}

impl From<yazi_scheduler::file::FileProgTrash> for YaziSchedulerFileProgTrash {
    fn from(value: yazi_scheduler::file::FileProgTrash) -> Self {
        Self {
            state: value.state,
            cleaned: value.cleaned,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YaziSchedulerFileProgDownload {
    pub total_files: u32,
    pub success_files: u32,
    pub failed_files: u32,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub collected: Option<bool>,
    pub cleaned: Option<bool>,
}

impl From<yazi_scheduler::file::FileProgDownload> for YaziSchedulerFileProgDownload {
    fn from(value: yazi_scheduler::file::FileProgDownload) -> Self {
        Self {
            total_files: value.total_files,
            success_files: value.success_files,
            failed_files: value.failed_files,
            total_bytes: value.total_bytes,
            processed_bytes: value.processed_bytes,
            collected: value.collected,
            cleaned: value.cleaned,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YaziSchedulerFileProgUpload {
    pub total_files: u32,
    pub success_files: u32,
    pub failed_files: u32,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub collected: Option<bool>,
    pub cleaned: Option<bool>,
}

impl From<yazi_scheduler::file::FileProgUpload> for YaziSchedulerFileProgUpload {
    fn from(value: yazi_scheduler::file::FileProgUpload) -> Self {
        Self {
            total_files: value.total_files,
            success_files: value.success_files,
            failed_files: value.failed_files,
            total_bytes: value.total_bytes,
            processed_bytes: value.processed_bytes,
            collected: value.collected,
            cleaned: value.cleaned,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct YaziSchedulerPluginProgEntry {
    pub state: Option<bool>,
}

impl From<yazi_scheduler::plugin::PluginProgEntry> for YaziSchedulerPluginProgEntry {
    fn from(value: yazi_scheduler::plugin::PluginProgEntry) -> Self {
        Self { state: value.state }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct YaziSchedulerPreloadProg {
    pub state: Option<bool>,
}

impl From<yazi_scheduler::preload::PreloadProg> for YaziSchedulerPreloadProg {
    fn from(value: yazi_scheduler::preload::PreloadProg) -> Self {
        Self { state: value.state }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct YaziSchedulerProcessProgBlock {
    pub state: Option<bool>,
}

impl From<yazi_scheduler::process::ProcessProgBlock> for YaziSchedulerProcessProgBlock {
    fn from(value: yazi_scheduler::process::ProcessProgBlock) -> Self {
        Self { state: value.state }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct YaziSchedulerProcessProgOrphan {
    pub state: Option<bool>,
}

impl From<yazi_scheduler::process::ProcessProgOrphan> for YaziSchedulerProcessProgOrphan {
    fn from(value: yazi_scheduler::process::ProcessProgOrphan) -> Self {
        Self { state: value.state }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct YaziSchedulerProcessProgBg {
    pub state: Option<bool>,
}

impl From<yazi_scheduler::process::ProcessProgBg> for YaziSchedulerProcessProgBg {
    fn from(value: yazi_scheduler::process::ProcessProgBg) -> Self {
        Self { state: value.state }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct YaziSchedulerSizeProg {
    pub done: bool,
}

impl From<yazi_scheduler::size::SizeProg> for YaziSchedulerSizeProg {
    fn from(value: yazi_scheduler::size::SizeProg) -> Self {
        Self { done: value.done }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum YaziSchedulerTaskProg {
    FileCopy(YaziSchedulerFileProgCopy),
    FileCut(YaziSchedulerFileProgCut),
    FileLink(YaziSchedulerFileProgLink),
    FileHardlink(YaziSchedulerFileProgHardlink),
    FileDelete(YaziSchedulerFileProgDelete),
    FileTrash(YaziSchedulerFileProgTrash),
    FileDownload(YaziSchedulerFileProgDownload),
    FileUpload(YaziSchedulerFileProgUpload),
    PluginEntry(YaziSchedulerPluginProgEntry),
    Fetch(YaziSchedulerFetchProg),
    Preload(YaziSchedulerPreloadProg),
    Size(YaziSchedulerSizeProg),
    ProcessBlock(YaziSchedulerProcessProgBlock),
    ProcessOrphan(YaziSchedulerProcessProgOrphan),
    ProcessBg(YaziSchedulerProcessProgBg),
}

impl From<yazi_scheduler::TaskProg> for YaziSchedulerTaskProg {
    fn from(value: yazi_scheduler::TaskProg) -> Self {
        match value {
            yazi_scheduler::TaskProg::FileCopy(value) => Self::FileCopy(value.into()),
            yazi_scheduler::TaskProg::FileCut(value) => Self::FileCut(value.into()),
            yazi_scheduler::TaskProg::FileLink(value) => Self::FileLink(value.into()),
            yazi_scheduler::TaskProg::FileHardlink(value) => Self::FileHardlink(value.into()),
            yazi_scheduler::TaskProg::FileDelete(value) => Self::FileDelete(value.into()),
            yazi_scheduler::TaskProg::FileTrash(value) => Self::FileTrash(value.into()),
            yazi_scheduler::TaskProg::FileDownload(value) => Self::FileDownload(value.into()),
            yazi_scheduler::TaskProg::FileUpload(value) => Self::FileUpload(value.into()),
            yazi_scheduler::TaskProg::PluginEntry(value) => Self::PluginEntry(value.into()),
            yazi_scheduler::TaskProg::Fetch(value) => Self::Fetch(value.into()),
            yazi_scheduler::TaskProg::Preload(value) => Self::Preload(value.into()),
            yazi_scheduler::TaskProg::Size(value) => Self::Size(value.into()),
            yazi_scheduler::TaskProg::ProcessBlock(value) => Self::ProcessBlock(value.into()),
            yazi_scheduler::TaskProg::ProcessOrphan(value) => Self::ProcessOrphan(value.into()),
            yazi_scheduler::TaskProg::ProcessBg(value) => Self::ProcessBg(value.into()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct YaziSchedulerTaskSnap {
    pub name: String,
    pub prog: YaziSchedulerTaskProg,
}

impl From<yazi_scheduler::TaskSnap> for YaziSchedulerTaskSnap {
    fn from(value: yazi_scheduler::TaskSnap) -> Self {
        Self {
            name: value.name,
            prog: value.prog.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binding_manifest_keeps_scheduler_bridge_exports_stable() {
        let manifest = binding_manifest();
        let scheduler = manifest
            .entries
            .iter()
            .find(|entry| entry.crate_name == YaziCrateName::YaziScheduler)
            .expect("scheduler manifest entry should exist");

        assert_eq!(scheduler.status, YaziBindingStatus::Bridged);
        assert!(scheduler
            .exported_types
            .contains(&"YaziSchedulerTaskProg".to_string()));
        assert!(scheduler
            .exported_types
            .contains(&"YaziSchedulerTaskSnap".to_string()));
        assert!(scheduler
            .exported_types
            .contains(&"YaziSchedulerFileProgUpload".to_string()));
    }

    #[test]
    fn binding_manifest_marks_watcher_as_planned_until_event_dtos_ship() {
        let manifest = binding_manifest();
        let watcher = manifest
            .entries
            .iter()
            .find(|entry| entry.crate_name == YaziCrateName::YaziWatcher)
            .expect("watcher manifest entry should exist");

        assert_eq!(watcher.status, YaziBindingStatus::Planned);
        assert!(watcher.exported_types.is_empty());
        assert!(watcher
            .notes
            .iter()
            .any(|note| note.contains("watcher event bridge surface planned")));
    }

    #[test]
    fn binding_manifest_keeps_phase_1_transfer_exports_and_version_stable() {
        let manifest = binding_manifest();
        let scheduler = manifest
            .entries
            .iter()
            .find(|entry| entry.crate_name == YaziCrateName::YaziScheduler)
            .expect("scheduler manifest entry should exist");

        assert_eq!(manifest.version, "phase-1");
        assert_eq!(scheduler.status, YaziBindingStatus::Bridged);
        assert!(scheduler
            .exported_types
            .contains(&"YaziSchedulerFileProgLink".to_string()));
        assert!(scheduler
            .exported_types
            .contains(&"YaziSchedulerFileProgHardlink".to_string()));
        assert!(scheduler
            .exported_types
            .contains(&"YaziSchedulerFileProgTrash".to_string()));
        assert!(scheduler
            .exported_types
            .contains(&"YaziSchedulerFileProgDownload".to_string()));
        assert!(scheduler
            .exported_types
            .contains(&"YaziSchedulerFileProgUpload".to_string()));
        assert!(scheduler
            .exported_types
            .contains(&"YaziSchedulerTaskProg".to_string()));
        assert!(scheduler
            .exported_types
            .contains(&"YaziSchedulerTaskSnap".to_string()));
    }
}
