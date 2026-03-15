// Copyright 2026 K-Studio. All Rights Reserved.

use git2::{Repository, StatusOptions, Status};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub file: String,
    pub status: String, // e.g. "M", "A", "D", "R", "??", "AM"
    pub staged: bool,
    pub unstaged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub id: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranch {
    pub name: String,
    pub is_head: bool,
}

pub fn get_status(path: &str) -> Result<Vec<GitStatus>, String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).renames_head_to_index(true).renames_index_to_workdir(true);

    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for entry in statuses.iter() {
        let status = entry.status();
        let file = entry.path().unwrap_or("").to_string();

        let staged = status.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        );
        let unstaged = status.intersects(
            Status::WT_NEW
                | Status::WT_MODIFIED
                | Status::WT_DELETED
                | Status::WT_RENAMED
                | Status::WT_TYPECHANGE,
        );

        let index_code = if status.contains(Status::INDEX_NEW) {
            'A'
        } else if status.contains(Status::INDEX_MODIFIED) {
            'M'
        } else if status.contains(Status::INDEX_DELETED) {
            'D'
        } else if status.contains(Status::INDEX_RENAMED) {
            'R'
        } else {
            ' '
        };

        let worktree_code = if status.contains(Status::WT_NEW) {
            '?'
        } else if status.contains(Status::WT_MODIFIED) {
            'M'
        } else if status.contains(Status::WT_DELETED) {
            'D'
        } else if status.contains(Status::WT_RENAMED) {
            'R'
        } else {
            ' '
        };

        let status_str = if staged && unstaged {
            format!("{}{}", index_code, worktree_code)
        } else if staged {
            index_code.to_string()
        } else if unstaged {
            if worktree_code == '?' { "??".to_string() } else { worktree_code.to_string() }
        } else {
            String::new()
        };

        if !status_str.is_empty() {
            result.push(GitStatus {
                file,
                status: status_str,
                staged,
                unstaged,
            });
        }
    }

    Ok(result)
}

pub fn stage_file(path: &str, file: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    
    let path_obj = Path::new(file);
    index.add_path(path_obj).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    
    Ok(())
}

pub fn unstage_file(path: &str, file: &str) -> Result<(), String> {
    // Use git CLI for robust, per-file unstage semantics across HEAD/non-HEAD repos.
    let output = std::process::Command::new("git")
        .current_dir(path)
        .args(["reset", "HEAD", "--", file])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        // Fallback for repos without HEAD yet.
        let fallback = std::process::Command::new("git")
            .current_dir(path)
            .args(["rm", "--cached", "--", file])
            .output()
            .map_err(|e| e.to_string())?;

        if !fallback.status.success() {
            let stderr = String::from_utf8_lossy(&fallback.stderr).to_string();
            return Err(if stderr.is_empty() { "Failed to unstage file".to_string() } else { stderr });
        }
    }

    Ok(())
}

pub fn commit(path: &str, message: &str) -> Result<String, String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let oid = index.write_tree().map_err(|e| e.to_string())?;
    let parent_commit = repo.head().ok().and_then(|h| h.target()).and_then(|t| repo.find_commit(t).ok());
    let tree = repo.find_tree(oid).map_err(|e| e.to_string())?;
    
    let sig = repo.signature().map_err(|e| e.to_string())?;
    
    let parents = if let Some(parent) = parent_commit.as_ref() {
        vec![parent]
    } else {
        vec![]
    };

    let commit_oid = repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        message,
        &tree,
        &parents,
    ).map_err(|e| e.to_string())?;

    Ok(commit_oid.to_string())
}

pub fn log(path: &str, max_count: usize) -> Result<Vec<GitCommit>, String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    revwalk.set_sorting(git2::Sort::TIME).map_err(|e| e.to_string())?;

    let mut commits = Vec::new();
    for oid in revwalk.take(max_count) {
        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        
        commits.push(GitCommit {
            id: commit.id().to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            date: commit.time().seconds().to_string(),
        });
    }

    Ok(commits)
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiff {
    pub file: String,
    pub original_content: String,
    pub modified_content: String,
}

pub fn push(path: &str, remote_name: &str, branch_name: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let mut remote = repo.find_remote(remote_name).map_err(|e| e.to_string())?;
    
    // Credentials callbacks are tricky in Tauri without UI interaction during the command.
    // For now, we reuse the ssh-agent or credential helper if configured.
    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, _allowed_types| {
        git2::Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"))
    });
    
    let mut push_opts = git2::PushOptions::new();
    push_opts.remote_callbacks(callbacks);
    
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);
    
    remote.push(&[&refspec], Some(&mut push_opts)).map_err(|e| e.to_string())?;
    
    Ok(())
}

pub fn pull(path: &str, remote_name: &str, branch_name: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let mut remote = repo.find_remote(remote_name).map_err(|e| e.to_string())?;
    
    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, _allowed_types| {
        git2::Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"))
    });
    
    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);
    
    // Fetch
    remote.fetch(&[branch_name], Some(&mut fetch_opts), None).map_err(|e| e.to_string())?;
    
    // Merge analysis
    let fetch_head = repo.find_reference("FETCH_HEAD").map_err(|e| e.to_string())?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head).map_err(|e| e.to_string())?;
    let analysis = repo.merge_analysis(&[&fetch_commit]).map_err(|e| e.to_string())?;
    
    if analysis.0.is_fast_forward() {
        let refname = format!("refs/heads/{}", branch_name);
        let mut reference = repo.find_reference(&refname).map_err(|e| e.to_string())?;
        reference.set_target(fetch_commit.id(), "Fast-Forward").map_err(|e| e.to_string())?;
        repo.set_head(&refname).map_err(|e| e.to_string())?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force())).map_err(|e| e.to_string())?;
    } else if analysis.0.is_normal() {
        let head_commit = repo.reference_to_annotated_commit(&repo.head().unwrap()).unwrap();
        repo.merge(&[&fetch_commit], None, None).map_err(|e| e.to_string())?;
         // Standard merge (simplified for brevity, commit creation needed here usually)
        // Auto-committing merge is complex in libgit2, often requires signature etc.
        // For this MVP, let's stop at merge (index updated) and let user commit if conflicts/clean.
    }
    
    Ok(())
}

pub fn get_diff_content(path: &str, file: &str) -> Result<GitDiff, String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;

    // 1. Get Head content (Original)
    let head = repo.head().map_err(|e| e.to_string())?;
    let tree = head.peel_to_tree().map_err(|e| e.to_string())?;
    let entry = tree.get_path(Path::new(file)).map_err(|_| "New file or file not in HEAD".to_string());

    let original_content = if let Ok(entry) = entry {
        let object = entry.to_object(&repo).map_err(|e| e.to_string())?;
        let blob = object.as_blob().ok_or("Not a blob")?;
        String::from_utf8_lossy(blob.content()).to_string()
    } else {
        "".to_string()
    };

    // 2. Get Workdir content (Modified)
    let full_path = Path::new(path).join(file);
    let modified_content = std::fs::read_to_string(full_path).unwrap_or("".to_string());

    Ok(GitDiff {
        file: file.to_string(),
        original_content,
        modified_content,
    })
}

pub fn discard_file(path: &str, file: &str) -> Result<(), String> {
    let output = std::process::Command::new("git")
        .current_dir(path)
        .args(["checkout", "--", file])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(if stderr.is_empty() { "Failed to discard file".to_string() } else { stderr });
    }

    Ok(())
}

pub fn current_branch(path: &str) -> Result<String, String> {
    let repo = Repository::open(path).map_err(|e| e.to_string())?;
    let head = repo.head().map_err(|e| e.to_string())?;

    if head.is_branch() {
        Ok(head.shorthand().unwrap_or("HEAD").to_string())
    } else {
        Ok("DETACHED".to_string())
    }
}
