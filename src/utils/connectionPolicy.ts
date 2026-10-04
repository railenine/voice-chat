/**
 * Pure connection state, reconnection backoff, and banner resolution policies.
 */

export interface ConnectionBannerInput {
  isConnected: boolean;
  error: string | null;
  reconnectAttempts: number;
  showConnectedToast: boolean;
}

export interface ConnectionBannerResolution {
  showBanner: boolean;
  bannerType: 'error' | 'connected-success' | 'reconnecting' | null;
  isFailedThreshold: boolean;
  isRoomFull: boolean;
}

/**
 * Calculates linear backoff delay with 5000ms cap.
 */
export function calculateReconnectDelay(attempts: number): number {
  return Math.min(2000 + (Math.max(1, attempts) - 1) * 750, 5000);
}

/**
 * Resolves whether the connection status banner should be displayed and its visual variant.
 */
export function resolveConnectionBannerState(input: ConnectionBannerInput): ConnectionBannerResolution {
  const showBanner = !input.isConnected || Boolean(input.error) || input.showConnectedToast;
  let bannerType: ConnectionBannerResolution['bannerType'] = null;

  if (showBanner) {
    if (input.error) {
      bannerType = 'error';
    } else if (input.showConnectedToast && input.isConnected) {
      bannerType = 'connected-success';
    } else {
      bannerType = 'reconnecting';
    }
  }

  const isFailedThreshold = input.reconnectAttempts >= 5;
  const isRoomFull = Boolean(
    input.error &&
      (input.error.toLowerCase().includes('заполнена') ||
        input.error.toLowerCase().includes('room_full'))
  );

  return {
    showBanner,
    bannerType,
    isFailedThreshold,
    isRoomFull,
  };
}
