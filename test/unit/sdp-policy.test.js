import assert from 'node:assert/strict';
import { it } from 'node:test';
import { optimizeAudioSdp } from '../../src/utils/sdp.ts';

it('replaces exact Opus keys without corrupting sprop-stereo and is idempotent', () => {
  const input = 'a=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;stereo=1;sprop-stereo=1;useinbandfec=0\r\n';
  const result = optimizeAudioSdp(input);
  assert.equal(result.includes('sprop-;'), false);
  assert.equal(result.includes('minptime=10'), true);
  assert.equal((result.match(/sprop-stereo=/g) || []).length, 1);
  assert.equal(optimizeAudioSdp(result), result);
});
