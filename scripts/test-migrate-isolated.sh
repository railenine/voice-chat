#!/usr/bin/env bash
set -Eeuo pipefail
case "$(uname -m)" in
  x86_64) arch=x64 ;;
  *) echo 'This migration rehearsal targets the verified x64 backend host.' >&2; exit 1 ;;
esac
node="/opt/rvxis-staging/node-v22.22.0-linux-$arch/bin/node"
[[ -x "$node" ]] || { echo 'The verified private Node 22 runtime is required.' >&2; exit 1; }
exec "$node" "$(dirname -- "${BASH_SOURCE[0]}")/test-migrate-isolated.js"
