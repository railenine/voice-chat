// Included only in a disposable source snapshot by build-updater-fixture.js.
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
pub async fn fixture_check(webview: tauri::Webview) -> Result<Option<serde_json::Value>, String> {
    let root = reqwest::Certificate::from_pem(include_bytes!("../fixture-ca.pem"))
        .map_err(|error| error.to_string())?;
    let updater = webview.updater_builder()
        .endpoints(vec!["https://localhost:9443/latest.json".parse().unwrap()])
        .map_err(|error| error.to_string())?
        .no_proxy()
        .timeout(std::time::Duration::from_secs(10))
        .configure_client(move |client| client.add_root_certificate(root.clone()))
        .build().map_err(|error| error.to_string())?;
    let update = updater.check().await.map_err(|error| error.to_string())?;
    if let Some(update) = update {
        if !update.download_url.as_str().starts_with("https://localhost:9443/files/") {
            return Err("Fixture refuses a nonlocal update URL".into());
        }
        let mut metadata = serde_json::json!({ "currentVersion": update.current_version,
            "version": update.version, "body": update.body, "rawJson": update.raw_json });
        metadata["rid"] = serde_json::json!(webview.resources_table().add(update));
        Ok(Some(metadata))
    } else { Ok(None) }
}

#[cfg(test)]
mod tests {
    #[test]
    fn fixture_signer_is_accepted_by_the_real_native_verifier() {
        let data = b"rvxis-local-updater-fixture";
        let signature = include_str!("../fixture-signature.txt");
        let key = include_str!("../voicechat.key.pub");
        assert!(crate::portable_security::verify_reader(&data[..], signature, key).is_ok());
        assert!(crate::portable_security::verify_reader(&b"rvxis-tampered-fixture"[..], signature, key).is_err());
    }
}
