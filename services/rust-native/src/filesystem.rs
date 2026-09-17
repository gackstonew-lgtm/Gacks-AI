//! GACKS AI Assistant OS — Native Filesystem Operations Engine

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub readonly: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryListing {
    pub current_path: String,
    pub items: Vec<FileEntry>,
    pub total_items: usize,
}

pub struct FilesystemEngine;

impl FilesystemEngine {
    pub fn list_directory(target_path: &str) -> Result<DirectoryListing, String> {
        let p = Path::new(target_path);
        if !p.exists() {
            return Err(format!("Path does not exist: {}", target_path));
        }

        let entries = fs::read_dir(p).map_err(|e| format!("Failed to read directory: {}", e))?;
        let mut items = Vec::new();

        for entry in entries.flatten() {
            let metadata = entry.metadata().ok();
            let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
            let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
            let readonly = metadata.as_ref().map(|m| m.permissions().readonly()).unwrap_or(false);

            items.push(FileEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: entry.path().to_string_lossy().to_string(),
                is_dir,
                size_bytes,
                readonly,
            });
        }

        let total = items.len();
        Ok(DirectoryListing {
            current_path: target_path.to_string(),
            items,
            total_items: total,
        })
    }

    pub fn read_text_file(target_path: &str, max_bytes: usize) -> Result<String, String> {
        let p = Path::new(target_path);
        if !p.exists() {
            return Err(format!("File does not exist: {}", target_path));
        }

        let content = fs::read_to_string(p).map_err(|e| format!("Failed to read file: {}", e))?;
        if content.len() > max_bytes {
            Ok(content[..max_bytes].to_string())
        } else {
            Ok(content)
        }
    }
}
