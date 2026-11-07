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
Install a browser with `npx playwright-core install chromium` on machines without
Chrome/Edge, or set RVXIS_BROWSER_EXECUTABLE. This checks local audio transport;
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
