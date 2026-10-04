import { useState, useEffect, useCallback, useRef } from 'react';
import { isTauri, getBackendBaseUrl, APP_VERSION } from '../config';
import { isNewerVersion } from '../utils/semver';
import { UpdateInfo, UpdateStatus } from '../utils/updaterTypes';
import { shouldAutoOpenUpdateModal, buildUpdaterUrl } from '../utils/updaterPolicy';

export type { UpdateInfo, UpdateStatus };

interface UseAppUpdaterOptions {
  isInRoom?: boolean;
}

const DISMISSED_VERSION_KEY = 'rvxis_dismissed_update_version';

export function useAppUpdater(options?: UseAppUpdaterOptions) {
  const isInRoom = !!options?.isInRoom;
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isPortable, setIsPortable] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const tauriUpdateObjRef = useRef<any>(null);

  // Check if running in portable mode on desktop
  useEffect(() => {
    if (isTauri()) {
      import('@tauri-apps/api/core')
        .then(({ invoke }) => {
          invoke<boolean>('is_portable_mode')
            .then((res) => setIsPortable(!!res))
            .catch(() => setIsPortable(true));
        })
        .catch(() => {});
    }
  }, []);

  const checkForUpdates = useCallback(async (manual = false) => {
    // 1. Check offline status first
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('offline');
      if (manual) {
        setIsModalOpen(true);
      }
      return;
    }

    setStatus('checking');
    setError(null);
    if (manual) {
      setIsModalOpen(true);
    }

    const checkStartTime = Date.now();
    const waitMinDisplay = async () => {
      if (manual) {
        const elapsed = Date.now() - checkStartTime;
        if (elapsed < 500) {
          await new Promise((r) => setTimeout(r, 500 - elapsed));
        }
      }
    };

    try {
      if (isTauri()) {
        let tauriFound = false;

        // 1. Desktop native check via Tauri v2 plugin
        try {
          const { check } = await import('@tauri-apps/plugin-updater');
          const update = await check();
          if (update && update.available) {
            await waitMinDisplay();
            tauriUpdateObjRef.current = update;

            const rawJson = (update as any).rawJson || {};
            const rawPortable = rawJson.portable?.['windows-x86_64'] || {};
            const rawPlatform = rawJson.platforms?.['windows-x86_64'] || {};

            const portableUrl =
              rawPortable.url ||
              rawJson.portable_url ||
              `https://github.com/railenine/voice-chat/releases/download/v${update.version}/RVxis.exe`;

            const info: UpdateInfo = {
              version: update.version,
              currentVersion: update.currentVersion || APP_VERSION,
              notes: update.body || 'Новое обновление с улучшениями звука, производительности и стабильности.',
              date: update.date,
              portableUrl,
              portableSha256: rawPortable.sha256,
              portableSize: rawPortable.size,
              installerUrl: rawPlatform.url,
              installerSha256: rawPlatform.sha256,
              installerSize: rawPlatform.size,
            };

            setUpdateInfo(info);
            setStatus('available');

            // Suppression check: don't auto-pop if inside active room or previously dismissed
            const dismissed = localStorage.getItem(DISMISSED_VERSION_KEY);
            if (shouldAutoOpenUpdateModal({
              availableVersion: update.version,
              isManual: manual,
              isInRoom,
              dismissedVersion: dismissed,
            })) {
              setIsModalOpen(true);
            }
            tauriFound = true;
            return;
          }
        } catch (tauriErr: any) {
          console.warn('[Updater] Tauri native check failed:', tauriErr?.message || tauriErr);
        }

        // 2. Desktop Fallback: check server latest.json or /peerjs/info with cache-busting
        if (!tauriFound) {
          try {
            const manifestUrl = buildUpdaterUrl(getBackendBaseUrl());
            const res = await fetch(manifestUrl, {
              cache: 'no-cache',
            });
            if (res.ok) {
              const manifest = await res.json();
              if (manifest.version && isNewerVersion(manifest.version, APP_VERSION)) {
                await waitMinDisplay();
                const rawPortable = manifest.portable?.['windows-x86_64'] || {};
                const rawPlatform = manifest.platforms?.['windows-x86_64'] || {};

                const info: UpdateInfo = {
                  version: manifest.version,
                  currentVersion: APP_VERSION,
                  notes: manifest.notes || `Доступна новая версия RVxis v${manifest.version}.`,
                  portableUrl:
                    rawPortable.url ||
                    manifest.portable_url ||
                    `https://github.com/railenine/voice-chat/releases/download/v${manifest.version}/RVxis.exe`,
                  portableSha256: rawPortable.sha256,
                  portableSize: rawPortable.size,
                  installerUrl: rawPlatform.url,
                  installerSha256: rawPlatform.sha256,
                  installerSize: rawPlatform.size,
                };

                setUpdateInfo(info);
                setStatus('available');

                const dismissed = localStorage.getItem(DISMISSED_VERSION_KEY);
                if (shouldAutoOpenUpdateModal({
                  availableVersion: manifest.version,
                  isManual: manual,
                  isInRoom,
                  dismissedVersion: dismissed,
                })) {
                  setIsModalOpen(true);
                }
                return;
              }
            }
          } catch (fbErr) {
            console.warn('[Updater] Fallback manifest check failed:', fbErr);
          }
        }
      } else {
        // Web / Browser version check via backend /peerjs/info endpoint
        try {
          let serverVersion = '';
          const cacheBuster = `_t=${Date.now()}`;
          try {
            const res = await fetch(`${getBackendBaseUrl()}/peerjs/info?${cacheBuster}`, { cache: 'no-cache' });
            if (res.ok) {
              const data = await res.json();
              serverVersion = data.version;
            }
          } catch {}

          if (!serverVersion) {
            const res = await fetch(`${getBackendBaseUrl()}/health?${cacheBuster}`, { cache: 'no-cache' });
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
              notes: 'Доступна новая версия RVxis с улучшениями звука, производительности и интерфейса.',
            });
            setStatus('available');

            const dismissed = localStorage.getItem(DISMISSED_VERSION_KEY);
            if (shouldAutoOpenUpdateModal({
              availableVersion: serverVersion,
              isManual: manual,
              isInRoom,
              dismissedVersion: dismissed,
            })) {
              setIsModalOpen(true);
            }
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
      console.error('[Updater] Check error:', e);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setStatus('offline');
      } else {
        setStatus('error');
        setError(e.message || 'Не удалось проверить наличие обновлений');
      }
      if (manual) setIsModalOpen(true);
    }
  }, [isInRoom]);

  // Install update: supports both 'portable' in-place swap and 'installer' setup
  const installUpdate = useCallback(async (mode?: 'portable' | 'installer') => {
    if (isTauri()) {
      const targetMode = mode || (isPortable ? 'portable' : 'installer');

      if (targetMode === 'portable') {
        // Portable mode: download standalone RVxis.exe and swap in-place
        try {
          setStatus('downloading');
          setDownloadProgress(0);
          setDownloadedBytes(0);
          setTotalBytes(updateInfo?.portableSize || 0);

          const { invoke } = await import('@tauri-apps/api/core');
          const { listen } = await import('@tauri-apps/api/event');

          let unlistenProgress: (() => void) | null = null;
          try {
            unlistenProgress = await listen('portable-update-progress', (event: any) => {
              const { downloaded, total } = event.payload || {};
              setDownloadedBytes(downloaded || 0);
              if (total > 0) {
                setTotalBytes(total);
                setDownloadProgress(Math.min(100, Math.round(((downloaded || 0) / total) * 100)));
              }
            });
          } catch (e) {
            console.warn('[Updater] Could not attach progress listener:', e);
          }

          const downloadUrl =
            updateInfo?.portableUrl ||
            `https://github.com/railenine/voice-chat/releases/download/v${updateInfo?.version || APP_VERSION}/RVxis.exe`;

          setStatus('installing');

          await invoke('apply_portable_update', {
            downloadUrl,
            expectedSha256: updateInfo?.portableSha256 || null,
            expectedSize: updateInfo?.portableSize || null,
          });

          setStatus('restart-required');
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
          setStatus('error');
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

  // Dismiss modal: remember this version in localStorage so auto-check won't reopen
  const dismissModal = useCallback(() => {
    if (updateInfo?.version && status === 'available') {
      localStorage.setItem(DISMISSED_VERSION_KEY, updateInfo.version);
    }
    setIsModalOpen(false);
  }, [updateInfo, status]);

  // Auto-check on startup + periodic check every 30 minutes
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 4000);

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
    dismissModal,
    hasAvailableUpdate: status === 'available' && !!updateInfo,
  };
}
