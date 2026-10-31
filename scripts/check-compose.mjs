import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const settings = {
  PRODUCTION_DB_USER: 'config_check', PRODUCTION_DB_PASSWORD: 'config_check_only',
  PRODUCTION_DB_NAME: 'config_check', PRODUCTION_DATABASE_URL: 'postgresql://config_check:config_check_only@db:5432/config_check',
  PRODUCTION_BIND_ADDRESS: '127.0.0.1', PRODUCTION_WEB_PORT: '25173',
};
const args = ['compose', '--env-file', '/dev/null', '-f', 'compose.yaml', '-f', 'compose.production.yaml', 'config', '--format', 'json'];
function render(env) { return spawnSync('docker', args, { env: { ...process.env, ...env }, encoding: 'utf8' }); }
const result = render(settings);
assert.equal(result.status, 0, result.stderr);
assert.ok(!result.stdout.includes('training_local'), 'Development credentials must be absent');
const { services } = JSON.parse(result.stdout);
for (const name of ['api', 'web']) {
  assert.equal(services[name].build.target, 'runtime');
  assert.equal(services[name].volumes?.length ?? 0, 0);
  assert.equal(services[name].command ?? null, null);
}
for (const name of ['api', 'db']) assert.equal(services[name].ports?.length ?? 0, 0);
assert.equal(services.web.ports.length, 1);
assert.equal(services.web.ports[0].target, 8080);
assert.equal(services.api.environment.NODE_ENV, 'production');
assert.equal(services.db.environment.POSTGRES_PASSWORD, settings.PRODUCTION_DB_PASSWORD);
assert.equal(services.web.environment?.API_PROXY_TARGET, undefined);
for (const name of Object.keys(settings)) {
  const failure = render({ ...settings, [name]: '' });
  assert.notEqual(failure.status, 0, `${name} must be required`);
  assert.ok(failure.stderr.includes(name));
}
console.log('Production Compose isolation and required configuration checks passed.');
