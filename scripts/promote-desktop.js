import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkReleaseSource, candidateFiles, releaseCandidateReport } from './release-candidate.js';
import { isNewerVersion } from '../src/utils/semver.ts';

const repository = 'railenine/voice-chat';
const apiRoot = `https://api.github.com/repos/${repository}`;
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const digest = value => {
  if (typeof value !== 'string' || !/^(?:sha256:)?[a-f0-9]{64}$/i.test(value)) throw Error('Expected artifact ZIP SHA-256 is required');
  return `sha256:${value.toLowerCase().replace(/^sha256:/, '')}`;
};

async function boundedBody(response, limit) {
  if (Number(response.headers.get('content-length')) > limit) throw Error('Download exceeds size limit');
  const parts = []; let total = 0;
  for await (const part of response.body) {
    total += part.length;
    if (total > limit) throw Error('Download exceeds size limit');
    parts.push(part);
  }
  return Buffer.concat(parts);
}

export function verifyCandidateFolder(sourceRoot, artifactRoot, source) {
  const { version } = checkReleaseSource(sourceRoot);
  const expected = candidateFiles(version).sort();
  const actual = [];
  function walk(dir, prefix = '') {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name), relative = prefix + name, stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw Error('Symlinks are not release artifacts');
      if (stat.isDirectory()) walk(file, relative + '/');
      else if (stat.isFile() && stat.size <= 64 * 1024 * 1024) actual.push(relative);
      else throw Error('Invalid release file');
    }
  }
  walk(artifactRoot);
  assert.deepEqual(actual.sort(), expected, 'Release archive contains missing or unexpected files');
  const report = JSON.parse(fs.readFileSync(path.join(artifactRoot, 'release-candidate.json')));
  assert.equal(report.formatVersion, 2, 'A fresh candidate report is required');
  assert.deepEqual(report, releaseCandidateReport(sourceRoot, source, artifactRoot), 'Candidate report does not match verified files/source');
  return expected.map(file => {
    const data = fs.readFileSync(path.join(artifactRoot, file));
    return { name: path.basename(file), bytes: data.length, sha256: sha256(data), data };
  });
}

export function verifyPromotionCheckouts(verifierRoot, sourceRoot, workflowSha, expectedSource) {
  const sha = cwd => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  const verifierCommit = sha(verifierRoot), contextSha = sha(sourceRoot);
  if (workflowSha !== verifierCommit) throw Error('Verifier must match workflow checkout exactly');
  if (!/^[a-f0-9]{40}$/.test(expectedSource || '') || contextSha !== expectedSource) throw Error('Candidate must match source checkout exactly');
  for (const cwd of [verifierRoot, sourceRoot]) execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { cwd, stdio: 'ignore' });
  return { verifierCommit, contextSha };
}

export async function promoteDesktop({ sourceRoot, outputRoot, source, contextSha, runId, expectedDigest,
  verifierCommit = contextSha, mode = 'verify', confirmation = '', token, publicationToken, fetchImpl = fetch, extract }) {
  if (!['verify', 'publish'].includes(mode)) throw Error('Invalid promotion mode');
  if (!/^[a-f0-9]{40}$/.test(source || '') || source !== contextSha) throw Error('Candidate must match source checkout exactly');
  if (!/^[a-f0-9]{40}$/.test(verifierCommit || '')) throw Error('Invalid verifier revision');
  if (!/^[1-9][0-9]*$/.test(String(runId)) || !Number.isSafeInteger(Number(runId))) throw Error('Invalid candidate run ID');
  const { version } = checkReleaseSource(sourceRoot), tag = `v${version}`, approvedDigest = digest(expectedDigest);
  if (mode === 'publish' && confirmation !== `PUBLISH ${tag}`) throw Error(`Publishing requires explicit PUBLISH ${tag} confirmation`);
  if (!token) throw Error('GitHub token is required');
  if (mode === 'publish' && !publicationToken) throw Error('DESKTOP_RELEASE_TOKEN is required for publish: Contents write and Workflows write for this repository');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'RVxis-verified-promotion' };
  // Actions stays on GITHUB_TOKEN (Actions read). Only release/tag operations use
  // the dedicated credential; GITHUB_TOKEN cannot receive Workflows write.
  const requestHeaders = resource => ({ ...headers, Authorization: `Bearer ${
    mode === 'publish' && !resource.startsWith('/actions/') ? publicationToken : token}` });
  async function api(resource, { method = 'GET', body, missing = false } = {}) {
    const response = await fetchImpl(apiRoot + resource, { method, headers: { ...requestHeaders(resource), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(90000) });
    if (missing && response.status === 404) return null;
    if (!response.ok) throw Error(`GitHub API ${method} ${resource.split('?')[0]} failed: ${response.status}`);
    return response.json();
  }
  async function download(resource, limit, accept = 'application/octet-stream') {
    let response = await fetchImpl(apiRoot + resource, { headers: { ...requestHeaders(resource), Accept: accept },
      redirect: 'manual', signal: AbortSignal.timeout(90000) });
    if (response.status === 302) {
      const location = new URL(response.headers.get('location'));
      if (location.protocol !== 'https:' || location.username || location.password) throw Error('Unsafe artifact download redirect');
      // Never forward the repository token to artifact storage.
      response = await fetchImpl(location.href, { redirect: 'error', signal: AbortSignal.timeout(90000) });
    }
    if (!response.ok) throw Error(`Artifact download failed: ${response.status}`);
    return boundedBody(response, limit);
  }
  const run = await api(`/actions/runs/${runId}`);
  if (run.id !== Number(runId) || run.status !== 'completed' || run.conclusion !== 'success' || run.event !== 'workflow_dispatch' ||
      run.path !== '.github/workflows/desktop-build.yml' || run.head_sha !== source ||
      run.repository?.full_name !== repository || run.head_repository?.full_name !== repository) throw Error('Candidate run is not an approved successful build of this source');
  const list = await api(`/actions/runs/${runId}/artifacts?per_page=100`);
  if (list.total_count > list.artifacts.length) throw Error('Incomplete artifact listing');
  const matches = list.artifacts.filter(a => a.name === 'RVxis-Windows-x64');
  if (matches.length !== 1) throw Error('Expected one immutable Windows artifact');
  const artifact = matches[0];
  if (!Number.isSafeInteger(artifact.id) || artifact.expired !== false ||
      artifact.workflow_run?.id !== Number(runId) || artifact.workflow_run?.head_sha !== source ||
      digest(artifact.digest) !== approvedDigest) throw Error('Artifact metadata does not match approved source/digest');
  const zip = await download(`/actions/artifacts/${artifact.id}/zip`, 128 * 1024 * 1024, 'application/vnd.github+json');
  if (`sha256:${sha256(zip)}` !== approvedDigest) throw Error('Downloaded ZIP digest mismatch');
  fs.mkdirSync(outputRoot, { recursive: true });
  const archive = path.join(outputRoot, 'candidate.zip'), artifactRoot = path.join(outputRoot, 'candidate');
  fs.writeFileSync(archive, zip, { flag: 'wx' });
  await extract({ archive, destination: artifactRoot, expectedFiles: candidateFiles(version) });
  const files = verifyCandidateFolder(sourceRoot, artifactRoot, source);
  // This preflight is also read-only in verify mode. Existing drafts are not overwritten.
  if (await api(`/releases/tags/${tag}`, { missing: true })) throw Error('Release already exists; inspect it manually');
  if (await api(`/git/ref/tags/${tag}`, { missing: true })) throw Error('Tag already exists; never overwrite it');
  const latest = await api('/releases/latest', { missing: true });
  if (latest && !isNewerVersion(version, latest.tag_name)) throw Error('Candidate must be newer than the latest release');
  const receipt = { mode, sourceCommit: source, verifierCommit, version, tag, candidateRunId: Number(runId),
    artifactId: artifact.id, artifactDigest: approvedDigest, published: false,
    files: files.map(({ data, ...meta }) => meta) };
  const receiptPath = path.join(outputRoot, 'promotion-receipt.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  if (mode === 'verify') return receipt;

  // Only this branch mutates GitHub. It never builds binaries or pushes main.
  const ref = await api('/git/refs', { method: 'POST', body: { ref: `refs/tags/${tag}`, sha: source } });
  if (ref.object?.sha !== source || ref.object?.type !== 'commit') throw Error('Created tag does not match candidate');
  const notes = files.find(file => file.name === 'RELEASE_NOTES.md').data.toString('utf8');
  const release = await api('/releases', { method: 'POST', body: { tag_name: tag, target_commitish: source,
    name: `RVxis ${tag}`, body: notes, draft: true, prerelease: false } });
  if (release.draft !== true || !Number.isSafeInteger(release.id)) throw Error('Expected a private draft release');
  receipt.releaseId = release.id;
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  for (const file of files) {
    const response = await fetchImpl(`https://uploads.github.com/repos/${repository}/releases/${release.id}/assets?name=${encodeURIComponent(file.name)}`,
      { method: 'POST', headers: { ...requestHeaders('/releases'), 'Content-Type': 'application/octet-stream' }, body: file.data,
        redirect: 'error', signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw Error('Asset upload failed; draft is left unpublished');
    const uploaded = await response.json();
    if (uploaded.name !== file.name || uploaded.size !== file.bytes || uploaded.state !== 'uploaded') throw Error('Uploaded asset metadata mismatch');
  }
  const draft = await api(`/releases/${release.id}`);
  if (draft.draft !== true || draft.tag_name !== tag || draft.assets.length !== files.length) throw Error('Draft changed during verification');
  const seen = new Set();
  for (const asset of draft.assets) {
    const file = files.find(f => f.name === asset.name);
    if (!file || seen.has(asset.name) || asset.size !== file.bytes) throw Error('Draft asset set mismatch');
    seen.add(asset.name);
    const remote = await download(`/releases/assets/${asset.id}`, file.bytes + 1);
    if (sha256(remote) !== file.sha256) throw Error('Draft asset readback hash mismatch; release is not published');
  }
  const tagState = await api(`/git/ref/tags/${tag}`);
  if (tagState.object?.type !== 'commit' || tagState.object?.sha !== source) throw Error('Release tag changed');
  const currentLatest = await api('/releases/latest', { missing: true });
  if (currentLatest && !isNewerVersion(version, currentLatest.tag_name)) throw Error('Latest release advanced; draft stays unpublished');
  const published = await api(`/releases/${release.id}`, { method: 'PATCH', body: { draft: false, make_latest: 'true' } });
  if (published.draft !== false || published.tag_name !== tag) throw Error('Unexpected publication result; inspect release manually');
  receipt.published = true; receipt.releaseUrl = published.html_url;
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const verifierRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (process.env.GITHUB_REPOSITORY !== repository || !process.env.CANDIDATE_SOURCE_ROOT) throw Error('Promotion requires this repository and a pinned candidate checkout');
  const sourceRoot = path.resolve(process.env.CANDIDATE_SOURCE_ROOT);
  const { contextSha, verifierCommit } = verifyPromotionCheckouts(verifierRoot, sourceRoot, process.env.GITHUB_SHA, process.env.EXPECTED_SOURCE);
  const outputRoot = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'rvxis-promotion-'));
  const receipt = await promoteDesktop({ sourceRoot, outputRoot, contextSha, verifierCommit,
    source: process.env.EXPECTED_SOURCE, runId: process.env.CANDIDATE_RUN_ID,
    expectedDigest: process.env.EXPECTED_DIGEST, mode: process.env.PROMOTION_MODE,
    confirmation: process.env.PUBLISH_CONFIRMATION, token: process.env.GH_TOKEN,
    publicationToken: process.env.DESKTOP_RELEASE_TOKEN,
    extract: ({ archive, destination, expectedFiles }) => {
      const allowed = path.join(outputRoot, 'expected-files.json');
      fs.writeFileSync(allowed, JSON.stringify(expectedFiles));
      execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', path.join(verifierRoot, 'scripts/expand-release-candidate.ps1'),
        '-Archive', archive, '-Destination', destination, '-ExpectedFiles', allowed,
        '-ExpectedVersion', checkReleaseSource(sourceRoot).version], { stdio: 'inherit' });
    } });
  const summary = `## Desktop ${receipt.mode}\n\nSource: ${receipt.sourceCommit}\n\nVerifier: ${receipt.verifierCommit}\n\nCandidate run: ${receipt.candidateRunId}\n\nZIP: ${receipt.artifactDigest}\n\nPublished: ${receipt.published}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `receipt=${path.join(outputRoot, 'promotion-receipt.json')}\n`);
  console.log(JSON.stringify(receipt, null, 2));
}
