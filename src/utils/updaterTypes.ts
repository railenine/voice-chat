/**
 * Unified updater types and manifest definitions for RVxis.
 */

export interface PlatformAsset {
  signature?: string;
  url: string;
  size?: number;
  sha256?: string;
}

export interface UpdaterManifest {
  version: string;
  notes?: string;
  pub_date: string;
  platforms?: Record<string, PlatformAsset>;
  portable?: Record<string, PlatformAsset>;
  portable_url?: string;
}

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes?: string;
  date?: string;
  portableUrl?: string;
  portableSha256?: string;
  portableSize?: number;
  installerUrl?: string;
  installerSha256?: string;
  installerSize?: number;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'restart-required'
  | 'cancelled'
  | 'error'
  | 'offline';

export interface UpdateProgressPayload {
  downloaded: number;
  total: number;
  percent: number;
}
