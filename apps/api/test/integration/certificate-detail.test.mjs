import 'reflect-metadata';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';
import { DatabaseService } from '../../dist/common/database/database.service.js';
import { CertificatesService } from '../../dist/modules/certificates/certificates.service.js';
import { hashToken } from '../../dist/modules/auth/auth.module.js';
import { createApp } from '../../dist/app.js';
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to an isolated test database');
const schema = `certificate_detail_${randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('schema', schema);
process.env.DATABASE_URL = url.toString();
const sql = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
const token = randomBytes(32).toString('base64url');
let db, service, app, base, actor, foreign, certificate;
before(async () => {
  await sql.connect(); await sql.query(`CREATE SCHEMA "${schema}"`); await sql.query(`SET search_path TO "${schema}"`);
  for (const name of (await readdir('prisma/migrations')).filter(name => /^\d/.test(name)).sort()) {
    await sql.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
  }
  db = new DatabaseService(); service = new CertificatesService(db);
  async function fixture(name, credential) {
    const admin = await db.$transaction(async tx => {
      const tenant = await tx.tenant.create({ data: { name, timeZone: 'America/New_York' } });
      return tx.admin.create({ data: { tenantId: tenant.id, name, tokenHash: hashToken(credential) } });
    });
    const course = await db.course.create({ data: { tenantId: admin.tenantId, title: 'Safety' } });
    const learner = await db.learner.create({ data: { tenantId: admin.tenantId, name: 'Alex', email: 'alex@example.test' } });
    const enrollment = await db.enrollment.create({ data: { tenantId: admin.tenantId, courseId: course.id, learnerId: learner.id, status: 'COMPLETED', completedAt: new Date('2025-01-01') } });
    // A UTC instant whose tenant-local date falls on the previous day.
    const issued = await db.certificate.create({ data: { tenantId: admin.tenantId, enrollmentId: enrollment.id,
      issuedById: admin.id, issuedAt: new Date('2026-01-01T01:00:00Z'), issueDate: new Date('2025-12-31'), issueTimeZone: 'America/New_York' } });
    return { admin, issued };
  }
  const local = await fixture('Local admin', token); actor = local.admin; certificate = local.issued;
  foreign = (await fixture('Foreign admin', randomBytes(32).toString('base64url'))).issued;
  await db.tenant.update({ where: { id: actor.tenantId }, data: { timeZone: 'Asia/Shanghai' } });
  app = await createApp(); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
});
after(async () => {
  await app?.close(); await db?.$disconnect();
  await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await sql.end();
});
function request(id = certificate.id, body, credential = token) {
  return fetch(`${base}/api/certificates/${id}${body === undefined ? '' : '/revoke'}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test('detail preserves original local date and zone, exposes safe fields and issuance audit', async () => {
  const response = await request(); assert.equal(response.status, 200);
  const detail = await response.json();
  assert.deepEqual(detail, { id: certificate.id, serialNumber: certificate.serialNumber, learnerName: 'Alex', courseTitle: 'Safety',
    issuedAt: '2026-01-01T01:00:00.000Z', issueDate: '2025-12-31', issueTimeZone: 'America/New_York', status: 'active', revokedAt: null, revocationReason: null,
    auditEvents: [{ action: 'ISSUED', actorName: actor.name, occurredAt: '2026-01-01T01:00:00.000Z' }] });
  // Dynamic detail route must not shadow the existing static courses route.
  assert.equal((await fetch(`${base}/api/certificates/courses`, { headers: { authorization: `Bearer ${token}` } })).status, 200);
});
test('detail and revoke require authentication and hide foreign certificates', async () => {
  for (const body of [undefined, { reason: 'Correction' }]) {
    for (const credential of ['', 'invalid', randomBytes(32).toString('base64url')]) assert.equal((await request(certificate.id, body, credential)).status, 401);
    for (const id of [foreign.id, randomUUID()]) {
      const response = await request(id, body); assert.equal(response.status, 404);
      assert.equal((await response.json()).message, 'Certificate not found');
    }
    for (const id of ['invalid', 'a'.repeat(36)]) assert.equal((await request(id, body)).status, 400);
  }
  assert.equal(await db.auditEvent.count({ where: { certificateId: foreign.id, action: 'REVOKED' } }), 0);
});
test('revocation validates reason and rejects client actor/tenant fields without mutating', async () => {
  for (const body of [{}, { reason: '' }, { reason: '   ' }, { reason: 5 }, { reason: null }, { reason: ['x'] }, { reason: 'x'.repeat(1001) }, { reason: 'x', tenantId: actor.tenantId }, { reason: 'x', actorId: actor.id }]) {
    assert.equal((await request(certificate.id, body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await service.detail(actor, certificate.id)).status, 'active');
  assert.equal(await db.auditEvent.count({ where: { certificateId: certificate.id } }), 1);
});
test('an audit failure rolls back revocation', async () => {
  await sql.query(`CREATE FUNCTION reject_revocation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$`);
  await sql.query(`CREATE TRIGGER reject_revocation_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW WHEN (NEW.action = 'REVOKED') EXECUTE FUNCTION reject_revocation_audit()`);
  try {
    assert.equal((await request(certificate.id, { reason: 'Correction' })).status, 500);
    const detail = await service.detail(actor, certificate.id);
    assert.equal(detail.status, 'active'); assert.equal(detail.revocationReason, null); assert.equal(detail.auditEvents.length, 1);
  } finally { await sql.query('DROP TRIGGER reject_revocation_audit ON "AuditEvent"'); }
});
test('concurrent and repeated HTTP revocation preserve the first result and exactly one audit', async () => {
  const responses = await Promise.all(Array.from({ length: 6 }, (_, index) => request(certificate.id, { reason: `  Correction ${index}  ` })));
  const results = await Promise.all(responses.map(async response => { assert.equal(response.status, 200); return response.json(); }));
  for (const result of results) assert.deepEqual(result, results[0]);
  const detail = results[0]; assert.equal(detail.status, 'revoked'); assert.match(detail.revocationReason, /^Correction [0-5]$/);
  assert.deepEqual(detail.auditEvents.map(event => event.action), ['ISSUED', 'REVOKED']);
  assert.equal(detail.auditEvents[1].actorName, actor.name); assert.equal(detail.auditEvents[1].occurredAt, detail.revokedAt);
  assert.deepEqual(await (await request(certificate.id, { reason: 'Changed reason' })).json(), detail);
  assert.deepEqual(await (await request()).json(), detail);
  assert.equal(await db.auditEvent.count({ where: { certificateId: certificate.id, action: 'ISSUED' } }), 1);
  assert.equal(await db.auditEvent.count({ where: { certificateId: certificate.id, action: 'REVOKED' } }), 1);
  const list = await fetch(`${base}/api/certificates`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal((await list.json()).items.find(row => row.id === certificate.id).status, 'revoked');
});
