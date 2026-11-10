import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

async function setup() {
  browserEnvironment();
  const releases = [];
  document.body = { appendChild() {} };
  document.createElement = () => ({
    style: {}, sinkId: '', paused: true, plays: [],
    setAttribute() {}, remove() {},
    setSinkId(id) { return new Promise(resolve => releases.push(() => { this.sinkId = id; resolve(); })); },
    async play() {
      this.plays.push({ sinkId: this.sinkId, stream: this.srcObject });
      if (this.sinkId !== 'saved-headset' || !this.srcObject) throw new DOMException('output not ready', 'AbortError');
      this.paused = false;
    },
  });
  const track = { id: 'remote-track', readyState: 'live', enabled: true };
  const stream = { id: 'remote-stream', getAudioTracks: () => [track] };
  const { useRemoteAudio } = await loadComponent('src/hooks/voice/useRemoteAudio.ts');
  let api, renderer;
  function Probe() {
    api = useRemoteAudio({ getAudioContext: () => null, peersInfoRef: { current: new Map() },
      isDeafenedRef: { current: false }, audioOutputDeviceId: 'saved-headset',
      registerRemoteAnalyser() {}, removeRemotePeerActivity() {}, setNeedsAudioUnlock() {} });
    return null;
  }
  await act(async () => { renderer = create(React.createElement(Probe)); });
  await act(async () => api.handleRemoteStream('peer', stream));
  return { api, renderer, releases, stream };
}

test('initial voice waits for the saved sink after attaching its stream before playback', async () => {
  const { api, renderer, releases, stream } = await setup();
  const main = api.audioElementsRef.current.get('peer');
  const primer = api.peerPrimerAudioRef.current.get('peer');
  try {
    assert.equal(main.srcObject, stream);
    assert.equal(main.autoplay, false, 'native autoplay must not bypass device initialization');
    assert.equal(primer.autoplay, false);
    assert.equal(main.plays.length, 0, 'main playback must wait for asynchronous device initialization');
    assert.equal(primer.plays.length, 0, 'muted WebRTC primer must use the same initialized device');
    await act(async () => { for (const release of releases.splice(0)) release(); });
    assert.deepEqual(main.plays, [{ sinkId: 'saved-headset', stream }]);
    assert.deepEqual(primer.plays, [{ sinkId: 'saved-headset', stream }]);
    assert.equal(primer.muted, true);
  } finally { await act(async () => renderer.unmount()); }
});

test('leaving during initial sink selection cannot start a disposed voice element', async () => {
  const { api, renderer, releases } = await setup();
  const main = api.audioElementsRef.current.get('peer');
  const primer = api.peerPrimerAudioRef.current.get('peer');
  await act(async () => renderer.unmount());
  await act(async () => { for (const release of releases.splice(0)) release(); });
  assert.equal(main.plays.length, 0);
  assert.equal(primer.plays.length, 0);
});
