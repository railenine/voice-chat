import assert from 'node:assert/strict';
import { it } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

it('preserves manual mute across deafen and restores live mic only when previously enabled', async () => {
  browserEnvironment();
  navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
  const { useVoiceChat } = await loadComponent('src/hooks/useVoiceChat.ts');
  let api, renderer;
  function Probe() { api = useVoiceChat({ roomId: 'deafen-room', nickname: 'Test' }); return null; }
  await act(async () => { renderer = create(React.createElement(Probe)); });
  try {
    await act(async () => api.toggleMute());
    await act(async () => api.toggleDeafen());
    await act(async () => api.toggleDeafen());
    assert.equal(api.isMuted, true);
    await act(async () => api.toggleMute());
    await act(async () => api.toggleDeafen());
    await act(async () => api.toggleDeafen());
    assert.equal(api.isMuted, false);
  } finally { await act(async () => renderer.unmount()); }
});
