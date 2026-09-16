# Multi-stage Dockerfile for GACKS P.A. V2 Agent Runtime
FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source code
COPY . .

# Environment Defaults
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8787/api/v1/health || exit 1

# Start the Agent Runtime Gateway
CMD ["npm", "run", "server"]
