//! GACKS AI Assistant OS — Rust Native Security & Permission Guardrails

use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RiskLevel {
    Read,
    Write,
    Control,
    Destructive,
    Privileged,
}

pub struct SecurityManager {
    allowed_commands: HashSet<String>,
    blocked_process_names: HashSet<String>,
    blocked_pids: HashSet<u32>,
}

impl SecurityManager {
    pub fn new() -> Self {
        let mut allowed = HashSet::new();
        for cmd in ["git", "node", "npm", "cargo", "rustc", "python", "ping", "tracert", "ipconfig", "systeminfo", "tasklist"] {
            allowed.insert(cmd.to_string());
        }

        let mut blocked_procs = HashSet::new();
        for proc in ["system", "csrss.exe", "lsass.exe", "smss.exe", "wininit.exe", "winlogon.exe", "services.exe", "svchost.exe"] {
            blocked_procs.insert(proc.to_lowercase());
        }

        let mut blocked_pids = HashSet::new();
        for pid in [0, 4] {
            blocked_pids.insert(pid);
        }

        Self {
            allowed_commands: allowed,
            blocked_process_names: blocked_procs,
            blocked_pids,
        }
    }

    /// Evaluates whether a process termination is safe and permitted.
    pub fn is_process_termination_safe(&self, pid: u32, process_name: &str) -> Result<(), String> {
        if self.blocked_pids.contains(&pid) {
            return Err(format!("Cannot terminate protected system PID {}", pid));
        }

        let clean_name = process_name.to_lowercase();
        if self.blocked_process_names.contains(&clean_name) {
            return Err(format!("Cannot terminate protected Windows OS process '{}'", process_name));
        }

        Ok(())
    }

    /// Validates if an executable command is in the explicit allowlist.
    pub fn is_command_allowed(&self, command: &str) -> bool {
        let clean = command.trim().to_lowercase();
        let first_token = clean.split_whitespace().next().unwrap_or("");
        let bin_name = Path::new(first_token)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(first_token)
            .to_lowercase();

        self.allowed_commands.contains(&bin_name)
    }

    /// Validates and normalizes paths against traversal attacks.
    pub fn sanitize_path(&self, raw_path: &str) -> Result<PathBuf, String> {
        if raw_path.contains("..") {
            return Err("Path traversal (..) is not permitted".to_string());
        }
        let p = PathBuf::from(raw_path);
        Ok(p)
    }
}
