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
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN bun run build

FROM oven/bun:1-alpine AS runner
# Root at the monorepo level so the standalone mirror (apps/web/server.js, etc.) lands correctly
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
WORKDIR /app/apps/web
CMD ["bun", "server.js"]
