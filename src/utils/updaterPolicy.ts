export interface AutoOpenModalOptions {
  availableVersion: string;
  isManual: boolean;
  isInRoom: boolean;
  dismissedVersion?: string | null;
}

/**
 * Determines whether the update dialog should automatically pop up for the user.
 * - Suppressed during active calls (in-room protection).
 * - Suppressed if the user previously dismissed this exact version.
 * - Always opens if the user initiated the check manually.
 */
export function shouldAutoOpenUpdateModal(opts: AutoOpenModalOptions): boolean {
  if (opts.isManual) return true;
  if (opts.isInRoom) return false;
  if (opts.dismissedVersion && opts.dismissedVersion === opts.availableVersion) {
    return false;
  }
  return true;
}

/**
 * Verifies that downloaded bytes match expected total bytes.
 */
export function verifyDownloadIntegrity(
  downloaded: number,
  total: number
): { success: boolean; error?: string } {
  if (total > 0 && downloaded !== total) {
    return { success: false, error: `Incomplete download: ${downloaded} of ${total} bytes` };
  }
  return { success: true };
}

/**
 * Verifies SHA-256 hash case-insensitively against expected digest.
 * Compatible with both browser Web Crypto API and Node.js environments.
 */
export async function verifyChecksum(
  contentBuffer: Uint8Array | ArrayBuffer,
  expectedHash: string
): Promise<boolean> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const data = (contentBuffer instanceof Uint8Array
      ? contentBuffer
      : new Uint8Array(contentBuffer)) as unknown as BufferSource;
    const hashBuf = await subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex.toLowerCase() === expectedHash.toLowerCase();
  }
  return false;
}

/**
 * Determines updater status based on device network connectivity.
 */
export function checkNetworkState(isOnline: boolean): { status: 'offline' | 'checking'; error: null } {
  if (!isOnline) {
    return { status: 'offline', error: null };
  }
  return { status: 'checking', error: null };
}

/**
 * Appends timestamp cache-busting parameter to updater endpoint URL.
 */
export function buildUpdaterUrl(baseUrl: string, timestamp = Date.now()): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/peerjs/updater/latest.json?_t=${timestamp}`;
}

/**
 * Parses raw update notes into a clean array of short, user-friendly items.
 * Handles multiline bulleted notes, single lines, and legacy semicolon-separated strings.
 */
export function parseUpdateNotes(rawNotes?: string | null): string[] {
  if (!rawNotes || typeof rawNotes !== 'string') return [];
  const trimmed = rawNotes.trim();
  if (!trimmed) return [];

  // 1. If multiline (separated by \n)
  if (trimmed.includes('\n')) {
    return trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^RVxis\s+v[\d.]+\s*[-—]\s*/i, '').replace(/^[•\-\*]\s*/, '').trim())
      .filter(Boolean);
  }

  // 2. If legacy semicolon-separated list (e.g., "RVxis v0.1.15 — Item 1; Item 2; Item 3")
  if (trimmed.includes(';')) {
    const stripped = trimmed.replace(/^RVxis\s+v[\d.]+\s*[-—]\s*/i, '');
    return stripped
      .split(';')
      .map((item) => item.trim())
      .map((item) => item.replace(/^[•\-\*]\s*/, '').trim())
      .filter(Boolean);
  }

  // 3. Single sentence
  const single = trimmed.replace(/^RVxis\s+v[\d.]+\s*[-—]\s*/i, '').replace(/^[•\-\*]\s*/, '').trim();
  return single ? [single] : [];
}
