import assert from 'node:assert/strict';
import { it } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

it('stops microphone tracks that arrive after the hook has unmounted', async () => {
  browserEnvironment();
  const { useLocalAudio } = await loadComponent('src/hooks/voice/useLocalAudio.ts');
  let resolveMic, stopped = 0, api;
  navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { resolveMic = resolve; });
  const track = { enabled: true, stop: () => stopped++ };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const connections = { current: new Map() };
  function Probe() { api = useLocalAudio({ peerConnectionsRef: connections }); return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(Probe)); });
  const pending = api.initLocalAudio().catch(error => error);
  await act(async () => renderer.unmount());
  resolveMic(stream);
  const result = await pending;
  assert.equal(stopped, 1);
  assert.equal(api.rawMicStreamRef.current, null);
  assert.equal(result.name, 'AbortError');
});

it('keeps the newest microphone when device requests finish out of order', async () => {
  browserEnvironment();
  const { useLocalAudio } = await loadComponent('src/hooks/voice/useLocalAudio.ts');
  const pending = [];
  navigator.mediaDevices.getUserMedia = () => new Promise(resolve => pending.push(resolve));
  const makeStream = () => {
    const track = { enabled: true, readyState: 'live', stopped: 0, stop() { this.stopped++; } };
    return { track, getAudioTracks: () => [track], getTracks: () => [track] };
  };
  let api, renderer;
  const connections = { current: new Map() };
  function Probe({ device }) { api = useLocalAudio({ audioInputDeviceId: device, peerConnectionsRef: connections }); return null; }
  await act(async () => { renderer = create(React.createElement(Probe, { device: 'one' })); });
  const initial = api.initLocalAudio(); const first = makeStream(); pending.shift()(first); await initial;
  await act(async () => renderer.update(React.createElement(Probe, { device: 'two' })));
  await act(async () => renderer.update(React.createElement(Probe, { device: 'three' })));
  const newest = makeStream(), stale = makeStream();
  await act(async () => pending[1](newest));
  await act(async () => pending[0](stale));
  assert.equal(api.rawMicStreamRef.current, newest);
  assert.equal(stale.track.stopped, 1);
  assert.equal(newest.track.stopped, 0);
  await act(async () => renderer.unmount());
});

it('cancels a pending microphone meter when its hook unmounts', async () => {
  browserEnvironment();
  const { useAudioDevices } = await loadComponent('src/hooks/useAudioDevices.ts');
  let resolveMic, stopped = 0, api, renderer;
  navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { resolveMic = resolve; });
  function Probe() { api = useAudioDevices(); return null; }
  await act(async () => { renderer = create(React.createElement(Probe)); });
  await act(async () => api.toggleMicTest());
  await act(async () => renderer.unmount());
  await act(async () => resolveMic({ getTracks: () => [{ stop: () => stopped++ }] }));
  assert.equal(stopped, 1);
});
