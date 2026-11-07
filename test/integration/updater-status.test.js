import assert from 'node:assert/strict';
import { it } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

it('reports unavailable or malformed update sources as errors, not current versions', async () => {
  browserEnvironment();
  const { useAppUpdater } = await loadComponent('src/hooks/useAppUpdater.ts');
  let api, renderer;
  function Probe() { api = useAppUpdater(); return null; }
  await act(async () => { renderer = create(React.createElement(Probe)); });
  try {
    globalThis.fetch = async () => { throw Error('Network unavailable'); };
    await act(async () => api.checkForUpdates(false));
    assert.equal(api.status, 'error');
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ version: 'invalid' }) });
    await act(async () => api.checkForUpdates(false));
    assert.equal(api.status, 'error');
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ version: '0.2.2' }) });
    await act(async () => api.checkForUpdates(false));
    assert.equal(api.status, 'up-to-date');
  } finally { await act(async () => renderer.unmount()); }
});
