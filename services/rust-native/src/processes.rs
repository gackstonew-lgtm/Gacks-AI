//! GACKS AI Assistant OS — Native Process Manager

use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessSummary {
    pub pid: u32,
    pub name: String,
    pub memory_bytes: u64,
    pub cpu_usage_percent: f32,
    pub is_system: bool,
}

pub struct ProcessEngine;

impl ProcessEngine {
    pub fn list_processes(limit: usize) -> Vec<ProcessSummary> {
        let mut sys = System::new_all();
        sys.refresh_processes();

        let mut procs: Vec<ProcessSummary> = sys.processes().iter().map(|(pid, proc)| {
            let pid_u32 = pid.as_u32();
            let name = proc.name().to_string();
            let is_system = pid_u32 == 0 || pid_u32 == 4 || name.to_lowercase().contains("system") || name.to_lowercase().contains("svchost");

            ProcessSummary {
                pid: pid_u32,
                name,
                memory_bytes: proc.memory(),
                cpu_usage_percent: (proc.cpu_usage() * 10.0).round() / 10.0,
                is_system,
            }
        }).collect();

        // Sort by memory descending
        procs.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
        procs.into_iter().take(limit).collect()
    }
}
