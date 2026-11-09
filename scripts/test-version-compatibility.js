import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { execFileSync, fork } from 'node:child_process';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const legacySha = git('rev-parse', '9f7e8be099c9e69691718fd70e029be7536317e3^{commit}');
const candidateSha = git('rev-parse', 'HEAD^{commit}');
fs.mkdirSync(path.join(root, '.test-tmp'), { recursive: true });
const session = fs.mkdtempSync(path.join(root, '.test-tmp', 'compat-'));
const npmCli = process.env.npm_execpath || process.env.RVXIS_NPM_CLI;
if (!npmCli) throw new Error('Run through npm run test:compatibility or set RVXIS_NPM_CLI');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|LOCALAPPDATA|APPDATA|PATHEXT|HTTPS_PROXY|HTTP_PROXY|NO_PROXY)$/i.test(key)));
const workers = [], gateways = [];
let browser;
const cases = [];
const report = { legacySha, candidateSha, session, limits: [
  'Chromium web clients rebuilt from locked source, not native EXE execution',
  'Loopback RTP with fake microphone and no STUN/TURN; WAN/TURN was tested separately',
  'LiveKit token/grants only, no external SFU or screen media transport',
  'No production requests, deploy, release or signing keys',
], cases };

function snapshot(label, sha) {
  const dir = path.join(session, label);
  fs.mkdirSync(dir);
  execFileSync('git', ['archive', '--format=tar', `--output=${dir}.tar`, sha], { cwd: root });
  execFileSync('tar', ['-xf', `${dir}.tar`, '-C', dir]);
  assert.equal(fs.existsSync(path.join(dir, '.env')), false);
  const log = fs.openSync(path.join(session, `${label}-build.log`), 'w');
  try {
    const cache = process.env.RVXIS_COMPAT_CACHE ? ['--cache', process.env.RVXIS_COMPAT_CACHE] : [];
    const reuse = process.env.RVXIS_COMPAT_REUSE && path.resolve(process.env.RVXIS_COMPAT_REUSE, label);
    if (reuse) {
      assert.deepEqual(fs.readFileSync(path.join(dir, 'package-lock.json')), fs.readFileSync(path.join(reuse, 'package-lock.json')),
        'Reusing dependencies requires an identical lockfile');
      assert.ok(fs.existsSync(path.join(reuse, 'node_modules')));
      fs.symlinkSync(path.join(reuse, 'node_modules'), path.join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    } else {
      execFileSync(process.execPath, [npmCli, 'ci', '--ignore-scripts', '--no-audit', '--no-fund', ...cache],
        { cwd: dir, env, stdio: ['ignore', log, log] });
    }
    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'],
      { cwd: dir, env, stdio: ['ignore', log, log] });
  } finally { fs.closeSync(log); }
  console.log(`[Compatibility] Built ${label} ${sha.slice(0, 12)}`);
  return dir;
}

async function backend(label, dir) {
  const worker = fork(path.join(root, 'scripts/compatibility-worker.js'), [dir], { env, silent: true });
  workers.push(worker);
  // Logs may contain session data; keep them out of persistent reports.
  worker.stdout.resume(); worker.stderr.resume();
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error(`Backend ${label} timeout`)), 15000);
    worker.once('message', message => { clearTimeout(timeout); resolve(message.base); });
    worker.once('exit', code => { clearTimeout(timeout); reject(Error(`Backend ${label} exited ${code}`)); });
  });
  return { label, base };
}

async function gateway(frontend, target) {
  const app = express();
  app.use(['/api', '/peerjs', '/health'], (req, res) => {
    const upstream = http.request(target.base + req.originalUrl, {
      method: req.method, headers: { ...req.headers, host: new URL(target.base).host },
    }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  app.use(express.static(path.join(frontend, 'dist')));
  const server = http.createServer(app), wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const upstream = new WebSocket(target.base.replace('http:', 'ws:') + req.url, { origin: req.headers.origin });
    upstream.on('error', () => socket.destroy());
    upstream.once('open', () => wss.handleUpgrade(req, socket, head, client => {
      client.on('message', (data, binary) => { if (upstream.readyState === 1) upstream.send(data, { binary }); });
      upstream.on('message', (data, binary) => { if (client.readyState === 1) client.send(data, { binary }); });
      client.on('close', () => upstream.close());
      upstream.on('close', () => client.close());
      client.on('error', () => upstream.terminate());
    }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  gateways.push({ server, wss });
  return `http://127.0.0.1:${server.address().port}`;
}

function writeMicrophone() {
  const samples = 48000 * 2, wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(6000 * Math.sin(i * Math.PI * 360 / 48000)), 44 + i * 2);
  const file = path.join(session, 'microphone.wav'); fs.writeFileSync(file, wav); return file;
}

async function client(base, name, room) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['microphone'] });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
  });
  await context.addInitScript(() => {
    localStorage.setItem('voice_chat_rnnoise', 'false');
    window.compat = { peers: [], sockets: [], stateCount: 0, state: null, join: null, errors: [] };
    const Peer = window.RTCPeerConnection, Socket = window.WebSocket;
    window.RTCPeerConnection = class extends Peer {
      constructor(config) { super({ ...config, iceServers: [] }); window.compat.peers.push(this); }
    };
    window.WebSocket = class extends Socket {
      constructor(...args) {
        super(...args); window.compat.sockets.push(this);
        this.addEventListener('message', event => {
          const message = JSON.parse(event.data);
          if (message.type === 'room-state') { window.compat.state = message; window.compat.stateCount++; }
          if (message.type === 'error') window.compat.errors.push(message.code);
        });
      }
      send(data) {
        const message = JSON.parse(data);
        if (message.type === 'join') window.compat.join = message;
        return super.send(data);
      }
    };
  });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  await page.goto(`${base}/?room=${room}`);
  await page.getByPlaceholder('Введите никнейм').fill(name);
  await page.getByRole('button', { name: 'Присоединиться', exact: true }).click();
  await page.waitForFunction(() => window.compat.stateCount > 0);
  return { page, context, name };
}

async function audio(page, timeout = 12000) {
  try {
    const baseline = await page.evaluate(async () => {
      const values = {};
      for (const [index, pc] of window.compat.peers.entries()) {
        if (pc.connectionState !== 'connected') continue;
        for (const stat of (await pc.getStats()).values()) {
          if (stat.type === 'inbound-rtp' && stat.kind === 'audio') values[`${index}:${stat.id}`] = {
            bytes: stat.bytesReceived || 0, energy: stat.totalAudioEnergy || 0,
          };
        }
      }
      return values;
    });
    await page.waitForFunction(async previous => {
      for (const [index, pc] of window.compat.peers.entries()) {
        if (pc.connectionState !== 'connected') continue;
        for (const stat of (await pc.getStats()).values()) {
          const before = previous[`${index}:${stat.id}`] || { bytes: 0, energy: 0 };
          if (stat.type === 'inbound-rtp' && stat.kind === 'audio' && stat.bytesReceived > before.bytes && stat.totalAudioEnergy > before.energy) return true;
        }
      }
      return false;
    }, baseline, { timeout }); return true;
  } catch { return false; }
}

async function features(sender, receiver, label) {
  const page = sender.page;
  const input = page.getByPlaceholder(/^Сообщение в #/);
  const text = `compat-${label}`;
  await input.fill(text); await input.press('Enter');
  let chat = true;
  try { await receiver.page.getByText(text, { exact: true }).waitFor(); } catch { chat = false; }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');
  await page.locator('input[type=file]').setInputFiles({ name: 'compat.png', mimeType: 'image/png', buffer: png });
  const uploadResponse = page.waitForResponse(r => r.url().endsWith('/api/upload') && r.request().method() === 'POST');
  await input.fill(`file-${label}`); await input.press('Enter');
  const upload = await uploadResponse;
  const body = await upload.json();
  let mediaBytesMatch = false;
  if (upload.ok()) {
    const response = await receiver.page.request.get(new URL(body.url, receiver.page.url()).href);
    mediaBytesMatch = response.ok() && (await response.body()).equals(png);
  }
  const endpoints = await page.evaluate(async () => {
    const { join, state } = window.compat;
    const token = sessionStorage.getItem(`rvxis_session_${join.roomId}`);
    // Match each client's real auth behaviour without exposing the token in reports.
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const ice = await fetch(`/peerjs/ice-servers?roomId=${join.roomId}&peerId=${join.peerId}`, { headers });
    const livekit = await fetch('/peerjs/livekit/token', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ roomId: join.roomId, peerId: join.peerId, nickname: 'compat' }) });
    const data = await livekit.json();
    return { ice: ice.status, livekit: livekit.status, grantBoundToPeer: livekit.ok &&
      JSON.parse(atob(data.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub === join.peerId,
      credential: token === null ? 'absent' : /^[a-f0-9]{64}$/.test(token) ? 'valid-format' : 'invalid',
      receivedCredential: typeof state.sessionToken === 'string' };
  });
  return { chat, upload: upload.status(), mediaBytesMatch, ...endpoints };
}

async function reconnect(client) {
  const before = await client.page.evaluate(() => window.compat.stateCount);
  await client.page.evaluate(() => window.compat.sockets.find(ws => ws.readyState === 1).close());
  let joined = true;
  try { await client.page.waitForFunction(count => window.compat.stateCount > count, before, { timeout: 14000 }); } catch { joined = false; }
  return { joined, audio: joined && await audio(client.page), errors: await client.page.evaluate(() => [...new Set(window.compat.errors)]) };
}

try {
  const legacy = snapshot('legacy', legacySha), candidate = snapshot('candidate', candidateSha);
  const backends = [await backend('0.2.2', legacy), await backend('0.2.3', candidate)];
  const executablePath = process.env.RVXIS_BROWSER_EXECUTABLE;
  browser = await chromium.launch({ executablePath, channel: executablePath ? undefined : 'chromium', headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${writeMicrophone()}`] });
  for (const target of backends) {
    const urls = { old: await gateway(legacy, target), new: await gateway(candidate, target) };
    for (const pair of [['old', 'old'], ['new', 'new'], ['old', 'new']]) {
      const room = `COMPAT${cases.length}`, clients = [];
      const row = { backend: target.label, clients: pair, features: [], voice: [], reconnect: [] };
      try {
        clients.push(await client(urls[pair[0]], 'PeerOne', room));
        clients.push(await client(urls[pair[1]], 'PeerTwo', room));
        row.voice = await Promise.all(clients.map(c => audio(c.page)));
        for (let i = 0; i < clients.length; i++) row.features.push(await features(clients[i], clients[1 - i], `${cases.length}-${i}`));
        // Reconnect independently: restore one peer before disrupting the other.
        for (const c of clients) row.reconnect.push(await reconnect(c));
        row.voiceAfterReconnect = await Promise.all(clients.map(c => audio(c.page)));
      } finally { for (const c of clients) await c.context.close(); }
      cases.push(row);
      fs.writeFileSync(path.join(session, 'report.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify(row));
    }
  }
  const current = cases.find(row => row.backend === '0.2.3' && row.clients.every(c => c === 'new'));
  assert.ok(current.voice.every(Boolean), 'New/new voice must work');
  assert.ok(current.features.every(f => f.chat && f.upload === 200 && f.mediaBytesMatch && f.ice === 200 && f.livekit === 200 && f.grantBoundToPeer));
  assert.ok(current.reconnect.every(r => r.joined && r.audio));
  assert.ok(current.voiceAfterReconnect.every(Boolean));
  for (const row of cases.filter(row => row.backend === '0.2.3')) {
    for (let i = 0; i < row.clients.length; i++) {
      if (row.clients[i] !== 'old') continue;
      assert.equal(row.features[i].upload, 401);
      assert.equal(row.features[i].ice, 401);
      assert.equal(row.features[i].livekit, 401);
      assert.equal(row.reconnect[i].joined, false);
      assert.ok(row.reconnect[i].errors.includes('identity_in_use'));
    }
  }
  for (const row of cases.filter(row => row.backend === '0.2.2')) {
    assert.ok(row.voice.every(Boolean) && row.voiceAfterReconnect.every(Boolean), 'Client-first transition must preserve real audio');
    assert.ok(row.features.every(f => f.chat && f.upload === 200 && f.mediaBytesMatch && f.livekit === 200 && f.ice === 200 && f.credential === 'absent'),
      'Legacy backend must work without fake credentials');
    assert.ok(row.reconnect.every(r => r.joined && r.audio));
  }
  report.completed = true;
} finally {
  await browser?.close();
  for (const { server, wss } of gateways) {
    for (const ws of wss.clients) ws.terminate();
    await new Promise(resolve => wss.close(resolve));
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
  for (const worker of workers) {
    if (worker.exitCode !== null || worker.signalCode !== null) continue;
    const stopped = new Promise(resolve => worker.once('exit', resolve));
    worker.send('stop');
    const deadline = setTimeout(() => worker.kill(), 5000);
    await stopped; clearTimeout(deadline);
  }
  fs.writeFileSync(path.join(session, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`[Compatibility] Report: ${path.join(session, 'report.json')}`);
}
