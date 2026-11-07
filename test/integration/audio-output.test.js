import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

test('chat video follows the selected speaker on mount and while already open', async () => {
  browserEnvironment();
  const calls = [];
  const video = { setSinkId: async id => calls.push(id) };
  const { MediaViewerModal } = await loadComponent('src/components/MediaViewerModal.tsx');
  const props = { item: { url: 'https://example.com/video.mp4', type: 'video' }, onClose() {}, audioOutputDeviceId: 'headset' };
  let renderer;
  await act(async () => { renderer = create(React.createElement(MediaViewerModal, props), {
    createNodeMock: node => node.type === 'video' ? video : null,
  }); });
  try {
    assert.deepEqual(calls, ['headset']);
    await act(async () => renderer.update(React.createElement(MediaViewerModal, { ...props, audioOutputDeviceId: 'speakers', isDeafened: true })));
    assert.deepEqual(calls, ['headset', 'speakers']);
    assert.equal(renderer.root.findByType('video').props.muted, true);
  } finally { await act(async () => renderer.unmount()); }
});

test('voice updates the active audio element instead of following the Windows default', async () => {
  browserEnvironment();
  const { useRemoteAudio } = await loadComponent('src/hooks/voice/useRemoteAudio.ts');
  const calls = [];
  let api, renderer;
  const props = { getAudioContext: () => null, peersInfoRef: { current: new Map() },
    isDeafenedRef: { current: false }, registerRemoteAnalyser() {}, removeRemotePeerActivity() {}, setNeedsAudioUnlock() {} };
  function Probe({ output }) { api = useRemoteAudio({ ...props, audioOutputDeviceId: output }); return null; }
  await act(async () => { renderer = create(React.createElement(Probe, { output: 'headset' })); });
  api.audioElementsRef.current.set('peer', { srcObject: {}, play: async () => {}, setSinkId: async id => calls.push(id), remove() {} });
  try {
    await act(async () => renderer.update(React.createElement(Probe, { output: 'speakers' })));
    assert.deepEqual(calls, ['speakers']);
    await act(async () => renderer.update(React.createElement(Probe, { output: 'communications' })));
    assert.deepEqual(calls, ['speakers', 'communications']);
  } finally { await act(async () => renderer.unmount()); }
});

test('output switching is serialized and failures are reported without a default fallback', async () => {
  const { applyAudioOutput, subscribeAudioOutputErrors } = await loadComponent('src/utils/audioOutput.ts');
  const calls = [], releases = [], errors = [];
  const unsubscribe = subscribeAudioOutputErrors(message => errors.push(message));
  const target = { sinkId: '', setSinkId(id) {
    calls.push(id);
    return new Promise(resolve => releases.push(() => { this.sinkId = id; resolve(); }));
  } };
  try {
    const first = applyAudioOutput(target, 'headset');
    const second = applyAudioOutput(target, 'speakers');
    assert.deepEqual(calls, ['headset']);
    releases.shift()(); await first;
    await Promise.resolve();
    assert.deepEqual(calls, ['headset', 'speakers']);
    releases.shift()(); assert.equal(await second, true);
    assert.equal(target.sinkId, 'speakers');
    const rejected = { setSinkId: async id => { calls.push(id); throw new DOMException('denied', 'NotAllowedError'); } };
    assert.equal(await applyAudioOutput(rejected, 'blocked-device'), false);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /не разрешил/);
    assert.equal(calls.at(-1), 'blocked-device');
    assert.equal(calls.includes(''), false);
  } finally { unsubscribe(); }
});

test('a denied output selection is visible and does not replace the saved device', async () => {
  browserEnvironment();
  localStorage.setItem('voice_chat_audio_output', 'headset');
  navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'audiooutput', deviceId: 'headset', label: 'Headset' }];
  document.createElement = () => ({ setSinkId: async () => { throw new DOMException('denied', 'NotAllowedError'); } });
  const { useAudioDevices } = await loadComponent('src/hooks/useAudioDevices.ts');
  let api, renderer;
  function Probe() { api = useAudioDevices(); return null; }
  await act(async () => { renderer = create(React.createElement(Probe)); });
  try {
    await act(async () => api.setSelectedOutput('blocked-device'));
    assert.equal(api.selectedOutput, 'headset');
    assert.equal(localStorage.getItem('voice_chat_audio_output'), 'headset');
    assert.match(api.outputError, /не разрешил/);
  } finally { await act(async () => renderer.unmount()); }
});

test('the newest validated speaker wins when separate selections finish out of order', async () => {
  browserEnvironment();
  const releases = [];
  document.createElement = () => ({ setSinkId: () => new Promise((resolve, reject) => releases.push({ resolve, reject })) });
  const { useAudioDevices } = await loadComponent('src/hooks/useAudioDevices.ts');
  let api, renderer;
  function Probe() { api = useAudioDevices(); return null; }
  await act(async () => { renderer = create(React.createElement(Probe)); });
  try {
    const old = api.setSelectedOutput('headset'), recent = api.setSelectedOutput('speakers');
    await act(async () => { releases[1].resolve(); await recent; });
    await act(async () => { releases[0].reject(new DOMException('denied', 'NotAllowedError')); await old; });
    assert.equal(api.selectedOutput, 'speakers');
    assert.equal(localStorage.getItem('voice_chat_audio_output'), 'speakers');
    assert.equal(api.outputError, null, 'an obsolete rejection must not overwrite a newer successful choice');
  } finally { await act(async () => renderer.unmount()); }
});
