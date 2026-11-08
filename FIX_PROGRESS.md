# Audit fixes — local implementation, 2026-11-07

Repository: D:/voice-chat (D:/voice-chat-main is a junction).
Branch: fix/sequential-audit-fixes. Baseline: 9f7e8be, version 0.2.2.
The user explicitly approved implementation. These changes are local, unpublished
and not deployed. The app version has deliberately not been bumped for release.

| Order | Change | Commit |
| --- | --- | --- |
| 1 | Guest session ownership, reconnect secret, protected media APIs, exact Origin policy | ed2925e |
| 2 | Publisher signature verification for portable, verified release assets | 111cb52 |
| 3 | Cancellation of stale microphone initialization/switch/meter requests | 833c2f4 |
| 4 | Single-owner stream audio attach/detach | 779be29 |
| 5 | Preserve manual mute; deafen voice, screen, media viewer and ordinary notifications | 3134518 |
| 6 | Compatible dependency updates; unused uuid removed | de0b003 |
| 7 | Upload concurrency/storage budgets, socket/room/backpressure limits | 417aa98 |
| 8 | Preserve same-name participants | e88ff30 |
| 9 | Stable LiveKit room across nickname updates; expose errors | b312f19 |
| 10 | Room vs per-peer media status; truthful updater errors | a8a8c84 |
| 11 | Serial bounded SDP handling, exact Opus parameters, no rebuild resurrection | 8c99708 |
| Review | Late callbacks/answers from disposed connections ignored | 82e67bc |
| 12 | Dev proxy/runtime, staged delivery, separate Coturn provisioning, browser gate | 851f672 |
| Cleanup | Seven copied frontend-policy tests removed in favor of production tests | 9a1f824 |

Verification completed:
- 86 Node tests pass; seven copied-policy tests were removed, not treated as production coverage.
- TypeScript, web build, three legacy manifest schema checks and git diff --check pass.
- 72 WebSocket signaling checks pass; this remains a signaling suite.
- Chrome 156.0.8078.81: two real WebRTC peers with identical names, bidirectional
  inbound RTP bytes and nonzero audio energy, manual mute/deafen, WS disconnect
  and audio recovery pass with a generated fake microphone and local server.
- Two Rust security tests pass, including authentic signature/tampering/wrong key
  and update serialization.
- Tauri CLI --no-bundle builds the Windows application. Confirmed that the
  executable contains the current VoiceChatScreen frontend asset. A plain cargo
  build alone is insufficient evidence of a bundled release UI.
- npm audit reports zero vulnerabilities at this check.
- GitHub workflows pass actionlint; both Bash scripts parse with shfmt in Bash mode.
  Native Git Bash was blocked by the Windows sandbox; Linux CI includes bash -n.
- Release preflight runs in an isolated fixture: unsafe push rejected before
  version mutation, version/Cargo.lock synchronized, stale asset metadata cleared.

Run checks as documented in DEVELOPMENT.md. Node 22.22+ is required. In the Codex
sandbox a workspace-local Node 22.22.0 was used because the system NVM shim had
no active version. No global Node configuration was changed.

Before publishing:
- Coordinate a new desktop/web/backend version. Protected HTTP/reconnect and
  portable-signature contracts differ from old published clients.
- Prepare the explicit VPS symlink/shared-env migration in DEVELOPMENT.md.
  The deployment script refuses to silently move legacy production directories.
- Review retained release directories, permissions, reserved port 3101 and nginx.
- Real VPS/PM2/nginx/Coturn execution, cross-network NAT/TURN, physical microphones,
  mobile background behavior and actual screen capture/system audio remain
  platform/rollout checks. Installer execution and in-place self-update were not
  run on the user's installed app.
- Download media URLs remain bearer links; this is stated in SECURITY_MODEL.md.
  Already issued LiveKit tokens/sessions are not instantly revoked by WS leave.
- Lower-priority UI/accessibility and cleanup observations from the broader audit
  are not certified by this core-fix series; no new global quality score is claimed.

Publication, pushes, tags and live deployment require their separately agreed stage.


## Staging finding: deafen confirmation cues (2026-11-07)

Manual testing found that muting the shared SFX output also suppressed the
deafen confirmation and could suppress undeafen before React effects ran.
Ordinary SFX now use a muted gain route; only explicit deafen/undeafen cues
use the selected SFX output directly. Participant/stream/media routes stay muted.
Regression test failed before the change and passed after; all 88 tests,
typecheck, web build, manifests and browser voice smoke passed. Actual sound
on the staging user's output device still needs a repeat check.


## Staging finding: shutdown with active WebSockets (2026-11-07)

Manual Ctrl+C left the server waiting for open browser sockets. A regression
test reproduced the hang. SIGINT/SIGTERM now close both transports, send
WebSocket close code 1001 and force remaining connections closed after 5s.
Repeated signals are idempotent. Tests exercise production handlers via child
process signal events with real sockets (Windows kill does not deliver Unix
signal handlers); actual Linux Ctrl+C still needs a staging repeat check.
The reported external-link button issue did not reproduce: added tests verify
the actual confirmation click synchronously calls window.open before onClose,
and unsafe schemes are rejected. Navigation code unchanged; OS browser launch
from an installed Tauri build remains unverified. All 92 tests, typecheck,
web build and manifest checks pass.


## Staging finding: browser output selection (2026-11-07)

User confirmed voice between two Windows PCs on different networks (one mobile),
then reported Chrome voice and chat video following Windows output. Desktop EXE
not involved. Chat video lacked sink routing; communications was incorrectly
normalized to the general default. Both reproduced in regression tests and fixed.
Playback sink requests are serialized; browser rejections are visible in settings;
rejected selections are not saved and stale selection results are ignored.
Video receives the device from App through ChatPanel; deafen remains enforced.
All 97 tests, typecheck/build/manifests pass. Real Chromium settings interaction
selects a nondefault enumerated fake output and verifies active media elements'
sinkId, persistence and routing after reconnect. Physical output on the user's
hardware, Edge and installed Tauri remain unverified; do not claim every cause
of the reported voice issue is reproduced or resolved.
API reference: https://www.w3.org/TR/audio-output/ (consulted 2026-11-07).


## Staging finding: voice needs a device toggle after joining (2026-11-07)

User clarified that voice initially stays silent; changing output away and back
starts it. DOM diagnostics already showed the selected sink on the main voice
element, so sinkId alone was insufficient evidence of successful first playback.
A regression test reproduced play() before asynchronous sink initialization.
Native autoplay could also bypass readiness. Voice and muted primer now disable
autoplay; bind the stream, await selected output initialization, then play.
Voice awaits supported AudioContext sink changes/resume as well. Context sink
changes use the same serialized helper; primer follows the selected output.
Request identity/stream checks prevent late playback after leave/replacement.
Unlock and device changes use the same startup path; active play errors are no
longer silently discarded as AbortError.
Two new tests failed before and pass after. All 99 tests, typecheck/build and
manifest checks pass. Chromium smoke pre-saves a nondefault output before room
join, delays media/context sink initialization, checks ready/playing elements
before any device toggle, then tests switching and reconnect. The unrestricted
autoplay flag was removed. Physical USB output confirmation remains pending;
these tests do not certify the actual speaker signal on user hardware.


## Forced TURN staging preparation (2026-11-07)

User diagnostics: Coturn active, static lt-cred-mech account configured, ports
3478/5349, relay UDP range 49152-65535, realm rvxis.site, UFW inactive.
Provided public certificate is Let's Encrypt, valid 2026-09-19 to 2026-12-18.
These observations do not prove external relay reachability or matching credentials.
Added optional staging-local.sh --turn, static credential parser (only the two
TURN fields, in memory, no shell execution/copy/output), and separate relay-only
frontend probe. Normal application bundles are not injected. Test entry requires
loopback 3102, LiveKit disabled and the injected frontend. Production unchanged.
Probe forces relay on construction and setConfiguration, reports selected pair
types and audio bytes without IPs/credentials. Empty/disconnected/direct paths
cannot pass. All 103 tests, typecheck, web build and manifests passed; Bash
parsed by shfmt. Real Chromium 156 verified the forced policy and nonpassing
empty-media report. Actual TURN allocations/audio and individual UDP/TCP/TLS
paths remain untested until the user runs the two-device staging check.


## UDP relay confirmed; TCP/TLS profiles prepared (2026-11-07)

User supplied reports from both Windows PCs: relay policy, connected, selected
local/remote relay candidates, relayProtocol udp, nonzero incoming/outgoing RTP
bytes, passed true. This confirms the selected UDP TURN path in those networks.
Added separate ?turn=udp|tcp|tls profiles to the isolated probe, filtering ICE
server URLs on construction and setConfiguration. Passed requires the actual
relayProtocol to match the requested profile; invalid profiles have no servers.
The 4 targeted staging tests pass. Native Chromium 156 independently verified
all 3 URL filters and fail-closed unknown profile without allocating media.
No claim of real TCP/TLS reachability until user reports. Reference for distinguishing
protocol from relayProtocol: https://www.w3.org/TR/webrtc-stats/#dom-rtcicecandidatestats-relayprotocol .
Production frontend code and backend services unchanged in this step.


## LiveKit staging preparation (2026-11-07)

User diagnostics confirmed LiveKit 1.13.7, Docker host network, image digest
sha256:6fd3b7088874c4d119160dd688798dfec852bc014786d392caad15f6f63912a3,
HTTP/WSS backend 7880, RTC TCP 7881, RTC UDP range 50000-60000 and external IP
advertisement. Config is file-mounted, container env shows PATH only; Caddyfile
/opt/livekit/Caddyfile, persistent Caddy volumes, UFW inactive. No changes on SFU.
Prepared --livekit staging on the application VPS: existing credentials loaded
only into process memory, normal frontend without relay probe, HTTPS/WSS URL
validation, stable revision-specific LiveKit room prefix signed by the backend.
Default production room names are unchanged when prefix is unset. Client-supplied
room/prefix overrides do not escape the signed namespace; invalid prefix fails.
This is logical naming separation on a shared SFU, not tenant/resource isolation.
Namespace regression failed before and passes after. All 106 tests, typecheck,
web build, manifest checks and browser voice smoke pass; Bash parsed shfmt.
Actual LiveKit authentication, publishing, subscription and screen/system audio
still require the user's two-device test. No production deploy or SFU restart.


## Windows staging build preparation (2026-11-08)

User confirmed LiveKit image/restart, tab audio, selected output/deafen/viewer
closure, then full-screen Windows system audio independent of microphone and
clean stop. These are manual two-device reports, not a load or endurance test.
Next is a dedicated desktop build. VITE_RVXIS_STAGING routes native clients to
localhost:3000 and disables updater checks/install and URL mocks; STAGING label
is visible. Cargo staging feature omits updater plugin and denies portable
updates before network/file operations. Application ID differs from production.
The build script uses a clean committed snapshot, enables the local testing
flag only in that copy, builds without installer, reuses dependency caches,
runs staging Rust tests and verifies embedded bundle/identifier/guard bytes.
108 JS tests/typecheck/build/manifests and 3 ordinary-mode Rust tests passed.
Final staging EXE build metadata and native staging test results are recorded
separately in outputs. No production publication or deployed code changes.


## Isolated delivery/rollback harness (2026-11-08)

User confirmed native global hotkeys in the background. Basic staging desktop
voice/media/device/hotkey block is complete by user report; installer and real
update channel are still not tested. Prepared a Linux delivery harness with
private /opt/rvxis-deploy-smoke/run-<random>, PM2_HOME, loopback 3200/3201.
Only a marked deployment constants block is substituted in a temporary script;
the probe/symlink/restart/rollback control flow stays identical. Isolation guards
reject production leftovers, escaping roots or changed markers. Fixtures cover
legacy health rollback, successful activation, rejected probe and activation
rollback. Real production health/PID/paths are compared read-only before/after.
Only private PM2 is stopped; fixture logs persist; inherited secrets are cleared.
Production script now checks Node 22.22+ before install/switch, probes loopback
and explicitly passes the validated Node interpreter to PM2. This matters for
the existing host's system Node 20; no global runtime is changed by the test.
111 JS tests/typecheck/build/manifests passed; shell sources plus generated
copy parsed by shfmt and CI validated by actionlint. Actual Linux/PM2 execution
remains pending user run. This is control-flow testing with health fixtures,
not a production migration/nginx/media or desktop updater certification.

User subsequently reported all four delivery cases passed on Node v22.22.0,
productionPidAndPathsUnchanged=true and isolatedPm2Stopped=true, private root
/opt/rvxis-deploy-smoke/run-3ae19da8ffcc84ae. This is user-run evidence.

## Separate staging installer preparation (2026-11-08)

Extended the isolated desktop builder with optional NSIS/currentUser packaging,
unique rvxis-staging.exe process name and disabled updater artifacts. Kept
separate product/identifier and added fresh-artifact selection plus installer
checksum metadata. Build and manual install evidence are recorded in outputs.
No production publication, deployment or installer execution is performed.

## CI media browser correction (2026-11-08)

GitHub run 42472712263 on 3bcc789 failed only the browser media smoke step;
typecheck, shell syntax, unit/integration tests, manifests and build passed.
Reproduced with pinned Chromium 141 Headless Shell on Windows: the saved fake
output ID differed from the outputs enumerated in the client page. Full Chromium
141 passed with the same checks. Changed the default launcher to channel chromium
(new headless) and removed implicit platform-specific installed-browser selection.
Explicit RVXIS_BROWSER_EXECUTABLE remains available. Output-assertion failures
now report saved/expected sinks and media element/track state. No assertion was
removed, timeout enlarged or application media behavior changed. Local pinned
new-headless scenario passed; updated GitHub CI must confirm Linux behavior.

The follow-up run 42473423347 on c3c500a completed successfully, including
the Linux browser media smoke step. Remote/local branches were synchronized.

## Correct installed update mode before updater rehearsal (2026-11-08)

Generated NSIS installer.nsi writes $INSTDIR/uninstall.exe and installs per-user
under $LOCALAPPDATA/RVxis. Neither that marker nor that default path was detected
by the old portable heuristic. Extracted installation detection, added the NSIS
marker and preserved legacy markers/protected paths. Unknown current executable
path now fails closed. The portable native command independently rejects an
installed executable before temp-file cleanup, download or replacement, including
when a caller explicitly requests portable mode. Staging updater stays disabled.
Regression test failed on uninstall.exe before the marker fix, then all five
Rust release tests passed in normal and staging builds. CI now compiles/runs the
dependency-free installation regression module on Linux as well. This fixes mode
selection/protection; it does not yet certify an actual signed desktop update.

GitHub run 42473751613 on 6e1dc61 passed all checks, including the new standalone
installation regression and Linux browser media smoke.

## Isolated signed updater pair tooling (2026-11-08)

Prepared build-updater-fixture.js, loopback-only HTTPS server and scenario tests.
Only a git-archive copy is patched: separate random test identity/binary/product,
versions 0.2.9001/0.2.9002, disposable in-memory signing key, app-local seven-day
CA trust, local backend flag and visible UPDATER TEST badge. The snapshot-only
check adapter uses the real UpdaterBuilder and returns its resource to the real
JS Update class; plugin download/signature/install logic is retained. Portable
download uses the existing native implementation, with local root and an explicit
test-identity/localhost restriction. No system trust-store or production changes.
Bad-signature and modified-bytes-with-matching-hash scenarios require signature
rejection; valid serves the verified target. Private signing keys are never saved;
TLS server key remains only in scratch. Unit fixture signature/scenario tests
passed. Build and actual manual update results are tracked separately in outputs.
Ordinary staging updater is still blocked. See UPDATER_REHEARSAL.md for limits.

## First manual updater check renders blank (2026-11-08)

User confirmed installed test A and the installer update button, but saw a blank
modal on the first manual version click; closing/reopening recovered it. The
component regression reproduced the race: the open effect synchronizes status,
while a second effect sets fading-out and loses its timer when that sync rerenders.
Also covered rapid changes returning to the displayed state and close/reopen mid
transition. One effect now owns opening/transitions, always restores visibility
when status matches, clears its only timer and resets stale height on opening.
The regressed real-component test failed before and passed after the fix;
TypeScript passed. Browser smoke now inspects actual computed ancestor opacity
during a delayed first manual check. The previously built installed test pair
contains the old UI and must be rebuilt to manually confirm the correction.

User confirmed the rebuilt modal opens correctly. Installed updater foreign-key
and tampered signature errors were confirmed by screenshots; valid update was
confirmed by user plus installed PE version 0.2.9002. Byte comparison with B
differs only in the known Tauri NSS/UNK bundle marker. Portable negative/valid
update and restart checks passed earlier. Production key/CDN remains untested.

## Legacy migration preparation (2026-11-08)

Fresh user diagnostics: current 0.2.2 healthy on system Node20.20.2; verified
private Node22.22.0 available. Real frontend/backend share one filesystem;
backend has no dist; .env is 0644; release/shared trees absent. PM2 is one online
fork without watch/extra args; probe3101 free. Prepared a default-read-only
plan/apply/rollback tool with strict targets, dedicated runtime, private
journal/backups, legacy Node22 probe, shared env0600, preserved PM2 record/env,
health/frontend/interpreter checks and recovery. Isolated tests cover
success/rollback, probe failure, partial move and post-activation failure.
SSH workflow selects dedicated runtime PATH; deploy-candidate flow unchanged.
Linux/PM2 rehearsal and production plan pending; no production apply/restart or
deployment approval/execution has occurred.

First Linux rehearsal 7f27685 stopped before any migration case: the copied test
Node retained the archive owner's UID despite mode755. User report confirms
production PID/paths unchanged and private PM2 stopped. Added isolated copy helper
that chowns only its newly created fixture, plus a real root Linux CI regression
with UID65534 source. Production owner guard is unchanged. Production source now
comes from a separate official SHA-checked archive extracted --no-same-owner under
/opt/rvxis-migration-input; existing staging runtime is left untouched. Full Linux
rehearsal must be repeated; the original failure is not counted as a passed case.

