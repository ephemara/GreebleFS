use super::ignore::{build_ignored_path_list, is_ignored_path, normalize_case};
use super::index::global_search_index_dir;
use super::scoring::{calculate_similarity_score, get_min_score_for_query_length};
use super::state::{GlobalSearchIndexFields, GLOBAL_SEARCH_STATE};
use super::types::{
    GlobalSearchIndexQueryRequest, GlobalSearchIndexSortDirection, GlobalSearchIndexSortKey,
    GlobalSearchQueryOptions, GlobalSearchResultEntry,
};
use super::utils::{is_hidden_path, metadata_times_unix_ms, path_extension_lowercase};
use regex::escape as escape_regex;
use std::cmp::Ordering;
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use tantivy::collector::{DocSetCollector, TopDocs};
use tantivy::query::{AllQuery, BooleanQuery, FuzzyTermQuery, Query, RegexQuery, TermQuery};
use tantivy::schema::{IndexRecordOption, Value};
use tantivy::Term;
use tantivy::{DocAddress, IndexReader};
use tauri::Manager;

fn build_query(
    fields: &GlobalSearchIndexFields,
    query: &str,
    options: &GlobalSearchQueryOptions,
) -> Box<dyn Query> {
    let normalized = normalize_case(query);
    let normalized_words: Vec<String> = normalized
        .split(|character: char| {
            character.is_whitespace() || character == '.' || character == '_' || character == '-'
        })
        .filter(|segment| !segment.is_empty())
        .map(|segment| segment.to_string())
        .collect();

    if options.exact_match {
        let term = Term::from_field_text(fields.name_lower, &normalized);
        return Box::new(TermQuery::new(term, IndexRecordOption::Basic));
    }

    let max_distance = if options.typo_tolerance { 2 } else { 1 };
    let mut subqueries: Vec<(tantivy::query::Occur, Box<dyn Query>)> = Vec::new();

    for word in &normalized_words {
        let term = Term::from_field_text(fields.name, word);
        let fuzzy = FuzzyTermQuery::new(term, max_distance, true);
        subqueries.push((tantivy::query::Occur::Should, Box::new(fuzzy)));
    }

    if normalized_words.len() > 1 {
        let joined_term = Term::from_field_text(fields.name, &normalized);
        subqueries.push((
            tantivy::query::Occur::Should,
            Box::new(FuzzyTermQuery::new(joined_term, max_distance, true)),
        ));
    }

    Box::new(BooleanQuery::from(subqueries))
}

fn matches_type(
    document_is_file: u64,
    document_is_dir: u64,
    options: &GlobalSearchQueryOptions,
) -> bool {
    let is_file = document_is_file == 1;
    let is_dir = document_is_dir == 1;

    (options.include_files && is_file) || (options.include_directories && is_dir)
}

fn candidate_limit(limit: usize) -> usize {
    limit.saturating_mul(64).clamp(256, 20_000)
}

const INDEX_QUERY_DEFAULT_LIMIT: usize = 100;
const INDEX_QUERY_MAX_LIMIT: usize = 5_000;
const INDEX_QUERY_MAX_OFFSET: usize = 100_000;

#[derive(Debug, Clone)]
struct NormalizedGlobalSearchIndexQueryRequest {
    query: String,
    limit: usize,
    offset: usize,
    options: GlobalSearchQueryOptions,
    include_hidden: bool,
    extensions: BTreeSet<String>,
    root_paths: Vec<String>,
    sort_key: GlobalSearchIndexSortKey,
    sort_direction: GlobalSearchIndexSortDirection,
}

fn normalize_index_query_request(
    request: GlobalSearchIndexQueryRequest,
) -> NormalizedGlobalSearchIndexQueryRequest {
    let query = request.query.unwrap_or_default().trim().to_string();
    let limit = if request.limit == 0 {
        INDEX_QUERY_DEFAULT_LIMIT
    } else {
        request.limit.clamp(1, INDEX_QUERY_MAX_LIMIT)
    };
    let offset = request.offset.min(INDEX_QUERY_MAX_OFFSET);
    let include_files = request.include_files || !request.include_directories;
    let include_directories = request.include_directories;
    let sort_key = request.sort_key.unwrap_or_else(|| {
        if query.is_empty() {
            GlobalSearchIndexSortKey::ModifiedTime
        } else {
            GlobalSearchIndexSortKey::Relevance
        }
    });

    NormalizedGlobalSearchIndexQueryRequest {
        query,
        limit,
        offset,
        options: GlobalSearchQueryOptions {
            limit: offset.saturating_add(limit),
            include_files,
            include_directories,
            exact_match: request.exact_match,
            typo_tolerance: request.typo_tolerance,
            min_score_threshold: request.min_score_threshold,
        },
        include_hidden: request.include_hidden,
        extensions: request
            .extensions
            .into_iter()
            .map(|extension| normalize_extension_filter_value(&extension))
            .filter(|extension| !extension.is_empty())
            .collect(),
        root_paths: request
            .root_paths
            .into_iter()
            .map(|root_path| normalize_scope_root_path(&root_path))
            .filter(|root_path| !root_path.is_empty())
            .collect(),
        sort_key,
        sort_direction: request
            .sort_direction
            .unwrap_or(GlobalSearchIndexSortDirection::Desc),
    }
}

fn normalize_extension_filter_value(extension: &str) -> String {
    extension.trim().trim_start_matches('.').to_lowercase()
}

fn build_combined_scope_query(
    fields: &GlobalSearchIndexFields,
    root_paths: &[String],
) -> Option<Box<dyn Query>> {
    let mut scope_queries: Vec<(tantivy::query::Occur, Box<dyn Query>)> = root_paths
        .iter()
        .filter_map(|root_path| build_scope_query(fields, root_path))
        .map(|query| (tantivy::query::Occur::Should, query))
        .collect();

    match scope_queries.len() {
        0 => None,
        1 => Some(scope_queries.remove(0).1),
        _ => Some(Box::new(BooleanQuery::from(scope_queries))),
    }
}

fn normalize_scope_root_path(raw_root_path: &str) -> String {
    let trimmed = raw_root_path.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    #[cfg(target_os = "windows")]
    {
        let without_trailing = trimmed.trim_end_matches(['/', '\\']);
        if without_trailing.len() == 2 {
            let bytes = without_trailing.as_bytes();
            if bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
                return format!("{without_trailing}\\");
            }
        }
    }

    if trimmed == "/" {
        return "/".to_string();
    }

    trimmed.trim_end_matches(['/', '\\']).to_string()
}

fn build_scope_query(
    fields: &GlobalSearchIndexFields,
    raw_root_path: &str,
) -> Option<Box<dyn Query>> {
    let normalized_root_path = normalize_scope_root_path(raw_root_path);
    if normalized_root_path.is_empty() {
        return None;
    }

    let exact_path_query = TermQuery::new(
        Term::from_field_text(fields.path, &normalized_root_path),
        IndexRecordOption::Basic,
    );
    let descendant_pattern = if normalized_root_path == "/" {
        "^/.*$".to_string()
    } else if normalized_root_path.ends_with('\\') || normalized_root_path.ends_with('/') {
        format!("^{}.*$", escape_regex(&normalized_root_path))
    } else if normalized_root_path.contains('\\') {
        format!("^{}(?:$|[\\\\/].*)", escape_regex(&normalized_root_path))
    } else {
        format!("^{}(?:$|/.*)", escape_regex(&normalized_root_path))
    };
    let descendant_path_query = match RegexQuery::from_pattern(&descendant_pattern, fields.path) {
        Ok(query) => query,
        Err(_) => return None,
    };

    Some(Box::new(BooleanQuery::from(vec![
        (
            tantivy::query::Occur::Should,
            Box::new(exact_path_query) as Box<dyn Query>,
        ),
        (
            tantivy::query::Occur::Should,
            Box::new(descendant_path_query) as Box<dyn Query>,
        ),
    ])))
}

fn sort_results(results: &mut [GlobalSearchResultEntry]) {
    results.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| right.modified_time.cmp(&left.modified_time))
            .then_with(|| left.path.cmp(&right.path))
    });
}

fn compare_index_query_results(
    left: &GlobalSearchResultEntry,
    right: &GlobalSearchResultEntry,
    sort_key: GlobalSearchIndexSortKey,
) -> Ordering {
    match sort_key {
        GlobalSearchIndexSortKey::Relevance => right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(Ordering::Equal)
            .then_with(|| right.modified_time.cmp(&left.modified_time))
            .then_with(|| left.path.cmp(&right.path)),
        GlobalSearchIndexSortKey::ModifiedTime => right
            .modified_time
            .cmp(&left.modified_time)
            .then_with(|| {
                right
                    .score
                    .partial_cmp(&left.score)
                    .unwrap_or(Ordering::Equal)
            })
            .then_with(|| left.path.cmp(&right.path)),
        GlobalSearchIndexSortKey::Name => left
            .name
            .to_lowercase()
            .cmp(&right.name.to_lowercase())
            .reverse()
            .then_with(|| left.path.cmp(&right.path)),
        GlobalSearchIndexSortKey::Path => right.path.cmp(&left.path),
        GlobalSearchIndexSortKey::Size => right
            .size
            .cmp(&left.size)
            .then_with(|| left.path.cmp(&right.path)),
    }
}

fn sort_index_query_results(
    results: &mut [GlobalSearchResultEntry],
    request: &NormalizedGlobalSearchIndexQueryRequest,
) {
    results.sort_by(|left, right| {
        let ordering = compare_index_query_results(left, right, request.sort_key);
        match request.sort_direction {
            GlobalSearchIndexSortDirection::Desc => ordering,
            GlobalSearchIndexSortDirection::Asc => ordering.reverse(),
        }
    });
}

fn open_search_reader(
    app: &tauri::AppHandle,
) -> Result<(IndexReader, GlobalSearchIndexFields), String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error: tauri::Error| error.to_string())?;
    let index_path = global_search_index_dir(&base_dir);

    let (reader, fields) = {
        let mut state = GLOBAL_SEARCH_STATE
            .write()
            .map_err(|error| error.to_string())?;
        if state.index.is_none() || state.reader.is_none() || state.fields.is_none() {
            let (index, reader, fields) = super::index::open_or_create_index(&index_path)?;
            state.index = Some(index);
            state.reader = Some(reader);
            state.fields = Some(fields);
        }

        (
            state
                .reader
                .as_ref()
                .expect("global search reader initialized")
                .clone(),
            *state
                .fields
                .as_ref()
                .expect("global search index fields initialized"),
        )
    };

    Ok((reader, fields))
}

fn execute_index_query(
    reader: &IndexReader,
    fields: &GlobalSearchIndexFields,
    query: &str,
    options: &GlobalSearchQueryOptions,
    scope_root_path: Option<&str>,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let searcher = reader.searcher();
    let normalized_query = normalize_case(query);
    let min_score = options
        .min_score_threshold
        .unwrap_or_else(|| get_min_score_for_query_length(normalized_query.len()));
    let ignored_paths = build_ignored_path_list(&[]);

    let text_query = build_query(fields, query, options);
    let final_query: Box<dyn Query> =
        match scope_root_path.and_then(|value| build_scope_query(fields, value)) {
            Some(scope_query) => Box::new(BooleanQuery::from(vec![
                (tantivy::query::Occur::Must, text_query),
                (tantivy::query::Occur::Must, scope_query),
            ])),
            None => text_query,
        };

    let top_docs = searcher
        .search(
            &final_query,
            &TopDocs::with_limit(candidate_limit(options.limit)),
        )
        .map_err(|error| error.to_string())?;

    let mut results = Vec::new();
    for (_tantivy_score, doc_address) in top_docs {
        let retrieved: tantivy::TantivyDocument = searcher
            .doc(doc_address)
            .map_err(|error| error.to_string())?;

        let path_value = match retrieved
            .get_first(fields.path)
            .and_then(|value| value.as_str())
        {
            Some(path) => path.to_string(),
            None => continue,
        };
        if is_ignored_path(&path_value, &ignored_paths) {
            continue;
        }

        let name_value = match retrieved
            .get_first(fields.name)
            .and_then(|value| value.as_str())
        {
            Some(name) => name.to_string(),
            None => continue,
        };
        let name_score = calculate_similarity_score(&normalized_query, &name_value);
        if name_score < min_score {
            continue;
        }

        let document_is_file = retrieved
            .get_first(fields.is_file)
            .and_then(|value| value.as_u64())
            .unwrap_or(0);
        let document_is_dir = retrieved
            .get_first(fields.is_dir)
            .and_then(|value| value.as_u64())
            .unwrap_or(0);

        if !matches_type(document_is_file, document_is_dir, options) {
            continue;
        }

        let modified_time = retrieved
            .get_first(fields.modified_time)
            .and_then(|value| value.as_u64())
            .unwrap_or(0);
        let size = retrieved
            .get_first(fields.size)
            .and_then(|value| value.as_u64())
            .unwrap_or(0);

        results.push(GlobalSearchResultEntry {
            name: name_value,
            extension: path_extension_lowercase(Path::new(&path_value)),
            path: path_value,
            size,
            modified_time,
            accessed_time: 0,
            created_time: 0,
            is_file: document_is_file == 1,
            is_dir: document_is_dir == 1,
            is_symlink: false,
            is_hidden: false,
            score: name_score,
        });
    }

    sort_results(&mut results);
    results.truncate(options.limit);
    Ok(results)
}

fn index_query_candidate_limit(
    searcher_doc_count: usize,
    request: &NormalizedGlobalSearchIndexQueryRequest,
) -> usize {
    if request.query.is_empty() {
        return searcher_doc_count;
    }

    candidate_limit(request.options.limit).min(searcher_doc_count)
}

fn build_plugin_index_query(
    fields: &GlobalSearchIndexFields,
    request: &NormalizedGlobalSearchIndexQueryRequest,
) -> Box<dyn Query> {
    let content_query: Box<dyn Query> = if request.query.is_empty() {
        Box::new(AllQuery)
    } else {
        build_query(fields, &request.query, &request.options)
    };

    match build_combined_scope_query(fields, &request.root_paths) {
        Some(scope_query) => Box::new(BooleanQuery::from(vec![
            (tantivy::query::Occur::Must, content_query),
            (tantivy::query::Occur::Must, scope_query),
        ])),
        None => content_query,
    }
}

fn result_entry_from_index_document(
    fields: &GlobalSearchIndexFields,
    retrieved: &tantivy::TantivyDocument,
    score: f32,
) -> Option<GlobalSearchResultEntry> {
    let path_value = retrieved
        .get_first(fields.path)
        .and_then(|value| value.as_str())?
        .to_string();
    let name_value = retrieved
        .get_first(fields.name)
        .and_then(|value| value.as_str())?
        .to_string();
    let document_is_file = retrieved
        .get_first(fields.is_file)
        .and_then(|value| value.as_u64())
        .unwrap_or(0);
    let document_is_dir = retrieved
        .get_first(fields.is_dir)
        .and_then(|value| value.as_u64())
        .unwrap_or(0);
    let modified_time = retrieved
        .get_first(fields.modified_time)
        .and_then(|value| value.as_u64())
        .unwrap_or(0);
    let size = retrieved
        .get_first(fields.size)
        .and_then(|value| value.as_u64())
        .unwrap_or(0);

    Some(GlobalSearchResultEntry {
        name: name_value,
        extension: path_extension_lowercase(Path::new(&path_value)),
        path: path_value,
        size,
        modified_time,
        accessed_time: 0,
        created_time: 0,
        is_file: document_is_file == 1,
        is_dir: document_is_dir == 1,
        is_symlink: false,
        is_hidden: false,
        score,
    })
}

fn matches_index_query_filters(
    entry: &GlobalSearchResultEntry,
    request: &NormalizedGlobalSearchIndexQueryRequest,
    ignored_paths: &[String],
) -> bool {
    if is_ignored_path(&entry.path, ignored_paths) {
        return false;
    }

    if entry.is_hidden && !request.include_hidden {
        return false;
    }

    if !((request.options.include_files && entry.is_file)
        || (request.options.include_directories && entry.is_dir))
    {
        return false;
    }

    if request.extensions.is_empty() {
        return true;
    }

    entry
        .extension
        .as_deref()
        .map(|extension| request.extensions.contains(extension))
        .unwrap_or(false)
}

fn calculate_index_query_score(
    entry_name: &str,
    normalized_query: &str,
    min_score: f32,
) -> Option<f32> {
    if normalized_query.is_empty() {
        return Some(1.0);
    }

    let name_score = calculate_similarity_score(normalized_query, entry_name);
    if name_score < min_score {
        return None;
    }
    Some(name_score)
}

fn retrieve_index_query_entries(
    reader: &IndexReader,
    fields: &GlobalSearchIndexFields,
    request: &NormalizedGlobalSearchIndexQueryRequest,
    query: &dyn Query,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let searcher = reader.searcher();
    let normalized_query = normalize_case(&request.query);
    let min_score = request
        .options
        .min_score_threshold
        .unwrap_or_else(|| get_min_score_for_query_length(normalized_query.len()));
    let ignored_paths = build_ignored_path_list(&[]);
    let searcher_doc_count = searcher.num_docs() as usize;
    let candidate_limit = index_query_candidate_limit(searcher_doc_count, request);

    let doc_addresses: Vec<DocAddress> = if request.query.is_empty() {
        searcher
            .search(query, &DocSetCollector)
            .map_err(|error| error.to_string())?
            .into_iter()
            .collect()
    } else {
        searcher
            .search(query, &TopDocs::with_limit(candidate_limit))
            .map_err(|error| error.to_string())?
            .into_iter()
            .map(|(_score, doc_address)| doc_address)
            .collect()
    };

    let mut results = Vec::new();
    for doc_address in doc_addresses {
        let retrieved: tantivy::TantivyDocument = searcher
            .doc(doc_address)
            .map_err(|error| error.to_string())?;

        let Some(mut entry) = result_entry_from_index_document(fields, &retrieved, 1.0) else {
            continue;
        };
        let Some(score) = calculate_index_query_score(&entry.name, &normalized_query, min_score)
        else {
            continue;
        };
        entry.score = score;

        if !matches_index_query_filters(&entry, request, &ignored_paths) {
            continue;
        }

        results.push(entry);
    }

    Ok(results)
}

fn execute_plugin_index_query(
    reader: &IndexReader,
    fields: &GlobalSearchIndexFields,
    request: &NormalizedGlobalSearchIndexQueryRequest,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let query = build_plugin_index_query(fields, request);
    let mut results = retrieve_index_query_entries(reader, fields, request, query.as_ref())?;

    sort_index_query_results(&mut results, request);
    Ok(results
        .into_iter()
        .skip(request.offset)
        .take(request.limit)
        .collect())
}

#[tauri::command]
#[specta::specta]
pub async fn global_search_query(
    app: tauri::AppHandle,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let trimmed_query = query.trim();
    if trimmed_query.is_empty() {
        return Ok(Vec::new());
    }

    let (reader, fields) = open_search_reader(&app)?;
    execute_index_query(&reader, &fields, trimmed_query, &options, None)
}

#[tauri::command]
#[specta::specta]
pub async fn global_search_query_index(
    app: tauri::AppHandle,
    request: GlobalSearchIndexQueryRequest,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let normalized_request = normalize_index_query_request(request);
    let (reader, fields) = open_search_reader(&app)?;
    execute_plugin_index_query(&reader, &fields, &normalized_request)
}

#[tauri::command]
pub async fn global_search_query_under_path(
    app: tauri::AppHandle,
    root_path: String,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let trimmed_query = query.trim();
    let normalized_root_path = normalize_scope_root_path(&root_path);
    if trimmed_query.is_empty() || normalized_root_path.is_empty() {
        return Ok(Vec::new());
    }

    let (reader, fields) = open_search_reader(&app)?;
    execute_index_query(
        &reader,
        &fields,
        trimmed_query,
        &options,
        Some(&normalized_root_path),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn global_search_query_paths(
    paths: Vec<String>,
    query: String,
    options: GlobalSearchQueryOptions,
) -> Result<Vec<GlobalSearchResultEntry>, String> {
    let trimmed_query = query.trim();
    if paths.is_empty() || trimmed_query.is_empty() {
        return Ok(Vec::new());
    }

    let normalized_query = normalize_case(trimmed_query);
    let min_score = options
        .min_score_threshold
        .unwrap_or_else(|| get_min_score_for_query_length(normalized_query.len()));

    let mut searchable_paths = Vec::new();
    for path_string in paths {
        let path = Path::new(path_string.trim());
        if path.as_os_str().is_empty() || !path.exists() {
            continue;
        }

        if path.is_dir() {
            if let Ok(entries) = std::fs::read_dir(path) {
                for entry in entries.flatten() {
                    searchable_paths.push(entry.path());
                }
            }
        } else {
            searchable_paths.push(path.to_path_buf());
        }
    }

    let mut unique_results = BTreeMap::new();
    for path in searchable_paths {
        let path_string = path.to_string_lossy().to_string();
        let name = match path.file_name().and_then(|segment| segment.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        let name_score = calculate_similarity_score(&normalized_query, &name);
        if name_score < min_score {
            continue;
        }

        let metadata = match std::fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let is_file = metadata.is_file();
        let is_dir = metadata.is_dir();
        if !matches_type(
            if is_file { 1 } else { 0 },
            if is_dir { 1 } else { 0 },
            &options,
        ) {
            continue;
        }

        let (modified_time, accessed_time, created_time) = metadata_times_unix_ms(&metadata);
        let size = if is_file { metadata.len() } else { 0 };

        unique_results.insert(
            path_string.clone(),
            GlobalSearchResultEntry {
                name,
                extension: path_extension_lowercase(&path),
                path: path_string,
                size,
                modified_time,
                accessed_time,
                created_time,
                is_file,
                is_dir,
                is_symlink: metadata.file_type().is_symlink(),
                is_hidden: is_hidden_path(&path),
                score: name_score,
            },
        );
    }

    let mut results: Vec<GlobalSearchResultEntry> = unique_results.into_values().collect();
    sort_results(&mut results);
    results.truncate(options.limit);
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::{global_search_query_paths, normalize_index_query_request};
    use crate::global_search::types::{
        GlobalSearchIndexQueryRequest, GlobalSearchIndexSortDirection, GlobalSearchIndexSortKey,
        GlobalSearchQueryOptions,
    };
    use tempfile::tempdir;

    #[tokio::test]
    async fn query_paths_searches_children_of_priority_directories() {
        let temp_dir = tempdir().expect("temporary directory");
        let docs_dir = temp_dir.path().join("docs");
        std::fs::create_dir_all(&docs_dir).expect("docs directory");
        std::fs::write(docs_dir.join("readme.md"), "# hello").expect("seed file");
        std::fs::write(docs_dir.join("notes.txt"), "notes").expect("seed file");

        let results = global_search_query_paths(
            vec![docs_dir.to_string_lossy().to_string()],
            "read".to_string(),
            GlobalSearchQueryOptions {
                limit: 10,
                include_files: true,
                include_directories: true,
                exact_match: false,
                typo_tolerance: true,
                min_score_threshold: None,
            },
        )
        .await
        .expect("query results");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "readme.md");
    }

    #[test]
    fn index_query_request_normalizes_gallery_filters() {
        let request = normalize_index_query_request(GlobalSearchIndexQueryRequest {
            query: Some("  ".to_string()),
            limit: 0,
            offset: 200_000,
            include_files: false,
            include_directories: false,
            include_hidden: false,
            extensions: vec![".JPG".to_string(), " png ".to_string()],
            root_paths: vec!["".to_string(), "C:\\Users\\Pictures\\".to_string()],
            exact_match: false,
            typo_tolerance: true,
            min_score_threshold: None,
            sort_key: None,
            sort_direction: Some(GlobalSearchIndexSortDirection::Asc),
        });

        assert_eq!(request.limit, 100);
        assert_eq!(request.offset, 100_000);
        assert!(request.options.include_files);
        assert!(!request.options.include_directories);
        assert!(request.extensions.contains("jpg"));
        assert!(request.extensions.contains("png"));
        assert_eq!(request.sort_key, GlobalSearchIndexSortKey::ModifiedTime);
        assert_eq!(request.sort_direction, GlobalSearchIndexSortDirection::Asc);
        assert_eq!(request.root_paths.len(), 1);
    }
}
