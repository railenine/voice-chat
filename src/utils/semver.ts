/**
 * Semantic Versioning (SemVer 2.0.0) parser and comparator for RVxis updater.
 *
 * Guarantees mathematical correctness:
 * - 0.1.9 < 0.1.10
 * - v0.1.10 === 0.1.10
 * - 0.1.10-beta.1 < 0.1.10
 * - Rejects non-semver / invalid strings cleanly (returns null / false)
 */

export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<string | number>;
  raw: string;
}

const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

export function parseSemver(versionStr: string | null | undefined): ParsedSemver | null {
  if (!versionStr || typeof versionStr !== 'string') {
    return null;
  }

  const trimmed = versionStr.trim();
  const match = trimmed.match(SEMVER_REGEX);
  if (!match) {
    return null;
  }

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null;
  }

  let prerelease: Array<string | number> = [];
  if (match[4]) {
    prerelease = match[4].split('.').map((segment) => {
      const num = parseInt(segment, 10);
      return Number.isNaN(num) || String(num) !== segment ? segment : num;
    });
  }

  return {
    major,
    minor,
    patch,
    prerelease,
    raw: trimmed,
  };
}

/**
 * Compares two parsed semver objects.
 * Returns:
 *   1 if a > b
 *  -1 if a < b
 *   0 if a === b
 */
export function compareSemver(a: ParsedSemver, b: ParsedSemver): number {
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;

  // Prerelease comparison rules per SemVer 2.0.0 Spec §11:
  // Normal version has higher precedence than prerelease
  // 1.0.0 > 1.0.0-alpha
  if (a.prerelease.length === 0 && b.prerelease.length > 0) return 1;
  if (a.prerelease.length > 0 && b.prerelease.length === 0) return -1;
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;

  // Compare each prerelease identifier
  const maxLen = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < maxLen; i++) {
    const segA = a.prerelease[i];
    const segB = b.prerelease[i];

    if (segA === undefined) return -1;
    if (segB === undefined) return 1;

    if (typeof segA === 'number' && typeof segB === 'number') {
      if (segA !== segB) return segA > segB ? 1 : -1;
    } else if (typeof segA === 'string' && typeof segB === 'string') {
      const cmp = segA.localeCompare(segB);
      if (cmp !== 0) return cmp > 0 ? 1 : -1;
    } else {
      // Numeric identifiers have lower precedence than alphanumeric
      return typeof segA === 'number' ? -1 : 1;
    }
  }

  return 0;
}

/**
 * Returns true strictly if remoteVersion is strictly newer than currentVersion.
 * Rejects invalid/malformed versions safely without throwing.
 */
export function isNewerVersion(remoteVersion: string | null | undefined, currentVersion: string | null | undefined): boolean {
  const remote = parseSemver(remoteVersion);
  const current = parseSemver(currentVersion);

  if (!remote || !current) {
    return false;
  }

  return compareSemver(remote, current) > 0;
}
