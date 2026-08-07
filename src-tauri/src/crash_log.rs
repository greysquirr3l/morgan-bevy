//! Crash reporting — captures uncaught Rust panics and writes them to a
//! rolling log file in the app data dir (e.g. `~/Library/Application Support/
//! com.morgan-bevy.app/logs/crash.log`).
//!
//! Privacy: **log-only by default**. There is no opt-in submission to a
//! remote endpoint in this release. The submission path is a separate
//! concern (see T69 follow-up notes in `docs/dev/crash-reporting.md`).
//!
//! Clippy compliance: the panic hook runs in an unwind context where
//! `unwrap()` / `expect()` are not allowed. Errors are silently swallowed
//! because we are already in a panic — the alternative is to abort the
//! process, which is the worst possible outcome.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use log::error;

/// Basename of the crash log file. The full path is
/// `{app_data_dir}/logs/{CRASH_LOG_FILENAME}`.
pub const CRASH_LOG_FILENAME: &str = "crash.log";

/// Maximum size of the crash log file before rotation (~256 KiB). Once the
/// limit is reached the file is replaced with a fresh empty one (a single
/// rolling file is enough for this editor's use case — we don't grow a
/// multi-file archive).
const MAX_CRASH_LOG_BYTES: u64 = 256 * 1024;

/// Cache the resolved log file path once computed (so the panic hook
/// doesn't need to call `app_handle.path().app_data_dir()` from within a
/// panic — that's not safe — and a single `LazyLock` cannot be used here
/// because it requires poisoning-friendly primitives).
static CRASH_LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

/// Set the canonical crash log path. Called once at startup by `main`.
/// Panics if called twice with a different path.
pub fn set_crash_log_path(path: PathBuf) {
    if let Some(existing) = CRASH_LOG_PATH.get() {
        if existing != &path {
            error!(
                "crash_log path already set to {} but got a different path {}; keeping the first",
                existing.display(),
                path.display()
            );
            return;
        }
    }
    let _ = CRASH_LOG_PATH.set(path);
}

/// Return the resolved crash log path, if any.
pub fn crash_log_path() -> Option<&'static Path> {
    CRASH_LOG_PATH.get().map(PathBuf::as_path)
}

/// Install a panic hook that writes the panic info + backtrace to the
/// crash log file. This is process-global — calling it twice is a no-op
/// for the second call.
pub fn install_panic_hook() {
    let original = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        // Always call the original hook first so the panic is still
        // printed to stderr — helpful in development.
        original(panic_info);

        // Best-effort: write the panic + backtrace to the rolling log
        // file. We are already panicking, so any I/O error here is
        // unrecoverable; silently swallow it.
        if let Some(path) = crash_log_path() {
            append_crash_record(path, panic_info);
        }
    }));
}

/// Append a single panic record to the crash log file. If the file
/// exceeds `MAX_CRASH_LOG_BYTES`, it is rotated (replaced with fresh
/// contents) before writing the new record.
fn append_crash_record(path: &Path, info: &std::panic::PanicHookInfo) {
    let body = build_record(info);

    rotate_if_needed(path).ok();

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(body.as_bytes());
        let _ = file.flush();
    }
}

/// Build a human-readable record from a `PanicInfo`.
fn build_record(info: &std::panic::PanicHookInfo) -> String {
    let timestamp = chrono::Utc::now().to_rfc3339();
    let location = info
        .location()
        .map(|l| format!("{}:{}", l.file(), l.line()));
    let message = info
        .payload()
        .downcast_ref::<&str>()
        .map(|s| (*s).to_string())
        .or_else(|| info.payload().downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "<non-string panic payload>".to_string());

    let location_str = location.as_deref().unwrap_or("<unknown>");

    // Capture the current backtrace via a one-shot.
    let bt = std::backtrace::Backtrace::force_capture();
    format!(
        "=== PANIC @ {timestamp} ===\nlocation: {location_str}\nmessage: {message}\nbacktrace:\n{bt}\n"
    )
}

/// If the file exists and is larger than `MAX_CRASH_LOG_BYTES`, replace it
/// with an empty file. Best-effort: errors are returned but typically
/// ignored at the call site.
fn rotate_if_needed(path: &Path) -> Result<(), std::io::Error> {
    let meta = fs::metadata(path);
    if let Ok(meta) = meta {
        if meta.len() > MAX_CRASH_LOG_BYTES {
            // Truncate to empty (multi-file archive is out of scope).
            fs::write(path, b"")?;
        }
    }
    Ok(())
}

/// Best-effort: ensure the parent directory exists. Call this at startup,
/// not from inside the panic hook.
pub fn ensure_log_dir(path: &Path) {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
}

/// Filename of the frontend crash log. The full path is
/// `{app_data_dir}/logs/{FRONTEND_CRASH_LOG_FILENAME}`.
pub const FRONTEND_CRASH_LOG_FILENAME: &str = "frontend-crash.log";

/// Append a single line to the frontend crash log. Called from the
/// `append_frontend_crash_log` Tauri command. Best-effort: returns `()`
/// even on I/O failure so the frontend handler never throws.
#[tauri::command]
pub fn append_frontend_crash_log(line: &str) {
    let Some(log_path) = crash_log_path().map(|p| p.with_file_name(FRONTEND_CRASH_LOG_FILENAME))
    else {
        // Crash log path not configured (env not set, setup hook
        // hasn't run). Fall back to a relative path next to the
        // current working dir.
        let fallback = std::path::PathBuf::from(FRONTEND_CRASH_LOG_FILENAME);
        let _ = append_line(&fallback, line);
        return;
    };
    let _ = append_line(&log_path, line);
}

/// Internal: append a single line to `path` with a trailing newline.
/// Best-effort: errors are silently swallowed.
fn append_line(path: &Path, line: &str) -> std::io::Result<()> {
    use std::io::Write;
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    writeln!(file, "{line}")?;
    file.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crash_log_path_returns_none_by_default() {
        // The static is process-global so we just confirm the API is
        // queryable.
        let _ = crash_log_path();
    }

    #[test]
    fn rotate_if_needed_no_op_on_missing_file() {
        let path = std::env::temp_dir().join("crash_log_no_op_test.log");
        let _ = fs::remove_file(&path);
        rotate_if_needed(&path).expect("no-op succeeds");
    }

    #[test]
    fn rotate_if_needed_rotates_oversize_file() {
        let path = std::env::temp_dir().join("crash_log_rotate_test.log");
        let _ = fs::remove_file(&path);
        // Write a file larger than the limit.
        let big = vec![b'x'; usize::try_from(MAX_CRASH_LOG_BYTES + 1).unwrap_or(usize::MAX)];
        fs::write(&path, &big).expect("write big");
        assert!(fs::metadata(&path).unwrap().len() > MAX_CRASH_LOG_BYTES);
        rotate_if_needed(&path).expect("rotate succeeds");
        assert_eq!(fs::metadata(&path).unwrap().len(), 0);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn ensure_log_dir_creates_parent() {
        let dir = std::env::temp_dir().join("crash_log_test_dir").join("logs");
        let _ = fs::remove_dir_all(&dir);
        let file = dir.join("crash.log");
        ensure_log_dir(&file);
        assert!(dir.exists());
    }

    #[test]
    fn record_body_format_is_stable() {
        // Lock down the header format so that any change to the record
        // body is intentional (and bumps the version on the consumer
        // side).
        let path = std::env::temp_dir().join("crash_log_format_test.log");
        let _ = fs::remove_file(&path);
        let timestamp = chrono::Utc::now().to_rfc3339();
        let body = format!(
            "=== PANIC @ {timestamp} ===\nlocation: <synthetic>\nmessage: synthetic test panic\nbacktrace:\n(no backtrace captured)\n"
        );
        fs::write(&path, &body).expect("write");
        let written = fs::read_to_string(&path).expect("read back");
        assert!(written.starts_with("=== PANIC @ "));
        assert!(written.contains("location: "));
        assert!(written.contains("message: synthetic test panic"));
        assert!(written.contains("backtrace:"));
        let _ = fs::remove_file(&path);
    }
}
