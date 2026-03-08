# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build shared package first
RUN pnpm --filter @health-app/shared build

# VITE_ vars are baked into the static bundle at build time
ARG VITE_FHIR_TERMINOLOGY_URL=https://browser.ihtsdotools.org/fhir
ENV VITE_FHIR_TERMINOLOGY_URL=$VITE_FHIR_TERMINOLOGY_URL

# Build the web app (outputs to apps/web/dist)
RUN pnpm --filter @health-app/web build

# ---- Serve stage ----
FROM nginx:1.27-alpine AS runner

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
