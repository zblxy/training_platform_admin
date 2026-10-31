# Plan certificate detail feature

> start a new codex worktree to implement certificate detail feature. from now on, use plan mode. Inspect the relevant files, ask clarifying questions if needed, then propose the implementation plan before writing code.\
> feature details:
>
> 1. Show serial number, course, learner, tenant-local issue date, and status.&#x20;
> 2. Support revocation with confirmation. Audit both issuance and revocation.

<details><summary>4 previous messages</summary>

> I’ll inspect the certificate API, UI, and audit model, then prepare a new worktree and propose a plan. I’ll wait for your approval before writing code.
>
> This session is still in Default mode; I’ll follow the planning workflow you requested.
>
> <details><summary>Explored 17 files, a search, a list, ran a command</summary>
>
> - Ran `pwd && git status --short && git worktree list && rg --files -g 'AGENTS.md' -g '*certificate*' -g '*audit*' -g '*revo*' -g 'package.json' -g '*data-model*' -g '*App*' -g '*route*' -g '*schema.prisma' -g '*auth*' -g '*tenant*' -g '*README*'`
>
> <details><summary>Explored 18 files, a search, a list</summary>
>
> - Read `~/.codex/skills/.system/openai-docs/SKILL.md`
> - Read `./AGENTS.md`
> - Read `./packages/shared/src/certificates.ts`
> - Read `./apps/api/src/modules/certificates/certificates.controller.ts`
> - Read `./apps/api/src/modules/certificates/certificates.service.ts`
> - Read `./docs/data-model.md`
> - Read `./apps/api/prisma/schema.prisma`
> - Listed files in `web`
> - Read `./package.json`
> - Read `./apps/web/src/main.tsx`
> - Read `./apps/web/src/features/certificates/CertificateList.tsx`
> - Read `./apps/api/src/modules/auth/auth.module.ts`
> - Read `./apps/api/src/modules/certificates/bulk-issuance.dto.ts`
> - Read `./apps/api/test/certificates.test.mjs`
> - Read `./apps/api/test/integration/certificate-list.test.mjs`
> - Read `./apps/web/e2e/certificates.spec.ts`
> - Read `./apps/web/playwright.config.ts`
> - Read `./apps/api/package.json`
> - Searched for `revok|audit|ISSUED|REVOKED` in `models.test.mjs`
> - Read `./.gitignore`
>
> </details>
>
> </details>
>
> The backend already has transactional revocation and database triggers that audit issuance and revocation. It also stores the tenant-local issue date and time zone at issuance.
>
> The missing pieces are the detail endpoint and UI, plus the revocation endpoint and confirmation flow. I’ll reuse the existing lifecycle rules: revocation requires a reason, is final, and repeated requests return the original result without adding audit events.
>
> <details><summary>Ran 2 commands</summary>
>
> - Ran `git worktree add -b codex/certificate-detail /home/zblxy/.codex/worktrees/certificate-detail/training_platform_admin HEAD`
> - Ran `git status --short && git branch --show-current && git log -1 --format='%h %s'`
>
> </details>
</details>

Created a clean worktree from `main` at `769365c`:

- Branch: `codex/certificate-detail`
- Path: `/home/zblxy/.codex/worktrees/certificate-detail/training_platform_admin`

Inspection confirms revocation and atomic issuance/revocation audits already exist in the service and database. No code has been changed.

Proposed plan:

1. Add authenticated, tenant-scoped detail and revocation endpoints, with validated certificate IDs and revocation reasons. Return 404 for missing or other-tenant certificates.
2. Open a detail panel from each certificate’s serial number. Show serial number, course, learner, stored tenant-local issue date, and status.
3. Add a required reason and accessible confirmation dialog explaining that revocation is permanent. Refresh detail and list status after success.
4. Reuse database-generated audits. Include a detail history showing issuance and revocation actors and timestamps, plus the revocation reason.
5. Add regression coverage for tenant isolation, validation, repeated/concurrent revocation, audit integrity, and browser confirmation/cancellation/error flows. Run lint, typecheck, build, unit, isolated database, and browser checks.
6. Update feature documentation and inspect the final diff.

Do you approve this plan, including displaying audit history in the detail panel?

Approval is required by [AGENTS.md](./AGENTS.md): “Propose an implementation plan and obtain user approval before writing code.” I’ll remain in a planning workflow until you approve; the session’s actual mode is still Default.

> approve

<details><summary>10 previous messages</summary>

> I’ll implement the approved plan in the certificate-detail worktree, then verify the API, audit behavior, and browser flows.
>
> <details><summary>Explored 4 files, 2 lists, ran 6 commands</summary>
>
> - Ran `git status --short && cat packages/shared/src/index.ts && cat apps/api/src/app.ts && cat apps/web/src/styles/global.css && cat apps/api/test/integration/models.test.mjs`
>
> - Ran `ls -d node_modules /tmp/training-platform-tools/node_modules /tmp/training-model-postgres /home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome /home/zblxy/.nvm/versions/node/v24.22.1/bin/node && docker ps --format '{{.Names}} {{.Ports}}'`
>
> - Ran ``cat > /tmp/implement-certificate-detail.py <<'PY'
> from pathlib import Path
> r=Path('/home/zblxy/.codex/worktrees/certificate-detail/training_platform_admin')
> def write(p,s): (r/p).write_text(s)
> def edit(p,a,b):
>  s=(r/p).read_text(); assert a in s,p; write(p,s.replace(a,b))
> p='packages/shared/src/certificates.ts'
> write(p,(r/p).read_text()+'''
> export interface CertificateAuditEntry {
>   action: 'ISSUED' | 'REVOKED';
>   actorName: string;
>   occurredAt: string;
> }
> export interface CertificateDetail extends CertificateListItem {
>   issueTimeZone: string;
>   revokedAt: string | null;
>   revocationReason: string | null;
>   auditEvents: CertificateAuditEntry[];
> }
> export function isCertificateDetail(value: unknown): value is CertificateDetail {
>   if (!isCertificateListResponse({ items: [value], total: 1, page: 1, pageSize: 1 })) return false;
>   const row = value as Record<string, unknown>;
>   return typeof row.issueTimeZone === 'string' &&
>     (row.revokedAt === null || typeof row.revokedAt === 'string') &&
>     (row.revocationReason === null || typeof row.revocationReason === 'string') &&
>     Array.isArray(row.auditEvents) && row.auditEvents.length >= 1 && row.auditEvents.length <= 2 &&
>     row.auditEvents.every((event: unknown) => {
>       if (typeof event !== 'object' || event === null) return false;
>       const entry = event as Record<string, unknown>;
>       return (entry.action === 'ISSUED' || entry.action === 'REVOKED') &&
>         typeof entry.actorName === 'string' && typeof entry.occurredAt === 'string';
>     });
> }
> ''')
> write('apps/api/src/modules/certificates/certificate-detail.dto.ts','''import { Transform } from 'class-transformer';
> import { IsString, Length, Matches } from 'class-validator';
>
> export class CertificateIdDto {
>   // PostgreSQL UUIDs include the demo IDs without RFC version/variant bits.
>   @IsString()
>   @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
>   id!: string;
> }
> export class RevokeCertificateDto {
>   @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
>   @IsString()
>   @Length(1, 1000)
>   reason!: string;
> }
> ''')
> p='apps/api/src/modules/certificates/certificates.controller.ts'
> edit(p,'Get, Post,','Get, HttpCode, Param, Post,')
> edit(p,"import { ListCertificatesDto }", "import { CertificateIdDto, RevokeCertificateDto } from './certificate-detail.dto.js';\nimport { ListCertificatesDto }")
> edit(p,'  @Get()\n', '''  @Get(':id')
>   detail(@Req() request: ActorRequest, @Param() params: CertificateIdDto) {
>     return this.certificates.detail(request.actor, params.id);
>   }
>   @Post(':id/revoke')
>   @HttpCode(200)
>   async revoke(@Req() request: ActorRequest, @Param() params: CertificateIdDto, @Body() body: RevokeCertificateDto) {
>     await this.certificates.revoke(request.actor, params.id, body.reason);
>     return this.certificates.detail(request.actor, params.id);
>   }
>   @Get()
> ''')
> p='apps/api/src/modules/certificates/certificates.service.ts'
> edit(p,'BulkIssuanceOutcome, BulkIssuanceResponse, CertificateListResponse','BulkIssuanceOutcome, BulkIssuanceResponse, CertificateDetail, CertificateListResponse')
> edit(p,'  async courses(actor: Actor)', '''  async detail(actor: Actor, certificateId: string): Promise<CertificateDetail> {
>     // Read certificate and audit history in one consistent snapshot.
>     return this.db.$transaction(async tx => {
>       const row = await tx.certificate.findFirst({
>         where: { id: certificateId, tenantId: actor.tenantId },
>         select: { id: true, serialNumber: true, issuedAt: true, issueDate: true, issueTimeZone: true,
>           revokedAt: true, revocationReason: true,
>           enrollment: { select: { learner: { select: { name: true } }, course: { select: { title: true } } } },
>           auditEvents: { where: { tenantId: actor.tenantId }, orderBy: [{ occurredAt: 'asc' }, { action: 'asc' }],
>             select: { action: true, occurredAt: true, actor: { select: { name: true } } } },
>         },
>       });
>       if (!row) throw new NotFoundException('Certificate not found');
>       return { id: row.id, serialNumber: row.serialNumber, learnerName: row.enrollment.learner.name,
>         courseTitle: row.enrollment.course.title, issuedAt: row.issuedAt.toISOString(),
>         issueDate: row.issueDate.toISOString().slice(0, 10), issueTimeZone: row.issueTimeZone,
>         status: row.revokedAt ? 'revoked' : 'active', revokedAt: row.revokedAt?.toISOString() ?? null,
>         revocationReason: row.revocationReason,
>         auditEvents: row.auditEvents.map(event => ({ action: event.action, actorName: event.actor.name, occurredAt: event.occurredAt.toISOString() })),
>       };
>     }, { isolationLevel: 'RepeatableRead' });
>   }
>   async courses(actor: Actor)''')
> write('apps/web/src/features/certificates/CertificateDetail.tsx','''import { useEffect, useRef, useState, type FormEvent } from 'react';
> import { isCertificateDetail, type CertificateDetail as Detail } from '@training/shared';
>
> interface Props { id: string; token: string; onClose: () => void; onRevoked: () => void }
> export function CertificateDetail({ id, token, onClose, onRevoked }: Props) {
>   const [detail, setDetail] = useState<Detail | null>(null);
>   const [state, setState] = useState<'loading' | 'ready' | 'unauthorized' | 'missing' | 'error'>('loading');
>   const [attempt, setAttempt] = useState(0);
>   const [reason, setReason] = useState('');
>   const [saving, setSaving] = useState(false);
>   const [saveError, setSaveError] = useState('');
>   const [success, setSuccess] = useState(false);
>   const dialog = useRef<HTMLDialogElement>(null);
>   const heading = useRef<HTMLHeadingElement>(null);
>   const mounted = useRef(false);
>   const mutation = useRef<AbortController | null>(null);
>   const inFlight = useRef(false);
>   useEffect(() => {
>     mounted.current = true;
>     heading.current?.focus();
>     return () => { mounted.current = false; mutation.current?.abort(); };
>   }, []);
>   useEffect(() => {
>     const controller = new AbortController();
>     let active = true;
>     const timeout = setTimeout(() => controller.abort(), 10000);
>     setState('loading'); setDetail(null);
>     void fetch(`/api/certificates/${id}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
>       .then(async response => {
>         if (response.status === 401 || response.status === 404) {
>           if (active) setState(response.status === 401 ? 'unauthorized' : 'missing');
>           return;
>         }
>         if (!response.ok) throw new Error('Detail request failed');
>         const data: unknown = await response.json();
>         if (!isCertificateDetail(data)) throw new Error('Invalid detail');
>         if (active) { setDetail(data); setState('ready'); }
>       }).catch(() => { if (active) setState('error'); }).finally(() => clearTimeout(timeout));
>     return () => { active = false; controller.abort(); clearTimeout(timeout); };
>   }, [id, token, attempt]);
>   async function revoke(event: FormEvent) {
>     event.preventDefault();
>     if (inFlight.current || !reason.trim()) return;
>     inFlight.current = true; setSaving(true); setSaveError('');
>     const controller = new AbortController(); mutation.current = controller;
>     const timeout = setTimeout(() => controller.abort(), 10000);
>     try {
>       const response = await fetch(`/api/certificates/${id}/revoke`, {
>         method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
>         body: JSON.stringify({ reason: reason.trim() }), signal: controller.signal,
>       });
>       if (!mounted.current) return;
>       if (!response.ok) {
>         setSaveError(response.status === 401 ? 'Your token is no longer authorized.' : response.status === 404 ? 'Certificate not found.' : 'Unable to revoke certificate. Retry or cancel and reload its details.');
>         return;
>       }
>       const data: unknown = await response.json();
>       if (!isCertificateDetail(data) || data.status !== 'revoked') throw new Error('Invalid revocation response');
>       if (mounted.current) {
>         setDetail(data); setSuccess(true); dialog.current?.close(); onRevoked(); heading.current?.focus();
>       }
>     } catch {
>       if (mounted.current) setSaveError('The result could not be confirmed. Retry safely, or cancel and reload its details.');
>     } finally {
>       clearTimeout(timeout); inFlight.current = false;
>       if (mounted.current) setSaving(false);
>     }
>   }
>   return <section aria-labelledby="certificate-detail-heading">
>     <h2 id="certificate-detail-heading" tabIndex={-1} ref={heading}>Certificate detail</h2>
>     <button onClick={onClose}>Close certificate detail</button>
>     {state === 'loading' && <p role="status">Loading certificate detail…</p>}
>     {state === 'unauthorized' && <p role="alert">Your token is no longer authorized. Supply a valid token.</p>}
>     {state === 'missing' && <p role="alert">Certificate not found.</p>}
>     {state === 'error' && <p role="alert">Unable to load certificate detail.</p>}
>     {state !== 'loading' && <button disabled={saving} onClick={() => { setSuccess(false); setAttempt(value => value + 1); }}>Reload certificate detail</button>}
>     {success && <p role="status">Certificate revoked successfully.</p>}
>     {state === 'ready' && detail && <>
>       <dl>
>         <dt>Serial number</dt><dd className="serial">{detail.serialNumber}</dd>
>         <dt>Course</dt><dd>{detail.courseTitle}</dd>
>         <dt>Learner</dt><dd>{detail.learnerName}</dd>
>         <dt>Issue date</dt><dd>{detail.issueDate} ({detail.issueTimeZone})</dd>
>         <dt>Status</dt><dd>{detail.status === 'active' ? 'Active' : 'Revoked'}</dd>
>         {detail.revocationReason !== null && <><dt>Revocation reason</dt><dd>{detail.revocationReason}</dd></>}
>       </dl>
>       <h3>Audit history</h3>
>       <ul>{detail.auditEvents.map(entry => <li key={entry.action}>
>         {entry.action === 'ISSUED' ? 'Issued' : 'Revoked'} by {entry.actorName} — <time dateTime={entry.occurredAt}>{entry.occurredAt} (UTC)</time>
>       </li>)}</ul>
>       {detail.status === 'active' && <button onClick={() => { setReason(''); setSaveError(''); dialog.current?.showModal(); }}>Revoke certificate</button>}
>       {detail.status === 'revoked' && <p>Revocation is permanent. This certificate cannot be reissued.</p>}
>     </>}
>     <dialog ref={dialog} aria-labelledby="revoke-heading" aria-describedby="revoke-warning" onCancel={event => { if (saving) event.preventDefault(); }}>
>       <form onSubmit={event => { void revoke(event); }}>
>         <h3 id="revoke-heading">Confirm revocation</h3>
>         <p className="serial">{detail?.serialNumber}</p>
>         <p id="revoke-warning">Revocation is permanent. This certificate cannot be reissued. The action and your identity will be audited.</p>
>         <label>Revocation reason<textarea value={reason} onChange={event => setReason(event.target.value)} required maxLength={1000} disabled={saving} /></label>
>         {saveError && <p role="alert">{saveError}</p>}
>         {saving && <p role="status">Revoking certificate…</p>}
>         <div className="controls">
>           <button type="button" autoFocus disabled={saving} onClick={() => dialog.current?.close()}>Cancel</button>
>           <button type="submit" disabled={saving || !reason.trim()}>Confirm revocation</button>
>         </div>
>       </form>
>     </dialog>
>   </section>;
> }
> ''')
> p='apps/web/src/features/certificates/CertificateList.tsx'
> edit(p,"import { useEffect, useState, type FormEvent }", "import { useEffect, useRef, useState, type FormEvent }")
> edit(p,'interface CertificateListProps',"import { CertificateDetail } from './CertificateDetail';\n\ninterface CertificateListProps")
> edit(p,'  const [credential,', '''  const [selectedId, setSelectedId] = useState<string | null>(null);
>   const selectedTrigger = useRef<HTMLButtonElement | null>(null);
>   const [revocationKey, setRevocationKey] = useState(0);
>   const [credential,''')
> edit(p,'attempt, refreshKey]);','attempt, refreshKey, revocationKey]);')
> edit(p,"setResult(null); setToken(credential.trim());", "setSelectedId(null); setResult(null); setToken(credential.trim());")
> edit(p,"setToken(''); setResult(null);", "setSelectedId(null); setToken(''); setResult(null);")
> edit(p,'<td className="serial">{item.serialNumber}</td>','<td className="serial"><button onClick={event => { selectedTrigger.current = event.currentTarget; setSelectedId(item.id); }}>{item.serialNumber}</button></td>')
> edit(p,'  </section>;','''    {token && selectedId && <CertificateDetail key={`${token}:${selectedId}`} id={selectedId} token={token}
>       onClose={() => { setSelectedId(null); if (selectedTrigger.current?.isConnected) selectedTrigger.current.focus(); }}
>       onRevoked={() => setRevocationKey(value => value + 1)} />}
>   </section>;''')
> p='apps/web/src/styles/global.css'
> write(p,(r/p).read_text()+'''
> textarea { font: inherit; padding: .6rem; min-height: 6rem; width: 28rem; max-width: 100%; box-sizing: border-box; }
> dialog { max-width: min(36rem, 85vw); border: 1px solid #d6dde8; border-radius: .5rem; padding: 1.5rem; }
> dialog::backdrop { background: rgb(0 0 0 / 45%); }
> dt { font-weight: 600; margin-top: .8rem; }
> dd { margin: .3rem 0; overflow-wrap: anywhere; white-space: pre-wrap; }
> ''')
> PY``
>
> - Ran `python3 /tmp/implement-certificate-detail.py`
>
> - Ran `git diff --stat && git diff --check && ls -ld node_modules && cat .npmrc`
>
> <details><summary>Explored 4 files, 2 lists</summary>
>
> - Listed files in `training-model-postgres`
> - Listed files in `node_modules`
> - Read `/tmp/training-model-postgres/start.mjs`
> - Read `./apps/api/prisma.config.ts`
> - Read `./apps/api/src/common/database/database.service.ts`
> - Read `./apps/web/package.json`
>
> </details>
>
> - Ran `docker ps --format '{{.Names}} {{.Ports}}'`
>
> </details>
>
> The detail API and UI are in place, including audit history and the revocation dialog. The API uses the existing revocation transaction, so retries preserve the original reason, actor, and audit event.
>
> I’m adding coverage for tenant isolation, date preservation after a tenant time-zone change, confirmation/cancellation, and uncertain network results. Database checks will use a disposable PostgreSQL instance.
>
> <details><summary>Ran 9 commands</summary>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm ci --cache /tmp/training-platform-npm-cache --no-audit --no-fund`
> - Ran `/home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/training-model-postgres/start.mjs`
> - Ran ``cat > /tmp/implement-certificate-detail.py <<'PY'
> from pathlib import Path
> r=Path('/home/zblxy/.codex/worktrees/certificate-detail/training_platform_admin')
> def write(p,s): (r/p).write_text(s)
> def edit(p,a,b):
>  s=(r/p).read_text(); assert a in s,p; write(p,s.replace(a,b))
> write('apps/api/test/integration/certificate-detail.test.mjs','''import 'reflect-metadata';
> import { test, before, after } from 'node:test';
> import assert from 'node:assert/strict';
> import { randomUUID, randomBytes } from 'node:crypto';
> import { readdir, readFile } from 'node:fs/promises';
> import pg from 'pg';
> import { DatabaseService } from '../../dist/common/database/database.service.js';
> import { CertificatesService } from '../../dist/modules/certificates/certificates.service.js';
> import { hashToken } from '../../dist/modules/auth/auth.module.js';
> import { createApp } from '../../dist/app.js';
> if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to an isolated test database');
> const schema = `certificate_detail_${randomUUID().replaceAll('-', '')}`;
> const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('schema', schema);
> process.env.DATABASE_URL = url.toString();
> const sql = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
> const token = [REDACTED_SECRET]'base64url');
> let db, service, app, base, actor, foreign, certificate;
> before(async () => {
>   await sql.connect(); await sql.query(`CREATE SCHEMA "${schema}"`); await sql.query(`SET search_path TO "${schema}"`);
>   for (const name of (await readdir('prisma/migrations')).filter(name => /^\\d/.test(name)).sort()) {
>     await sql.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
>   }
>   db = new DatabaseService(); service = new CertificatesService(db);
>   async function fixture(name, credential) {
>     const admin = await db.$transaction(async tx => {
>       const tenant = await tx.tenant.create({ data: { name, timeZone: 'America/New_York' } });
>       return tx.admin.create({ data: { tenantId: tenant.id, name, tokenHash: hashToken(credential) } });
>     });
>     const course = await db.course.create({ data: { tenantId: admin.tenantId, title: 'Safety' } });
>     const learner = await db.learner.create({ data: { tenantId: admin.tenantId, name: 'Alex', email: 'alex@example.test' } });
>     const enrollment = await db.enrollment.create({ data: { tenantId: admin.tenantId, courseId: course.id, learnerId: learner.id, status: 'COMPLETED', completedAt: new Date('2025-01-01') } });
>     // A UTC instant whose tenant-local date falls on the previous day.
>     const issued = await db.certificate.create({ data: { tenantId: admin.tenantId, enrollmentId: enrollment.id,
>       issuedById: admin.id, issuedAt: new Date('2026-01-01T01:00:00Z'), issueDate: new Date('2025-12-31'), issueTimeZone: 'America/New_York' } });
>     return { admin, issued };
>   }
>   const local = await fixture('Local admin', token); actor = local.admin; certificate = local.issued;
>   foreign = (await fixture('Foreign admin', randomBytes(32).toString('base64url'))).issued;
>   await db.tenant.update({ where: { id: actor.tenantId }, data: { timeZone: 'Asia/Shanghai' } });
>   app = await createApp(); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
> });
> after(async () => {
>   await app?.close(); await db?.$disconnect();
>   await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await sql.end();
> });
> function request(id = certificate.id, body, credential = token) {
>   return fetch(`${base}/api/certificates/${id}${body === undefined ? '' : '/revoke'}`, {
>     method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' },
>     ...(body === undefined ? {} : { body: JSON.stringify(body) }),
>   });
> }
> test('detail preserves original local date and zone, exposes safe fields and issuance audit', async () => {
>   const response = await request(); assert.equal(response.status, 200);
>   const detail = await response.json();
>   assert.deepEqual(detail, { id: certificate.id, serialNumber: certificate.serialNumber, learnerName: 'Alex', courseTitle: 'Safety',
>     issuedAt: '2026-01-01T01:00:00.000Z', issueDate: '2025-12-31', issueTimeZone: 'America/New_York', status: 'active', revokedAt: null, revocationReason: null,
>     auditEvents: [{ action: 'ISSUED', actorName: actor.name, occurredAt: '2026-01-01T01:00:00.000Z' }] });
>   // Dynamic detail route must not shadow the existing static courses route.
>   assert.equal((await fetch(`${base}/api/certificates/courses`, { headers: { authorization: `Bearer ${token}` } })).status, 200);
> });
> test('detail and revoke require authentication and hide foreign certificates', async () => {
>   for (const body of [undefined, { reason: 'Correction' }]) {
>     for (const credential of ['', 'invalid', randomBytes(32).toString('base64url')]) assert.equal((await request(certificate.id, body, credential)).status, 401);
>     for (const id of [foreign.id, randomUUID()]) {
>       const response = await request(id, body); assert.equal(response.status, 404);
>       assert.equal((await response.json()).message, 'Certificate not found');
>     }
>     for (const id of ['invalid', 'a'.repeat(36)]) assert.equal((await request(id, body)).status, 400);
>   }
>   assert.equal(await db.auditEvent.count({ where: { certificateId: foreign.id, action: 'REVOKED' } }), 0);
> });
> test('revocation validates reason and rejects client actor/tenant fields without mutating', async () => {
>   for (const body of [{}, { reason: '' }, { reason: '   ' }, { reason: 5 }, { reason: null }, { reason: ['x'] }, { reason: 'x'.repeat(1001) }, { reason: 'x', tenantId: actor.tenantId }, { reason: 'x', actorId: actor.id }]) {
>     assert.equal((await request(certificate.id, body)).status, 400, JSON.stringify(body));
>   }
>   assert.equal((await service.detail(actor, certificate.id)).status, 'active');
>   assert.equal(await db.auditEvent.count({ where: { certificateId: certificate.id } }), 1);
> });
> test('an audit failure rolls back revocation', async () => {
>   await sql.query(`CREATE FUNCTION reject_revocation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$`);
>   await sql.query(`CREATE TRIGGER reject_revocation_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW WHEN (NEW.action = 'REVOKED') EXECUTE FUNCTION reject_revocation_audit()`);
>   try {
>     assert.equal((await request(certificate.id, { reason: 'Correction' })).status, 500);
>     const detail = await service.detail(actor, certificate.id);
>     assert.equal(detail.status, 'active'); assert.equal(detail.revocationReason, null); assert.equal(detail.auditEvents.length, 1);
>   } finally { await sql.query('DROP TRIGGER reject_revocation_audit ON "AuditEvent"'); }
> });
> test('concurrent and repeated HTTP revocation preserve the first result and exactly one audit', async () => {
>   const responses = await Promise.all(Array.from({ length: 6 }, (_, index) => request(certificate.id, { reason: `  Correction ${index}  ` })));
>   const results = await Promise.all(responses.map(async response => { assert.equal(response.status, 200); return response.json(); }));
>   for (const result of results) assert.deepEqual(result, results[0]);
>   const detail = results[0]; assert.equal(detail.status, 'revoked'); assert.match(detail.revocationReason, /^Correction [0-5]$/);
>   assert.deepEqual(detail.auditEvents.map(event => event.action), ['ISSUED', 'REVOKED']);
>   assert.equal(detail.auditEvents[1].actorName, actor.name); assert.equal(detail.auditEvents[1].occurredAt, detail.revokedAt);
>   assert.deepEqual(await (await request(certificate.id, { reason: 'Changed reason' })).json(), detail);
>   assert.deepEqual(await (await request()).json(), detail);
>   assert.equal(await db.auditEvent.count({ where: { certificateId: certificate.id, action: 'ISSUED' } }), 1);
>   assert.equal(await db.auditEvent.count({ where: { certificateId: certificate.id, action: 'REVOKED' } }), 1);
>   const list = await fetch(`${base}/api/certificates`, { headers: { authorization: `Bearer ${token}` } });
>   assert.equal((await list.json()).items.find(row => row.id === certificate.id).status, 'revoked');
> });
> ''')
> p='apps/api/package.json'; edit(p,'test/integration/certificate-list.test.mjs test/integration/bulk-issuance.test.mjs','test/integration/certificate-list.test.mjs test/integration/certificate-detail.test.mjs test/integration/bulk-issuance.test.mjs')
> write('apps/web/e2e/certificate-detail.spec.ts','''import { test, expect, type Page } from '@playwright/test';
> const token = 'a'.repeat(43);
> const id = '00000000-0000-0000-0000-000000000001';
> const initial = { id, serialNumber: `CERT-${'1'.repeat(32)}`, learnerName: 'Alex', courseTitle: 'Safety',
>   issuedAt: '2026-01-01T01:00:00.000Z', issueDate: '2025-12-31', issueTimeZone: 'America/New_York', status: 'active',
>   revokedAt: null, revocationReason: null, auditEvents: [{ action: 'ISSUED', actorName: 'Admin', occurredAt: '2026-01-01T01:00:00.000Z' }] };
> async function setup(page: Page) {
>   await page.route('**/api/certificates/courses', route => route.fulfill({ json: { items: [] } }));
>   await page.route('**/api/certificates?**', route => route.fulfill({ json: { items: [initial], total: 1, page: 1, pageSize: 20 } }));
>   await page.goto('/');
>   await page.getByLabel('Generated admin token').fill(token); await page.getByRole('button', { name: 'Use token' }).click();
> }
> async function open(page: Page) { await page.getByRole('button', { name: initial.serialNumber, exact: true }).click(); }
> const region = (page: Page) => page.getByRole('region', { name: 'Certificate detail', exact: true });
> test('detail, keyboard cancellation, confirmation, audit history and list refresh', async ({ page }) => {
>   let revoked = false, calls = 0;
>   const changed = { ...initial, status: 'revoked', revokedAt: '2026-02-01T00:00:00.000Z', revocationReason: 'Correction',
>     auditEvents: [...initial.auditEvents, { action: 'REVOKED', actorName: 'Admin', occurredAt: '2026-02-01T00:00:00.000Z' }] };
>   await page.route(`**/api/certificates/${id}`, route => route.fulfill({ json: revoked ? changed : initial }));
>   await page.route(`**/api/certificates/${id}/revoke`, async route => {
>     calls++; expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
>     expect(route.request().postDataJSON()).toEqual({ reason: 'Correction' });
>     await new Promise(resolve => setTimeout(resolve, 250)); revoked = true;
>     await route.fulfill({ json: changed });
>   });
>   await setup(page);
>   await page.route('**/api/certificates?**', route => route.fulfill({ json: { items: [revoked ? changed : initial], total: 1, page: 1, pageSize: 20 } }));
>   await open(page);
>   await expect(region(page)).toContainText('2025-12-31 (America/New_York)');
>   await expect(region(page)).toContainText('Issued by Admin');
>   await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
>   await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
>   await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible(); expect(calls).toBe(0);
>   await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
>   await page.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(calls).toBe(0);
>   await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
>   await expect(page.getByRole('button', { name: 'Confirm revocation', exact: true })).toBeDisabled();
>   await page.getByLabel('Revocation reason', { exact: true }).fill('   ');
>   await expect(page.getByRole('button', { name: 'Confirm revocation', exact: true })).toBeDisabled();
>   await page.getByLabel('Revocation reason', { exact: true }).fill('  Correction  ');
>   await page.getByRole('button', { name: 'Confirm revocation', exact: true }).click();
>   await expect(page.getByRole('button', { name: 'Confirm revocation', exact: true })).toBeDisabled();
>   await expect(page.getByText('Certificate revoked successfully.', { exact: true })).toBeVisible();
>   expect(calls).toBe(1);
>   await expect(region(page)).toContainText('Revoked by Admin'); await expect(region(page)).toContainText('Correction');
>   await expect(page.getByRole('cell', { name: 'Revoked', exact: true })).toBeVisible();
>   await expect(page.getByRole('button', { name: 'Revoke certificate', exact: true })).toHaveCount(0);
>   await page.getByRole('button', { name: 'Close certificate detail' }).click(); await expect(region(page)).toHaveCount(0);
> });
> test('loading, missing, unauthorized, invalid response and retry', async ({ page }) => {
>   let state = 'missing';
>   await page.route(`**/api/certificates/${id}`, async route => {
>     await new Promise(resolve => setTimeout(resolve, 150));
>     await route.fulfill(state === 'missing' ? { status: 404, json: {} } : state === 'unauthorized' ? { status: 401, json: {} } : state === 'failure' ? { status: 503, json: {} } : state === 'invalid' ? { json: {} } : { json: initial });
>   });
>   await setup(page); await open(page);
>   await expect(region(page).getByRole('status')).toContainText('Loading');
>   await expect(region(page).getByRole('alert')).toContainText('Certificate not found');
>   for (const next of ['unauthorized', 'failure', 'invalid', 'ready']) {
>     state = next; await page.getByRole('button', { name: 'Reload certificate detail' }).click();
>     if (next === 'ready') await expect(region(page)).toContainText('Issued by Admin');
>     else await expect(region(page).getByRole('alert')).toContainText(next === 'unauthorized' ? 'no longer authorized' : 'Unable to load');
>   }
> });
> test('failed revocation retains reason and allows safe retry', async ({ page }) => {
>   let calls = 0;
>   await page.route(`**/api/certificates/${id}`, route => route.fulfill({ json: initial }));
>   await page.route(`**/api/certificates/${id}/revoke`, route => { calls++; return route.fulfill({ status: calls === 1 ? 503 : 401, json: {} }); });
>   await setup(page); await open(page); await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
>   await page.getByLabel('Revocation reason', { exact: true }).fill('Correction');
>   await page.getByRole('button', { name: 'Confirm revocation', exact: true }).click();
>   await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Unable to revoke');
>   await expect(page.getByLabel('Revocation reason', { exact: true })).toHaveValue('Correction');
>   await page.getByRole('button', { name: 'Confirm revocation', exact: true }).click();
>   await expect(page.getByRole('dialog').getByRole('alert')).toContainText('no longer authorized');
>   expect(calls).toBe(2);
>   await page.getByRole('button', { name: 'Cancel', exact: true }).click();
>   await expect(region(page)).toContainText('Active');
> });
> test('clearing or changing the token closes detail and removes previous tenant data', async ({ page }) => {
>   await page.route(`**/api/certificates/${id}`, route => route.fulfill({ json: initial }));
>   await setup(page); await open(page); await expect(region(page)).toContainText('Issued by Admin');
>   await page.getByText('API token', { exact: true }).click();
>   await page.getByLabel('Generated admin token').fill('b'.repeat(43)); await page.getByRole('button', { name: 'Use token' }).click();
>   await expect(region(page)).toHaveCount(0);
>   await open(page); await expect(region(page)).toContainText('Issued by Admin');
>   await page.getByRole('button', { name: 'Clear token' }).click(); await expect(region(page)).toHaveCount(0);
> });
> ''')
> p='docs/data-model.md'; edit(p,'Revocation endpoints, exports, and administrative CRUD remain future scopes.', 'Authenticated certificate detail and revocation endpoints expose tenant-scoped data and the existing immutable audit history. Revocation requires a nonblank reason of at most 1000 characters and is final and idempotent. Exports and administrative CRUD remain future scopes.')
> p='AGENTS.md'; edit(p,'Revocation HTTP routes remain deferred.', 'Certificate detail and confirmed revocation are available through authenticated tenant-scoped HTTP routes and the browser.')
> p='README.md'; write(p,(r/p).read_text()+'''
> ### Certificate detail and revocation
>
> Select a certificate serial number to open its detail panel. It shows the serial,
> course, learner, historical tenant-local issue date and time zone, status, and
> issuance/revocation audit history (timestamps shown in UTC). Active certificates
> can be revoked with a required reason and an explicit confirmation. Revocation is
> permanent; repeated requests preserve the first reason, actor, timestamp and audit
> event. Successful revocation refreshes both detail and list status.
>
> Bearer-authenticated endpoints: `GET /api/certificates/:id` and
> `POST /api/certificates/:id/revoke` with JSON `{ "reason": "Correction" }`.
> Both use the authenticated actor's tenant; missing and foreign certificates return
> 404. Invalid UUIDs and blank/overlong reasons return 400. The revocation endpoint
> returns the updated detail with 200. No schema migration is needed; existing
> database triggers create issuance and revocation audit events atomically.
>
> `npm run test:db` includes detail/revocation integration checks and requires an
> explicit `TEST_DATABASE_URL` pointing to an isolated PostgreSQL database; tests
> create and remove temporary schemas. `npm run test:e2e` builds applications and
> starts local API/Vite servers; feature browser tests mock certificate responses,
> while database tests verify real authorization, transactions and audit behavior.
> ''')
> PY``
> - Ran `python3 /tmp/implement-certificate-detail.py`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run build && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm test`
> - Ran `git diff --check && git status --short && rg -n 'read-only|revocation|Revocation|detail' README.md docs/data-model.md AGENTS.md`
> - Ran `cat apps/api/src/common/filters/http-error.filter.ts && cat apps/web/e2e/smoke.spec.ts && git diff -- apps/web/src/features/certificates/CertificateList.tsx apps/api/src/modules/certificates/certificates.controller.ts`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/postgres npm run test:db`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e --workspace @training/web`
>
> </details>
>
> Lint, typecheck, build, and all eight unit tests passed. The database and browser suites are still running.
>
> One browser check failed in the confirmation flow. I’m checking the failure output before continuing.
>
> <details><summary>Explored 3 files, ran 4 commands</summary>
>
> - Ran `rg --files apps/web/test-results && ps -eo pid,comm,args | rg 'certificate-detail|models.test|node --test'`
>
> - Ran `cat apps/web/test-results/certificate-detail-detail--6236c-it-history-and-list-refresh/error-context.md && cat apps/web/test-results/certificate-detail-failed--*/error-context.md`
>
> <details><summary>Explored 4 files</summary>
>
> - Read `./apps/web/test-results/certificate-detail-failed--db520-eason-and-allows-safe-retry/error-context.md`
> - Read `./apps/web/src/features/certificates/CertificateDetail.tsx`
> - Read `./apps/web/tsconfig.json`
> - Read `./apps/web/test-results/certificate-detail-failed--db520-eason-and-allows-safe-retry/error-context.md`
>
> </details>
>
> - Ran ``cat > /tmp/implement-certificate-detail.py <<'PY'
> from pathlib import Path
> r=Path('/home/zblxy/.codex/worktrees/certificate-detail/training_platform_admin')
> def edit(p,a,b):
>  s=(r/p).read_text(); assert a in s,p; (r/p).write_text(s.replace(a,b))
> p='apps/web/src/features/certificates/CertificateDetail.tsx'
> edit(p,'  const heading =', '  const cancelButton = useRef<HTMLButtonElement>(null);\n  const heading =')
> edit(p,'dialog.current?.showModal();','dialog.current?.showModal(); cancelButton.current?.focus();')
> edit(p,'<label>Revocation reason<textarea value={reason} onChange={event => setReason(event.target.value)} required maxLength={1000} disabled={saving} /></label>', '<label htmlFor="revocation-reason">Revocation reason</label>\n        <textarea id="revocation-reason" value={reason} onChange={event => setReason(event.target.value)} required maxLength={1000} disabled={saving} />')
> edit(p,'type="button" autoFocus disabled={saving}', 'type="button" ref={cancelButton} disabled={saving}')
> p='apps/web/src/features/certificates/CertificateList.tsx'
> edit(p,'  const selectedTrigger =', '  const listHeading = useRef<HTMLHeadingElement>(null);\n  const selectedTrigger =')
> edit(p,'<h2 id="certificates-heading">','<h2 id="certificates-heading" ref={listHeading} tabIndex={-1}>')
> edit(p,'if (selectedTrigger.current?.isConnected) selectedTrigger.current.focus();', '(selectedTrigger.current?.isConnected ? selectedTrigger.current : listHeading.current)?.focus();')
> p='README.md'
> edit(p,'revocation remains a backend service without an HTTP route.', 'certificate detail and confirmed revocation are available through authenticated HTTP routes and the detail panel.')
> edit(p,'Both statuses appear; the list has no revocation, export, or status filter.', 'Both statuses appear; select a serial number to view details and revoke an active certificate. The list has no export or status filter.')
> p='apps/web/e2e/certificate-detail.spec.ts'
> edit(p,"await page.getByRole('button', { name: 'Close certificate detail' }).click(); await expect(region(page)).toHaveCount(0);", "await page.getByRole('button', { name: 'Close certificate detail' }).click(); await expect(region(page)).toHaveCount(0);\n  await expect(page.getByRole('heading', { name: 'Certificates', exact: true })).toBeFocused();")
> s=(r/p).read_text()+'''
> test('network failure explains an uncertain outcome and reload reconciles server state', async ({ page }) => {
>   let revoked = false;
>   const changed = { ...initial, status: 'revoked', revokedAt: '2026-02-01T00:00:00.000Z', revocationReason: 'Correction',
>     auditEvents: [...initial.auditEvents, { action: 'REVOKED', actorName: 'Admin', occurredAt: '2026-02-01T00:00:00.000Z' }] };
>   await page.route(`**/api/certificates/${id}`, route => route.fulfill({ json: revoked ? changed : initial }));
>   await page.route(`**/api/certificates/${id}/revoke`, route => { revoked = true; return route.abort('failed'); });
>   await setup(page); await open(page); await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
>   await page.getByLabel('Revocation reason', { exact: true }).fill('Correction');
>   await page.getByRole('button', { name: 'Confirm revocation', exact: true }).click();
>   await expect(page.getByRole('dialog').getByRole('alert')).toContainText('result could not be confirmed');
>   await page.getByRole('button', { name: 'Cancel', exact: true }).click();
>   await page.getByRole('button', { name: 'Reload certificate detail' }).click();
>   await expect(region(page)).toContainText('Revoked by Admin');
>   await expect(page.getByRole('button', { name: 'Revoke certificate', exact: true })).toHaveCount(0);
> });
> test('a late detail response is discarded after switching tenant tokens', async ({ page }) => {
>   let release: (() => void) | undefined;
>   await page.route(`**/api/certificates/${id}`, async route => {
>     if (route.request().headers().authorization === `Bearer ${token}`) await new Promise<void>(resolve => { release = resolve; });
>     await route.fulfill({ json: { ...initial, learnerName: 'Old tenant private learner' } });
>   });
>   await setup(page); await open(page); await expect.poll(() => Boolean(release)).toBeTruthy();
>   await page.getByText('API token', { exact: true }).click();
>   await page.getByLabel('Generated admin token').fill('b'.repeat(43)); await page.getByRole('button', { name: 'Use token' }).click();
>   release?.();
>   await expect(region(page)).toHaveCount(0);
>   await expect(page.getByText('Old tenant private learner', { exact: true })).toHaveCount(0);
> });
> '''
> (r/p).write_text(s)
> PY``
>
> - Ran `python3 /tmp/implement-certificate-detail.py`
>
> </details>
>
> All 26 database integration tests passed, including tenant boundaries, concurrent revocation, and rollback when audit creation fails.
>
> The browser checks found two accessibility issues: Cancel did not receive focus when the dialog opened, and the textarea label needed an explicit association. Both are fixed. I also added coverage for reloading the detail after a lost revocation response.
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run build && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e --workspace @training/web`
> - Ran `git diff --check && git diff --numstat && cat packages/shared/src/certificates.ts && cat apps/api/src/modules/certificates/certificate-detail.dto.ts`
> - Ran `git diff -- README.md docs/data-model.md apps/api/package.json apps/api/src/modules/certificates/certificates.service.ts apps/web/src/styles/global.css && git status --short`
> - Ran `ps -eo pid,comm,args`
>
> </details>
>
> All 17 browser workflows now pass, along with lint, typecheck, build, unit tests, and all 26 database integration tests.
>
> I’m reviewing the final diff and shutting down the disposable test database. The feature changes are confined to `codex/certificate-detail`; nothing has been committed or deployed.
>
> <details><summary>Ran 3 commands</summary>
>
> - Ran `kill -TERM 2703051`
> - Ran `git diff --check && cat apps/api/src/modules/certificates/certificate-detail.dto.ts && cat apps/web/src/features/certificates/CertificateDetail.tsx && cat apps/api/test/integration/certificate-detail.test.mjs && cat apps/web/e2e/certificate-detail.spec.ts`
> - Ran `git status --short && git branch --show-current`
>
> </details>
</details>

Implemented in [certificate-detail worktree](~/.codex/worktrees/certificate-detail/training_platform_admin), branch `codex/certificate-detail`.

- Detail panel shows all requested fields and audit history.
- Revocation requires a reason and confirmation.
- Tenant-scoped endpoints preserve atomic audits and safe retries.

Passed: lint, typecheck, build, 8 unit tests, 26 database tests, 17 browser tests, and diff checks. Browser feature tests use mocked responses; database tests exercise real HTTP/PostgreSQL behavior.

Changes remain uncommitted. No migration or deployment was needed.

> commit your work and merge into main. then restart the application

<details><summary>4 previous messages</summary>

> I’ll commit the certificate-detail changes, merge them into `main`, then restart the local application and check that it’s healthy.
>
> <details><summary>Ran 8 commands</summary>
>
> - Ran `ps -eo pid,comm,args | rg 'npm run dev|scripts/dev-api|tsc --watch|node --watch|dist/main.js|vite --host'`
> - Ran `git status --short && git branch --show-current && git log -1 --oneline && git diff --check && git diff --stat && git ls-files --others --exclude-standard`
> - Ran `git status --short && git log -1 --oneline && cat package.json && cat scripts/dev-api.mjs && cat apps/web/vite.config.ts && cat apps/api/src/main.ts && rg -n 'PORT|npm run dev|5173|3000' README.md .env.example`
> - Ran `git add AGENTS.md README.md apps/api/package.json apps/api/src/modules/certificates/certificates.controller.ts apps/api/src/modules/certificates/certificates.service.ts apps/api/src/modules/certificates/certificate-detail.dto.ts apps/api/test/integration/certificate-detail.test.mjs apps/web/src/features/certificates/CertificateList.tsx apps/web/src/features/certificates/CertificateDetail.tsx apps/web/src/styles/global.css apps/web/e2e/certificate-detail.spec.ts docs/data-model.md packages/shared/src/certificates.ts && git diff --cached --check && git commit -m "feat: add certificate detail and confirmed revocation"`
> - Ran `git merge --ff-only codex/certificate-detail`
> - Ran `readlink /proc/2695925/cwd /proc/2695988/cwd /proc/2698272/cwd && ss -ltnp '( sport = :3000 or sport = :5173 )'`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run build`
> - Ran `ss -ltnp '( sport = :3000 or sport = :5173 )' && ps -eo pid,ppid,comm,args | rg 'scripts/dev-api|tsc --watch|node --watch|dist/main.js|vite --host|npm run dev'`
>
> </details>
>
> Committed as `3ac8865` and fast-forwarded `main`. The merged application builds successfully, and your untracked files are untouched.
>
> I’m restarting the API and frontend on ports 3000 and 5173, then checking health and certificate-detail access.
>
> <details><summary>Ran 7 commands</summary>
>
> - Ran `kill -TERM 2695925 2695988`
> - Ran `ss -ltnp '( sport = :3000 or sport = :5173 )'`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run dev --workspace @training/api`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run dev --workspace @training/web -- --host 127.0.0.1 --port 5173 --strictPort`
> - Ran `rg -n 'tokens|tokenFile|credentials' apps/api/prisma/seed.mjs apps/api/prisma/demo-data.mjs && git status --short && git log -1 --oneline && git -C /home/zblxy/.codex/worktrees/certificate-detail/training_platform_admin status --short`
> - Ran ``cat > /tmp/training-certificate-detail-restart-smoke.cjs <<'JS'
> const assert = require('node:assert/strict');
> const { readFileSync } = require('node:fs');
> const { chromium } = require('/home/zblxy/work/dev/training_platform_admin/node_modules/@playwright/test');
> (async () => {
>   const origin = 'http://127.0.0.1:5173';
>   for (const base of ['http://127.0.0.1:3000', origin]) {
>     const response = await fetch(`${base}/api/health`);
>     assert.equal(response.status, 200);
>     assert.deepEqual(await response.json(), { status: 'ok' });
>   }
>   const credentials = JSON.parse(readFileSync('/home/zblxy/work/dev/training_platform_admin/.demo-tokens.json', 'utf8'));
>   const token = [REDACTED_SECRET]
>   const response = await fetch(`${origin}/api/certificates?pageSize=1`, { headers: { Authorization: `Bearer ${token}` } });
>   assert.equal(response.status, 200);
>   const { items } = await response.json(); assert.ok(items.length);
>   const detailResponse = await fetch(`${origin}/api/certificates/${items[0].id}`, { headers: { Authorization: `Bearer ${token}` } });
>   assert.equal(detailResponse.status, 200);
>   const detail = await detailResponse.json();
>   assert.equal(detail.serialNumber, items[0].serialNumber);
>   assert.ok(detail.auditEvents.some(event => event.action === 'ISSUED'));
>   const browser = await chromium.launch({ executablePath: '/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome', headless: true });
>   try {
>     const page = await browser.newPage();
>     await page.goto(origin);
>     await page.getByLabel('Generated admin token').fill(token);
>     await page.getByRole('button', { name: 'Use token', exact: true }).click();
>     await page.getByRole('button', { name: detail.serialNumber, exact: true }).click();
>     const panel = page.getByRole('region', { name: 'Certificate detail', exact: true });
>     await panel.getByRole('heading', { name: 'Audit history', exact: true }).waitFor();
>     assert.ok((await panel.textContent()).includes(detail.issueDate));
>     if (detail.status === 'active') {
>       await panel.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
>       await page.getByRole('dialog').waitFor();
>       await page.getByRole('button', { name: 'Cancel', exact: true }).click();
>       assert.equal((await (await fetch(`${origin}/api/certificates/${detail.id}`, { headers: { Authorization: `Bearer ${token}` } })).json()).status, 'active');
>     }
>     console.log('PASS: API health, frontend proxy health, authenticated detail/audit reads, and real browser detail flow. No business data changed.');
>   } finally { await browser.close(); }
> })().catch(() => { console.error('Restart smoke check failed; inspect local application health and certificate detail flow.'); process.exitCode = 1; });
> JS``
> - Ran `/home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/training-certificate-detail-restart-smoke.cjs`
>
> </details>
</details>

Committed as `3ac8865` and merged into `main`.

Restarted the API and frontend. Available at [http://localhost:5173](http://localhost:5173).

Verified the build, API health, and certificate detail/audit flow in a real browser. Your untracked files remain untouched.
