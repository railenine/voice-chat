/**
 * Pure WebRTC Opus SDP optimization utility.
 * Enforces 32kbps mono with in-band FEC and DTX (discontinuous transmission).
 */
export function optimizeAudioSdp(sdp: string): string {
  const match = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  if (!match) return sdp;
  const pt = match[1];

  const fmtpRegex = new RegExp(`(a=fmtp:${pt}\\s+)([^\\r\\n]+)`, 'i');
  const customParams =
    'maxaveragebitrate=32000;stereo=0;sprop-stereo=0;useinbandfec=1;cbr=0;usedtx=1';

  if (fmtpRegex.test(sdp)) {
    return sdp.replace(fmtpRegex, (_m, prefix, params) => {
      const clean = params
        .replace(/maxaveragebitrate=\d+;?/gi, '')
        .replace(/stereo=[01];?/gi, '')
        .replace(/sprop-stereo=[01];?/gi, '')
        .replace(/useinbandfec=[01];?/gi, '')
        .replace(/cbr=[01];?/gi, '')
        .replace(/usedtx=[01];?/gi, '')
        .replace(/;\s*$/, '')
        .trim();
      const sep = clean.length > 0 && !clean.endsWith(';') ? ';' : '';
      return `${prefix}${clean}${sep}${customParams}`;
    });
  } else {
    return sdp.replace(
      new RegExp(`(a=rtpmap:${pt}\\s+opus\\/48000[^\\r\\n]*)`, 'i'),
      `$1\r\na=fmtp:${pt} ${customParams}`
    );
  }
}
