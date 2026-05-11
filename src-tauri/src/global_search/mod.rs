mod ignore;
mod index;
pub(crate) mod query;
pub(crate) mod scan;
mod scoring;
mod state;
mod types;
mod utils;

pub use query::{
    global_search_query, global_search_query_index, global_search_query_index_page,
    global_search_query_paths,
};
pub use scan::{
    global_search_cancel_scan, global_search_get_status, global_search_init,
    global_search_start_scan, global_search_start_scan_with_task_graph,
};
pub use types::{
    GlobalSearchDriveScanError, GlobalSearchIndexQueryRequest, GlobalSearchIndexQueryResponse,
    GlobalSearchIndexSortDirection, GlobalSearchIndexSortKey, GlobalSearchQueryOptions,
    GlobalSearchResultEntry, GlobalSearchScanSettings, GlobalSearchStatus,
};
