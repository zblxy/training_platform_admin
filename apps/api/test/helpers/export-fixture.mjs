import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { DatabaseService } from '../../dist/common/database/database.service.js';
import { createApp } from '../../dist/app.js';
import { seedDemoData, generateEastCertificates } from '../../prisma/demo-data.mjs';

export async function exportFixture({ large = false } = {}) {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to an isolated test database');
  const schema = `export_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const tokenFile = `/tmp/${schema}.json`;
  const sql = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await sql.connect(); await sql.query(`CREATE SCHEMA "${schema}"`);
  let app, db;
  async function close() {
    await app?.close(); await db?.$disconnect();
    await sql.query(`DROP SCHEMA "${schema}" CASCADE`); await sql.end();
    await unlink(tokenFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  try {
    for (let pass = 0; pass < 2; pass++) {
      const migration = spawnSync(process.execPath, ['../../node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: process.env, encoding: 'utf8' });
      assert.equal(migration.status, 0, migration.stdout + migration.stderr);
    }
    db = new DatabaseService(); await seedDemoData(db, tokenFile);
    if (large) await generateEastCertificates(db);
    const credentials = JSON.parse(await readFile(tokenFile, 'utf8'));
    const east = credentials.find(row => row.tenant === 'East'), west = credentials.find(row => row.tenant === 'West');
    app = await createApp(); await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    async function request(path, { method = 'GET', body, token = east.token, headers = {}, signal = AbortSignal.timeout(70000) } = {}) {
      return fetch(`${base}/api/${path}`, { method, signal, headers: { ...headers, Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    }
    async function start(filters = {}) {
      const response = await request('certificates/exports', { method: 'POST', body: { search: '', sortBy: 'issuedAt', sortDirection: 'desc', ...filters } });
      assert.equal(response.status, 202, await response.clone().text()); return response.json();
    }
    async function wait(id, timeout = 60000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const response = await request(`certificates/exports/${id}`); assert.equal(response.status, 200);
        const job = await response.json();
        if (job.status === 'failed') assert.fail(job.error);
        if (job.status === 'completed') return job;
        assert.ok(job.processed <= job.total);
        await delay(50);
      }
      assert.fail('Export did not complete within deadline');
    }
    return { db, app, request, start, wait, close, east, west, base };
  } catch (error) { await close(); throw error; }
}

// Independent parser verifies exported CSV without reusing the serializer.
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && char === ',') { row.push(cell); cell = ''; }
    else if (!quoted && char === '\r' && source[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += char;
  }
  assert.equal(quoted, false); assert.equal(cell, ''); assert.equal(row.length, 0);
  return rows;
}
