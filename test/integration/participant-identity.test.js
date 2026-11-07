import assert from 'node:assert/strict';
import { it } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

it('retains both participants and connections when their nicknames match', async () => {
  browserEnvironment();
  let socket, api, renderer;
  const closed = [];
  globalThis.WebSocket = class {
    static OPEN = 1;
    readyState = 1;
    constructor() { socket = this; }
    send() {}
    close() { this.readyState = 3; this.onclose?.(); }
  };
  globalThis.RTCPeerConnection = class {
    connectionState = 'new';
    addTrack() {}
    close() { closed.push(this); }
  };
  const track = { enabled: true, stop() {} };
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [track], getAudioTracks: () => [track] });
  const { useVoiceChat } = await loadComponent('src/hooks/useVoiceChat.ts');
  function Probe() { api = useVoiceChat({ roomId: 'identity-room', nickname: 'Me' }); return null; }
  const message = value => socket.onmessage({ data: JSON.stringify(value) });
  await act(async () => { renderer = create(React.createElement(Probe)); });
  try {
    await act(async () => message({ type: 'room-state', peers: [{ peerId: 'first-peer', nickname: 'Alex' }], messages: [], iceServers: [], sessionToken: 'a'.repeat(64) }));
    await act(async () => message({ type: 'user-joined', peer: { peerId: 'second-peer', nickname: 'Alex' } }));
    assert.deepEqual(api.peers.map(peer => peer.peerId).sort(), ['first-peer', 'second-peer']);
    assert.equal(closed.length, 0);
  } finally { await act(async () => renderer.unmount()); }
});
