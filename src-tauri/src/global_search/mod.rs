mod ignore;
mod index;
pub(crate) mod query;
pub(crate) mod scan;
mod scoring;
mod state;
mod types;
mod utils;

pub use query::{global_search_query, global_search_query_paths};
pub use scan::{
    global_search_cancel_scan, global_search_get_status, global_search_init,
    global_search_start_scan,
};
pub use types::{
    GlobalSearchDriveScanError, GlobalSearchQueryOptions, GlobalSearchResultEntry,
    GlobalSearchScanSettings, GlobalSearchStatus,
};
