# Add certificate CSV export

> start a new codex worktree to implement certificate CSV export feature. from now on, use plan mode. Inspect the relevant files, ask clarifying questions if needed, then propose the implementation plan before writing code.\
> feature details:
>
> 1. Export learner name, course title, serial number, and tenant-local issue date.
> 2. Preserve current search and sort when exporting.
> 3. use background job to do export, do not hang the page
> 4. frontend use a progress bar when exporting
> 5. after export, can download the csv file
> 6. Each export completes within 60 seconds for 100,000 East certificates.

<details><summary>5 previous messages</summary>

> I’ll inspect the certificate list, export code, and worktree setup, then propose a plan before writing code. I can follow that planning workflow, though I can’t switch the session’s actual mode from here.
>
> <details><summary>Explored a search, 2 lists, ran 9 commands</summary>
>
> - Ran `pwd`
>
> - Ran `git status --short --branch`
>
> - Ran `git worktree list`
>
> <details><summary>Explored a list</summary>
>
> - Listed files
>
> </details>
>
> - Ran `cat AGENTS.md package.json apps/api/package.json apps/web/package.json`
>
> - Ran `cat packages/shared/src/certificates.ts apps/api/src/modules/certificates/certificates.controller.ts apps/api/src/modules/certificates/certificates.service.ts apps/api/src/modules/certificates/list-certificates.dto.ts apps/api/src/modules/certificates/certificates.module.ts`
>
> <details><summary>Explored a search, a list</summary>
>
> - Listed files in `web`
> - Searched for `timezone|timeZone|export|100,000|100000|Redis|redis|serialNumber|issuedAt` in `schema.prisma`
>
> </details>
>
> - Ran `sed -n '1,85p' apps/api/src/modules/certificates/certificates.service.ts
> cat apps/web/src/features/certificates/CertificateList.tsx apps/web/src/main.tsx`
>
> - Ran `cat apps/api/prisma/schema.prisma apps/api/src/common/database/database.service.ts apps/api/src/modules/auth/auth.module.ts apps/api/src/app.module.ts apps/api/src/app.ts apps/api/Dockerfile`
>
> - Ran `cat apps/web/e2e/certificates.spec.ts apps/api/test/integration/certificate-list.test.mjs`
>
> - Ran `git worktree add -b codex/certificate-csv-export /tmp/training-platform-certificate-csv-export HEAD`
>
> </details>
>
> The list already defines the search and sort behavior, including a stable tie-breaker, and stores the historical tenant-local issue date. There’s no export or job infrastructure yet. Redis is configured as disposable cache storage, so I recommend PostgreSQL-backed export jobs.
>
> The new worktree is ready at `/tmp/training-platform-certificate-csv-export` on `codex/certificate-csv-export`. Your existing untracked files remain untouched.
>
> For export retention and recovery, may I use PostgreSQL-backed jobs and CSV storage, retain downloads for 24 hours, and automatically retry interrupted jobs after an API restart?
> - Yes, use these defaults
> - Keep exports only until API restart
> - Use different retention or storage requirements
>
> May I measure the 60-second requirement from job acceptance until the CSV is ready, excluding download time, for one active 100,000-certificate East export on the local development stack? Concurrent-load guarantees would need a specified workload and hardware.
> - Yes, use that acceptance benchmark
> - Include concurrent exports in the requirement
> - Include download time in the requirement
>
> <details><summary>Ran 2 commands</summary>
>
> - Ran `cat compose.yaml compose.production.yaml apps/web/playwright.config.ts apps/api/src/common/filters/http-error.filter.ts`
> - Ran `cat docs/data-model.md
> sed -n '150,182p' README.md
> sed -n '1,100p' apps/api/prisma/seed-large.mjs
> cat .gitignore
>  git status --short --branch`
>
> </details>
</details>

Created worktree `/tmp/training-platform-certificate-csv-export` on branch `codex/certificate-csv-export`, based on `main`. No code changes yet.

After inspecting the API, UI, schema, tests, and container setup, I propose:

1. **Export scope:** Export all matching certificates across pages, including revoked certificates. Capture the applied search and sort when Export is clicked, preserving the list’s stable ordering.
2. **CSV content:** Learner name, course title, serial number, and stored tenant-local issue date (`YYYY-MM-DD`). Handle Unicode, CSV escaping, and spreadsheet formula safety.
3. **Background processing:** Add PostgreSQL-backed jobs and CSV storage through an additive migration. Run generation in a background worker with bounded memory, progress updates, and restart recovery. Read a consistent snapshot when processing begins.
4. **Authenticated API:** Add job creation (`202 Accepted`), status, and download endpoints. Restrict access to the requesting admin and tenant; validate inputs and bound concurrent work.
5. **Frontend:** Add Export CSV, an accessible progress bar, failure/retry states, and Download CSV when ready. Keep the certificate list usable during generation.
6. **Verification:** Test search/sort parity, dates, CSV correctness, authorization, recovery, and browser interactions. Benchmark repeated 100,000-row East exports against the agreed 60-second boundary, recording hardware and timings. Run lint, typecheck, build, and relevant tests.

Two clarification questions are pending above: retention/recovery defaults and the performance measurement boundary.

Please answer those and approve this plan before implementation, as required by [AGENTS.md](./AGENTS.md). I’ll continue with the requested planning workflow; the session itself remains in Default mode.

> **For export retention and recovery, may I use PostgreSQL-backed jobs and CSV storage, retain downloads for 24 hours, and automatically retry interrupted jobs after an API restart?**
>
> Yes, use these defaults
>
> **May I measure the 60-second requirement from job acceptance until the CSV is ready, excluding download time, for one active 100,000-certificate East export on the local development stack? Concurrent-load guarantees would need a specified workload and hardware.**
>
> Yes, use that acceptance benchmark

Confirmed: PostgreSQL-backed jobs and CSV storage, 24-hour retention, and automatic retry after API restarts. The benchmark is acceptance-to-ready within 60 seconds for one active 100,000-row East export, excluding download time.

Do you approve the six-step implementation plan above? [AGENTS.md](./AGENTS.md) requires explicit plan approval before writing code.

> ok

<details><summary>14 previous messages</summary>

> I’ll implement the approved plan in the new worktree, then verify the export workflow and benchmark 100,000-row East exports.
>
> <details><summary>Explored 6 files, a search, ran 5 commands</summary>
>
> - Ran `cat apps/api/tsconfig.json apps/api/tsconfig.tools.json apps/api/src/modules/auth/auth.module.ts apps/api/prisma.config.ts`
>
> - Ran `ls node_modules/.bin /home/zblxy/.nvm/versions/node/v24.22.1/bin /tmp/training-platform-tools/node_modules/.bin
>  docker compose -p training-platform-dev ps`
>
> <details><summary>Explored 3 files, a search</summary>
>
> - Searched for `"@types/pg"` in `package-lock.json`
> - Read `./tsconfig.base.json`
> - Read `./apps/api/test/smoke.test.mjs`
> - Read `./apps/api/src/config/environment.ts`
>
> </details>
>
> - Ran `docker compose -p training-platform-dev ps`
>
> - Ran `ls /tmp/training-model-postgres /tmp/training-platform-tools
>  git status --short --branch`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm ci --cache /tmp/training-platform-npm-cache --no-audit --no-fund`
>
> <details><summary>Explored 3 files</summary>
>
> - Read `/tmp/training-model-postgres/start.mjs`
> - Read `./scripts/dev-api.mjs`
> - Read `./apps/api/prisma/migrations/20261031010000_certificate_serial/migration.sql`
>
> </details>
>
> </details>
>
> I’ll use PostgreSQL for the job queue and CSV chunks, with generation in a worker thread so it can’t block the API event loop. The frontend will poll row-based progress and show Download CSV when the file is ready. Jobs will capture the applied filters and retain the existing historical issue date.
>
> <details><summary>Explored 2 files, ran 9 commands</summary>
>
> - Ran `mkdir -p apps/api/src/modules/certificate-exports apps/api/prisma/migrations/20261031020000_certificate_exports`
>
> - Ran ``python3 - <<'PY'
> from pathlib import Path
> root=Path('/tmp/training-platform-certificate-csv-export')
> def put(p,s): (root/p).write_text(s)
> p=root/'apps/api/prisma/schema.prisma'
> s=p.read_text().replace('  auditEvents AuditEvent[]\n  @@unique([tenantId, id])','  auditEvents AuditEvent[]\n  exports CertificateExport[]\n  @@unique([tenantId, id])',1)
> s+='''
> model CertificateExport {
>   id String @id @default(uuid()) @db.Uuid
>   tenantId String @db.Uuid
>   requestedById String @db.Uuid
>   requester Admin @relation(fields: [tenantId, requestedById], references: [tenantId, id], onDelete: Restrict)
>   search String
>   sortBy String
>   sortDirection String
>   status String @default("queued")
>   processed Int @default(0)
>   total Int @default(0)
>   createdAt DateTime @default(now()) @db.Timestamptz(3)
>   expiresAt DateTime @db.Timestamptz(3)
>   completedAt DateTime? @db.Timestamptz(3)
>   leaseId String? @db.Uuid
>   leaseUntil DateTime? @db.Timestamptz(3)
>   attempts Int @default(0)
>   error String?
>   chunks CertificateExportChunk[]
>   @@index([status, createdAt])
>   @@index([expiresAt])
> }
> model CertificateExportChunk {
>   exportId String @db.Uuid
>   sequence Int
>   content Bytes
>   job CertificateExport @relation(fields: [exportId], references: [id], onDelete: Cascade)
>   @@id([exportId, sequence])
> }
> '''
> p.write_text(s)
> put(Path('apps/api/prisma/migrations/20261031020000_certificate_exports/migration.sql'),'''BEGIN;
> CREATE TABLE "CertificateExport" (
>   id UUID PRIMARY KEY,
>   "tenantId" UUID NOT NULL,
>   "requestedById" UUID NOT NULL,
>   search TEXT NOT NULL,
>   "sortBy" TEXT NOT NULL CHECK ("sortBy" IN ('issuedAt','learnerName','serialNumber','courseTitle')),
>   "sortDirection" TEXT NOT NULL CHECK ("sortDirection" IN ('asc','desc')),
>   status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
>   processed INTEGER NOT NULL DEFAULT 0,
>   total INTEGER NOT NULL DEFAULT 0,
>   "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
>   "expiresAt" TIMESTAMPTZ(3) NOT NULL,
>   "completedAt" TIMESTAMPTZ(3),
>   "leaseId" UUID,
>   "leaseUntil" TIMESTAMPTZ(3),
>   attempts INTEGER NOT NULL DEFAULT 0,
>   error TEXT,
>   CONSTRAINT export_requester FOREIGN KEY ("tenantId","requestedById") REFERENCES "Admin"("tenantId",id) ON DELETE RESTRICT,
>   CONSTRAINT export_progress CHECK (processed >= 0 AND total >= processed)
> );
> CREATE INDEX "CertificateExport_status_createdAt_idx" ON "CertificateExport"(status,"createdAt");
> CREATE INDEX "CertificateExport_expiresAt_idx" ON "CertificateExport"("expiresAt");
> -- Double clicks and concurrent submissions cannot queue duplicate active work.
> CREATE UNIQUE INDEX export_one_active_per_admin ON "CertificateExport"("tenantId","requestedById") WHERE status IN ('queued','running');
> CREATE TABLE "CertificateExportChunk" (
>   "exportId" UUID NOT NULL REFERENCES "CertificateExport"(id) ON DELETE CASCADE,
>   sequence INTEGER NOT NULL CHECK (sequence >= 0),
>   content BYTEA NOT NULL,
>   PRIMARY KEY ("exportId",sequence)
> );
> COMMIT;
> ''')
> put(Path('packages/shared/src/certificate-exports.ts'),'''import type { CertificateSortField } from './certificates.js';
> export interface CertificateExportRequest {
>   search: string;
>   sortBy: CertificateSortField;
>   sortDirection: 'asc' | 'desc';
> }
> export interface CertificateExportStatus extends CertificateExportRequest {
>   id: string;
>   status: 'queued' | 'running' | 'completed' | 'failed';
>   processed: number;
>   total: number;
>   createdAt: string;
>   expiresAt: string;
>   error: string | null;
> }
> export function isCertificateExportStatus(value: unknown): value is CertificateExportStatus {
>   if (typeof value !== 'object' || value === null) return false;
>   const row = value as Record<string, unknown>;
>   return typeof row.id === 'string' && /^[0-9a-f-]{36}$/i.test(row.id) &&
>     ['queued', 'running', 'completed', 'failed'].includes(String(row.status)) &&
>     Number.isSafeInteger(row.processed) && Number.isSafeInteger(row.total) &&
>     (row.processed as number) >= 0 && (row.total as number) >= (row.processed as number) &&
>     typeof row.search === 'string' && ['issuedAt', 'learnerName', 'serialNumber', 'courseTitle'].includes(String(row.sortBy)) &&
>     ['asc', 'desc'].includes(String(row.sortDirection)) && typeof row.createdAt === 'string' &&
>     typeof row.expiresAt === 'string' && (row.error === null || typeof row.error === 'string');
> }
> ''')
> p=root/'packages/shared/src/index.ts';p.write_text(p.read_text()+"export * from './certificate-exports.js';\n")
> p=root/'apps/api/src/modules/certificates/list-certificates.dto.ts'
> s=p.read_text(); start=s.index('  @IsString()'); filters=s[start:s.rindex('}')]; s=s[:start]+'}\n'; s=s.replace('export class ListCertificatesDto {','export class CertificateQueryDto {\n'+filters+'}\nexport class ListCertificatesDto extends CertificateQueryDto {');p.write_text(s)
> put(Path('apps/api/src/modules/certificate-exports/csv.ts'),'''// Quote every cell and neutralize spreadsheet formulas, including leading whitespace.
> export function csvCell(value: string): string {
>   const safe = /^[\\s\\uFEFF]*[=+@-]/u.test(value) || /^[\\t\\r\\n]/u.test(value) ? `'${value}` : value;
>   return `"${safe.replaceAll('"', '""')}"`;
> }
> export const csvHeader = '\\uFEFFLearner name,Course title,Serial number,Issue date\\r\\n';
> export function csvRow(row: { learnerName: string; courseTitle: string; serialNumber: string; issueDate: string }): string {
>   return [row.learnerName, row.courseTitle, row.serialNumber, row.issueDate].map(csvCell).join(',') + '\\r\\n';
> }
> ''')
> PY``
>
> - Ran ``python3 - <<'PY'
> from pathlib import Path
> r=Path('/tmp/training-platform-certificate-csv-export/apps/api/src/modules/certificate-exports')
> (r/'export-queue.ts').write_text('''import { randomUUID } from 'node:crypto';
> import { Prisma } from '../../generated/prisma/client.js';
> import { DatabaseService } from '../../common/database/database.service.js';
>
> export const exportQueueLock = 731042619;
> export const exportStatusSelect = {
>   id: true, search: true, sortBy: true, sortDirection: true, status: true,
>   processed: true, total: true, createdAt: true, expiresAt: true, error: true,
> } as const;
> export async function claimExport(db: DatabaseService) {
>   return db.$transaction(async tx => {
>     const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${exportQueueLock}) AS locked`;
>     if (!lock?.locked) return null;
>     const now = new Date();
>     await tx.certificateExport.deleteMany({ where: { expiresAt: { lte: now } } });
>     // One generation at a time across replicas; queued requests remain responsive.
>     if (await tx.certificateExport.findFirst({ where: { status: 'running', leaseUntil: { gt: now } }, select: { id: true } })) return null;
>     const job = await tx.certificateExport.findFirst({
>       where: { OR: [{ status: 'queued' }, { status: 'running', leaseUntil: { lte: now } }] },
>       orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
>     });
>     if (!job) return null;
>     await tx.certificateExportChunk.deleteMany({ where: { exportId: job.id } });
>     if (job.attempts >= 3) {
>       await tx.certificateExport.update({ where: { id: job.id }, data: { status: 'failed', error: 'Export interrupted repeatedly. Please start a new export.', leaseId: null, leaseUntil: null } });
>       return null;
>     }
>     return tx.certificateExport.update({ where: { id: job.id }, data: {
>       status: 'running', leaseId: randomUUID(), leaseUntil: new Date(Date.now() + 90000),
>       attempts: { increment: 1 }, processed: 0, total: 0, error: null,
>     } });
>   });
> }
> export function exportFilter(tenantId: string, search: string): Prisma.Sql {
>   return Prisma.sql`c."tenantId" = ${tenantId}::uuid ${search ? Prisma.sql`AND (c."serialNumber" = ${search.toUpperCase()} OR l.name ILIKE ${'%' + search.replace(/[\\\\%_]/g, '\\\\$&') + '%'})` : Prisma.empty}`;
> }
> export function exportOrder(sortBy: string, sortDirection: string): Prisma.Sql {
>   const fields: Record<string, Prisma.Sql> = {
>     issuedAt: Prisma.sql`c."issuedAt"`, learnerName: Prisma.sql`l.name`,
>     serialNumber: Prisma.sql`c."serialNumber"`, courseTitle: Prisma.sql`co.title`,
>   };
>   const field = fields[sortBy];
>   if (!field || !['asc', 'desc'].includes(sortDirection)) throw new Error('Invalid export sort');
>   return Prisma.sql`${field} ${sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`}, c.id ASC`;
> }
> export const exportJoins = Prisma.sql`FROM "Certificate" c
>   JOIN "Enrollment" e ON e.id = c."enrollmentId" AND e."tenantId" = c."tenantId"
>   JOIN "Learner" l ON l.id = e."learnerId" AND l."tenantId" = e."tenantId"
>   JOIN "Course" co ON co.id = e."courseId" AND co."tenantId" = e."tenantId"`;
> ''')
> (r/'export-worker.ts').write_text('''import { parentPort } from 'node:worker_threads';
> import { setTimeout as delay } from 'node:timers/promises';
> import { DatabaseService } from '../../common/database/database.service.js';
> import type { CertificateExport } from '../../generated/prisma/client.js';
> import { claimExport, exportFilter, exportJoins, exportOrder } from './export-queue.js';
> import { csvHeader, csvRow } from './csv.js';
>
> const db = new DatabaseService();
> let stopped = false;
> parentPort?.on('message', () => { stopped = true; });
> interface ExportRow { learnerName: string; courseTitle: string; serialNumber: string; issueDate: string }
> async function generate(job: CertificateExport) {
>   const ownership = { id: job.id, leaseId: job.leaseId, status: 'running' };
>   try {
>     await db.$transaction(async tx => {
>       await tx.$executeRaw`SET LOCAL statement_timeout = '45s'`;
>       const filter = exportFilter(job.tenantId, job.search);
>       const [count] = await tx.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${exportJoins} WHERE ${filter}`;
>       const total = count!.total;
>       const updated = await db.certificateExport.updateMany({ where: ownership, data: { total } });
>       if (!updated.count) throw new Error('Lost lease');
>       await tx.$executeRaw`DECLARE certificate_export_cursor NO SCROLL CURSOR FOR
>         SELECT l.name AS "learnerName", co.title AS "courseTitle", c."serialNumber", c."issueDate"::text AS "issueDate"
>         ${exportJoins} WHERE ${filter} ORDER BY ${exportOrder(job.sortBy, job.sortDirection)}`;
>       let processed = 0, sequence = 0, bytes = 0;
>       // Each persisted chunk is bounded. Rows never accumulate across batches.
>       async function persist(content: string) {
>         const buffer = Buffer.from(content, 'utf8');
>         bytes += buffer.byteLength;
>         if (bytes > 128 * 1024 * 1024) throw new Error('Export exceeds size limit');
>         await db.$transaction(async write => {
>           const owned = await write.certificateExport.updateMany({ where: ownership, data: { processed } });
>           if (!owned.count) throw new Error('Lost lease');
>           await write.certificateExportChunk.create({ data: { exportId: job.id, sequence: sequence++, content: buffer } });
>         });
>       }
>       await persist(csvHeader);
>       while (!stopped) {
>         const rows = await tx.$queryRaw<ExportRow[]>`FETCH FORWARD 1000 FROM certificate_export_cursor`;
>         if (!rows.length) break;
>         let content = '';
>         for (const row of rows) {
>           const line = csvRow(row);
>           if (Buffer.byteLength(line) > 2 * 1024 * 1024) throw new Error('Export row exceeds size limit');
>           if (Buffer.byteLength(content) + Buffer.byteLength(line) > 2 * 1024 * 1024) {
>             await persist(content); content = '';
>           }
>           content += line; processed++;
>         }
>         if (content) await persist(content);
>       }
>       if (stopped) throw new Error('Worker stopped');
>       await tx.$executeRaw`CLOSE certificate_export_cursor`;
>     }, { isolationLevel: 'RepeatableRead', timeout: 55000, maxWait: 3000 });
>     await db.certificateExport.updateMany({ where: ownership, data: {
>       status: 'completed', completedAt: new Date(), expiresAt: new Date(Date.now() + 86400000), leaseId: null, leaseUntil: null,
>     } });
>   } catch {
>     if (stopped) return; // Leave the durable lease for recovery on restart.
>     await db.$transaction(async tx => {
>       const owned = await tx.certificateExport.updateMany({ where: ownership, data: {
>         status: 'failed', error: 'Export could not be completed. Please retry.', leaseId: null, leaseUntil: null,
>       } });
>       if (owned.count) await tx.certificateExportChunk.deleteMany({ where: { exportId: job.id } });
>     }).catch(() => {}); // A database outage leaves a recoverable lease.
>   }
> }
> try {
>   while (!stopped) {
>     try {
>       const job = await claimExport(db);
>       if (job) { await generate(job); continue; }
>     } catch { /* Database outages do not affect HTTP health or expose credentials. */ }
>     await delay(500);
>   }
> } finally { await db.$disconnect(); parentPort?.close(); }
> ''')
> (r/'certificate-exports.service.ts').write_text('''import { ConflictException, HttpException, Injectable, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
> import { Worker } from 'node:worker_threads';
> import { Readable } from 'node:stream';
> import { pipeline } from 'node:stream/promises';
> import type { Response } from 'express';
> import { DatabaseService } from '../../common/database/database.service.js';
> import type { Actor } from '../auth/auth.module.js';
> import type { CertificateQueryDto } from '../certificates/list-certificates.dto.js';
> import { exportQueueLock, exportStatusSelect } from './export-queue.js';
>
> @Injectable()
> export class CertificateExportsService implements OnModuleInit, OnModuleDestroy {
>   private worker?: Worker;
>   private restart?: ReturnType<typeof setTimeout>;
>   private stopping = false;
>   constructor(private readonly db: DatabaseService) {}
>   onModuleInit() { if (process.env.DATABASE_URL) this.startWorker(); }
>   private startWorker() {
>     if (this.stopping) return;
>     const worker = new Worker(new URL('./export-worker.js', import.meta.url));
>     this.worker = worker;
>     worker.on('error', () => { /* Exit handler restarts without logging sensitive errors. */ });
>     worker.once('exit', () => {
>       if (this.worker === worker) this.worker = undefined;
>       if (!this.stopping) this.restart = setTimeout(() => this.startWorker(), 1000);
>     });
>   }
>   async onModuleDestroy() {
>     this.stopping = true;
>     clearTimeout(this.restart);
>     if (this.worker) await this.worker.terminate();
>   }
>   async create(actor: Actor, query: CertificateQueryDto) {
>     return this.db.$transaction(async tx => {
>       await tx.$queryRaw`SELECT pg_advisory_xact_lock(${exportQueueLock})`;
>       const existing = await tx.certificateExport.findFirst({ where: {
>         tenantId: actor.tenantId, requestedById: actor.id, status: { in: ['queued', 'running'] },
>       }, select: exportStatusSelect });
>       if (existing) {
>         if (existing.search === query.search && existing.sortBy === query.sortBy && existing.sortDirection === query.sortDirection) return existing;
>         throw new ConflictException('An export is already in progress. Wait for it to finish.');
>       }
>       if (await tx.certificateExport.count({ where: { status: { in: ['queued', 'running'] } } }) >= 20)
>         throw new HttpException('Export queue is full. Please try again shortly.', 429);
>       return tx.certificateExport.create({ data: {
>         tenantId: actor.tenantId, requestedById: actor.id,
>         search: query.search, sortBy: query.sortBy, sortDirection: query.sortDirection,
>         expiresAt: new Date(Date.now() + 86400000),
>       }, select: exportStatusSelect });
>     });
>   }
>   async status(actor: Actor, id: string) {
>     const job = await this.db.certificateExport.findFirst({ where: {
>       id, tenantId: actor.tenantId, requestedById: actor.id, expiresAt: { gt: new Date() },
>     }, select: exportStatusSelect });
>     if (!job) throw new NotFoundException('Export not found or expired');
>     return job;
>   }
>   async download(actor: Actor, id: string, response: Response) {
>     const job = await this.status(actor, id);
>     if (job.status !== 'completed') throw new ConflictException('Export is not ready for download');
>     response.setHeader('Content-Type', 'text/csv; charset=utf-8');
>     response.setHeader('Content-Disposition', `attachment; filename="certificates-${id}.csv"`);
>     response.setHeader('Cache-Control', 'no-store');
>     response.setHeader('X-Content-Type-Options', 'nosniff');
>     const db = this.db;
>     async function* chunks() {
>       let sequence = 0;
>       while (!response.destroyed) {
>         const chunk = await db.certificateExportChunk.findUnique({ where: { exportId_sequence: { exportId: id, sequence } } });
>         if (!chunk) {
>           if (sequence === 0) throw new Error('Export file unavailable');
>           return;
>         }
>         yield Buffer.from(chunk.content); sequence++;
>       }
>     }
>     try { await pipeline(Readable.from(chunks()), response); }
>     catch { response.destroy(); }
>   }
> }
> ''')
> (r/'certificate-exports.module.ts').write_text('''import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
> import type { Response } from 'express';
> import { DatabaseModule } from '../../common/database/database.module.js';
> import { ActorGuard, AuthModule, type ActorRequest } from '../auth/auth.module.js';
> import { CertificateQueryDto } from '../certificates/list-certificates.dto.js';
> import { CertificateExportsService } from './certificate-exports.service.js';
> @Controller('certificates/exports')
> @UseGuards(ActorGuard)
> class CertificateExportsController {
>   constructor(private readonly exports: CertificateExportsService) {}
>   @Post()
>   @HttpCode(202)
>   create(@Req() request: ActorRequest, @Body() query: CertificateQueryDto) {
>     return this.exports.create(request.actor, query);
>   }
>   @Get(':id')
>   status(@Req() request: ActorRequest, @Param('id', new ParseUUIDPipe()) id: string, @Res({ passthrough: true }) response: Response) {
>     response.setHeader('Cache-Control', 'no-store');
>     return this.exports.status(request.actor, id);
>   }
>   @Get(':id/download')
>   download(@Req() request: ActorRequest, @Param('id', new ParseUUIDPipe()) id: string, @Res() response: Response) {
>     return this.exports.download(request.actor, id, response);
>   }
> }
> @Module({ imports: [DatabaseModule, AuthModule], controllers: [CertificateExportsController], providers: [CertificateExportsService] })
> export class CertificateExportsModule {}
> ''')
> p=r.parent.parent/'app.module.ts';s=p.read_text();s="import { CertificateExportsModule } from './modules/certificate-exports/certificate-exports.module.js';\n"+s;s=s.replace('imports: [CacheModule, AuthModule, CertificatesModule]','imports: [CacheModule, AuthModule, CertificatesModule, CertificateExportsModule]');p.write_text(s)
> PY``
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck`
>
> - Ran `cat apps/api/src/modules/certificates/list-certificates.dto.ts apps/api/src/modules/certificate-exports/csv.ts
> rg -n 'search.replace|exports Certificate' apps/api/src/modules/certificate-exports/export-queue.ts apps/api/prisma/schema.prisma
> ps -eo pid,comm,args`
>
> - Ran ``python3 - <<'PY'
> from pathlib import Path
> r=Path('/tmp/training-platform-certificate-csv-export')
> (r/'apps/web/src/features/certificates/CertificateExport.tsx').write_text('''import { useEffect, useRef, useState } from 'react';
> import { isCertificateExportStatus, type CertificateExportRequest, type CertificateExportStatus } from '@training/shared';
>
> export function CertificateExport({ token, filters, enabled }: { token: string; filters: CertificateExportRequest; enabled: boolean }) {
>   const [job, setJob] = useState<CertificateExportStatus | null>(null);
>   const [busy, setBusy] = useState(false);
>   const [downloading, setDownloading] = useState(false);
>   const [error, setError] = useState('');
>   const [pollAttempt, setPollAttempt] = useState(0);
>   const [pollFailed, setPollFailed] = useState(false);
>   const action = useRef<AbortController | null>(null);
>   const active = useRef(true);
>   useEffect(() => {
>     active.current = true;
>     return () => { active.current = false; action.current?.abort(); };
>   }, []);
>   const pending = job?.status === 'queued' || job?.status === 'running';
>   useEffect(() => {
>     if (!job || !pending) return;
>     let cancelled = false;
>     let timer: ReturnType<typeof setTimeout>;
>     let controller: AbortController;
>     const id = job.id;
>     async function poll() {
>       controller = new AbortController();
>       const timeout = setTimeout(() => controller.abort(), 10000);
>       try {
>         const response = await fetch(`/api/certificates/exports/${id}`, {
>           headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
>         });
>         if (!response.ok) throw new Error(response.status === 401 ? 'Supply a valid admin token.' : response.status === 404 ? 'Export expired or is unavailable. Start a new export.' : 'Unable to check export progress.');
>         const data: unknown = await response.json();
>         if (!isCertificateExportStatus(data) || data.id !== id) throw new Error('Invalid export response.');
>         if (!cancelled) {
>           setJob(data); setPollFailed(false); setError('');
>           if (data.status === 'queued' || data.status === 'running') timer = setTimeout(() => void poll(), 500);
>         }
>       } catch (cause) {
>         if (!cancelled) {
>           setPollFailed(true);
>           setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Unable to check export progress.');
>         }
>       } finally { clearTimeout(timeout); }
>     }
>     void poll();
>     return () => { cancelled = true; clearTimeout(timer); controller?.abort(); };
>   }, [job?.id, pending, token, pollAttempt]);
>   async function start() {
>     setBusy(true); setError(''); setPollFailed(false);
>     const controller = new AbortController(); action.current = controller;
>     const timeout = setTimeout(() => controller.abort(), 10000);
>     try {
>       const response = await fetch('/api/certificates/exports', {
>         method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
>         body: JSON.stringify(filters), signal: controller.signal,
>       });
>       if (!response.ok) throw new Error(response.status === 401 ? 'Supply a valid admin token.' : response.status === 409 ? 'An export is already in progress. Wait for it to finish.' : response.status === 429 ? 'Export queue is full. Please try again shortly.' : 'Unable to start export. Please retry.');
>       const data: unknown = await response.json();
>       if (!isCertificateExportStatus(data)) throw new Error('Invalid export response.');
>       if (active.current) { setJob(data); setPollAttempt(value => value + 1); }
>     } catch (cause) {
>       if (active.current) setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Unable to start export. Please retry.');
>     } finally { clearTimeout(timeout); if (active.current) setBusy(false); }
>   }
>   async function download() {
>     if (!job) return;
>     setDownloading(true); setError('');
>     const controller = new AbortController(); action.current = controller;
>     const timeout = setTimeout(() => controller.abort(), 60000);
>     try {
>       const response = await fetch(`/api/certificates/exports/${job.id}/download`, {
>         headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
>       });
>       if (!response.ok) throw new Error(response.status === 404 ? 'Export expired or is unavailable. Start a new export.' : 'Unable to download CSV. Please retry.');
>       const blob = await response.blob();
>       if (!active.current) return;
>       const url = URL.createObjectURL(blob);
>       const link = document.createElement('a'); link.href = url; link.download = `certificates-${job.id}.csv`;
>       document.body.append(link); link.click(); link.remove();
>       setTimeout(() => URL.revokeObjectURL(url), 1000);
>     } catch (cause) {
>       if (active.current) setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Unable to download CSV. Please retry.');
>     } finally { clearTimeout(timeout); if (active.current) setDownloading(false); }
>   }
>   const percent = job && job.total > 0 ? Math.floor(job.processed / job.total * 100) : 0;
>   return <div className="certificate-export" role="group" aria-label="Certificate CSV export">
>     <button type="button" disabled={!enabled || busy || pending || downloading} onClick={() => void start()}>{busy ? 'Starting export…' : 'Export CSV'}</button>
>     <p>Exports all matching certificates across pages using the applied search and sort.</p>
>     {job && <>
>       <p>Export search: {job.search || 'All certificates'}; sort: {job.sortBy}, {job.sortDirection}.</p>
>       {pending && <>
>         <progress aria-label="CSV export progress" max={100} value={job.status === 'running' && job.total > 0 ? percent : undefined} />
>         <p role="status">{job.status === 'queued' ? 'Export queued…' : `Exporting ${job.processed.toLocaleString()} of ${job.total.toLocaleString()} certificates (${percent}%).`}</p>
>       </>}
>       {job.status === 'completed' && <>
>         <progress aria-label="CSV export progress" max={100} value={100} />
>         <p role="status">Export ready: {job.total.toLocaleString()} certificates. Download available until {new Date(job.expiresAt).toLocaleString()}.</p>
>         <button type="button" disabled={downloading} onClick={() => void download()}>{downloading ? 'Downloading…' : 'Download CSV'}</button>
>       </>}
>       {job.status === 'failed' && <p role="alert">{job.error || 'Export failed.'} Use Export CSV to retry.</p>}
>     </>}
>     {error && <p role="alert">{error}</p>}
>     {pollFailed && <button type="button" onClick={() => { setPollFailed(false); setError(''); setPollAttempt(value => value + 1); }}>Retry export status</button>}
>   </div>;
> }
> ''')
> p=r/'apps/web/src/features/certificates/CertificateList.tsx';s=p.read_text();s="import { CertificateExport } from './CertificateExport';\n"+s;s=s.replace('    <p role="status" aria-live="polite">','    <CertificateExport key={token} token={token} filters={{ search, sortBy, sortDirection }} enabled={Boolean(token) && state === \'ready\'} />\n    <p role="status" aria-live="polite">');p.write_text(s)
> p=r/'apps/web/src/styles/global.css';p.write_text(p.read_text()+ '\n.certificate-export { margin-block: 1rem; padding: 1rem; border: 1px solid #8795a5; border-radius: 0.5rem; }\n.certificate-export progress { width: min(100%, 30rem); height: 1.25rem; }\n')
> PY``
>
> <details><summary>Explored 2 files</summary>
>
> - Read `./apps/api/prisma/demo-data.mjs`
> - Read `./apps/api/test/integration/models.test.mjs`
>
> </details>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run build`
>
> - Ran `docker run --detach --name training-csv-export-tests --publish 127.0.0.1:55449:5432 --env POSTGRES_USER=export_test --env POSTGRES_PASSWORD=local-test-only --env POSTGRES_DB=export_test postgres:17.6-bookworm`
>
> </details>
>
> The API and frontend are implemented, and the first lint and build checks pass. I’m now testing authorization, search/sort parity, download behavior, and restart recovery against an isolated PostgreSQL instance before running the large export benchmark.
>
> <details><summary>Created 4 files, edited a file, ran 11 commands</summary>
>
> - Ran ``python3 - <<'PY'
> from pathlib import Path
> r=Path('/tmp/training-platform-certificate-csv-export')
> p=r/'apps/api/src/modules/certificate-exports/export-worker.ts';s=p.read_text().replace("let content = '';", "let content = '', contentBytes = 0;").replace("if (Buffer.byteLength(line) > 2 * 1024 * 1024)","const lineBytes = Buffer.byteLength(line);\n          if (lineBytes > 2 * 1024 * 1024)").replace("if (Buffer.byteLength(content) + Buffer.byteLength(line) > 2 * 1024 * 1024)","if (contentBytes + lineBytes > 2 * 1024 * 1024)").replace("await persist(content); content = '';","await persist(content); content = ''; contentBytes = 0;").replace('content += line; processed++;','content += line; contentBytes += lineBytes; processed++;');p.write_text(s)
> p=r/'apps/web/src/features/certificates/CertificateExport.tsx';s=p.read_text().replace("if (!response.ok) throw new Error(response.status === 401 ? 'Supply a valid admin token.' : response.status === 404", "if (response.status === 404 && !cancelled) setJob(null);\n        if (!response.ok) throw new Error(response.status === 401 ? 'Supply a valid admin token.' : response.status === 404",1);s=s.replace("setPollFailed(true);\n          setError", "setPollFailed(true);\n          setError");p.write_text(s)
> # Keep one read snapshot during streaming so expiration cleanup cannot truncate an active download.
> p=r/'apps/api/src/modules/certificate-exports/certificate-exports.service.ts';s=p.read_text();a=s.index('    const db = this.db;');b=s.index('\n  }\n}',a);s=s[:a]+'''    try {
>       await this.db.$transaction(async tx => {
>         async function* chunks() {
>           let sequence = 0;
>           while (!response.destroyed) {
>             const chunk = await tx.certificateExportChunk.findUnique({ where: { exportId_sequence: { exportId: id, sequence } } });
>             if (!chunk) {
>               if (sequence === 0) throw new Error('Export file unavailable');
>               return;
>             }
>             yield Buffer.from(chunk.content); sequence++;
>           }
>         }
>         await pipeline(Readable.from(chunks()), response, { signal: AbortSignal.timeout(60000) });
>       }, { isolationLevel: 'RepeatableRead', timeout: 65000 });
>     } catch { response.destroy(); }'''+s[b:];p.write_text(s)
> (r/'apps/api/test/certificate-exports.test.mjs').write_text('''import { test } from 'node:test';
> import assert from 'node:assert/strict';
> import { csvCell, csvHeader, csvRow } from '../dist/modules/certificate-exports/csv.js';
> import { isCertificateExportStatus } from '@training/shared';
> test('CSV preserves Unicode, delimiters, quotes and line breaks while neutralizing formulas', () => {
>   assert.equal(csvCell('李, "Alex"\\r\\nLee'), '"李, ""Alex""\\r\\nLee"');
>   for (const text of ['=1+1', '+1', '-1', '@SUM(A1)', '  =1', '\\tname', '\\nname', '\\uFEFF=1']) assert.equal(csvCell(text), `"'${text}"`);
>   assert.equal(csvRow({ learnerName: 'Alex', courseTitle: '安全', serialNumber: 'CERT-1', issueDate: '2025-12-31' }), '"Alex","安全","CERT-1","2025-12-31"\\r\\n');
>   assert.ok(csvHeader.startsWith('\\uFEFF'));
> });
> test('export contract rejects malformed or impossible progress', () => {
>   const valid = { id: '00000000-0000-4000-8000-000000000000', status: 'running', processed: 2, total: 3, search: '', sortBy: 'issuedAt', sortDirection: 'desc', createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), error: null };
>   assert.equal(isCertificateExportStatus(valid), true);
>   for (const patch of [{ id: '../secret' }, { processed: -1 }, { total: 1 }, { total: 1.5 }, { sortBy: 'tenantId' }, { status: 'unknown' }]) assert.equal(isCertificateExportStatus({ ...valid, ...patch }), false);
> });
> ''')
> PY``
> - Ran ``mkdir -p apps/api/test/helpers apps/api/test/performance
> python3 - <<'PY'
> from pathlib import Path
> import json
> r=Path('/tmp/training-platform-certificate-csv-export')
> (r/'apps/api/test/helpers/export-fixture.mjs').write_text('''import 'reflect-metadata';
> import assert from 'node:assert/strict';
> import { randomUUID } from 'node:crypto';
> import { readFile, unlink } from 'node:fs/promises';
> import { spawnSync } from 'node:child_process';
> import { setTimeout as delay } from 'node:timers/promises';
> import pg from 'pg';
> import { DatabaseService } from '../../dist/common/database/database.service.js';
> import { createApp } from '../../dist/app.js';
> import { seedDemoData, generateEastCertificates } from '../../prisma/demo-data.mjs';
>
> export async function exportFixture({ large = false } = {}) {
>   if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to an isolated test database');
>   const schema = `export_test_${randomUUID().replaceAll('-', '')}`;
>   const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('schema', schema);
>   process.env.DATABASE_URL = url.toString();
>   const tokenFile = `/tmp/${schema}.json`;
>   const sql = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
>   await sql.connect(); await sql.query(`CREATE SCHEMA "${schema}"`);
>   let app, db;
>   async function close() {
>     await app?.close(); await db?.$disconnect();
>     await sql.query(`DROP SCHEMA "${schema}" CASCADE`); await sql.end();
>     await unlink(tokenFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
>   }
>   try {
>     for (let pass = 0; pass < 2; pass++) {
>       const migration = spawnSync(process.execPath, ['../../node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: process.env, encoding: 'utf8' });
>       assert.equal(migration.status, 0, migration.stdout + migration.stderr);
>     }
>     db = new DatabaseService(); await seedDemoData(db, tokenFile);
>     if (large) await generateEastCertificates(db);
>     const credentials = JSON.parse(await readFile(tokenFile, 'utf8'));
>     const east = credentials.find(row => row.tenant === 'East'), west = credentials.find(row => row.tenant === 'West');
>     app = await createApp(); await app.listen(0, '127.0.0.1');
>     const base = await app.getUrl();
>     async function request(path, { method = 'GET', body, token = [REDACTED_SECRET] } = {}) {
>       return fetch(`${base}/api/${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
>     }
>     async function start(filters = {}) {
>       const response = await request('certificates/exports', { method: 'POST', body: { search: '', sortBy: 'issuedAt', sortDirection: 'desc', ...filters } });
>       assert.equal(response.status, 202, await response.clone().text()); return response.json();
>     }
>     async function wait(id, timeout = 60000) {
>       const deadline = Date.now() + timeout;
>       while (Date.now() < deadline) {
>         const response = await request(`certificates/exports/${id}`); assert.equal(response.status, 200);
>         const job = await response.json();
>         if (job.status === 'failed') assert.fail(job.error);
>         if (job.status === 'completed') return job;
>         assert.ok(job.processed <= job.total);
>         await delay(50);
>       }
>       assert.fail('Export did not complete within deadline');
>     }
>     return { db, app, request, start, wait, close, east, west, base };
>   } catch (error) { await close(); throw error; }
> }
> // Independent parser verifies exported CSV rather than comparing serializer output.
> export function parseCsv(text) {
>   const rows = []; let row = [], cell = '', quoted = false;
>   const source = text.replace(/^\\uFEFF/, '');
>   for (let i = 0; i < source.length; i++) {
>     const char = source[i];
>     if (char === '"') {
>       if (quoted && source[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
>     } else if (!quoted && char === ',') { row.push(cell); cell = ''; }
>     else if (!quoted && char === '\\r' && source[i + 1] === '\\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
>     else cell += char;
>   }
>   assert.equal(quoted, false); assert.equal(cell, ''); assert.equal(row.length, 0);
>   return rows;
> }
> ''')
> (r/'apps/api/test/integration/certificate-exports.test.mjs').write_text('''import { test, before, after } from 'node:test';
> import assert from 'node:assert/strict';
> import { randomBytes, randomUUID } from 'node:crypto';
> import { exportFixture, parseCsv } from '../helpers/export-fixture.mjs';
> import { hashToken } from '../../dist/modules/auth/auth.module.js';
> import { CertificateExportsService } from '../../dist/modules/certificate-exports/certificate-exports.service.js';
> import { claimExport } from '../../dist/modules/certificate-exports/export-queue.js';
> let f;
> before(async () => { f = await exportFixture(); });
> after(async () => { await f?.close(); });
> test('export routes enforce validation, authentication and owner/tenant boundaries', async () => {
>   for (const token of ['', 'invalid', randomBytes(32).toString('base64url')]) assert.equal((await f.request('certificates/exports', { method: 'POST', body: {}, token })).status, 401);
>   for (const body of [{ tenantId: f.west.tenantId }, { page: 1 }, { sortBy: 'id' }, { sortDirection: 'bad' }, { search: 'x'.repeat(201) }]) assert.equal((await f.request('certificates/exports', { method: 'POST', body })).status, 400);
>   const job = await f.start(); await f.wait(job.id);
>   const otherToken = randomBytes(32).toString('base64url');
>   await f.db.admin.create({ data: { tenantId: f.east.tenantId, name: 'Other admin', tokenHash: hashToken(otherToken) } });
>   for (const token of [f.west.token, otherToken]) for (const suffix of ['', '/download']) assert.equal((await f.request(`certificates/exports/${job.id}${suffix}`, { token })).status, 404);
>   assert.equal((await f.request('certificates/exports/not-a-uuid')).status, 400);
>   assert.equal((await f.request(`certificates/exports/${randomUUID()}/download`)).status, 404);
>   const res = await f.request(`certificates/exports/${job.id}`); const status = await res.json();
>   assert.equal(res.headers.get('cache-control'), 'no-store');
>   assert.equal('tenantId' in status, false); assert.equal('leaseId' in status, false);
> });
> test('every search/sort exports all matching rows in list order, including revoked and historical dates', async () => {
>   const learner = await f.db.learner.findFirstOrThrow({ where: { tenantId: f.east.tenantId, name: 'Alex Lee' } });
>   await f.db.learner.update({ where: { id: learner.id }, data: { name: '李, "Alex"\\r\\n%_\\\\Lee' } });
>   const foreign = await f.db.certificate.findFirstOrThrow({ where: { tenantId: f.west.tenantId } });
>   const own = await f.db.certificate.findFirstOrThrow({ where: { tenantId: f.east.tenantId } });
>   for (const sortBy of ['issuedAt', 'learnerName', 'serialNumber', 'courseTitle']) for (const sortDirection of ['asc', 'desc']) {
>     const params = new URLSearchParams({ sortBy, sortDirection, pageSize: '100' });
>     const list = await (await f.request(`certificates?${params}`)).json();
>     const job = await f.start({ sortBy, sortDirection }); const ready = await f.wait(job.id);
>     assert.equal(ready.total, list.total); assert.equal(ready.processed, list.total);
>     const response = await f.request(`certificates/exports/${job.id}/download`);
>     assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /text\\/csv/);
>     assert.match(response.headers.get('content-disposition'), /attachment/);
>     const rows = parseCsv(await response.text());
>     assert.deepEqual(rows[0], ['Learner name', 'Course title', 'Serial number', 'Issue date']);
>     assert.deepEqual(rows.slice(1), list.items.map(row => [row.learnerName, row.courseTitle, row.serialNumber, row.issueDate]));
>     assert.ok(list.items.some(row => row.status === 'revoked'));
>   }
>   for (const search of ['%', '_', '\\\\', 'mOrGaN', own.serialNumber.toLowerCase(), foreign.serialNumber, 'no such learner']) {
>     const params = new URLSearchParams({ search, pageSize: '100' });
>     const list = await (await f.request(`certificates?${params}`)).json();
>     const job = await f.start({ search }); await f.wait(job.id);
>     const rows = parseCsv(await (await f.request(`certificates/exports/${job.id}/download`)).text());
>     assert.deepEqual(rows.slice(1), list.items.map(row => [row.learnerName, row.courseTitle, row.serialNumber, row.issueDate]));
>   }
> });
> test('duplicate starts reuse active job; conflicting starts fail; interrupted jobs recover after restart', async () => {
>   const service = f.app.get(CertificateExportsService);
>   await service.onModuleDestroy();
>   const [a, b] = await Promise.all([f.start(), f.start()]); assert.equal(a.id, b.id);
>   assert.equal((await f.request('certificates/exports', { method: 'POST', body: { search: 'different' } })).status, 409);
>   assert.equal((await f.request(`certificates/exports/${a.id}/download`)).status, 409);
>   const claimed = await claimExport(f.db); assert.equal(claimed.id, a.id);
>   await f.db.certificateExport.update({ where: { id: a.id }, data: { leaseUntil: new Date(0) } });
>   await f.db.certificateExportChunk.create({ data: { exportId: a.id, sequence: 0, content: Buffer.from('partial file') } });
>   const recovered = await claimExport(f.db);
>   assert.equal(recovered.attempts, 2); assert.notEqual(recovered.leaseId, claimed.leaseId);
>   assert.equal(await f.db.certificateExportChunk.count({ where: { exportId: a.id } }), 0);
>   // Simulate another process crash and then restart the whole HTTP application.
>   await f.db.certificateExport.update({ where: { id: a.id }, data: { leaseUntil: new Date(0) } });
>   await f.app.close();
>   const { createApp } = await import('../../dist/app.js');
>   const app = await createApp(); await app.listen(0, '127.0.0.1');
>   try {
>     const base = await app.getUrl();
>     const deadline = Date.now() + 10000; let status;
>     while (Date.now() < deadline) {
>       status = await (await fetch(`${base}/api/certificates/exports/${a.id}`, { headers: { Authorization: `Bearer ${f.east.token}` } })).json();
>       if (status.status === 'completed') break;
>       await new Promise(resolve => setTimeout(resolve, 50));
>     }
>     assert.equal(status.status, 'completed');
>     const response = await fetch(`${base}/api/certificates/exports/${a.id}/download`, { headers: { Authorization: `Bearer ${f.east.token}` } });
>     assert.equal(parseCsv(await response.text()).length, status.total + 1);
>   } finally { await app.close(); }
> });
> test('expired artifacts are inaccessible and cleanup removes only export data', async () => {
>   const job = await f.db.certificateExport.findFirstOrThrow({ where: { status: 'completed' } });
>   const count = await f.db.certificate.count();
>   await f.db.certificateExport.update({ where: { id: job.id }, data: { expiresAt: new Date(0) } });
>   await assert.rejects(f.app.get(CertificateExportsService).status({ id: f.east.adminId, tenantId: f.east.tenantId }, job.id), /expired/);
>   await claimExport(f.db);
>   assert.equal(await f.db.certificateExportChunk.count({ where: { exportId: job.id } }), 0);
>   assert.equal(await f.db.certificate.count(), count);
> });
> ''')
> (r/'apps/api/test/performance/certificate-exports.test.mjs').write_text('''import { test } from 'node:test';
> import assert from 'node:assert/strict';
> import os from 'node:os';
> import { exportFixture, parseCsv } from '../helpers/export-fixture.mjs';
> test('100,000 East certificates export within 60 seconds from acceptance to ready', { timeout: 600000 }, async t => {
>   const f = await exportFixture({ large: true });
>   try {
>     const timings = [];
>     for (const sortBy of ['issuedAt', 'learnerName', 'serialNumber', 'courseTitle']) for (const sortDirection of ['asc', 'desc']) {
>       const accepted = performance.now();
>       const job = await f.start({ sortBy, sortDirection });
>       const ready = await f.wait(job.id);
>       const elapsed = performance.now() - accepted;
>       timings.push({ sortBy, sortDirection, milliseconds: Math.round(elapsed) });
>       assert.equal(ready.total, 100000); assert.equal(ready.processed, 100000);
>       assert.ok(elapsed < 60000, `${sortBy} ${sortDirection}: ${elapsed}ms`);
>       const download = await f.request(`certificates/exports/${job.id}/download`);
>       const rows = parseCsv(await download.text());
>       assert.equal(rows.length, 100001); assert.equal(new Set(rows.slice(1).map(row => row[2])).size, 100000);
>       const health = await f.request('health'); assert.equal(health.status, 200);
>     }
>     t.diagnostic(JSON.stringify({ node: process.version, cpus: os.cpus().length, cpu: os.cpus()[0]?.model, memoryGiB: Math.round(os.totalmem() / 2 ** 30), timings }));
>   } finally { await f.close(); }
> });
> ''')
> p=r/'apps/api/package.json';s=json.loads(p.read_text());s['scripts']['test:db']+=' test/integration/certificate-exports.test.mjs';s['scripts']['test:export:performance']='npm run build && node --test test/performance/certificate-exports.test.mjs';p.write_text(json.dumps(s,indent=2)+'\n')
> p=r/'package.json';s=json.loads(p.read_text());s['scripts']['test:export:performance']='npm run build -w @training/shared && npm run test:export:performance -w @training/api';p.write_text(json.dumps(s,indent=2)+'\n')
> PY``
> - Ran `rmdir apps/api/test/helpers apps/api/test/performance`
> - Ran `mkdir -p apps/api/test/helpers apps/api/test/performance`
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/test/helpers/export-fixture.mjs` (+74 -0)
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/test/integration/certificate-exports.test.mjs` (+90 -0)
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/test/performance/certificate-exports.test.mjs` (+24 -0)
> - Ran `python3 - <<'PY'
> from pathlib import Path
> import json
> r=Path('/tmp/training-platform-certificate-csv-export')
> p=r/'apps/api/package.json';s=json.loads(p.read_text());s['scripts']['test:db']+=' test/integration/certificate-exports.test.mjs';s['scripts']['test:export:performance']='npm run build && node --test test/performance/certificate-exports.test.mjs';p.write_text(json.dumps(s,indent=2)+'\n')
> p=r/'package.json';s=json.loads(p.read_text());s['scripts']['test:export:performance']='npm run build -w @training/shared && npm run test:export:performance -w @training/api';p.write_text(json.dumps(s,indent=2)+'\n')
> PY`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://export_test:local-test-only@127.0.0.1:55449/export_test npm run test:db`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm test`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://export_test:local-test-only@127.0.0.1:55449/export_test npm run test:db`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm test`
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/web/e2e/certificate-exports.spec.ts` (+75 -0)
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/src/modules/certificate-exports/certificate-exports.service.ts` (+1 -1)
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://export_test:local-test-only@127.0.0.1:55449/export_test npm run build --workspace @training/api`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e --workspace @training/web`
>
> </details>
>
> The unit tests pass. Database tests found a job-creation error caused by Prisma’s handling of PostgreSQL’s advisory-lock return value; I’ve corrected that and am rerunning the export tests. Browser coverage now includes progress, downloads, filter preservation, and failure recovery.
>
> <details><summary>Edited 2 files, explored 2 files, ran 6 commands</summary>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://export_test:local-test-only@127.0.0.1:55449/export_test node --test test/integration/certificate-exports.test.mjs`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://export_test:local-test-only@127.0.0.1:55449/export_test npm run test:export:performance`
>
> - Ran `git diff --stat
> git status --short`
>
> <details><summary>Explored 2 files</summary>
>
> - Read `./apps/api/src/main.ts`
> - Read `./apps/web/test-results/.last-run.json`
>
> </details>
>
> - Ran `ps -eo pid,ppid,comm,args`
>
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/src/modules/certificate-exports/certificate-exports.service.ts` (+1 -0)
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e --workspace @training/web`
>
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/test/integration/certificate-exports.test.mjs` (+14 -0)
>
> - Ran ````python3 - <<'PY'
> from pathlib import Path
> r=Path('/tmp/training-platform-certificate-csv-export')
> p=r/'README.md';s=p.read_text().replace('Both statuses appear; the list has no revocation, export, or status filter.','Both statuses appear; the list has no revocation or status filter. CSV export is available for all matching rows.');s+='''
> ## Certificate CSV export
>
> Apply the additive export migration explicitly before using this feature. `Export CSV` captures the **applied** search and sort, excludes pagination, and includes both active and revoked certificates. Changing the list afterward does not change an existing export. Columns are learner name, course title, serial number, and historical tenant-local issue date (`YYYY-MM-DD`). Files use UTF-8 with a BOM, CRLF records, quoted cells, escaped quotes, and an apostrophe before spreadsheet formula prefixes (including prefixes after whitespace). Empty results produce a header-only CSV.
>
> All export endpoints require the existing bearer actor guard. Jobs, status, and downloads are scoped to both the tenant and requesting admin. Tokens stay in Authorization headers, never download URLs. Status and downloads are not cacheable.
>
> - `POST /api/certificates/exports`: accepts only `search`, `sortBy`, and `sortDirection`, with the same validation/defaults as the list; returns **202** with job status. Repeated active requests with the same filters reuse the job; different filters return **409** until it finishes. The queue admits at most 20 queued/running jobs; excess starts return **429**.
> - `GET /api/certificates/exports/:id`: returns ID, captured filters, `queued`/`running`/`completed`/`failed` status, processed/total row counts, creation/expiry timestamps, and a safe error. Invalid IDs return **400**; foreign, missing, or expired jobs return **404**.
> - `GET /api/certificates/exports/:id/download`: streams the completed CSV as an attachment. Unfinished/failed jobs return **409**. Downloads remain available for **24 hours after completion**; expired artifacts are removed by the worker.
>
> A worker thread starts with each API process. PostgreSQL stores durable jobs and CSV chunks; the disposable Redis cache is not involved. Database advisory locks and leases serialize generation across replicas, and partial unique indexing prevents duplicate active jobs per admin. Interrupted jobs restart from a fresh snapshot after their 90-second lease expires, with at most three attempts. Partial chunks are discarded before retry. A retry may include changes made since the interrupted attempt. No automatic retry occurs for a generation failure reported as `failed`; the UI offers a new export.
>
> Generation uses a repeatable-read database snapshot taken when the worker begins processing, a joined SQL cursor fetching 1,000 rows at a time, and the same list ordering (certificate ID ascending breaks ties). Progress is counted from persisted output rows. CSV serialization runs outside the HTTP event loop. Files are limited to 128 MiB, with a 2 MiB limit per encoded row/chunk; oversized exports fail with a recoverable error. Generation transactions are bounded to 55 seconds, with 45-second statement timeouts. Downloads stream with backpressure and a 60-second timeout. A repeatable-read download snapshot prevents cleanup from removing later chunks mid-download. The browser polls status every 500 ms, supports retrying status checks, and retains no job/token state after reload.
>
> Verification prerequisites: Node/npm versions above, installed dependencies, Chromium for browser tests, and an **explicit isolated PostgreSQL URL** whose user may create/drop temporary schemas. Tests apply all migrations twice and remove only their own schemas and temporary token files. They never migrate the configured development database.
>
> ```sh
> TEST_DATABASE_URL='<isolated PostgreSQL URL>' npm run test:db
> npm run test:e2e
> TEST_DATABASE_URL='<isolated PostgreSQL URL>' npm run test:export:performance
> ```
>
> The performance command seeds an isolated East tenant with exactly 100,000 certificates, retains West fixtures, and measures every sort field in both directions. Each measurement includes POST acceptance, worker queue pickup, generation, persistence, and polling until ready; file download is checked separately. The acceptance target is **under 60 seconds for one active export on the local development stack**, excluding download time. Results report Node version, host CPU/memory, and per-sort timings; concurrent-load and other hardware guarantees require separate measurement.
>
> The export migration creates new tables/indexes and does not rewrite certificate or audit history. Before production rollout, take and verify a database backup, apply migrations as a separate authorized deployment step, and investigate any failed migration before retrying. Application rollback can leave these additive tables in place; retain exports until their retention window ends rather than dropping data during rollback.
> ''';p.write_text(s)
> p=r/'docs/data-model.md';s=p.read_text().replace('Revocation endpoints, exports, and administrative CRUD remain future scopes.','CSV exports use durable PostgreSQL jobs and chunked artifacts, scoped to the tenant and requesting admin. Revocation endpoints and administrative CRUD remain future scopes.');s+='''
> ## Export jobs
>
> CertificateExport references its requester through `(tenantId, requestedById)` to enforce tenant ownership. A partial unique index allows at most one queued/running job per admin. Captured search/sort fields are validated by the API and constrained in the database. Job progress satisfies `0 <= processed <= total`. CertificateExportChunk stores ordered CSV bytes and cascades only when its export is removed; no certificate or audit relation is deleted by export cleanup.
>
> Workers claim jobs under a transaction-scoped advisory lock. A lease UUID fences every progress/chunk write and final status update, so a worker that lost ownership cannot publish stale output. Each fresh/retried attempt uses a new repeatable-read data snapshot. Artifacts expire 24 hours after completion; queued/interrupted metadata also has a bounded initial 24-hour lifetime. Cleanup removes expired jobs and their chunks, never certificate history. A generation timeout/failure removes partial output; interrupted processes leave leases that another worker can reclaim. See README's certificate export section for endpoint contracts, limits, and performance verification.
> ''';p.write_text(s)
> p=r/'AGENTS.md';s=p.read_text().replace('Course-based bulk issuance supports per-learner outcomes and duplicate submission prevention.','Course-based bulk issuance supports per-learner outcomes and duplicate submission prevention. Certificate CSV export uses PostgreSQL-backed background jobs, progress polling, and authenticated downloads retained for 24 hours.');s=s.replace('| Run browser workflows |','| Benchmark 100,000-row exports (explicit isolated TEST_DATABASE_URL required) | `npm run test:export:performance` |\n| Run browser workflows |');p.write_text(s)
> PY````
>
> </details>
>
> The 100,000-row benchmark passed for all eight sort combinations: each CSV was ready in 1.01–1.39 seconds, below the 60-second target. Downloads also contained 100,000 unique certificates.
>
> The export database tests pass, including owner isolation and restart recovery. One browser test timed out; I’m checking that interaction and will rerun the affected workflow.
>
> <details><summary>Edited 4 files, ran 6 commands</summary>
>
> - Ran `rg --files apps/web/test-results
> cat apps/web/test-results/certificate-exports-exports-*/error-context.md`
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/test/performance/certificate-exports.test.mjs` (+15 -2)
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/web/e2e/certificate-exports.spec.ts` (+1 -1)
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run build`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint`
> - Ran `git diff --check
> cat apps/api/src/modules/certificate-exports/certificate-exports.service.ts`
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/src/modules/certificate-exports/export-queue.ts` (+9 -3)
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e --workspace @training/web -- certificate-exports.spec.ts`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck`
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/test/integration/certificate-exports.test.mjs` (+16 -1)
>
> </details>
>
> The export browser tests pass after correcting the test’s sort selector. During review, I also fixed a recovery race: a replacement worker now takes ownership before deleting partial chunks, preventing a stale worker from appending old output. I’m running the final checks and repeating the benchmark while making list and health requests.
>
> <details><summary>Edited 4 files, explored a search, ran 10 commands</summary>
>
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/src/modules/certificate-exports/certificate-exports.service.ts` (+5 -2)
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/web/src/features/certificates/CertificateExport.tsx` (+5 -2)
>
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/web/e2e/certificate-exports.spec.ts` (+18 -0)
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://export_test:local-test-only@127.0.0.1:55449/export_test npm run test:db`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint`
>
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/src/modules/certificate-exports/export-worker.ts` (+1 -1)
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e`
>
> - Ran `git diff -- AGENTS.md apps/api/package.json apps/api/prisma/schema.prisma apps/api/src/app.module.ts apps/api/src/modules/certificates/list-certificates.dto.ts apps/web/src/features/certificates/CertificateList.tsx apps/web/src/styles/global.css package.json packages/shared/src/index.ts
> git diff --check`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm test`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://export_test:local-test-only@127.0.0.1:55449/export_test npm run test:export:performance`
>
> - Ran `cat apps/api/src/modules/certificate-exports/export-queue.ts apps/api/src/modules/certificate-exports/export-worker.ts apps/api/src/modules/certificate-exports/certificate-exports.module.ts packages/shared/src/certificate-exports.ts
> cat apps/api/prisma/migrations/20261031020000_certificate_exports/migration.sql`
>
> - Ran `git diff --check
>  git status --short --branch
>  git diff --numstat`
>
> - Ran `git status --short --branch`
>
> <details><summary>Explored a search</summary>
>
> - Searched for `[ \t]+$` in `certificate-exports`
>
> </details>
>
> </details>
>
> All 14 browser tests, 27 database tests, and 10 unit tests passed, along with build, lint, and typecheck.
>
> The final benchmark completed every 100,000-row export in 1.05–1.32 seconds while list requests continued to succeed. Health responses stayed at or below 5 ms. I’m recording the results and stopping the isolated test database; the development database is unchanged.
>
> <details><summary>Edited 2 files, ran 4 commands</summary>
>
> - Wrote `/tmp/training-platform-certificate-csv-export/README.md` (+9 -0)
> - Wrote `/tmp/training-platform-certificate-csv-export/apps/api/src/modules/certificates/list-certificates.dto.ts` (+0 -1)
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://export_test:local-test-only@127.0.0.1:55449/export_test node --test --test-name-pattern='every search/sort|historical' test/integration/certificate-exports.test.mjs`
> - Ran `git diff --check
>  git status --short --branch`
> - Ran `docker stop training-csv-export-tests`
> - Ran `git diff --check`
>
> </details>
</details>

Implemented on `codex/certificate-csv-export` in the [new worktree](/tmp/training-platform-certificate-csv-export/README.md).

- CSV includes all four requested fields and preserves applied search/sort across all pages.
- PostgreSQL background jobs support progress, restart recovery, and downloads retained for 24 hours.
- 100,000-row exports completed in **1.05–1.32 seconds** across all eight sort combinations.

Passed build, lint, typecheck, 10 unit tests, 27 database tests, and 14 browser tests.

The migration is included but must be applied before use. Development data is unchanged; changes remain uncommitted.

> commit the work and merge into main. Then restart the application

<details><summary>6 previous messages</summary>

> I’ll check the worktree and local application setup, commit the export changes, merge them into `main`, then apply the migration and restart the local application.
>
> <details><summary>Explored a list, ran 9 commands</summary>
>
> - Ran `cat compose.yaml compose.production.yaml
> sed -n '1,72p' README.md
> cat package.json`
>
> - Ran `git status --short --branch
> git log -3 --oneline
> git worktree list`
>
> - Ran `git status --short --branch
> git diff --check
> git diff --stat
> cat AGENTS.md`
>
> - Ran `git diff 769365c..main --stat
> git diff 769365c..main -- apps/web/src/features/certificates/CertificateList.tsx packages/shared/src/index.ts apps/api/src/modules/certificates/certificates.controller.ts AGENTS.md docs/data-model.md README.md`
>
> - Ran `docker compose -p training-platform-dev ps
> ss -ltnp '( sport = :3000 or sport = :5173 )'`
>
> <details><summary>Explored a list</summary>
>
> - Listed files
>
> </details>
>
> - Ran `git add AGENTS.md README.md apps/api/package.json apps/api/prisma/schema.prisma apps/api/prisma/migrations/20261031020000_certificate_exports apps/api/src/app.module.ts apps/api/src/modules/certificates/list-certificates.dto.ts apps/api/src/modules/certificate-exports apps/api/test/certificate-exports.test.mjs apps/api/test/helpers/export-fixture.mjs apps/api/test/integration/certificate-exports.test.mjs apps/api/test/performance/certificate-exports.test.mjs apps/web/e2e/certificate-exports.spec.ts apps/web/src/features/certificates/CertificateExport.tsx apps/web/src/features/certificates/CertificateList.tsx apps/web/src/styles/global.css docs/data-model.md package.json packages/shared/src/index.ts packages/shared/src/certificate-exports.ts
> git diff --cached --check
> git commit -m "feat: add background certificate CSV exports"`
>
> - Ran `ps -p 2711815,2711888 -o pid,ppid,args
> readlink /proc/2711815/cwd /proc/2711888/cwd`
>
> - Ran `git merge --no-ff --no-commit codex/certificate-csv-export`
>
> - Ran `git diff --cc
> cat apps/api/package.json`
>
> </details>
>
> `main` has gained certificate detail and revocation since the export branch was created. The export commit is saved as `1b9fb5a`. I’m resolving the merge conflicts to keep both features, then I’ll verify the combined application before restarting it.
>
> <details><summary>Ran 12 commands</summary>
>
> - Ran `python3 - <<'PY'
> from pathlib import Path
> import re,json,subprocess
> for name in ['AGENTS.md','README.md','apps/api/package.json','apps/web/src/features/certificates/CertificateList.tsx','apps/web/src/styles/global.css','docs/data-model.md']:
>  p=Path(name);s=p.read_text()
>  def resolve(m):
>   ours,theirs=m.group(1),m.group(2)
>   if name=='AGENTS.md': return ours.replace('Certificate detail and confirmed revocation', 'Certificate CSV export uses PostgreSQL-backed background jobs, progress polling, and authenticated downloads retained for 24 hours. Certificate detail and confirmed revocation')
>   if name=='README.md':
>    if ours.startswith('The response'): return ours.replace('The list has no export or status filter.', 'CSV export is available for all matching rows; the list has no status filter.')
>    return ours+'\n'+theirs
>   if name=='apps/api/package.json': return theirs.replace('test/integration/certificate-list.test.mjs ', 'test/integration/certificate-list.test.mjs test/integration/certificate-detail.test.mjs ')
>   if name.endswith('CertificateList.tsx'): return ours+"import { CertificateExport } from './CertificateExport';\n"
>   if name.endswith('global.css'):return ours+theirs
>   text=ours.replace('Exports and administrative CRUD remain future scopes.', 'CSV exports use durable PostgreSQL jobs and chunked artifacts, scoped to the tenant and requesting admin. Administrative CRUD remains future scope.')
>   return text+'\n## Export jobs\n'+theirs.split('## Export jobs\n',1)[1]
>  s=re.sub(r'^<<<<<<< HEAD\n(.*?)^=======\n(.*?)^>>>>>>> codex/certificate-csv-export\n',resolve,s,flags=re.M|re.S);p.write_text(s)
> PY
> rg -n '^(<<<<<<<|=======|>>>>>>>)' AGENTS.md README.md apps/api/package.json apps/web/src/features/certificates/CertificateList.tsx apps/web/src/styles/global.css docs/data-model.md
> git diff --check`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck`
> - Ran `ps -p 2711783,2711814 -o pid,ppid,args
> cat scripts/dev-api.mjs apps/web/vite.config.ts
> ls /tmp/training-platform*server*`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm test`
> - Ran `docker start training-csv-export-tests`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://export_test:local-test-only@127.0.0.1:55449/export_test npm run test:db`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e`
> - Ran `ps -p 2711760,2711803 -o pid,ppid,args`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH node --env-file=.env --input-type=module -e 'const u = new URL(process.env.DATABASE_URL); if (!["127.0.0.1", "localhost"].includes(u.hostname)) throw new Error("Expected a local development database"); console.log(JSON.stringify({host:u.hostname,port:u.port,database:u.pathname.slice(1)}));'
> git diff --numstat HEAD
> git diff -- apps/api/package.json`
> - Ran `git add AGENTS.md README.md apps/api/package.json apps/web/src/features/certificates/CertificateList.tsx apps/web/src/styles/global.css docs/data-model.md
> git diff --cached --check
> git commit -m "Merge branch 'codex/certificate-csv-export'"`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run db:migrate:deploy --workspace @training/api`
>
> </details>
>
> The merge is complete on `main` as `4a86de1`, and the export migration applied successfully to the local development database. The combined code passed 32 database tests, 20 browser tests, 10 unit tests, build, lint, and typecheck. I’m restarting the API and frontend now, then checking an export through the running application.
>
> <details><summary>Ran 7 commands</summary>
>
> - Ran `kill -TERM 2711760 2711815`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run dev --workspace @training/api`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run dev --workspace @training/web -- --host 127.0.0.1 --port 5173 --strictPort`
> - Ran ``cat > /tmp/training-csv-main-smoke.mjs <<'EOF'
> import assert from 'node:assert/strict';
> import { readFile } from 'node:fs/promises';
> import { setTimeout as delay } from 'node:timers/promises';
> const base = 'http://127.0.0.1:5173';
> for (let attempt = 0; ; attempt++) {
>   try { assert.equal((await fetch(`${base}/api/health`)).status, 200); break; }
>   catch (error) { if (attempt >= 30) throw error; await delay(200); }
> }
> assert.equal((await fetch(base)).status, 200);
> const tokens = JSON.parse(await readFile('/home/zblxy/work/dev/training_platform_admin/.demo-tokens.json', 'utf8'));
> const credential = tokens.find(row => row.tenant === 'East');
> assert.ok(credential, 'East credentials exist');
> const headers = { Authorization: `Bearer ${credential.token}` };
> async function json(path, options = {}) {
>   const response = await fetch(`${base}/api/${path}`, { ...options, headers: { ...headers, ...options.headers } });
>   assert.ok(response.ok, `HTTP ${response.status} at ${path}`);
>   return response.json();
> }
> const before = await json('certificates?pageSize=1');
> assert.ok(before.total > 0);
> const detail = await json(`certificates/${before.items[0].id}`);
> assert.equal(detail.serialNumber, before.items[0].serialNumber);
> const began = performance.now();
> const job = await json('certificates/exports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ search: '', sortBy: 'serialNumber', sortDirection: 'asc' }) });
> let ready;
> for (let attempt = 0; attempt < 600; attempt++) {
>   ready = await json(`certificates/exports/${job.id}`);
>   assert.notEqual(ready.status, 'failed');
>   if (ready.status === 'completed') break;
>   await delay(100);
> }
> assert.equal(ready.status, 'completed');
> const milliseconds = Math.round(performance.now() - began);
> assert.equal(ready.total, before.total);
> const download = await fetch(`${base}/api/certificates/exports/${job.id}/download`, { headers });
> assert.equal(download.status, 200);
> assert.match(download.headers.get('content-type'), /text\/csv/);
> const source = (await download.text()).replace(/^\uFEFF/, '');
> const rows = []; let row = [], cell = '', quoted = false;
> for (let i = 0; i < source.length; i++) {
>   const char = source[i];
>   if (char === '"') {
>     if (quoted && source[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
>   } else if (!quoted && char === ',') { row.push(cell); cell = ''; }
>   else if (!quoted && char === '\r' && source[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
>   else cell += char;
> }
> assert.equal(quoted, false);
> assert.equal(rows.length - 1, before.total);
> assert.equal(new Set(rows.slice(1).map(row => row[2])).size, before.total);
> const after = await json('certificates?pageSize=1');
> assert.equal(after.total, before.total);
> console.log(JSON.stringify({ web: 'healthy', api: 'healthy', certificateDetail: 'ok', csvDownload: 'ok', certificates: ready.total, exportReadyMilliseconds: milliseconds, certificateCountUnchanged: true }));
> EOF
> PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH node /tmp/training-csv-main-smoke.mjs``
> - Ran `git status --short --branch
> git log -2 --oneline
> git diff --check`
> - Ran `docker stop training-csv-export-tests`
> - Ran `curl --fail --silent --show-error http://127.0.0.1:3000/api/health
> ss -ltnp '( sport = :3000 or sport = :5173 )'`
>
> </details>
</details>

Committed as `1b9fb5a` and merged into `main` as `4a86de1`.

Applied the migration and restarted both services at [localhost:5173](http://localhost:5173). Verified a live export/download of **100,002 certificates in 1.8 seconds**.

All checks passed, including 32 database and 20 browser tests. Your untracked files remain untouched.
