# Development and release checks

Use Node.js 22.22 or newer (CI and Docker use the Node 22 line). Run `npm ci`.
`HOST` optionally restricts the backend listen address; use `HOST=127.0.0.1`
for a staging backend reached through an SSH tunnel. Unset keeps Node's default.
SIGINT/SIGTERM stop HTTP and WebSocket listeners, notify connected clients with
WebSocket code 1001, and force-close remaining connections after five seconds.
Foreground staging does not automatically restart; rerun its script after stopping.
Start the API with `npm start` in one terminal, and Vite with `npm run dev` in
another. The API listens on 3000; the browser UI is http://localhost:5173, with
same-origin API/WebSocket proxying. Tauri development opens Vite on 5173 and uses
the local API. Production Tauri builds use the production server unless the
explicit manual-testing flag is enabled.

Checks:

```
npm test
npm run typecheck
npm run build
npm run test:signaling
npm run test:browser
cargo test --manifest-path src-tauri/Cargo.toml --lib
node scripts/generate-latest-json.js --validate-only
```

The browser test uses real Chromium WebRTC and a generated fake microphone.
Install the pinned browser with `npx playwright-core install chromium` on every
test machine, or explicitly set RVXIS_BROWSER_EXECUTABLE to a full Chrome/Edge
binary. The default uses channel chromium (new headless), consistently across
Windows and Linux. Headless Shell exposes unstable fake output IDs across pages
and cannot validate the saved-device scenario. This checks local audio transport;
it does not certify NAT/TURN, mobile background audio or actual screen capture.
The old test:mesh name is retained as an alias for signaling compatibility.

## Production rollout preparation

Push to main deploys automatically; a v* tag builds/publishes a desktop release.
Keep fixes on a review branch until the paired client/backend change is ready.
Run the release command without --push to prepare versions, inspect its diff,
then publish only after the required checks and explicit deployment approval.

Before the first hardened deployment, prepare `/var/www/voice-chat-releases`
and `/var/www/voice-chat-shared/.env`. The existing frontend path (TARGET_DIR)
and `/var/www/voice-chat-backend` must be symlinks to a retained working release.
This one-time migration requires deliberate host maintenance and a backup;
the deployment script refuses to move legacy directories or copy secrets for you.
Do not change the nginx document-root path: keep the configured path as the
stable symlink. Ensure the deploy account owns those links and release directory,
and can run Node 22.22+, npm and PM2. Port 3101 is reserved for candidate probing.
The deploy script checks Node before installing/switching and passes the exact
interpreter path to PM2. Candidate probes bind only to loopback.

Application deployment uploads a new release, installs locked runtime packages,
probes its health, switches symlinks and restarts PM2. A failed activation restores
the previous links/service. Frontend and backend switches are separate filesystem
operations; this is not a transaction across both services. Long-lived calls
are interrupted by backend restart. Retain previous releases for rollback.

Provision Coturn separately using setup-coturn.sh, with exactly one of
COTURN_SHARED_SECRET (HMAC) or COTURN_PASSWORD (static). The application and
Coturn must use the same mechanism/domain. Test relay with real clients after
host changes. The script does not run on normal application deploys.

Desktop publication creates/updates a draft and publishes only after all assets
have uploaded. It refuses to replace an already published tag. The generator
requires actual installer and portable files with verified signatures; a previous
manifest cannot supply signatures for new binaries. Unsigned old portable clients
and anonymous credential API clients need a coordinated upgrade path.

## First staging check over SSH

`scripts/staging-local.sh` starts an extracted source plus built frontend archive
under `/opt/rvxis-staging/app-<commit>`, on loopback port 3102 in the foreground.
It verifies the checksum of a separate official Node 22.22.0 download, installs
locked runtime dependencies without lifecycle scripts, rejects a copied `.env`,
and starts with a cleared environment. It does not configure PM2/nginx/firewalls
or reuse production SFU/TURN credentials. Stop it with Ctrl+C.

From Windows, open `ssh -N -o ExitOnForwardFailure=yes -L
127.0.0.1:3000:127.0.0.1:3102 root@<host>` and visit `http://localhost:3000`.
This first pass checks browser voice, session behavior and file sharing using
STUN only. It does not validate relay or screen sharing. Shared browser profiles
also do not reproduce two independent devices/networks. A separately isolated
LiveKit setup and a desktop test build remain required before release.

### Forced TURN staging check

Use a separate archive with `scripts/staging-relay-probe.js` copied to dist and
`<script src="/staging-relay-probe.js"></script>` inserted immediately after the
opening head tag, before the application bundle. Run `staging-local.sh --turn`.
This mode reads only COTURN_USER/COTURN_PASSWORD into memory from the existing
backend .env; it does not copy that file or modify Coturn. It requires loopback
3102, LiveKit disabled and the relay probe in index.html, or refuses startup.
The ordinary launch without --turn stays STUN-only. Do not publish the test dist.

On both devices, reload the test page, join the same room and exchange speech.
`await rvxTurnReport()` in the browser console must show a connected peer, relay
policy, both selected candidates of type relay, nonzero incoming/outgoing audio
bytes and passed=true. Empty results do not constitute success. The report omits
addresses, ICE configuration and credentials. This first check certifies only
the selected transport: it does not separately certify UDP, TCP and TLS paths.

For separate transport checks, open `/?turn=tcp` or `/?turn=tls` on both devices
before joining. The probe filters ICE servers to that exact transport on both
construction and reconfiguration. `passed` additionally requires the selected
local candidate's `relayProtocol` to match the requested profile. `protocol` can
still be UDP because it describes the relay candidate, not client-to-TURN TLS/TCP.
`/?turn=udp` is also available; missing profile retains the all-transports check.
Unknown profiles fail closed with no ICE servers and cannot pass.

### LiveKit staging check

Use a normal frontend archive (no relay probe), extracted into
`/opt/rvxis-staging/app-<revision>-livekit`, and run `staging-local.sh --livekit`.
The wrapper requires loopback 3102, loads existing TURN/LiveKit settings into
memory from the backend .env, validates HTTPS/WSS endpoint settings and enables
LiveKit. No .env copy, key output, Docker changes or SFU restart is performed.
The wrapper derives `LIVEKIT_ROOM_PREFIX=rvxis-staging-<revision>-`. The backend
signs only the prefixed room grant, ignoring client room/prefix overrides.
An unset prefix retains the existing production room names. Invalid prefixes
fail token issuance. Public LiveKit status exposes the prefix, never the keys.

This is logical naming separation on a shared SFU, not a separate tenant or
security boundary: CPU/network and account authority remain shared, and an
independently authorized issuer could mint tokens for the same room names.
Use small test sessions and avoid production room IDs. Validate actual screen
video, screen audio, output devices, deafen, stream changes and stopping capture
on two devices before any production rollout. The LiveKit connect log now uses
the actual SDK room name to support verification without printing tokens.

### Standalone Windows staging build

Run `node scripts/build-staging-desktop.js --work-dir <scratch> --output-dir <outputs>`
on Windows with installed dependencies, Rust/SDK and cached locked Cargo packages.
It archives a clean committed source snapshot, links or copies existing node_modules and
sets the manual local-server flag only in that snapshot. The main checkout stays
production-configured. VITE_RVXIS_STAGING=1 selects localhost:3000, displays a
STAGING label and disables updater checks/installation and mock update modes.
The Cargo staging feature omits the updater plugin and refuses native portable
updates before network/file operations. The builder combines both flags, changes
the application identifier to com.railenine.voicechat.staging (separate webview
data), builds without an installer, runs native staging tests and verifies the
embedded frontend/app identifier/update guard before writing a versioned EXE and
checksum metadata. It does not sign, publish, tag or deploy. Keep the existing SSH
tunnel running on each Windows test PC and close other room clients during tests.
This build does not validate production-channel self-update; that is a separate
controlled test with signed artifacts and explicit publication boundaries.

### Isolated delivery/rollback check on the application VPS

Run `bash scripts/test-deploy-isolated.sh` from the dedicated delivery-check
archive on the application VPS. It uses the separately installed staging Node
22.22 runtime, not a global Node upgrade. Ports 3200/3201 must be free. A private
`/opt/rvxis-deploy-smoke/run-<random>` tree and PM2_HOME hold all fixture state;
inherited account secrets are not passed to fixture PM2. No production .env,
nginx, Coturn, LiveKit or global PM2 configuration is changed. The working port
3000 health/PID and frontend/backend paths are read before/after for comparison.

The harness replaces only a marked constants block in a temporary copy of
deploy-candidate.sh, retaining the same install/probe/symlink/restart/rollback
control flow. It refuses changed markers, escaping roots or residual production
paths/process names. Fixtures cover rollback to legacy health without releaseId,
successful activation, candidate probe failure and post-activation failure. An
isolated PM2 daemon is stopped in cleanup; fixture logs/result.json are retained
under the private test tree for inspection. A concurrent/stale .active lock
stops another run; inspect it instead of deleting unknown state blindly.

Success requires four passed cases, unchanged working PID/paths and released
test ports. This validates delivery control flow with synthetic health servers;
it does not itself test nginx, real application media sessions, the one-time
production directory migration or desktop self-update.

### Separate Windows staging installer

Add `--installer` to `scripts/build-staging-desktop.js` with the same explicit
work/output directories. It builds an NSIS current-user installer, disables
updater artifact creation and uses `rvxis-staging.exe`, product `RVxis Staging`
and identifier `com.railenine.voicechat.staging`. These separate the process,
default install directory, uninstall entry and WebView profile from production.
Keep the default staging installation path. The builder accepts only one freshly
generated staging setup file and writes its SHA-256 to separate installer metadata.
The normal checkout retains its production configuration. Installing, uninstalling
and production-channel self-update require separate manual verification.

Installed update mode recognizes NSIS `uninstall.exe` next to the executable,
legacy uninstallers and protected installation paths. Portable replacement is
also rejected natively for installed paths, regardless of the requested UI mode.
The dependency-free installation regression runs in CI; full Rust tests still
run in the native Windows workflow. A missing/removed uninstaller in a custom
directory cannot establish installation status; retain installer-managed files.
