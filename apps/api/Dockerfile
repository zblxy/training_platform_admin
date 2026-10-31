FROM node:24.22.1-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install --global npm@11.19.1 && npm ci
FROM dependencies AS development
COPY --chown=node:node . .
RUN npm run build -w @training/shared && chown node:node /app /app/apps /app/apps/api /app/apps/web /app/packages /app/packages/shared
RUN chown -R node:node /app/packages/shared/dist
USER node
WORKDIR /app/apps/api
CMD ["npm", "run", "dev"]
FROM development AS build
USER root
WORKDIR /app
RUN npm run build -w @training/api
# Prisma CLI is intentionally a runtime dependency for explicit migration jobs.
RUN npm prune --omit=dev && mkdir -p apps/api/node_modules
FROM node:24.22.1-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* && npm install --global npm@11.19.1
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
# npm may place dependencies inside a workspace as well as at the root.
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/packages/shared ./packages/shared
COPY --from=build --chown=node:node /app/apps/api/package.json /app/apps/api/prisma.config.ts ./apps/api/
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
