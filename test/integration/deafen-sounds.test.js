import test from 'node:test';
import assert from 'node:assert/strict';
import { browserEnvironment, loadComponent } from '../helpers/components.js';

test('deafen transition cues stay audible while ordinary scheduled sounds stay muted', async () => {
  browserEnvironment();
  const nodes = [];
  let oscillatorCount = 0;
  const audio = { muted: false, paused: false, style: {}, setAttribute() {} };
  document.createElement = () => audio;
  document.body = { appendChild() {} };
  class FakeContext {
    state = 'running';
    currentTime = 0;
    destination = { kind: 'hardware' };
    createGain() {
      const node = { context: this, targets: [], gain: { value: 1,
        setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect(target) { this.targets.push(target); } };
      nodes.push(node);
      return node;
    }
    createMediaStreamDestination() { return { context: this, kind: 'media', stream: {} }; }
    createOscillator() {
      oscillatorCount++;
      return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} };
    }
  }
  window.AudioContext = FakeContext;
  const sfx = await loadComponent('src/utils/soundEffects.ts');
  await sfx.playJoinSound();
  const ordinaryRoute = nodes.find(node => node.targets.some(target => target.kind === 'media'));
  assert.ok(ordinaryRoute);
  sfx.setSoundMuted(true);
  assert.equal(ordinaryRoute.gain.value, 0, 'already scheduled ordinary sounds are silenced');
  const before = oscillatorCount;
  await sfx.playJoinSound();
  assert.equal(oscillatorCount, before, 'join notifications remain blocked');
  await sfx.playDeafenSound();
  assert.ok(oscillatorCount > before, 'deafen confirmation is generated while deafened');
  const deafenCount = oscillatorCount;
  await sfx.playUndeafenSound();
  assert.ok(oscillatorCount > deafenCount, 'undeafen confirmation does not depend on React effect timing');
  assert.equal(audio.muted, false, 'transition cues can reach the selected output');
  assert.equal(ordinaryRoute.gain.value, 0, 'transition cues never reopen ordinary sounds');
  sfx.setSoundMuted(false);
  assert.equal(ordinaryRoute.gain.value, 1);
  const restored = oscillatorCount;
  await sfx.playJoinSound();
  assert.ok(oscillatorCount > restored);
});
