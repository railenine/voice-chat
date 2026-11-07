import assert from 'node:assert/strict';
import { it } from 'node:test';
import { EventEmitter } from 'node:events';
import { createUploadGate } from '../../server/resourceLimits.js';

it('rejects excess uploads before parsing and releases each reservation exactly once', () => {
  let parsed = 0;
  const gate = createUploadGate({ maxConcurrent: 1, authorize: req => req.authorized, rateLimit: () => true });
  const request = authorized => Object.assign(new EventEmitter(), { authorized, socket: {}, setTimeout() {} });
  const response = () => Object.assign(new EventEmitter(), { status(code) { this.code = code; return this; }, json() { return this; } });
  const a = request(true), ar = response(); gate(a, ar, () => parsed++);
  const br = response(); gate(request(true), br, () => parsed++);
  assert.equal(parsed, 1); assert.equal(br.code, 429);
  ar.emit('finish'); ar.emit('close'); a.emit('aborted');
  const c = request(true), cr = response(); gate(c, cr, () => parsed++);
  assert.equal(parsed, 2);
  const denied = response(); gate(request(false), denied, () => parsed++);
  assert.equal(denied.code, 401);
  const dr = response(); gate(request(true), dr, () => parsed++);
  assert.equal(dr.code, 429);
  c.emit('aborted');
  gate(request(true), response(), () => parsed++);
  assert.equal(parsed, 3);
});
