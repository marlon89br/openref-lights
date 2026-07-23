# syntax=docker/dockerfile:1
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root package files
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install all workspace dependencies
RUN npm ci

# Copy frontend source code
COPY frontend ./frontend

# Production backend origin + auth token, baked in at build time (Angular has no runtime
# env vars). AUTH_TOKEN is an ARG (not a secret mount) deliberately: BuildKit secret
# mounts are excluded from the cache key, so a rebuild without --no-cache can silently
# reuse a layer built with a stale token. ARGs are hashed into the cache key, so any
# change here reliably busts the cache. Trade-off: the value is visible in build logs
# and `docker history` — rotate AUTH_TOKEN if a build log is ever shared.
ARG BACKEND_URL=http://localhost:3000
# Public URL for jury-generated join links/QR codes (e.g. https://meet.example.com).
# Leave empty to fall back to the browser's own window.location.origin at runtime.
ARG FRONTEND_URL=
ARG AUTH_TOKEN=
ARG FRONTEND_DEBUG=false

RUN cp frontend/src/app/environments/environment.example.ts frontend/src/app/environments/environment.ts && \
    sed -i \
      -e "s|backendUrl: '.*'|backendUrl: '${BACKEND_URL}'|" \
      -e "s|frontendUrl: '.*'|frontendUrl: '${FRONTEND_URL}'|" \
      -e "s|authToken: '.*'|authToken: '${AUTH_TOKEN}'|" \
      -e "s|debug: .*|debug: ${FRONTEND_DEBUG},|" \
      frontend/src/app/environments/environment.ts

# Build the application
WORKDIR /app/frontend
RUN npm run build

# Stage 2: Production - Serve with nginx
FROM nginx:alpine

# Copy built application from builder stage
COPY --from=builder /app/frontend/dist/referee-lights-app/browser /usr/share/nginx/html

# Copy custom nginx config for SPA routing
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Expose the port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
