import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isolateDeploymentScript } from '../../scripts/deploy-isolation.js';

const source = fs.readFileSync(new URL('../../scripts/deploy-candidate.sh', import.meta.url), 'utf8');
const root = '/opt/rvxis-deploy-smoke/run-0123456789abcdef';
test('delivery fixture changes only target constants and retains production rollback/health control flow', () => {
  const isolated = isolateDeploymentScript(source, root);
  const stripTargets = text => text.replace(/^# BEGIN DEPLOYMENT TARGETS[^\n]*\n[\s\S]*?^# END DEPLOYMENT TARGETS$/m, 'TARGETS');
  assert.equal(stripTargets(isolated), stripTargets(source.replace(/\r\n/g, '\n')));
  assert.equal(isolated.includes('/var/www/'), false);
  assert.equal(isolated.includes('voicechat-server'), false);
  assert.ok(isolated.includes(`frontend='${root}/frontend'`));
  assert.ok(isolated.includes('[[ "${PM2_HOME:-}" == '));
  assert.ok(isolated.includes('process_name=rvxis-deploy-smoke'));
  assert.ok(isolated.includes('probe_port=3201'));
  assert.ok(isolated.includes('service_port=3200'));
});
test('delivery fixture refuses escaping roots or changed target markers', () => {
  for (const value of ['/var/www/voice-chat', '/opt/rvxis-deploy-smoke/../../var/www', `${root};echo unsafe`]) {
    assert.throws(() => isolateDeploymentScript(source, value), /Invalid/);
  }
  assert.throws(() => isolateDeploymentScript(source.replace('# END DEPLOYMENT TARGETS', '# RENAMED'), root), /target block/);
});
test('delivery fixture refuses new production paths outside the replaceable target block', () => {
  assert.throws(() => isolateDeploymentScript(`${source}\ncd /var/www/new-target\n`, root), /Production targets remain/);
  assert.throws(() => isolateDeploymentScript(`${source}\npm2 delete voicechat-server\n`, root), /Production targets remain/);
});
