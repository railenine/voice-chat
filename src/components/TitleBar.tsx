import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import { isTauri, APP_VERSION } from "../config";
import { Tooltip } from "./Tooltip";
import { UpdateBadge } from "./updater/UpdateBadge";

interface TitleBarProps {
  roomId?: string;
  onCheckUpdates?: () => void;
  hasUpdate?: boolean;
  updateVersion?: string;
}

let cachedInvoke:
  | (<T>(command: string, args?: Record<string, any>) => Promise<T>)
  | null = null;
async function getTauriInvoke() {
  if (!cachedInvoke) {
    const mod = await import("@tauri-apps/api/core");
    cachedInvoke = mod.invoke;
  }
  return cachedInvoke;
}

export const TitleBar: React.FC<TitleBarProps> = memo(
  ({ roomId, onCheckUpdates, hasUpdate, updateVersion }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const leftRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLSpanElement>(null);
    const [showRoomTitle, setShowRoomTitle] = useState(() => {
      if (typeof window === "undefined") return true;
      return window.innerWidth > 540;
    });

    // Calculate whether the centered room title fits without colliding with left badges or right window controls
    const checkFits = useCallback(() => {
      if (!roomId) {
        setShowRoomTitle(false);
        return;
      }
      if (!titleRef.current) return;

      const leftRect = leftRef.current?.getBoundingClientRect();
      const leftRight = leftRect ? leftRect.right : 180;
      const windowWidth = window.innerWidth;
      const rightLeft = windowWidth - 136; // Window controls (minimize, maximize, close) width is ~132-136px
      const center = windowWidth / 2;

      // Symmetric max half-width from center with 16px safety margin on each side
      const maxHalfWidth = Math.min(
        center - leftRight - 16,
        rightLeft - center - 16,
      );
      const titleWidth = titleRef.current.scrollWidth;

      setShowRoomTitle(maxHalfWidth > 0 && titleWidth / 2 < maxHalfWidth);
    }, [roomId]);

    // Invoke helper with cached import and graceful fallback
    const invokeCommand = useCallback(
      async <T = any,>(
        command: string,
        args?: Record<string, any>,
      ): Promise<T | null> => {
        if (!isTauri()) return null;
        try {
          const invoke = await getTauriInvoke();
          return await invoke<T>(command, args);
        } catch (err) {
          console.warn(`[TitleBar] Failed to invoke '${command}':`, err);
          return null;
        }
      },
      [],
    );

    // Check initial maximized state & listen for resize events with rAF throttling
    useEffect(() => {
      if (!isTauri()) return;
      invokeCommand<boolean>("is_window_maximized").then((res) => {
        if (typeof res === "boolean") {
          setIsMaximized(res);
        }
      });

      let resizeRafId: number | null = null;
      const handleResize = () => {
        if (resizeRafId !== null) return;
        resizeRafId = requestAnimationFrame(() => {
          resizeRafId = null;
          invokeCommand<boolean>("is_window_maximized").then((res) => {
            if (typeof res === "boolean") {
              setIsMaximized(res);
            }
          });
          checkFits();
        });
      };

      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
        if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
      };
    }, [invokeCommand, checkFits]);

    // Dynamic layout observer: re-calculate fit when roomId, update status, or badge size changes
    useEffect(() => {
      checkFits();
      if (!leftRef.current) return;
      const observer = new ResizeObserver(() => {
        checkFits();
      });
      observer.observe(leftRef.current);
      return () => observer.disconnect();
    }, [checkFits, hasUpdate, updateVersion]);

    const handleMinimize = async (e: React.MouseEvent) => {
      e.stopPropagation();
      await invokeCommand("minimize_window");
    };

    const handleToggleMaximize = async (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const res = await invokeCommand<boolean>("toggle_maximize_window");
      if (typeof res === "boolean") {
        setIsMaximized(res);
      } else {
        setIsMaximized((prev) => !prev);
      }
    };

    const handleClose = async (e: React.MouseEvent) => {
      e.stopPropagation();
      await invokeCommand("close_window");
    };

    const handleMouseDown = async (e: React.MouseEvent) => {
      // Only primary left click
      if (e.button !== 0) return;
      // Don't drag if clicking on a button (minimize, maximize, close)
      if ((e.target as HTMLElement).closest("button")) return;
      // If double click, let onDoubleClick handle toggle maximize
      if (e.detail > 1) return;

      await invokeCommand("start_drag");
    };

    if (!isTauri()) {
      return null;
    }

    return (
      <div
        data-tauri-drag-region
        onMouseDown={handleMouseDown}
        onDoubleClick={() => handleToggleMaximize()}
        className="relative h-8.5 w-full bg-slate-950/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between select-none z-50 shrink-0 text-xs font-sans cursor-default"
      >
        {/* Left: App Logo, Name & Room Badge */}
        <div
          ref={leftRef}
          data-tauri-drag-region
          className="flex items-center gap-2 px-3 h-full cursor-default z-10"
        >
          <div
            className={`flex ${hasUpdate && updateVersion ? "items-center" : "items-baseline"} gap-1.5 leading-none`}
          >
            {hasUpdate && updateVersion ? (
              <UpdateBadge
                version={updateVersion}
                onClick={onCheckUpdates || (() => {})}
              />
            ) : onCheckUpdates ? (
              <Tooltip
                content="Проверить обновления"
                description="Нажмите, чтобы проверить наличие новой версии"
                position="bottom"
              >
                <button
                  type="button"
                  onClick={onCheckUpdates}
                  className="text-[10px] text-gray-500 hover:text-blue-400 font-mono leading-none transition-colors cursor-pointer"
                >
                  v{APP_VERSION}
                </button>
              </Tooltip>
            ) : null}
          </div>
        </div>

        {/* Middle: Mathematically centered room title (hidden completely without truncation if space is insufficient) */}
        {roomId && (
          <div
            data-tauri-drag-region
            className={`pointer-events-none absolute inset-0 flex items-center justify-center cursor-default z-0 transition-opacity duration-150 ${
              showRoomTitle ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!showRoomTitle}
          >
            <span
              ref={titleRef}
              data-tauri-drag-region
              className="text-[11px] text-gray-400/80 font-medium leading-none select-none whitespace-nowrap"
            >
              Комната #{roomId}
            </span>
          </div>
        )}

        {/* Right: Window Controls */}
        <div className="flex items-center h-full shrink-0 z-10">
          {/* Minimize Button */}
          <Tooltip content="Свернуть" position="bottom">
            <button
              type="button"
              onClick={handleMinimize}
              className="btn-compact h-full w-11 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none"
            >
              <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
                <rect width="10" height="1" />
              </svg>
            </button>
          </Tooltip>

          {/* Maximize / Restore Button */}
          <Tooltip
            content={isMaximized ? "Восстановить" : "Развернуть"}
            position="bottom"
          >
            <button
              type="button"
              onClick={(e) => handleToggleMaximize(e)}
              className="btn-compact h-full w-11 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none"
            >
              {isMaximized ? (
                // Restore icon (two overlapping squares)
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <path d="M2.5 1.5H8.5V7.5" />
                  <rect x="1.5" y="2.5" width="6" height="6" />
                </svg>
              ) : (
                // Maximize icon (single square)
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <rect x="0.5" y="0.5" width="9" height="9" />
                </svg>
              )}
            </button>
          </Tooltip>

          {/* Close Button */}
          <Tooltip content="Закрыть" position="bottom">
            <button
              type="button"
              onClick={handleClose}
              className="btn-compact h-full w-12 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-600 active:bg-red-700 transition-colors focus:outline-none"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <line x1="1" y1="1" x2="9" y2="9" />
                <line x1="9" y1="1" x2="1" y2="9" />
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>
    );
  },
);

TitleBar.displayName = "TitleBar";
