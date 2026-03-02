# syntax=docker/dockerfile:1.4
# ========================================
# Stage 1: Dependencies
# ========================================
FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (cache mount para reutilizar entre builds)
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline --no-audit --no-fund

# ========================================
# Stage 2: Builder
# ========================================
FROM node:22-alpine AS builder
WORKDIR /app

# Install libc6-compat for native modules
RUN apk add --no-cache libc6-compat

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build (values will be overridden in runtime if needed)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/db
ENV PAYLOAD_SECRET=temp-secret-for-build-only
ENV PAYLOAD_PUBLIC_SERVER_URL=http://localhost:3000
ENV PUBLIC_PAYLOAD_API_URL=http://localhost:3000/api
ENV PUBLIC_SITE_URL=http://localhost:3000
ENV PUBLIC_SITE_NAME=Warynessy

# Build both Astro and Next.js/Payload
RUN npm run build


# ========================================
# Stage 3: Production Runtime
# ========================================
FROM node:22-alpine AS production
WORKDIR /app

# Install runtime dependencies (wget for healthcheck)
RUN apk add --no-cache libc6-compat wget

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 payload

# Copy node_modules for full Next.js runtime
COPY --from=builder /app/node_modules ./node_modules

# Copy Next.js build (full build, not standalone)
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Copy Payload config and source files needed at runtime
COPY --from=builder /app/payload.config.ts ./
COPY --from=builder /app/src/payload ./src/payload

# Copy Astro dist for SSR
COPY --from=builder /app/dist ./dist

# Copy package.json for module resolution
COPY --from=builder /app/package.json ./

# Copy server.js (pre-compilado con esbuild, no necesita tsx en runtime)
COPY --from=builder /app/server.js ./

# Copy migrations folder
COPY --from=builder /app/src/migrations ./src/migrations

# Create startup script that runs migrations then starts server
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Running Payload migrations..."' >> /app/start.sh && \
    echo 'npx payload migrate || echo "Migration failed or no migrations to run"' >> /app/start.sh && \
    echo 'echo "Starting server..."' >> /app/start.sh && \
    echo 'exec node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Create media directory with correct permissions
RUN mkdir -p /app/public/media && chown -R payload:nodejs /app

# Set environment (will be overridden by Dokploy env vars)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Switch to non-root user
USER payload

# Expose port
EXPOSE 3000

# Start with migrations and then server
CMD ["/app/start.sh"]

# ========================================
# Stage 4: Development Runtime
# ========================================
FROM node:22-alpine AS development
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Set development environment
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Expose ports (Astro: 4321, Payload: 3000)
EXPOSE 3000 4321

# Default command (can be overridden in docker-compose)
CMD ["npm", "run", "dev"]
