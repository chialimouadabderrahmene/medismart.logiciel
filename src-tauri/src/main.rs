#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};

use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

struct BackendProcess(Mutex<Option<Child>>);

impl Drop for BackendProcess {
    fn drop(&mut self) {
        if let Ok(mut child) = self.0.lock() {
            if let Some(child) = child.as_mut() {
                let _ = child.kill();
            }
        }
    }
}

fn backend_is_running() -> bool {
    let addr: SocketAddr = "127.0.0.1:8000".parse().expect("valid backend address");
    TcpStream::connect_timeout(&addr, Duration::from_millis(250)).is_ok()
}

fn project_root() -> Option<PathBuf> {
    Path::new(env!("CARGO_MANIFEST_DIR")).parent().map(Path::to_path_buf)
}

fn backend_exe_name() -> &'static str {
    if cfg!(windows) {
        "cardio-backend-x86_64-pc-windows-msvc.exe"
    } else {
        "cardio-backend"
    }
}

fn backend_onedir_exe_name() -> &'static str {
    if cfg!(windows) {
        "cardio-backend.exe"
    } else {
        "cardio-backend"
    }
}

fn configure_command(command: &mut Command, app_root: &Path, backend_dir: &Path, data_dir: &Path) {
    command
        .env("CARDIO_APP_ROOT", app_root)
        .env("CARDIO_BACKEND_DIR", backend_dir)
        .env("CARDIO_DATA_DIR", data_dir)
        .env("CARDIO_HOST", "127.0.0.1")
        .env("CARDIO_PORT", "8000")
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
}

fn spawn_packaged_backend(app_root: &Path, backend_dir: &Path, data_dir: &Path) -> Option<Child> {
    let name = backend_exe_name();
    let onedir_name = backend_onedir_exe_name();
    let mut candidates = vec![
        app_root.join("binaries").join("cardio-backend").join(onedir_name),
        app_root.join("cardio-backend").join(onedir_name),
        app_root.join("binaries").join(name),
        app_root.join(name),
    ];

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(exe_dir.join("binaries").join("cardio-backend").join(onedir_name));
            candidates.push(exe_dir.join("cardio-backend").join(onedir_name));
            candidates.push(exe_dir.join("binaries").join(name));
            candidates.push(exe_dir.join(name));
        }
    }

    if let Some(root) = project_root() {
        candidates.push(root.join("src-tauri").join("binaries").join("cardio-backend").join(onedir_name));
        candidates.push(root.join("src-tauri").join("binaries").join(name));
    }

    for candidate in candidates {
        if candidate.is_file() {
            let mut command = Command::new(candidate);
            configure_command(&mut command, app_root, backend_dir, data_dir);
            if let Ok(child) = command.spawn() {
                return Some(child);
            }
        }
    }

    None
}

fn spawn_python_backend(app_root: &Path, backend_dir: &Path, data_dir: &Path) -> Option<Child> {
    let mut commands: Vec<Command> = Vec::new();
    let mut python = Command::new("python");
    python.args(["-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"]);
    commands.push(python);

    if cfg!(windows) {
        let mut py = Command::new("py");
        py.args(["-3", "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"]);
        commands.push(py);
    }

    for mut command in commands {
        command.current_dir(app_root);
        configure_command(&mut command, app_root, backend_dir, data_dir);
        if let Ok(child) = command.spawn() {
            return Some(child);
        }
    }

    None
}

fn seed_database_candidates(app_root: &Path) -> Vec<PathBuf> {
    let mut candidates = vec![app_root.join("data").join("cardiologie.sqlite3")];

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(exe_dir.join("data").join("cardiologie.sqlite3"));
        }
    }

    if let Some(root) = project_root() {
        candidates.push(root.join("data").join("cardiologie.sqlite3"));
    }

    candidates
}

fn bootstrap_data_dir(app_root: &Path, data_dir: &Path) {
    let _ = fs::create_dir_all(data_dir);
    let target = data_dir.join("cardiologie.sqlite3");

    let target_size = if target.is_file() {
        fs::metadata(&target).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    for candidate in seed_database_candidates(app_root) {
        if !candidate.is_file() {
            continue;
        }
        if let (Ok(source), Ok(destination)) = (candidate.canonicalize(), target.canonicalize()) {
            if source == destination {
                return;
            }
        }
        let seed_size = fs::metadata(&candidate).map(|m| m.len()).unwrap_or(0);
        // Skip copy only if target already has a real database (> 1 MB and not much smaller than seed)
        if target_size > 1_000_000 && target_size >= seed_size / 2 {
            return;
        }
        if fs::copy(&candidate, &target).is_ok() {
            return;
        }
    }
}

fn start_backend(app: &tauri::AppHandle) -> Option<Child> {
    let resource_dir = app.path().resource_dir().ok();
    let app_root = resource_dir
        .clone()
        .or_else(project_root)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    let backend_dir = app_root.join("backend");
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| app_root.join("data"))
        .join("data");

    bootstrap_data_dir(&app_root, &data_dir);

    if backend_is_running() {
        return None;
    }

    spawn_packaged_backend(&app_root, &backend_dir, &data_dir)
        .or_else(|| spawn_python_backend(&app_root, &backend_dir, &data_dir))
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let child = start_backend(&app.handle());
            app.manage(BackendProcess(Mutex::new(child)));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MediSmart");
}
