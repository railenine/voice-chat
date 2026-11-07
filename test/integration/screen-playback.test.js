import assert from 'node:assert/strict';
import { it } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

it('keeps the current audio attached when the stream list refreshes', async () => {
  browserEnvironment();
  const { ScreenShareView } = await loadComponent('src/components/ScreenShareView.tsx');
  let attaches = 0, detaches = 0, volume = -1;
  const noop = () => {};
  const audioTrack = { attach() { attaches++; }, detach() { detaches++; }, setVolume(v) { volume = v; } };
  const videoTrack = { attach: noop, detach: noop };
  const stream = { participantId: 'alice', participantName: 'Alice', videoTrack, audioTrack, hasAudio: true };
  const props = { activeStreams: [stream], localVideoTrack: null, localAudioTrack: null, isSharing: false,
    myNickname: 'Me', watchedPeerId: 'alice', onStopSharing: noop, onCloseView: noop,
    onSelectStream: noop, streamVolumes: {}, onVolumeChange: noop };
  let renderer;
  await act(async () => { renderer = create(React.createElement(ScreenShareView, props), {
    createNodeMock: () => ({ play: async () => {}, pause: noop, load: noop, removeAttribute: noop }),
  }); });
  try {
    assert.equal(attaches, 1);
    await act(async () => renderer.update(React.createElement(ScreenShareView, { ...props, activeStreams: [{ ...stream }] })));
    assert.equal(detaches, 0);
    assert.equal(attaches, 1);
    assert.equal(volume, 1);
    await act(async () => renderer.update(React.createElement(ScreenShareView, { ...props, isDeafened: true })));
    assert.equal(volume, 0);
    await act(async () => renderer.update(React.createElement(ScreenShareView, { ...props, isDeafened: true, streamVolumes: { alice: 50 } })));
    assert.equal(volume, 0);
    await act(async () => renderer.update(React.createElement(ScreenShareView, { ...props, isDeafened: false, streamVolumes: { alice: 50 } })));
    assert.equal(volume, 0.5);
    assert.equal(attaches, 1);
  } finally { await act(async () => renderer.unmount()); }
  assert.equal(detaches, 1);
});
