use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};
use std::io::Read;
use std::sync::atomic::{AtomicBool, Ordering};

pub const MAX_UPDATE_BYTES: u64 = 128 * 1024 * 1024;
static UPDATING: AtomicBool = AtomicBool::new(false);

pub struct UpdateGuard;
impl UpdateGuard {
    pub fn acquire() -> Result<Self, String> {
        UPDATING.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| Self).map_err(|_| "Обновление уже выполняется".into())
    }
}
impl Drop for UpdateGuard {
    fn drop(&mut self) { UPDATING.store(false, Ordering::SeqCst); }
}

pub fn verify_reader(mut reader: impl Read, encoded_signature: &str, encoded_key: &str) -> Result<(), String> {
    let decode = |value: &str| -> Result<String, String> {
        String::from_utf8(STANDARD.decode(value.trim()).map_err(|_| "Некорректная подпись обновления")?)
            .map_err(|_| "Некорректная кодировка подписи".into())
    };
    let key = PublicKey::decode(&decode(encoded_key)?).map_err(|_| "Некорректный публичный ключ")?;
    let signature = Signature::decode(&decode(encoded_signature)?).map_err(|_| "Отсутствует корректная подпись издателя")?;
    let mut verifier = key.verify_stream(&signature).map_err(|_| "Подпись другого издателя или устаревшего формата")?;
    let mut buffer = [0u8; 65536];
    loop {
        let n = reader.read(&mut buffer).map_err(|_| "Не удалось прочитать обновление")?;
        if n == 0 { break; }
        verifier.update(&buffer[..n]);
    }
    verifier.finalize().map_err(|_| "Подпись обновления не прошла проверку".into())
}

pub fn verify_download(path: &std::path::Path, signature: &str) -> Result<(), String> {
    let file = std::fs::File::open(path).map_err(|_| "Не удалось открыть обновление")?;
    verify_reader(file, signature, include_str!("../voicechat.key.pub"))
}

#[cfg(test)]
mod tests {
    use super::*;
    // Public prehashed test vector from minisign-verify (ISC license).
    const KEY: &str = "untrusted comment: test key\nRWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3";
    const SIG: &str = "untrusted comment: signature from minisign secret key\nRUQf6LRCGA9i559r3g7V1qNyJDApGip8MfqcadIgT9CuhV3EMhHoN1mGTkUidF/z7SrlQgXdy8ofjb7bNJJylDOocrCo8KLzZwo=\ntrusted comment: timestamp:1556193335\tfile:test\ny/rUw2y8/hOUYjZU71eHp/Wo1KZ40fGy2VJEDl34XMJM+TX48Ss/17u3IvIfbVR1FkZZSNCisQbuQY+bHwhEBg==";
    #[test]
    fn authentic_signature_and_tampering() {
        let key = STANDARD.encode(KEY); let sig = STANDARD.encode(SIG);
        assert!(verify_reader(&b"test"[..], &sig, &key).is_ok());
        assert!(verify_reader(&b"Test"[..], &sig, &key).is_err());
        assert!(verify_reader(&b"test"[..], "", &key).is_err());
        assert!(verify_reader(&b"test"[..], &sig, include_str!("../voicechat.key.pub")).is_err());
    }
    #[test]
    fn serializes_updates_and_releases_on_failure() {
        let first = UpdateGuard::acquire().unwrap();
        assert!(UpdateGuard::acquire().is_err());
        drop(first);
        assert!(UpdateGuard::acquire().is_ok());
    }
}
