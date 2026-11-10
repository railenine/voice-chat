#!/usr/bin/env bash
# Preparation only: no live backend, PM2, system Node, nginx or staging changes.
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 && "$(uname -m)" == x86_64 ]] || { echo 'Root/x64 Linux required' >&2; exit 1; }
root=/opt/rvxis-migration-input
name=node-v22.22.0-linux-x64
[[ "$(realpath -e /opt)" == /opt ]] || exit 1
if [[ -e "$root" || -L "$root" ]]; then
  [[ -d "$root" && "$(realpath -e "$root")" == "$root" && "$(stat -c %u "$root")" == 0 ]] || exit 1
else
  mkdir -m 700 -- "$root"
fi
if [[ -e "$root/$name" || -L "$root/$name" ]]; then
  echo 'Runtime input already exists. Inspect it instead of overwriting.' >&2; exit 1
fi
download=$(mktemp -d "$root/download.XXXXXX")
cd "$download"
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
  https://nodejs.org/dist/v22.22.0/SHASUMS256.txt -o SHASUMS256.txt
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
  "https://nodejs.org/dist/v22.22.0/$name.tar.xz" -o "$name.tar.xz"
awk -v file="$name.tar.xz" '$2 == file {print; found=1} END {if (!found) exit 1}' SHASUMS256.txt > checksum.txt
sha256sum --check checksum.txt
tar -tJf "$name.tar.xz" | awk -v prefix="$name/" '
  index($0,prefix)!=1 || $0 ~ /(^|\/)\.\.(\/|$)/ {bad=1}
  END {exit bad}'
tar --no-same-owner -xJf "$name.tar.xz" -C "$download"
node="$download/$name/bin/node"
[[ -f "$node" && ! -L "$node" && "$(stat -c %u "$node")" == 0 ]] || exit 1
[[ "$("$node" --version)" == v22.22.0 ]] || exit 1
mv -T -- "$download/$name" "$root/$name"
echo "Prepared root-owned runtime input: $root/$name"
echo 'No production/staging process or active runtime changed.'
