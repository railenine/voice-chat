import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

test('staging desktop uses the SSH tunnel while ordinary desktop keeps production routing', async () => {
  browserEnvironment();
  window.__TAURI_INTERNALS__ = {};
  const stage = await loadComponent('src/config.ts', { viteEnv: { VITE_RVXIS_STAGING: '1' } });
  assert.equal(stage.getBackendBaseUrl(), 'http://localhost:3000');
  assert.equal(stage.getWebSocketUrl(), 'ws://localhost:3000/peerjs/ws');
  assert.equal(stage.getShareUrl('STAGING'), 'http://localhost:3000?room=STAGING');
  const release = await loadComponent('src/config.ts');
  assert.equal(release.getBackendBaseUrl(), 'https://rvxis.site');
  assert.equal(release.getWebSocketUrl(), 'wss://rvxis.site/peerjs/ws');
});

test('staging rejects checks and installation without fetching, opening releases or honoring update mocks', async () => {
  browserEnvironment();
  window.location.search = '?mock_update=true';
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw Error('No updater network expected'); };
  window.open = () => { networkCalls++; };
  window.location.reload = () => { networkCalls++; };
  const { useAppUpdater } = await loadComponent('src/hooks/useAppUpdater.ts', { viteEnv: { VITE_RVXIS_STAGING: '1' } });
  let api, renderer;
  function Probe() { api = useAppUpdater(); return null; }
  await act(async () => { renderer = create(React.createElement(Probe)); });
  try {
    assert.equal(api.status, 'idle');
    await act(async () => api.checkForUpdates(true));
    assert.match(api.error, /отключены в тестовой сборке/);
    await act(async () => api.installUpdate('portable'));
    assert.equal(api.hasAvailableUpdate, false);
    assert.equal(networkCalls, 0);
  } finally { await act(async () => renderer.unmount()); }
});
