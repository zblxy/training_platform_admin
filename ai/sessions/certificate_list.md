# Plan certificate list feature

> start a new codex worktree to implement certificate list feature. from now on, use plan mode. Inspect the relevant files, ask clarifying questions if needed, then propose the implementation plan before writing code.

<details><summary>6 previous messages</summary>

> I’ll inspect the repository and existing certificate code, then clarify any gaps and propose a plan before writing code. I’ll use a separate worktree for the implementation.
>
> <details><summary>Explored 4 files, a list, ran 3 commands</summary>
>
> - Ran `pwd && git status --short && git branch --show-current && git worktree list && rg --files -g 'AGENTS.md' -g '*certificate*' -g 'package.json' -g '*answers*' -g '*plan*' -g '*session*' -g '*routes*' -g '*App*' -g '*main*' -g '*schema*' -g '*data-model*'`
>
> <details><summary>Explored 5 files, a list</summary>
>
> - Read `~/.codex/skills/.system/openai-docs/SKILL.md`
> - Read `./AGENTS.md`
> - Read `./written-answers.md`
> - Read `./package.json`
> - Listed files in `web`
> - Read `./apps/api/prisma/schema.prisma`
>
> </details>
>
> - Ran `cat apps/web/src/main.tsx apps/web/src/styles/global.css packages/shared/src/index.ts apps/api/src/modules/auth/auth.module.ts apps/api/src/modules/certificates/certificates.module.ts apps/api/src/app.ts apps/api/src/app.module.ts && cat docs/data-model.md && cat apps/api/src/modules/certificates/certificates.service.ts`
>
> - Ran `rg -n -i 'certificate|pagination|search|filter|list|证书' ai/sessions/init_project README.md apps/api/test/certificates.test.mjs apps/web/e2e/smoke.spec.ts && cat apps/web/package.json apps/api/package.json apps/web/playwright.config.ts`
>
> </details>
>
> The frontend is a placeholder, and certificate issuance/revocation exist only as backend services. A list feature will need an authenticated API and UI. The model supports issued and revoked certificates, plus enrollment statuses for incomplete, completed, and certified learners; we need to settle which records the list should show.
>
> Your untracked `ai/` and `written-answers.md` files will remain untouched in the original checkout.
>
> <details><summary>Ran a command</summary>
>
> - Ran `git worktree add -b codex/certificate-list /home/zblxy/.codex/worktrees/certificate-list/training_platform_admin HEAD`
>
> </details>
>
> What should the certificate list contain?
> - Issued certificates, including revoked ones (recommended)
> - All enrollments, including learners awaiting certificates
>
> What should the first version include?
> - Read-only table with learner/email/course search, active/revoked filter, and pagination (recommended)
> - Read-only table with pagination only
> - List plus issuance, revocation, or export actions — specify which
>
> There is no login UI yet. How should admins authenticate to this feature?
> - Enter an existing bearer token; keep it in memory for this session (recommended)
> - API only for now; defer the UI
> - Build a login flow — provide requirements
>
> <details><summary>Ran a command</summary>
>
> - Ran `git status --short --branch && git log -1 --oneline && git diff --check`
>
> </details>
</details>

Created a clean worktree on `codex/certificate-list` at:

`/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin`

I’ll keep work planning-only until you approve implementation. I inspected the schema, certificate services, authentication, frontend, shared contracts, and test setup. No application code changed.

Proposed plan, pending your scope answers:

1. Define shared list contracts and validate pagination, search, and filters.
2. Add `GET /api/certificates`, protected by `ActorGuard`, with tenant-scoped results and counts.
3. Build an accessible table with authentication, loading, empty, error, and pagination states.
4. Cover tenant isolation, invalid queries, filtering, and browser workflows.
5. Run lint, typecheck, build, relevant tests, and review the diff.

I’ve sent three scope questions about list contents, controls/actions, and authentication. Your answers will let me finalize the plan for approval.

> I will provide list certificate feature details now:
>
> 1. the actor(tenant admin) can search certificate by learner name or certificate serial number
> 2. certificate list feature support pagination and sort&#x20;
> 3. don't implement the authentication/login page, can use generated token for authentication and authorization.

<details><summary>3 previous messages</summary>

> I’ll update the plan around name/serial-number search, pagination, sorting, and generated-token authentication. I’ll first check how certificate identifiers and tokens work today, since the schema has a UUID but no separate serial-number field.
>
> <details><summary>Ran a command</summary>
>
> - Ran `git status --short --branch && cat AGENTS.md && cat apps/api/prisma/schema.prisma && cat apps/api/prisma/seed.mjs && cat apps/web/src/main.tsx && cat apps/api/test/integration/models.test.mjs`
>
> </details>
>
> The schema currently has only Certificate.id (UUID). Should the certificate serial number use that UUID, or be a separate identifier?
> - Use the existing UUID as the serial number
> - Add a separate serial number — specify its format and uniqueness rules
>
> For the browser UI, how should we supply the generated bearer token without a login page?
> - Small token control on the certificate list; token kept only in memory
> - Inject the token through a local development proxy; no token UI
</details>

The worktree remains clean on `codex/certificate-list`. No code changes yet.

The schema has no separate certificate serial number, so I’ve asked whether to use the existing UUID or add a new identifier. I also asked how to supply the generated token to the browser without a login page.

Proposed implementation plan:

1. Add authenticated `GET /api/certificates`, using `ActorGuard` and tenant-scoped queries and counts.
2. Support learner-name or serial-number search. Propose case-insensitive partial name matching and exact serial matching.
3. Add page-number pagination: default 20 rows, maximum 100.
4. Support ascending/descending sorting by learner name, serial number, course, and issuance time; default to newest issued first, with an ID tie-breaker.
5. Build a read-only table showing serial number, learner, course, issue date, and active/revoked status, including search, sorting, pagination, and loading/empty/error states.
6. Verify authorization, tenant isolation, search, sorting, pagination, and browser workflows; run lint, typecheck, build, and relevant tests.

This proposes listing both active and revoked certificates. Issuance, revocation, exports, and a login page remain outside scope.

Please answer the two clarification prompts and approve or adjust these defaults before implementation, as required by [AGENTS.md](./AGENTS.md).

> **The schema currently has only Certificate.id (UUID). Should the certificate serial number use that UUID, or be a separate identifier?**
>
> Add a separate serial number — specify its format and uniqueness rules
>
> **For the browser UI, how should we supply the generated bearer token without a login page?**
>
> Seed one admin per tenant and identify fy the actor with a token

<details><summary>1 previous message</summary>

> What format and uniqueness rule should the new certificate serial number use?
> - CERT- plus 32 random uppercase hexadecimal characters; globally unique and immutable (recommended)
> - Tenant-specific sequential numbers — provide the prefix and padding rules
> - Date-based serial numbers — provide an example and whether uniqueness is global or per tenant
</details>

Understood: add a separate serial number, and authenticate tenant admins using generated bearer tokens. The existing seed already creates one admin per tenant; we’ll reuse that without a login page.

The serial format and uniqueness rules still need defining. I recommend `CERT-` followed by 32 random uppercase hexadecimal characters, globally unique and immutable. I’ve sent that choice for confirmation.

The plan will also include a migration to assign serial numbers to existing certificates and generate them for future issuance. The remaining search, pagination, sorting, UI, and verification steps stay as proposed. No code changes until the requirements and plan are approved.

> **What format and uniqueness rule should the new certificate serial number use?**
>
> CERT- plus 32 random uppercase hexadecimal characters; globally unique and immutable (recommended)

Serial format is settled: `CERT-` plus 32 random uppercase hexadecimal characters, globally unique and immutable.

Implementation plan:

1. Add the serial field and migration, backfill existing certificates, and generate serials for future issuance.
2. Add a tenant-scoped certificate-list API secured with existing generated bearer tokens.
3. Support partial learner-name search, exact serial search, pagination, and ascending/descending sorting. Default: 20 rows, newest issued first.
4. Build a read-only table for active and revoked certificates with search, sorting, pagination, and loading/empty/error states. No login page.
5. Test migration behavior, serial uniqueness/immutability, authorization, tenant isolation, queries, and browser workflows; run lint, typecheck, and build.

Do you approve this plan?

Approval is required before writing code by [AGENTS.md](./AGENTS.md).

> ok

<details><summary>14 previous messages</summary>

> The plan is approved. I’ll implement it in the certificate-list worktree, starting with the serial-number migration and tenant-scoped API, then the table and verification.
>
> <details><summary>Ran 5 commands</summary>
>
> - Ran `rg --files apps/api/prisma/migrations && cat apps/api/prisma/migrations/*/migration.sql && cat apps/api/src/common/database/database.service.ts apps/api/test/smoke.test.mjs apps/web/e2e/smoke.spec.ts apps/web/src/styles/global.css && ls -d node_modules /home/zblxy/.nvm/versions/node/v24.22.1/bin /tmp/training-platform-tools/node_modules 2>/dev/null && cat .gitignore`
> - Ran `cat apps/web/vite.config.ts apps/api/tsconfig.json tsconfig.base.json .gitignore && ls /tmp/training-model-postgres && ls node_modules && cat /tmp/training-model-postgres/start.mjs`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm ci --cache /tmp/training-platform-npm-cache --no-audit --no-fund`
> - Ran `cat > /tmp/implement-certificate-list.py <<'PY'
> from pathlib import Path
> r=Path('/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin')
> def put(p,s):
>  p=r/p; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(s)
> def replace(p,a,b):
>  p=r/p; s=p.read_text(); assert a in s,p; p.write_text(s.replace(a,b))
> replace('apps/api/prisma/schema.prisma','model Certificate {\n','model Certificate {\n  serialNumber String @unique @default(dbgenerated("(\'CERT-\'::text || upper(replace((gen_random_uuid())::text, \'-\'::text, \'\'::text)))"))\n')
> put('apps/api/prisma/migrations/20261031010000_certificate_serial/migration.sql','''BEGIN;
> -- A volatile database default assigns each existing row a distinct serial without
> -- updating certificate history or triggering final-revocation protection.
> ALTER TABLE "Certificate" ADD COLUMN "serialNumber" TEXT NOT NULL
>   DEFAULT ('CERT-' || upper(replace(gen_random_uuid()::text, '-', '')));
> ALTER TABLE "Certificate" ADD CONSTRAINT certificate_serial_format
>   CHECK ("serialNumber" ~ '^CERT-[0-9A-F]{32}$');
> CREATE UNIQUE INDEX "Certificate_serialNumber_key" ON "Certificate"("serialNumber");
> CREATE FUNCTION protect_certificate_serial() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
> BEGIN
>   IF NEW."serialNumber" IS DISTINCT FROM OLD."serialNumber" THEN
>     RAISE EXCEPTION 'Certificate serial number is immutable' USING ERRCODE = '23514';
>   END IF;
>   RETURN NEW;
> END $$;
> CREATE TRIGGER protect_certificate_serial BEFORE UPDATE ON "Certificate"
>   FOR EACH ROW EXECUTE FUNCTION protect_certificate_serial();
> COMMIT;
> ''')
> put('packages/shared/src/certificates.ts','''export const certificateSortFields = ['issuedAt', 'learnerName', 'serialNumber', 'courseTitle'] as const;
> export type CertificateSortField = typeof certificateSortFields[number];
> export interface CertificateListItem {
>   id: string;
>   serialNumber: string;
>   learnerName: string;
>   courseTitle: string;
>   issuedAt: string;
>   issueDate: string;
>   status: 'active' | 'revoked';
> }
> export interface CertificateListResponse {
>   items: CertificateListItem[];
>   total: number;
>   page: number;
>   pageSize: number;
> }
> export function isCertificateListResponse(value: unknown): value is CertificateListResponse {
>   if (typeof value !== 'object' || value === null) return false;
>   const row = value as Record<string, unknown>;
>   return Number.isSafeInteger(row.total) && (row.total as number) >= 0 &&
>     Number.isSafeInteger(row.page) && (row.page as number) >= 1 &&
>     Number.isSafeInteger(row.pageSize) && (row.pageSize as number) >= 1 && (row.pageSize as number) <= 100 &&
>     Array.isArray(row.items) && row.items.length <= (row.pageSize as number) && row.items.every((item: unknown) => {
>       if (typeof item !== 'object' || item === null) return false;
>       const entry = item as Record<string, unknown>;
>       return typeof entry.id === 'string' && typeof entry.serialNumber === 'string' &&
>         typeof entry.learnerName === 'string' && typeof entry.courseTitle === 'string' &&
>         typeof entry.issuedAt === 'string' && typeof entry.issueDate === 'string' &&
>         (entry.status === 'active' || entry.status === 'revoked');
>     });
> }
> ''')
> replace('packages/shared/src/index.ts',"export interface HealthResponse", "export * from './certificates.js';\nexport interface HealthResponse")
> put('apps/api/src/modules/certificates/list-certificates.dto.ts','''import { Transform } from 'class-transformer';
> import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
> import { certificateSortFields, type CertificateSortField } from '@training/shared';
>
> // Only canonical positive integers are accepted, rather than JS numeric coercions.
> const integer = ({ value }: { value: unknown }) => typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : value;
> export class ListCertificatesDto {
>   @Transform(integer)
>   @IsInt() @Min(1) @Max(1000000)
>   page = 1;
>
>   @Transform(integer)
>   @IsInt() @Min(1) @Max(100)
>   pageSize = 20;
>
>   @IsString() @MaxLength(200)
>   @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
>   search = '';
>
>   @IsIn(certificateSortFields)
>   sortBy: CertificateSortField = 'issuedAt';
>
>   @IsIn(['asc', 'desc'])
>   sortDirection: 'asc' | 'desc' = 'desc';
> }
> ''')
> put('apps/api/src/modules/certificates/certificates.controller.ts','''import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
> import { ActorGuard, type ActorRequest } from '../auth/auth.module.js';
> import { CertificatesService } from './certificates.service.js';
> import { ListCertificatesDto } from './list-certificates.dto.js';
> @Controller('certificates')
> @UseGuards(ActorGuard)
> export class CertificatesController {
>   constructor(private readonly certificates: CertificatesService) {}
>   @Get()
>   list(@Req() request: ActorRequest, @Query() query: ListCertificatesDto) {
>     return this.certificates.list(request.actor, query);
>   }
> }
> ''')
> replace('apps/api/src/modules/certificates/certificates.module.ts',"import { Module }", "import { AuthModule } from '../auth/auth.module.js';\nimport { CertificatesController } from './certificates.controller.js';\nimport { Module }")
> replace('apps/api/src/modules/certificates/certificates.module.ts','imports: [DatabaseModule], providers:', 'imports: [DatabaseModule, AuthModule], controllers: [CertificatesController], providers:')
> replace('apps/api/src/modules/certificates/certificates.service.ts',"import type { Actor }", "import type { CertificateListResponse } from '@training/shared';\nimport type { Prisma } from '../../generated/prisma/client.js';\nimport type { ListCertificatesDto } from './list-certificates.dto.js';\nimport type { Actor }")
> replace('apps/api/src/modules/certificates/certificates.service.ts','  async issue(','''  async list(actor: Actor, query: ListCertificatesDto): Promise<CertificateListResponse> {
>     const { search, page, pageSize, sortBy, sortDirection } = query;
>     const where: Prisma.CertificateWhereInput = {
>       tenantId: actor.tenantId,
>       ...(search ? { OR: [
>         { serialNumber: { equals: search.toUpperCase() } },
>         // Escape LIKE metacharacters: the user is searching for literal text.
>         { enrollment: { learner: { name: { contains: search.replace(/[\\\\%_]/g, '\\\\$&'), mode: 'insensitive' } } } },
>       ] } : {}),
>     };
>     const primary: Prisma.CertificateOrderByWithRelationInput = sortBy === 'learnerName'
>       ? { enrollment: { learner: { name: sortDirection } } }
>       : sortBy === 'courseTitle' ? { enrollment: { course: { title: sortDirection } } }
>       : { [sortBy]: sortDirection };
>     // Count and rows share a consistent database snapshot, including during issuance.
>     const [total, rows] = await this.db.$transaction([
>       this.db.certificate.count({ where }),
>       this.db.certificate.findMany({
>         where, orderBy: [primary, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize,
>         select: { id: true, serialNumber: true, issuedAt: true, issueDate: true, revokedAt: true,
>           enrollment: { select: { learner: { select: { name: true } }, course: { select: { title: true } } } } },
>       }),
>     ], { isolationLevel: 'RepeatableRead' });
>     return { total, page, pageSize, items: rows.map(row => ({
>       id: row.id, serialNumber: row.serialNumber, learnerName: row.enrollment.learner.name,
>       courseTitle: row.enrollment.course.title, issuedAt: row.issuedAt.toISOString(),
>       issueDate: row.issueDate.toISOString().slice(0, 10), status: row.revokedAt ? 'revoked' : 'active',
>     })) };
>   }
>   async issue(''')
> PY`
> - Ran `python3 /tmp/implement-certificate-list.py`
>
> </details>
>
> The API and serial-number migration are in place. The database default will assign serials to existing certificates, including revoked ones, without firing certificate update triggers or changing audit history. Separate constraints enforce the format, global uniqueness, and immutability.
>
> The list query scopes both rows and counts to the authenticated tenant. Next I’ll add the table, with an inline control for the generated token kept in memory.
>
> <details><summary>Ran 11 commands</summary>
>
> - Ran ``cat > /tmp/implement-certificate-ui.py <<'PY'
> exec(Path('/dev/null').read_text()) if False else None
> from pathlib import Path
> r=Path('/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin')
> def put(p,s):
>  p=r/p;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
> put('apps/web/src/features/certificates/CertificateList.tsx','''import { useEffect, useState, type FormEvent } from 'react';
> import { isCertificateListResponse, type CertificateListResponse, type CertificateSortField } from '@training/shared';
>
> export function CertificateList() {
>   const [token, setToken] = useState('');
>   const [credential, setCredential] = useState('');
>   const [draft, setDraft] = useState('');
>   const [search, setSearch] = useState('');
>   const [page, setPage] = useState(1);
>   const [pageSize, setPageSize] = useState(20);
>   const [sortBy, setSortBy] = useState<CertificateSortField>('issuedAt');
>   const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
>   const [result, setResult] = useState<CertificateListResponse | null>(null);
>   const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'unauthorized'>('idle');
>   const [attempt, setAttempt] = useState(0);
>   useEffect(() => {
>     setResult(null);
>     if (!token) { setState('idle'); return; }
>     const controller = new AbortController();
>     let active = true;
>     const timeout = setTimeout(() => controller.abort(), 10000);
>     setState('loading');
>     const params = new URLSearchParams({ search, page: String(page), pageSize: String(pageSize), sortBy, sortDirection });
>     void fetch(`/api/certificates?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
>       .then(async response => {
>         if (response.status === 401) { if (active) setState('unauthorized'); return; }
>         if (!response.ok) throw new Error('Certificate request failed');
>         const data: unknown = await response.json();
>         if (!isCertificateListResponse(data)) throw new Error('Invalid certificate response');
>         if (active) { setResult(data); setState('ready'); }
>       }).catch(() => { if (active) setState('error'); }).finally(() => clearTimeout(timeout));
>     return () => { active = false; controller.abort(); clearTimeout(timeout); };
>   }, [token, search, page, pageSize, sortBy, sortDirection, attempt]);
>   function applyToken(event: FormEvent) {
>     event.preventDefault(); setResult(null); setToken(credential.trim()); setCredential(''); setPage(1); setAttempt(value => value + 1);
>   }
>   function submitSearch(event: FormEvent) { event.preventDefault(); setSearch(draft.trim()); setPage(1); }
>   const pages = result ? Math.max(1, Math.ceil(result.total / pageSize)) : 1;
>   return <section aria-labelledby="certificates-heading">
>     <h2 id="certificates-heading">Certificates</h2>
>     <p>Search issued certificates by learner name or full serial number. Revoked certificates remain in the list.</p>
>     <details open={!token}><summary>API token</summary>
>       <form onSubmit={applyToken} className="controls">
>         <label>Generated admin token<input type="password" value={credential} onChange={event => setCredential(event.target.value)} autoComplete="off" required maxLength={43} pattern="[A-Za-z0-9_-]{43}" /></label>
>         <button type="submit">Use token</button>
>         {token && <button type="button" onClick={() => { setToken(''); setResult(null); }}>Clear token</button>}
>       </form>
>       <p>Use your tenant admin token from the demo seed. The token stays in memory and is cleared on reload.</p>
>     </details>
>     <form onSubmit={submitSearch} className="controls" role="search">
>       <label>Learner name or certificate serial number<input value={draft} onChange={event => setDraft(event.target.value)} maxLength={200} type="search" /></label>
>       <button type="submit" disabled={!token}>Search</button>
>       <button type="button" disabled={!token} onClick={() => { setDraft(''); setSearch(''); setPage(1); }}>Clear search</button>
>     </form>
>     <div className="controls">
>       <label>Sort by<select value={sortBy} onChange={event => { setSortBy(event.target.value as CertificateSortField); setPage(1); }}>
>         <option value="issuedAt">Issuance time</option><option value="learnerName">Learner name</option><option value="serialNumber">Serial number</option><option value="courseTitle">Course</option>
>       </select></label>
>       <label>Sort direction<select value={sortDirection} onChange={event => { setSortDirection(event.target.value as 'asc' | 'desc'); setPage(1); }}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
>       <label>Rows per page<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
>     </div>
>     <p role="status" aria-live="polite">{state === 'idle' ? 'Supply a generated admin token to load certificates.' : state === 'loading' ? 'Loading certificates…' : state === 'ready' ? `${result?.total ?? 0} certificates found.` : ''}</p>
>     {state === 'unauthorized' && <p role="alert">The admin token is invalid or no longer authorized. Supply a valid token.</p>}
>     {state === 'error' && <div role="alert">Unable to load certificates. <button onClick={() => setAttempt(value => value + 1)}>Retry certificates</button></div>}
>     {state === 'ready' && result && <>
>       {result.items.length === 0 ? <p>{result.total === 0 ? 'No certificates match your search.' : 'No certificates on this page. Return to an earlier page.'}</p> : <div className="table-scroll"><table>
>         <caption>Issued certificates</caption>
>         <thead><tr><th scope="col">Serial number</th><th scope="col">Learner</th><th scope="col">Course</th><th scope="col">Issue date</th><th scope="col">Status</th></tr></thead>
>         <tbody>{result.items.map(item => <tr key={item.id}><td className="serial">{item.serialNumber}</td><td>{item.learnerName}</td><td>{item.courseTitle}</td><td>{item.issueDate}</td><td>{item.status === 'active' ? 'Active' : 'Revoked'}</td></tr>)}</tbody>
>       </table></div>}
>       <nav aria-label="Certificate pagination" className="controls">
>         <button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous page</button>
>         <span>Page {page} of {pages}</span>
>         <button disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next page</button>
>         {page > pages && <button onClick={() => setPage(1)}>First page</button>}
>       </nav>
>     </>}
>   </section>;
> }
> ''')
> p=r/'apps/web/src/main.tsx';s=p.read_text().replace("import './styles/global.css';","import './styles/global.css';\nimport { CertificateList } from './features/certificates/CertificateList';").replace('<p>Project initialized. No application features are configured.</p>','').replace('  </main>;','    <CertificateList />\n  </main>;');p.write_text(s)
> put('apps/web/src/styles/global.css',''':root { font-family: system-ui, sans-serif; color: #192538; background: #f5f7fa; }
> body { margin: 0; }
> main { max-width: 80rem; margin: 2rem auto; padding: 1.5rem; }
> h1 { font-size: 2rem; }
> p { line-height: 1.6; }
> section { background: white; padding: 1.5rem; border: 1px solid #d6dde8; border-radius: .5rem; margin-top: 2rem; }
> button, input, select { font: inherit; padding: .6rem; }
> button, summary { cursor: pointer; }
> button:disabled { cursor: default; opacity: .6; }
> :focus-visible { outline: 3px solid #1759b8; outline-offset: 3px; }
> .controls { display: flex; flex-wrap: wrap; align-items: end; gap: .8rem; margin: 1rem 0; }
> label { display: flex; flex-direction: column; gap: .4rem; max-width: 100%; }
> input { width: 24rem; max-width: 100%; box-sizing: border-box; }
> .table-scroll { overflow-x: auto; }
> table { border-collapse: collapse; width: 100%; text-align: left; }
> caption { text-align: left; font-weight: 600; margin: .8rem 0; }
> th, td { padding: .8rem; border-bottom: 1px solid #d6dde8; }
> th { background: #eef2f7; }
> .serial { font-family: monospace; overflow-wrap: anywhere; }
> [role="alert"] { color: #9c2424; }
> ''')
> PY
> python3 -m py_compile /tmp/implement-certificate-ui.py``
> - Ran `python3 /tmp/implement-certificate-ui.py`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck`
> - Ran `ps -eo pid,comm,args | rg 'postgres|training-model' && cat apps/api/src/modules/certificates/certificates.service.ts && cat apps/api/prisma/schema.prisma | head -n 90`
> - Ran `/home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/training-model-postgres/start.mjs`
> - Ran ``cat > /tmp/certificate-list-tests.py <<'PY'
> from pathlib import Path
> import json
> r=Path('/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin')
> def put(p,s):
>  p=r/p;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
> p=r/'apps/api/package.json';j=json.loads(p.read_text());j['scripts']['test:db']='npm run build && node --test test/integration/models.test.mjs test/integration/certificate-list.test.mjs';p.write_text(json.dumps(j,indent=2)+'\n')
> put('apps/api/test/integration/certificate-list.test.mjs',r'''import 'reflect-metadata';
> import { test, before, after } from 'node:test';
> import assert from 'node:assert/strict';
> import { randomUUID, randomBytes } from 'node:crypto';
> import { readFile } from 'node:fs/promises';
> import pg from 'pg';
> import { DatabaseService } from '../../dist/common/database/database.service.js';
> import { CertificatesService } from '../../dist/modules/certificates/certificates.service.js';
> import { hashToken } from '../../dist/modules/auth/auth.module.js';
> import { createApp } from '../../dist/app.js';
> if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to an isolated test database');
> const schema = `certificate_list_${randomUUID().replaceAll('-', '')}`;
> const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('schema', schema);
> process.env.DATABASE_URL = url.toString();
> const sql = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
> const token = [REDACTED_SECRET]'base64url');
> let db, service, app, base, actor, other, legacy, auditBefore, oldRows, enrollments;
> before(async () => {
>   await sql.connect();
>   await sql.query(`CREATE SCHEMA "${schema}"`);
>   await sql.query(`SET search_path TO "${schema}"`);
>   await sql.query(await readFile('prisma/migrations/20261031000000_initial_data_model/migration.sql', 'utf8'));
>   // Populate the old schema, including final revoked history, before upgrading.
>   const tenantId = randomUUID(), adminId = randomUUID(), courseId = randomUUID();
>   await sql.query('BEGIN');
>   await sql.query('INSERT INTO "Tenant" (id,name,"timeZone") VALUES ($1,\'Legacy\',\'UTC\')', [tenantId]);
>   await sql.query('INSERT INTO "Admin" (id,"tenantId",name,"tokenHash") VALUES ($1,$2,\'Legacy\',$3)', [adminId, tenantId, hashToken(randomBytes(32).toString('base64url'))]);
>   await sql.query('COMMIT');
>   await sql.query('INSERT INTO "Course" (id,"tenantId",title) VALUES ($1,$2,\'Legacy\')', [courseId, tenantId]);
>   for (let index = 0; index < 2; index++) {
>     const learnerId = randomUUID(), enrollmentId = randomUUID(), certificateId = randomUUID();
>     await sql.query('INSERT INTO "Learner" (id,"tenantId",name,email) VALUES ($1,$2,\'Legacy\',$3)', [learnerId, tenantId, `${index}@legacy.test`]);
>     await sql.query('INSERT INTO "Enrollment" (id,"tenantId","courseId","learnerId",status,"completedAt") VALUES ($1,$2,$3,$4,\'COMPLETED\',now())', [enrollmentId, tenantId, courseId, learnerId]);
>     await sql.query('INSERT INTO "Certificate" (id,"tenantId","enrollmentId","issuedById","issueDate","issueTimeZone") VALUES ($1,$2,$3,$4,(now() AT TIME ZONE \'UTC\')::date,\'UTC\')', [certificateId, tenantId, enrollmentId, adminId]);
>     if (index) await sql.query('UPDATE "Certificate" SET "revokedAt"=now(),"revokedById"=$2,"revocationReason"=\'Legacy correction\' WHERE id=$1', [certificateId, adminId]);
>   }
>   oldRows = (await sql.query('SELECT * FROM "Certificate" ORDER BY id')).rows;
>   auditBefore = (await sql.query('SELECT * FROM "AuditEvent" ORDER BY id')).rows;
>   await sql.query(await readFile('prisma/migrations/20261031010000_certificate_serial/migration.sql', 'utf8'));
>   legacy = (await sql.query('SELECT * FROM "Certificate" ORDER BY id')).rows;
>   db = new DatabaseService(); service = new CertificatesService(db);
>   async function admin(name, credential) {
>     return db.$transaction(async tx => {
>       const tenant = await tx.tenant.create({ data: { name, timeZone: 'UTC' } });
>       return tx.admin.create({ data: { tenantId: tenant.id, name, tokenHash: hashToken(credential) } });
>     });
>   }
>   actor = await admin('A', token); other = await admin('B', randomBytes(32).toString('base64url'));
>   enrollments = [];
>   for (const owner of [actor, other]) {
>     const course = await db.course.create({ data: { tenantId: owner.tenantId, title: owner === actor ? 'Safety' : 'Foreign course' } });
>     for (let index = 0; index < (owner === actor ? 25 : 1); index++) {
>       const learner = await db.learner.create({ data: { tenantId: owner.tenantId, name: index === 24 ? 'Literal %_\\ name' : `Learner ${String(index).padStart(2, '0')}`, email: `${index}@test.example` } });
>       const enrollment = await db.enrollment.create({ data: { tenantId: owner.tenantId, courseId: course.id, learnerId: learner.id, status: 'COMPLETED', completedAt: new Date() } });
>       const certificate = await service.issue(owner, enrollment.id);
>       if (owner === actor) { enrollments.push(enrollment); if (index === 0) await service.revoke(owner, certificate.id, 'Correction'); }
>     }
>   }
>   app = await createApp(); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
> });
> after(async () => {
>   await app?.close(); await db?.$disconnect();
>   await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await sql.end();
> });
> async function response(query = '', credential = token) {
>   return fetch(`${base}/api/certificates${query ? `?${query}` : ''}`, { headers: { authorization: credential ? `Bearer ${credential}` : '' } });
> }
> async function list(query = '') { const res = await response(query); assert.equal(res.status, 200); return res.json(); }
> test('migration backfills active/revoked serials without changing certificate fields or audit history', async () => {
>   assert.equal(legacy.length, 2);
>   assert.equal(new Set(legacy.map(row => row.serialNumber)).size, 2);
>   for (const [index, { serialNumber, ...old }] of legacy.entries()) { assert.match(serialNumber, /^CERT-[0-9A-F]{32}$/); assert.deepEqual(old, oldRows[index]); }
>   assert.deepEqual((await sql.query('SELECT * FROM "AuditEvent" WHERE "certificateId"=ANY($1::uuid[]) ORDER BY id', [legacy.map(row => row.id)])).rows, auditBefore);
> });
> test('serials are generated, immutable, globally unique and format checked by the database', async () => {
>   const current = await db.certificate.findFirstOrThrow({ where: { tenantId: actor.tenantId, revokedAt: null } });
>   assert.match(current.serialNumber, /^CERT-[0-9A-F]{32}$/);
>   await assert.rejects(db.certificate.update({ where: { id: current.id }, data: { serialNumber: `CERT-${'A'.repeat(32)}` } }));
>   const enrollment = await db.enrollment.create({ data: { tenantId: other.tenantId, courseId: (await db.course.findFirstOrThrow({ where: { tenantId: other.tenantId } })).id, learnerId: (await db.learner.create({ data: { tenantId: other.tenantId, name: 'Duplicate', email: 'duplicate@test.example' } })).id, status: 'COMPLETED', completedAt: new Date() } });
>   const data = { tenantId: other.tenantId, enrollmentId: enrollment.id, issuedById: other.id, issuedAt: new Date(), issueDate: new Date(new Date().toISOString().slice(0,10)), issueTimeZone: 'UTC' };
>   await assert.rejects(db.certificate.create({ data: { ...data, serialNumber: current.serialNumber } }));
>   await assert.rejects(db.certificate.create({ data: { ...data, serialNumber: 'invalid' } }));
>   const issued = await service.issue(other, enrollment.id);
>   assert.equal((await service.issue(other, enrollment.id)).serialNumber, issued.serialNumber);
> });
> test('authorization and validation reject unauthenticated, foreign and malformed inputs', async () => {
>   for (const credential of ['', 'invalid', randomBytes(32).toString('base64url')]) assert.equal((await response('', credential)).status, 401);
>   for (const query of ['page=0', 'page=-1', 'page=1.2', 'page=1e2', 'page=1000001', 'pageSize=101', 'pageSize=0', 'sortBy=tenantId', 'sortDirection=invalid', 'tenantId='+other.tenantId, 'search='+ 'x'.repeat(201), 'page=1&page=2']) assert.equal((await response(query)).status, 400, query);
> });
> test('list and counts are tenant scoped; response excludes private database fields', async () => {
>   const data = await list(); assert.equal(data.total, 25); assert.equal(data.items.length, 20); assert.equal(data.page, 1); assert.equal(data.pageSize, 20);
>   assert.ok(data.items.every(row => row.courseTitle === 'Safety'));
>   assert.deepEqual(Object.keys(data.items[0]).sort(), ['id','serialNumber','learnerName','courseTitle','issuedAt','issueDate','status'].sort());
>   const foreign = await db.certificate.findFirstOrThrow({ where: { tenantId: other.tenantId } });
>   assert.equal((await list(`search=${foreign.serialNumber}`)).total, 0);
> });
> test('search is partial/case-insensitive by name, exact by serial and literal for SQL wildcards', async () => {
>   const named = await list('search=LeArNeR%200'); assert.equal(named.total, 10);
>   const serial = named.items[0].serialNumber;
>   assert.equal((await list(`search=${serial.toLowerCase()}`)).total, 1);
>   assert.equal((await list(`search=${serial.slice(0,-1)}`)).total, 0);
>   for (const search of ['%', '_', '\\']) assert.equal((await list(`search=${encodeURIComponent(search)}`)).total, 1);
>   assert.equal((await list('search=nobody')).total, 0);
>   const all = await list('pageSize=100'); assert.ok(all.items.some(row => row.status === 'revoked')); assert.ok(all.items.some(row => row.status === 'active'));
> });
> test('every allowed sort is stable in both directions across pages, including ties', async () => {
>   for (const sortBy of ['issuedAt','learnerName','serialNumber','courseTitle']) for (const sortDirection of ['asc','desc']) {
>     const query = `sortBy=${sortBy}&sortDirection=${sortDirection}`;
>     const all = await list(`${query}&pageSize=100`);
>     const first = await list(`${query}&pageSize=10`), second = await list(`${query}&pageSize=10&page=2`), third = await list(`${query}&pageSize=10&page=3`);
>     assert.deepEqual([...first.items, ...second.items, ...third.items], all.items);
>     const keys = all.items.map(row => row[sortBy]);
>     assert.deepEqual(keys, [...keys].sort((a,b) => a < b ? (sortDirection === 'asc' ? -1 : 1) : a > b ? (sortDirection === 'asc' ? 1 : -1) : 0));
>   }
>   const beyond = await list('page=99'); assert.equal(beyond.items.length, 0); assert.equal(beyond.total, 25);
> });
> ''')
> PY``
> - Ran `python3 /tmp/certificate-list-tests.py`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm test`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/postgres npm run test:db`
> - Ran ``cat > /tmp/certificate-browser-docs.py <<'PY'
> from pathlib import Path
> r=Path('/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin')
> p=r/'apps/web/e2e/certificates.spec.ts'
> p.write_text('''import { test, expect, type Page } from '@playwright/test';
> const token = 'a'.repeat(43);
> const item = (index: number) => ({ id: String(index), serialNumber: `CERT-${String(index).padStart(32, '0')}`, learnerName: `Learner ${index}`, courseTitle: 'Safety', issuedAt: '2026-01-01T01:00:00.000Z', issueDate: '2025-12-31', status: index === 0 ? 'revoked' : 'active' });
> async function supplyToken(page: Page) {
>   await page.getByLabel('Generated admin token').fill(token);
>   await page.getByRole('button', { name: 'Use token' }).click();
> }
> test('search, sort, paging, token handling and date-only display', async ({ page }) => {
>   await page.route('**/api/certificates?**', async route => {
>     expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
>     const query = new URL(route.request().url()).searchParams;
>     const search = query.get('search') ?? '';
>     const pageNumber = Number(query.get('page'));
>     const items = search ? (search === 'nobody' ? [] : [item(0)]) : Array.from({ length: pageNumber === 1 ? 20 : 5 }, (_, i) => item((pageNumber - 1) * 20 + i));
>     await route.fulfill({ json: { items, page: pageNumber, pageSize: Number(query.get('pageSize')), total: search ? items.length : 25 } });
>   });
>   await page.goto('/');
>   await expect(page.getByRole('heading', { name: 'Certificates', exact: true })).toBeVisible();
>   await supplyToken(page);
>   await expect(page.getByText('25 certificates found.', { exact: true })).toBeVisible();
>   await expect(page.getByRole('cell', { name: 'Revoked', exact: true })).toBeVisible();
>   await expect(page.getByRole('cell', { name: '2025-12-31', exact: true }).first()).toBeVisible();
>   await page.getByRole('button', { name: 'Next page' }).click();
>   await expect(page.getByText('Page 2 of 2')).toBeVisible();
>   await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
>   const sorted = page.waitForRequest(request => request.url().includes('sortBy=learnerName'));
>   await page.getByLabel('Sort by', { exact: true }).selectOption('learnerName'); await sorted;
>   await expect(page.getByText('Page 1 of 2')).toBeVisible();
>   const ascending = page.waitForRequest(request => request.url().includes('sortDirection=asc'));
>   await page.getByLabel('Sort direction').selectOption('asc'); await ascending;
>   await page.getByLabel('Learner name or certificate serial number').fill(item(0).serialNumber);
>   await page.getByRole('button', { name: 'Search', exact: true }).click();
>   await expect(page.getByText('1 certificates found.', { exact: true })).toBeVisible();
>   await page.getByLabel('Learner name or certificate serial number').fill('nobody');
>   await page.getByRole('button', { name: 'Search', exact: true }).click();
>   await expect(page.getByText('No certificates match your search.')).toBeVisible();
>   await page.getByRole('button', { name: 'Clear search' }).click();
>   await expect(page.getByText('25 certificates found.', { exact: true })).toBeVisible();
>   expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
>   await page.reload();
>   await expect(page.getByText('Supply a generated admin token to load certificates.')).toBeVisible();
>   await expect(page.getByRole('table')).toHaveCount(0);
> });
> test('loading, unauthorized, malformed responses, failure and keyboard retry', async ({ page }) => {
>   let state = 'unauthorized';
>   await page.route('**/api/certificates?**', async route => {
>     await new Promise(resolve => setTimeout(resolve, 200));
>     await route.fulfill(state === 'unauthorized' ? { status: 401, json: {} } : state === 'failure' ? { status: 503, json: {} } : state === 'malformed' ? { json: {} } : { json: { items: [], total: 0, page: 1, pageSize: 20 } });
>   });
>   await page.goto('/'); await supplyToken(page);
>   await expect(page.getByText('Loading certificates…')).toBeVisible();
>   await expect(page.getByRole('alert')).toContainText('token is invalid');
>   state = 'failure'; await supplyToken(page);
>   await expect(page.getByRole('alert')).toContainText('Unable to load');
>   state = 'malformed'; await page.getByRole('button', { name: 'Retry certificates' }).click();
>   await expect(page.getByRole('alert')).toContainText('Unable to load');
>   state = 'ready'; await page.getByRole('button', { name: 'Retry certificates' }).focus(); await page.keyboard.press('Enter');
>   await expect(page.getByText('No certificates match your search.')).toBeVisible();
>   await page.getByRole('button', { name: 'Clear token' }).click();
>   await expect(page.getByText('Supply a generated admin token to load certificates.')).toBeVisible();
> });
> test('a delayed response from a previous tenant cannot replace current results', async ({ page }) => {
>   let release: (() => void) | undefined;
>   await page.route('**/api/certificates?**', async route => {
>     const first = route.request().headers().authorization === `Bearer ${token}`;
>     if (first) await new Promise<void>(resolve => { release = resolve; });
>     await route.fulfill({ json: { items: [{ ...item(0), learnerName: first ? 'Old tenant' : 'Current tenant' }], total: 1, page: 1, pageSize: 20 } });
>   });
>   await page.goto('/'); await supplyToken(page);
>   await expect.poll(() => Boolean(release)).toBeTruthy();
>   await page.getByLabel('Generated admin token').fill('b'.repeat(43));
>   await page.getByRole('button', { name: 'Use token' }).click();
>   await expect(page.getByRole('cell', { name: 'Current tenant' })).toBeVisible();
>   release?.();
>   await expect(page.getByRole('cell', { name: 'Old tenant' })).toHaveCount(0);
> });
> ''')
> p=r/'README.md';s=p.read_text();s=s.replace('The frontend remains a placeholder.', 'The frontend includes a read-only certificate list with learner-name/serial search, sorting and pagination.');s=s.replace('There is no login UI. Certificate operations are backend services in this phase, with no issuance/revocation HTTP routes or feature UI.', 'There is no login UI. Open the certificate list and supply a generated admin token using the inline API token control. Tokens stay in memory and are cleared on reload; they are never stored in browser storage or URLs. Issuance/revocation remain backend services without HTTP routes.');s+='''
> ## Certificate list
>
> Apply migrations explicitly and run the demo seed against a development database before browsing certificates. The seed already creates one admin per tenant; generated tokens are in the ignored root `.demo-tokens.json`. Never put tokens in frontend environment variables, bundles, or URLs.
>
> `GET /api/certificates` requires `Authorization: Bearer <token>`. Results and totals belong only to the authenticated admin's tenant. Query parameters:
>
> | Parameter | Behavior |
> | --- | --- |
> | `search` | Up to 200 characters; trimmed; case-insensitive partial learner name OR full serial match (serial input is normalized to uppercase). SQL wildcard characters are literal. |
> | `page` | Positive integer, default 1, maximum 1,000,000. |
> | `pageSize` | Positive integer, default 20, maximum 100. |
> | `sortBy` | `issuedAt` (default), `learnerName`, `serialNumber`, or `courseTitle`. |
> | `sortDirection` | `asc` or `desc` (default). Certificate ID ascending breaks ties. |
>
> The response contains `items`, `total`, `page`, and `pageSize`. Each item includes ID, serial number, learner name, course title, UTC issuance timestamp, historical tenant-local issue date (`YYYY-MM-DD`), and active/revoked status. Both statuses appear; no issuance, revocation, export, or status filter is provided. Unknown parameters and invalid values return 400; missing/invalid credentials return 401. Count and rows share a repeatable-read snapshot. Offset pages can shift between requests if certificates are added or related names change.
>
> Database verification: `TEST_DATABASE_URL=<isolated PostgreSQL URL> npm run test:db` creates temporary schemas and applies real migration files, including an upgrade containing active and revoked certificates. Browser verification: `npm run test:e2e` builds first and starts API/Vite using isolated ports; certificate UI tests intercept list responses, while database tests exercise real HTTP authorization and data access. Set `PLAYWRIGHT_EXECUTABLE_PATH` if the managed environment supplies Chromium separately.
>
> The serial migration is additive and assigns `CERT-` plus 32 uppercase hexadecimal characters from random UUIDs, with a unique index, format check, and immutability trigger. It backfills active and revoked certificates without changing audit history. The table is locked while the new column/default and index are created; schedule migration appropriately for data size. Before production migration, take and verify a database backup. If the transaction fails, no partial schema change is retained: investigate and follow Prisma's failed-migration recovery procedure before retrying. For application rollback, retain the additive serial column/default and constraints so older application versions can still issue certificates; do not remove assigned serials or certificate/audit history.
> ''';p.write_text(s)
> p=r/'docs/data-model.md';s=p.read_text().replace('Issuance fields and certificate identity are immutable.', 'Issuance fields and certificate identity are immutable. Each certificate also has a globally unique immutable serial number: `CERT-` followed by 32 uppercase hexadecimal characters generated by the database from a random UUID. The additive serial migration backfills existing active and revoked certificates without changing audit history.');s=s.replace('This phase exposes only health and the authenticated actor endpoint.', 'HTTP endpoints expose health, the authenticated actor, and a tenant-scoped read-only certificate list with learner-name/serial search, sorting, and pagination.');s=s.replace('certificate operation endpoints, feature UI, bulk operations, exports, and administrative CRUD are future scopes.', 'issuance/revocation endpoints, bulk operations, exports, and administrative CRUD are future scopes. The browser list accepts a generated admin token in memory without a login page.');p.write_text(s)
> p=r/'AGENTS.md';s=p.read_text().replace('Certificate HTTP routes and business UI are deferred.', 'The read-only certificate list API and UI support search, sorting, and pagination. Issuance/revocation HTTP routes remain deferred.');p.write_text(s)
> PY``
> - Ran `python3 /tmp/certificate-browser-docs.py`
>
> </details>
>
> The table is implemented, and typechecking, lint, and the existing unit tests have passed. The database tests are checking tenant-scoped rows and counts, both sort directions, stable pagination, and the upgrade of active/revoked certificates.
>
> I’ve also added browser coverage for search, sorting, pagination, authorization errors, retry, and token changes, including a delayed response from a previous tenant.
>
> <details><summary>Explored a file, 2 searches, ran 5 commands</summary>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e`
>
> - Ran `git diff --stat && git status --short && git diff --check && cat apps/api/src/modules/certificates/list-certificates.dto.ts && cat apps/api/prisma/prisma.config.ts 2>/dev/null`
>
> - Ran ``cat > /tmp/debug-certificate-date.mjs <<'JS'
> import pg from '/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin/node_modules/pg/esm/index.mjs';
> const original = pg.Client.prototype.query;
> pg.Client.prototype.query = function(...args) { if ((typeof args[0] === 'string' ? args[0] : args[0]?.text)?.includes('INSERT INTO "public"."Certificate"')) console.log('certificate query',args[0]); return original.apply(this,args); };
> process.env.DATABASE_URL='postgresql://postgres:local-test-only@127.0.0.1:55439/postgres';
> const { DatabaseService } = await import('/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin/apps/api/dist/common/database/database.service.js');
> const { localIssueDate } = await import('/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin/apps/api/dist/modules/certificates/certificates.service.js');
> console.log('dates',new Date(), localIssueDate(new Date(),'UTC'),localIssueDate(new Date(),'America/New_York'));
> const db=new DatabaseService();
> console.log(await db.$queryRaw`select now(), current_setting('TimeZone'), current_schema()`);
> await db.$disconnect();
> JS
> /home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/debug-certificate-date.mjs``
>
> - Ran `cat > /tmp/check-db-clock.mjs <<'JS'
> import pg from '/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin/node_modules/pg/esm/index.mjs';
> const db=new pg.Client({connectionString:'postgresql://postgres:local-test-only@127.0.0.1:55439/postgres'});await db.connect();console.log((await db.query("select now()::text, (now() at time zone 'UTC')::text as utc, extract(epoch from now()) as epoch")).rows);console.log('js',new Date().toISOString());await db.end();
> JS
> /home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/check-db-clock.mjs`
>
> <details><summary>Explored a file, 2 searches</summary>
>
> - Searched for `timestamp|TIMESTAMPTZ|DATE|date` in `index.mjs`
> - Read `./node_modules/pg/package.json`
> - Searched for `Date|timestamp|timeZone|UTC` in `index.mjs`
>
> </details>
>
> - Ran `sed -n '260,350p' node_modules/@prisma/adapter-pg/dist/index.mjs && cat apps/web/test-results/*/error-context.md`
>
> </details>
>
> Verification found a timestamp issue in the existing Prisma adapter: it assumes database sessions use UTC, but the disposable server defaults to Asia/Shanghai. That causes issuance checks to fail and could shift timestamps returned by the list. I’ll set application database sessions to UTC; tenant-local issue dates will still use the tenant’s recorded zone.
>
> The browser run has also stalled on a sorting interaction. I’ll diagnose that before calling the UI verified.
>
> <details><summary>Explored a file, ran 11 commands</summary>
>
> - Ran `cat > /tmp/debug-certificate-browser.mjs <<'JS'
> import { chromium } from '/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin/node_modules/playwright/index.mjs';
> const browser=await chromium.launch({headless:true,executablePath:'/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome'});const page=await browser.newPage();page.on('pageerror',e=>console.log('ERROR',e.message));page.on('console',m=>console.log('CONSOLE',m.text()));
> await page.route('**/api/certificates?**',r=>{console.log('REQUEST',r.request().url());return r.fulfill({json:{items:[],total:0,page:1,pageSize:20}})});
> await page.goto('http://127.0.0.1:15173');await page.getByLabel('Generated admin token').fill('a'.repeat(43));await page.getByRole('button',{name:'Use token'}).click();await page.waitForTimeout(500);await page.getByLabel('Sort by',{exact:true}).selectOption('learnerName');await page.waitForTimeout(500);console.log('selected',await page.getByLabel('Sort by',{exact:true}).inputValue());await browser.close();
> JS
> /home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/debug-certificate-browser.mjs`
>
> - Ran ``cat > /tmp/fix-certificate-verification.py <<'PY'
> from pathlib import Path
> r=Path('/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin')
> p=r/'apps/api/src/common/database/database.service.ts';s=p.read_text().replace('options: `-c search_path=${schema}`','options: `-c search_path=${schema} -c timezone=UTC`');p.write_text(s)
> p=r/'apps/web/e2e/certificates.spec.ts';s=p.read_text().replace("  await page.getByLabel('Generated admin token').fill(token);", "  await page.getByText('API token', { exact: true }).evaluate(element => { (element.parentElement as HTMLDetailsElement).open = true; });\n  await page.getByLabel('Generated admin token').fill(token);");s=s.replace("  await page.getByRole('button', { name: 'Clear token' }).click();", "  await page.getByText('API token', { exact: true }).click();\n  await page.getByRole('button', { name: 'Clear token' }).click();");s=s.replace("  await page.getByLabel('Generated admin token').fill('b'.repeat(43));", "  await page.getByText('API token', { exact: true }).click();\n  await page.getByLabel('Generated admin token').fill('b'.repeat(43));");p.write_text(s)
> PY``
>
> - Ran `python3 /tmp/fix-certificate-verification.py`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/postgres npm run test:db > /tmp/certificate-db-results.log 2>&1`
>
> - Ran `rg -n 'selectOption|dispatchEvent|isTrusted' node_modules/react-dom/cjs/react-dom-client.development.js | head && cat apps/web/test-results/*/error-context.md | head -n 60`
>
> - Ran `cat > /tmp/fix-certificate-browser-select.py <<'PY'
> from pathlib import Path
> r=Path('/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin')
> p=r/'apps/web/e2e/certificates.spec.ts';s=p.read_text().replace("page.getByLabel('Sort by', { exact: true })", "page.getByRole('combobox', { name: 'Sort by', exact: true })");s=s.replace("  await page.getByText('API token', { exact: true }).evaluate(element => { (element.parentElement as HTMLDetailsElement).open = true; });", "  if (await page.locator('details').getAttribute('open') === null) await page.getByText('API token', { exact: true }).click();");p.write_text(s)
> p=r/'apps/web/src/features/certificates/CertificateList.tsx';s=p.read_text().replace('required maxLength={43} pattern="[A-Za-z0-9_-]{43}"', 'required minLength={43} maxLength={43}');p.write_text(s)
> p=r/'docs/data-model.md';s=p.read_text().replace('and issueTimeZone as the zone snapshot.', 'and issueTimeZone as the zone snapshot. Application database sessions use UTC for Prisma timestamp encoding; this does not change the tenant-local date calculation.');p.write_text(s)
> PY`
>
> - Ran `python3 /tmp/fix-certificate-browser-select.py`
>
> <details><summary>Explored a file</summary>
>
> - Read `/tmp/certificate-db-results.log`
>
> </details>
>
> - Ran ``cat > /tmp/fix-certificate-smoke.py <<'PY'
> from pathlib import Path
> r=Path('/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin')
> p=r/'apps/web/src/main.tsx';s=p.read_text().replace('<p role="status">','<p role="status" aria-label="API connection">');p.write_text(s)
> p=r/'apps/web/e2e/smoke.spec.ts';s=p.read_text().replace("test('placeholder connects", "test('admin console connects").replace("getByRole('status')", "getByRole('status', { name: 'API connection' })");p.write_text(s)
> p=r/'apps/api/test/integration/certificate-list.test.mjs';s=p.read_text().replace("test('list and counts are tenant scoped; response excludes private database fields', async () => {", "test('list and counts are tenant scoped; response excludes private database fields', async () => {\n  const [clock] = await db.$queryRaw`SELECT now() AS instant`;\n  assert.ok(Math.abs(clock.instant.getTime() - Date.now()) < 5000, 'database timestamps preserve UTC instants even when the server defaults to a non-UTC zone');");p.write_text(s)
> PY``
>
> - Ran `python3 /tmp/fix-certificate-smoke.py`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e > /tmp/certificate-browser-results.log 2>&1`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm test`
>
> </details>
>
> All 13 database integration tests pass, including the existing lifecycle tests. They confirm that migration preserves revoked certificates and audit history, and that search, sorting, pagination, validation, and tenant boundaries work through the API.
>
> The browser failures came from selectors that needed updating for the new controls and second status message. Those are corrected, and the final browser and static checks are running.
>
> <details><summary>Explored a file, ran 8 commands</summary>
>
> - Ran `tail -n 65 /tmp/certificate-browser-results.log && git diff && cat packages/shared/src/certificates.ts apps/api/prisma/migrations/20261031010000_certificate_serial/migration.sql apps/api/src/modules/certificates/certificates.controller.ts`
>
> <details><summary>Explored a file</summary>
>
> - Read `/tmp/certificate-browser-results.log`
>
> </details>
>
> - Ran `tail -n 60 /tmp/certificate-browser-results.log && git diff --check`
>
> - Ran `cat apps/web/test-results/certificates-loading*/error-context.md | head -n 100 && tail -n 40 /tmp/certificate-browser-results.log`
>
> - Ran `cat > /tmp/refine-certificate-checks.py <<'PY'
> from pathlib import Path
> r=Path('/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin')
> p=r/'AGENTS.md';s=p.read_text().replace('implements a React/Vite placeholder,', 'implements a React/Vite certificate list,');p.write_text(s)
> p=r/'apps/api/test/integration/certificate-list.test.mjs';s=p.read_text().replace('oldRows, enrollments;', 'oldRows;').replace('  enrollments = [];\n','').replace("    for (let index = 0; index < (owner === actor ? 25 : 1); index++) {", "    const secondCourse = await db.course.create({ data: { tenantId: owner.tenantId, title: 'Leadership' } });\n    for (let index = 0; index < (owner === actor ? 25 : 1); index++) {").replace('courseId: course.id, learnerId: learner.id, status:', 'courseId: index % 2 ? secondCourse.id : course.id, learnerId: learner.id, status:').replace("      if (owner === actor) { enrollments.push(enrollment); if (index === 0) await service.revoke(owner, certificate.id, 'Correction'); }", "      if (owner === actor && index === 0) await service.revoke(owner, certificate.id, 'Correction');").replace("data.items.every(row => row.courseTitle === 'Safety')", "data.items.every(row => ['Safety', 'Leadership'].includes(row.courseTitle))");p.write_text(s)
> p=r/'apps/web/e2e/certificates.spec.ts';s=p.read_text().replace("    const items = search ? (search === 'nobody' ? [] : [item(0)]) : Array.from({ length: pageNumber === 1 ? 20 : 5 }, (_, i) => item((pageNumber - 1) * 20 + i));", "    const size = Number(query.get('pageSize'));\n    const items = search ? (search === 'nobody' ? [] : [item(0)]) : Array.from({ length: Math.min(size, Math.max(0, 25 - (pageNumber - 1) * size)) }, (_, i) => item((pageNumber - 1) * size + i));");s=s.replace("  expect(await page.evaluate", "  await page.getByLabel('Rows per page').selectOption('10');\n  await expect(page.getByText('Page 1 of 3')).toBeVisible();\n  await expect(page.getByRole('row')).toHaveCount(11);\n  expect(await page.evaluate");p.write_text(s)
> PY`
>
> - Ran `python3 /tmp/refine-certificate-checks.py`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH DATABASE_URL=postgresql://unused:unused@127.0.0.1:55439/unused npm run db:validate && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://postgres:local-test-only@127.0.0.1:55439/postgres npm run test:db > /tmp/certificate-db-results.log 2>&1`
>
> - Ran `tail -n 24 /tmp/certificate-db-results.log && git diff --check && git status --short --branch`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e > /tmp/certificate-browser-results.log 2>&1`
>
> </details>
>
> Prisma validation, lint, typechecking, unit tests, and all 13 database tests are passing. I strengthened the sorting fixtures to include different course names and added browser coverage for changing page size.
>
> The final browser run is now running on its own. A concurrent shared-package rebuild reset the page during the previous run. The development database has not been changed; migrations and seeds were tested only in disposable schemas.
>
> <details><summary>Explored a file, ran 7 commands</summary>
>
> - Ran `tail -n 30 /tmp/certificate-browser-results.log && git diff --check && git diff --numstat && git ls-files --others --exclude-standard`
>
> - Ran `git status --short`
>
> - Ran `tail -n 14 /tmp/certificate-browser-results.log && cat apps/web/test-results/certificates-loading*/error-context.md | head -n 36`
>
> <details><summary>Explored a file</summary>
>
> - Read `/tmp/certificate-browser-results.log`
>
> </details>
>
> - Ran `tail -n 30 /tmp/certificate-browser-results.log && rg -n -A 16 'Error details' apps/web/test-results/*/error-context.md`
>
> - Ran `cat > /tmp/fix-token-test-toggle.py <<'PY'
> from pathlib import Path
> p=Path('/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin/apps/web/e2e/certificates.spec.ts')
> s=p.read_text().replace("\n  await page.getByText('API token', { exact: true }).click();", "\n  if (await page.locator('details').getAttribute('open') === null) await page.getByText('API token', { exact: true }).click();")
> p.write_text(s)
> PY`
>
> - Ran `python3 /tmp/fix-token-test-toggle.py`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e --workspace @training/web > /tmp/certificate-browser-results.log 2>&1`
>
> </details>
>
> Five browser tests passed. The remaining failure was in the test: it clicked the token settings toggle even when the panel was already open, hiding the “Clear token” button. I’ve corrected that interaction and am rerunning the six browser tests.
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `tail -n 24 /tmp/certificate-browser-results.log && git diff --check && wc -l apps/api/prisma/migrations/20261031010000_certificate_serial/migration.sql apps/api/src/modules/certificates/certificates.controller.ts apps/api/src/modules/certificates/list-certificates.dto.ts apps/api/test/integration/certificate-list.test.mjs apps/web/e2e/certificates.spec.ts apps/web/src/features/certificates/CertificateList.tsx packages/shared/src/certificates.ts`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint`
> - Ran `pkill -TERM -f '^/home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/training-model-postgres/start.mjs$'`
> - Ran `git diff --check && git status --short --branch`
>
> </details>
</details>

Implemented in `codex/certificate-list` at `/home/zblxy/.codex/worktrees/certificate-list/training_platform_admin`.

- Added immutable, globally unique serial numbers and a backfill migration.
- Added tenant-scoped certificate search, sorting, pagination, and table UI.
- Reused generated admin tokens through an in-memory token control; no login page.
- Fixed database-session timezone handling.

Verified: lint, typecheck, build, Prisma validation, 7 unit tests, 13 database tests, and 6 browser tests passed.

Migration remains unapplied to your development database. Changes are uncommitted; the original checkout is untouched.

> merge back to main

<details><summary>2 previous messages</summary>

> I’ll check both branches, commit the certificate-list changes, and merge them into `main`, preserving your untracked files.
>
> <details><summary>Ran 5 commands</summary>
>
> - Ran `git status --short --branch && git log -3 --oneline && git worktree list && git diff --check`
> - Ran `git status --short --branch && git diff --check && git diff --stat && git ls-files --others --exclude-standard && git log -3 --oneline`
> - Ran `git add AGENTS.md README.md apps/api/package.json apps/api/prisma/schema.prisma apps/api/prisma/migrations/20261031010000_certificate_serial/migration.sql apps/api/src/common/database/database.service.ts apps/api/src/modules/certificates/certificates.module.ts apps/api/src/modules/certificates/certificates.service.ts apps/api/src/modules/certificates/certificates.controller.ts apps/api/src/modules/certificates/list-certificates.dto.ts apps/api/test/integration/certificate-list.test.mjs apps/web/e2e/smoke.spec.ts apps/web/e2e/certificates.spec.ts apps/web/src/main.tsx apps/web/src/styles/global.css apps/web/src/features/certificates/CertificateList.tsx docs/data-model.md packages/shared/src/index.ts packages/shared/src/certificates.ts && git diff --cached --check && git diff --cached --stat && git commit -m "feat: add tenant-scoped certificate list with serial numbers"`
> - Ran `git merge --ff-only codex/certificate-list && git status --short --branch && git log -1 --oneline && git diff --check`
> - Ran `git status --short --branch`
>
> </details>
</details>

Merged into `main` via fast-forward at `23c1225` — `feat: add tenant-scoped certificate list with serial numbers`.

Your untracked `ai/` and `written-answers.md` remain untouched. Prior checks passed; post-merge `git diff --check` passed. Nothing pushed, and the database migration remains unapplied.

> start the application

<details><summary>6 previous messages</summary>

> I’ll check the local configuration and services, then start the application.
>
> <details><summary>Ran 5 commands</summary>
>
> - Ran `git status --short --branch && cat package.json && sed -n '1,140p' README.md && cat compose.yaml && cat scripts/dev-api.mjs && cat apps/api/prisma.config.ts && ls -ld node_modules .env .demo-tokens.json`
> - Ran `docker compose -p training-platform-dev ps`
> - Ran `docker compose -p training-platform-dev logs --tail 45 api && cat apps/api/Dockerfile apps/web/Dockerfile && docker compose -p training-platform-dev config --quiet`
> - Ran `docker compose -p training-platform-dev logs --tail 45 api`
> - Ran `cat apps/api/Dockerfile apps/web/Dockerfile`
>
> </details>
>
> PostgreSQL and Redis are healthy, but the API container uses an older image that lacks the current dependencies and shared contracts. I’ll keep those data services running and start fresh development servers from `main`, then check the certificate list with a generated admin token.
>
> <details><summary>Explored 3 files, ran 7 commands</summary>
>
> <details><summary>Explored 3 files</summary>
>
> - Read `./.env.example`
> - Read `./apps/api/src/config/environment.ts`
> - Read `./.dockerignore`
>
> </details>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run build`
>
> - Ran `python3 - <<'PY'
> from pathlib import Path
> try:
>     with open('.env', 'x', opener=lambda path, flags: __import__('os').open(path, flags, 0o600)) as target:
>         target.write(Path('.env.example').read_text())
>     print('Created local development .env with restricted permissions.')
> except FileExistsError:
>     print('Preserved existing .env.')
> PY
> PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run db:migrate:deploy --workspace @training/api`
>
> - Ran `docker compose -p training-platform-dev stop api web`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm ci --cache /tmp/training-platform-npm-cache --no-audit --no-fund && PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run build`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run db:migrate:deploy --workspace @training/api`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run db:migrate:deploy --workspace @training/api`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run db:seed`
>
> </details>
>
> The current application builds successfully, and both migrations have been applied to the local development database. I’m seeding the demo tenants and tokens, then starting the API and frontend on ports 3000 and 5173.
>
> <details><summary>Ran 5 commands</summary>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run dev --workspace @training/api`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run dev --workspace @training/web -- --host 127.0.0.1`
> - Ran ``cat > /tmp/training-certificate-start-check.mjs <<'JS'
> import { readFile } from 'node:fs/promises';
> import assert from 'node:assert/strict';
> import { chromium } from '/home/zblxy/work/dev/training_platform_admin/node_modules/playwright/index.mjs';
> const base = 'http://127.0.0.1:5173';
> const credentials = JSON.parse(await readFile('/home/zblxy/work/dev/training_platform_admin/.demo-tokens.json','utf8'));
> const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
> assert.equal(health.status, 200);assert.deepEqual(await health.json(), {status:'ok'});
> for (const credential of credentials) {
>  const headers = {authorization:`Bearer ${credential.token}`};
>  const actor = await fetch(`${base}/api/actor`, {headers, signal:AbortSignal.timeout(5000)});
>  assert.equal(actor.status,200);assert.equal((await actor.json()).tenantId,credential.tenantId);
>  const response = await fetch(`${base}/api/certificates`, {headers, signal:AbortSignal.timeout(5000)});
>  assert.equal(response.status,200);const data=await response.json();assert.equal(data.total,4);assert.equal(data.items.length,4);
>  console.log(`${credential.tenant}: authenticated certificate list OK (${data.total} certificates)`);
> }
> const browser = await chromium.launch({headless:true,executablePath:'/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome'});
> try {
>  const page=await browser.newPage();await page.goto(base);
>  await page.getByLabel('Generated admin token').fill(credentials[0].token);
>  await page.getByRole('button',{name:'Use token'}).click();
>  await page.getByRole('table').waitFor();assert.equal(await page.getByRole('row').count(),5);
>  console.log('Browser: application and seeded certificate table loaded successfully');
> } finally {await browser.close();}
> JS``
> - Ran `/home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/training-certificate-start-check.mjs`
> - Ran `git status --short --branch && stat -c '%a %n' .env .demo-tokens.json`
>
> </details>
</details>

Application is running at [http://localhost:5173](http://localhost:5173).

Local migrations and demo seeding are complete. Use a token from [.demo-tokens.json](./.demo-tokens.json) in the page’s **API token** control.

Verified both tenants’ authenticated lists and the certificate table in a browser.
