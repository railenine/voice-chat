import { useState, useEffect, useCallback } from 'react';

export interface HotkeyConfig {
  code: string;
  key: string;
  label: string;
}

export const DEFAULT_HOTKEY: HotkeyConfig = {
  code: 'Backquote',
  key: 'ё',
  label: 'Ё / `',
};

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

  // Listener for capturing new hotkey
  useEffect(() => {
    if (!isRecording) return;

    const handleRecordKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default actions (like Esc closing modal or Space scrolling)
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
      });
      setIsRecording(false);
    };

    window.addEventListener('keydown', handleRecordKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleRecordKeyDown, { capture: true });
    };
  }, [isRecording, updateHotkey]);

  // Listener for triggering hotkey during normal operation
  useEffect(() => {
    if (!enabled || isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events from inputs, textareas or contentEditable elements
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (isHotkeyMatch(e, hotkey)) {
        e.preventDefault();
        onTrigger();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, isRecording, hotkey, onTrigger]);

  return {
    hotkey,
    isRecording,
    startRecording: () => setIsRecording(true),
    cancelRecording: () => setIsRecording(false),
    updateHotkey,
    resetHotkey,
  };
}
