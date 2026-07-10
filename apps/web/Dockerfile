FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Intentionally omit bun.lockb — macOS lockfile contains darwin-specific SWC
# binaries (@next/swc-darwin-arm64) that cause bun install to skip the Linux
# equivalents. Let Bun resolve fresh for the Linux container.
COPY package.json ./
COPY tsconfig.base.json ./

# Copy ALL workspace manifests so Bun can resolve the full project graph
COPY shared/package.json ./shared/
COPY db/package.json ./db/
COPY workers/package.json ./workers/
COPY services/ingestion/package.json ./services/ingestion/
COPY services/retrieval/package.json ./services/retrieval/
COPY services/synthesis/package.json ./services/synthesis/
COPY services/access-control/package.json ./services/access-control/
COPY services/payments/package.json ./services/payments/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN bun install

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
# COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000
CMD ["bun", "server.js"]
