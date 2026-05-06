// Copyright 2026 K-Studio. All Rights Reserved.

use grep_searcher::{Searcher, Sink, SinkMatch};
use nucleo_matcher::{Matcher as FuzzyMatcher, Config as FuzzyConfig, Utf32String};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use rayon::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub line_number: Option<usize>,
    pub content: Option<String>,
    pub score: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuzzySearchOptions {
    pub max_results: usize,
    pub case_sensitive: bool,
    pub max_depth: Option<usize>,
}

impl Default for FuzzySearchOptions {
    fn default() -> Self {
        Self {
            max_results: 100,
            case_sensitive: false,
            max_depth: Some(10),
        }
    }
}

pub fn fuzzy_search_files(
    root_path: &str,
    query: &str,
    options: FuzzySearchOptions,
) -> anyhow::Result<Vec<SearchResult>> {
    let root = PathBuf::from(root_path);
    
    if !root.exists() {
        return Err(anyhow::anyhow!("Path does not exist: {}", root_path));
    }

    let query_utf32 = Utf32String::from(query);

    let mut walker = WalkDir::new(&root).follow_links(false);
    
    if let Some(depth) = options.max_depth {
        walker = walker.max_depth(depth);
    }

    let entries: Vec<_> = walker
        .into_iter()
        .filter_map(|e| e.ok())
        .collect();

    let mut results: Vec<SearchResult> = entries
        .par_iter()
        .filter_map(|entry| {
            let path = entry.path();
            let file_name = path.file_name()?.to_str()?;
            
            let search_name = if options.case_sensitive {
                file_name.to_string()
            } else {
                file_name.to_lowercase()
            };

            let haystack = Utf32String::from(search_name.as_str());
            let mut matcher = FuzzyMatcher::new(FuzzyConfig::DEFAULT);
            let score = matcher.fuzzy_match(haystack.slice(..), query_utf32.slice(..))?;

            Some(SearchResult {
                path: path.to_string_lossy().to_string(),
                name: file_name.to_string(),
                line_number: None,
                content: None,
                score: Some(score as i32),
            })
        })
        .collect();

    results.sort_by(|a, b| {
        b.score.unwrap_or(0).cmp(&a.score.unwrap_or(0))
    });

    results.truncate(options.max_results);

    Ok(results)
}

struct ContentSearchSink {
    results: Vec<SearchResult>,
    max_results: usize,
    file_path: String,
}

impl Sink for ContentSearchSink {
    type Error = std::io::Error;

    fn matched(&mut self, _searcher: &Searcher, mat: &SinkMatch) -> Result<bool, Self::Error> {
        if self.results.len() >= self.max_results {
            return Ok(false);
        }

        let line_number = mat.line_number().map(|n| n as usize);
        let content = String::from_utf8_lossy(mat.bytes()).to_string();

        self.results.push(SearchResult {
            path: self.file_path.clone(),
            name: Path::new(&self.file_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string(),
            line_number,
            content: Some(content.trim().to_string()),
            score: None,
        });

        Ok(true)
    }
}

pub fn search_file_contents(
    root_path: &str,
    pattern: &str,
    max_results: usize,
) -> anyhow::Result<Vec<SearchResult>> {
    let root = PathBuf::from(root_path);
    
    if !root.exists() {
        return Err(anyhow::anyhow!("Path does not exist: {}", root_path));
    }

    use grep_regex::RegexMatcherBuilder;
    let matcher = RegexMatcherBuilder::new()
        .build(pattern)?;
    let mut all_results = Vec::new();

    for entry in WalkDir::new(&root)
        .max_depth(10)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if all_results.len() >= max_results {
            break;
        }

        let path = entry.path();
        
        if !path.is_file() {
            continue;
        }

        // Skip binary files
        if let Some(ext) = path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            if matches!(
                ext_str.as_str(),
                "exe" | "dll" | "so" | "dylib" | "bin" | "png" | "jpg" | "jpeg" | "gif" | "ico" | "zip" | "tar" | "gz"
            ) {
                continue;
            }
        }

        let mut searcher = Searcher::new();
        let mut sink = ContentSearchSink {
            results: Vec::new(),
            max_results: max_results - all_results.len(),
            file_path: path.to_string_lossy().to_string(),
        };

        if searcher.search_path(&matcher, path, &mut sink).is_ok() {
            all_results.extend(sink.results);
        }
    }

    Ok(all_results)
}
