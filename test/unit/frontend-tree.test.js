import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frontendAssets, validateFrontendMime } from '../../scripts/frontend-tree.js';

test('frontend verification checks local JS and CSS, rejecting HTML fallback MIME', () => {
  const assets = frontendAssets('<script src="/assets/a.js"></script><link href="/assets/a.css?v=1"><script src="https://elsewhere.test/x.js"></script>', 'https://rvxis.site/');
  assert.equal(assets.length, 2); assert.equal(assets[0].relative, 'assets/a.js'); assert.equal(assets[1].css, true);
  assert.doesNotThrow(() => validateFrontendMime('application/javascript; charset=utf-8', false));
  assert.doesNotThrow(() => validateFrontendMime('text/css', true));
  assert.throws(() => validateFrontendMime('text/html', false));
  assert.throws(() => validateFrontendMime('text/html', true));
  assert.throws(() => frontendAssets('<p>No application entrypoint</p>', 'https://rvxis.site/'));
});
