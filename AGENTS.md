# Project agent instructions

## Scope and workflow

These instructions apply to the entire repository. This project is an internal admin console. The user will provide feature scopes and business requirements during implementation; do not infer or prescribe them from this document.

- Inspect relevant files before proposing changes. Ask clarifying questions when a material requirement cannot be inferred.
- Propose an implementation plan and obtain user approval before writing code. Continue within an approved plan without repeatedly requesting approval; seek approval for material scope changes.
- Keep changes focused on the requested work. Preserve unrelated user changes.
- Do not commit, push, publish, or deploy unless authorized.
- Report what changed, what was verified, and any remaining limitations. Never claim an unrun check passed.

## Repository status

The repository currently contains Git initialization and this instruction file. The stack, directories, and commands below are approved targets for scaffolding; they do not imply that application files, dependencies, scripts, or containers already exist. Update this document when implementation establishes or changes these conventions.

## Technology stack

- Language: TypeScript with strict type checking.
- Frontend: React and Vite.
- Backend: NestJS with server-side validation and authorization.
- Database: PostgreSQL, managed through Prisma schema and migrations.
- Workspace tooling: npm workspaces with a committed root lockfile.
- Browser verification: Playwright.
- Infrastructure and packaging: Docker and Docker Compose for local services and deployable application images.

Choose compatible dependency versions during scaffolding and record supported Node.js and npm versions. Keep development, CI, and container versions aligned.

## Target repository structure

```text
apps/
  web/
    src/
      app/
        router/                # Route definitions and access boundaries
        providers/             # Application-wide providers
        layouts/               # Admin shell and navigation
      features/                # Feature directories added as scopes are approved
      components/              # Shared presentation components
      lib/                     # API client and reusable utilities
      styles/                  # Global styles and design tokens
      main.tsx
    public/                    # Static assets
    e2e/                       # Playwright user workflow tests
    Dockerfile
    package.json
  api/
    src/
      modules/                 # NestJS modules added as scopes are approved
      common/
        guards/                # Authentication and authorization
        decorators/            # Request context helpers
        filters/               # Consistent error responses
        validation/            # Shared validation helpers
      config/                  # Validated environment configuration
      app.module.ts
      main.ts
    prisma/
      schema.prisma
      migrations/
      seed.ts                  # Explicit development/test data
    test/
      integration/             # API and database integration tests
      e2e/                     # End-to-end HTTP tests
    Dockerfile
    package.json
packages/
  shared/
    src/                       # Shared contracts and types
    package.json
infra/
  docker/                      # Container and reverse proxy configuration
docs/                          # Architecture, operations, deployment guidance
compose.yaml                   # Local application and infrastructure
compose.production.yaml        # Production deployment overrides
.dockerignore
.env.example                   # Documented placeholders, no secrets
.gitignore
package.json                   # Workspace definitions and root scripts
package-lock.json
AGENTS.md
```

Keep feature-specific web components, hooks, API bindings, and tests within their feature directory. Organize API features into NestJS modules with controllers, services, and DTOs as needed. Controllers handle transport; services own business rules. Share public contracts through `packages/shared`; do not expose Prisma models, database access, or server secrets to the browser. Create directories when needed rather than adding empty scaffolding.

## Commands

These are planned command contracts. They become executable only after the corresponding manifests, scripts, and Compose services exist. Use workspace names `@training/web`, `@training/api`, and `@training/shared`, and Compose service names `web`, `api`, and `db` when scaffolding. Check actual scripts before running commands and keep this list accurate.

| Purpose | Planned command |
| --- | --- |
| Initial dependency setup, before a lockfile exists | `npm install` |
| Reproducible dependency installation | `npm ci` |
| Start frontend development server | `npm run dev --workspace @training/web` |
| Start backend development server | `npm run dev --workspace @training/api` |
| Build shared contracts and applications in dependency order | `npm run build` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Run unit tests | `npm test` |
| Run API/database integration tests against an isolated test database | `npm run test:integration --workspace @training/api` |
| Run browser workflows | `npm run test:e2e --workspace @training/web` |
| Generate Prisma client | `npm run db:generate --workspace @training/api` |
| Create and apply a development migration | `npm run db:migrate:dev --workspace @training/api -- --name <name>` |
| Apply committed migrations | `npm run db:migrate:deploy --workspace @training/api` |
| Seed development/test data explicitly | `npm run db:seed --workspace @training/api` |
| Validate local Compose configuration | `docker compose config --quiet` |
| Build and start local containers | `docker compose up --build -d` |
| Inspect container status | `docker compose ps` |
| Follow application logs | `docker compose logs -f api web` |
| Stop local containers, preserving volumes | `docker compose down` |
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
