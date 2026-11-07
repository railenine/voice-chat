import { build } from 'esbuild';
import Module from 'node:module';
import path from 'node:path';

export async function loadComponent(entry, { livekitStub, viteEnv = {} } = {}) {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['react', 'react-dom', 'livekit-client'],
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env': JSON.stringify(viteEnv) },
    plugins: [{ name: 'test-worklet-boundary', setup(builder) {
      if (livekitStub) {
        builder.onResolve({ filter: /^livekit-client$/ }, () => ({ path: 'livekit-client', namespace: 'sdk-boundary' }));
        builder.onLoad({ filter: /.*/, namespace: 'sdk-boundary' }, () => ({ contents: livekitStub }));
      }
      builder.onResolve({ filter: /^@sapphi-red\// }, args => ({ path: args.path, namespace: 'audio-boundary' }));
      builder.onLoad({ filter: /.*/, namespace: 'audio-boundary' }, args => ({ contents: args.path.includes('?url')
        ? 'export default "test-worklet"'
        : 'export class RnnoiseWorkletNode {}; export async function loadRnnoise() { throw new Error("No WASM in renderer test"); }' }));
    } }],
  });
  const filename = path.resolve('test/renderer-component.cjs');
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(result.outputFiles[0].text, filename);
  return mod.exports;
}

export function browserEnvironment() {
  const noop = () => {};
  const values = new Map();
  globalThis.localStorage = globalThis.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  globalThis.window = { addEventListener: noop, removeEventListener: noop,
    location: { search: '', hostname: 'localhost', port: '5173', origin: 'http://localhost:5173' },
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }) };
  globalThis.document = { addEventListener: noop, removeEventListener: noop };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    mediaDevices: { getUserMedia: async () => { throw Error('Provide a fake device'); }, enumerateDevices: async () => [], addEventListener: noop, removeEventListener: noop },
    userAgent: 'test', platform: 'Win32', onLine: true,
  } });
}
