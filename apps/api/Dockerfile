FROM oven/bun:1-alpine AS base
WORKDIR /app

# Copy manifests first for layer cache
COPY package.json bun.lockb* ./
COPY tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY db/package.json ./db/
COPY services/ingestion/package.json ./services/ingestion/
COPY services/retrieval/package.json ./services/retrieval/
COPY services/synthesis/package.json ./services/synthesis/
COPY services/access-control/package.json ./services/access-control/
COPY services/payments/package.json ./services/payments/
COPY apps/api/package.json ./apps/api/

RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy source
COPY shared/ ./shared/
COPY db/ ./db/
COPY services/ ./services/
COPY apps/api/ ./apps/api/

EXPOSE 3002
CMD ["bun", "run", "apps/api/src/index.ts"]
