import fs from 'node:fs';
import path from 'node:path';

export function copyFrontendTree(source, destination) {
  fs.cpSync(source, destination, { recursive: true, dereference: false,
    verbatimSymlinks: true, force: false, errorOnExist: true });
  // Node's native recursive copy can mask directory modes with the process
  // umask. Restore public directory modes explicitly, without following links.
  function restoreDirectories(from, to) {
    if (!fs.lstatSync(from).isDirectory()) return;
    const target = fs.lstatSync(to);
    if (!target.isDirectory() || target.isSymbolicLink()) throw new Error('Unexpected frontend copy target');
    fs.chmodSync(to, fs.lstatSync(from).mode & 0o777);
    for (const entry of fs.readdirSync(from)) restoreDirectories(path.join(from, entry), path.join(to, entry));
  }
  restoreDirectories(source, destination);
}

export function frontendAssets(html, origin) {
  const base = new URL(origin);
  const assets = new Map();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)) {
    const url = new URL(match[1], base);
    if (url.origin !== base.origin) continue;
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (relative.split('/').some(part => part === '..' || part === '.') || relative.includes('\\')) throw new Error('Unsafe frontend asset path');
    assets.set(url.href, { url: url.href, relative, css: /\.css$/i.test(url.pathname) });
  }
  if (!assets.size) throw new Error('No local frontend JS/CSS entrypoints found');
  return [...assets.values()];
}

export function validateFrontendMime(contentType, css) {
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (css ? type !== 'text/css' : !/^(application|text)\/(x-)?(javascript|ecmascript)$/.test(type)) {
    throw new Error('Frontend resource has an incorrect content type');
  }
}
