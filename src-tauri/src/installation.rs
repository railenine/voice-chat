use std::path::Path;

pub fn is_portable_executable(exe_path: &Path) -> bool {
    let directory = exe_path.parent().unwrap_or(Path::new(""));
    let has_uninstaller = [
        "uninstall.exe",
        "Uninstall VoiceChat.exe",
        "Uninstall RVxis.exe",
        "unins000.exe",
    ]
    .iter()
    .any(|name| directory.join(name).is_file());
    let path = exe_path.to_string_lossy().to_lowercase().replace('/', "\\");
    let in_programs = path.contains("appdata\\local\\programs") || path.contains("program files");
    !has_uninstaller && !in_programs
}

pub fn ensure_portable_executable(exe_path: &Path) -> Result<(), String> {
    if !is_portable_executable(exe_path) {
        return Err("Установленное приложение требует обновления через установщик".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nsis_default_install_uses_installer_updates() {
        let directory = std::env::temp_dir().join(format!(
            "rvxis-install-mode-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&directory).unwrap();
        let executable = directory.join("RVxis.exe");
        assert!(ensure_portable_executable(&executable).is_ok());
        for marker in [
            "uninstall.exe",
            "Uninstall VoiceChat.exe",
            "Uninstall RVxis.exe",
            "unins000.exe",
        ] {
            let marker_path = directory.join(marker);
            std::fs::write(&marker_path, b"test installation marker").unwrap();
            let rejected = ensure_portable_executable(&executable).is_err();
            std::fs::remove_file(&marker_path).unwrap();
            if !rejected {
                std::fs::remove_dir(&directory).unwrap();
                panic!("Installed app with {marker} must reject portable replacement");
            }
        }
        std::fs::remove_dir(&directory).unwrap();
    }

    #[test]
    fn retains_protected_install_paths_and_allows_portable_paths() {
        for path in [
            r"C:\Program Files\RVxis\RVxis.exe",
            r"C:\Users\test\AppData\Local\Programs\RVxis\RVxis.exe",
        ] {
            assert!(ensure_portable_executable(Path::new(path)).is_err());
        }
        assert!(ensure_portable_executable(Path::new(r"E:\Portable\RVxis.exe")).is_ok());
    }
}
