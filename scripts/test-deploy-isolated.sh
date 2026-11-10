#!/usr/bin/env bash
set -Eeuo pipefail
case "$(uname -m)" in
  x86_64) arch=x64 ;;
  aarch64) arch=arm64 ;;
  *) echo 'Unsupported architecture' >&2; exit 1 ;;
esac
runtime="/opt/rvxis-staging/node-v22.22.0-linux-$arch/bin/node"
[[ -x "$runtime" ]] || { echo 'The separate staging Node 22 runtime is required.' >&2; exit 1; }
exec "$runtime" "$(dirname -- "${BASH_SOURCE[0]}")/test-deploy-isolated.js"
