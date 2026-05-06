// Explorer crate - File management and search
// Ported from apps/explorer

pub mod commands;
pub mod search;
pub mod terminal;
pub mod jobs;

pub mod file_ops;
pub mod git;

// Re-export commonly used items
pub use commands::*;
pub use search::{fuzzy_search_files, search_file_contents, FuzzySearchOptions, SearchResult};
pub use terminal::TerminalManager;
pub use jobs::JobManager;

pub use file_ops::DragManager;
pub use git::{GitStatus, GitCommit, GitBranch, get_status, stage_file, unstage_file, commit, log, get_diff_content};
