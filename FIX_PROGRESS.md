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

