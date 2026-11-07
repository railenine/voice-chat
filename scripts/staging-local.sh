#!/usr/bin/env bash
# Foreground staging only. No PM2, nginx, firewall, production files or SFU keys.
set -Eeuo pipefail
umask 077
app=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
root=/opt/rvxis-staging
[[ "$app" == "$root"/app-* && -f "$app/dist/index.html" ]] || {
  echo 'Extract the staging archive to /opt/rvxis-staging/app-<commit> first.' >&2; exit 1;
}
[[ ! -e "$app/.env" && ! -L "$app/.env" ]] || { echo 'Staging must not contain a copied .env.' >&2; exit 1; }
command -v curl >/dev/null
command -v sha256sum >/dev/null
command -v ss >/dev/null
if [[ -n "$(ss -H -ltn 'sport = :3102')" ]]; then
  echo 'Port 3102 is occupied. Nothing started.' >&2; exit 1;
fi
case "$(uname -m)" in
  x86_64) arch=x64 ;;
  aarch64) arch=arm64 ;;
  *) echo 'Unsupported architecture' >&2; exit 1 ;;
esac
version=22.22.0
name="node-v$version-linux-$arch"
runtime="$root/$name"
if [[ ! -x "$runtime/bin/node" ]]; then
  download=$(mktemp -d "$root/download.XXXXXX")
  (
    cd "$download"
    curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
      "https://nodejs.org/dist/v$version/SHASUMS256.txt" -o SHASUMS256.txt
    curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
      "https://nodejs.org/dist/v$version/$name.tar.xz" -o "$name.tar.xz"
    awk -v file="$name.tar.xz" '$2 == file { print; found=1 } END { if (!found) exit 1 }' SHASUMS256.txt > checksum.txt
    sha256sum --check checksum.txt
    tar -xJf "$name.tar.xz" -C "$root"
  )
fi
[[ "$("$runtime/bin/node" --version)" == "v$version" ]] || exit 1
cd "$app"
env -i PATH="$runtime/bin:/usr/bin:/bin" \
  NPM_CONFIG_CACHE="$root/npm-cache" NPM_CONFIG_USERCONFIG=/dev/null \
  NPM_CONFIG_GLOBALCONFIG="$root/npm-global.conf" "$runtime/bin/npm" ci --omit=dev --ignore-scripts
echo 'Staging: 127.0.0.1:3102. Keep this terminal open; Ctrl+C stops it.'
echo 'No LiveKit/TURN credentials: screen sharing and relay are outside this first check.'
exec env -i PATH="$runtime/bin:/usr/bin:/bin" NODE_ENV=production \
  HOST=127.0.0.1 PORT=3102 DISABLE_LIVEKIT=1 \
  CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000 \
  RVXIS_RELEASE="$(basename "$app")" "$runtime/bin/node" server/index.js
