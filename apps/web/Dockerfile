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
WORKDIR /app/apps/web
CMD ["npm", "run", "dev"]
FROM development AS build
USER root
WORKDIR /app
RUN npm run build -w @training/web
FROM nginxinc/nginx-unprivileged:1.28.2-alpine AS runtime
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
