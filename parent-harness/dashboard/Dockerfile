# Parent Harness Dashboard - Production Dockerfile
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY dashboard/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY dashboard/ ./

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install serve to run the static files
RUN npm install -g serve

# Set working directory
WORKDIR /app

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/ || exit 1

# Serve the application
CMD ["serve", "-s", "dist", "-l", "3333"]
