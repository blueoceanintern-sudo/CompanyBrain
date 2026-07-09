FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lockb* ./
COPY tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY workers/package.json ./workers/
COPY db/package.json ./db/
COPY services/ingestion/package.json ./services/ingestion/
COPY services/retrieval/package.json ./services/retrieval/
COPY services/synthesis/package.json ./services/synthesis/
COPY services/access-control/package.json ./services/access-control/
COPY services/payments/package.json ./services/payments/
COPY apps/web/package.json ./apps/web/

RUN bun install --frozen-lockfile 2>/dev/null || bun install

COPY shared/ ./shared/
COPY apps/web/ ./apps/web/

WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM oven/bun:1-alpine AS runner
WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000
CMD ["bun", "server.js"]
