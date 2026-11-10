import crypto from 'node:crypto';

export const FIXTURE_ORIGIN = 'https://localhost:9443';
export const FIXTURE_SCENARIOS = ['bad-signature', 'tampered', 'valid'];

// Disposable test signer. Its private key exists only in this process, never in
// an executable, metadata, repository, log or artifact directory.
export function createFixtureSigner() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const id = crypto.randomBytes(8);
  const rawPublic = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const encodedKey = Buffer.from(`untrusted comment: RVxis disposable updater test key\n${Buffer.concat([
    Buffer.from('Ed'), id, rawPublic,
  ]).toString('base64')}\n`).toString('base64');
  return { encodedKey, sign(bytes) {
    const signature = crypto.sign(null, crypto.createHash('blake2b512').update(bytes).digest(), privateKey);
    const trusted = 'RVxis local updater fixture';
    const globalSignature = crypto.sign(null, Buffer.concat([signature, Buffer.from(trusted)]), privateKey);
    return Buffer.from(`untrusted comment: disposable fixture signature\n${Buffer.concat([
      Buffer.from('ED'), id, signature,
    ]).toString('base64')}\ntrusted comment: ${trusted}\n${globalSignature.toString('base64')}\n`).toString('base64');
  } };
}

export function assetMetadata(file, bytes, signer) {
  if (file !== file.split(/[\\/]/).pop() || !/^[a-zA-Z0-9_.-]+\.exe$/.test(file)) throw new Error('Unsafe fixture filename');
  return { file, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), signature: signer.sign(bytes) };
}

export function fixtureResponse(metadata, original, scenario) {
  if (!FIXTURE_SCENARIOS.includes(scenario)) throw new Error('Unknown fixture scenario');
  if (!/^com\.railenine\.voicechat\.updatertest\.run[a-f0-9]{8}$/.test(metadata.identifier)) throw new Error('Not an isolated fixture');
  const payloads = {};
  const convert = (asset) => {
    const bytes = Buffer.from(original[asset.file] ?? []);
    if (bytes.length !== asset.size || crypto.createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error('Fixture bytes differ from metadata');
    if (scenario === 'tampered') bytes[bytes.length - 1] ^= 1;
    payloads[`/files/${asset.file}`] = bytes;
    return { url: `${FIXTURE_ORIGIN}/files/${asset.file}`, size: bytes.length,
      // Tampered case deliberately supplies a matching hash: signature must reject it.
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      signature: scenario === 'bad-signature' ? metadata.foreignSignatures[asset.file] : asset.signature };
  };
  const portable = convert(metadata.target.portable);
  const installer = metadata.target.installer ? convert(metadata.target.installer) : portable;
  return { payloads, manifest: { version: metadata.target.version,
    notes: `LOCAL UPDATER TEST: ${scenario}. Production is not changed.`,
    platforms: { 'windows-x86_64': installer }, portable: { 'windows-x86_64': portable }, portable_url: portable.url } };
}
