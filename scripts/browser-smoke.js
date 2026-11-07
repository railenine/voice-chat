import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

// Never use developer .env credentials or a production SFU in this test.
Object.assign(process.env, { NODE_ENV: 'test', DISABLE_LIVEKIT: '1',
  LIVEKIT_API_KEY: 'test-only', LIVEKIT_API_SECRET: 'test-only',
  LIVEKIT_URL: 'ws://127.0.0.1:1', COTURN_SHARED_SECRET: 'test-only',
  COTURN_PASSWORD: 'test-only', COTURN_DOMAIN: '127.0.0.1', CORS_ORIGIN: '*' });
const { server, wss } = await import('../server/index.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rvxis-browser-'));
const wav = path.join(dir, 'microphone.wav');
const samples = 48000 * 2;
const buffer = Buffer.alloc(44 + samples * 2);
buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(48000, 24); buffer.writeUInt32LE(96000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(5000 * (Math.sin(i * Math.PI * 2 * 180 / 48000) + 0.4 * Math.sin(i * Math.PI * 2 * 360 / 48000))), 44 + i * 2);
fs.writeFileSync(wav, buffer);
const executablePath = process.env.RVXIS_BROWSER_EXECUTABLE || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(file => fs.existsSync(file));
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true, args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required',
  ] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['microphone'] });
  await context.addInitScript(() => {
    localStorage.setItem('voice_chat_rnnoise', 'false');
    window.testConnections = []; window.testSockets = [];
    const Peer = window.RTCPeerConnection, Socket = window.WebSocket;
    window.RTCPeerConnection = class extends Peer {
      constructor(config) { super({ ...config, iceServers: [] }); window.testConnections.push(this); }
    };
    window.WebSocket = class extends Socket {
      constructor(...args) { super(...args); window.testSockets.push(this); }
    };
  });
  const errors = [];
  async function join() {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/?room=BROWSERTEST');
    await page.getByPlaceholder('Введите никнейм').fill('SameName');
    await page.getByRole('button', { name: 'Присоединиться', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'В комнате' }).first().waitFor();
    return page;
  }
  const first = await join(), second = await join();
  async function expectAudio(page) {
    await page.waitForFunction(async () => {
      for (const pc of window.testConnections) {
        if (pc.connectionState !== 'connected') continue;
        for (const stat of (await pc.getStats()).values()) {
          if (stat.type === 'inbound-rtp' && stat.kind === 'audio' && stat.bytesReceived > 0 && stat.totalAudioEnergy > 0) return true;
        }
      }
      return false;
    }, null, { timeout: 25000 });
  }
  await Promise.all([expectAudio(first), expectAudio(second)]);
  await first.getByRole('button', { name: 'Выключить микрофон', exact: true }).click();
  await first.getByRole('button', { name: 'Заглушить всё', exact: true }).click();
  await first.getByRole('button', { name: 'Включить звук', exact: true }).click();
  assert.equal(await first.evaluate(() => window.testConnections.filter(pc => pc.connectionState === 'connected')
    .every(pc => pc.getSenders().filter(s => s.track?.kind === 'audio').every(s => !s.track.enabled))), true);
  await first.getByRole('button', { name: 'Включить микрофон', exact: true }).click();
  const oldCount = await second.evaluate(() => window.testConnections.length);
  await second.evaluate(() => window.testSockets.find(ws => ws.readyState === WebSocket.OPEN).close());
  await second.waitForFunction(count => window.testConnections.length > count, oldCount, { timeout: 20000 });
  await Promise.all([expectAudio(first), expectAudio(second)]);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ browser: browser.version(), checks: ['two real peers with identical nicknames', 'bidirectional RTP bytes and audio energy', 'manual mute survives deafen', 'WebSocket reconnect restores real audio'], passed: true }));
} finally {
  await browser?.close();
  for (const ws of wss.clients) ws.terminate();
  await new Promise(resolve => wss.close(resolve));
  await new Promise(resolve => server.close(resolve));
  fs.unlinkSync(wav); fs.rmdirSync(dir);
}
