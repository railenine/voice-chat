#!/usr/bin/env bash
set -Eeuo pipefail

# Provisioning is a separate, explicit operation. Never move legacy directories
# or install/modify Coturn during an application release.
[[ "${RVXIS_RELEASE:-}" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid release ID' >&2; exit 1; }
candidate="/var/www/voice-chat-releases/$RVXIS_RELEASE"
frontend="${RVXIS_FRONTEND%/}"
backend=/var/www/voice-chat-backend
shared_env=/var/www/voice-chat-shared/.env
[[ "$frontend" == /var/www/* && "$frontend" != *..* && "$frontend" != "$backend" ]] || exit 1
[[ -L "$frontend" && -L "$backend" && -f "$shared_env" ]] || {
  echo 'Deployment requires frontend/backend symlinks and shared .env. Complete the documented one-time migration first.' >&2
  exit 1
}
[[ -f "$candidate/dist/index.html" && -f "$candidate/server/index.js" ]] || exit 1
old_frontend=$(readlink -f -- "$frontend")
old_backend=$(readlink -f -- "$backend")
cd "$candidate"
if [[ -e .env || -L .env ]]; then
  [[ -L .env && "$(readlink -f -- .env)" == "$shared_env" ]] || exit 1
else
  ln -s -- "$shared_env" .env
fi
npm ci --omit=dev

probe_pid=
cleanup_probe() {
  if [[ -n "$probe_pid" ]]; then kill "$probe_pid" 2>/dev/null || true; wait "$probe_pid" 2>/dev/null || true; probe_pid=; fi
}
trap cleanup_probe EXIT
NODE_ENV=production PORT=3101 node server/index.js > candidate.log 2>&1 &
probe_pid=$!
health() {
  local port=$1
  node --input-type=module -e '
    import fs from "node:fs";
    const expected = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
    const r = await fetch(`http://127.0.0.1:${process.argv[1]}/health`, {signal: AbortSignal.timeout(2000)});
    const data = await r.json();
    if (!r.ok || data.version !== expected || data.status !== "ok" || data.releaseId !== process.env.RVXIS_RELEASE) process.exit(1);
  ' "$port" > /dev/null 2>&1
}
ready=false
for attempt in {1..20}; do
  if ! kill -0 "$probe_pid" 2>/dev/null; then break; fi
  if health 3101; then ready=true; break; fi
  sleep 0.5
done
[[ "$ready" == true ]] || { echo 'Candidate health check failed' >&2; exit 1; }
cleanup_probe

atomic_link() {
  local target=$1 link=$2
  ln -s -- "$target" "$link.next.$$"
  mv -Tf -- "$link.next.$$" "$link"
}
restart_backend() {
  pm2 delete voicechat-server > /dev/null 2>&1 || true
  local release_id
  release_id=$(basename "$(readlink -f -- "$backend")")
  RVXIS_RELEASE="$release_id" NODE_ENV=production PORT=3000 pm2 start "$backend/server/index.js" --cwd "$backend" --name voicechat-server
}
rollback() {
  trap - ERR INT TERM
  atomic_link "$old_frontend" "$frontend"
  atomic_link "$old_backend" "$backend"
  restart_backend
  echo 'Activation failed; previous release restored' >&2
  exit 1
}
trap rollback ERR INT TERM
atomic_link "$candidate/dist" "$frontend"
atomic_link "$candidate" "$backend"
restart_backend
ready=false
for attempt in {1..20}; do
  if health 3000; then ready=true; break; fi
  sleep 0.5
done
[[ "$ready" == true ]]
pm2 save
trap - ERR INT TERM
echo 'Release activated and health checked'
