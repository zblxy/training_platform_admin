import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { exportFixture, parseCsv } from '../helpers/export-fixture.mjs';
test('100,000 East certificates export within 60 seconds from acceptance to ready', { timeout: 600000 }, async t => {
  const f = await exportFixture({ large: true });
  try {
    const timings = [];
    for (const sortBy of ['issuedAt', 'learnerName', 'serialNumber', 'courseTitle']) for (const sortDirection of ['asc', 'desc']) {
      const accepted = performance.now();
      const job = await f.start({ sortBy, sortDirection });
      let finished = false;
      const healthLatencies = [];
      const probe = (async () => {
        while (!finished) {
          const began = performance.now();
          assert.equal((await f.request('health')).status, 200);
          healthLatencies.push(performance.now() - began);
          assert.equal((await f.request('certificates?pageSize=10')).status, 200);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      })();
      let ready;
      try { ready = await f.wait(job.id); }
      finally { finished = true; await probe; }
      const elapsed = performance.now() - accepted;
      timings.push({ sortBy, sortDirection, milliseconds: Math.round(elapsed), maximumHealthMilliseconds: Math.ceil(Math.max(...healthLatencies)) });
      assert.equal(ready.total, 100000); assert.equal(ready.processed, 100000);
      assert.ok(elapsed < 60000, `${sortBy} ${sortDirection}: ${elapsed}ms`);
      const download = await f.request(`certificates/exports/${job.id}/download`);
      const rows = parseCsv(await download.text());
      assert.equal(rows.length, 100001); assert.equal(new Set(rows.slice(1).map(row => row[2])).size, 100000);
      assert.equal((await f.request('health')).status, 200);
    }
    t.diagnostic(JSON.stringify({ node: process.version, cpus: os.cpus().length, cpu: os.cpus()[0]?.model, memoryGiB: Math.round(os.totalmem() / 2 ** 30), timings }));
  } finally { await f.close(); }
});
