import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readStaticTurnCredentials } from '../../scripts/staging-turn-config.js';

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
    constructor(configuration) { this.configuration = configuration; }
    setConfiguration(configuration) { this.configuration = configuration; }
    getConfiguration() { return this.configuration; }
    async getStats() { return new Map([
      ['transport', { type: 'transport', selectedCandidatePairId: 'pair' }],
      ['pair', { type: 'candidate-pair', localCandidateId: 'local', remoteCandidateId: 'remote' }],
      ['local', { candidateType: this.localType, protocol: 'udp', relayProtocol: 'udp', address: 'not-for-report' }],
      ['remote', { candidateType: 'relay', address: 'not-for-report' }],
      ['in', { type: 'inbound-rtp', kind: 'audio', bytesReceived: 123 }],
      ['out', { type: 'outbound-rtp', kind: 'audio', bytesSent: 456 }],
    ]); }
  }
  const window = { RTCPeerConnection: FakePeer };
  vm.runInNewContext(fs.readFileSync(new URL('../../scripts/staging-relay-probe.js', import.meta.url), 'utf8'),
    { window, console: { info() {} } });
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
});

test('TURN entry refuses a non-loopback launch before reading production credentials', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/staging-turn.js', import.meta.url))], {
    env: { ...process.env, HOST: '0.0.0.0', PORT: '3102', DISABLE_LIVEKIT: '1' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /isolated test/);
});
