import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

test('manual updater check stays visible on first open, rapid status changes and reopen', async t => {
  browserEnvironment();
  window.__TAURI_INTERNALS__ = {};
  const { UpdateModal } = await loadComponent('src/components/UpdateModal.tsx');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const props = { isOpen: false, status: 'idle', updateInfo: null, downloadProgress: 0,
    downloadedBytes: 0, totalBytes: 0, error: null, onClose() {}, onInstall() {}, onCheckAgain() {} };
  let renderer;
  const render = patch => act(() => {
    Object.assign(props, patch);
    if (renderer) renderer.update(React.createElement(UpdateModal, props));
    else renderer = TestRenderer.create(React.createElement(UpdateModal, props));
  });
  const visible = () => assert.equal(renderer.root.findAll(node => typeof node.type === 'string' &&
    String(node.props.className || '').split(/\s+/).includes('opacity-0')).length, 0, 'Updater content must not remain transparent');
  try {
    render({});
    render({ isOpen: true, status: 'checking' });
    act(() => t.mock.timers.tick(1000));
    visible();
    assert.match(JSON.stringify(renderer.toJSON()), /Проверяем наличие свежих версий/);
    // A quick check can return to the already displayed state before fade-out ends.
    render({ status: 'available', updateInfo: { version: '0.2.3', currentVersion: '0.2.2' } });
    act(() => t.mock.timers.tick(50));
    render({ status: 'checking' });
    act(() => t.mock.timers.tick(1000));
    visible();
    render({ status: 'available' });
    act(() => t.mock.timers.tick(1000));
    visible();
    assert.match(JSON.stringify(renderer.toJSON()), /Обновить сейчас/);
    render({ status: 'checking' });
    render({ isOpen: false });
    render({ isOpen: true, status: 'error', error: 'Test update failure' });
    act(() => t.mock.timers.tick(1000));
    visible();
    assert.match(JSON.stringify(renderer.toJSON()), /Test update failure/);
  } finally { act(() => renderer?.unmount()); }
});

test('an already mounted checking dialog recovers if overlapping checks return to checking', async t => {
  browserEnvironment();
  const { UpdateModal } = await loadComponent('src/components/UpdateModal.tsx');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const props = { isOpen: true, status: 'checking', updateInfo: null, downloadProgress: 0,
    downloadedBytes: 0, totalBytes: 0, error: null, onClose() {}, onInstall() {}, onCheckAgain() {} };
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(UpdateModal, props)); });
  try {
    act(() => renderer.update(React.createElement(UpdateModal, { ...props, status: 'available' })));
    act(() => t.mock.timers.tick(50));
    act(() => renderer.update(React.createElement(UpdateModal, props)));
    act(() => t.mock.timers.tick(1000));
    assert.equal(renderer.root.findAll(node => typeof node.type === 'string' &&
      String(node.props.className || '').split(/\s+/).includes('opacity-0')).length, 0);
    assert.match(JSON.stringify(renderer.toJSON()), /Проверяем наличие свежих версий/);
  } finally { act(() => renderer.unmount()); }
});
