# Project agent instructions

## Scope and workflow

These instructions apply to the entire repository. This project is an internal admin console. The user will provide feature scopes and business requirements during implementation; do not infer or prescribe them from this document.

- Inspect relevant files before proposing changes. Ask clarifying questions when a material requirement cannot be inferred.
- Propose an implementation plan and obtain user approval before writing code. Continue within an approved plan without repeatedly requesting approval; seek approval for material scope changes.
- Keep changes focused on the requested work. Preserve unrelated user changes.
- Do not commit, push, publish, or deploy unless authorized.
- Report what changed, what was verified, and any remaining limitations. Never claim an unrun check passed.

## Repository status

The repository implements a React/Vite certificate list, NestJS health and bearer-authenticated actor endpoints, tenant-scoped Prisma models, transactional certificate issuance/revocation services, database-generated audit events, a repeatable demo seed, Redis cache tooling, and container configurations. The read-only certificate list API and UI support search, sorting, and pagination. Course-based bulk issuance supports per-learner outcomes, duplicate submission prevention, and durable actor-scoped idempotency-key replay. List/detail display historical tenant-local date/time; list and CSV date sorting use the saved local calendar date. Certificate CSV export uses PostgreSQL-backed background jobs, progress polling, and authenticated downloads retained for 24 hours. Certificate detail and confirmed revocation are available through authenticated tenant-scoped HTTP routes and the browser. See docs/data-model.md for approved model invariants.

Runtime: Node.js 24.22.1 and npm 11.19.1, pinned in manifests, `.nvmrc` and Dockerfiles. Prepend `/home/zblxy/.nvm/versions/node/v24.22.1/bin` to PATH in this managed environment; do not use system Node 18.

## Technology stack

- Language: TypeScript with strict type checking.
- Frontend: React and Vite.
- Backend: NestJS with global server-side validation/error handling; bearer actor identification is implemented; future protected routes must use the actor guard and tenant scoping.
- Database: PostgreSQL, managed through Prisma schema and migrations.
- Cache: Redis with mandatory write TTLs, bounded waits, eviction, and graceful cache misses on outages. No persistence or automatic business-data caching.
- Workspace tooling: npm workspaces with a root lockfile (commit only when authorized).
- Browser verification: Playwright.
- Infrastructure and packaging: Docker and Docker Compose for local services and deployable application images.

Choose compatible dependency versions during scaffolding and record supported Node.js and npm versions. Keep development, CI, and container versions aligned.

## Directory conventions

```text
apps/
  web/
    src/main.tsx
    src/styles/global.css
    e2e/smoke.spec.ts
    index.html
    vite.config.ts
    playwright.config.ts
    Dockerfile
    package.json
    tsconfig.json
  api/
    src/
      modules/health/health.controller.ts
      common/filters/http-error.filter.ts
      common/cache/cache.module.ts
      common/cache/cache.service.ts
      config/environment.ts
      app.module.ts
      app.ts
      main.ts
    prisma/schema.prisma
    prisma.config.ts
    test/smoke.test.mjs
    test/cache.test.mjs
    test/integration/cache.test.mjs
    Dockerfile
    package.json
    tsconfig.json
    tsconfig.tools.json
packages/shared/
  src/index.ts
  package.json
  tsconfig.json
infra/docker/nginx.conf
scripts/
  dev-api.mjs
  check-compose.mjs
compose.yaml
compose.production.yaml
README.md
AGENTS.md
package.json
package-lock.json
tsconfig.base.json
eslint.config.mjs
.dockerignore
.env.example
.gitignore
.npmrc
.nvmrc
```

Add feature directories, web app/router/providers/layouts, shared components/utilities, API guards/DTOs/services, migrations, seeds, integration tests, and documentation directories only when approved scope requires them. Do not create empty scaffolding.

Keep feature-specific web components, hooks, API bindings, and tests within their feature directory. Organize API features into NestJS modules with controllers, services, and DTOs as needed. Controllers handle transport; services own business rules. Share public contracts through `packages/shared`; do not expose Prisma models, database access, or server secrets to the browser. Create directories when needed rather than adding empty scaffolding.

## Commands

The scaffold implements the commands below except entries explicitly marked deferred. See README.md for environment and service prerequisites. Use workspace names `@training/web`, `@training/api`, and `@training/shared`, and Compose service names `web`, `api`, `db`, and `redis` when scaffolding. Check actual scripts before running commands and keep this list accurate.

| Purpose | Command |
| --- | --- |
| Initial dependency setup, before a lockfile exists | `npm install` |
| Reproducible dependency installation | `npm ci` |
| Start frontend development server | `npm run dev --workspace @training/web` |
| Start backend development server | `npm run dev --workspace @training/api` |
| Build shared contracts and applications in dependency order | `npm run build` |
| Validate Prisma schema (DATABASE_URL required) | `npm run db:validate` |
| Root browser smoke (builds first) | `npm run test:e2e` |
| Validate production isolation and required settings | `npm run test:config` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Run unit tests | `npm test` |
| Redis integration tests (explicit TEST_REDIS_URL required) | `npm run test:cache --workspace @training/api` |
| Run database integration tests (explicit isolated TEST_DATABASE_URL required) | `npm run test:db` |
| Run all seven verification acceptance scenarios (isolated TEST_DATABASE_URL and Chromium required) | `npm run test:acceptance` |
| Benchmark 100,000-row exports (explicit isolated TEST_DATABASE_URL required) | `npm run test:export:performance` |
| Run browser workflows | `npm run test:e2e --workspace @training/web` |
| Generate Prisma client (also run by build/typecheck/dev) | `npm run db:generate --workspace @training/api` |
| Create and apply a development migration (after models exist) | `npm run db:migrate:dev --workspace @training/api -- --name <name>` |
| Apply committed migrations | `npm run db:migrate:deploy --workspace @training/api` |
| Seed demo data explicitly (never production) | `npm run db:seed` |
| Prepare demo fixtures and bring East to 100,000 certificates | `npm run db:seed:large` |
| Validate local Compose configuration | `docker compose -p training-platform-dev config --quiet` |
| Build and start local containers | `docker compose -p training-platform-dev up --build -d --wait` |
| Inspect container status | `docker compose -p training-platform-dev ps` |
| Follow application logs | `docker compose -p training-platform-dev logs -f api web redis` |
| Stop local containers, preserving volumes | `docker compose -p training-platform-dev down` |
| Validate production Compose configuration | `docker compose -f compose.yaml -f compose.production.yaml config --quiet` |
| Build production images | `docker compose -f compose.yaml -f compose.production.yaml build` |
| Apply migrations as an authorized deployment step | `docker compose -f compose.yaml -f compose.production.yaml run --rm api npm run db:migrate:deploy --workspace @training/api` |

Root scripts must explicitly orchestrate workspace tasks in the correct order. Integration and browser test scripts must document their database, service, and environment prerequisites. Ensure the API runtime image contains the migration tooling and files needed by the documented deployment command.

## Engineering conventions

- Prefer explicit types and small feature-focused modules. Avoid `any` and suppressions unless narrowly justified.
- Keep business rules in backend services; treat frontend validation as user assistance.
- Validate API inputs, enforce authorization on the server, and avoid exposing sensitive data in responses or logs.
- Provide clear loading, empty, error, and success states. Use accessible labels and keyboard-operable controls.
- Keep secrets out of source code, images, browser bundles, fixtures, and logs. Document required settings in `.env.example` using placeholders.
- Review generated migrations. Use migration files for persistent schema changes; do not use schema reset or `db push` against shared or production databases.

## Docker and shipping rules

- Use multi-stage Dockerfiles with reproducible dependency installation. Run application containers as non-root users and copy only required runtime artifacts.
- Exclude secrets, local dependencies, Git metadata, and unnecessary build artifacts through `.dockerignore`.
- Validate configuration at startup. Keep production secrets outside images and source control; browser environment values are public.
- Preserve the existing PostgreSQL 18 volume; use Compose project `training-platform-dev` for the running PostgreSQL 17 development stack.
- Redis is disposable cache storage: disable persistence, bound memory, require production credentials, and keep production Redis ports internal. Callers must tolerate misses and failed invalidation and define key scopes and TTLs when implementing features.
- Use named volumes for PostgreSQL persistence. Add database and application health checks; account for dependency readiness and transient connection failures.
- Keep development bind mounts, hot reload, debugging ports, and development credentials out of the effective production configuration. Verify merged Compose configuration before deployment.
- Apply committed migrations as an explicit deployment step, rather than an automatic action in each application replica. Document backup, migration failure handling, and rollback considerations before production shipment.
- Never run destructive volume removal, database reset, or data deletion without explicit authorization. `docker compose down --volumes` deletes persisted local data.
- Building images is verification; starting or changing a remote production deployment requires user authorization.

## Verification

Match checks to the change and run required checks once they exist. Do not add tests that merely mirror implementation or write unnecessary tests for documentation-only changes.

- Documentation-only changes: review accuracy against the repository and run `git diff --check`. For new untracked files, also inspect the file directly because Git diff does not include its contents.
- Application changes: run relevant lint, typecheck, build, and tests. Add regression coverage for meaningful behavior changes.
- Security-sensitive changes: verify server-side authorization, input validation, and relevant data access boundaries against the approved scope.
- Database changes: apply migrations to an isolated test database and verify relevant constraints and transactional behavior. Never aim destructive tests at shared data.
- Container changes: validate affected Compose configurations, build affected images, check service health, and exercise the relevant workflow. Validate the production override when shipping configuration changes.
- Browser workflow changes: verify the affected user journeys against the approved scope, including failure states and accessible interaction.

If a check cannot run, state which check, why it is blocked, and what remains unverified. Before handing off changes, inspect the diff for unrelated changes and accidental secrets.
