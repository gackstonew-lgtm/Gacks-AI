# GACKS Rust Native OS Core Service

High-performance, secure Windows operating-system and native integration service for the **GACKS AI Assistant Operating System**.

## Responsibilities
- **Windows System Telemetry**: CPU, RAM, GPU, battery, network devices, and drive metrics.
- **Process Supervision**: Inspection, memory tracking, and protected termination.
- **Desktop Window Management**: Window enumeration, active focus switching.
- **Secure Sandboxed Commands**: Strict allowlist execution with timeouts and output bounds.
- **Filesystem Operations**: Sandboxed paths, metadata extraction, safe reading/writing.

## Compilation & Execution
```bash
cargo check
cargo build --release
./target/release/gacks-rust-native-core
```
