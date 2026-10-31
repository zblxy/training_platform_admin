import 'reflect-metadata';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { DatabaseService } from '../../dist/common/database/database.service.js';
import { CertificatesService } from '../../dist/modules/certificates/certificates.service.js';
import { hashToken } from '../../dist/modules/auth/auth.module.js';
import { createApp } from '../../dist/app.js';
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to an isolated test database');
const schema = `certificate_list_${randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('schema', schema);
process.env.DATABASE_URL = url.toString();
const sql = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
const token = randomBytes(32).toString('base64url');
let db, service, app, base, actor, other, legacy, auditBefore, oldRows;
before(async () => {
  await sql.connect();
  await sql.query(`CREATE SCHEMA "${schema}"`);
  await sql.query(`SET search_path TO "${schema}"`);
  await sql.query(await readFile('prisma/migrations/20261031000000_initial_data_model/migration.sql', 'utf8'));
  // Populate the old schema, including final revoked history, before upgrading.
  const tenantId = randomUUID(), adminId = randomUUID(), courseId = randomUUID();
  await sql.query('BEGIN');
  await sql.query('INSERT INTO "Tenant" (id,name,"timeZone") VALUES ($1,\'Legacy\',\'UTC\')', [tenantId]);
  await sql.query('INSERT INTO "Admin" (id,"tenantId",name,"tokenHash") VALUES ($1,$2,\'Legacy\',$3)', [adminId, tenantId, hashToken(randomBytes(32).toString('base64url'))]);
  await sql.query('COMMIT');
  await sql.query('INSERT INTO "Course" (id,"tenantId",title) VALUES ($1,$2,\'Legacy\')', [courseId, tenantId]);
  for (let index = 0; index < 2; index++) {
    const learnerId = randomUUID(), enrollmentId = randomUUID(), certificateId = randomUUID();
    await sql.query('INSERT INTO "Learner" (id,"tenantId",name,email) VALUES ($1,$2,\'Legacy\',$3)', [learnerId, tenantId, `${index}@legacy.test`]);
    await sql.query('INSERT INTO "Enrollment" (id,"tenantId","courseId","learnerId",status,"completedAt") VALUES ($1,$2,$3,$4,\'COMPLETED\',now())', [enrollmentId, tenantId, courseId, learnerId]);
    await sql.query('INSERT INTO "Certificate" (id,"tenantId","enrollmentId","issuedById","issueDate","issueTimeZone") VALUES ($1,$2,$3,$4,(now() AT TIME ZONE \'UTC\')::date,\'UTC\')', [certificateId, tenantId, enrollmentId, adminId]);
    if (index) await sql.query('UPDATE "Certificate" SET "revokedAt"=now(),"revokedById"=$2,"revocationReason"=\'Legacy correction\' WHERE id=$1', [certificateId, adminId]);
  }
  oldRows = (await sql.query('SELECT * FROM "Certificate" ORDER BY id')).rows;
  auditBefore = (await sql.query('SELECT * FROM "AuditEvent" ORDER BY id')).rows;
  await sql.query(await readFile('prisma/migrations/20261031010000_certificate_serial/migration.sql', 'utf8'));
  legacy = (await sql.query('SELECT * FROM "Certificate" ORDER BY id')).rows;
  db = new DatabaseService(); service = new CertificatesService(db);
  async function admin(name, credential) {
    return db.$transaction(async tx => {
      const tenant = await tx.tenant.create({ data: { name, timeZone: 'UTC' } });
      return tx.admin.create({ data: { tenantId: tenant.id, name, tokenHash: hashToken(credential) } });
    });
  }
  actor = await admin('A', token); other = await admin('B', randomBytes(32).toString('base64url'));
  for (const owner of [actor, other]) {
    const course = await db.course.create({ data: { tenantId: owner.tenantId, title: owner === actor ? 'Safety' : 'Foreign course' } });
    const secondCourse = await db.course.create({ data: { tenantId: owner.tenantId, title: 'Leadership' } });
    for (let index = 0; index < (owner === actor ? 25 : 1); index++) {
      const learner = await db.learner.create({ data: { tenantId: owner.tenantId, name: index === 24 ? 'Literal %_\\ name' : `Learner ${String(index).padStart(2, '0')}`, email: `${index}@test.example` } });
      const enrollment = await db.enrollment.create({ data: { tenantId: owner.tenantId, courseId: index % 2 ? secondCourse.id : course.id, learnerId: learner.id, status: 'COMPLETED', completedAt: new Date() } });
      const certificate = await service.issue(owner, enrollment.id);
      if (owner === actor && index === 0) await service.revoke(owner, certificate.id, 'Correction');
    }
  }
  app = await createApp(); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
});
after(async () => {
  await app?.close(); await db?.$disconnect();
  await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await sql.end();
});
async function response(query = '', credential = token) {
  return fetch(`${base}/api/certificates${query ? `?${query}` : ''}`, { headers: { authorization: credential ? `Bearer ${credential}` : '' } });
}
async function list(query = '') { const res = await response(query); assert.equal(res.status, 200); return res.json(); }
test('migration backfills active/revoked serials without changing certificate fields or audit history', async () => {
  assert.equal(legacy.length, 2);
  assert.equal(new Set(legacy.map(row => row.serialNumber)).size, 2);
  for (const [index, { serialNumber, ...old }] of legacy.entries()) { assert.match(serialNumber, /^CERT-[0-9A-F]{32}$/); assert.deepEqual(old, oldRows[index]); }
  assert.deepEqual((await sql.query('SELECT * FROM "AuditEvent" WHERE "certificateId"=ANY($1::uuid[]) ORDER BY id', [legacy.map(row => row.id)])).rows, auditBefore);
});
test('serials are generated, immutable, globally unique and format checked by the database', async () => {
  const current = await db.certificate.findFirstOrThrow({ where: { tenantId: actor.tenantId, revokedAt: null } });
  assert.match(current.serialNumber, /^CERT-[0-9A-F]{32}$/);
  await assert.rejects(db.certificate.update({ where: { id: current.id }, data: { serialNumber: `CERT-${'A'.repeat(32)}` } }));
  const enrollment = await db.enrollment.create({ data: { tenantId: other.tenantId, courseId: (await db.course.findFirstOrThrow({ where: { tenantId: other.tenantId } })).id, learnerId: (await db.learner.create({ data: { tenantId: other.tenantId, name: 'Duplicate', email: 'duplicate@test.example' } })).id, status: 'COMPLETED', completedAt: new Date() } });
  const data = { tenantId: other.tenantId, enrollmentId: enrollment.id, issuedById: other.id, issuedAt: new Date(), issueDate: new Date(new Date().toISOString().slice(0,10)), issueTimeZone: 'UTC' };
  await assert.rejects(db.certificate.create({ data: { ...data, serialNumber: current.serialNumber } }));
  await assert.rejects(db.certificate.create({ data: { ...data, serialNumber: 'invalid' } }));
  const issued = await service.issue(other, enrollment.id);
  assert.equal((await service.issue(other, enrollment.id)).serialNumber, issued.serialNumber);
});
test('authorization and validation reject unauthenticated, foreign and malformed inputs', async () => {
  for (const credential of ['', 'invalid', randomBytes(32).toString('base64url')]) assert.equal((await response('', credential)).status, 401);
  for (const query of ['page=0', 'page=-1', 'page=1.2', 'page=1e2', 'page=1000001', 'pageSize=101', 'pageSize=0', 'sortBy=tenantId', 'sortDirection=invalid', 'tenantId='+other.tenantId, 'search='+ 'x'.repeat(201), 'page=1&page=2']) assert.equal((await response(query)).status, 400, query);
});
test('list and counts are tenant scoped; response excludes private database fields', async () => {
  const [clock] = await db.$queryRaw`SELECT now() AS instant`;
  assert.ok(Math.abs(clock.instant.getTime() - Date.now()) < 5000, 'database timestamps preserve UTC instants even when the server defaults to a non-UTC zone');
  const data = await list(); assert.equal(data.total, 25); assert.equal(data.items.length, 20); assert.equal(data.page, 1); assert.equal(data.pageSize, 20);
  assert.ok(data.items.every(row => ['Safety', 'Leadership'].includes(row.courseTitle)));
  assert.deepEqual(Object.keys(data.items[0]).sort(), ['id','serialNumber','learnerName','courseTitle','issuedAt','issueDate','issueTimeZone','status'].sort());
  const foreign = await db.certificate.findFirstOrThrow({ where: { tenantId: other.tenantId } });
  assert.equal((await list(`search=${foreign.serialNumber}`)).total, 0);
});
test('search is partial/case-insensitive by name, exact by serial and literal for SQL wildcards', async () => {
  const named = await list('search=LeArNeR%200'); assert.equal(named.total, 10);
  const serial = named.items[0].serialNumber;
  assert.equal((await list(`search=${serial.toLowerCase()}`)).total, 1);
  assert.equal((await list(`search=${serial.slice(0,-1)}`)).total, 0);
  for (const search of ['%', '_', '\\']) assert.equal((await list(`search=${encodeURIComponent(search)}`)).total, 1);
  assert.equal((await list('search=nobody')).total, 0);
  const all = await list('pageSize=100'); assert.ok(all.items.some(row => row.status === 'revoked')); assert.ok(all.items.some(row => row.status === 'active'));
});
test('every allowed sort is stable in both directions across pages, including ties', async () => {
  for (const sortBy of ['issuedAt','learnerName','serialNumber','courseTitle']) for (const sortDirection of ['asc','desc']) {
    const query = `sortBy=${sortBy}&sortDirection=${sortDirection}`;
    const all = await list(`${query}&pageSize=100`);
    const first = await list(`${query}&pageSize=10`), second = await list(`${query}&pageSize=10&page=2`), third = await list(`${query}&pageSize=10&page=3`);
    assert.deepEqual([...first.items, ...second.items, ...third.items], all.items);
    const keys = all.items.map(row => row[sortBy === 'issuedAt' ? 'issueDate' : sortBy]);
    assert.deepEqual(keys, [...keys].sort((a,b) => a < b ? (sortDirection === 'asc' ? -1 : 1) : a > b ? (sortDirection === 'asc' ? 1 : -1) : 0));
  }
  const beyond = await list('page=99'); assert.equal(beyond.items.length, 0); assert.equal(beyond.total, 25);
});
