import { useState, useEffect, useCallback, useRef } from 'react';
import { isTauri, getBackendBaseUrl, APP_VERSION } from '../config';

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes?: string;
  date?: string;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error';

export function useAppUpdater() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0); // 0 to 100
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const tauriUpdateObjRef = useRef<any>(null);

  // Semver comparator: returns true if newVer > curVer
  const isNewerVersion = (newVer: string, curVer: string): boolean => {
    try {
      const p1 = newVer.replace(/^v/, '').split('.').map(Number);
      const p2 = curVer.replace(/^v/, '').split('.').map(Number);
      for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return true;
        if (n1 < n2) return false;
      }
      return false;
    } catch {
      return newVer !== curVer;
    }
  };

  const checkForUpdates = useCallback(async (manual = false) => {
    setStatus('checking');
    setError(null);

    try {
      if (isTauri()) {
        // Desktop updater via Tauri v2 plugin
        try {
          const { check } = await import('@tauri-apps/plugin-updater');
          const update = await check();
          if (update && update.available) {
            tauriUpdateObjRef.current = update;
            setUpdateInfo({
              version: update.version,
              currentVersion: update.currentVersion || APP_VERSION,
              notes: update.body || 'Новое обновление с улучшениями производительности и стабильности.',
              date: update.date,
            });
            setStatus('available');
            setIsModalOpen(true);
            return;
          }
        } catch (tauriErr: any) {
          console.warn('[Updater] Tauri update check error:', tauriErr);
          if (manual) {
            setError(tauriErr.message || 'Ошибка проверки обновления');
            setStatus('error');
            setIsModalOpen(true);
            return;
          }
        }
      } else {
        // Web / Browser version check via backend health endpoint
        try {
          const res = await fetch(`${getBackendBaseUrl()}/health`, { cache: 'no-cache' });
          if (res.ok) {
            const data = await res.json();
            const serverVersion = data.version;
            if (serverVersion && isNewerVersion(serverVersion, APP_VERSION)) {
              setUpdateInfo({
                version: serverVersion,
                currentVersion: APP_VERSION,
                notes: 'Доступна новая версия VoiceChat с улучшениями звука, производительности и интерфейса.',
              });
              setStatus('available');
              setIsModalOpen(true);
              return;
            }
          }
        } catch (webErr: any) {
          console.warn('[Updater] Web check failed:', webErr);
        }
      }

      setStatus('up-to-date');
      if (manual) {
        setIsModalOpen(true);
      }
    } catch (e: any) {
      console.error('[Updater] Error:', e);
      setStatus('error');
      setError(e.message || 'Не удалось проверить наличие обновлений');
      if (manual) setIsModalOpen(true);
    }
  }, []);

  // Install update
  const installUpdate = useCallback(async () => {
    if (isTauri() && tauriUpdateObjRef.current) {
      try {
        setStatus('downloading');
        setDownloadProgress(0);
        let total = 0;
        let downloaded = 0;

        await tauriUpdateObjRef.current.downloadAndInstall((event: any) => {
          if (event.event === 'Started') {
            total = event.data?.contentLength || 0;
            setTotalBytes(total);
          } else if (event.event === 'Progress') {
            downloaded += event.data?.chunkLength || 0;
            setDownloadedBytes(downloaded);
            if (total > 0) {
              const pct = Math.min(100, Math.round((downloaded / total) * 100));
              setDownloadProgress(pct);
            }
          } else if (event.event === 'Finished') {
            setStatus('downloaded');
            setDownloadProgress(100);
          }
        });
      } catch (err: any) {
        console.error('[Updater] Install error:', err);
        setStatus('error');
        setError(err.message || 'Ошибка установки обновления');
      }
    } else {
      // Browser: hard reload to fetch fresh assets from server
      window.location.reload();
    }
  }, []);

  // Check on startup + periodic check every 30 minutes
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 3000);

    const interval = setInterval(() => {
      checkForUpdates(false);
    }, 30 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkForUpdates]);

  return {
    status,
    updateInfo,
    downloadProgress,
    downloadedBytes,
    totalBytes,
    error,
    isModalOpen,
    setIsModalOpen,
    checkForUpdates,
    installUpdate,
  };
}
