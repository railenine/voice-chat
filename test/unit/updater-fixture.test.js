import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createFixtureSigner, assetMetadata, fixtureResponse } from '../../scripts/updater-fixture.js';
import { verifyArtifact } from '../../scripts/release-security.js';

test('disposable signatures verify with the release verifier; foreign and modified bytes fail', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rvxis-fixture-signature-'));
  const file = path.join(directory, 'test.exe');
  try {
    const signer = createFixtureSigner(), foreign = createFixtureSigner();
    const bytes = Buffer.from('MZ signed fixture payload');
    const signature = signer.sign(bytes);
    fs.writeFileSync(file, bytes);
    assert.doesNotThrow(() => verifyArtifact(file, signature, signer.encodedKey));
    assert.throws(() => verifyArtifact(file, foreign.sign(bytes), signer.encodedKey));
    fs.writeFileSync(file, Buffer.from('MZ modified fixture payload'));
    assert.throws(() => verifyArtifact(file, signature, signer.encodedKey));
    assert.deepEqual(Object.keys(signer).sort(), ['encodedKey', 'sign']);
  } finally { fs.unlinkSync(file); fs.rmdirSync(directory); }
});

test('fixture scenarios isolate localhost and make tampering reach signature verification', () => {
  const signer = createFixtureSigner(), foreign = createFixtureSigner();
  const bytes = Buffer.from('MZ original fixture bytes');
  const asset = assetMetadata('target.exe', bytes, signer);
  const metadata = { identifier: 'com.railenine.voicechat.updatertest.run0123abcd',
    target: { version: '0.2.9002', portable: asset }, foreignSignatures: { [asset.file]: foreign.sign(bytes) } };
  const original = { [asset.file]: bytes };
  const valid = fixtureResponse(metadata, original, 'valid');
  const goodAsset = valid.manifest.portable['windows-x86_64'];
  assert.equal(goodAsset.url, 'https://localhost:9443/files/target.exe');
  assert.equal(goodAsset.signature, asset.signature);
  const bad = fixtureResponse(metadata, original, 'bad-signature');
  assert.notEqual(bad.manifest.portable['windows-x86_64'].signature, asset.signature);
  assert.deepEqual(bad.payloads['/files/target.exe'], bytes);
  const tampered = fixtureResponse(metadata, original, 'tampered');
  const changed = tampered.payloads['/files/target.exe'];
  assert.notDeepEqual(changed, bytes);
  assert.equal(tampered.manifest.portable['windows-x86_64'].sha256, crypto.createHash('sha256').update(changed).digest('hex'));
  assert.equal(tampered.manifest.portable['windows-x86_64'].signature, asset.signature);
  assert.deepEqual(original[asset.file], bytes);
  assert.throws(() => fixtureResponse(metadata, original, 'unknown'));
  assert.throws(() => fixtureResponse({ ...metadata, identifier: 'com.railenine.voicechat' }, original, 'valid'));
  assert.throws(() => fixtureResponse(metadata, { [asset.file]: Buffer.from('unexpected bytes') }, 'valid'));
  assert.throws(() => assetMetadata('../production.exe', bytes, signer));
});
