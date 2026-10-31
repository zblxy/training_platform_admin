import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import { exportFixture, parseCsv } from '../helpers/export-fixture.mjs';
import { demoId, generateEastCertificates } from '../../prisma/demo-data.mjs';

let f;
before(async () => { f = await exportFixture(); });
after(async () => { await f?.close(); });
const post = (body, token, key) => ({ method: 'POST', body, ...(token ? { token } : {}), ...(key === undefined ? {} : { headers: { 'Idempotency-Key': key } }) });
async function json(path, options, status = 200) {
  const response = await f.request(path, options);
  assert.equal(response.status, status, `${path}: ${await response.clone().text()}`);
  return response.json();
}
async function counts(tenantId) {
  return [await f.db.certificate.count({ where: { tenantId } }), await f.db.auditEvent.count({ where: { tenantId } })];
}
async function bulkCourse(title, eligibleCount = 3) {
  const tenantId = f.east.tenantId;
  const course = await f.db.course.create({ data: { tenantId, title } });
  const enrollments = [];
  for (let i = 0; i < eligibleCount; i++) {
    const learner = await f.db.learner.create({ data: { tenantId, name: `${title} ${i}`, email: `${randomUUID()}@acceptance.test` } });
    enrollments.push(await f.db.enrollment.create({ data: { tenantId, courseId: course.id, learnerId: learner.id, status: 'COMPLETED', completedAt: new Date() } }));
  }
  return { course, enrollments };
}
async function assertIssuances(enrollments) {
  for (const enrollment of enrollments) {
    const rows = await f.db.certificate.findMany({ where: { enrollmentId: enrollment.id } });
    assert.equal(rows.length, 1);
    const audit = await f.db.auditEvent.findMany({ where: { certificateId: rows[0].id } });
    assert.equal(audit.length, 1); assert.equal(audit[0].action, 'ISSUED');
    assert.equal(audit[0].actorId, f.east.adminId);
    assert.equal(audit[0].occurredAt.toISOString(), rows[0].issuedAt.toISOString());
  }
}
async function exported(filters, token = f.east.token) {
  const job = await json('certificates/exports', post(filters, token), 202);
  const deadline = performance.now() + 60000;
  while (performance.now() < deadline) {
    const status = await json(`certificates/exports/${job.id}`, { token });
    assert.notEqual(status.status, 'failed', status.error);
    if (status.status === 'completed') {
      const response = await f.request(`certificates/exports/${job.id}/download`, { token });
      assert.equal(response.status, 200);
      return { job, rows: parseCsv(await response.text()), status };
    }
    await delay(25);
  }
  assert.fail('Export did not complete within 60 seconds');
}

test('1. Bob sees only West across list/detail/bulk/export, with no cross-tenant writes', { timeout: 90000 }, async () => {
  const eastBefore = await counts(f.east.tenantId), westBefore = await counts(f.west.tenantId);
  const own = await f.db.certificate.findFirstOrThrow({ where: { tenantId: f.west.tenantId } });
  const foreign = await f.db.certificate.findFirstOrThrow({ where: { tenantId: f.east.tenantId } });
  const list = await json('certificates?pageSize=100', { token: f.west.token });
  const expected = await f.db.certificate.findMany({ where: { tenantId: f.west.tenantId } });
  assert.deepEqual(list.items.map(row => row.id).sort(), expected.map(row => row.id).sort());
  assert.equal(list.total, expected.length);
  assert.equal((await json(`certificates?search=${foreign.serialNumber}`, { token: f.west.token })).total, 0);
  assert.equal((await f.request(`certificates?tenantId=${f.east.tenantId}`, { token: f.west.token })).status, 400);
  await json(`certificates/${own.id}`, { token: f.west.token });
  const hidden = await json(`certificates/${foreign.id}`, { token: f.west.token }, 404);
  assert.deepEqual(hidden, await json(`certificates/${randomUUID()}`, { token: f.west.token }, 404));
  await json('certificates/bulk-issuance', post({ courseId: demoId('east:Safety') }, f.west.token, randomUUID()), 404);
  assert.equal(await f.db.bulkIssuanceOperation.count({ where: { tenantId: f.west.tenantId } }), 0);
  const eastExport = await exported({ search: '', sortBy: 'courseTitle', sortDirection: 'asc' });
  for (const suffix of ['', '/download']) await json(`certificates/exports/${eastExport.job.id}${suffix}`, { token: f.west.token }, 404);
  await json('certificates/exports', post({ tenantId: f.east.tenantId }, f.west.token), 400);
  const westExport = await exported({ search: '', sortBy: 'serialNumber', sortDirection: 'asc' }, f.west.token);
  assert.deepEqual(westExport.rows.slice(1).map(row => row[2]), expected.map(row => row.serialNumber).sort());
  const noEast = await exported({ search: foreign.serialNumber }, f.west.token);
  assert.equal(noEast.rows.length, 1);
  assert.deepEqual(await counts(f.east.tenantId), eastBefore);
  assert.deepEqual(await counts(f.west.tenantId), westBefore);
});

test('2. Sequential and concurrent same-key requests replay one logical result', { timeout: 30000 }, async () => {
  for (const concurrent of [false, true]) {
    const { course, enrollments } = await bulkCourse(concurrent ? 'Concurrent retry' : 'Sequential retry');
    const key = randomUUID(), before = await counts(f.east.tenantId);
    const run = () => json('certificates/bulk-issuance', post({ courseId: course.id }, undefined, key), 201);
    const results = concurrent ? await Promise.all(Array.from({ length: 6 }, run)) : [await run(), await run(), await run()];
    assert.equal(results[0].issued, enrollments.length);
    for (const result of results) assert.deepEqual(result, results[0]);
    assert.deepEqual(await run(), results[0]);
    assert.deepEqual(await counts(f.east.tenantId), before.map(value => value + enrollments.length));
    assert.equal(await f.db.bulkIssuanceOperation.count({ where: { tenantId: f.east.tenantId, key } }), 1);
    await assertIssuances(enrollments);
  }
});

test('3. Key reuse for a different course returns 409 and preserves the original result', async () => {
  const a = await bulkCourse('Original payload'), b = await bulkCourse('Changed payload');
  const key = randomUUID();
  const first = await json('certificates/bulk-issuance', post({ courseId: a.course.id }, undefined, key), 201);
  const before = await counts(f.east.tenantId);
  await json('certificates/bulk-issuance', post({ courseId: b.course.id }, undefined, key), 409);
  assert.deepEqual(await json('certificates/bulk-issuance', post({ courseId: a.course.id.toUpperCase() }, undefined, key), 201), first);
  // courseId is the only supported payload field; unsupported fields remain 400.
  await json('certificates/bulk-issuance', post({ courseId: a.course.id, learnerIds: [] }, undefined, key), 400);
  assert.deepEqual(await counts(f.east.tenantId), before);
  assert.equal(await f.db.certificate.count({ where: { enrollmentId: { in: b.enrollments.map(row => row.id) } } }), 0);
  for (const invalid of ['', 'bad key', 'x'.repeat(129)]) await json('certificates/bulk-issuance', post({ courseId: b.course.id }, undefined, invalid), 400);
});

test('4. Mixed learner outcomes issue only eligible learners and give skip reasons', async () => {
  const before = await counts(f.east.tenantId);
  const result = await json('certificates/bulk-issuance', post({ courseId: demoId('east:Safety') }, undefined, randomUUID()), 201);
  assert.deepEqual([result.total, result.issued, result.skipped, result.failed], [4, 1, 3, 0]);
  const outcome = name => result.outcomes.find(row => row.learnerName === name);
  assert.equal(outcome('Sam Taylor').status, 'issued');
  assert.equal(outcome('Jordan Smith').reason, 'incomplete');
  assert.equal(outcome('Alex Lee').reason, 'already_issued');
  assert.equal(outcome('Morgan Chen').reason, 'revoked');
  assert.deepEqual(await counts(f.east.tenantId), before.map(value => value + 1));
  assert.equal(await f.db.certificate.count({ where: { enrollmentId: demoId('east:Safety:0') } }), 0);
  await assertIssuances([{ id: demoId('east:Safety:1') }]);
});

test('5. Real browser displays tenant-local time; list/CSV order by local date across DST', { timeout: 120000 }, async () => {
  const clocks = [
    [f.east, '2026-01-10T13:30:00Z', '2026-01-11 00:30', '00000000-0000-0000-0000-000000000020'],
    [f.east, '2026-01-10T14:30:00Z', '2026-01-11 01:30', '00000000-0000-0000-0000-000000000010'],
    [f.west, '2026-01-10T13:30:00Z', '2026-01-10 21:30', randomUUID()],
    [f.east, '2026-04-04T15:59:00Z', '2026-04-05 02:59', randomUUID()],
    [f.east, '2026-04-04T16:00:00Z', '2026-04-05 02:00', randomUUID()],
    [f.east, '2026-10-03T15:59:00Z', '2026-10-04 01:59', randomUUID()],
    [f.east, '2026-10-03T16:00:00Z', '2026-10-04 03:00', randomUUID()],
  ];
  for (const [actor, instant, display, id] of clocks) {
    const tenantId = actor.tenantId;
    const learner = await f.db.learner.create({ data: { tenantId, name: 'Acceptance clock', email: `${id}@clock.test` } });
    const enrollment = await f.db.enrollment.create({ data: { tenantId, learnerId: learner.id, courseId: demoId(`${actor === f.east ? 'east' : 'west'}:Leadership`), status: 'COMPLETED', completedAt: new Date('2025-01-01T00:00:00Z') } });
    await f.db.certificate.create({ data: { id, tenantId, enrollmentId: enrollment.id, issuedById: actor.adminId, issuedAt: new Date(instant), issueDate: new Date(display.slice(0, 10)), issueTimeZone: actor === f.east ? 'Australia/Sydney' : 'Australia/Perth' } });
  }
  let web, browser;
  try {
    web = await preview({ root: fileURLToPath(new URL('../../../web', import.meta.url)), configFile: false, preview: { host: '127.0.0.1', port: 0, proxy: { '/api': f.base } } });
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
    const page = await browser.newPage();
    for (const [actor, , display, id] of clocks) {
      const certificate = await f.db.certificate.findUniqueOrThrow({ where: { id } });
      await page.goto(`http://127.0.0.1:${web.httpServer.address().port}`);
      await page.getByLabel('Generated admin token').fill(actor.token);
      await page.getByRole('button', { name: 'Use token', exact: true }).click();
      await page.getByLabel('Learner name or certificate serial number').fill(certificate.serialNumber);
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      const table = page.getByRole('table', { name: 'Issued certificates' });
      await expect(table.getByRole('cell', { name: display, exact: true })).toBeVisible();
      await table.getByRole('button', { name: certificate.serialNumber }).click();
      await expect(page.getByRole('region', { name: 'Certificate detail', exact: true })).toContainText(`${display} (${certificate.issueTimeZone})`);
    }
  } finally {
    await browser?.close();
    if (web) {
      web.httpServer.closeAllConnections();
      await new Promise((resolve, reject) => web.httpServer.close(error => error ? reject(error) : resolve()));
    }
  }
  for (const actor of [f.east, f.west]) for (const sortDirection of ['asc', 'desc']) {
    const expected = await f.db.certificate.findMany({ where: { tenantId: actor.tenantId, enrollment: { learner: { name: 'Acceptance clock' } } }, orderBy: [{ issueDate: sortDirection }, { id: 'asc' }] });
    const filters = { search: 'Acceptance clock', sortBy: 'issuedAt', sortDirection };
    const list = await json(`certificates?${new URLSearchParams({ ...filters, pageSize: '100' })}`, { token: actor.token });
    assert.deepEqual(list.items.map(row => row.id), expected.map(row => row.id));
    const csv = await exported(filters, actor.token);
    assert.deepEqual(csv.rows.slice(1).map(row => [row[2], row[3]]), expected.map(row => [row.serialNumber, row.issueDate.toISOString().slice(0, 10)]));
  }
});

test('6. Two searched exports over 100,000 East certificates are correct, stable and responsive', { timeout: 300000 }, async t => {
  const westBefore = await counts(f.west.tenantId);
  await generateEastCertificates(f.db);
  assert.equal(await f.db.certificate.count({ where: { tenantId: f.east.tenantId } }), 100000);
  // A real search excludes fixtures; courseTitle deliberately has many equal keys.
  const filters = { search: 'Volume Learner', sortBy: 'courseTitle', sortDirection: 'asc' };
  const expected = await f.db.$queryRaw`SELECT l.name, co.title, c."serialNumber", to_char(c."issueDate", 'YYYY-MM-DD') AS date
    FROM "Certificate" c JOIN "Enrollment" e ON e.id = c."enrollmentId" AND e."tenantId" = c."tenantId"
    JOIN "Learner" l ON l.id = e."learnerId" AND l."tenantId" = e."tenantId"
    JOIN "Course" co ON co.id = e."courseId" AND co."tenantId" = e."tenantId"
    WHERE c."tenantId" = ${f.east.tenantId}::uuid AND l.name ILIKE '%Volume Learner%'
    ORDER BY co.title ASC, c.id ASC`;
  assert.ok(expected.length > 90000 && expected.length < 100000);
  assert.ok(new Set(expected.map(row => row.title)).size < expected.length);
  const timings = [], files = [];
  for (let run = 0; run < 2; run++) {
    const began = performance.now();
    const job = await json('certificates/exports', post(filters), 202);
    let listDuringRunning = false, ready;
    while (performance.now() - began < 60000) {
      const status = await json(`certificates/exports/${job.id}`);
      assert.notEqual(status.status, 'failed', status.error);
      if (run === 0 && status.status === 'running' && !listDuringRunning) {
        const listBegan = performance.now();
        const list = await json(`certificates?${new URLSearchParams({ ...filters, pageSize: '10' })}`, { signal: AbortSignal.timeout(10000) });
        assert.equal(list.total, expected.length);
        assert.deepEqual(list.items.map(row => row.serialNumber), expected.slice(0, 10).map(row => row.serialNumber));
        t.diagnostic(`List requested during running export: ${Math.round(performance.now() - listBegan)}ms`);
        listDuringRunning = true;
      }
      if (status.status === 'completed') { ready = status; break; }
      await delay(25);
    }
    const elapsed = performance.now() - began;
    assert.ok(ready && elapsed < 60000, `Export ${run + 1} exceeded 60 seconds`);
    if (run === 0) assert.ok(listDuringRunning, 'Must observe running job and issue list request before completion');
    assert.equal(ready.total, expected.length); assert.equal(ready.processed, expected.length);
    const response = await f.request(`certificates/exports/${job.id}/download`);
    assert.equal(response.status, 200);
    const rows = parseCsv(await response.text());
    assert.deepEqual(rows[0], ['Learner name', 'Course title', 'Serial number', 'Issue date']);
    assert.deepEqual(rows.slice(1), expected.map(row => [row.name, row.title, row.serialNumber, row.date]));
    assert.equal(new Set(rows.slice(1).map(row => row[2])).size, expected.length);
    files.push(rows); timings.push(Math.round(elapsed));
  }
  assert.deepEqual(files[0], files[1]);
  assert.deepEqual(await counts(f.west.tenantId), westBefore);
  t.diagnostic(JSON.stringify({ node: process.version, eastCertificates: 100000, matchingRows: expected.length, exportMilliseconds: timings }));
});

test('7. Repeated revocation keeps the first result and exactly one revocation audit', async () => {
  const certificate = await f.db.certificate.findFirstOrThrow({ where: { tenantId: f.east.tenantId, revokedAt: null } });
  const before = await counts(f.east.tenantId);
  const path = `certificates/${certificate.id}/revoke`;
  const first = await json(path, post({ reason: 'Acceptance correction' }));
  assert.equal(first.status, 'revoked');
  const repeat = await json(path, post({ reason: 'A different repeat reason' }));
  assert.deepEqual(repeat, first);
  assert.deepEqual(await json(`certificates/${certificate.id}`), first);
  assert.deepEqual(await counts(f.east.tenantId), [before[0], before[1] + 1]);
  const audits = await f.db.auditEvent.findMany({ where: { certificateId: certificate.id, action: 'REVOKED' } });
  assert.equal(audits.length, 1); assert.equal(audits[0].actorId, f.east.adminId);
  assert.equal(audits[0].occurredAt.toISOString(), first.revokedAt);
});
