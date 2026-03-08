# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/server/package.json ./apps/server/

# Install ALL dependencies (needed to build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/server ./apps/server

# Build shared packages first, then server
RUN pnpm --filter @health-app/shared build
RUN pnpm --filter @health-app/db build
RUN pnpm --filter @health-app/server build

# ---- Production stage ----
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests (production only)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/server/package.json ./apps/server/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Copy raw SQL migration files so runMigrations() can apply them at startup.
# These are plain SQL — they don't go through the TypeScript build — so they
# must be copied explicitly. They land at packages/db/migrations/ which is
# where resolve(__dirname, "../migrations") resolves to from packages/db/dist/.
COPY packages/db/src/migrations ./packages/db/migrations

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

CMD ["node", "apps/server/dist/index.js"]
