// Change only the deployment target constants, preserving production control flow.
export function isolateDeploymentScript(source, root) {
  if (!/^\/opt\/rvxis-deploy-smoke\/run-[a-f0-9]{16}$/.test(root)) throw new Error('Invalid isolated deployment root');
  const normalized = source.replace(/\r\n/g, '\n');
  const block = /^# BEGIN DEPLOYMENT TARGETS[^\n]*\n[\s\S]*?^# END DEPLOYMENT TARGETS$/gm;
  if ([...normalized.matchAll(block)].length !== 1) throw new Error('Deployment target block changed; review isolation before running.');
  const result = normalized.replace(block, `# BEGIN DEPLOYMENT TARGETS
release_root='${root}/releases'
frontend='${root}/frontend'
backend='${root}/backend'
shared_env='${root}/shared/.env'
allowed_frontend_root='${root}/'
process_name=rvxis-deploy-smoke
probe_port=3201
service_port=3200
service_host=127.0.0.1
[[ "\$\{PM2_HOME:-\}" == '${root}/pm2' ]] || { echo 'Isolated PM2_HOME required' >&2; exit 1; }
[[ "$(realpath -e '${root}')" == '${root}' ]] || exit 1
[[ "$(realpath -m "$PM2_HOME")" == "$PM2_HOME" ]] || exit 1
# END DEPLOYMENT TARGETS`);
  if (result.includes('/var/www/') || result.includes('voicechat-server')) {
    throw new Error('Production targets remain outside the configuration block. Refusing to run.');
  }
  return result;
}
