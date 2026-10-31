# Training platform admin

Feature-neutral project initialization: a React placeholder and a NestJS `GET /api/health` endpoint. Health reports API process availability, not database connectivity. No authentication or business models exist; this scaffold is not a production-ready admin product.

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

Open http://localhost:5173. Vite proxies `/api` to localhost:3000; override `API_PROXY_TARGET` for another API location. The API reads root `.env`, validates `NODE_ENV`, `PORT`, and a PostgreSQL `DATABASE_URL` before listening, and exits on startup failure without logging secrets. It does not connect to the database yet. API changes compile before the process watcher reloads. Shared contract changes require `npm run build -w @training/shared` and restarting consumers.

## Workspace and checks

- `apps/web`: React/Vite placeholder, loading/error/retry states, Playwright workflows.
- `apps/api`: NestJS health controller, global validation/error handling, environment configuration, Prisma schema/tooling and HTTP/startup tests.
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

Docker with Compose **2.24.4+** is required. The checked-in configuration uses Node 24.22.1, PostgreSQL 17.6 and an unprivileged Nginx runtime. App containers run non-root; dependencies are installed reproducibly in build stages.

```sh
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs -f api web
docker compose down
```

Local ports default to web 5173, API 3000, PostgreSQL 5432, bound to loopback. Set `WEB_PORT`, `API_PORT`, `DB_PORT` and use `docker compose -p <isolated-name>` to avoid conflicts. The named `postgres_data` volume persists across stops. Never use `down --volumes` without explicit authorization. Source mounts enable development reload; dependency changes require rebuilds. Compose waits for PostgreSQL readiness and API health before starting dependent services; health checks retry transient startup failures. There is no database-dependent API operation yet.

## Production image and local smoke workflow

Set all required variables through a secure environment or an untracked env file (use `--env-file` consistently). Unlike development, no default production credentials, app mounts, watch commands, direct API ports or database host ports are present in the merged configuration.

```sh
export PRODUCTION_DB_USER='<database user>'
export PRODUCTION_DB_PASSWORD='<strong password>'
export PRODUCTION_DB_NAME='<database name>'
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

Prisma **7.10.1** uses `apps/api/prisma.config.ts` for the database URL and `prisma/schema.prisma` for the PostgreSQL provider. [Prisma 7 supports Node 24](https://www.prisma.io/docs/orm/v7/reference/system-requirements). The schema deliberately has **no models**. `db:validate` validates that schema with a configured URL; no connection is needed. Prisma 7.10.1 can generate model-free client artifacts (verified), but these provide no application model operations; generation is unnecessary and intentionally excluded from install/build. Generated artifacts are ignored. No client is imported by the API. See [Prisma generation documentation](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/generating-prisma-client).

The real CLI commands are available for later approved models:

```sh
npm run db:generate -w @training/api
npm run db:migrate:dev -w @training/api -- --name <name>
npm run db:migrate:deploy -w @training/api
```

There are no migrations to apply, no seed data, and no database integration suite yet. Seed/integration scripts are deferred rather than reporting success without exercising behavior. After models are approved, review the generated SQL, test migrations and constraints against an isolated database, and generate the client using the appropriate PostgreSQL driver adapter. Do not use `db push` or database reset on shared data.

The API runtime image retains Prisma CLI, config and schema (and will copy migrations when added). Apply committed migrations as a separate authorized deployment job, never automatically in application startup:

```sh
docker compose -f compose.yaml -f compose.production.yaml run --rm api npm run db:migrate:deploy --workspace @training/api
```

Before shipping schema changes, take and verify a database backup, review locking/data conversion risks, and prepare a forward repair or tested restore procedure. On failure, stop rollout, inspect migration state and repair deliberately; do not automatically retry destructive SQL or assume application rollback reverses database changes. Actual migration/restore verification remains deferred until models and migrations exist.
