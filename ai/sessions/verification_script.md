# Add verification acceptance script

> start a new codex worktree to implement verification acceptance script. from now on, use plan mode. Inspect the relevant files, ask clarifying questions if needed, then propose the implementation plan before writing code.\
> verification details:
>
> 1. Tenant isolation: Bob attempts to access East data or invoke East-scoped operations through the list, detail, bulk issue,and export endpoints. Expected: Only West data is accessible. A cross tenant detail request returns 404 or anequivalent non-revealing response. Cross-tenant bulk issue is rejejected and creates no certificates or audit events.
> 2. Retry safety: Alice sends the same bulk request with the same idempotency key sequentially and concurrently. Expected: One logical operation. Each eligible learner receives at most one certificate.Each actual issuance has exactly one audit event. All callers receive the outcome of the same logical operation,without additional certificates or audit events.
> 3. Key misuse: Alice reuses the same idempotency key with a different course orrequest payload. Expected: Return 409. Do not execute a second operation or overwrite the first result.
> 4. Learner outcomes: A course contains completed,incomplete, and already certified learners. Expected: Certificates are issued only to eligible learners. Incomplete and duplicate cases are skipped with reasons.
> 5. DST and local date: An East certificate has UTC timestamp 2026-01-10T13:30:00Z.A West certificate has the same timestamp. Expected: East displays 2026-01-11 00:30. Westdisplays 2026-01-10 21:30. List sorting and CSV use the tenant-local calendar date.
> 6. Export growth: Generate 100,000 East certificates,including rows with equal valuesfor the requested sort field. Apply asearch and sort, then run the export twice. During the first export, request the certificate list. Expected: Each export completes within 60 seconds. The CSV contains exactly the matching East rows in the requested order. Rows with equal sort keys appear in the same relative order on repeated exports. The certificate list request succeeds while the export is running.
> 7. Revocation audit: Alice revokes a valid certificate,then repeats the request. Expected: The first request changes status and writes one revocation audit event. The repeat does not create duplicate audit events.

<details><summary>5 previous messages</summary>

> I’ll inspect the existing verification scripts, APIs, and worktree setup, then propose a plan before writing code. I’ll keep this phase to inspection and planning; the session is currently in Default mode, which I can’t switch through a tool.
>
> <details><summary>Explored 6 files, a search, a list, ran 5 commands</summary>
>
> - Ran `pwd; git status --short; git worktree list; rg --files -g 'AGENTS.md' -g '*accept*' -g '*bulk*' -g '*export*' -g '*certificate*' -g 'package.json' -g '*seed*' -g '*time*' -g '*date*' -g 'README.md' -g 'data-model.md'`
>
> - Ran `cat apps/api/prisma/seed-large.mjs; cat apps/web/e2e/certificates.spec.ts apps/web/e2e/certificate-detail.spec.ts; cat docs/data-model.md`
>
> - Ran `cat AGENTS.md package.json apps/api/package.json apps/web/package.json; cat README.md`
>
> - Ran `cat apps/api/test/integration/bulk-issuance.test.mjs apps/api/test/performance/certificate-exports.test.mjs apps/api/test/helpers/export-fixture.mjs`
>
> - Ran `cat apps/api/test/performance/certificate-exports.test.mjs apps/api/test/helpers/export-fixture.mjs`
>
> <details><summary>Explored 6 files, a search, a list</summary>
>
> - Read `./apps/api/test/integration/certificate-detail.test.mjs`
> - Read `./apps/api/src/modules/certificates/certificates.controller.ts`
> - Read `./apps/web/playwright.config.ts`
> - Listed files in `helpers`
> - Read `./apps/api/test/integration/certificate-exports.test.mjs`
> - Read `./apps/api/test/integration/bulk-issuance.test.mjs`
> - Read `./apps/api/src/modules/certificates/bulk-issuance.dto.ts`
> - Searched for `idempot|requestKey|timeZone|Sydney|Perth|Alice|Bob` in `seed.mjs`
>
> </details>
>
> </details>
>
> The existing tests provide useful fixtures, but two acceptance requirements go beyond current behavior: bulk issuance has no idempotency-key support or saved response, and the UI displays the tenant-local date without a time. I’ll clarify whether this task should expose those gaps or also implement the missing behavior.
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `git worktree add -b codex/verification-acceptance /tmp/training-platform-verification-acceptance HEAD`
> - Ran `cat apps/api/src/modules/certificates/certificates.service.ts apps/api/src/modules/certificates/certificate-list-query.ts; rg -n 'issueDate|issuedAt|DateTimeFormat' apps/web/src; cat apps/api/prisma/demo-data.mjs`
> - Ran `git status --short; rg --files -g AGENTS.md; cat apps/api/tsconfig.tools.json eslint.config.mjs; cat apps/api/src/modules/certificate-exports/export-worker.ts`
>
> </details>
>
> Should this work add only the acceptance script and report failures in current behavior, or also implement application changes needed to pass all seven scenarios? Bulk idempotency-key replay/409 behavior and local date-time display are currently missing.
> - Acceptance script only; report gaps
> - Script plus application fixes
</details>

Created branch `codex/verification-acceptance` in `/tmp/training-platform-verification-acceptance`. No code changes yet; existing untracked files remain untouched.

Inspection found three gaps relevant to acceptance:

- Bulk issuance prevents duplicate certificates, but has no idempotency-key replay or key-conflict handling.
- The UI displays dates without local times.
- List and export sorting currently use `issuedAt`, rather than the local calendar date.

Proposed plan:

1. Add an `npm run test:acceptance` command using an isolated PostgreSQL test schema, real migrations, fresh Alice/Bob credentials, and local API/browser processes.
2. Verify Bob’s tenant boundaries across list, detail, bulk issuance, and export creation/status/download. Check database counts to prove rejected operations produce no certificates or audits.
3. Test sequential and concurrent same-key requests, identical replay outcomes, and different-payload conflicts. Independently verify certificate and audit counts.
4. Check completed, incomplete, already-certified, and revoked learner outcomes and reasons.
5. Add the exact January timestamp fixtures; verify local display, date sorting, and CSV dates. Include fixtures around Sydney’s DST transition.
6. Generate 100,000 East certificates with tied sort values. Run two filtered exports, compare every row against an independent database expectation, verify stable ordering and each 60-second deadline, and confirm a list request succeeds during the first export.
7. Verify repeated revocation preserves the first result and creates exactly one revocation audit.
8. Document prerequisites and per-scenario results, run relevant checks, and report failures without weakening assertions.

I recommend keeping this task focused on the acceptance script and reporting application gaps. Please confirm that scope and approve the plan before implementation, as required by [AGENTS.md](./AGENTS.md).

> **Should this work add only the acceptance script and report failures in current behavior, or also implement application changes needed to pass all seven scenarios? Bulk idempotency-key replay/409 behavior and local date-time display are currently missing.**
>
> Script plus application fixes

<details><summary>2 previous messages</summary>

> I’ll expand the plan to include application fixes. Before writing code, I’ll inspect the schema and public contracts so the revised plan covers durable idempotency and local date-time behavior.
>
> <details><summary>Ran 2 commands</summary>
>
> - Ran `cat apps/api/prisma/schema.prisma; cat packages/shared/src/certificates.ts packages/shared/src/bulk-issuance.ts; cat apps/api/src/modules/certificate-exports/export-queue.ts`
> - Ran `cat apps/web/src/features/certificates/CertificateList.tsx apps/web/src/features/certificates/CertificateDetail.tsx; rg --files apps/web/src/features; cat apps/api/src/modules/certificates/list-certificates.dto.ts; cat apps/api/src/app.ts; cat apps/api/src/common/database/database.service.ts`
>
> </details>
</details>

The worktree is ready at `/tmp/training-platform-verification-acceptance` on `codex/verification-acceptance`.

With application fixes included, the revised plan is:

1. **Durable bulk idempotency:** Accept a validated `Idempotency-Key` header, scoped to tenant and admin. Add migration-backed operation records and saved learner outcomes. Sequential and concurrent retries return the same result; reuse with a different course returns 409. Persist issuance and its outcome atomically so interrupted requests can resume safely. Preserve requests without a key for existing clients.
2. **Browser retries:** Generate a key for each new bulk submission and retain it when retrying an uncertain response.
3. **Local dates and times:** Include the certificate’s saved timezone in list responses. Display tenant-local date and time in list/detail. Sort list and CSV by the saved local calendar date, with certificate ID as the stable tie-breaker. Keep CSV dates as `YYYY-MM-DD`.
4. **Acceptance runner:** Add `npm run test:acceptance` covering all seven scenarios against real HTTP endpoints, PostgreSQL audit records, and browser rendering. Use a fresh isolated schema and generated credentials.
5. **Export verification:** Generate 100,000 East certificates, apply search and sorting with tied values, compare both CSVs against an independent database expectation, enforce each 60-second deadline, and verify list access during export.
6. **Validation and documentation:** Add regression coverage, document the key contract and runner prerequisites, apply migrations only to an isolated test database, and run lint, typecheck, build, unit, database, and affected browser checks.

No application code has been changed. Please approve this expanded plan before implementation; [AGENTS.md](./AGENTS.md) requires approval before writing code and for material scope changes.

> approve

<details><summary>12 previous messages</summary>

> The plan is approved. I’ll implement the fixes and acceptance runner in the new worktree, then run them against an isolated test database.
>
> <details><summary>Created a file, edited 2 files, explored 7 files, 3 lists, ran 3 commands</summary>
>
> <details><summary>Explored 4 files, 3 lists</summary>
>
> - Read `./apps/web/src/features/bulk-issuance/BulkIssuance.tsx`
> - Read `./apps/api/test/certificates.test.mjs`
> - Read `./apps/api/test/bulk-issuance.test.mjs`
> - Read `./apps/api/src/common/filters/http-error.filter.ts`
> - Listed files in `migrations`
> - Listed files in `training-model-postgres`
> - Listed files in `node`
>
> </details>
>
> - Ran `npm ci --cache /tmp/training-platform-npm-cache --no-audit --no-fund`
>
> <details><summary>Explored 3 files</summary>
>
> - Read `/tmp/training-model-postgres/start.mjs`
> - Read `./apps/api/src/modules/certificates/certificates.service.ts`
> - Read `./apps/api/test/integration/certificate-list.test.mjs`
>
> </details>
>
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> npm ci --cache /tmp/training-platform-npm-cache --no-audit --no-fund`
>
> - Wrote `/tmp/training-platform-verification-acceptance/apps/api/prisma/migrations/20261031030000_bulk_idempotency/migration.sql` (+21 -0)
> - Wrote `/tmp/training-platform-verification-acceptance/apps/api/prisma/schema.prisma` (+24 -0)
> - Wrote `/tmp/training-platform-verification-acceptance/apps/api/src/modules/certificates/certificates.controller.ts` (+6 -3)
>
> - Ran ``python3 - <<'PY'
> p='apps/api/src/modules/certificates/certificates.service.ts'
> s=open(p).read().replace("import type { BulkIssuanceOutcome", "import { isBulkIssuanceResponse } from '@training/shared';\nimport type { BulkIssuanceOutcome")
> s=s.replace(': { [sortBy]: sortDirection };', ": { [sortBy === 'issuedAt' ? 'issueDate' : sortBy]: sortDirection };")
> s=s.replace('issuedAt: true, issueDate: true, revokedAt: true,','issuedAt: true, issueDate: true, issueTimeZone: true, revokedAt: true,')
> s=s.replace('issueDate: row.issueDate.toISOString().slice(0, 10), status:', 'issueDate: row.issueDate.toISOString().slice(0, 10), issueTimeZone: row.issueTimeZone, status:')
> pos=s.index('  async issue(actor:')
> s=s[:pos]+'''  async bulkIssueWithKey(actor: Actor, courseId: string, key: string): Promise<BulkIssuanceResponse> {
>     const operation = await this.db.$transaction(async tx => {
>       // Serialize creation across processes; hash collisions only add contention.
>       await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`${actor.tenantId}:${actor.id}:${key}`}, 0))`;
>       const existing = await tx.bulkIssuanceOperation.findUnique({
>         where: { tenantId_requestedById_key: { tenantId: actor.tenantId, requestedById: actor.id, key } },
>       });
>       if (existing) {
>         if (existing.courseId !== courseId) throw new ConflictException('Idempotency key already used for a different request');
>         return existing;
>       }
>       const course = await tx.course.findFirst({ where: { id: courseId, tenantId: actor.tenantId }, select: { id: true } });
>       if (!course) throw new NotFoundException('Course not found');
>       const created = await tx.bulkIssuanceOperation.create({ data: { tenantId: actor.tenantId, requestedById: actor.id, courseId, key } });
>       // Persist membership/names in the same transaction as operation creation.
>       await tx.$executeRaw`INSERT INTO "BulkIssuanceItem" ("operationId", "enrollmentId", "learnerId", "learnerName")
>         SELECT ${created.id}::uuid, e.id, l.id, l.name FROM "Enrollment" e
>         JOIN "Learner" l ON l.id = e."learnerId" AND l."tenantId" = e."tenantId"
>         WHERE e."tenantId" = ${actor.tenantId}::uuid AND e."courseId" = ${courseId}::uuid`;
>       return created;
>     }, { timeout: 30000 });
>     const items = await this.db.bulkIssuanceItem.findMany({ where: { operationId: operation.id }, orderBy: { enrollmentId: 'asc' } });
>     const outcomes: Prisma.JsonValue[] = [];
>     for (const item of items) {
>       if (item.outcome !== null) { outcomes.push(item.outcome); continue; }
>       const where = { operationId_enrollmentId: { operationId: operation.id, enrollmentId: item.enrollmentId } };
>       const learner = { enrollmentId: item.enrollmentId, learnerId: item.learnerId, learnerName: item.learnerName };
>       const lock = async (tx: Prisma.TransactionClient) => {
>         await tx.$queryRaw`SELECT "enrollmentId" FROM "BulkIssuanceItem"
>           WHERE "operationId" = ${operation.id}::uuid AND "enrollmentId" = ${item.enrollmentId}::uuid FOR UPDATE`;
>         return tx.bulkIssuanceItem.findUniqueOrThrow({ where });
>       };
>       let outcome: Prisma.JsonValue;
>       try {
>         outcome = await this.db.$transaction(async tx => {
>           const current = await lock(tx);
>           if (current.outcome !== null) return current.outcome;
>           const issued = await this.issueInTransaction(tx, actor, item.enrollmentId);
>           const saved: BulkIssuanceOutcome = issued.created
>             ? { ...learner, status: 'issued', certificateId: issued.certificate.id, serialNumber: issued.certificate.serialNumber }
>             : { ...learner, status: 'skipped', reason: issued.certificate.revokedAt ? 'revoked' : 'already_issued' };
>           await tx.bulkIssuanceItem.update({ where, data: { outcome: saved } });
>           return saved;
>         });
>       } catch (error: unknown) {
>         // Failed issuance rolls back before recording its outcome. A concurrent
>         // successful caller may already have finalized this item; preserve it.
>         outcome = await this.db.$transaction(async tx => {
>           const current = await lock(tx);
>           if (current.outcome !== null) return current.outcome;
>           const saved: BulkIssuanceOutcome = error instanceof ConflictException
>             ? { ...learner, status: 'skipped', reason: 'incomplete' }
>             : { ...learner, status: 'failed', reason: 'issuance_failed' };
>           await tx.bulkIssuanceItem.update({ where, data: { outcome: saved } });
>           return saved;
>         });
>       }
>       outcomes.push(outcome);
>     }
>     const result = { courseId: operation.courseId, total: outcomes.length,
>       issued: outcomes.filter(row => typeof row === 'object' && row !== null && !Array.isArray(row) && row.status === 'issued').length,
>       skipped: outcomes.filter(row => typeof row === 'object' && row !== null && !Array.isArray(row) && row.status === 'skipped').length,
>       failed: outcomes.filter(row => typeof row === 'object' && row !== null && !Array.isArray(row) && row.status === 'failed').length, outcomes };
>     if (!isBulkIssuanceResponse(result)) throw new Error('Invalid saved bulk result');
>     return result;
>   }
> ''' + s[pos:]
> s=s.replace('return this.db.$transaction(async tx => {\n      // One lock per enrollment', 'return this.db.$transaction(tx => this.issueInTransaction(tx, actor, enrollmentId));\n  }\n  private async issueInTransaction(tx: Prisma.TransactionClient, actor: Actor, enrollmentId: string) {\n      // One lock per enrollment')
> s=s.replace('return { certificate, created: true };\n    });\n  }', 'return { certificate, created: true };\n  }')
> open(p,'w').write(s)
> p='packages/shared/src/certificates.ts'
> s=open(p).read().replace('  issueDate: string;','  issueDate: string;\n  issueTimeZone: string;').replace("typeof entry.issuedAt === 'string' && typeof entry.issueDate === 'string' &&", "typeof entry.issuedAt === 'string' && typeof entry.issueDate === 'string' && typeof entry.issueTimeZone === 'string' &&").replace('export interface CertificateDetail extends CertificateListItem {\n  issueTimeZone: string;', 'export interface CertificateDetail extends CertificateListItem {')
> open(p,'w').write(s)
> p='apps/api/src/modules/certificate-exports/export-queue.ts'
> s=open(p).read().replace('issuedAt: Prisma.sql`c."issuedAt"`', 'issuedAt: Prisma.sql`c."issueDate"`')
> open(p,'w').write(s)
> PY``
>
> </details>
>
> The keyed bulk flow now saves its learner snapshot and each outcome in PostgreSQL. Each successful issuance and its saved outcome share a transaction, so a lost response can be replayed without changing an “issued” result into “already issued.” Next I’ll wire browser retry keys and local date-time display, then build the acceptance checks.
>
> <details><summary>Created a file, edited 2 files, ran 9 commands</summary>
>
> - Ran `python3 - <<'PY'
> p='apps/web/src/features/bulk-issuance/BulkIssuance.tsx'
> s=open(p).read().replace("const submitting = useRef(false);", "const submitting = useRef(false);\n  const requestKey = useRef<string | null>(null);")
> s=s.replace("submitting.current = true;", "submitting.current = true;\n    requestKey.current ??= crypto.randomUUID();")
> s=s.replace("'Content-Type': 'application/json' }, body:", "'Content-Type': 'application/json', 'Idempotency-Key': requestKey.current }, body:")
> s=s.replace("if (response.status === 404)", "if (response.status === 409) throw new Error('This request key was used for another request. Select the course again to start a new operation.');\n      if (response.status === 404)")
> s=s.replace('Retrying the course safely skips existing certificates.', 'Retrying returns the same operation result.').replace('Retrying safely skips existing certificates.', 'Retrying returns the same operation result.')
> s=s.replace('setResult(data); onComplete();', 'setResult(data); requestKey.current = null; onComplete();')
> s=s.replace("setCourseId(''); setResult(null);", "requestKey.current = null; setCourseId(''); setResult(null);")
> s=s.replace('setCourseId(event.target.value);', 'requestKey.current = null; setCourseId(event.target.value);')
> open(p,'w').write(s)
> # Update mock list contracts and the independent database sort assertions.
> for p in ['apps/api/test/integration/certificate-list.test.mjs']:
>  s=open(p).read().replace("'issuedAt','issueDate','status'", "'issuedAt','issueDate','issueTimeZone','status'").replace('row[sortBy]', "row[sortBy === 'issuedAt' ? 'issueDate' : sortBy]")
>  open(p,'w').write(s)
> PY
> rg -n 'issueDate:|issueDate =' apps/web/e2e apps/api/test`
> - Wrote `/tmp/training-platform-verification-acceptance/apps/web/src/features/certificates/CertificateDetail.tsx` (+2 -1)
> - Wrote `/tmp/training-platform-verification-acceptance/apps/web/src/features/certificates/CertificateList.tsx` (+3 -2)
> - Wrote `/tmp/training-platform-verification-acceptance/apps/web/src/features/certificates/local-date-time.ts` (+8 -0)
> - Ran `cat apps/web/vite.config.ts apps/web/src/main.tsx; cat apps/api/test/integration/models.test.mjs; cat .gitignore; cat apps/api/src/modules/certificate-exports/certificate-exports.service.ts; cat apps/web/e2e/bulk-issuance.spec.ts`
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> npm run typecheck`
> - Ran `python3 - <<'PY'
> for p in ['apps/web/e2e/certificates.spec.ts','apps/web/e2e/certificate-exports.spec.ts']:
>  s=open(p).read().replace("issueDate: '2025-12-31',", "issueDate: '2025-12-31', issueTimeZone: 'America/New_York',")
>  open(p,'w').write(s)
> p='apps/web/e2e/certificate-detail.spec.ts'
> s=open(p).read().replace('2025-12-31 (America/New_York)','2025-12-31 20:00 (America/New_York)')
> open(p,'w').write(s)
> p='apps/api/test/helpers/export-fixture.mjs'
> s=open(p).read().replace("body, token = [REDACTED_SECRET] }", "body, token = [REDACTED_SECRET] headers = {}, signal = AbortSignal.timeout(70000) }")
> s=s.replace("method, headers: { Authorization:", "method, signal, headers: { ...headers, Authorization:")
> open(p,'w').write(s)
> import json
> p='package.json'
> s=json.load(open(p)); s['scripts']['test:acceptance']='npm run build && npm run test:acceptance -w @training/api'
> open(p,'w').write(json.dumps(s,indent=2)+'\n')
> p='apps/api/package.json'
> s=json.load(open(p)); s['scripts']['test:acceptance']='node --test --test-concurrency=1 test/acceptance/*.test.mjs'
> open(p,'w').write(json.dumps(s,indent=2)+'\n')
> PY`
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> npm run typecheck`
> - Ran `ps -eo pid,comm,args`
> - Ran `/home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/training-model-postgres/start.mjs`
> - Ran `/home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/training-model-postgres/start.mjs`
> - Ran ``mkdir -p apps/api/test/acceptance
> cat > apps/api/test/acceptance/verification.test.mjs <<'EOF'
> import { test, before, after } from 'node:test';
> import assert from 'node:assert/strict';
> import { randomUUID } from 'node:crypto';
> import { fileURLToPath } from 'node:url';
> import { setTimeout as delay } from 'node:timers/promises';
> import { chromium, expect } from '@playwright/test';
> import { preview } from 'vite';
> import { exportFixture, parseCsv } from '../helpers/export-fixture.mjs';
> import { demoId, generateEastCertificates } from '../../prisma/demo-data.mjs';
>
> let f;
> before(async () => { f = await exportFixture(); });
> after(async () => { await f?.close(); });
> const post = (body, token, key) => ({ method: 'POST', body, ...(token ? { token } : {}), ...(key === undefined ? {} : { headers: { 'Idempotency-Key': key } }) });
> async function json(path, options, status = 200) {
>   const response = await f.request(path, options);
>   assert.equal(response.status, status, `${path}: ${await response.clone().text()}`);
>   return response.json();
> }
> async function counts(tenantId) {
>   return [await f.db.certificate.count({ where: { tenantId } }), await f.db.auditEvent.count({ where: { tenantId } })];
> }
> async function bulkCourse(title, eligibleCount = 3) {
>   const tenantId = f.east.tenantId;
>   const course = await f.db.course.create({ data: { tenantId, title } });
>   const enrollments = [];
>   for (let i = 0; i < eligibleCount; i++) {
>     const learner = await f.db.learner.create({ data: { tenantId, name: `${title} ${i}`, email: `${randomUUID()}@acceptance.test` } });
>     enrollments.push(await f.db.enrollment.create({ data: { tenantId, courseId: course.id, learnerId: learner.id, status: 'COMPLETED', completedAt: new Date() } }));
>   }
>   return { course, enrollments };
> }
> async function assertIssuances(enrollments) {
>   for (const enrollment of enrollments) {
>     const rows = await f.db.certificate.findMany({ where: { enrollmentId: enrollment.id } });
>     assert.equal(rows.length, 1);
>     const audit = await f.db.auditEvent.findMany({ where: { certificateId: rows[0].id } });
>     assert.equal(audit.length, 1); assert.equal(audit[0].action, 'ISSUED');
>     assert.equal(audit[0].actorId, f.east.adminId);
>     assert.equal(audit[0].occurredAt.toISOString(), rows[0].issuedAt.toISOString());
>   }
> }
> async function exported(filters, token = [REDACTED_SECRET] {
>   const job = await json('certificates/exports', post(filters, token), 202);
>   const deadline = performance.now() + 60000;
>   while (performance.now() < deadline) {
>     const status = await json(`certificates/exports/${job.id}`, { token });
>     assert.notEqual(status.status, 'failed', status.error);
>     if (status.status === 'completed') {
>       const response = await f.request(`certificates/exports/${job.id}/download`, { token });
>       assert.equal(response.status, 200);
>       return { job, rows: parseCsv(await response.text()), status };
>     }
>     await delay(25);
>   }
>   assert.fail('Export did not complete within 60 seconds');
> }
>
> test('1. Bob sees only West across list/detail/bulk/export, with no cross-tenant writes', { timeout: 90000 }, async () => {
>   const eastBefore = await counts(f.east.tenantId), westBefore = await counts(f.west.tenantId);
>   const own = await f.db.certificate.findFirstOrThrow({ where: { tenantId: f.west.tenantId } });
>   const foreign = await f.db.certificate.findFirstOrThrow({ where: { tenantId: f.east.tenantId } });
>   const list = await json('certificates?pageSize=100', { token: [REDACTED_SECRET] });
>   const expected = await f.db.certificate.findMany({ where: { tenantId: f.west.tenantId } });
>   assert.deepEqual(list.items.map(row => row.id).sort(), expected.map(row => row.id).sort());
>   assert.equal(list.total, expected.length);
>   assert.equal((await json(`certificates?search=${foreign.serialNumber}`, { token: [REDACTED_SECRET] })).total, 0);
>   assert.equal((await f.request(`certificates?tenantId=${f.east.tenantId}`, { token: [REDACTED_SECRET] })).status, 400);
>   await json(`certificates/${own.id}`, { token: [REDACTED_SECRET] });
>   const hidden = await json(`certificates/${foreign.id}`, { token: [REDACTED_SECRET] }, 404);
>   assert.deepEqual(hidden, await json(`certificates/${randomUUID()}`, { token: [REDACTED_SECRET] }, 404));
>   await json('certificates/bulk-issuance', post({ courseId: demoId('east:Safety') }, f.west.token, randomUUID()), 404);
>   assert.equal(await f.db.bulkIssuanceOperation.count({ where: { tenantId: f.west.tenantId } }), 0);
>   const eastExport = await exported({ search: '', sortBy: 'courseTitle', sortDirection: 'asc' });
>   for (const suffix of ['', '/download']) await json(`certificates/exports/${eastExport.job.id}${suffix}`, { token: [REDACTED_SECRET] }, 404);
>   await json('certificates/exports', post({ tenantId: f.east.tenantId }, f.west.token), 400);
>   const westExport = await exported({ search: '', sortBy: 'serialNumber', sortDirection: 'asc' }, f.west.token);
>   assert.deepEqual(westExport.rows.slice(1).map(row => row[2]), expected.map(row => row.serialNumber).sort());
>   const noEast = await exported({ search: foreign.serialNumber }, f.west.token);
>   assert.equal(noEast.rows.length, 1);
>   assert.deepEqual(await counts(f.east.tenantId), eastBefore);
>   assert.deepEqual(await counts(f.west.tenantId), westBefore);
> });
>
> test('2. Sequential and concurrent same-key requests replay one logical result', { timeout: 30000 }, async () => {
>   for (const concurrent of [false, true]) {
>     const { course, enrollments } = await bulkCourse(concurrent ? 'Concurrent retry' : 'Sequential retry');
>     const key = randomUUID(), before = await counts(f.east.tenantId);
>     const run = () => json('certificates/bulk-issuance', post({ courseId: course.id }, undefined, key), 201);
>     const results = concurrent ? await Promise.all(Array.from({ length: 6 }, run)) : [await run(), await run(), await run()];
>     assert.equal(results[0].issued, enrollments.length);
>     for (const result of results) assert.deepEqual(result, results[0]);
>     assert.deepEqual(await run(), results[0]);
>     assert.deepEqual(await counts(f.east.tenantId), before.map(value => value + enrollments.length));
>     assert.equal(await f.db.bulkIssuanceOperation.count({ where: { tenantId: f.east.tenantId, key } }), 1);
>     await assertIssuances(enrollments);
>   }
> });
>
> test('3. Key reuse for a different course returns 409 and preserves the original result', async () => {
>   const a = await bulkCourse('Original payload'), b = await bulkCourse('Changed payload');
>   const key = randomUUID();
>   const first = await json('certificates/bulk-issuance', post({ courseId: a.course.id }, undefined, key), 201);
>   const before = await counts(f.east.tenantId);
>   await json('certificates/bulk-issuance', post({ courseId: b.course.id }, undefined, key), 409);
>   assert.deepEqual(await json('certificates/bulk-issuance', post({ courseId: a.course.id.toUpperCase() }, undefined, key), 201), first);
>   // courseId is the only supported payload field; unsupported fields remain 400.
>   await json('certificates/bulk-issuance', post({ courseId: a.course.id, learnerIds: [] }, undefined, key), 400);
>   assert.deepEqual(await counts(f.east.tenantId), before);
>   assert.equal(await f.db.certificate.count({ where: { enrollmentId: { in: b.enrollments.map(row => row.id) } } }), 0);
>   for (const invalid of ['', 'bad key', 'x'.repeat(129)]) await json('certificates/bulk-issuance', post({ courseId: b.course.id }, undefined, invalid), 400);
> });
>
> test('4. Mixed learner outcomes issue only eligible learners and give skip reasons', async () => {
>   const before = await counts(f.east.tenantId);
>   const result = await json('certificates/bulk-issuance', post({ courseId: demoId('east:Safety') }, undefined, randomUUID()), 201);
>   assert.deepEqual([result.total, result.issued, result.skipped, result.failed], [4, 1, 3, 0]);
>   const outcome = name => result.outcomes.find(row => row.learnerName === name);
>   assert.equal(outcome('Sam Taylor').status, 'issued');
>   assert.equal(outcome('Jordan Smith').reason, 'incomplete');
>   assert.equal(outcome('Alex Lee').reason, 'already_issued');
>   assert.equal(outcome('Morgan Chen').reason, 'revoked');
>   assert.deepEqual(await counts(f.east.tenantId), before.map(value => value + 1));
>   assert.equal(await f.db.certificate.count({ where: { enrollmentId: demoId('east:Safety:0') } }), 0);
>   await assertIssuances([{ id: demoId('east:Safety:1') }]);
> });
>
> test('5. Real browser displays tenant-local time; list/CSV order by local date across DST', { timeout: 120000 }, async () => {
>   const clocks = [
>     [f.east, '2026-01-10T13:30:00Z', '2026-01-11 00:30', '00000000-0000-0000-0000-000000000020'],
>     [f.east, '2026-01-10T14:30:00Z', '2026-01-11 01:30', '00000000-0000-0000-0000-000000000010'],
>     [f.west, '2026-01-10T13:30:00Z', '2026-01-10 21:30', randomUUID()],
>     [f.east, '2026-04-04T15:59:00Z', '2026-04-05 02:59', randomUUID()],
>     [f.east, '2026-04-04T16:00:00Z', '2026-04-05 02:00', randomUUID()],
>     [f.east, '2026-10-03T15:59:00Z', '2026-10-04 01:59', randomUUID()],
>     [f.east, '2026-10-03T16:00:00Z', '2026-10-04 03:00', randomUUID()],
>   ];
>   for (const [actor, instant, display, id] of clocks) {
>     const tenantId = actor.tenantId;
>     const learner = await f.db.learner.create({ data: { tenantId, name: 'Acceptance clock', email: `${id}@clock.test` } });
>     const enrollment = await f.db.enrollment.create({ data: { tenantId, learnerId: learner.id, courseId: demoId(`${actor === f.east ? 'east' : 'west'}:Leadership`), status: 'COMPLETED', completedAt: new Date('2025-01-01Z') } });
>     await f.db.certificate.create({ data: { id, tenantId, enrollmentId: enrollment.id, issuedById: actor.adminId, issuedAt: new Date(instant), issueDate: new Date(display.slice(0, 10)), issueTimeZone: actor === f.east ? 'Australia/Sydney' : 'Australia/Perth' } });
>   }
>   let web, browser;
>   try {
>     web = await preview({ root: fileURLToPath(new URL('../../../web', import.meta.url)), configFile: false, preview: { host: '127.0.0.1', port: 0, proxy: { '/api': f.base } } });
>     browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
>     const page = await browser.newPage();
>     for (const [actor, , display, id] of clocks) {
>       const certificate = await f.db.certificate.findUniqueOrThrow({ where: { id } });
>       await page.goto(`http://127.0.0.1:${web.httpServer.address().port}`);
>       await page.getByLabel('Generated admin token').fill(actor.token);
>       await page.getByRole('button', { name: 'Use token', exact: true }).click();
>       await page.getByLabel('Learner name or certificate serial number').fill(certificate.serialNumber);
>       await page.getByRole('button', { name: 'Search', exact: true }).click();
>       const table = page.getByRole('table', { name: 'Issued certificates' });
>       await expect(table.getByRole('cell', { name: display, exact: true })).toBeVisible();
>       await table.getByRole('button', { name: certificate.serialNumber }).click();
>       await expect(page.getByRole('region', { name: 'Certificate detail', exact: true })).toContainText(`${display} (${certificate.issueTimeZone})`);
>     }
>   } finally { await browser?.close(); await web?.close(); }
>   for (const actor of [f.east, f.west]) for (const sortDirection of ['asc', 'desc']) {
>     const expected = await f.db.certificate.findMany({ where: { tenantId: actor.tenantId, enrollment: { learner: { name: 'Acceptance clock' } } }, orderBy: [{ issueDate: sortDirection }, { id: 'asc' }] });
>     const filters = { search: 'Acceptance clock', sortBy: 'issuedAt', sortDirection };
>     const list = await json(`certificates?${new URLSearchParams({ ...filters, pageSize: '100' })}`, { token: [REDACTED_SECRET] });
>     assert.deepEqual(list.items.map(row => row.id), expected.map(row => row.id));
>     const csv = await exported(filters, actor.token);
>     assert.deepEqual(csv.rows.slice(1).map(row => [row[2], row[3]]), expected.map(row => [row.serialNumber, row.issueDate.toISOString().slice(0, 10)]));
>   }
> });
>
> test('6. Two searched exports over 100,000 East certificates are correct, stable and responsive', { timeout: 300000 }, async t => {
>   const westBefore = await counts(f.west.tenantId);
>   await generateEastCertificates(f.db);
>   assert.equal(await f.db.certificate.count({ where: { tenantId: f.east.tenantId } }), 100000);
>   // A real search excludes fixtures; courseTitle deliberately has many equal keys.
>   const filters = { search: 'Volume Learner', sortBy: 'courseTitle', sortDirection: 'asc' };
>   const expected = await f.db.$queryRaw`SELECT l.name, co.title, c."serialNumber", to_char(c."issueDate", 'YYYY-MM-DD') AS date
>     FROM "Certificate" c JOIN "Enrollment" e ON e.id = c."enrollmentId" AND e."tenantId" = c."tenantId"
>     JOIN "Learner" l ON l.id = e."learnerId" AND l."tenantId" = e."tenantId"
>     JOIN "Course" co ON co.id = e."courseId" AND co."tenantId" = e."tenantId"
>     WHERE c."tenantId" = ${f.east.tenantId}::uuid AND l.name ILIKE '%Volume Learner%'
>     ORDER BY co.title ASC, c.id ASC`;
>   assert.ok(expected.length > 90000 && expected.length < 100000);
>   assert.ok(new Set(expected.map(row => row.title)).size < expected.length);
>   const timings = [], files = [];
>   for (let run = 0; run < 2; run++) {
>     const began = performance.now();
>     const job = await json('certificates/exports', post(filters), 202);
>     let listDuringRunning = false, ready;
>     while (performance.now() - began < 60000) {
>       const status = await json(`certificates/exports/${job.id}`);
>       assert.notEqual(status.status, 'failed', status.error);
>       if (run === 0 && status.status === 'running' && !listDuringRunning) {
>         const listBegan = performance.now();
>         const list = await json(`certificates?${new URLSearchParams({ ...filters, pageSize: '10' })}`, { signal: AbortSignal.timeout(10000) });
>         assert.equal(list.total, expected.length);
>         assert.deepEqual(list.items.map(row => row.serialNumber), expected.slice(0, 10).map(row => row.serialNumber));
>         t.diagnostic(`List requested during running export: ${Math.round(performance.now() - listBegan)}ms`);
>         listDuringRunning = true;
>       }
>       if (status.status === 'completed') { ready = status; break; }
>       await delay(25);
>     }
>     const elapsed = performance.now() - began;
>     assert.ok(ready && elapsed < 60000, `Export ${run + 1} exceeded 60 seconds`);
>     if (run === 0) assert.ok(listDuringRunning, 'Must observe running job and issue list request before completion');
>     assert.equal(ready.total, expected.length); assert.equal(ready.processed, expected.length);
>     const response = await f.request(`certificates/exports/${job.id}/download`);
>     assert.equal(response.status, 200);
>     const rows = parseCsv(await response.text());
>     assert.deepEqual(rows[0], ['Learner name', 'Course title', 'Serial number', 'Issue date']);
>     assert.deepEqual(rows.slice(1), expected.map(row => [row.name, row.title, row.serialNumber, row.date]));
>     assert.equal(new Set(rows.slice(1).map(row => row[2])).size, expected.length);
>     files.push(rows); timings.push(Math.round(elapsed));
>   }
>   assert.deepEqual(files[0], files[1]);
>   assert.deepEqual(await counts(f.west.tenantId), westBefore);
>   t.diagnostic(JSON.stringify({ node: process.version, eastCertificates: 100000, matchingRows: expected.length, exportMilliseconds: timings }));
> });
>
> test('7. Repeated revocation keeps the first result and exactly one revocation audit', async () => {
>   const certificate = await f.db.certificate.findFirstOrThrow({ where: { tenantId: f.east.tenantId, revokedAt: null } });
>   const before = await counts(f.east.tenantId);
>   const path = `certificates/${certificate.id}/revoke`;
>   const first = await json(path, post({ reason: 'Acceptance correction' }));
>   assert.equal(first.status, 'revoked');
>   const repeat = await json(path, post({ reason: 'A different repeat reason' }));
>   assert.deepEqual(repeat, first);
>   assert.deepEqual(await json(`certificates/${certificate.id}`), first);
>   assert.deepEqual(await counts(f.east.tenantId), [before[0], before[1] + 1]);
>   const audits = await f.db.auditEvent.findMany({ where: { certificateId: certificate.id, action: 'REVOKED' } });
>   assert.equal(audits.length, 1); assert.equal(audits[0].actorId, f.east.adminId);
>   assert.equal(audits[0].occurredAt.toISOString(), first.revokedAt);
> });
> EOF``
>
> </details>
>
> The runner now covers all seven scenarios, including real browser checks and an independent database comparison for exported rows. I’m adding regression coverage for interrupted bulk operations and browser retry-key handling before running the full checks.
>
> <details><summary>Ran 8 commands</summary>
>
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> npm run lint`
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> npm run build`
> - Ran ``cat > apps/api/test/integration/bulk-idempotency.test.mjs <<'EOF'
> import { test, before, after } from 'node:test';
> import assert from 'node:assert/strict';
> import { randomUUID } from 'node:crypto';
> import { exportFixture } from '../helpers/export-fixture.mjs';
> import { createApp } from '../../dist/app.js';
> import { demoId } from '../../prisma/demo-data.mjs';
> let f;
> before(async () => { f = await exportFixture(); });
> after(async () => { await f?.close(); });
> async function bulk(courseId, key, token = [REDACTED_SECRET] base = f.base) {
>   return fetch(`${base}/api/certificates/bulk-issuance`, { method: 'POST',
>     headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
>     body: JSON.stringify({ courseId }), signal: AbortSignal.timeout(15000) });
> }
> async function enrollment(courseId, name) {
>   const tenantId = f.east.tenantId;
>   const learner = await f.db.learner.create({ data: { tenantId, name, email: `${randomUUID()}@retry.test` } });
>   return f.db.enrollment.create({ data: { tenantId, courseId, learnerId: learner.id, status: 'COMPLETED', completedAt: new Date() } });
> }
> test('saved snapshots resume after restart; other instances replay exactly the same outcomes', async () => {
>   const tenantId = f.east.tenantId, requestedById = f.east.adminId, key = randomUUID();
>   const course = await f.db.course.create({ data: { tenantId, title: 'Resume' } });
>   const first = await enrollment(course.id, 'Original name'), pending = await enrollment(course.id, 'Pending');
>   const operation = await f.db.bulkIssuanceOperation.create({ data: { tenantId, requestedById, courseId: course.id, key } });
>   // Reproduce durable state left by a process exiting after the first commit.
>   await f.db.$transaction(async tx => {
>     const certificate = await tx.certificate.create({ data: { tenantId, enrollmentId: first.id, issuedById: requestedById,
>       issuedAt: new Date('2026-01-10T13:30:00Z'), issueDate: new Date('2026-01-11'), issueTimeZone: 'Australia/Sydney' } });
>     await tx.bulkIssuanceItem.createMany({ data: [
>       { operationId: operation.id, enrollmentId: first.id, learnerId: first.learnerId, learnerName: 'Original name',
>         outcome: { enrollmentId: first.id, learnerId: first.learnerId, learnerName: 'Original name', status: 'issued', certificateId: certificate.id, serialNumber: certificate.serialNumber } },
>       { operationId: operation.id, enrollmentId: pending.id, learnerId: pending.learnerId, learnerName: 'Pending' },
>     ] });
>   });
>   await f.db.learner.update({ where: { id: first.learnerId }, data: { name: 'Changed name' } });
>   const late = await enrollment(course.id, 'Joined after snapshot');
>   const app = await createApp(); await app.listen(0, '127.0.0.1');
>   let result;
>   try {
>     const responses = await Promise.all([bulk(course.id, key), bulk(course.id, key, f.east.token, await app.getUrl())]);
>     const results = await Promise.all(responses.map(async response => { assert.equal(response.status, 201); return response.json(); }));
>     assert.deepEqual(results[0], results[1]); result = results[0];
>     assert.deepEqual([result.total, result.issued, result.skipped, result.failed], [2, 2, 0, 0]);
>     assert.equal(result.outcomes.find(row => row.enrollmentId === first.id).learnerName, 'Original name');
>     assert.equal(await f.db.certificate.count({ where: { enrollmentId: late.id } }), 0);
>     assert.equal(await f.db.auditEvent.count({ where: { certificate: { enrollmentId: { in: [first.id, pending.id] } }, action: 'ISSUED' } }), 2);
>   } finally { await app.close(); }
>   const restarted = await createApp(); await restarted.listen(0, '127.0.0.1');
>   try { assert.deepEqual(await (await bulk(course.id, key, f.east.token, await restarted.getUrl())).json(), result); }
>   finally { await restarted.close(); }
> });
> test('key scope isolates tenants and admins, and conflicts cannot overwrite a result', async () => {
>   const key = randomUUID();
>   const first = await (await bulk(demoId('east:Leadership'), key)).json();
>   assert.equal((await bulk(demoId('east:Safety'), key)).status, 409);
>   assert.equal((await bulk(demoId('west:Leadership'), key, f.west.token)).status, 201);
>   assert.deepEqual(await (await bulk(demoId('east:Leadership'), key)).json(), first);
> });
> test('failed inserts roll back certificates/audits and persist a safe replayable failure', async () => {
>   const tenantId = f.east.tenantId, key = randomUUID();
>   const course = await f.db.course.create({ data: { tenantId, title: 'Insert failure' } });
>   const item = await enrollment(course.id, 'Failing learner');
>   await f.db.$executeRawUnsafe(`CREATE FUNCTION reject_keyed_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
>     IF NEW."enrollmentId" = '${item.id}'::uuid THEN RAISE EXCEPTION 'private insertion detail'; END IF; RETURN NEW; END $$`);
>   await f.db.$executeRawUnsafe('CREATE TRIGGER reject_keyed_insert BEFORE INSERT ON "Certificate" FOR EACH ROW EXECUTE FUNCTION reject_keyed_insert()');
>   let result;
>   try {
>     result = await (await bulk(course.id, key)).json();
>     assert.equal(result.failed, 1); assert.equal(result.outcomes[0].reason, 'issuance_failed');
>     assert.doesNotMatch(JSON.stringify(result), /private insertion detail/);
>     assert.equal(await f.db.certificate.count({ where: { enrollmentId: item.id } }), 0);
>     assert.equal(await f.db.auditEvent.count({ where: { certificate: { enrollmentId: item.id } } }), 0);
>   } finally { await f.db.$executeRawUnsafe('DROP TRIGGER reject_keyed_insert ON "Certificate"'); }
>   assert.deepEqual(await (await bulk(course.id, key)).json(), result);
>   const retry = await (await bulk(course.id, randomUUID())).json();
>   assert.equal(retry.issued, 1); assert.equal(retry.failed, 0);
> });
> EOF
> python3 - <<'PY'
> import json
> p='apps/api/package.json'
> s=json.load(open(p)); s['scripts']['test:db']+=' test/integration/bulk-idempotency.test.mjs'
> open(p,'w').write(json.dumps(s,indent=2)+'\n')
> p='apps/api/prisma/schema.prisma'
> s=open(p).read().replace('  enrollments Enrollment[]\n  @@unique([tenantId, id])', '  enrollments Enrollment[]\n  bulkOperations BulkIssuanceOperation[]\n  @@unique([tenantId, id])',1).replace('  items BulkIssuanceItem[]','  course Course @relation(fields: [tenantId, courseId], references: [tenantId, id], onDelete: Restrict)\n  items BulkIssuanceItem[]')
> open(p,'w').write(s)
> PY
> cat >> apps/web/e2e/bulk-issuance.spec.ts <<'EOF'
>
> test('uncertain response retains its key; a confirmed result starts a fresh key', async ({ page }) => {
>   const keys: string[] = [];
>   await page.route('**/api/certificates/bulk-issuance', async route => {
>     keys.push(route.request().headers()['idempotency-key']);
>     if (keys.length === 1) await route.abort('failed');
>     else await route.fulfill({ json: result });
>   });
>   await setup(page);
>   await page.getByRole('combobox', { name: 'Course', exact: true }).selectOption(courseId);
>   const button = page.getByRole('button', { name: 'Issue to eligible learners' });
>   await button.click();
>   await expect(page.getByText(/Unable to confirm issuance/)).toBeVisible();
>   await button.click();
>   await expect(page.getByText('Completed: 1 issued, 1 skipped, 1 failed.')).toBeVisible();
>   await button.click();
>   await expect.poll(() => keys.length).toBe(3);
>   expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
>   expect(keys[1]).toBe(keys[0]);
>   expect(keys[2]).not.toBe(keys[1]);
> });
> EOF``
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/postgres PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:acceptance`
> - Ran `sed -n '160,275p' README.md; cat apps/api/test/helpers/export-fixture.mjs; git diff --stat; git diff -- apps/api/src/modules/certificates/certificates.service.ts`
> - Ran `python3 - <<'PY'
> p='apps/web/e2e/bulk-issuance.spec.ts'
> s=open(p).read().replace("keys.push(route.request().headers()['idempotency-key']);", "keys.push(route.request().headers()['idempotency-key'] ?? '');")
> open(p,'w').write(s)
> p='apps/api/test/acceptance/verification.test.mjs'
> s=open(p).read().replace("new Date('2025-01-01Z')", "new Date('2025-01-01T00:00:00Z')")
> s=s.replace("} finally { await browser?.close(); await web?.close(); }", "} finally {\n    await browser?.close();\n    if (web) {\n      web.httpServer.closeAllConnections();\n      await new Promise((resolve, reject) => web.httpServer.close(error => error ? reject(error) : resolve()));\n    }\n  }")
> open(p,'w').write(s)
> p='apps/api/src/modules/certificates/certificates.service.ts'
> s=open(p).read(); start=s.index('      // One lock per enrollment'); end=s.index('\n  async revoke(', start)
> s=s[:start]+ '\n'.join(line[2:] if line.startswith('      ') else line for line in s[start:end].split('\n'))+s[end:]
> open(p,'w').write(s)
> PY
> export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/postgres PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:acceptance`
> - Ran ````python3 - <<'PY'
> p='README.md'
> s=open(p).read().replace('`issuedAt` (default), `learnerName`', '`issuedAt` (default; sorts by the saved tenant-local calendar date), `learnerName`')
> s=s.replace('historical tenant-local issue date (`YYYY-MM-DD`), and active/revoked status.', 'historical tenant-local issue date (`YYYY-MM-DD`), saved `issueTimeZone`, and active/revoked status. The browser displays issuance as `YYYY-MM-DD HH:mm` in that saved zone, independent of the browser zone and later tenant settings.')
> a=s.index('The request reads enrollment membership, learner names, and existing certificates')
> b=s.index('\nVerification uses the existing commands:',a)
> s=s[:a]+'''An optional `Idempotency-Key` header accepts 1–128 ASCII letters, digits, `.`, `_`, `:`, or `-`. Keys are scoped to the authenticated tenant and admin. A key binds to the validated payload (currently only `courseId`, normalized to lowercase). A different course with the same key returns **409**, including while the original request is running, without changing its result. Unknown body fields are invalid requests and return **400** before execution. Key records do not expire automatically.
>
> Keyed requests atomically persist an operation and its enrollment/name snapshot. Each learner's issuance, database-generated audit, and saved outcome commit together under row locks. Concurrent requests, other API instances, and retries after a process restart reuse those outcomes. An interrupted operation resumes its unfinished items when the same request/key is submitted again; there is no background bulk worker. All callers receive the same ordered outcome list, including original `issued` classifications and safe failures. Eligibility is checked when each unfinished item runs. Enrollments added after the snapshot require a new key. A confirmed failure is saved too: start a new operation/key to retry failed learners.
>
> Requests without a key retain the original behavior: membership, names, and existing certificates are read in a tenant-scoped joined query; existing certificates are skipped and each remaining enrollment uses an independent issuance transaction. These requests remain safe against duplicate issuance, but do not replay their previous outcomes.
>
> The browser generates one key per submission, retains it after an uncertain response, and starts a fresh key after a confirmed result or a course/token change. Keys and results are held in browser memory and are lost on reload; API clients can retain a key to resume after reload. Processing remains sequential within each HTTP request and large courses may outlast infrastructure timeouts. No business-data cache is used.
>
> Apply the additive bulk-idempotency migration before running the new API. It adds operation/item tables with tenant-scoped requester/course references and an index for local-date sorting. Index creation can block writes; schedule it for database size and take a verified backup first. If migration fails, investigate Prisma migration status and resolve the failure before retrying. Retain the additive tables/index during application rollback. An older application cannot honor keyed replay, so stop keyed submissions before rolling back; do not delete certificate/audit history or saved operations.
> ''' +s[b:]
> s=s.replace('historical tenant-local issue date and time zone, status, and', 'historical tenant-local issue date/time and saved time zone, status, and')
> s += '''
> ## Verification acceptance runner
>
> `npm run test:acceptance` builds shared contracts, API, and browser assets in dependency order, then runs all seven acceptance scenarios with a real local API, PostgreSQL, CSV downloads, and Chromium. It does not use the running development API or `.demo-tokens.json`. Node.js 24.22.1/npm 11.19.1, installed dependencies, an isolated PostgreSQL database with schema-creation/migration privileges, and a Playwright-compatible Chromium installation are required. Redis is not needed for these workflows. Install Chromium with `npx playwright install chromium` or provide `PLAYWRIGHT_EXECUTABLE_PATH`.
>
> ```sh
> TEST_DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:<test-port>/<test-db> \\
> PLAYWRIGHT_EXECUTABLE_PATH=/path/to/chromium \\
> npm run test:acceptance
> ```
>
> Use only a disposable test database, never shared or production data. The runner requires `TEST_DATABASE_URL`, creates a UUID-named schema, applies real migrations twice to verify repeatability, seeds fresh Alice/East and Bob/West credentials, and removes only its generated schema and temporary credential file during normal teardown. Interrupting/killing the process can leave its temporary schema/file; no shared data or persistent volumes are removed. Local API and browser-preview servers use ephemeral loopback ports.
>
> The seven reported cases cover tenant boundaries and no-write rejection; sequential/concurrent same-key replay; key conflicts; mixed learner outcomes; exact January local times plus both Sydney DST transitions and local-date sorting; two filtered exports over a 100,000-certificate East dataset with tied course-title sort values; and repeated revocation audits. The export scenario compares all cells against an independently specified SQL query, checks identical repeated order, and requests the list while the first job is observed running. Each export must reach completed status within 60 seconds measured from before the creation request; fixture generation and CSV download/comparison are outside that generation deadline. Output includes matching-row counts, export durations, and concurrent list latency. Performance is specific to the machine/database where the command runs.
>
> The command exits nonzero for any failing scenario or fixture/browser setup failure; failures are not skipped. `npm run test:db` additionally covers saved-operation recovery across API instances/restarts and rollback when issuance or outcome persistence fails. The regular browser suite verifies retry-key reuse after a lost response.
> '''
> open(p,'w').write(s)
> p='docs/data-model.md'
> s=open(p).read().replace('Changing the tenant zone never changes historical dates.', 'Changing the tenant zone never changes historical dates. List and export sorting for the legacy `issuedAt` sort key uses `issueDate`, then certificate ID ascending for stable ties. Browser list/detail display local date and time using the saved issueTimeZone; CSV retains the calendar date.')
> s += '''
> ## Bulk operation replay
>
> BulkIssuanceOperation binds `(tenantId, requestedById, key)` to a normalized course UUID. Composite requester and course foreign keys enforce tenant ownership. BulkIssuanceItem snapshots enrollment/learner IDs and names; its `(operationId, enrollmentId)` primary key identifies each saved outcome. Operation/item records have no automatic expiry or deletion workflow. They are additive and do not change permanent certificate/audit invariants.
>
> Operation creation and membership snapshot share a transaction, serialized by a database advisory lock for that actor/key. Each unfinished item is row-locked before issuance; its successful outcome is persisted in the same transaction as certificate/audit creation. Concurrent callers reuse the committed outcome. Failed transactions roll back before a separate locked transaction records a safe failure, preserving an outcome already finalized by another caller. An interrupted request leaves unfinished items resumable by the same actor/key. Completed outcomes, including failures, are replayed; a new key starts a new snapshot and can retry failed learners. No durable background bulk worker or progress endpoint is introduced. Requests without a key retain certificate-level retry safety without saved response replay.
> '''
> open(p,'w').write(s)
> p='AGENTS.md'
> s=open(p).read().replace('| Benchmark 100,000-row exports', '| Run all seven verification acceptance scenarios (isolated TEST_DATABASE_URL and Chromium required) | `npm run test:acceptance` |\n| Benchmark 100,000-row exports')
> s=s.replace('Course-based bulk issuance supports per-learner outcomes and duplicate submission prevention.', 'Course-based bulk issuance supports per-learner outcomes, duplicate submission prevention, and durable actor-scoped idempotency-key replay. List/detail display historical tenant-local date/time; list and CSV date sorting use the saved local calendar date.')
> open(p,'w').write(s)
> PY````
> - Ran ``python3 - <<'PY'
> p='apps/api/test/integration/bulk-idempotency.test.mjs'
> s=open(p).read().replace("import { randomUUID }", "import { randomBytes, randomUUID }")
> s=s.replace("import { demoId }", "import { hashToken } from '../../dist/modules/auth/auth.module.js';\nimport { demoId }")
> s=s.replace("assert.equal((await bulk(demoId('west:Leadership'), key, f.west.token)).status, 201);", "assert.equal((await bulk(demoId('west:Leadership'), key, f.west.token)).status, 201);\n  const otherToken = randomBytes(32).toString('base64url');\n  await f.db.admin.create({ data: { tenantId: f.east.tenantId, name: 'Other East admin', tokenHash: hashToken(otherToken) } });\n  assert.equal((await bulk(demoId('east:Safety'), key, otherToken)).status, 201);\n  assert.equal(await f.db.bulkIssuanceOperation.count({ where: { key } }), 3);")
> s += '''
> test('failure saving an issued outcome rolls back its issuance and leaves the item resumable', async () => {
>   const tenantId = f.east.tenantId, key = randomUUID();
>   const course = await f.db.course.create({ data: { tenantId, title: 'Outcome failure' } });
>   const item = await enrollment(course.id, 'Outcome write failure');
>   await f.db.$executeRawUnsafe(`CREATE FUNCTION reject_outcome_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
>     IF NEW."enrollmentId" = '${item.id}'::uuid THEN RAISE EXCEPTION 'private outcome detail'; END IF; RETURN NEW; END $$`);
>   await f.db.$executeRawUnsafe('CREATE TRIGGER reject_outcome_write BEFORE UPDATE ON "BulkIssuanceItem" FOR EACH ROW EXECUTE FUNCTION reject_outcome_write()');
>   try {
>     const response = await bulk(course.id, key);
>     assert.equal(response.status, 500);
>     assert.doesNotMatch(await response.text(), /private outcome detail/);
>     assert.equal(await f.db.certificate.count({ where: { enrollmentId: item.id } }), 0);
>     assert.equal(await f.db.auditEvent.count({ where: { certificate: { enrollmentId: item.id } } }), 0);
>     const operation = await f.db.bulkIssuanceOperation.findFirstOrThrow({ where: { key } });
>     const saved = await f.db.bulkIssuanceItem.findUniqueOrThrow({ where: { operationId_enrollmentId: { operationId: operation.id, enrollmentId: item.id } } });
>     assert.equal(saved.outcome, null);
>   } finally { await f.db.$executeRawUnsafe('DROP TRIGGER reject_outcome_write ON "BulkIssuanceItem"'); }
>   const result = await (await bulk(course.id, key)).json();
>   assert.equal(result.issued, 1);
>   assert.deepEqual(await (await bulk(course.id, key)).json(), result);
>   assert.equal(await f.db.auditEvent.count({ where: { certificate: { enrollmentId: item.id }, action: 'ISSUED' } }), 1);
> });
> '''
> open(p,'w').write(s)
> PY
> export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> npm run lint``
>
> </details>
>
> All seven acceptance scenarios passed. With 100,000 East certificates, each filtered export contained the expected 99,980 rows in the same order. Export completion took 1.32 seconds and 1.00 second; the list request made during the first export succeeded in 172 ms. I’ll now run the broader regression suites and review the diff.
>
> <details><summary>Ran 7 commands</summary>
>
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/postgres npm run test:db`
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> node --test apps/api/test/*.test.mjs`
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e --workspace @training/web`
> - Ran `/home/zblxy/.nvm/versions/node/v24.22.1/bin/node --test test/*.test.mjs`
> - Ran `git diff --check; git status --short; rg -n 'no schema|No schema|batch record|issuedAt|Issue date' docs/data-model.md README.md apps/web/e2e/certificates.spec.ts; sed -n '180,225p' apps/api/src/modules/certificates/certificates.service.ts; cat apps/api/prisma/schema.prisma`
> - Ran `cat apps/web/test-results/bulk-issuance-issuance-fai-be826--empty-results-are-explicit/error-context.md; sed -n '10,52p' apps/web/e2e/certificates.spec.ts; git diff -- README.md docs/data-model.md AGENTS.md`
> - Ran `python3 - <<'PY'
> p='apps/web/e2e/certificates.spec.ts'
> s=open(p).read().replace('token handling and date-only display','token handling and tenant-local date/time display').replace("name: '2025-12-31', exact:", "name: '2025-12-31 20:00', exact:")
> open(p,'w').write(s)
> PY
> export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e --workspace @training/web`
>
> </details>
>
> Database regressions passed all 36 checks, including cross-instance replay, restart recovery, and rollback when saving an outcome fails. The 10 unit/HTTP checks also passed. The browser run found an outdated date-only expectation and a page reload caused by my concurrent build; I updated the expectation and am rerunning the browser suite without a concurrent build.
>
> <details><summary>Ran 7 commands</summary>
>
> - Ran `git diff -- apps/api/src/modules/certificates/certificates.controller.ts packages/shared/src/certificates.ts apps/web/src/features/bulk-issuance/BulkIssuance.tsx apps/api/test/helpers/export-fixture.mjs; cat apps/api/prisma/migrations/20261031030000_bulk_idempotency/migration.sql; cat apps/web/src/features/certificates/local-date-time.ts; cat package.json apps/api/package.json`
> - Ran `head -n 8 apps/api/prisma/migrations/20261031020000_certificate_exports/migration.sql; tail -n 6 apps/api/prisma/migrations/20261031020000_certificate_exports/migration.sql; git diff --numstat; git status --short`
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> npm run typecheck`
> - Ran `python3 - <<'PY'
> p='apps/api/prisma/migrations/20261031030000_bulk_idempotency/migration.sql'
> s=open(p).read(); open(p,'w').write('BEGIN;\n'+s+'COMMIT;\n')
> PY
> cat >> apps/api/test/integration/bulk-idempotency.test.mjs <<'EOF'
>
> test('database rejects cross-tenant operation references and duplicate actor keys', async () => {
>   const data = { tenantId: f.east.tenantId, requestedById: f.east.adminId, courseId: demoId('east:Leadership'), key: randomUUID() };
>   await assert.rejects(f.db.bulkIssuanceOperation.create({ data: { ...data, requestedById: f.west.adminId } }));
>   await assert.rejects(f.db.bulkIssuanceOperation.create({ data: { ...data, courseId: demoId('west:Leadership') } }));
>   await f.db.bulkIssuanceOperation.create({ data });
>   await assert.rejects(f.db.bulkIssuanceOperation.create({ data }));
> });
> EOF
> export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/postgres node --test test/integration/bulk-idempotency.test.mjs`
> - Ran `python3 - <<'PY'
> p='apps/api/prisma/migrations/20261031030000_bulk_idempotency/migration.sql'
> s=open(p).read(); open(p,'w').write('BEGIN;\n'+s+'COMMIT;\n')
> PY
> cat >> apps/api/test/integration/bulk-idempotency.test.mjs <<'EOF'
>
> test('database rejects cross-tenant operation references and duplicate actor keys', async () => {
>   const data = { tenantId: f.east.tenantId, requestedById: f.east.adminId, courseId: demoId('east:Leadership'), key: randomUUID() };
>   await assert.rejects(f.db.bulkIssuanceOperation.create({ data: { ...data, requestedById: f.west.adminId } }));
>   await assert.rejects(f.db.bulkIssuanceOperation.create({ data: { ...data, courseId: demoId('west:Leadership') } }));
>   await f.db.bulkIssuanceOperation.create({ data });
>   await assert.rejects(f.db.bulkIssuanceOperation.create({ data }));
> });
> EOF`
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/postgres node --test test/integration/bulk-idempotency.test.mjs`
> - Ran `export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
> npm run lint
> git diff --check
> python3 - <<'PY'
> import pathlib, subprocess
> paths = subprocess.check_output(['git','diff','--name-only'],text=True).splitlines() + subprocess.check_output(['git','ls-files','--others','--exclude-standard'],text=True).splitlines()
> print('Reviewed changed files:', len(paths))
> for name in paths:
>  p=pathlib.Path(name)
>  if not p.is_file(): raise SystemExit('Unexpected non-file change: '+name)
>  s=p.read_text()
>  if 'PRIVATE KEY-----' in s: raise SystemExit('Possible private key in '+name)
> print('No private-key material found in changed files.')
> PY
> ps -eo pid,args | rg '^ *[0-9]+ /home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/training-model-postgres/start.mjs$'`
>
> </details>
>
> The browser suite now passes all 21 checks. Final typechecking, lint, and whitespace checks also passed, along with the focused migration and constraint tests. I’m checking cleanup and the handoff details; development data and the running development services remain unchanged.
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `ps -eo pid,args | rg '[/]tmp/training-model-postgres/start.mjs'; git status --short`
> - Ran `git status --short; git worktree list`
> - Ran `ps -eo pid,args | rg '[/]tmp/training-model-postgres/start.mjs'`
> - Ran `kill -TERM 2736136`
>
> </details>
</details>

Implemented in [the new worktree](/tmp/training-platform-verification-acceptance) on `codex/verification-acceptance`.

Added `npm run test:acceptance`, durable bulk idempotency with replay and 409 conflicts, browser retry keys, local date/time display, stable local-date sorting, and migration/documentation updates.

Verification passed:

- All 7 acceptance scenarios
- All 21 browser tests
- Database regressions and recovery/rollback checks
- All 10 unit/HTTP tests
- Lint, typecheck, build, and diff checks

On isolated PostgreSQL 18.4, exports completed in **1.32s** and **1.00s**; the concurrent list request succeeded in **172ms**.

See [run instructions](/tmp/training-platform-verification-acceptance/README.md). The new migration must be applied before using the updated API. Development data remains unchanged; nothing was committed or deployed.

> commit the work and merge back to main

<details><summary>2 previous messages</summary>

> I’ll review and commit the worktree changes, then merge them into `main`, preserving the unrelated untracked files.
>
> <details><summary>Ran 8 commands</summary>
>
> - Ran `git status --short; git branch --show-current; git log -3 --oneline`
> - Ran `git status --short; git diff --check; git diff --stat; git log -3 --oneline`
> - Ran `git add AGENTS.md README.md apps/api/package.json apps/api/prisma/schema.prisma apps/api/prisma/migrations/20261031030000_bulk_idempotency/migration.sql apps/api/src/modules/certificate-exports/export-queue.ts apps/api/src/modules/certificates/certificates.controller.ts apps/api/src/modules/certificates/certificates.service.ts apps/api/test/helpers/export-fixture.mjs apps/api/test/integration/certificate-list.test.mjs apps/api/test/integration/bulk-idempotency.test.mjs apps/api/test/acceptance/verification.test.mjs apps/web/e2e/bulk-issuance.spec.ts apps/web/e2e/certificate-detail.spec.ts apps/web/e2e/certificate-exports.spec.ts apps/web/e2e/certificates.spec.ts apps/web/src/features/bulk-issuance/BulkIssuance.tsx apps/web/src/features/certificates/CertificateDetail.tsx apps/web/src/features/certificates/CertificateList.tsx apps/web/src/features/certificates/local-date-time.ts docs/data-model.md package.json packages/shared/src/certificates.ts`
> - Ran `git diff --cached --check; git diff --cached --stat; git status --short`
> - Ran `git commit -m "feat: add verification acceptance runner and retry-safe bulk issuance"`
> - Ran `git merge --no-ff codex/verification-acceptance -m "Merge branch 'codex/verification-acceptance'"`
> - Ran `git status --short; git rev-parse --short HEAD`
> - Ran `git status --short; git log -2 --oneline; git diff HEAD codex/verification-acceptance --stat; git diff --check`
>
> </details>
</details>

Committed as `2d87aed` and merged into local `main` with merge commit `ba2b786`.

The merge matches the verified worktree. Untracked `ai/` and `written-answers.md` remain untouched. Nothing was pushed; the new migration still needs to be applied before using the updated API.

> generate two commands:
>
> 1. build and start the application, then generate the full demo data
> 2. run the verification check and show results

<details><summary>2 previous messages</summary>

> I’ll check the startup and test prerequisites so the two commands use the right services and database settings.
>
> <details><summary>Explored 4 files</summary>
>
> - Read `./compose.yaml`
> - Read `./README.md`
> - Read `./README.md`
> - Read `./apps/api/prisma/seed-large.mjs`
>
> </details>
</details>

Run both from the repository root, with dependencies installed and `.env` configured for the local demo database.

1. Build/start the application, apply migrations, then generate 100,000 East certificates. Web: **http://localhost:5174**.

```bash
export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH &&
API_PORT=3001 WEB_PORT=5174 docker compose -p training-platform-dev up --build -d --wait &&
npm run db:migrate:deploy --workspace @training/api &&
npm run db:seed:large
```

2. Start a separate acceptance database and run all seven verification scenarios. Results and export timings print directly in the terminal.

```bash
export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH &&
POSTGRES_USER=acceptance POSTGRES_PASSWORD=acceptance_local_only POSTGRES_DB=acceptance DB_PORT=55440 \
  docker compose -p training-platform-acceptance up -d --wait db &&
TEST_DATABASE_URL='postgresql://acceptance:acceptance_local_only@127.0.0.1:55440/acceptance' \
PLAYWRIGHT_EXECUTABLE_PATH='/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome' \
  npm run test:acceptance
```

Verification creates its own fixtures and leaves the application’s demo data untouched.
