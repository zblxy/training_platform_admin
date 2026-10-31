# Plan project data model

> I want to design and implement the data model of this project first. from now on, use plan mode. Inspect the relevant files, ask clarifying questions if needed, then propose the implementation plan before writing code.

<details><summary>2 previous messages</summary>

> I’ll inspect the schema, project notes, and configuration, then identify any requirements we need to clarify. I’ll keep this turn to planning and wait for your approval before writing code.
>
> <details><summary>Explored 2 lists, ran 5 commands</summary>
>
> - Ran `git status --short`
>
> - Ran `cat ai/sessions/init_project written-answers.md`
>
> <details><summary>Explored a list</summary>
>
> - Listed files
>
> </details>
>
> - Ran `cat written-answers.md tsconfig.base.json apps/api/Dockerfile`
>
> - Ran `cat apps/api/prisma/schema.prisma apps/api/prisma.config.ts apps/api/package.json package.json apps/api/src/app.module.ts packages/shared/src/index.ts`
>
> - Ran `cat AGENTS.md README.md`
>
> <details><summary>Explored a list</summary>
>
> - Listed files
>
> </details>
>
> </details>
</details>

I’ll follow a planning-only workflow and wait for your approval before writing code.

I inspected the Prisma schema/configuration, API module, package scripts, Dockerfile, README, and project notes. The schema has no models, migrations, or database client integration. Your earlier notes describe a multi-tenant training console for reviewing completions, issuing/revoking certificates, and exporting data.

Before designing the schema, please clarify:

1. **Scope:** Is that still the intended scope? Should this first implementation include tenants, users/memberships, learners, courses, completions, certificates, and audit records?
2. **Identity and tenancy:** Are learners separate from admin users? Can an admin or learner belong to multiple tenants? Which admin roles are needed?
3. **Courses and completions:** Are these managed locally or imported from another platform? Can a learner complete the same course multiple times, and what makes a completion eligible for certification?
4. **Certificates:** Can a completion have multiple certificates through reissuance? Do certificates expire? Should revocation preserve the original certificate and record its reason and actor?

My proposed sequence is:

1. Resolve these requirements.
2. Present the entity diagram, fields, relationships, tenant boundaries, uniqueness rules, and lifecycle constraints for review.
3. Obtain approval for the concrete implementation plan.
4. Implement the Prisma models, reviewed initial migration, client tooling, and database integration tests.
5. Verify migrations and constraints against an isolated PostgreSQL database; update documentation and run relevant checks.

No files were changed. Your untracked project notes remain untouched.

> first, branch out a new codex worktree for data model

<details><summary>4 previous messages</summary>

> I’ll check the existing branches and worktrees, then create a worktree for the data model work.
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `git status --short --branch`
> - Ran `git worktree list`
> - Ran `git branch --list`
> - Ran `git log -1 --oneline`
>
> </details>
>
> The checkout is on `main` at `1b83168`. I’ll use the OpenAI docs skill to check Codex’s worktree setup, then create `codex/data-model` from that commit.
>
> <details><summary>Ran 5 commands, searched the web</summary>
>
> <details><summary>Explored a file</summary>
>
> - Read `~/.codex/skills/.system/openai-docs/SKILL.md`
>
> </details>
>
> - Ran `codex --help`
>
> Searched the web for `Codex worktrees`
>
> Searched the web for `https://developers.openai.com/blog/mastering-codex-remote-for-engineering`
>
> - Ran `git worktree add -b codex/data-model /home/zblxy/.codex/worktrees/data-model/training_platform_admin main`
>
> - Ran `git status --short --branch`
>
> - Ran `git status --short --branch`
>
> - Ran `git worktree list`
>
> </details>
</details>

Created a clean worktree from `main` (`1b83168`):

- Branch: `codex/data-model`
- Path: [/home/zblxy/.codex/worktrees/data-model/training_platform_admin](~/.codex/worktrees/data-model/training_platform_admin)

Your original checkout and untracked notes are unchanged. Data model work will remain planning-only until you approve implementation.

> I will provide data model design:
> Tenant: each tenant has at least one admin
> admin: actor can do certificate operations under the tenant
> course: each tenant contains several admins
> learner: each course contain several learners, learners to this course's status includes completed, incomplete, certified
> certificate: can be issued to eligible learners by admin
>
> note: No login UI is needed in this demo project, Seed one admin per tenant and identify the actor with a generated bearer token

<details><summary>2 previous messages</summary>

> I’ll use this as the starting design and review the data-model worktree before proposing an implementation plan. The bearer-token requirement adds API actor identification to the scope; I’ll include it in the plan.
>
> <details><summary>Ran 2 commands</summary>
>
> - Ran `git status --short --branch`
> - Ran `cat AGENTS.md apps/api/prisma/schema.prisma apps/api/package.json apps/api/src/app.ts apps/api/src/app.module.ts`
>
> </details>
</details>

The data-model worktree is clean, and no code has changed.

I recommend the following structure:

| Model | Purpose |
|---|---|
| `Tenant` | Owns admins, courses, and learners; must retain at least one admin. |
| `Admin` | Belongs to a tenant and acts on its certificates. |
| `Course` | Belongs to a tenant. |
| `Learner` | Belongs to a tenant and can enroll in courses. |
| `Enrollment` | Connects a learner to a course and tracks completion. |
| `Certificate` | References an enrollment and the admin who issued it. |
| `AdminToken` | Identifies the admin through a generated bearer token; stores only its hash. |

Putting status on `Enrollment` lets a learner have different statuses for different courses. I recommend storing `incomplete`/`completed` there and deriving `certified` from the certificate, avoiding conflicting records.

Please clarify these points before I finalize the implementation plan:

1. **Course ownership:** You wrote “course: each tenant contains several admins.” Did you mean each tenant contains several **courses**, with admins operating across their tenant’s courses?
2. **Eligibility:** Is a completed enrollment the only requirement for certificate issuance?
3. **Multiplicity:** Can learners enroll in multiple courses? Can they repeat a course, or should there be one enrollment per learner/course?
4. **Certificate lifecycle:** For this stage, is issuance alone required, or should the model support revocation and reissuance?
5. **Demo data:** May I seed two tenants with one admin each, sample courses, and learners in each status? Two tenants would let us verify tenant isolation.

After those answers, I’ll propose the exact fields, constraints, token behavior, migration/seed work, and verification steps for approval. No login UI will be included.

> 1. yes
> 2. yes, only if the learner to a course's status is completed, the learner can be issued a certificate
> 3. learners can enroll in multiple courses
> 4. model should support revocation, but not reissuance.&#x20;
> 5. &#x20;sure you can.
> 6. &#x20;AdminToken should not be a dedicated model
> 7. new constrains with certificate issuance:  need to record tenant-local issue date.&#x20;
> 8. Audit model: audit both issuance and revocation. Each eligible learner receives at most one certificate.Each actual issuance has exactly one audit event.

The proposed design is below. One remaining decision is how to determine the tenant-local issue date.

| Model | Main fields and rules |
|---|---|
| `Tenant` | ID, name, IANA time zone; owns admins, courses, and learners. |
| `Admin` | ID, tenant ID, name, unique bearer-token hash. No separate token model. |
| `Course` | ID, tenant ID, title. |
| `Learner` | ID, tenant ID, name, email. |
| `Enrollment` | ID, tenant ID, course ID, learner ID, completion status, completion timestamp. Unique learner/course pair. |
| `Certificate` | ID, tenant ID, unique enrollment ID, issuing admin ID, issuance timestamp, tenant-local issue date, time-zone snapshot, optional revocation timestamp/admin/reason. |
| `AuditEvent` | ID, tenant ID, certificate ID, actor admin ID, action (`ISSUED` or `REVOKED`), timestamp. Unique certificate/action pair. |

Proposed behavior:

- Only a completed enrollment can receive a certificate.
- One certificate per learner/course enrollment, permanently. Revocation preserves it and prevents reissuance.
- Display status is `incomplete`, `completed`, or `certified`. After revocation, display `completed` with the revoked certificate visible separately.
- Issuance creates the certificate and its audit event in one transaction. Repeated or concurrent requests return the existing certificate without creating another audit event.
- Revocation updates the certificate and creates one revocation audit event atomically. Repeated revocations create no additional events.
- Tenant-scoped foreign keys prevent relationships across tenants. Tenant creation includes an admin in the same transaction; removing the last admin is prohibited.
- Seed-generated bearer tokens identify admins. Store only their hashes and write raw demo tokens to an ignored local file.

**Date proposal:** Store a time zone on each tenant, derive the issue date server-side at issuance, and preserve that date plus the time zone used. Do you agree, or should admins explicitly select an issue date? For demo tenants, I suggest `Asia/Shanghai` and `America/New_York`.

Once that is resolved, the implementation plan is:

1. Add Prisma models and a reviewed initial SQL migration, including tenant boundaries, uniqueness constraints, and database enforcement of exactly one issuance audit per certificate.
2. Add Prisma client integration and transactional issuance/revocation services. Add bearer-token actor identification; expose a minimal authenticated actor endpoint for verification.
3. Add a repeatable demo seed with two tenants, one admin each, courses, enrollments, and certificates covering the agreed states.
4. Add isolated database tests for eligibility, concurrency, audit consistency, revocation, tenant isolation, and local-date boundaries.
5. Update build/container tooling and documentation; run schema validation, lint, typecheck, build, existing tests, and database integration tests.

Please confirm the date behavior and approve this plan, including the proposed status after revocation. No code has been written.

> confirmed

<details><summary>10 previous messages</summary>

> I’ll implement the approved model, transactional certificate services, bearer-token identification, and demo seed in `codex/data-model`, then verify the constraints against an isolated database.
>
> <details><summary>Created a file, explored a list, ran 6 commands, searched the web</summary>
>
> - Ran `cat apps/api/tsconfig.json apps/api/tsconfig.tools.json apps/api/prisma.config.ts .gitignore apps/api/src/common/filters/http-error.filter.ts apps/api/src/config/environment.ts`
>
> <details><summary>Explored a list</summary>
>
> - Listed files in `training-model-postgres`
>
> </details>
>
> - Ran `cat apps/api/Dockerfile scripts/dev-api.mjs`
>
> Searched the web for `site.prisma.io docs prisma 7 adapter pg prisma-client-js`
>
> - Ran `cat eslint.config.mjs apps/api/test/smoke.test.mjs /tmp/training-model-postgres/start.mjs`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm install @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg --workspace @training/api --cache /tmp/training-platform-npm-cache --no-audit --no-fund`
>
> - Ran `mkdir -p /tmp/data-model-build`
>
> - Ran `docker compose -p training-platform-dev ps`
>
> - Wrote `/tmp/data-model-build/write.py` (+219 -0)
>
> </details>
>
> I’m putting eligibility, tenant boundaries, and audit creation in the database as well as the services. Database triggers will create each issuance or revocation audit event in the same transaction, including when data is written outside the API.
>
> <details><summary>Created 2 files, explored a search, ran 10 commands</summary>
>
> - Ran `python3 /tmp/data-model-build/write.py`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run db:validate`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output /tmp/data-model-build/base.sql`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck`
>
> - Wrote `/tmp/data-model-build/constraints.sql` (+109 -0)
>
> - Ran `python3 - <<'PY'
> from pathlib import Path
> p=Path('/home/zblxy/.codex/worktrees/data-model/training_platform_admin/apps/api/prisma/schema.prisma')
> s=p.read_text().replace('  @@index([tenantId, issuedAt])','  @@unique([tenantId, enrollmentId])\n  @@index([tenantId, issuedAt])');p.write_text(s)
> PY`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output /tmp/data-model-build/base.sql`
>
> <details><summary>Explored a search</summary>
>
> - Searched for `constructor|schema` in `index.d.ts`
>
> </details>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck`
>
> - Ran `/home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/training-model-postgres/start.mjs`
>
> - Ran `docker run --rm --name training-data-model-test -e POSTGRES_PASSWORD=isolated-test-only -p 127.0.0.1:55440:5432 -d postgres:17.6-bookworm`
>
> - Wrote `/tmp/data-model-build/finish.py` (+182 -0)
>
> - Ran `python3 /tmp/data-model-build/finish.py`
>
> </details>
>
> The models, migration, and services are in place. I’m now testing concurrent issuance/revocation, direct database writes, tenant isolation, and local-date handling. The new backend types compile; the full typecheck found missing frontend dependencies in this fresh worktree, so I’m fixing the dependency installation before continuing.
>
> <details><summary>Created 2 files, explored a file, ran 11 commands</summary>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm ci --cache /tmp/training-platform-npm-cache --no-audit --no-fund`
>
> - Ran `cat .dockerignore apps/web/Dockerfile apps/web/playwright.config.ts`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://postgres:isolated-test-only@127.0.0.1:55440/postgres npm run test:db`
>
> - Wrote `/tmp/data-model-build/polish.py` (+15 -0)
>
> - Ran `python3 /tmp/data-model-build/polish.py`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://postgres:isolated-test-only@127.0.0.1:55440/postgres npm run test:db`
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint`
>
> - Ran `git diff --stat`
>
> - Ran `head -35 /tmp/data-model-build/base.sql`
>
> <details><summary>Explored a file</summary>
>
> - Read `./apps/api/src/common/database/database.service.ts`
>
> </details>
>
> - Ran ``python3 - <<'PY'
> from pathlib import Path
> r=Path('/home/zblxy/.codex/worktrees/data-model/training_platform_admin')
> p=r/'apps/api/src/common/database/database.service.ts';s=p.read_text();start=s.index('    super(');end=s.index('\n',start);s=s[:start]+'''    const schema = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).searchParams.get('schema') ?? 'public' : 'public';
>     if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error('Invalid database schema');
>     super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 3000, options: `-c search_path=${schema}` }, { schema }) });'''+s[end:];p.write_text(s)
> p=r/'apps/api/prisma/migrations/20261031000000_initial_data_model/migration.sql';s=p.read_text().replace('LANGUAGE plpgsql AS', 'LANGUAGE plpgsql SET search_path FROM CURRENT AS');p.write_text(s)
> PY``
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://postgres:isolated-test-only@127.0.0.1:55440/postgres npm run test:db`
>
> - Wrote `/tmp/data-model-build/docs.py` (+73 -0)
>
> - Ran `python3 /tmp/data-model-build/docs.py`
>
> </details>
>
> The PostgreSQL 17 tests now pass for concurrent issuance and revocation, database constraints, bearer authentication, and repeatable seeding. They also caught a schema-resolution issue in the triggers, which I fixed. I’m finishing the full checks and verifying that the API image can apply migrations and run the seeded workflow.
>
> <details><summary>Created a file, ran 18 commands</summary>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm test`
> - Ran `docker build -f apps/api/Dockerfile --target runtime -t training-data-model-api .`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run test:config`
> - Ran `git diff -- apps/api/package.json apps/api/prisma.config.ts apps/api/src/app.module.ts apps/api/Dockerfile`
> - Wrote `/tmp/data-model-build/extra-tests.py` (+25 -0)
> - Ran `python3 /tmp/data-model-build/extra-tests.py`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://postgres:isolated-test-only@127.0.0.1:55440/postgres npm run test:db`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run db:validate`
> - Ran `git diff --check`
> - Ran `docker run --rm --network host -e DATABASE_URL=postgresql://postgres:isolated-test-only@127.0.0.1:55440/postgres training-data-model-api npm run db:migrate:deploy --workspace @training/api`
> - Ran `docker run --rm -d --name training-data-model-api-check --network host -e DATABASE_URL=postgresql://postgres:isolated-test-only@127.0.0.1:55440/postgres -e REDIS_URL=redis://:unused@127.0.0.1:1/0 -e PORT=55441 training-data-model-api`
> - Ran `docker exec -e NODE_ENV=test -e DEMO_TOKEN_FILE=/tmp/data-model-demo-tokens.json -w /app/apps/api training-data-model-api-check node prisma/seed.mjs`
> - Ran `git status --short`
> - Ran `ps -eo pid,comm,args | rg '/tmp/training-model-postgres/start.mjs'`
> - Ran ``docker exec training-data-model-api-check node --input-type=module -e 'import assert from "node:assert/strict"; import {readFile} from "node:fs/promises"; assert.equal(process.getuid(),1000); const base="http://127.0.0.1:55441/api"; assert.equal((await fetch(`${base}/health`)).status,200); assert.equal((await fetch(`${base}/actor`)).status,401); const tokens=JSON.parse(await readFile("/tmp/data-model-demo-tokens.json","utf8")); for(const actor of tokens){ const response=await fetch(`${base}/actor`,{headers:{authorization:`Bearer ${actor.token}`}}); assert.equal(response.status,200); const body=await response.json(); assert.equal(body.id,actor.adminId); assert.equal(body.tenantId,actor.tenantId); assert.equal(Object.keys(body).length,3); } console.log("Non-root runtime, health, bearer authentication, and tenant identities verified");'``
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint`
> - Ran `ps -C node -o pid,args`
>
> </details>
>
> All seven database tests, seven unit/smoke tests, and three browser tests pass, along with lint, typecheck, build, schema validation, and production configuration checks. The API image also applied the migration successfully and served both seeded tenant identities as a non-root user. I’m reviewing the final diff and cleaning up the temporary verification services.
>
> <details><summary>Ran 7 commands</summary>
>
> - Ran `docker stop training-data-model-api-check training-data-model-test`
> - Ran `git diff --numstat`
> - Ran `python3 - <<'PY'
> from pathlib import Path
> import subprocess
> r=Path('/home/zblxy/.codex/worktrees/data-model/training_platform_admin')
> files=subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=r,text=True).splitlines()
> for name in files:
>  p=r/name
>  content=p.read_text()
>  assert '\x00' not in content
>  check=subprocess.run(['git','diff','--no-index','--check','/dev/null',str(p)],capture_output=True,text=True)
>  if check.returncode: raise RuntimeError(check.stdout+check.stderr)
> print(f'Reviewed {len(files)} new files; whitespace checks passed.')
> PY`
> - Ran `git diff --check`
> - Ran `git status --short --branch`
> - Ran `docker compose -p training-platform-dev ps`
> - Ran `python3 - <<'PY'
> from pathlib import Path
> import subprocess
> r=Path('/home/zblxy/.codex/worktrees/data-model/training_platform_admin')
> files=subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=r,text=True).splitlines()
> for name in files:
>  p=r/name
>  content=p.read_text()
>  assert '\x00' not in content
>  check=subprocess.run(['git','diff','--no-index','--check','/dev/null',str(p)],capture_output=True,text=True)
>  if check.returncode not in (0,1) or check.stdout or check.stderr: raise RuntimeError(name+check.stdout+check.stderr)
> print(f'Inspected {len(files)} new files; whitespace checks passed.')
> PY`
>
> </details>
</details>

Implemented in `codex/data-model`:

- Tenant-scoped models, eligibility constraints, local issue dates, and final revocation without reissuance.
- Atomic issuance/revocation audit events and concurrency protection.
- Bearer-token actor identification and repeatable demo seed.
- Migration, tests, and [model documentation](~/.codex/worktrees/data-model/training_platform_admin/docs/data-model.md).

Verified: lint, typecheck, build, schema/Compose validation, 7 unit tests, 7 PostgreSQL integration tests, 3 browser tests, and container migration/authentication checks.

Changes remain uncommitted. The running development database is unchanged; certificate HTTP routes and UI remain deferred.

> commit your change and merge into main.

<details><summary>2 previous messages</summary>

> I’ll review and commit the data-model changes, then merge `codex/data-model` into `main`, leaving your untracked notes untouched.
>
> <details><summary>Explored a list, ran 14 commands</summary>
>
> - Ran `git status --short --branch`
>
> - Ran `git diff --check`
>
> - Ran `git status --short --branch`
>
> - Ran `git log -3 --oneline`
>
> - Ran `git diff --stat`
>
> <details><summary>Explored a list</summary>
>
> - Listed files
>
> </details>
>
> - Ran `git diff --numstat`
>
> - Ran `git add .dockerignore .gitignore AGENTS.md README.md apps/api/Dockerfile apps/api/package.json apps/api/prisma.config.ts apps/api/prisma/schema.prisma apps/api/src/app.module.ts package-lock.json package.json apps/api/prisma/migrations apps/api/prisma/seed.mjs apps/api/src/common/database apps/api/src/modules/auth apps/api/src/modules/certificates apps/api/test/certificates.test.mjs apps/api/test/integration/models.test.mjs docs/data-model.md`
>
> - Ran `git diff --cached --check`
>
> - Ran `git diff --cached --stat`
>
> - Ran `git commit -m "feat: add tenant data model and audited certificate lifecycle"`
>
> - Ran `git merge --ff-only codex/data-model`
>
> - Ran `git status --short --branch`
>
> - Ran `git log -1 --oneline`
>
> - Ran `git status --short --branch`
>
> </details>
</details>

Committed as `21bf4da` — `feat: add tenant data model and audited certificate lifecycle` — and fast-forward merged into `main`.

Staged whitespace checks passed. Your untracked `ai/` and `written-answers.md` remain untouched. Nothing was pushed or deployed.

> prepare required demo data and demo data generate scripts. demo data should:
>
> 1. Tenant East using Australia/Sydney and West using Australia/Perth .
> 2. Admins alice@east.test and bob@west.test , each bound only to their own tenant.
> 3. Both tenants contain a course titled Safety 101 and a learner named Alex Lee .Include completed, incomplete, and already certified enrollments.
> 4. generate 100,000 certificate rows for one tenant.

<details><summary>2 previous messages</summary>

> I’ll inspect the current seed and model, then propose a plan for the demo fixtures and 100,000-certificate generator before changing code.
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `git status --short --branch`
> - Ran `cat AGENTS.md docs/data-model.md`
> - Ran `cat apps/api/prisma/seed.mjs apps/api/prisma/schema.prisma apps/api/package.json package.json`
> - Ran `cat apps/api/prisma/migrations/20261031000000_initial_data_model/migration.sql apps/api/src/modules/auth/auth.module.ts`
>
> </details>
</details>

The current seed uses different tenant names/time zones and only a few certificates. Admins have a `name` field but no email field.

Proposed plan:

1. Update the repeatable seed to create:
   - **East:** `Australia/Sydney`, admin `alice@east.test`.
   - **West:** `Australia/Perth`, admin `bob@west.test`.
   - A **Safety 101** course and **Alex Lee** learner in each tenant, plus learners covering completed, incomplete, and already certified enrollments.
   - Use the email addresses as admin names in the existing model; preserve bearer tokens and tenant isolation.

2. Add a separate bulk-generation command that brings **East to 100,000 total certificates**, including fixture certificates. Generate the required learners/enrollments in batches, with correct local issue dates, unique serials, and exactly one issuance audit per certificate.

3. Make reruns resume safely without duplicates or deleting existing certificate history. Preserve historical issue dates when updating tenant time zones.

4. Test fixture contents, repeatability, exact counts, audit consistency, and tenant isolation; document both commands.

5. Populate the local demo database and verify the generated data.

Approve this plan? Plan approval is required by [AGENTS.md](./AGENTS.md:8) before writing code.

> ok

<details><summary>6 previous messages</summary>

> I’ll update the fixtures, add the resumable bulk generator, and test both before populating the local demo database.
>
> <details><summary>Created 2 files, edited a file, ran 7 commands</summary>
>
> - Ran `cat apps/api/src/common/database/database.service.ts apps/api/test/integration/models.test.mjs apps/api/src/modules/certificates/certificates.service.ts`
> - Ran `cat compose.yaml apps/api/prisma.config.ts; rg -n 'seed|Shanghai|New York' README.md`
> - Ran `git status --short --branch; rg --files apps/api/prisma/migrations`
> - Wrote `./apps/api/prisma/demo-data.mjs` (+88 -0)
> - Wrote `./apps/api/prisma/seed-large.mjs` (+10 -0)
> - Ran `python3 - <<'PY'
> import json
> from pathlib import Path
> Path('apps/api/prisma/seed.mjs').write_text('''import { DatabaseService } from '../dist/common/database/database.service.js';
> import { requireDemoEnvironment, seedDemoData } from './demo-data.mjs';
>
> requireDemoEnvironment();
> const db = new DatabaseService();
> try {
>   await seedDemoData(db, process.env.DEMO_TOKEN_FILE ?? new URL('../../../.demo-tokens.json', import.meta.url));
>   console.log('East/West demo fixtures ready. Private bearer-token file written (mode 0600).');
> } finally { await db.$disconnect(); }
> ''')
> p=Path('apps/api/package.json');d=json.loads(p.read_text());d['scripts']['db:seed:large']='npm run build && node --env-file-if-exists=../../.env prisma/seed-large.mjs';p.write_text(json.dumps(d,indent=2)+'\n')
> p=Path('package.json');d=json.loads(p.read_text());d['scripts']['db:seed:large']='npm run build -w @training/shared && npm run db:seed:large -w @training/api';p.write_text(json.dumps(d,indent=2)+'\n')
> PY`
> - Wrote `./apps/api/test/integration/models.test.mjs` (+44 -0)
> - Ran `docker compose -p training-platform-dev ps; ls /home/zblxy/.nvm/versions/node/v24.22.1/bin/node`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run lint`
> - Ran `docker run --rm --name training-demo-seed-test -e POSTGRES_PASSWORD=isolated-test-only -p 127.0.0.1:55442:5432 -d postgres:17.6-bookworm`
>
> </details>
>
> The updated fixtures reuse the existing demo IDs, so reseeding can rename the tenants and update their time zones without replacing certificate history. The bulk generator adds certificates to East in batches with audit triggers enabled. I’m testing interrupted runs, concurrent generators, and whether West stays unchanged.
>
> <details><summary>Ran 6 commands</summary>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH TEST_DATABASE_URL=postgresql://postgres:isolated-test-only@127.0.0.1:55442/postgres npm run test:db`
> - Ran `docker compose -p training-platform-dev ps`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run typecheck`
> - Ran ````python3 - <<'PY'
> from pathlib import Path
> p=Path('README.md');s=p.read_text();s=s.replace('The seed creates two tenants (`Asia/Shanghai` and `America/New_York`), one admin per tenant, two courses per tenant, and four learners enrolled in both courses. It includes incomplete, completed, certified, and revoked examples. Rerunning preserves existing records and certificate/audit history. The seed is disabled when `NODE_ENV=production`.', '''The seed creates **East** (`Australia/Sydney`, admin `alice@east.test`) and **West** (`Australia/Perth`, admin `bob@west.test`). Admin email identifiers use the existing Admin.name field; no email schema field is added. Each admin belongs only to their own tenant. Both tenants have **Safety 101**, **Leadership**, and four learners enrolled in both courses: Jordan Smith (incomplete), Sam Taylor (completed without a certificate), Alex Lee (already certified), and Morgan Chen (revoked certificate). Existing enrollment states and certificate/audit history are preserved on reruns; fixture tenant names/time zones, admin names, course titles, and learner names are updated. Historical certificate date/zone snapshots remain unchanged. The seed is disabled when `NODE_ENV=production`.
>
> To prepare the volume demo, run:
>
> ```sh
> npm run db:seed:large
> ```
>
> This first prepares the small fixtures, then brings **East to exactly 100,000 total certificate rows**, including existing and revoked certificates. West keeps its small dataset (four certificates on a fresh database). New volume learners are enrolled in East's Safety 101, are completed, and receive one certificate and one trigger-generated issuance audit each. Certificates use database-generated unique serials and the current tenant-local issue date. Rows are generated in atomic batches of up to 1,000, with progress output and bounded batch waits. No triggers are disabled.
>
> Reruns resume committed work, preserve tokens and existing certificates, and add nothing once East has 100,000 rows. Concurrent volume generators serialize on the East tenant row. If East already exceeds the target, the script reports an error rather than deleting history. Run generation while the demo is idle so unrelated certificate writers do not change the final count. Both commands require the migrated local demo DATABASE_URL; neither runs migrations or resets the database. Token-file handling is shared between the commands.''');p.write_text(s)
> p=Path('AGENTS.md');s=p.read_text().replace('| Seed demo data explicitly (never production) | `npm run db:seed` |','| Seed demo data explicitly (never production) | `npm run db:seed` |\n| Prepare demo fixtures and bring East to 100,000 certificates | `npm run db:seed:large` |');p.write_text(s)
> PY````
> - Ran ``/home/zblxy/.nvm/versions/node/v24.22.1/bin/node --env-file=.env --input-type=module -e 'import pg from "pg"; const db=new pg.Client({connectionString:process.env.DATABASE_URL}); try {await db.connect(); const result=await db.query(`SELECT t.id,t.name,t."timeZone",(SELECT count(*)::int FROM "Certificate" c WHERE c."tenantId"=t.id) AS certificates FROM "Tenant" t ORDER BY t.name`); console.log(JSON.stringify(result.rows));} finally {await db.end();}'``
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm test`
>
> </details>
>
> All 15 database tests pass, including resume behavior, concurrent generation, audit counts, and the Australian fixtures. The local database has the original four certificates per tenant. I’ll preserve those and bring East to exactly 100,000.
>
> <details><summary>Ran 11 commands</summary>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run db:seed:large`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run build`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm test`
> - Ran `git diff --check; git diff --stat`
> - Ran `git diff -- apps/api/prisma/seed.mjs apps/api/test/integration/models.test.mjs README.md; git status --short`
> - Ran ``cat > /tmp/training-demo-verify.mjs <<'EOF'
> import assert from 'node:assert/strict';
> import {readFile, stat} from 'node:fs/promises';
> import {createApp} from '/home/zblxy/work/dev/training_platform_admin/apps/api/dist/app.js';
> import {DatabaseService} from '/home/zblxy/work/dev/training_platform_admin/apps/api/dist/common/database/database.service.js';
> const root='/home/zblxy/work/dev/training_platform_admin';
> const db=new DatabaseService();
> const app=await createApp();
> try {
>   const summaries=await db.$queryRaw`SELECT t.name,t."timeZone",(SELECT count(*)::int FROM "Certificate" c WHERE c."tenantId"=t.id) AS certificates,(SELECT count(*)::int FROM "AuditEvent" a WHERE a."tenantId"=t.id AND action='ISSUED') AS issuance_audits FROM "Tenant" t ORDER BY t.name`;
>   assert.deepEqual(summaries,[{name:'East',timeZone:'Australia/Sydney',certificates:100000,issuance_audits:100000},{name:'West',timeZone:'Australia/Perth',certificates:4,issuance_audits:4}]);
>   const [invalid]=await db.$queryRaw`SELECT count(*)::int AS count FROM "Certificate" c WHERE c."issueDate" <> (c."issuedAt" AT TIME ZONE c."issueTimeZone")::date OR (SELECT count(*) FROM "AuditEvent" a WHERE a."certificateId"=c.id AND a.action='ISSUED' AND a."tenantId"=c."tenantId" AND a."actorId"=c."issuedById" AND a."occurredAt"=c."issuedAt") <> 1`;
>   assert.equal(invalid.count,0);
>   assert.equal((await stat(`${root}/.demo-tokens.json`)).mode & 0o777,0o600);
>   const tokens=JSON.parse(await readFile(`${root}/.demo-tokens.json`,'utf8'));
>   await app.listen(0,'127.0.0.1');
>   const base=await app.getUrl();
>   for(const token of tokens){
>     const headers={authorization:`Bearer ${token.token}`};
>     const actorResponse=await fetch(`${base}/api/actor`,{headers});
>     assert.equal(actorResponse.status,200);
>     const actor=await actorResponse.json();
>     assert.equal(actor.name,token.tenant==='East'?'alice@east.test':'bob@west.test');
>     assert.equal(actor.tenantId,token.tenantId);
>     const response=await fetch(`${base}/api/certificates?page=1&pageSize=25`,{headers});
>     assert.equal(response.status,200);
>     const body=await response.json();
>     assert.equal(body.total,token.tenant==='East'?100000:4);
>     const search=await fetch(`${base}/api/certificates?search=Alex%20Lee`,{headers});
>     assert.equal(search.status,200);
>     const found=await search.json();
>     assert.equal(found.total,2);
>     assert.ok(found.items.every(row=>row.learnerName==='Alex Lee'));
>   }
>   console.log(JSON.stringify(summaries));
>   console.log('Verified local issue dates, one matching issuance audit per certificate, private tokens, tenant-scoped API counts, and Alex Lee search.');
> }finally{await app.close();await db.$disconnect();}
> EOF``
> - Ran `/home/zblxy/.nvm/versions/node/v24.22.1/bin/node --env-file=.env /tmp/training-demo-verify.mjs`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run db:seed:large`
> - Ran `git diff --check; git diff --no-index --check /dev/null apps/api/prisma/demo-data.mjs`
> - Ran `git diff --no-index --check /dev/null apps/api/prisma/seed-large.mjs`
> - Ran `docker stop training-demo-seed-test`
>
> </details>
</details>

Demo data is populated:

- **East:** `Australia/Sydney`, `alice@east.test`, **100,000 certificates**.
- **West:** `Australia/Perth`, `bob@west.test`, 4 certificates.
- Both include Safety 101, Alex Lee, and the requested enrollment states.

Commands:

```sh
npm run db:seed        # Small fixtures
npm run db:seed:large  # Fixtures + East volume data
```

Verified repeatability, tenant isolation, local dates, and one issuance audit per certificate. Lint, typecheck, build, 7 unit tests, and 15 database tests passed.

Tokens remain in `.demo-tokens.json`. Changes are uncommitted.

> commit your work and refresh the application

<details><summary>8 previous messages</summary>

> I’ll commit the demo-data changes, then rebuild and restart the local application with the prepared database.
>
> <details><summary>Ran 10 commands</summary>
>
> - Ran `cat apps/api/Dockerfile apps/web/Dockerfile`
> - Ran `git diff -- package.json apps/api/package.json AGENTS.md`
> - Ran `git status --short --branch; git diff --check; git diff --stat`
> - Ran `git add AGENTS.md README.md apps/api/package.json apps/api/prisma/seed.mjs apps/api/prisma/demo-data.mjs apps/api/prisma/seed-large.mjs apps/api/test/integration/models.test.mjs package.json`
> - Ran `git diff --cached --check`
> - Ran `git commit -m "feat: prepare Australian demo fixtures and 100k certificate generator"`
> - Ran `docker compose -p training-platform-dev up --build -d --wait`
> - Ran `cat apps/web/e2e/smoke.spec.ts apps/web/package.json`
> - Ran `git status --short --branch; git log -1 --oneline`
> - Ran `cat apps/web/src/features/certificates/*.tsx`
>
> </details>
>
> Committed as `4faf583`. The application images are rebuilding; I’ll check service health and confirm the refreshed API serves East’s 100,000 certificates and West’s smaller dataset.
>
> <details><summary>Ran a command</summary>
>
> - Ran `ss -ltnp`
>
> </details>
>
> The images built successfully, but startup hit a port conflict: processes are already using ports 3000 and 5173. I’ll identify them before restarting anything.
>
> <details><summary>Ran 4 commands</summary>
>
> - Ran `ps -p 2672840,2660310 -o pid,ppid,args`
> - Ran `readlink /proc/2672840/cwd /proc/2660310/cwd`
> - Ran `ps -p 2660497 -o pid,ppid,args`
> - Ran `curl --fail --silent --show-error http://127.0.0.1:5173/api/health`
>
> </details>
>
> Both processes belong to this project’s development servers, and the web-to-API connection is healthy. I’ll refresh the API through its existing watcher, keep the app at `localhost:5173`, and verify the seeded data there.
>
> <details><summary>Ran 5 commands</summary>
>
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH npm run build -w @training/api`
> - Ran ``cat > /tmp/training-demo-live-verify.mjs <<'EOF'
> import assert from 'node:assert/strict';
> import {readFile} from 'node:fs/promises';
> const tokens=JSON.parse(await readFile('/home/zblxy/work/dev/training_platform_admin/.demo-tokens.json','utf8'));
> const base='http://127.0.0.1:5173';
> for(let attempt=0;;attempt++){
>   try{assert.equal((await fetch(`${base}/api/health`)).status,200);break;}
>   catch(error){if(attempt===20)throw error;await new Promise(resolve=>setTimeout(resolve,250));}
> }
> for(const actor of tokens){
>   const headers={authorization:`Bearer ${actor.token}`};
>   const response=await fetch(`${base}/api/certificates?page=1&pageSize=20`,{headers});
>   assert.equal(response.status,200);
>   const body=await response.json();
>   assert.equal(body.total,actor.tenant==='East'?100000:4);
>   const search=await fetch(`${base}/api/certificates?search=Alex%20Lee`,{headers});
>   assert.equal(search.status,200);
>   assert.equal((await search.json()).total,2);
>   console.log(`${actor.tenant}: ${body.total} certificates; Alex Lee search verified`);
> }
> assert.equal((await fetch(base)).status,200);
> EOF``
> - Ran `/home/zblxy/.nvm/versions/node/v24.22.1/bin/node /tmp/training-demo-live-verify.mjs`
> - Ran `PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH E2E_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e -w @training/web`
> - Ran `git status --short --branch`
>
> </details>
</details>

Committed as `4faf583` — `feat: prepare Australian demo fixtures and 100k certificate generator`.

Refreshed the existing development app at [localhost:5173](http://localhost:5173). Verified East’s 100,000 certificates, West’s 4 certificates, Alex Lee search, and all 6 browser checks.

Your untracked notes remain untouched.
