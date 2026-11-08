# Legacy production migration

Production actions require separate approval. Do not run --apply or --rollback
as part of the isolated rehearsal. No merge to main or version tag is needed.

The known host runs healthy 0.2.2 on system Node 20.20.2, PM2 voicechat-server,
fork mode without watch/args. Frontend/backend are root-owned directories on the
same filesystem; no backend dist or release/shared trees exist. .env is currently
0644. The verified x64 Node 22.22.0 is cached under /opt/rvxis-staging.
The test runner can use that cache, but production preparation uses a separate
root-owned input under /opt/rvxis-migration-input. After the isolated rehearsal,
prepare it with scripts/prepare-migration-runtime.sh: official HTTPS download,
SHA256 manifest check and tar --no-same-owner. No running runtime is modified.

## Plan

Run the tool with the private Node 22. Default --plan reads health, selected PM2
metadata, path identities, Node version and nginx homepage via trusted HTTPS
with local DNS resolution. It prints a plan ID without creating migration paths,
copying credentials, stopping processes or writing PM2 configuration. It requires
an existing daemon and rejects changed paths/mode/arguments, occupied probe port,
ownership mismatch or destinations retained by an earlier attempt.

After explicit approval, --apply <plan ID> repeats preflight and rejects changed
state. It creates private journal/backups, copies the runtime to
/opt/rvxis-runtime/node-v22.22.0, links runtime/current, copies CURRENT legacy
backend/frontend into a retained release, creates shared/.env (0600, parent 0700)
and links it from that copy. No npm install/application code update occurs. The
original .env is retained inside a private 0700 backup hierarchy. The service PM2
configuration/environment backup is root-only and never printed.

The legacy copy is probed on loopback 3101 under Node22 before stopping anything.
The maintenance window stops only the target PM2 ID, moves original directories
into private backup, creates stable frontend/backend links and restarts the same
PM2 record with an explicit interpreter. Configuration/environment is retained;
CLI --update-env is deliberately omitted. Health, actual /proc interpreter and
unchanged nginx homepage are checked before pm2 save. System Node20, PM2
daemon/startup, nginx, Coturn and LiveKit are not upgraded or reconfigured. Calls
are interrupted. Path switches are not a joint transaction; the frontend path
is briefly absent during its move.

The SSH deploy workflow prepends the dedicated runtime bin to PATH.
deploy-candidate still enforces Node22 and retains the separately tested
activation flow. A future main push remains a production deployment.

## Recovery

Caught failures after stopping automatically stop the target record, remove only
links owned by this migration, restore original directories/interpreter, verify
backend/frontend and save PM2. Before-stop probe failures preserve the original
PID. No recursive deletion of backups, releases, state or runtimes occurs.
Failed preparations remain and intentionally block blind retries; inspect them.

--rollback <migration ID> restores a successful migration. Repeating a completed
rollback verifies the old service without another restart. State is private under
/opt/rvxis-migration/<ID>, with atomically replaced JSON journals. SIGINT/SIGTERM
request recovery at checkpoints. SIGKILL/power loss/full disk can need manual
recovery: inspect state.json and .active/owner.json; never remove a lock without
verifying its owner is no longer running. Recovery can itself fail; the tool then
names the retained private state. Do not paste pm2-before.json, probe logs or .env
into chat/wiki. No production apply/rollback approval has been given.

## Isolated prerequisite

Run `bash scripts/test-migrate-isolated.sh` from the check archive. It uses private
PM2_HOME/process, loopback 3300/3301/3302, fake credentials and only directories
under /opt/rvxis-migration-smoke/run-<random>. It needs 2GiB free for retained Node
binary copies. It never invokes production CLI apply/rollback. Target validation
rejects mixed production fields. Working health/PID/paths are compared before/after.

Cases: success plus explicit/idempotent rollback; failed probe without restarting
legacy; failure after first directory move; failure after Node22 activation.
Checks include preserved service environment, env/frontend permissions, actual
interpreter/configuration and released ports/private PM2 stop. Fixtures validate
control flow, not production dependency compatibility: the real pre-switch legacy
Node22 probe remains required. First collect this result and production --plan,
then review exact maintenance/rollback commands before final approval.

Linux copyFile can preserve the source UID. The fixture helper explicitly assigns
root ownership to its new copy only; production ownership checks stay strict.
CI runs a root-only regression with a source owned by UID65534 to cover this.
