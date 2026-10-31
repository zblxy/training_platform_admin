import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { CacheService } from '../dist/common/cache/cache.service.js';

test('cache outage returns misses and failed writes within a bounded time', async () => {
  // Accept TCP without answering Redis: exercise handshake timeout, not just refused connections.
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const cache = new CacheService(`redis://127.0.0.1:${server.address().port}/0`);
  try {
    const start = performance.now();
    assert.deepEqual(await Promise.all([cache.get('missing'), cache.set('test', 'value', 10), cache.delete('test')]), [null, false, false]);
    assert.ok(performance.now() - start < 2000, 'Cache handshake must time out promptly');
    await assert.rejects(cache.set('bad', 'value', 0), RangeError);
    await assert.rejects(cache.set('bad', 'value', 0.5), RangeError);
    cache.onModuleDestroy();
    assert.equal(await cache.get('closed'), null);
    assert.equal(await cache.set('closed', 'value', 10), false);
  } finally {
    cache.onModuleDestroy();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});
