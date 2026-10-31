import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { CacheService } from '../../dist/common/cache/cache.service.js';
import { createApp } from '../../dist/app.js';
import { CacheModule } from '../../dist/common/cache/cache.module.js';

const url = process.env.TEST_REDIS_URL;
assert.ok(url, 'Set TEST_REDIS_URL to an isolated Redis instance before running cache integration tests');

test('real Redis cache supports shared TTL values, deletion and authentication', async () => {
  const first = new CacheService(url);
  const second = new CacheService(url);
  const key = `test:${randomUUID()}`;
  try {
    assert.equal(await first.get(key), null);
    assert.equal(await first.set(key, 'value', 1), true);
    assert.equal(await second.get(key), 'value');
    await setTimeout(1200);
    assert.equal(await second.get(key), null);
    assert.equal(await first.set(key, '', 30), true);
    assert.equal(await second.get(key), '');
    assert.equal(await second.delete(key), true);
    assert.equal(await first.get(key), null);
    const badUrl = new URL(url);
    badUrl.password = randomUUID();
    const unauthorized = new CacheService(badUrl.href);
    try { assert.equal(await unauthorized.set(key, 'invalid', 30), false); }
    finally { unauthorized.onModuleDestroy(); }
    assert.equal(await first.get(key), null);
  } finally {
    await first.delete(key);
    first.onModuleDestroy();
    second.onModuleDestroy();
  }
});

test('Nest injects cache service and closes connections on application shutdown', async () => {
  const previous = process.env.REDIS_URL;
  process.env.REDIS_URL = url;
  let app;
  try {
    app = await createApp();
    await app.init();
    const cache = app.select(CacheModule).get(CacheService);
    const key = `test:${randomUUID()}`;
    assert.equal(await cache.set(key, 'through-nest', 30), true);
    assert.equal(await cache.get(key), 'through-nest');
    assert.equal(await cache.delete(key), true);
    await app.close();
    assert.equal(await cache.set(key, 'after-close', 30), false);
  } finally {
    if (app) await app.close();
    if (previous === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previous;
  }
});
