import { useState, useEffect } from 'react';
import { isTauri } from '../config';

/**
 * Checks if the current environment is a smartphone/mobile phone.
 * Supports real mobile devices as well as browser DevTools mobile emulation.
 */
export function isSmartphone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // Tauri is always the desktop application
  if (isTauri()) {
    return false;
  }

  const ua = navigator.userAgent || '';

  // 1. Explicit smartphone / mobile phone user agents
  const isMobileUA = /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone/i.test(ua);
  if (isMobileUA) {
    return true;
  }

  // 2. Navigator User Agent Data (modern standard client hints)
  const navAny = navigator as any;
  if (navAny.userAgentData && typeof navAny.userAgentData.mobile === 'boolean') {
    if (navAny.userAgentData.mobile) {
      return true;
    }
  }

  // 3. Fallback for touch devices with phone viewport size & coarse pointer (DevTools or undetected phones)
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  const isCoarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const isSmallScreen = window.innerWidth <= 768 || (typeof window.screen !== 'undefined' && window.screen.width <= 768);

  if (hasTouch && isCoarse && isSmallScreen) {
    return true;
  }

  return false;
}

/**
 * Reactive hook to detect if the current device is a smartphone.
 * Updates dynamically on resize, orientation change, or DevTools toggle.
 */
export function useIsSmartphone(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => isSmartphone());

  useEffect(() => {
    const handleUpdate = () => {
      setIsMobile(isSmartphone());
    };

    handleUpdate();

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('orientationchange', handleUpdate);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
    };
  }, []);

  return isMobile;
}
