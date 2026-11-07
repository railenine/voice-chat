// Parse explicitly allowed fields only. Never execute .env as shell code.
function readSelectedEnv(content, fields) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match || !fields.includes(match[1])) continue;
    if (Object.hasOwn(values, match[1])) throw new Error('Duplicate credential variable; inspect the server configuration locally.');
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

export function readStaticTurnCredentials(content) {
  const values = readSelectedEnv(content, ['COTURN_USER', 'COTURN_PASSWORD']);
  if (!values.COTURN_USER || !values.COTURN_PASSWORD) {
    throw new Error('Existing static TURN credentials are missing. No server started.');
  }
  return values;
}

export function readLiveKitCredentials(content) {
  const values = readSelectedEnv(content, ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']);
  if (!values.LIVEKIT_URL || !values.LIVEKIT_API_KEY || !values.LIVEKIT_API_SECRET) {
    throw new Error('Existing LiveKit configuration is missing. No server started.');
  }
  try {
    const url = new URL(values.LIVEKIT_URL);
    if (!['https:', 'wss:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch { throw new Error('LiveKit requires an HTTPS/WSS endpoint without embedded credentials or query parameters.'); }
  return values;
}
