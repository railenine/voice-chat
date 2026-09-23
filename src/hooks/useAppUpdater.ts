import { useState, useEffect, useCallback, useRef } from 'react';
import { isTauri, getBackendBaseUrl, APP_VERSION } from '../config';

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes?: string;
  date?: string;
  portableUrl?: string;
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
  const [isPortable, setIsPortable] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0); // 0 to 100
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const tauriUpdateObjRef = useRef<any>(null);

  // Check if running in portable mode on desktop
  useEffect(() => {
    if (isTauri()) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke<boolean>('is_portable_mode')
          .then((res) => setIsPortable(!!res))
          .catch(() => setIsPortable(true));
      }).catch(() => {});
    }
  }, []);

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
    if (manual) {
      setIsModalOpen(true);
    }

    const checkStartTime = Date.now();
    const waitMinDisplay = async () => {
      if (manual) {
        const elapsed = Date.now() - checkStartTime;
        if (elapsed < 650) {
          await new Promise((r) => setTimeout(r, 650 - elapsed));
        }
      }
    };

    try {
      if (isTauri()) {
        // 1. Try Desktop updater via Tauri v2 plugin
        let tauriFound = false;
        try {
          const { check } = await import('@tauri-apps/plugin-updater');
          const update = await check();
          if (update && update.available) {
            await waitMinDisplay();
            tauriUpdateObjRef.current = update;
            const portableUrl = String((update as any).rawJson?.portable_url || `https://github.com/railenine/voice-chat/releases/download/v${update.version}/voice-chat.exe`);
            setUpdateInfo({
              version: update.version,
              currentVersion: update.currentVersion || APP_VERSION,
              notes: update.body || 'Новое обновление с улучшениями звука, производительности и стабильности.',
              date: update.date,
              portableUrl,
            });
            setStatus('available');
            setIsModalOpen(true);
            tauriFound = true;
            return;
          }
        } catch (tauriErr: any) {
          console.warn('[Updater] Tauri native update check error:', tauriErr);
        }

        // 2. Desktop Fallback: check server version via /peerjs/info (which is always reachable through Nginx)
        if (!tauriFound) {
          try {
            const res = await fetch(`${getBackendBaseUrl()}/peerjs/info`, { cache: 'no-cache' });
            if (res.ok) {
              const data = await res.json();
              const serverVersion = data.version;
              if (serverVersion && isNewerVersion(serverVersion, APP_VERSION)) {
                await waitMinDisplay();
                setUpdateInfo({
                  version: serverVersion,
                  currentVersion: APP_VERSION,
                  notes: `Доступна новая версия VoiceChat v${serverVersion} с исправлениями звука и стабильности.`,
                  portableUrl: `https://github.com/railenine/voice-chat/releases/download/v${serverVersion}/voice-chat.exe`,
                });
                setStatus('available');
                setIsModalOpen(true);
                return;
              }
            }
          } catch (fbErr) {
            console.warn('[Updater] Desktop version check fallback failed:', fbErr);
          }
        }
      } else {
        // Web / Browser version check via backend /peerjs/info endpoint (works reliably across all Nginx proxies)
        try {
          let serverVersion = '';
          try {
            const res = await fetch(`${getBackendBaseUrl()}/peerjs/info`, { cache: 'no-cache' });
            if (res.ok) {
              const data = await res.json();
              serverVersion = data.version;
            }
          } catch {}

          if (!serverVersion) {
            const res = await fetch(`${getBackendBaseUrl()}/health`, { cache: 'no-cache' });
            if (res.ok) {
              const data = await res.json();
              serverVersion = data.version;
            }
          }

          if (serverVersion && isNewerVersion(serverVersion, APP_VERSION)) {
            await waitMinDisplay();
            setUpdateInfo({
              version: serverVersion,
              currentVersion: APP_VERSION,
              notes: 'Доступна новая версия VoiceChat с улучшениями звука, производительности и интерфейса.',
            });
            setStatus('available');
            setIsModalOpen(true);
            return;
          }
        } catch (webErr: any) {
          console.warn('[Updater] Web check failed:', webErr);
        }
      }

      await waitMinDisplay();
      setStatus('up-to-date');
      if (manual) {
        setIsModalOpen(true);
      }
    } catch (e: any) {
      await waitMinDisplay();
      console.error('[Updater] Error:', e);
      setStatus('error');
      setError(e.message || 'Не удалось проверить наличие обновлений');
      if (manual) setIsModalOpen(true);
    }
  }, []);

  // Install update: supports both 'portable' in-place swap and 'installer' setup
  const installUpdate = useCallback(async (mode?: 'portable' | 'installer') => {
    if (isTauri()) {
      const targetMode = mode || (isPortable ? 'portable' : 'installer');

      if (targetMode === 'portable') {
        // Portable mode: download standalone voice-chat.exe and swap in-place
        try {
          setStatus('downloading');
          setDownloadProgress(0);
          const { invoke } = await import('@tauri-apps/api/core');
          const { listen } = await import('@tauri-apps/api/event');

          let unlistenProgress: (() => void) | null = null;
          try {
            unlistenProgress = await listen('portable-update-progress', (event: any) => {
              const { downloaded, total } = event.payload || {};
              setDownloadedBytes(downloaded || 0);
              setTotalBytes(total || 0);
              if (total > 0) {
                setDownloadProgress(Math.min(100, Math.round(((downloaded || 0) / total) * 100)));
              }
            });
          } catch (e) {
            console.warn('[Updater] Could not attach progress listener:', e);
          }

          const downloadUrl = updateInfo?.portableUrl || `https://github.com/railenine/voice-chat/releases/download/v${updateInfo?.version || APP_VERSION}/voice-chat.exe`;
          await invoke('apply_portable_update', { downloadUrl });
          if (unlistenProgress) unlistenProgress();
        } catch (err: any) {
          console.error('[Updater] Portable update error:', err);
          setStatus('error');
          const msg = typeof err === 'string' ? err : err?.message || (err ? String(err) : 'Ошибка портативного обновления');
          setError(msg);
        }
      } else if (tauriUpdateObjRef.current) {
        // Installer mode: run standard NSIS installer
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
          const msg = typeof err === 'string' ? err : err?.message || (err ? String(err) : 'Ошибка установки обновления');
          setError(msg);
        }
      } else {
        // Fallback: open GitHub Releases in browser
        try {
          window.open('https://github.com/railenine/voice-chat/releases/latest', '_blank');
        } catch {
          window.location.href = 'https://github.com/railenine/voice-chat/releases/latest';
        }
      }
    } else {
      // Browser: hard reload to fetch fresh assets from server
      window.location.reload();
    }
  }, [isPortable, updateInfo]);

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
    isPortable,
    checkForUpdates,
    installUpdate,
  };
}
