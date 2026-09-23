import React, { useState, useEffect, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { isTauri, APP_VERSION } from '../config';
import { Tooltip } from './Tooltip';

interface TitleBarProps {
  roomId?: string;
  onCheckUpdates?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ roomId, onCheckUpdates }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  // Invoke helper with graceful fallback
  const invokeCommand = useCallback(async <T = any>(command: string, args?: Record<string, any>): Promise<T | null> => {
    if (!isTauri()) return null;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<T>(command, args);
    } catch (err) {
      console.warn(`[TitleBar] Failed to invoke '${command}':`, err);
      return null;
    }
  }, []);

  // Check initial maximized state
  useEffect(() => {
    if (!isTauri()) return;
    invokeCommand<boolean>('is_window_maximized').then((res) => {
      if (typeof res === 'boolean') {
        setIsMaximized(res);
      }
    });

    const handleResize = () => {
      invokeCommand<boolean>('is_window_maximized').then((res) => {
        if (typeof res === 'boolean') {
          setIsMaximized(res);
        }
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [invokeCommand]);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await invokeCommand('minimize_window');
  };

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const res = await invokeCommand<boolean>('toggle_maximize_window');
    if (typeof res === 'boolean') {
      setIsMaximized(res);
    } else {
      setIsMaximized((prev) => !prev);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await invokeCommand('close_window');
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    // Only primary left click
    if (e.button !== 0) return;
    // Don't drag if clicking on a button (minimize, maximize, close)
    if ((e.target as HTMLElement).closest('button')) return;
    // If double click, let onDoubleClick handle toggle maximize
    if (e.detail > 1) return;

    await invokeCommand('start_drag');
  };

  if (!isTauri()) {
    return null;
  }

  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDoubleClick={() => handleToggleMaximize()}
      className="h-[34px] w-full bg-slate-950/95 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between select-none z-50 flex-shrink-0 text-xs font-sans cursor-default"
    >
      {/* Left: App Logo, Name & Room Badge */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 px-3 h-full cursor-default"
      >
        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-700 via-blue-500 to-sky-400 flex items-center justify-center shadow-sm shadow-blue-500/40 flex-shrink-0">
          <Mic className="w-2.5 h-2.5 text-white" />
        </div>
        <span className="font-semibold text-white/90 text-xs tracking-tight">VoiceChat</span>
        {roomId ? (
          <span className="bg-blue-500/15 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono text-[10px] tracking-wider">
            #{roomId}
          </span>
        ) : (
          <Tooltip
            content="Проверить обновления"
            description="Нажмите, чтобы проверить наличие новой версии"
            position="bottom"
          >
            <button
              type="button"
              onClick={onCheckUpdates}
              className="text-[10px] text-gray-500 hover:text-blue-400 font-mono transition-colors cursor-pointer"
            >
              v{APP_VERSION}
            </button>
          </Tooltip>
        )}
      </div>

      {/* Middle: Draggable title space */}
      <div
        data-tauri-drag-region
        className="flex-1 h-full flex items-center justify-center cursor-default min-w-0 px-2"
      >
        <span
          data-tauri-drag-region
          className="text-[11px] text-gray-400/80 font-medium truncate"
        >
          {roomId ? `VoiceChat — Комната #${roomId}` : 'VoiceChat — Голосовой чат'}
        </span>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center h-full flex-shrink-0">
        {/* Minimize Button */}
        <button
          type="button"
          onClick={handleMinimize}
          title="Свернуть"
          className="h-full w-11 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>

        {/* Maximize / Restore Button */}
        <button
          type="button"
          onClick={(e) => handleToggleMaximize(e)}
          title={isMaximized ? 'Восстановить' : 'Развернуть'}
          className="h-full w-11 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none"
        >
          {isMaximized ? (
            // Restore icon (two overlapping squares)
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M2.5 1.5H8.5V7.5" />
              <rect x="1.5" y="2.5" width="6" height="6" />
            </svg>
          ) : (
            // Maximize icon (single square)
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          )}
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          title="Закрыть"
          className="h-full w-12 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-600 active:bg-red-700 transition-colors focus:outline-none"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  );
};
