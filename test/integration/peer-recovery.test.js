import assert from 'node:assert/strict';
import { it } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

it('does not resurrect connections after rebuild followed by leaving', async () => {
  browserEnvironment(); let negotiations = 0, api, renderer;
  globalThis.RTCPeerConnection = class {
    connectionState = 'new';
    addTrack() {}
    close() { this.connectionState = 'closed'; }
    async setLocalDescription() { negotiations++; }
  };
  const { usePeerConnections } = await loadComponent('src/hooks/voice/usePeerConnections.ts');
  const connections = { current: new Map() };
  const props = { myPeerIdRef: { current: 'local' }, streamRef: { current: null }, peerConnectionsRef: connections,
    sendWsMessage() {}, handleRemoteStream() {}, teardownPeerAudioGraph() {}, cleanupRemotePeerAudio() {}, removeParticipant() {}, onPeerState() {} };
  function Probe() { api = usePeerConnections(props); return null; }
  await act(async () => { renderer = create(React.createElement(Probe)); });
  api.getOrCreatePeerConnection('remote');
  api.rebuildPeer('remote', true);
  api.clearAllPeerConnections();
  await new Promise(resolve => setTimeout(resolve, 80));
  try { assert.equal(connections.current.size, 0); assert.equal(negotiations, 0); }
  finally { api.clearAllPeerConnections(); await act(async () => renderer.unmount()); }
});

it('serializes incoming SDP and cancels queued work when leaving', async () => {
  browserEnvironment(); let api, renderer, release, active = 0, maximum = 0, calls = 0, deferNext = true;
  const sent = [];
  globalThis.RTCPeerConnection = class {
    connectionState = 'new'; signalingState = 'stable'; remoteDescription = null;
    close() { this.connectionState = 'closed'; }
    async setRemoteDescription(description) {
      calls++; active++; maximum = Math.max(maximum, active);
      if (deferNext) { deferNext = false; await new Promise(resolve => { release = resolve; }); }
      this.remoteDescription = description; active--;
    }
    async setLocalDescription() { this.localDescription = { type: 'answer', sdp: '' }; }
  };
  const { usePeerConnections } = await loadComponent('src/hooks/voice/usePeerConnections.ts');
  const connections = { current: new Map() };
  const props = { myPeerIdRef: { current: 'local' }, streamRef: { current: null }, peerConnectionsRef: connections,
    sendWsMessage(message) { sent.push(message); }, handleRemoteStream() {}, teardownPeerAudioGraph() {}, cleanupRemotePeerAudio() {}, removeParticipant() {}, onPeerState() {} };
  function Probe() { api = usePeerConnections(props); return null; }
  await act(async () => { renderer = create(React.createElement(Probe)); });
  const offer = { description: { type: 'offer', sdp: 'test' } };
  try {
    const first = api.handleSignal('remote', offer), second = api.handleSignal('remote', offer);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1); release(); await Promise.all([first, second]);
    assert.equal(maximum, 1); assert.equal(calls, 2);
    deferNext = true;
    const third = api.handleSignal('remote', offer), fourth = api.handleSignal('remote', offer);
    await new Promise(resolve => setImmediate(resolve));
    api.clearAllPeerConnections(); const count = sent.length; release();
    await Promise.all([third, fourth]);
    assert.equal(calls, 3); assert.equal(sent.length, count); assert.equal(connections.current.size, 0);
  } finally { api.clearAllPeerConnections(); await act(async () => renderer.unmount()); }
});
