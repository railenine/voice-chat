import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

test('external-link confirmation opens HTTPS synchronously before closing the modal', async () => {
  browserEnvironment();
  const events = [];
  window.open = (...args) => { events.push(['open', ...args]); return null; };
  const { ExternalLinkModal } = await loadComponent('src/components/ExternalLinkModal.tsx');
  let renderer;
  await act(async () => { renderer = create(React.createElement(ExternalLinkModal, {
    url: 'https://example.com/path?q=hello', onClose: () => events.push(['close']),
  })); });
  try {
    const button = renderer.root.findAllByType('button').find(button =>
      button.findAll(node => node.children.includes('Перейти на сайт')).length > 0);
    assert.ok(button);
    button.props.onClick();
    assert.deepEqual(events, [
      ['open', 'https://example.com/path?q=hello', '_blank', 'noopener,noreferrer'], ['close'],
    ]);
  } finally { await act(async () => renderer.unmount()); }
});

test('external URL opener rejects executable and local schemes', async () => {
  browserEnvironment();
  const opened = [];
  window.open = (...args) => opened.push(args);
  const { openExternalUrl } = await loadComponent('src/utils/chatMediaUtils.ts');
  for (const url of ['javascript:alert(1)', 'data:text/html,example', 'file:///example', 'not a URL']) {
    openExternalUrl(url);
  }
  assert.deepEqual(opened, []);
});
