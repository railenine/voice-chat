import assert from 'node:assert/strict';
import { it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { promoteDesktop, verifyCandidateFolder, verifyPromotionCheckouts } from '../../scripts/promote-desktop.js';
import { releaseFixture } from '../helpers/release-fixture.js';

function fakeGitHub(fixture, overrides = {}) {
  const zip = Buffer.from('approved fixture ZIP'), zipDigest = `sha256:${crypto.createHash('sha256').update(zip).digest('hex')}`;
  const state = { calls: [], assets: [], tag: false, draft: true, readback: 0, latestReads: 0 };
  const json = (body, status = 200) => Response.json(body, { status });
  const fetchImpl = async (url, options = {}) => {
    const u = new URL(url), method = options.method || 'GET', resource = u.pathname.replace('/repos/railenine/voice-chat', '');
    state.calls.push({ method, resource, authorization: options.headers?.Authorization });
    if (u.hostname === 'storage.example.test') {
      assert.equal(options.headers, undefined, 'Repository token must not reach storage');
      return new Response(overrides.corruptZip ? 'corrupt archive' : zip);
    }
    if (resource === '/actions/runs/42') return json({ id: 42, status: 'completed', conclusion: 'success', event: 'workflow_dispatch',
      path: '.github/workflows/desktop-build.yml', head_sha: fixture.source,
      repository: { full_name: 'railenine/voice-chat' }, head_repository: { full_name: 'railenine/voice-chat' }, ...overrides.run });
    if (resource === '/actions/runs/42/artifacts') return json({ total_count: 1, artifacts: [{ id: 77, name: 'RVxis-Windows-x64',
      digest: zipDigest, expired: false, workflow_run: { id: 42, head_sha: fixture.source }, ...overrides.artifact }] });
    if (resource === '/actions/artifacts/77/zip') {
      if (options.headers.Accept !== 'application/vnd.github+json') return json({ error: 'Unsupported Accept header' }, 415);
      return new Response(null, { status: 302, headers: { location: 'https://storage.example.test/zip' } });
    }
    if (resource === '/releases/latest') {
      state.latestReads++;
      return json({ tag_name: overrides.latestAdvances && state.latestReads > 1 ? 'v99.0.0' : 'v0.2.2' });
    }
    if (resource.startsWith('/releases/tags/')) return overrides.existingRelease ? json({ draft: true }) : json({}, 404);
    if (resource.startsWith('/git/ref/tags/')) return state.tag || overrides.existingTag
      ? json({ object: { type: 'commit', sha: fixture.source } }) : json({}, 404);
    if (resource === '/git/refs' && method === 'POST') {
      assert.deepEqual(JSON.parse(options.body), { ref: `refs/tags/v${fixture.version}`, sha: fixture.source });
      state.tag = true; return json({ object: { type: 'commit', sha: fixture.source } });
    }
    if (resource === '/releases' && method === 'POST') {
      assert.equal(JSON.parse(options.body).draft, true); return json({ id: 9, draft: true });
    }
    if (u.hostname === 'uploads.github.com') {
      if (overrides.failUpload) return json({}, 500);
      const asset = { id: 100 + state.assets.length, name: u.searchParams.get('name'), size: options.body.length, state: 'uploaded', data: options.body };
      state.assets.push(asset); return json({ ...asset, data: undefined });
    }
    if (resource === '/releases/9' && method === 'GET') return json({ id: 9, draft: state.draft, tag_name: `v${fixture.version}`,
      assets: state.assets.map(({ data, ...meta }) => meta) });
    if (resource.startsWith('/releases/assets/')) {
      assert.equal(options.headers.Accept, 'application/octet-stream');
      state.readback++; const asset = state.assets.find(a => a.id === Number(resource.split('/').at(-1)));
      return new Response(overrides.corruptReadback ? 'changed' : asset.data);
    }
    if (resource === '/releases/9' && method === 'PATCH') {
      assert.equal(state.readback, state.assets.length, 'Every uploaded byte must be read back before publishing');
      state.draft = false; return json({ draft: false, tag_name: `v${fixture.version}`, html_url: 'https://github.com/railenine/voice-chat/releases/test' });
    }
    throw Error(`Unexpected fake API request: ${method} ${resource}`);
  };
  return { state, zipDigest, options: () => ({ sourceRoot: fixture.sourceRoot, source: fixture.source, contextSha: fixture.source,
    runId: '42', expectedDigest: zipDigest, token: 'test-only', publicationToken: 'publication-only', outputRoot: fs.mkdtempSync(path.join(fixture.root, 'out-')), fetchImpl,
    extract: ({ destination }) => fs.cpSync(fixture.artifactRoot, destination, { recursive: true }) }) };
}

it('verification is read-only; publishing preserves exact signed bytes and reads back all assets', async () => {
  const f = releaseFixture();
  try {
    const github = fakeGitHub(f);
    const verified = await promoteDesktop({ ...github.options(), publicationToken: undefined, verifierCommit: 'b'.repeat(40) });
    assert.equal(verified.published, false); assert.equal(verified.files.length, 10);
    assert.equal(verified.sourceCommit, f.source);
    assert.equal(verified.verifierCommit, 'b'.repeat(40));
    assert.ok(github.state.calls.every(c => c.method === 'GET'));
    await assert.rejects(promoteDesktop({ ...github.options(), mode: 'publish' }), /explicit PUBLISH/);
    const before = github.state.calls.length;
    await assert.rejects(promoteDesktop({ ...github.options(), publicationToken: undefined,
      mode: 'publish', confirmation: `PUBLISH v${f.version}` }), /DESKTOP_RELEASE_TOKEN/);
    assert.equal(github.state.calls.length, before, 'Missing publication credentials must fail before any API request');
    const published = await promoteDesktop({ ...github.options(), verifierCommit: 'b'.repeat(40), mode: 'publish', confirmation: `PUBLISH v${f.version}` });
    assert.equal(published.published, true); assert.equal(github.state.assets.length, 10);
    assert.equal(published.sourceCommit, f.source); assert.equal(published.verifierCommit, 'b'.repeat(40));
    assert.equal(github.state.draft, false); assert.equal(github.state.readback, 10);
    for (const call of github.state.calls.slice(before)) {
      if (call.resource === '/zip') assert.equal(call.authorization, undefined);
      else assert.equal(call.authorization, call.resource.startsWith('/actions/')
        ? 'Bearer test-only' : 'Bearer publication-only', 'Actions reads and release operations use separate credentials');
    }
  } finally { f.cleanup(); }
});

it('separate verifier and candidate checkouts stay pinned and reject dirty or mismatched revisions', () => {
  const scratch = path.resolve('.test-tmp'); fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, 'promotion-checkouts-'));
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    const verifier = path.join(root, 'verifier'), candidate = path.join(root, 'candidate');
    for (const [dir, value] of [[verifier, 'verifier'], [candidate, 'candidate']]) {
      fs.mkdirSync(dir); git(dir, 'init', '-b', 'fixture'); fs.writeFileSync(path.join(dir, 'state.txt'), value);
      git(dir, 'add', 'state.txt');
      git(dir, '-c', 'user.name=Release Test', '-c', 'user.email=release-test@example.test', 'commit', '-qm', 'fixture');
    }
    const verifierSha = git(verifier, 'rev-parse', 'HEAD'), candidateSha = git(candidate, 'rev-parse', 'HEAD');
    assert.notEqual(verifierSha, candidateSha);
    assert.deepEqual(verifyPromotionCheckouts(verifier, candidate, verifierSha, candidateSha),
      { verifierCommit: verifierSha, contextSha: candidateSha });
    assert.throws(() => verifyPromotionCheckouts(verifier, candidate, candidateSha, candidateSha), /Verifier/);
    assert.throws(() => verifyPromotionCheckouts(verifier, candidate, verifierSha, verifierSha), /Candidate/);
    fs.writeFileSync(path.join(candidate, 'state.txt'), 'dirty');
    assert.throws(() => verifyPromotionCheckouts(verifier, candidate, verifierSha, candidateSha));
    fs.writeFileSync(path.join(candidate, 'state.txt'), 'candidate');
    fs.writeFileSync(path.join(verifier, 'state.txt'), 'dirty');
    assert.throws(() => verifyPromotionCheckouts(verifier, candidate, verifierSha, candidateSha));
  } finally {
    assert.equal(path.dirname(root), scratch); assert.ok(path.basename(root).startsWith('promotion-checkouts-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it('wrong source, failed runs, changed ZIPs, expired artifacts and existing releases cannot be promoted', async () => {
  const f = releaseFixture();
  try {
    for (const [overrides, expectedError] of [[{ run: { head_sha: 'b'.repeat(40) } }, /approved successful/],
      [{ run: { conclusion: 'failure' } }, /approved successful/], [{ run: { event: 'pull_request' } }, /approved successful/],
      [{ corruptZip: true }, /ZIP digest mismatch/], [{ artifact: { expired: true } }, /metadata/],
      [{ artifact: { digest: 'sha256:' + 'b'.repeat(64) } }, /metadata/], [{ existingTag: true }, /Tag already exists/],
      [{ existingRelease: true }, /Release already exists/]]) {
      const github = fakeGitHub(f, overrides);
      await assert.rejects(promoteDesktop({ ...github.options(), mode: 'publish', confirmation: `PUBLISH v${f.version}` }), expectedError);
      assert.ok(github.state.calls.every(c => c.method === 'GET'));
    }
    const github = fakeGitHub(f);
    await assert.rejects(promoteDesktop({ ...github.options(), contextSha: 'b'.repeat(40) }), /checkout exactly/);
    fs.appendFileSync(path.join(f.artifactRoot, 'src-tauri/target/release/RVxis.exe'), 'changed');
    assert.throws(() => verifyCandidateFolder(f.sourceRoot, f.artifactRoot, f.source), /size\/hash/);
  } finally { f.cleanup(); }
});

it('upload/readback failure leaves a draft unpublished and never deletes or replaces a release', async () => {
  const f = releaseFixture();
  try {
    for (const overrides of [{ failUpload: true }, { corruptReadback: true }, { latestAdvances: true }]) {
      const github = fakeGitHub(f, overrides);
      await assert.rejects(promoteDesktop({ ...github.options(), mode: 'publish', confirmation: `PUBLISH v${f.version}` }));
      assert.equal(github.state.draft, true);
      assert.ok(github.state.calls.every(c => c.method !== 'PATCH' && c.method !== 'DELETE'));
    }
  } finally { f.cleanup(); }
});
