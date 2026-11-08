# Isolated Windows updater rehearsal

This is a separate application pair, not a release. Build from a clean committed
branch using Node 22.22+ and cached Cargo dependencies:

```powershell
node scripts/build-updater-fixture.js --work-dir <scratch> --output-dir <outputs>
```

Use `--portable-only` for build-tool verification without NSIS. Full packaging
may need ordinary PowerShell because this Codex environment cannot start NSIS.
The builder never installs or launches an application, publishes, pushes or tags.
It prints a fresh fixture directory only after both builds/signatures are ready.
Never mix artifacts from different directories/build runs.

Each pair has a random product, executable name, identifier and disposable
in-memory Ed25519/Minisign signing key, versions 0.2.9001 and 0.2.9002. A seven-day
local CA and localhost server certificate are generated with Git's OpenSSL (or
RVXIS_OPENSSL). The CA private key is deleted after issuing the server certificate;
only the scratch directory retains the server TLS key. Signing private keys are
never written. Do not upload scratch files or TLS private keys. Regenerate a pair
after expiry. No certificate is imported into the Windows trust store.

The builder changes only a git-archive snapshot. It sets the manual local-server
flag there, retains the visible UPDATER TEST badge, enables updater only in this
snapshot's hook, substitutes a test public key and removes production updater
fallback URLs. A small snapshot-only native check command configures the real
Tauri UpdaterBuilder with the local CA and hands its Update resource back to the
unchanged JS Update class. Real plugin download/signature/install code is used.
The portable download uses its real validation/replacement path with the same
local root added and an explicit localhost/test-identity restriction. TLS and
hostname validation remain enabled. This tests updater mechanics with test trust,
not production signing-key custody, production CDN or production TLS trust.

Start the local HTTPS fixture on the Windows test PC (no VPS changes):

```powershell
node scripts/serve-updater-fixture.js <fixture directory> bad-signature
```

Only 127.0.0.1:9443 is used. The server validates original signatures/hashes first,
serves only allowlisted in-memory payloads, and defaults to a foreign signature.
Ctrl+C stops it. Restart with `tampered` or `valid` for another scenario. Keep the
existing staging backend/SSH tunnel on localhost:3000 for the application shell.

Run initial portable (0.2.9001) from the fixture directory. Check for updates.
In bad-signature mode, installation must fail and the active version/file hash
must stay at A. In tampered mode, the served hash matches modified bytes but the
original signature does not; native signature verification must reject it.
Then restart the server in valid mode: update must relaunch into 0.2.9002,
without changing other RVxis installations. Do not manually start the target B
file to claim updater success. Fully exit the portable test before installer tests.

For installed testing, install the initial Setup at its default separate path,
then repeat both rejection scenarios and valid update. Check the installed
version is B after reopening from Start, and portable was not selected. These
manual results, real application restart, installer exit behavior, and cleanup
remain unverified until observed. Only uninstall this randomly named test app.

Never publish these test versions/keys to the production channel. The regular
staging feature still blocks updates; normal source config and public key stay
unchanged. A passing fixture does not prove arbitrary post-launch crash rollback.
