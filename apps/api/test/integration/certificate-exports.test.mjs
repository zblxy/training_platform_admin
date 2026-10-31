import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { exportFixture, parseCsv } from '../helpers/export-fixture.mjs';
import { hashToken } from '../../dist/modules/auth/auth.module.js';
import { CertificateExportsService } from '../../dist/modules/certificate-exports/certificate-exports.service.js';
import { claimExport } from '../../dist/modules/certificate-exports/export-queue.js';
let f;
before(async () => { f = await exportFixture(); });
after(async () => { await f?.close(); });

test('export routes enforce validation, authentication and owner/tenant boundaries', async () => {
  for (const token of ['', 'invalid', randomBytes(32).toString('base64url')]) assert.equal((await f.request('certificates/exports', { method: 'POST', body: {}, token })).status, 401);
  for (const body of [{ tenantId: f.west.tenantId }, { page: 1 }, { sortBy: 'id' }, { sortDirection: 'bad' }, { search: 'x'.repeat(201) }]) assert.equal((await f.request('certificates/exports', { method: 'POST', body })).status, 400);
  const job = await f.start(); await f.wait(job.id);
  const otherToken = randomBytes(32).toString('base64url');
  await f.db.admin.create({ data: { tenantId: f.east.tenantId, name: 'Other admin', tokenHash: hashToken(otherToken) } });
  for (const token of [f.west.token, otherToken]) for (const suffix of ['', '/download']) assert.equal((await f.request(`certificates/exports/${job.id}${suffix}`, { token })).status, 404);
  assert.equal((await f.request('certificates/exports/not-a-uuid')).status, 400);
  assert.equal((await f.request(`certificates/exports/${randomUUID()}/download`)).status, 404);
  const res = await f.request(`certificates/exports/${job.id}`); const status = await res.json();
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal('tenantId' in status, false); assert.equal('leaseId' in status, false);
});

test('every search/sort exports all matching rows in list order, including revoked dates and CSV characters', async () => {
  const learner = await f.db.learner.findFirstOrThrow({ where: { tenantId: f.east.tenantId, name: 'Alex Lee' } });
  await f.db.learner.update({ where: { id: learner.id }, data: { name: '李, "Alex"\r\n%_\\Lee' } });
  const foreign = await f.db.certificate.findFirstOrThrow({ where: { tenantId: f.west.tenantId } });
  const own = await f.db.certificate.findFirstOrThrow({ where: { tenantId: f.east.tenantId } });
  for (const sortBy of ['issuedAt', 'learnerName', 'serialNumber', 'courseTitle']) for (const sortDirection of ['asc', 'desc']) {
    const params = new URLSearchParams({ sortBy, sortDirection, pageSize: '100' });
    const list = await (await f.request(`certificates?${params}`)).json();
    const job = await f.start({ sortBy, sortDirection }); const ready = await f.wait(job.id);
    assert.equal(ready.total, list.total); assert.equal(ready.processed, list.total);
    const response = await f.request(`certificates/exports/${job.id}/download`);
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /text\/csv/);
    assert.match(response.headers.get('content-disposition'), /attachment/);
    const rows = parseCsv(await response.text());
    assert.deepEqual(rows[0], ['Learner name', 'Course title', 'Serial number', 'Issue date']);
    assert.deepEqual(rows.slice(1), list.items.map(row => [row.learnerName, row.courseTitle, row.serialNumber, row.issueDate]));
    assert.ok(list.items.some(row => row.status === 'revoked'));
  }
  for (const search of ['%', '_', '\\', 'mOrGaN', own.serialNumber.toLowerCase(), foreign.serialNumber, 'no such learner']) {
    const params = new URLSearchParams({ search, pageSize: '100' });
    const list = await (await f.request(`certificates?${params}`)).json();
    const job = await f.start({ search }); await f.wait(job.id);
    const rows = parseCsv(await (await f.request(`certificates/exports/${job.id}/download`)).text());
    assert.deepEqual(rows.slice(1), list.items.map(row => [row.learnerName, row.courseTitle, row.serialNumber, row.issueDate]));
  }
});

test('historical tenant-local dates survive zone changes and formulas are safe in downloads', async () => {
  const tenantId = f.east.tenantId;
  const learner = await f.db.learner.create({ data: { tenantId, name: '=1+1', email: 'formula@east.test' } });
  const course = await f.db.course.create({ data: { tenantId, title: '  @SUM(A1)' } });
  const enrollment = await f.db.enrollment.create({ data: { tenantId, learnerId: learner.id, courseId: course.id, status: 'COMPLETED', completedAt: new Date('2025-01-01T00:00:00Z') } });
  await f.db.certificate.create({ data: { tenantId, enrollmentId: enrollment.id, issuedById: f.east.adminId, issuedAt: new Date('2026-01-01T14:30:00Z'), issueDate: new Date('2026-01-02T00:00:00Z'), issueTimeZone: 'Australia/Sydney' } });
  await f.db.tenant.update({ where: { id: tenantId }, data: { timeZone: 'Australia/Perth' } });
  const job = await f.start({ search: '=1+1' }); await f.wait(job.id);
  const rows = parseCsv(await (await f.request(`certificates/exports/${job.id}/download`)).text());
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], "'=1+1"); assert.equal(rows[1][1], "'  @SUM(A1)");
  assert.equal(rows[1][3], '2026-01-02');
});

test('duplicates reuse active jobs, conflicting starts fail and interrupted jobs recover after restart', async () => {
  await f.app.get(CertificateExportsService).onModuleDestroy();
  const [a, b] = await Promise.all([f.start(), f.start()]); assert.equal(a.id, b.id);
  assert.equal((await f.request('certificates/exports', { method: 'POST', body: { search: 'different' } })).status, 409);
  assert.equal((await f.request(`certificates/exports/${a.id}/download`)).status, 409);
  const claims = await Promise.all([claimExport(f.db), claimExport(f.db)]);
  assert.equal(claims.filter(Boolean).length, 1);
  const claimed = claims.find(Boolean); assert.equal(claimed.id, a.id);
  await f.db.certificateExport.update({ where: { id: a.id }, data: { leaseUntil: new Date(0) } });
  await f.db.certificateExportChunk.create({ data: { exportId: a.id, sequence: 0, content: Buffer.from('partial file') } });
  const recovered = await claimExport(f.db);
  assert.equal(recovered.attempts, 2); assert.notEqual(recovered.leaseId, claimed.leaseId);
  assert.equal(await f.db.certificateExportChunk.count({ where: { exportId: a.id } }), 0);
  const staleWrite = await f.db.certificateExport.updateMany({ where: { id: a.id, leaseId: claimed.leaseId }, data: { processed: 0 } });
  assert.equal(staleWrite.count, 0, 'a stale worker cannot publish progress or append chunks');
  await f.db.certificateExport.update({ where: { id: a.id }, data: { leaseUntil: new Date(0) } });
  await f.app.close();
  const { createApp } = await import('../../dist/app.js');
  const app = await createApp(); await app.listen(0, '127.0.0.1');
  try {
    const base = await app.getUrl();
    const deadline = Date.now() + 10000; let status;
    while (Date.now() < deadline) {
      status = await (await fetch(`${base}/api/certificates/exports/${a.id}`, { headers: { Authorization: `Bearer ${f.east.token}` } })).json();
      if (status.status === 'completed') break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(status.status, 'completed');
    const response = await fetch(`${base}/api/certificates/exports/${a.id}/download`, { headers: { Authorization: `Bearer ${f.east.token}` } });
    assert.equal(parseCsv(await response.text()).length, status.total + 1);
  } finally { await app.close(); }
});

test('expired artifacts are inaccessible and cleanup removes only export data', async () => {
  const job = await f.db.certificateExport.findFirstOrThrow({ where: { status: 'completed' } });
  const count = await f.db.certificate.count();
  await f.db.certificateExport.update({ where: { id: job.id }, data: { expiresAt: new Date(0) } });
  await assert.rejects(f.app.get(CertificateExportsService).status({ id: f.east.adminId, tenantId: f.east.tenantId }, job.id), /expired/);
  await claimExport(f.db);
  assert.equal(await f.db.certificateExportChunk.count({ where: { exportId: job.id } }), 0);
  assert.equal(await f.db.certificate.count(), count);
});

test('repeated interruptions fail safely and clear partial artifacts', async () => {
  const job = await f.db.certificateExport.create({ data: {
    tenantId: f.east.tenantId, requestedById: f.east.adminId, search: '', sortBy: 'issuedAt', sortDirection: 'desc',
    status: 'running', attempts: 3, leaseId: randomUUID(), leaseUntil: new Date(0), expiresAt: new Date(Date.now() + 86400000),
  } });
  await f.db.certificateExportChunk.create({ data: { exportId: job.id, sequence: 0, content: Buffer.from('partial') } });
  await claimExport(f.db);
  assert.equal((await f.db.certificateExport.findUniqueOrThrow({ where: { id: job.id } })).status, 'failed');
  assert.equal(await f.db.certificateExportChunk.count({ where: { exportId: job.id } }), 0);
});
