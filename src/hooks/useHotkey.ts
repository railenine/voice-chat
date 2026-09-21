import { useState, useEffect, useCallback, useRef } from 'react';

export interface HotkeyConfig {
  code: string;
  key: string;
  label: string;
  type?: 'keyboard' | 'mouse';
  button?: number;
}

export const DEFAULT_HOTKEY: HotkeyConfig = {
  code: 'Backquote',
  key: 'ё',
  label: 'Ё / `',
  type: 'keyboard',
};

export const MOUSE_HOTKEY_OPTIONS: HotkeyConfig[] = [
  { code: 'Mouse3', key: 'Mouse3', label: 'Колёсико (Mouse 3)', type: 'mouse', button: 1 },
  { code: 'Mouse4', key: 'Mouse4', label: 'Мышь 4 (Боковая 1)', type: 'mouse', button: 3 },
  { code: 'Mouse5', key: 'Mouse5', label: 'Мышь 5 (Боковая 2)', type: 'mouse', button: 4 },
  { code: 'Mouse2', key: 'Mouse2', label: 'ПКМ (Mouse 2)', type: 'mouse', button: 2 },
];

export function mouseButtonToConfig(button: number): HotkeyConfig | null {
  return MOUSE_HOTKEY_OPTIONS.find((opt) => opt.button === button) || null;
}

export function mouseCodeToConfig(code: string): HotkeyConfig | null {
  return MOUSE_HOTKEY_OPTIONS.find((opt) => opt.code === code) || null;
}

const STORAGE_KEY = 'voice_chat_mute_hotkey';

export function formatKeyLabel(code: string, key: string): string {
  if (code === 'Backquote' || key.toLowerCase() === 'ё' || key === '`' || key === '~') {
    return 'Ё / `';
  }
  if (code === 'Space') return 'Пробел';
  if (code === 'Escape') return 'Esc';
  if (code === 'Enter') return 'Enter';
  if (code === 'Backspace') return 'Backspace';
  if (code === 'Tab') return 'Tab';
  if (code === 'CapsLock') return 'Caps Lock';
  if (code.startsWith('Key')) return code.replace('Key', '').toUpperCase();
  if (code.startsWith('Digit')) return code.replace('Digit', '');
  if (code.startsWith('Numpad')) return `Num ${code.replace('Numpad', '')}`;
  if (/^F\d{1,2}$/.test(code)) return code;
  if (key && key.length === 1) return key.toUpperCase();
  return code || key;
}

export function isHotkeyMatch(e: KeyboardEvent, hotkey: HotkeyConfig): boolean {
  if (hotkey.type === 'mouse') return false;

  // Backquote / 'ё' / '`' match
  if (
    (hotkey.code === 'Backquote' || hotkey.key.toLowerCase() === 'ё') &&
    (e.code === 'Backquote' || e.key.toLowerCase() === 'ё' || e.key === '`' || e.key === '~')
  ) {
    return true;
  }
  if (hotkey.code && e.code && e.code.toLowerCase() === hotkey.code.toLowerCase()) {
    return true;
  }
  if (hotkey.key && e.key && e.key.toLowerCase() === hotkey.key.toLowerCase()) {
    return true;
  }
  return false;
}

export const isTauri = (): boolean =>
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export function toTauriShortcut(config: HotkeyConfig): string {
  if (config.code === 'Backquote' || config.key.toLowerCase() === 'ё' || config.key === '`' || config.key === '~') {
    return 'Backquote';
  }
  if (config.code === 'Space') return 'Space';
  if (config.code.startsWith('Key')) return config.code.replace('Key', '').toUpperCase();
  if (config.code.startsWith('Digit')) return config.code.replace('Digit', '');
  if (/^F\d{1,2}$/i.test(config.code)) return config.code.toUpperCase();
  return config.code || config.key;
}

interface UseHotkeyOptions {
  onTrigger: () => void;
  enabled?: boolean;
}

export function useHotkey({ onTrigger, enabled = true }: UseHotkeyOptions) {
  const [hotkey, setHotkeyState] = useState<HotkeyConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.code && parsed.label) {
          return parsed;
        }
      }
    } catch (e) {}
    return DEFAULT_HOTKEY;
  });

  const [isRecording, setIsRecording] = useState(false);

  // Keep latest onTrigger in ref to avoid stale closures and unnecessary re-subscriptions
  const onTriggerRef = useRef(onTrigger);
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  // Debounce/cooldown to prevent rapid double triggers (e.g. mousedown + auxclick, or OS hook + webview)
  const lastTriggerTimeRef = useRef(0);
  const triggerSafely = useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 250) {
      return;
    }
    lastTriggerTimeRef.current = now;
    onTriggerRef.current();
  }, []);

  // Save hotkey to state and localStorage
  const updateHotkey = useCallback((newConfig: HotkeyConfig) => {
    setHotkeyState(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {}
  }, []);

  // Reset to default
  const resetHotkey = useCallback(() => {
    updateHotkey(DEFAULT_HOTKEY);
  }, [updateHotkey]);

  // Listener for capturing new hotkey (Keyboard + Mouse)
  useEffect(() => {
    if (!isRecording) return;

    const handleRecordKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't bind lone modifier keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      const label = formatKeyLabel(e.code, e.key);
      updateHotkey({
        code: e.code,
        key: e.key,
        label,
        type: 'keyboard',
      });
      setIsRecording(false);
    };

    const handleRecordMouseDown = (e: MouseEvent) => {
      // Ignore left click (button 0) so user can still click cancel / UI
      if (e.button === 0) return;

      e.preventDefault();
      e.stopPropagation();

      const config = mouseButtonToConfig(e.button);
      if (config) {
        updateHotkey(config);
        setIsRecording(false);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('keydown', handleRecordKeyDown, { capture: true });
    window.addEventListener('mousedown', handleRecordMouseDown, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleRecordKeyDown, { capture: true });
      window.removeEventListener('mousedown', handleRecordMouseDown, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, [isRecording, updateHotkey]);

  // Web Listener for triggering hotkey during normal operation in browser window
  useEffect(() => {
    if (!enabled || isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (hotkey.type !== 'mouse' && isHotkeyMatch(e, hotkey)) {
        e.preventDefault();
        triggerSafely();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (hotkey.type === 'mouse' && hotkey.button === e.button) {
        e.preventDefault();
        e.stopPropagation();
        triggerSafely();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [enabled, isRecording, hotkey, triggerSafely]);

  // Tauri OS-wide Global Mouse Event listener (works in background / full-screen games)
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | null = null;
    let isCancelled = false;

    import('@tauri-apps/api/event').then(({ listen }) => {
      if (isCancelled) return;
      listen<string>('global-mouse-click', (event) => {
        const btnCode = event.payload;
        if (isRecording) {
          const cfg = mouseCodeToConfig(btnCode);
          if (cfg) {
            updateHotkey(cfg);
            setIsRecording(false);
          }
        } else if (enabled && hotkey.type === 'mouse' && hotkey.code === btnCode) {
          triggerSafely();
        }
      }).then((u) => {
        if (isCancelled) {
          u();
        } else {
          unlisten = u;
        }
      });
    });

    return () => {
      isCancelled = true;
      if (unlisten) unlisten();
    };
  }, [isRecording, enabled, hotkey, triggerSafely, updateHotkey]);

  // Tauri OS-wide Global Keyboard Shortcut registration
  useEffect(() => {
    if (!enabled || !isTauri() || hotkey.type === 'mouse') return;

    let activeShortcut: string | null = null;
    let isCancelled = false;

    const setupTauriShortcut = async () => {
      try {
        const { register, unregister, isRegistered } = await import('@tauri-apps/plugin-global-shortcut');
        const shortcut = toTauriShortcut(hotkey);

        if (isCancelled) return;

        const alreadyRegistered = await isRegistered(shortcut);
        if (alreadyRegistered) {
          await unregister(shortcut);
        }

        await register(shortcut, (event) => {
          if (event.state === 'Pressed') {
            triggerSafely();
          }
        });

        activeShortcut = shortcut;
        console.log(`[Tauri] Global keyboard shortcut registered: ${shortcut}`);
      } catch (err) {
        console.warn('[Tauri] Failed to register global keyboard shortcut:', err);
      }
    };

    setupTauriShortcut();

    return () => {
      isCancelled = true;
      if (activeShortcut) {
        import('@tauri-apps/plugin-global-shortcut').then(({ unregister }) => {
          unregister(activeShortcut!).catch(() => {});
        });
      }
    };
  }, [enabled, hotkey, triggerSafely]);

  return {
    hotkey,
    isRecording,
    isDesktop: isTauri(),
    startRecording: () => setIsRecording(true),
    cancelRecording: () => setIsRecording(false),
    updateHotkey,
    resetHotkey,
  };
}
