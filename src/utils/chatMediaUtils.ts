import { getBackendBaseUrl } from '../config';

// Safe regular expression pattern for detecting URLs in chat text
export const URL_REGEX = /(https?:\/\/[^\s<>()"']+[^\s<>()"'.!,;:?])/i;

/**
 * Checks if a string is a standalone valid HTTP/HTTPS URL
 */
export function isUrl(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!/^https?:\/\/[^\s<>()"']+[^\s<>()"'.!,;:?]$/i.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Safely splits chat text into parts preserving URLs without stateful RegExp leakage
 */
export function splitTextByUrls(text: string): string[] {
  if (!text) return [];
  const globalRegex = /(https?:\/\/[^\s<>()"']+[^\s<>()"'.!,;:?])/gi;
  return text.split(globalRegex);
}

/**
 * Checks if a given URL or filename corresponds to a static image
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  // SVG explicitly excluded for security
  return (
    /\.(png|jpe?g|webp|bmp|avif)$/i.test(clean) ||
    /^(https?:\/\/(i\.imgur\.com|images\.unsplash\.com|media\.discordapp\.net))/i.test(url)
  );
}

/**
 * Checks if a given URL or filename corresponds to an animated GIF
 */
export function isGifUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  return (
    clean.endsWith('.gif') ||
    /^(https?:\/\/(media\.tenor\.com|media[0-9]*\.giphy\.com|c\.tenor\.com))/i.test(url)
  );
}

/**
 * Checks if a given URL or filename corresponds to a video file
 */
export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(clean);
}

/**
 * Detects the media type from URL
 */
export function getMediaType(url: string): 'image' | 'gif' | 'video' | null {
  if (isGifUrl(url)) return 'gif';
  if (isImageUrl(url)) return 'image';
  if (isVideoUrl(url)) return 'video';
  return null;
}

/**
 * Resolves media URLs (turning relative `/api/media/...` into full server URLs in Tauri or remote clients)
 */
export function resolveMediaUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('/api/media/') || url.startsWith('/api/upload')) {
    return `${getBackendBaseUrl()}${url}`;
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return '';
}

/**
 * Formats bytes to human-readable size
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Safely opens external URLs strictly with http/https protocols in user's default browser
 */
export function openExternalUrl(url: string): void {
  if (!url) return;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    console.warn('[Security] Refused to open unsafe URL scheme:', url);
    return;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.warn('[Security] Refused non-http(s) protocol:', parsed.protocol);
      return;
    }
    window.open(parsed.href, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.error('[Chat] Failed to open external URL:', err);
  }
}

/**
 * Extracts any direct media preview links embedded in raw chat text
 */
export function extractMediaUrlsFromText(text: string): { url: string; type: 'image' | 'gif' | 'video' }[] {
  if (!text) return [];
  const matches = text.match(/(https?:\/\/[^\s<>()"']+[^\s<>()"'.!,;:?])/gi);
  if (!matches) return [];

  const results: { url: string; type: 'image' | 'gif' | 'video' }[] = [];
  const seen = new Set<string>();

  for (const raw of matches) {
    const clean = raw.trim();
    if (seen.has(clean)) continue;
    seen.add(clean);

    try {
      const parsed = new URL(clean);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      // Do not preview SVG
      if (parsed.pathname.toLowerCase().endsWith('.svg')) continue;

      const type = getMediaType(clean);
      if (type) {
        results.push({ url: clean, type });
      }
    } catch {
      // Invalid URL syntax
    }
  }

  return results.slice(0, 4); // Max 4 previews per text message
}

export const TRUSTED_DOMAINS_STORAGE_KEY = 'rvxis_trusted_external_domains';

/**
 * Returns list of domains user chose not to be warned about
 */
export function getTrustedDomains(): string[] {
  try {
    const raw = localStorage.getItem(TRUSTED_DOMAINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Adds a hostname to user's trusted domains list
 */
export function addTrustedDomain(domain: string): void {
  try {
    const clean = domain.trim().toLowerCase();
    if (!clean) return;
    const current = new Set(getTrustedDomains());
    current.add(clean);
    localStorage.setItem(TRUSTED_DOMAINS_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch (err) {
    console.warn('Failed to save trusted domain:', err);
  }
}

/**
 * Checks if a URL's hostname is trusted (or internal/localhost)
 */
export function isDomainTrusted(urlOrDomain: string): boolean {
  if (!urlOrDomain) return false;
  let hostname = urlOrDomain.trim().toLowerCase();
  try {
    if (hostname.startsWith('http://') || hostname.startsWith('https://')) {
      hostname = new URL(hostname).hostname.toLowerCase();
    }
  } catch {
    // Keep as is
  }

  // Built-in trusted domains (our site, localhost, local IP in dev)
  const builtin = ['rvxis.site', 'localhost', '127.0.0.1'];
  if (typeof window !== 'undefined' && window.location.hostname) {
    builtin.push(window.location.hostname.toLowerCase());
  }

  if (builtin.includes(hostname)) return true;

  const trustedList = getTrustedDomains();
  return trustedList.includes(hostname);
}

export interface UrlSecurityAnalysis {
  url: string;
  hostname: string;
  protocol: string;
  isPunycode: boolean;
  hasMixedScripts: boolean;
  isDirectIp: boolean;
  riskLevel: 'safe' | 'warning' | 'danger';
  warningMessage?: string;
}

/**
 * Inspects a URL for potential phishing indicators, punycode/IDN, mixed scripts, or direct IPs
 */
export function analyzeUrlSecurity(url: string): UrlSecurityAnalysis {
  let hostname = '';
  let protocol = 'https:';

  try {
    const parsed = new URL(url.trim());
    hostname = parsed.hostname.toLowerCase();
    protocol = parsed.protocol;
  } catch {
    hostname = url.trim().toLowerCase();
  }

  const isPunycode = hostname.includes('xn--');
  const hasLatin = /[a-z]/i.test(hostname);
  const hasCyrillic = /[а-яё]/i.test(hostname);
  const hasMixedScripts = hasLatin && hasCyrillic;
  const isDirectIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.startsWith('[') || hostname.includes(':');

  let riskLevel: 'safe' | 'warning' | 'danger' = 'safe';
  let warningMessage: string | undefined;

  if (hasMixedScripts) {
    riskLevel = 'danger';
    warningMessage = 'Обнаружена смесь латинских и кириллических букв. Домен может маскироваться под другой известный ресурс (омоглифическая атака).';
  } else if (isPunycode) {
    riskLevel = 'warning';
    warningMessage = 'Домен содержит интернациональные символы Punycode (IDN). Убедитесь, что это ожидаемый адрес.';
  } else if (isDirectIp) {
    riskLevel = 'warning';
    warningMessage = 'Ссылка ведёт напрямую на IP-адрес, а не на именованный веб-сайт.';
  } else if (protocol === 'http:') {
    riskLevel = 'warning';
    warningMessage = 'Сайт использует незащищённый протокол HTTP (трафик передаётся без шифрования).';
  }

  return {
    url,
    hostname,
    protocol,
    isPunycode,
    hasMixedScripts,
    isDirectIp,
    riskLevel,
    warningMessage,
  };
}
