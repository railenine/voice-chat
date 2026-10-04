/**
 * Pure device & platform detection policies.
 * Accepts environment parameters so all branches can be verified deterministically in tests.
 */

export interface DeviceEnv {
  userAgent?: string;
  isTauriApp?: boolean;
  userAgentData?: { mobile?: boolean; platform?: string } | null;
  platform?: string;
  maxTouchPoints?: number;
  hasTouch?: boolean;
  isCoarse?: boolean;
  innerWidth?: number;
  screenWidth?: number;
  hasGetDisplayMedia?: boolean;
}

/**
 * Checks if the environment is a mobile phone or tablet (iOS, Android, etc.).
 */
export function detectIsMobileOrTablet(env: DeviceEnv = {}): boolean {
  if (env.isTauriApp) return false;

  if (env.userAgentData && typeof env.userAgentData.mobile === 'boolean' && env.userAgentData.mobile) {
    return true;
  }

  const ua = env.userAgent || '';
  if (/Android/i.test(ua)) return true;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;

  const isIPadOS =
    (env.platform === 'MacIntel' || ua.includes('Macintosh')) &&
    typeof env.maxTouchPoints === 'number' &&
    env.maxTouchPoints > 1;
  if (isIPadOS) return true;

  if (/webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone|Mobile|Tablet/i.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Checks if the environment is a desktop platform (Windows PC, macOS desktop, Linux desktop, ChromeOS).
 */
export function detectIsDesktopPlatform(env: DeviceEnv = {}): boolean {
  if (env.isTauriApp) return true;
  if (detectIsMobileOrTablet(env)) return false;

  const ua = env.userAgent || '';
  const platform = env.userAgentData?.platform || env.platform || '';

  if (/Win/i.test(platform) || /Windows NT/i.test(ua)) return true;
  if ((/Mac/i.test(platform) || /Macintosh/i.test(ua)) && (env.maxTouchPoints || 0) <= 1) return true;
  if ((/Linux/i.test(platform) || /Linux|X11/i.test(ua)) && !/Android/i.test(ua)) return true;
  if (/CrOS/i.test(ua)) return true;

  return true;
}

/**
 * Determines whether this device is permitted to broadcast/share screen.
 * Strictly limited to desktop OS and environments with getDisplayMedia.
 */
export function detectCanShareScreen(env: DeviceEnv = {}): boolean {
  return detectIsDesktopPlatform(env) && env.hasGetDisplayMedia !== false;
}

/**
 * Checks if the environment is a smartphone/mobile phone.
 * Supports real mobile devices as well as browser DevTools mobile emulation.
 */
export function detectIsSmartphone(env: DeviceEnv = {}): boolean {
  if (env.isTauriApp) return false;

  const ua = env.userAgent || '';
  const isMobileUA = /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone/i.test(ua);
  if (isMobileUA) return true;

  if (env.userAgentData && typeof env.userAgentData.mobile === 'boolean' && env.userAgentData.mobile) {
    return true;
  }

  const isSmallScreen =
    (typeof env.innerWidth === 'number' && env.innerWidth <= 768) ||
    (typeof env.screenWidth === 'number' && env.screenWidth <= 768);

  if (env.hasTouch && env.isCoarse && isSmallScreen) {
    return true;
  }

  return false;
}
