import assert from 'node:assert/strict';
import { it } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

const sdk = `
export const RoomEvent = new Proxy({}, { get: (_, name) => name });
export const Track = { Source: { ScreenShare: 'screen', ScreenShareAudio: 'audio' } };
export class RemoteVideoTrack {} export class RemoteAudioTrack {} export class LocalVideoTrack {} export class LocalAudioTrack {}
export class Room {
  remoteParticipants = new Map(); events = new Map(); disconnected = 0;
  localParticipant = { trackPublications: new Map(), setName: async name => { this.name = name; } };
  constructor() { globalThis.testRooms.push(this); }
  on(name, callback) { this.events.set(name, callback); return this; }
  async connect() { await globalThis.connectBarrier; }
  disconnect() { this.disconnected++; this.events.get('Disconnected')?.(); }
}`;

it('updates the name without reconnecting LiveKit or stopping the share', async () => {
  browserEnvironment(); globalThis.testRooms = [];
  globalThis.fetch = async url => ({ ok: true, json: async () => url.endsWith('/status')
    ? { available: true } : { token: 'test-token', livekitUrl: 'wss://test.invalid' } });
  const { useScreenShare } = await loadComponent('src/hooks/useScreenShare.ts', { livekitStub: sdk });
  let renderer;
  function Probe({ name }) { useScreenShare({ roomId: 'room', peerId: 'peer', nickname: name, isJoined: true }); return null; }
  await act(async () => { renderer = create(React.createElement(Probe, { name: 'Before' })); });
  try {
    await act(async () => renderer.update(React.createElement(Probe, { name: 'After' })));
    assert.equal(testRooms.length, 1);
    assert.equal(testRooms[0].disconnected, 0);
    assert.equal(testRooms[0].name, 'After');
  } finally { await act(async () => renderer.unmount()); }
});

it('reports denied token requests as a failed connection', async () => {
  browserEnvironment(); globalThis.testRooms = [];
  globalThis.fetch = async url => ({ ok: url.endsWith('/status'), json: async () => url.endsWith('/status')
    ? { available: true } : { message: 'Access denied' } });
  const { useScreenShare } = await loadComponent('src/hooks/useScreenShare.ts', { livekitStub: sdk });
  let api, renderer;
  function Probe() { api = useScreenShare({ roomId: 'room', peerId: 'peer', nickname: 'Me', isJoined: true }); return null; }
  await act(async () => { renderer = create(React.createElement(Probe)); });
  assert.equal(api.connectionState, 'failed');
  assert.equal(api.error, 'Access denied');
  assert.equal(testRooms.length, 0);
  await act(async () => renderer.unmount());
});

it('disconnects a late SFU connection after leaving the room', async () => {
  browserEnvironment(); globalThis.testRooms = [];
  let resolveConnect;
  globalThis.connectBarrier = new Promise(resolve => { resolveConnect = resolve; });
  globalThis.fetch = async url => ({ ok: true, json: async () => url.endsWith('/status')
    ? { available: true } : { token: 'test', livekitUrl: 'wss://test.invalid' } });
  const { useScreenShare } = await loadComponent('src/hooks/useScreenShare.ts', { livekitStub: sdk });
  let renderer;
  function Probe() { useScreenShare({ roomId: 'room', peerId: 'peer', nickname: 'Me', isJoined: true }); return null; }
  await act(async () => { renderer = create(React.createElement(Probe)); });
  await act(async () => renderer.unmount());
  await act(async () => resolveConnect());
  assert.ok(testRooms[0].disconnected >= 1);
  delete globalThis.connectBarrier;
});
