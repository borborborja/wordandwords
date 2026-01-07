# Multi-stage build for WordAndWords

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Copy package files
COPY client/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY client/ ./

# Build the frontend
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Install nginx
RUN apk add --no-cache nginx

# Copy server package files
COPY server/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy server source code
COPY server/ ./

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/client/dist ./public

# Copy nginx configuration
COPY nginx.conf /etc/nginx/http.d/default.conf

# Create data directory for SQLite
RUN mkdir -p /app/data

# Create startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'nginx' >> /start.sh && \
    echo 'exec node server.js' >> /start.sh && \
    chmod +x /start.sh

# Expose ports
EXPOSE 80 3001

# Set environment variables
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

# Start both nginx and node server
CMD ["/start.sh"]
