import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { exportFixture } from '../helpers/export-fixture.mjs';
import { createApp } from '../../dist/app.js';
import { hashToken } from '../../dist/modules/auth/auth.module.js';
import { demoId } from '../../prisma/demo-data.mjs';
let f;
before(async () => { f = await exportFixture(); });
after(async () => { await f?.close(); });
async function bulk(courseId, key, token = f.east.token, base = f.base) {
  return fetch(`${base}/api/certificates/bulk-issuance`, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ courseId }), signal: AbortSignal.timeout(15000) });
}
async function enrollment(courseId, name) {
  const tenantId = f.east.tenantId;
  const learner = await f.db.learner.create({ data: { tenantId, name, email: `${randomUUID()}@retry.test` } });
  return f.db.enrollment.create({ data: { tenantId, courseId, learnerId: learner.id, status: 'COMPLETED', completedAt: new Date() } });
}
test('saved snapshots resume after restart; other instances replay exactly the same outcomes', async () => {
  const tenantId = f.east.tenantId, requestedById = f.east.adminId, key = randomUUID();
  const course = await f.db.course.create({ data: { tenantId, title: 'Resume' } });
  const first = await enrollment(course.id, 'Original name'), pending = await enrollment(course.id, 'Pending');
  const operation = await f.db.bulkIssuanceOperation.create({ data: { tenantId, requestedById, courseId: course.id, key } });
  // Reproduce durable state left by a process exiting after the first commit.
  await f.db.$transaction(async tx => {
    const certificate = await tx.certificate.create({ data: { tenantId, enrollmentId: first.id, issuedById: requestedById,
      issuedAt: new Date('2026-01-10T13:30:00Z'), issueDate: new Date('2026-01-11'), issueTimeZone: 'Australia/Sydney' } });
    await tx.bulkIssuanceItem.createMany({ data: [
      { operationId: operation.id, enrollmentId: first.id, learnerId: first.learnerId, learnerName: 'Original name',
        outcome: { enrollmentId: first.id, learnerId: first.learnerId, learnerName: 'Original name', status: 'issued', certificateId: certificate.id, serialNumber: certificate.serialNumber } },
      { operationId: operation.id, enrollmentId: pending.id, learnerId: pending.learnerId, learnerName: 'Pending' },
    ] });
  });
  await f.db.learner.update({ where: { id: first.learnerId }, data: { name: 'Changed name' } });
  const late = await enrollment(course.id, 'Joined after snapshot');
  const app = await createApp(); await app.listen(0, '127.0.0.1');
  let result;
  try {
    const responses = await Promise.all([bulk(course.id, key), bulk(course.id, key, f.east.token, await app.getUrl())]);
    const results = await Promise.all(responses.map(async response => { assert.equal(response.status, 201); return response.json(); }));
    assert.deepEqual(results[0], results[1]); result = results[0];
    assert.deepEqual([result.total, result.issued, result.skipped, result.failed], [2, 2, 0, 0]);
    assert.equal(result.outcomes.find(row => row.enrollmentId === first.id).learnerName, 'Original name');
    assert.equal(await f.db.certificate.count({ where: { enrollmentId: late.id } }), 0);
    assert.equal(await f.db.auditEvent.count({ where: { certificate: { enrollmentId: { in: [first.id, pending.id] } }, action: 'ISSUED' } }), 2);
  } finally { await app.close(); }
  const restarted = await createApp(); await restarted.listen(0, '127.0.0.1');
  try { assert.deepEqual(await (await bulk(course.id, key, f.east.token, await restarted.getUrl())).json(), result); }
  finally { await restarted.close(); }
});
test('key scope isolates tenants and admins, and conflicts cannot overwrite a result', async () => {
  const key = randomUUID();
  const first = await (await bulk(demoId('east:Leadership'), key)).json();
  assert.equal((await bulk(demoId('east:Safety'), key)).status, 409);
  assert.equal((await bulk(demoId('west:Leadership'), key, f.west.token)).status, 201);
  const otherToken = randomBytes(32).toString('base64url');
  await f.db.admin.create({ data: { tenantId: f.east.tenantId, name: 'Other East admin', tokenHash: hashToken(otherToken) } });
  assert.equal((await bulk(demoId('east:Safety'), key, otherToken)).status, 201);
  assert.equal(await f.db.bulkIssuanceOperation.count({ where: { key } }), 3);
  assert.deepEqual(await (await bulk(demoId('east:Leadership'), key)).json(), first);
});
test('failed inserts roll back certificates/audits and persist a safe replayable failure', async () => {
  const tenantId = f.east.tenantId, key = randomUUID();
  const course = await f.db.course.create({ data: { tenantId, title: 'Insert failure' } });
  const item = await enrollment(course.id, 'Failing learner');
  await f.db.$executeRawUnsafe(`CREATE FUNCTION reject_keyed_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW."enrollmentId" = '${item.id}'::uuid THEN RAISE EXCEPTION 'private insertion detail'; END IF; RETURN NEW; END $$`);
  await f.db.$executeRawUnsafe('CREATE TRIGGER reject_keyed_insert BEFORE INSERT ON "Certificate" FOR EACH ROW EXECUTE FUNCTION reject_keyed_insert()');
  let result;
  try {
    result = await (await bulk(course.id, key)).json();
    assert.equal(result.failed, 1); assert.equal(result.outcomes[0].reason, 'issuance_failed');
    assert.doesNotMatch(JSON.stringify(result), /private insertion detail/);
    assert.equal(await f.db.certificate.count({ where: { enrollmentId: item.id } }), 0);
    assert.equal(await f.db.auditEvent.count({ where: { certificate: { enrollmentId: item.id } } }), 0);
  } finally { await f.db.$executeRawUnsafe('DROP TRIGGER reject_keyed_insert ON "Certificate"'); }
  assert.deepEqual(await (await bulk(course.id, key)).json(), result);
  const retry = await (await bulk(course.id, randomUUID())).json();
  assert.equal(retry.issued, 1); assert.equal(retry.failed, 0);
});

test('failure saving an issued outcome rolls back its issuance and leaves the item resumable', async () => {
  const tenantId = f.east.tenantId, key = randomUUID();
  const course = await f.db.course.create({ data: { tenantId, title: 'Outcome failure' } });
  const item = await enrollment(course.id, 'Outcome write failure');
  await f.db.$executeRawUnsafe(`CREATE FUNCTION reject_outcome_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW."enrollmentId" = '${item.id}'::uuid THEN RAISE EXCEPTION 'private outcome detail'; END IF; RETURN NEW; END $$`);
  await f.db.$executeRawUnsafe('CREATE TRIGGER reject_outcome_write BEFORE UPDATE ON "BulkIssuanceItem" FOR EACH ROW EXECUTE FUNCTION reject_outcome_write()');
  try {
    const response = await bulk(course.id, key);
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /private outcome detail/);
    assert.equal(await f.db.certificate.count({ where: { enrollmentId: item.id } }), 0);
    assert.equal(await f.db.auditEvent.count({ where: { certificate: { enrollmentId: item.id } } }), 0);
    const operation = await f.db.bulkIssuanceOperation.findFirstOrThrow({ where: { key } });
    const saved = await f.db.bulkIssuanceItem.findUniqueOrThrow({ where: { operationId_enrollmentId: { operationId: operation.id, enrollmentId: item.id } } });
    assert.equal(saved.outcome, null);
  } finally { await f.db.$executeRawUnsafe('DROP TRIGGER reject_outcome_write ON "BulkIssuanceItem"'); }
  const result = await (await bulk(course.id, key)).json();
  assert.equal(result.issued, 1);
  assert.deepEqual(await (await bulk(course.id, key)).json(), result);
  assert.equal(await f.db.auditEvent.count({ where: { certificate: { enrollmentId: item.id }, action: 'ISSUED' } }), 1);
});

test('database rejects cross-tenant operation references and duplicate actor keys', async () => {
  const data = { tenantId: f.east.tenantId, requestedById: f.east.adminId, courseId: demoId('east:Leadership'), key: randomUUID() };
  await assert.rejects(f.db.bulkIssuanceOperation.create({ data: { ...data, requestedById: f.west.adminId } }));
  await assert.rejects(f.db.bulkIssuanceOperation.create({ data: { ...data, courseId: demoId('west:Leadership') } }));
  await f.db.bulkIssuanceOperation.create({ data });
  await assert.rejects(f.db.bulkIssuanceOperation.create({ data }));
});
