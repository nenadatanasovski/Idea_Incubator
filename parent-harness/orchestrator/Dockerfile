# Parent Harness Orchestrator - Production Dockerfile
# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY orchestrator/package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY orchestrator/ ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies for better-sqlite3 runtime
RUN apk add --no-cache python3 make g++

# Copy package files
COPY orchestrator/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy necessary runtime files
COPY orchestrator/database ./database

# Create data directory
RUN mkdir -p /app/data

# Expose API port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })" || exit 1

# Run migrations and start server
CMD ["sh", "-c", "npm run migrate && npm start"]
