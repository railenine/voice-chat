import { useState, useEffect } from 'react';
import { isTauri } from '../config';

/**
 * Checks if the current environment is a smartphone or tablet (iOS, Android, etc.).
 * Strictly checks device platform/OS and touch characteristics, NOT screen resolution.
 */
export function isMobileOrTablet(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // Tauri is always the desktop application
  if (isTauri()) {
    return false;
  }

  // Modern Client Hints API
  const navAny = navigator as any;
  if (navAny.userAgentData && typeof navAny.userAgentData.mobile === 'boolean') {
    if (navAny.userAgentData.mobile) {
      return true;
    }
  }

  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';

  // 1. Android devices (both phones and tablets)
  if (/Android/i.test(ua)) {
    return true;
  }

  // 2. iOS devices (iPhone, iPad, iPod)
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return true;
  }

  // 3. iPad on iPadOS 13+ (reports as Macintosh in UA, but has multi-touch screen)
  const isIPadOS =
    (navigator.platform === 'MacIntel' || ua.includes('Macintosh')) &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;
  if (isIPadOS) {
    return true;
  }

  // 4. Other mobile/tablet platforms
  if (/webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone|Mobile|Tablet/i.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Checks if the current environment is a desktop OS (Windows PC, macOS desktop, Linux desktop, ChromeOS).
 * Not based on viewport resolution, but on strict platform/device capabilities.
 */
export function isDesktopPlatform(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return true;
  }

  // Tauri desktop app is always desktop
  if (isTauri()) {
    return true;
  }

  // If identified as mobile or tablet, it is never a desktop
  if (isMobileOrTablet()) {
    return false;
  }

  const ua = navigator.userAgent || '';
  const navAny = navigator as any;
  const platform = navAny.userAgentData?.platform || navigator.platform || '';

  // Windows desktop (including touchscreen laptops like Surface)
  if (/Win/i.test(platform) || /Windows NT/i.test(ua)) {
    return true;
  }

  // macOS desktop (non-touch)
  if ((/Mac/i.test(platform) || /Macintosh/i.test(ua)) && (navigator.maxTouchPoints || 0) <= 1) {
    return true;
  }

  // Linux desktop (excluding Android)
  if ((/Linux/i.test(platform) || /Linux|X11/i.test(ua)) && !/Android/i.test(ua)) {
    return true;
  }

  // ChromeOS
  if (/CrOS/i.test(ua)) {
    return true;
  }

  // Fallback: if not mobile or tablet, treat as desktop
  return true;
}

/**
 * Determines whether this device is permitted to broadcast/share screen.
 * Strictly limited to desktop OS (PC/Mac/Linux) and environments with getDisplayMedia.
 * Mobile phones and tablets are strictly forbidden.
 */
export function canDeviceShareScreen(): boolean {
  if (!isDesktopPlatform()) {
    return false;
  }

  // Check if browser has display media capture API
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getDisplayMedia !== 'function'
  ) {
    return false;
  }

  return true;
}

/**
 * Reactive hook to determine if the current device can share its screen.
 */
export function useCanShareScreen(): boolean {
  const [canShare, setCanShare] = useState<boolean>(() => canDeviceShareScreen());

  useEffect(() => {
    setCanShare(canDeviceShareScreen());
  }, []);

  return canShare;
}

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
