FROM oven/bun:1-alpine AS base
WORKDIR /app

# Copy manifests first for layer cache
COPY package.json bun.lock* bun.lockb* ./
COPY tsconfig.base.json ./
COPY drizzle.config.ts ./
COPY shared/package.json ./shared/
COPY db/package.json ./db/
COPY services/ingestion/package.json ./services/ingestion/
COPY services/retrieval/package.json ./services/retrieval/
COPY services/synthesis/package.json ./services/synthesis/
COPY services/access-control/package.json ./services/access-control/
COPY services/payments/package.json ./services/payments/
COPY services/ai-provider/package.json ./services/ai-provider/
COPY services/storage/package.json ./services/storage/
COPY workers/package.json ./workers/
COPY apps/api/package.json ./apps/api/

RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy source
COPY shared/ ./shared/
COPY db/ ./db/
COPY scripts/ ./scripts/
COPY services/ ./services/
COPY apps/api/ ./apps/api/

# Original uploaded files. Must be backed by a persistent volume — a container
# rebuild would otherwise take every stored original with it.
ENV STORAGE_ROOT=/data/documents
VOLUME ["/data/documents"]

EXPOSE 3002
CMD ["sh", "-c", "bunx drizzle-kit migrate && bun run scripts/setup.ts && bun db/seed.ts && bun run apps/api/src/index.ts"]
