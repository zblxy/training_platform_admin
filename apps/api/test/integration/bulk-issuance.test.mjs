import 'reflect-metadata';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { DatabaseService } from '../../dist/common/database/database.service.js';
import { CertificatesService } from '../../dist/modules/certificates/certificates.service.js';
import { hashToken } from '../../dist/modules/auth/auth.module.js';
import { createApp } from '../../dist/app.js';
import { isBulkIssuanceResponse } from '@training/shared';
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to an isolated test database');
const schema = `bulk_${randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('schema', schema);
process.env.DATABASE_URL = url.toString();
const sql = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
const token = randomBytes(32).toString('base64url');
let db, service, app, base, actor, other, course, emptyCourse, foreign, incomplete, active, revoked, eligible, failing;
before(async () => {
  await sql.connect();
  await sql.query(`CREATE SCHEMA "${schema}"`);
  await sql.query(`SET search_path TO "${schema}"`);
  for (const name of (await readdir('prisma/migrations')).sort()) {
    if (/^\d/.test(name)) await sql.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
  }
  db = new DatabaseService(); service = new CertificatesService(db);
  async function admin(name, credential) {
    return db.$transaction(async tx => {
      const tenant = await tx.tenant.create({ data: { name, timeZone: 'Asia/Shanghai' } });
      return tx.admin.create({ data: { tenantId: tenant.id, name, tokenHash: hashToken(credential) } });
    });
  }
  actor = await admin('A', token); other = await admin('B', randomBytes(32).toString('base64url'));
  course = await db.course.create({ data: { tenantId: actor.tenantId, title: 'Safety' } });
  emptyCourse = await db.course.create({ data: { tenantId: actor.tenantId, title: 'Empty' } });
  foreign = await db.course.create({ data: { tenantId: other.tenantId, title: 'Foreign' } });
  async function enroll(name, status = 'COMPLETED') {
    const learner = await db.learner.create({ data: { tenantId: actor.tenantId, name, email: `${name}@test.example` } });
    return db.enrollment.create({ data: { tenantId: actor.tenantId, courseId: course.id, learnerId: learner.id, status, completedAt: status === 'COMPLETED' ? new Date() : null } });
  }
  incomplete = await enroll('Incomplete', 'INCOMPLETE'); active = await enroll('Active'); revoked = await enroll('Revoked');
  eligible = await enroll('Eligible'); failing = await enroll('Failing');
  await service.issue(actor, active.id);
  await service.revoke(actor, (await service.issue(actor, revoked.id)).id, 'Correction');
  // Simulate an individual insert failure to verify rollback, safe reporting and continued processing.
  await sql.query(`CREATE FUNCTION reject_test_certificate() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW."enrollmentId" = '${failing.id}'::uuid THEN RAISE EXCEPTION 'private database detail'; END IF; RETURN NEW; END $$`);
  await sql.query('CREATE TRIGGER reject_test_certificate BEFORE INSERT ON "Certificate" FOR EACH ROW EXECUTE FUNCTION reject_test_certificate()');
  app = await createApp(); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
});
after(async () => {
  await app?.close(); await db?.$disconnect();
  await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await sql.end();
});
function request(path, body, credential = token) {
  return fetch(`${base}/api/certificates/${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: credential ? `Bearer ${credential}` : '', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function bulk(id = course.id) { const response = await request('bulk-issuance', { courseId: id }); assert.equal(response.status, 201); return response.json(); }
test('course options and issuance enforce authentication, tenant boundaries and input validation', async () => {
  for (const credential of ['', 'invalid', randomBytes(32).toString('base64url')]) {
    assert.equal((await request('courses', undefined, credential)).status, 401);
    assert.equal((await request('bulk-issuance', { courseId: course.id }, credential)).status, 401);
  }
  for (const body of [{}, { courseId: 'bad' }, { courseId: [course.id] }, { courseId: course.id, tenantId: other.tenantId }, { courseId: course.id, learnerIds: [] }]) {
    assert.equal((await request('bulk-issuance', body)).status, 400);
  }
  for (const id of [foreign.id, randomUUID()]) assert.equal((await request('bulk-issuance', { courseId: id })).status, 404);
  const response = await request('courses'); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: [{ id: emptyCourse.id, title: 'Empty' }, { id: course.id, title: 'Safety' }] });
});
test('mixed outcomes continue after a learner failure and preserve audit atomicity', async () => {
  const result = await bulk(); assert.equal(isBulkIssuanceResponse(result), true);
  assert.deepEqual([result.total, result.issued, result.skipped, result.failed], [5, 1, 3, 1]);
  const outcome = id => result.outcomes.find(row => row.enrollmentId === id);
  assert.equal(outcome(eligible.id).status, 'issued');
  assert.match(outcome(eligible.id).serialNumber, /^CERT-[A-F0-9]{32}$/);
  assert.equal(outcome(incomplete.id).reason, 'incomplete');
  assert.equal(outcome(active.id).reason, 'already_issued');
  assert.equal(outcome(revoked.id).reason, 'revoked');
  assert.equal(outcome(failing.id).reason, 'issuance_failed');
  assert.doesNotMatch(JSON.stringify(result), /private database detail|tokenHash|tenantId|email/);
  assert.equal(await db.certificate.count({ where: { enrollmentId: failing.id } }), 0);
  assert.equal(await db.certificate.count({ where: { tenantId: actor.tenantId } }), 3);
  assert.equal(await db.auditEvent.count({ where: { tenantId: actor.tenantId, action: 'ISSUED' } }), 3);
  const cert = await db.certificate.findUniqueOrThrow({ where: { enrollmentId: eligible.id } });
  assert.equal(cert.issuedById, actor.id); assert.equal(cert.issueTimeZone, 'Asia/Shanghai');
});
test('concurrent retries issue the previously failed learner exactly once and otherwise skip', async () => {
  await sql.query('DROP TRIGGER reject_test_certificate ON "Certificate"');
  const results = await Promise.all([bulk(), bulk(), bulk()]);
  assert.equal(results.reduce((sum, row) => sum + row.issued, 0), 1);
  assert.ok(results.every(row => row.failed === 0 && row.total === 5));
  assert.equal(await db.certificate.count({ where: { tenantId: actor.tenantId } }), 4);
  assert.equal(await db.auditEvent.count({ where: { tenantId: actor.tenantId, action: 'ISSUED' } }), 4);
  const retry = await bulk(); assert.deepEqual([retry.issued, retry.skipped, retry.failed], [0, 5, 0]);
});
test('empty courses produce a successful empty result', async () => {
  assert.deepEqual(await bulk(emptyCourse.id), { courseId: emptyCourse.id, total: 0, issued: 0, skipped: 0, failed: 0, outcomes: [] });
});
