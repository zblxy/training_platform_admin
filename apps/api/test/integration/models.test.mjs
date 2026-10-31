import 'reflect-metadata';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, stat, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { DatabaseService } from '../../dist/common/database/database.service.js';
import { CertificatesService, localIssueDate } from '../../dist/modules/certificates/certificates.service.js';
import { hashToken } from '../../dist/modules/auth/auth.module.js';
import { createApp } from '../../dist/app.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to an isolated test database');
const url = new URL(process.env.TEST_DATABASE_URL);
const schema = `model_test_${randomUUID().replaceAll('-', '')}`;
url.searchParams.set('schema', schema);
process.env.DATABASE_URL = url.toString();
process.env.DEMO_TOKEN_FILE = `/tmp/${schema}_tokens.json`;
const sql = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
let db, service, a, b, complete, incomplete, token;
before(async () => {
  await sql.connect();
  await sql.query(`CREATE SCHEMA "${schema}"`);
  await sql.query(`SET search_path TO "${schema}"`);
  const migrate = spawnSync(process.execPath, ['../../node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: process.env, encoding: 'utf8' });
  assert.equal(migrate.status, 0, migrate.stdout + migrate.stderr);
  const again = spawnSync(process.execPath, ['../../node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: process.env, encoding: 'utf8' });
  assert.equal(again.status, 0, again.stdout + again.stderr);
  db = new DatabaseService(); service = new CertificatesService(db);
  token = randomBytes(32).toString('base64url');
  async function tenant(name) {
    return db.$transaction(async tx => {
      const tenant = await tx.tenant.create({ data: { name, timeZone: 'America/New_York' } });
      return tx.admin.create({ data: { tenantId: tenant.id, name, tokenHash: hashToken(name === 'A' ? token : randomBytes(32).toString('base64url')) } });
    });
  }
  a = await tenant('A'); b = await tenant('B');
  const course = await db.course.create({ data: { tenantId: a.tenantId, title: 'Safety' } });
  async function enroll(status) {
    const learner = await db.learner.create({ data: { tenantId: a.tenantId, name: status, email: `${status}@example.test` } });
    return db.enrollment.create({ data: { tenantId: a.tenantId, courseId: course.id, learnerId: learner.id, status, completedAt: status === 'COMPLETED' ? new Date() : null } });
  }
  complete = await enroll('COMPLETED'); incomplete = await enroll('INCOMPLETE');
});
after(async () => {
  await db?.$disconnect();
  await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await sql.end();
  await unlink(process.env.DEMO_TOKEN_FILE).catch(error => { if (error.code !== 'ENOENT') throw error; });
});
test('tenant admin, timezone, completion and cross-tenant constraints hold', async () => {
  await assert.rejects(db.tenant.create({ data: { name: 'No admin', timeZone: 'UTC' } }));
  await assert.rejects(db.admin.delete({ where: { id: a.id } }));
  await assert.rejects(db.tenant.update({ where: { id: a.tenantId }, data: { timeZone: 'invalid' } }));
  await assert.rejects(db.enrollment.update({ where: { id: incomplete.id }, data: { status: 'COMPLETED' } }));
  await assert.rejects(db.enrollment.create({ data: { tenantId: b.tenantId, courseId: complete.courseId, learnerId: complete.learnerId } }));
  await assert.rejects(service.issue(a, incomplete.id), /Only completed/);
  await assert.rejects(service.issue(b, complete.id), /not found/);
});
test('concurrent issuance has one certificate and one immutable audit event; revocation is final', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () => service.issue(a, complete.id)));
  const certificate = results[0];
  assert.ok(results.every(c => c.id === certificate.id));
  assert.equal(await db.certificate.count(), 1);
  assert.equal(await db.auditEvent.count({ where: { action: 'ISSUED' } }), 1);
  const audit = await db.auditEvent.findFirstOrThrow();
  assert.equal(audit.actorId, a.id);
  assert.equal(audit.occurredAt.toISOString(), certificate.issuedAt.toISOString());
  assert.equal(certificate.issueDate.toISOString(), localIssueDate(certificate.issuedAt, 'America/New_York').toISOString());
  await assert.rejects(db.auditEvent.delete({ where: { id: audit.id } }));
  await assert.rejects(db.auditEvent.update({ where: { id: audit.id }, data: { actorId: b.id } }));
  await assert.rejects(db.certificate.delete({ where: { id: certificate.id } }));
  await assert.rejects(service.revoke(b, certificate.id, 'Wrong tenant'), /not found/);
  await Promise.all(Array.from({ length: 5 }, () => service.revoke(a, certificate.id, 'Correction')));
  assert.equal(await db.auditEvent.count({ where: { action: 'REVOKED' } }), 1);
  const repeat = await service.issue(a, complete.id);
  assert.equal(repeat.id, certificate.id); assert.ok(repeat.revokedAt);
  await assert.rejects(db.certificate.update({ where: { id: certificate.id }, data: { revokedAt: null, revokedById: null, revocationReason: null } }));
  await assert.rejects(db.enrollment.update({ where: { id: complete.id }, data: { status: 'INCOMPLETE', completedAt: null } }));
});
test('database writes cannot bypass eligibility, date, actor scope or audit creation', async () => {
  const data = { tenantId: a.tenantId, enrollmentId: incomplete.id, issuedById: a.id, issuedAt: new Date('2026-01-01T01:00:00Z'), issueDate: new Date('2025-12-31T00:00:00Z'), issueTimeZone: 'America/New_York' };
  await assert.rejects(db.certificate.create({ data }));
  await db.enrollment.update({ where: { id: incomplete.id }, data: { status: 'COMPLETED', completedAt: new Date('2025-01-01') } });
  await assert.rejects(db.certificate.create({ data: { ...data, issueDate: new Date('2026-01-01') } }));
  await assert.rejects(db.certificate.create({ data: { ...data, issuedById: b.id } }));
  const c = await db.certificate.create({ data });
  assert.equal(await db.auditEvent.count({ where: { certificateId: c.id, action: 'ISSUED' } }), 1);
  await assert.rejects(db.auditEvent.create({ data: { tenantId: a.tenantId, certificateId: c.id, actorId: a.id, action: 'REVOKED', occurredAt: new Date() } }));
  await db.tenant.update({ where: { id: a.tenantId }, data: { timeZone: 'Asia/Shanghai' } });
  assert.equal((await db.certificate.findUniqueOrThrow({ where: { id: c.id } })).issueDate.toISOString().slice(0,10), '2025-12-31');
});
test('bearer actor endpoint rejects invalid tokens and never returns hashes', async () => {
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1'); const base = await app.getUrl();
    for (const authorization of ['', 'Basic abc', `Bearer ${randomBytes(32).toString('base64url')}`]) {
      const response = await fetch(`${base}/api/actor`, { headers: { authorization } });
      assert.equal(response.status, 401);
    }
    const response = await fetch(`${base}/api/actor`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { id: a.id, tenantId: a.tenantId, name: a.name });
  } finally { await app.close(); }
});
test('demo seed is repeatable and keeps token credentials and certificate counts stable', async () => {
  const run = () => spawnSync(process.execPath, ['prisma/seed.mjs'], { env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8' });
  let result = run(); assert.equal(result.status, 0, result.stderr);
  const counts = [await db.tenant.count(), await db.admin.count(), await db.certificate.count(), await db.auditEvent.count()];
  const credentials = await readFile(process.env.DEMO_TOKEN_FILE, 'utf8');
  assert.equal((await stat(process.env.DEMO_TOKEN_FILE)).mode & 0o777, 0o600);
  result = run(); assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(process.env.DEMO_TOKEN_FILE, 'utf8'), credentials);
  assert.deepEqual([await db.tenant.count(), await db.admin.count(), await db.certificate.count(), await db.auditEvent.count()], counts);
});

test('two concurrent admin removals preserve at least one admin', async () => {
  const other = await db.admin.create({ data: { tenantId: b.tenantId, name: 'Second admin', tokenHash: hashToken(randomBytes(32).toString('base64url')) } });
  const results = await Promise.allSettled([b.id, other.id].map(id => db.admin.delete({ where: { id } })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await db.admin.count({ where: { tenantId: b.tenantId } }), 1);
});
test('rollback leaves neither a certificate nor its issuance audit event', async () => {
  const learner = await db.learner.create({ data: { tenantId: a.tenantId, name: 'Rollback', email: 'rollback@example.test' } });
  const enrollment = await db.enrollment.create({ data: { tenantId: a.tenantId, courseId: complete.courseId, learnerId: learner.id, status: 'COMPLETED', completedAt: new Date() } });
  const beforeCount = await db.auditEvent.count();
  await assert.rejects(db.$transaction(async tx => {
    const issuedAt = new Date();
    await tx.certificate.create({ data: { tenantId: a.tenantId, enrollmentId: enrollment.id, issuedById: a.id, issuedAt, issueDate: localIssueDate(issuedAt, 'Asia/Shanghai'), issueTimeZone: 'Asia/Shanghai' } });
    throw new Error('Abort transaction');
  }), /Abort transaction/);
  assert.equal(await db.certificate.count({ where: { enrollmentId: enrollment.id } }), 0);
  assert.equal(await db.auditEvent.count(), beforeCount);
  await assert.rejects(sql.query('TRUNCATE "AuditEvent"'));
});
