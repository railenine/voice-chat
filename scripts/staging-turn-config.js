// Parse only the existing static TURN account. Never execute .env as shell code.
export function readStaticTurnCredentials(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.trim().match(/^(COTURN_USER|COTURN_PASSWORD)\s*=(.*)$/);
    if (!match) continue;
    if (Object.hasOwn(values, match[1])) throw new Error('Duplicate TURN variable; inspect the server configuration locally.');
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  if (!values.COTURN_USER || !values.COTURN_PASSWORD) {
    throw new Error('Existing static TURN credentials are missing. No server started.');
  }
  return values;
}
