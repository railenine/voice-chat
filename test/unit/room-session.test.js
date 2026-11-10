import assert from 'node:assert/strict';
import { it } from 'node:test';
import { getRoomToken, setRoomToken, roomAuthorization } from '../../src/utils/roomSession.ts';

it('handles legacy room-state without saving undefined as a credential', () => {
  const previous = globalThis.sessionStorage;
  const values = new Map();
  globalThis.sessionStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  try {
    const room = 'legacy-token-test', key = `rvxis_session_${room}`, token = 'a'.repeat(64);
    setRoomToken(room, token);
    assert.equal(getRoomToken(room), token);
    assert.deepEqual(roomAuthorization(room), { Authorization: `Bearer ${token}` });
    setRoomToken(room, undefined);
    assert.equal(values.has(key), false);
    assert.equal(getRoomToken(room), '');
    assert.deepEqual(roomAuthorization(room), {});
    for (const invalid of ['undefined', 'null', '', 'invalid', null, 123]) {
      setRoomToken(room, invalid);
      assert.equal(getRoomToken(room), '');
    }
    values.set('rvxis_session_stale-storage', 'undefined');
    assert.equal(getRoomToken('stale-storage'), '');
    assert.equal(values.has('rvxis_session_stale-storage'), false);
    globalThis.sessionStorage = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }, removeItem() { throw Error('denied'); } };
    setRoomToken('storage-unavailable', token);
    assert.equal(getRoomToken('storage-unavailable'), token);
    setRoomToken('storage-unavailable', undefined);
    assert.equal(getRoomToken('storage-unavailable'), '');
  } finally { globalThis.sessionStorage = previous; }
});
