import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createApp } from '../dist/app.js';
import { readEnvironment } from '../dist/config/environment.js';
import { isHealthResponse } from '@training/shared';
const database = 'postgresql://local:local@localhost:5432/local';
test('health over HTTP and consistent unknown route errors', async () => {
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    const response = await fetch(`${url}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    const missing = await fetch(`${url}/api/missing`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).statusCode, 404);
  } finally { await app.close(); }
});
test('environment rejects invalid ports, modes and database URLs', () => {
  assert.equal(readEnvironment({ DATABASE_URL: database }).port, 3000);
  for (const patch of [{ PORT: '0' }, { PORT: '65536' }, { PORT: '1.5' }, { NODE_ENV: 'invalid' }, { DATABASE_URL: 'http://secret:password@localhost/db' }, { DATABASE_URL: '' }]) {
    assert.throws(() => readEnvironment({ DATABASE_URL: database, ...patch }));
  }
});
test('invalid configuration exits before listening and hides secrets', () => {
  const result = spawnSync(process.execPath, ['dist/main.js'], { env: { ...process.env, DATABASE_URL: 'secret-value', PORT: '0' }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /API startup failed/);
  assert.doesNotMatch(result.stderr, /secret-value/);
});
test('public health contract rejects malformed payloads', () => {
  for (const value of [null, {}, { status: 'error' }, 'ok']) assert.equal(isHealthResponse(value), false);
  assert.equal(isHealthResponse({ status: 'ok' }), true);
});
