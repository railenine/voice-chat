# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests for cached dependency installation
COPY package*.json ./
RUN npm ci

# Copy frontend source and build configuration
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Install production dependencies only and purge cache
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built frontend assets from builder stage
COPY --from=builder --chown=node:node /app/dist ./dist

# Copy backend server
COPY --chown=node:node server ./server

# Switch to unprivileged built-in node user for security
USER node

# Expose server port
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server/index.js"]
