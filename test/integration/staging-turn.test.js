import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readStaticTurnCredentials, readLiveKitCredentials } from '../../scripts/staging-turn-config.js';

test('staging reads only static TURN fields without executing or returning other secrets', () => {
  const result = readStaticTurnCredentials('LIVEKIT_API_SECRET=not-for-staging\nCOTURN_USER="test-user"\nCOTURN_PASSWORD=\'literal-$value=123#abc\'\nPORT=3000');
  assert.deepEqual(result, { COTURN_USER: 'test-user', COTURN_PASSWORD: 'literal-$value=123#abc' });
});

test('staging refuses missing or ambiguous static credentials', () => {
  assert.throws(() => readStaticTurnCredentials('COTURN_USER=test-user'), /missing/);
  assert.throws(() => readStaticTurnCredentials('COTURN_USER=one\nCOTURN_USER=two\nCOTURN_PASSWORD=test-only'), /Duplicate/);
});

test('relay probe forces policy on construction/reconfiguration and reports actual media routing without secrets', async () => {
  class FakePeer {
    connectionState = 'connected';
    localType = 'relay';
    relayProtocol = 'udp';
    constructor(configuration) { this.configuration = configuration; }
    setConfiguration(configuration) { this.configuration = configuration; }
    getConfiguration() { return this.configuration; }
    async getStats() { return new Map([
      ['transport', { type: 'transport', selectedCandidatePairId: 'pair' }],
      ['pair', { type: 'candidate-pair', localCandidateId: 'local', remoteCandidateId: 'remote' }],
      ['local', { candidateType: this.localType, protocol: 'udp', relayProtocol: this.relayProtocol, address: 'not-for-report' }],
      ['remote', { candidateType: 'relay', address: 'not-for-report' }],
      ['in', { type: 'inbound-rtp', kind: 'audio', bytesReceived: 123 }],
      ['out', { type: 'outbound-rtp', kind: 'audio', bytesSent: 456 }],
    ]); }
  }
  const window = { RTCPeerConnection: FakePeer };
  vm.runInNewContext(fs.readFileSync(new URL('../../scripts/staging-relay-probe.js', import.meta.url), 'utf8'),
    { window, URL, URLSearchParams, console: { info() {} } });
  const peer = new window.RTCPeerConnection({ iceTransportPolicy: 'all', iceServers: [{ credential: 'not-for-report' }] });
  assert.equal(peer.getConfiguration().iceTransportPolicy, 'relay');
  peer.setConfiguration({ iceTransportPolicy: 'all', iceServers: [{ credential: 'not-for-report' }] });
  assert.equal(peer.getConfiguration().iceTransportPolicy, 'relay');
  let report = await window.rvxTurnReport();
  assert.equal(report[0].passed, true);
  assert.equal(JSON.stringify(report).includes('not-for-report'), false);
  peer.localType = 'host';
  report = await window.rvxTurnReport();
  assert.equal(report[0].passed, false);
  peer.connectionState = 'closed';
  assert.equal((await window.rvxTurnReport()).length, 0);
  const urls = ['stun:rvxis.site:3478', 'turn:rvxis.site:3478?transport=udp',
    'turn:rvxis.site:3478?transport=tcp', 'turns:rvxis.site:5349?transport=tcp'];
  for (const [profile, expected] of [['udp', urls[1]], ['tcp', urls[2]], ['tls', urls[3]]]) {
    const isolated = { RTCPeerConnection: FakePeer, location: { search: `?turn=${profile}` } };
    vm.runInNewContext(fs.readFileSync(new URL('../../scripts/staging-relay-probe.js', import.meta.url), 'utf8'),
      { window: isolated, URL, URLSearchParams, console: { info() {} } });
    const config = { iceServers: [{ urls, credential: 'not-for-report' }] };
    const pc = new isolated.RTCPeerConnection(config);
    assert.equal(JSON.stringify(pc.getConfiguration().iceServers[0].urls), JSON.stringify([expected]));
    pc.setConfiguration(config);
    assert.equal(JSON.stringify(pc.getConfiguration().iceServers[0].urls), JSON.stringify([expected]));
    if (profile !== 'udp') assert.equal((await isolated.rvxTurnReport())[0].passed, false);
    pc.relayProtocol = profile;
    assert.equal((await isolated.rvxTurnReport())[0].passed, true);
  }
});

test('TURN entry refuses a non-loopback launch before reading production credentials', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/staging-turn.js', import.meta.url))], {
    env: { ...process.env, HOST: '0.0.0.0', PORT: '3102', DISABLE_LIVEKIT: '1' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /isolated test/);
});

test('LiveKit staging loads only its required fields and rejects unsafe endpoints', () => {
  const content = 'LIVEKIT_URL=wss://livekit.example.test\nLIVEKIT_API_KEY=test-only\nLIVEKIT_API_SECRET=test-only-secret\nOTHER_SECRET=not-for-staging';
  assert.deepEqual(readLiveKitCredentials(content), { LIVEKIT_URL: 'wss://livekit.example.test',
    LIVEKIT_API_KEY: 'test-only', LIVEKIT_API_SECRET: 'test-only-secret' });
  for (const url of ['http://livekit.example.test', 'wss://user:password@livekit.example.test',
    'https://livekit.example.test?token=not-for-staging']) {
    assert.throws(() => readLiveKitCredentials(content.replace('wss://livekit.example.test', url)), /HTTPS\/WSS/);
  }
  assert.throws(() => readLiveKitCredentials('LIVEKIT_URL=wss://livekit.example.test'), /missing/);
});

test('LiveKit entry refuses non-loopback execution before reading credentials', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/staging-livekit.js', import.meta.url))], {
    env: { ...process.env, HOST: '0.0.0.0', PORT: '3102', DISABLE_LIVEKIT: '1' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /isolated test/);
});
