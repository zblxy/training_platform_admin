# Training platform admin

Training admin demo with tenant-scoped data models, transactional certificate issuance/revocation services, generated bearer-token actor identification, and a repeatable demo seed. The frontend includes a certificate list with learner-name/serial search, sorting and pagination, plus course-based bulk issuance with per-learner outcomes. `GET /api/health` reports process availability, not database connectivity. See [data model and invariants](docs/data-model.md).

## Runtime and setup

Use Node **24.22.1**, npm **11.19.1** (also pinned in containers). With nvm, run `nvm install && nvm use`; in this managed worktree:

```sh
export PATH=/home/zblxy/.nvm/versions/node/v24.22.1/bin:$PATH
npm ci
cp .env.example .env
npm run build
```

The root `minimatch` override pins patched version 11.0.3 for lint dependencies; recheck compatibility when upgrading lint tooling. Prisma lifecycle scripts are explicitly allowed in `package.json` for reproducible installs.

All direct dependencies are exact versions and `package-lock.json` locks transitive dependencies. `.env.example` contains local-only credentials. Keep `.env` and production credentials outside source control. Browser bundles contain no database settings.

For host development, use separate terminals:

```sh
npm run dev --workspace @training/api
npm run dev --workspace @training/web
```

Open http://localhost:5173. Vite proxies `/api` to localhost:3000; override `API_PROXY_TARGET` for another API location. The API reads root `.env`, validates `NODE_ENV`, `PORT`, a PostgreSQL `DATABASE_URL`, and `REDIS_URL` before listening, and exits on startup failure without logging secrets. Database connections are lazy and used by the authenticated actor endpoint and certificate services. API changes compile before the process watcher reloads. Shared contract changes require `npm run build -w @training/shared` and restarting consumers.

## Workspace and checks

- `apps/web`: React/Vite placeholder, loading/error/retry states, Playwright workflows.
- `apps/api`: NestJS health controller, global validation/error handling, environment configuration, Prisma schema/tooling, a reusable Redis cache module, and HTTP/startup/cache tests.
- `packages/shared`: public health contract and response validator; no server/database internals.
- `infra/docker`: production reverse proxy configuration.
- `scripts`: development process supervision.

```sh
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run db:validate
npm run test:config
```

`npm run test:config` checks merged production isolation and rejects each missing required setting; it requires the Docker Compose CLI, but no running containers.

`npm test` builds shared/API and tests real HTTP health/404 responses, invalid configuration, process startup failure, and response validation. Browser tests build all workspaces and start isolated API/Vite servers on ports 13000/15173, then exercise real proxy connectivity and simulated loading/error/retry/malformed responses. No database is required. Install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_EXECUTABLE_PATH` to an existing compatible binary. In this environment:

```sh
PLAYWRIGHT_EXECUTABLE_PATH=/home/zblxy/.cache/ms-playwright/chromium-1169/chrome-linux/chrome npm run test:e2e
```

To exercise an existing web service, set `E2E_BASE_URL=http://127.0.0.1:<port>`; Playwright then starts no servers. Use only a local or authorized test environment.

## Local containers

Docker with Compose **2.24.4+** is required. The checked-in configuration uses Node 24.22.1, PostgreSQL 17.6, Redis 7.4.8, and an unprivileged Nginx runtime. App containers run non-root; dependencies are installed reproducibly in build stages.

```sh
docker compose -p training-platform-dev config --quiet
docker compose -p training-platform-dev up --build -d --wait
docker compose -p training-platform-dev ps
docker compose -p training-platform-dev logs -f api web redis
docker compose -p training-platform-dev down
```

Local ports default to web 5173, API 3000, PostgreSQL 5432, and Redis 6379, bound to loopback. Set `WEB_PORT`, `API_PORT`, `DB_PORT`, `REDIS_PORT` and use `docker compose -p <isolated-name>` to avoid conflicts. The named `postgres_data` volume persists across stops. Never use `down --volumes` without explicit authorization. Source mounts enable development reload; dependency changes require rebuilds. Compose waits for PostgreSQL and Redis readiness and API health before starting dependent services; health checks retry transient startup failures. The actor endpoint requires the initial migration and a seeded admin.

## Redis cache

Redis is disposable cache storage: snapshots and AOF are disabled, `/data` uses tmpfs, and no Redis data volume is created. The server uses a 128 MB `maxmemory` limit with `allkeys-lru` eviction and a 256 MB container limit for overhead. Values may be evicted before TTL or lost on restart; authoritative data belongs in PostgreSQL. See [Redis eviction documentation](https://redis.io/docs/latest/develop/reference/eviction/).

Host development uses `REDIS_URL`; containers use `COMPOSE_REDIS_URL` with hostname `redis`. Defaults in `.env.example` are local-only. If changing `REDIS_PASSWORD`, update both URLs with URI-encoded credentials. Production requires matching `PRODUCTION_REDIS_PASSWORD` and `PRODUCTION_REDIS_URL`, with no default password or host port. `rediss://` is supported for an external TLS-enabled Redis endpoint; the bundled Redis server uses plain Redis on its internal network.

Import `CacheModule` from `apps/api/src/common/cache/cache.module.ts` in a consuming NestJS module and inject `CacheService`. It exposes `get(key): Promise<string | null>`, `set(key, value, ttlSeconds): Promise<boolean>`, and `delete(key): Promise<boolean>`. Values are strings; callers choose serialization, cache keys, TTLs, and invalidation rules when feature scopes are approved. Every write requires a positive integer TTL in seconds, and keys are prefixed with `training:cache:`. No feature data or HTTP responses are cached automatically.

Connections are lazy, shared across concurrent operations, and destroyed when the Nest application closes. Connection/handshake and command waits are each bounded at 500 ms. Offline command queuing and automatic reconnect loops are disabled; a later operation reconnects after a lost connection. A failed read returns `null`; failed writes/deletes return `false`, so callers can fall back to their data source. Invalid TTLs throw. Cache failures are handled without logging keys, payloads, URLs, or credentials. `/api/health` remains a process health check and does not establish Redis connectivity.

`npm test` includes cache outage and Redis URL validation checks without requiring Redis. Run the Redis integration suite against a local or isolated test instance:

```sh
docker compose -p training-platform-dev up -d --wait redis
TEST_REDIS_URL=redis://:training_cache_local_only@127.0.0.1:6379/0 npm run test:cache -w @training/api
```

The suite uses unique temporary keys with TTLs, removes only its own keys, and verifies sharing, expiry, empty strings, deletion, authentication rejection, Nest injection, and shutdown cleanup. It requires `TEST_REDIS_URL` explicitly and never flushes the cache. `npm run test:config` also checks Redis production isolation, required credentials, eviction, and disabled persistence.

The development stack runs under `training-platform-dev`. The default project's older PostgreSQL 18 volume is preserved and is incompatible with the scaffold's PostgreSQL 17 image; use the project name shown above rather than reusing that volume.

## Production image and local smoke workflow

Set all required variables through a secure environment or an untracked env file (use `--env-file` consistently). Unlike development, no default production credentials, app mounts, watch commands, direct API ports, database host ports, or Redis host ports are present in the merged configuration.

```sh
export PRODUCTION_DB_USER='<database user>'
export PRODUCTION_DB_PASSWORD='<strong password>'
export PRODUCTION_DB_NAME='<database name>'
export PRODUCTION_REDIS_PASSWORD='<strong cache password>'
export PRODUCTION_REDIS_URL='redis://:<encoded cache password>@redis:6379/0'
export PRODUCTION_DATABASE_URL='postgresql://<encoded user>:<encoded password>@db:5432/<database name>'
export PRODUCTION_BIND_ADDRESS=127.0.0.1
export PRODUCTION_WEB_PORT=25173
docker compose -p training-production-smoke -f compose.yaml -f compose.production.yaml config --quiet
docker compose -p training-production-smoke -f compose.yaml -f compose.production.yaml build
docker compose -p training-production-smoke -f compose.yaml -f compose.production.yaml up -d --wait
curl --fail http://127.0.0.1:25173/api/health
E2E_BASE_URL=http://127.0.0.1:25173 npm run test:e2e -w @training/web
docker compose -p training-production-smoke -f compose.yaml -f compose.production.yaml down
```

Use URI-encoded credentials in connection URLs. Compose requires nonempty production settings; API startup validates URL syntax. Operators must ensure URL credentials/database match PostgreSQL settings. Changing PostgreSQL initialization variables does not change users/passwords on an existing volume. Nginx resolves the API service through Docker DNS and serves static assets with same-origin `/api` forwarding. External TLS, real authentication/authorization, monitoring, backup storage and remote deployment are outside this scope. Do not expose the placeholder as a protected admin application.

## Prisma and migrations

Prisma **7.10.1** uses `apps/api/prisma.config.ts` for its URL and `prisma/schema.prisma` for models. Build, typecheck and development scripts generate the ESM TypeScript client into ignored `apps/api/src/generated/prisma`; the API uses the PostgreSQL driver adapter. Generation/builds need no live database; a nonfunctional fallback URL is used if no URL is configured. Database operations require an explicit working `DATABASE_URL`.

Apply the reviewed initial migration and seed a local demo database explicitly:

```sh
npm run db:validate
npm run db:migrate:deploy -w @training/api
npm run db:seed
```

The seed creates **East** (`Australia/Sydney`, admin `alice@east.test`) and **West** (`Australia/Perth`, admin `bob@west.test`). Admin email identifiers use the existing Admin.name field; no email schema field is added. Each admin belongs only to their own tenant. Both tenants have **Safety 101**, **Leadership**, and four learners enrolled in both courses: Jordan Smith (incomplete), Sam Taylor (completed without a certificate), Alex Lee (already certified), and Morgan Chen (revoked certificate). Existing enrollment states and certificate/audit history are preserved on reruns; fixture tenant names/time zones, admin names, course titles, and learner names are updated. Historical certificate date/zone snapshots remain unchanged. The seed is disabled when `NODE_ENV=production`.

To prepare the volume demo, run:

```sh
npm run db:seed:large
```

This first prepares the small fixtures, then brings **East to exactly 100,000 total certificate rows**, including existing and revoked certificates. West keeps its small dataset (four certificates on a fresh database). New volume learners are enrolled in East's Safety 101, are completed, and receive one certificate and one trigger-generated issuance audit each. Certificates use database-generated unique serials and the current tenant-local issue date. Rows are generated in atomic batches of up to 1,000, with progress output and bounded batch waits. No triggers are disabled.

Reruns resume committed work, preserve tokens and existing certificates, and add nothing once East has 100,000 rows. Concurrent volume generators serialize on the East tenant row. If East already exceeds the target, the script reports an error rather than deleting history. Run generation while the demo is idle so unrelated certificate writers do not change the final count. Both commands require the migrated local demo DATABASE_URL; neither runs migrations or resets the database. Token-file handling is shared between the commands.

Generated 256-bit bearer tokens are stored only in the ignored root `.demo-tokens.json` with mode `0600`, excluded from Docker build context, and never printed. Database admins store only SHA-256 hashes. Keep this file private. Repeated seeds reuse its tokens; losing it and reseeding rotates the two demo admins' tokens. `DEMO_TOKEN_FILE` can select a separate token file. A partially failed seed can be rerun; it does not reset data. Use demo databases only.

`GET /api/actor` requires `Authorization: Bearer <token>` and returns only admin ID, tenant ID and name. There is no login UI. Open the certificate list and supply a generated admin token using the inline API token control. Tokens stay in memory and are cleared on reload; they are never stored in browser storage or URLs. Bulk issuance is available through the course selector and an authenticated HTTP route; revocation remains a backend service without an HTTP route. Future protected routes must use `ActorGuard` and pass its actor to the services. Tokens have no expiry in this demo; replace an admin's token hash to rotate/revoke access. Never embed tokens in frontend source or URLs.

Run database integration checks only against an isolated test database:

```sh
TEST_DATABASE_URL='postgresql://<user>:<password>@127.0.0.1:<port>/<test-db>' npm run test:db
```

The suite requires permission to create/drop a unique temporary schema. It applies migrations, checks a second deployment is a no-op, exercises constraints/concurrency/authentication and repeatable seeding, then drops only its own schema and removes its own temporary token file. It never migrates the configured development `DATABASE_URL`. Unit tests and existing health/browser smoke tests still require no running database. Redis integration tests remain separate.

For later schema changes use `npm run db:migrate:dev -w @training/api -- --name <name>`, review SQL, and preserve the custom checks and triggers in the initial migration. Do not use `db push` or reset against shared data. Use additive migrations during rolling updates; remove old fields only after all instances and the rollback window no longer require them.

The API runtime image retains Prisma CLI, config and schema (and will copy migrations when added). Apply committed migrations as a separate authorized deployment job, never automatically in application startup:

```sh
docker compose -f compose.yaml -f compose.production.yaml run --rm api npm run db:migrate:deploy --workspace @training/api
```

Before shipping schema changes, take and verify a database backup, review locking/data conversion risks, and prepare a forward repair or tested restore procedure. On failure, stop rollout, inspect migration state and repair deliberately; do not automatically retry destructive SQL or assume application rollback reverses database changes. Initial migration behavior is covered by isolated database tests; backup restoration and remote deployment are separate operational checks.

## Certificate list

Apply migrations explicitly and run the demo seed against a development database before browsing certificates. The seed already creates one admin per tenant; generated tokens are in the ignored root `.demo-tokens.json`. Never put tokens in frontend environment variables, bundles, or URLs.

`GET /api/certificates` requires `Authorization: Bearer <token>`. Results and totals belong only to the authenticated admin's tenant. Query parameters:

| Parameter | Behavior |
| --- | --- |
| `search` | Up to 200 characters; trimmed; case-insensitive partial learner name OR full serial match (serial input is normalized to uppercase). SQL wildcard characters are literal. |
| `page` | Positive integer, default 1, maximum 1,000,000. |
| `pageSize` | Positive integer, default 20, maximum 100. |
| `sortBy` | `issuedAt` (default), `learnerName`, `serialNumber`, or `courseTitle`. |
| `sortDirection` | `asc` or `desc` (default). Certificate ID ascending breaks ties. |

The response contains `items`, `total`, `page`, and `pageSize`. Each item includes ID, serial number, learner name, course title, UTC issuance timestamp, historical tenant-local issue date (`YYYY-MM-DD`), and active/revoked status. Both statuses appear; the list has no revocation or status filter. CSV export is available for all matching rows. Course-based issuance is available in the bulk issuance section. Unknown parameters and invalid values return 400; missing/invalid credentials return 401. Count and rows share a repeatable-read snapshot. Offset pages can shift between requests if certificates are added or related names change.

Database verification: `TEST_DATABASE_URL=<isolated PostgreSQL URL> npm run test:db` creates temporary schemas and applies real migration files, including an upgrade containing active and revoked certificates. Browser verification: `npm run test:e2e` builds first and starts API/Vite using isolated ports; certificate and bulk issuance UI tests intercept API responses, while database tests exercise real HTTP authorization, issuance, concurrency, partial failures, and data access. Set `PLAYWRIGHT_EXECUTABLE_PATH` if the managed environment supplies Chromium separately.

The serial migration is additive and assigns `CERT-` plus 32 uppercase hexadecimal characters from random UUIDs, with a unique index, format check, and immutability trigger. It backfills active and revoked certificates without changing audit history. The table is locked while the new column/default and index are created; schedule migration appropriately for data size. Before production migration, take and verify a database backup. If the transaction fails, no partial schema change is retained: investigate and follow Prisma's failed-migration recovery procedure before retrying. For application rollback, retain the additive serial column/default and constraints so older application versions can still issue certificates; do not remove assigned serials or certificate/audit history.


## Bulk issuance

Supply a generated admin token in the existing API token control, choose a course in **Bulk issuance**, and select **Issue to eligible learners**. The course control and submit button are disabled while processing. The page shows processing status, completion totals, and one outcome for every enrollment in the course at request start. Results display 20 rows per page by default, with 10/20/50/100 options, first/previous/next/last controls, and a visible row range. Changing the page size or starting another operation resets results to page 1. Pagination uses the completed response in memory and does not submit another issuance request; all outcomes still arrive in one API response. A completed request refreshes the certificate list without changing its search or sorting.

- `GET /api/certificates/courses` returns `{ items: [{ id, title }] }` for the authenticated tenant, ordered by title then ID.
- `POST /api/certificates/bulk-issuance` accepts only `{ courseId: "<UUID>" }`. It returns HTTP 201 with `courseId`, `total`, `issued`, `skipped`, `failed`, and `outcomes`.
- Every outcome includes `enrollmentId`, `learnerId`, `learnerName`, and `status`. An `issued` outcome includes `certificateId` and `serialNumber`. A `skipped` outcome includes reason `incomplete`, `already_issued`, or `revoked`. A `failed` outcome includes the safe reason `issuance_failed`.
- Missing/invalid credentials return 401, malformed input or extra body fields return 400, and missing or foreign-tenant courses return 404. An empty course returns zero totals and an empty outcome array.

The request reads enrollment membership, learner names, and existing certificates in one tenant-scoped joined query, avoiding a database parameter per learner on large courses. Existing permanent certificates are skipped from this snapshot; active/revoked skip reasons reflect the snapshot. Each remaining learner uses an independent transaction with the existing enrollment row lock. Eligibility and issued/skipped classification for those learners are decided inside that transaction; overlapping requests cannot issue duplicate certificates or duplicate audit events. One failed learner does not roll back other learners. Retry the course to attempt failed learners again; existing certificates, including revoked certificates, are skipped permanently. Enrollments added later require another request.

This implementation processes learners sequentially in one HTTP request. There is no background worker, durable batch record, progress polling, or recovery of previous per-request outcomes after reload. Keep the page open for results. A lost response or navigation can leave the result unknown while server processing continues; retrying is safe because certificate issuance is idempotent. Large courses may outlast infrastructure request timeouts. Results are held in browser memory and cleared when changing the course or token. No schema migration or business-data cache is needed.

Verification uses the existing commands: `npm test`, `TEST_DATABASE_URL=<isolated PostgreSQL URL> npm run test:db`, and `npm run test:e2e`. Database tests create temporary schemas on the explicitly selected isolated database; browser tests start local API/Vite processes and use intercepted feature responses. Do not point the database suite at shared or production data.

## Certificate CSV export

Apply the additive export migration explicitly before using this feature. `Export CSV` captures the **applied** search and sort, excludes pagination, and includes both active and revoked certificates. Changing the list afterward does not change an existing export. Columns are learner name, course title, serial number, and historical tenant-local issue date (`YYYY-MM-DD`). Files use UTF-8 with a BOM, CRLF records, quoted cells, escaped quotes, and an apostrophe before spreadsheet formula prefixes (including prefixes after whitespace). Empty results produce a header-only CSV.

All export endpoints require the existing bearer actor guard. Jobs, status, and downloads are scoped to both the tenant and requesting admin. Tokens stay in Authorization headers, never download URLs. Status and downloads are not cacheable.

- `POST /api/certificates/exports`: accepts only `search`, `sortBy`, and `sortDirection`, with the same validation/defaults as the list; returns **202** with job status. Repeated active requests with the same filters reuse the job; different filters return **409** until it finishes. The queue admits at most 20 queued/running jobs; excess starts return **429**.
- `GET /api/certificates/exports/:id`: returns ID, captured filters, `queued`/`running`/`completed`/`failed` status, processed/total row counts, creation/expiry timestamps, and a safe error. Invalid IDs return **400**; foreign, missing, or expired jobs return **404**.
- `GET /api/certificates/exports/:id/download`: streams the completed CSV as an attachment. Unfinished/failed jobs return **409**. Downloads remain available for **24 hours after completion**; expired artifacts are removed by the worker.

A worker thread starts with each API process. PostgreSQL stores durable jobs and CSV chunks; the disposable Redis cache is not involved. Database advisory locks and leases serialize generation across replicas, and partial unique indexing prevents duplicate active jobs per admin. Interrupted jobs restart from a fresh snapshot after their 90-second lease expires, with at most three attempts. Partial chunks are discarded before retry. A retry may include changes made since the interrupted attempt. No automatic retry occurs for a generation failure reported as `failed`; the UI offers a new export.

Generation uses a repeatable-read database snapshot taken when the worker begins processing, a joined SQL cursor fetching 1,000 rows at a time, and the same list ordering (certificate ID ascending breaks ties). Progress is counted from persisted output rows. CSV serialization runs outside the HTTP event loop. Files are limited to 128 MiB, with a 2 MiB limit per encoded row/chunk; oversized exports fail with a recoverable error. Generation transactions are bounded to 55 seconds, with 45-second statement timeouts. Downloads stream with backpressure and a 60-second timeout. A repeatable-read download snapshot prevents cleanup from removing later chunks mid-download. The browser polls status every 500 ms, supports retrying status checks, and retains no job/token state after reload.

Verification prerequisites: Node/npm versions above, installed dependencies, Chromium for browser tests, and an **explicit isolated PostgreSQL URL** whose user may create/drop temporary schemas. Tests apply all migrations twice and remove only their own schemas and temporary token files. They never migrate the configured development database.

```sh
TEST_DATABASE_URL='<isolated PostgreSQL URL>' npm run test:db
npm run test:e2e
TEST_DATABASE_URL='<isolated PostgreSQL URL>' npm run test:export:performance
```

The performance command seeds an isolated East tenant with exactly 100,000 certificates, retains West fixtures, and measures every sort field in both directions. Each measurement includes POST acceptance, worker queue pickup, generation, persistence, and polling until ready; file download is checked separately. The acceptance target is **under 60 seconds for one active export on the local development stack**, excluding download time. Results report Node version, host CPU/memory, and per-sort timings; concurrent-load and other hardware guarantees require separate measurement.

Measured on 2026-10-31 with Node 24.22.1, PostgreSQL 17.6 in an isolated local container, and an Intel Core i7-14700HX host exposing 28 logical CPUs and 8 GiB RAM. List and health requests ran during generation; all succeeded, and the maximum observed health response time was 5 ms. Each downloaded CSV contained exactly 100,000 unique certificate serials. These are local measurements, not production capacity guarantees.

| Sort | Ascending | Descending |
| --- | --- | --- |
| Issuance time | 1.202 s | 1.169 s |
| Learner name | 1.178 s | 1.296 s |
| Serial number | 1.280 s | 1.318 s |
| Course title | 1.048 s | 1.047 s |

The export migration creates new tables/indexes and does not rewrite certificate or audit history. Before production rollout, take and verify a database backup, apply migrations as a separate authorized deployment step, and investigate any failed migration before retrying. Application rollback can leave these additive tables in place; retain exports until their retention window ends rather than dropping data during rollback.
