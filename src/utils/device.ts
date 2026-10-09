import { useState, useEffect } from 'react';
import { isTauri } from '../config';
import {
  detectIsMobileOrTablet,
  detectIsDesktopPlatform,
  detectCanShareScreen,
  detectIsSmartphone,
  normalizeSinkId,
  buildAudioInputConstraints,
  reconcileSelectedDevice,
  type DeviceEnv,
} from './devicePolicy';

export {
  detectIsMobileOrTablet,
  detectIsDesktopPlatform,
  detectCanShareScreen,
  detectIsSmartphone,
  normalizeSinkId,
  buildAudioInputConstraints,
  reconcileSelectedDevice,
  type DeviceEnv,
};

function getBrowserEnv(): DeviceEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {};
  }

  const navAny = navigator as any;
  const isCoarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;

  return {
    userAgent: navigator.userAgent || navigator.vendor || (window as any).opera || '',
    isTauriApp: isTauri(),
    userAgentData: navAny.userAgentData,
    platform: navAny.userAgentData?.platform || navigator.platform || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hasTouch,
    isCoarse,
    innerWidth: typeof window.innerWidth === 'number' ? window.innerWidth : undefined,
    screenWidth: typeof window.screen !== 'undefined' ? window.screen.width : undefined,
    hasGetDisplayMedia: Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function'),
  };
}

/**
 * Checks if the current environment is a smartphone or tablet (iOS, Android, etc.).
 */
export function isMobileOrTablet(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  if (isTauri()) {
    return false;
  }
  return detectIsMobileOrTablet(getBrowserEnv());
}

/**
 * Checks if the current environment is a desktop OS (Windows PC, macOS desktop, Linux desktop, ChromeOS).
 */
export function isDesktopPlatform(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return true;
  }
  if (isTauri()) {
    return true;
  }
  return detectIsDesktopPlatform(getBrowserEnv());
}

/**
 * Determines whether this device is permitted to broadcast/share screen.
 */
export function canDeviceShareScreen(): boolean {
  return detectCanShareScreen(getBrowserEnv());
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
 */
export function isSmartphone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  if (isTauri()) {
    return false;
  }
  return detectIsSmartphone(getBrowserEnv());
}

/**
 * Reactive hook to detect if the current device is a smartphone.
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
