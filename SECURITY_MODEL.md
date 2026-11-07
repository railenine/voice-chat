# Guest sessions and media access

Rooms remain guest rooms: knowing a room code permits joining. A nickname or peer
ID is a public label, not proof of ownership. The server issues a random session
token in the private `room-state` response. Only that token can replace a live
connection using the same peer ID. Disconnected identities remain reserved for
60 seconds; explicit leave releases the identity immediately.

The browser keeps the token in tab-local session storage. It is never placed in
share URLs. Uploads, TURN configuration and LiveKit tokens require a Bearer token
and matching room/peer IDs with live WebSocket membership. Disconnect/leave
immediately prevents new HTTP access. Already issued LiveKit tokens have a
10-minute admission lifetime; leaving does not revoke an existing SFU connection
or previously downloaded files. This is not an end-to-end encryption guarantee.

LiveKit grants permit screen video/audio and subscriptions, but not microphone,
camera or data publishing. Media download URLs currently remain bearer links;
file retention and stricter download controls are separate from session identity.

HTTP and WebSocket requests use the same exact Origin allowlist. Native requests
without Origin are accepted but still require session authorization. Tauri's
localhost origins are allowed. Set CORS_ORIGIN to comma-separated exact browser
origins for other deployments. Development defaults allow localhost/loopback.

This changes the HTTP/reconnect contract. Older desktop clients must be updated
alongside the backend; do not restore anonymous credential endpoints as a
compatibility workaround. Validate a paired web/desktop candidate before rollout.

## Portable updates

Portable installation requires an HTTPS URL, bounded expected size, SHA-256 and
a prehashed Minisign signature verified against the bundled public key in Rust.
The release generator signs and verifies both installer and portable binaries;
it rejects missing binaries/signatures instead of copying a previous signature.
Signing passwords are passed as process arguments, never shell-interpolated or
included in command failure logs. Temporary CI key files are deleted in finally.

Only one installation can run at a time. Download time and size are bounded.
Verification finishes before renaming the running executable. A spawn error
restores the original path; this is not a transactional rollback after an
arbitrary later crash of the new process. Keep deployment recovery artifacts.
Previously published unsigned portable manifests cannot be installed by the
hardened client; prepare a signed paired release before rollout.
