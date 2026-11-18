# syntax=docker/dockerfile:1
# storyforge - one image, two roles: ROLE=web (default) or ROLE=worker.

# node:22.23.5-alpine, pinned by digest
ARG NODE_IMAGE=node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm audit --omit=dev --audit-level=high

FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    ROLE=web \
    LOG_FILE= \
    MIGRATIONS_DIR=/app/migrations
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=build --chown=node:node /app/src/server/db/migrations ./migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD [ "$ROLE" != "web" ] || wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
CMD ["sh", "-c", "if [ \"$ROLE\" = worker ]; then exec node dist/worker.js; else exec node dist/main.js; fi"]
