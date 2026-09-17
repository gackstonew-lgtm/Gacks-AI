//! GACKS AI Assistant OS — System Hardware & OS Telemetry Engine

use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Debug, Serialize, Deserialize)]
pub struct HardwareTelemetry {
    pub platform: String,
    pub hostname: String,
    pub os_version: String,
    pub total_memory_bytes: u64,
    pub used_memory_bytes: u64,
    pub memory_usage_percent: f32,
    pub cpu_count: usize,
    pub cpu_brand: String,
    pub global_cpu_usage: f32,
    pub uptime_seconds: u64,
    pub is_windows: bool,
}

pub struct SystemEngine {
    sys: System,
}

impl SystemEngine {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();
        Self { sys }
    }

    pub fn get_telemetry(&mut self) -> HardwareTelemetry {
        self.sys.refresh_all();

        let total_mem = self.sys.total_memory();
        let used_mem = self.sys.used_memory();
        let mem_pct = if total_mem > 0 {
            (used_mem as f32 / total_mem as f32) * 100.0
        } else {
            0.0
        };

        let cpu_brand = self.sys.cpus().first()
            .map(|c| c.brand().to_string())
            .unwrap_or_else(|| "Unknown CPU".to_string());

        HardwareTelemetry {
            platform: std::env::consts::OS.to_string(),
            hostname: System::host_name().unwrap_or_else(|| "localhost".to_string()),
            os_version: System::os_version().unwrap_or_else(|| "Windows".to_string()),
            total_memory_bytes: total_mem,
            used_memory_bytes: used_mem,
            memory_usage_percent: (mem_pct * 10.0).round() / 10.0,
            cpu_count: self.sys.cpus().len(),
            cpu_brand,
            global_cpu_usage: (self.sys.global_cpu_info().cpu_usage() * 10.0).round() / 10.0,
            uptime_seconds: System::uptime(),
            is_windows: cfg!(target_os = "windows"),
        }
    }
}
