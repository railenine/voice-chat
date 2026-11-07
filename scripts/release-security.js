import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function readArtifactSignature(file) {
  const value = fs.readFileSync(`${file}.sig`, 'utf8').trim();
  // Tauri .sig is already base64. Also accept raw Minisign text from tooling.
  return value.startsWith('untrusted comment:') ? Buffer.from(value).toString('base64') : value;
}

export function verifyArtifact(file, signature, encodedKey) {
  const keyText = Buffer.from(encodedKey.trim(), 'base64').toString('utf8');
  const key = Buffer.from(keyText.trim().split(/\r?\n/)[1] || '', 'base64');
  const lines = Buffer.from(signature, 'base64').toString('utf8').trim().split(/\r?\n/);
  const sig = Buffer.from(lines[1] || '', 'base64');
  const globalSig = Buffer.from(lines[3] || '', 'base64');
  if (key.length !== 42 || sig.length !== 74 || sig[0] !== 69 || sig[1] !== 68 ||
      !key.subarray(2, 10).equals(sig.subarray(2, 10)) || !lines[2]?.startsWith('trusted comment: ')) {
    throw new Error('Missing, foreign or unsupported artifact signature');
  }
  const publicKey = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.subarray(10)]), format: 'der', type: 'spki' });
  const digest = crypto.createHash('blake2b512').update(fs.readFileSync(file)).digest();
  const trusted = Buffer.from(lines[2].slice('trusted comment: '.length));
  if (!crypto.verify(null, digest, publicKey, sig.subarray(10)) ||
      !crypto.verify(null, Buffer.concat([sig.subarray(10), trusted]), publicKey, globalSig)) {
    throw new Error('Artifact signature verification failed');
  }
}

export function signArtifact(file, keyPath, password, version, encodedKey) {
  if (keyPath) {
    const cli = path.resolve('node_modules/@tauri-apps/cli/tauri.js');
    // Arguments are never interpolated into shell text or echoed on failure.
    try {
      execFileSync(process.execPath, [cli, 'signer', 'sign', '-f', keyPath, '--password', password ?? '', '--app-version', version, file], { stdio: 'ignore' });
    } catch { throw new Error('Signing failed; release aborted'); }
  }
  const signature = readArtifactSignature(file);
  verifyArtifact(file, signature, encodedKey);
  return signature;
}

export function validateReleaseAssets(manifest) {
  for (const asset of [manifest.platforms?.['windows-x86_64'], manifest.portable?.['windows-x86_64']]) {
    if (!asset || !asset.signature || !/^[a-f0-9]{64}$/.test(asset.sha256 || '') ||
        !Number.isSafeInteger(asset.size) || asset.size <= 0 || !asset.url?.startsWith('https://')) {
      throw new Error('Release requires signed HTTPS assets with size and SHA-256');
    }
  }
  return true;
}
