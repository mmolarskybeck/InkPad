# 1) Builder stage — install, compile TS & front‑end
FROM node:20-bookworm-slim AS builder

# Install OS deps for inklecate download
RUN apt-get update \
 && apt-get install -y curl unzip \
 && rm -rf /var/lib/apt/lists/*

# Download self‑contained inklecate binary
RUN curl -L -o /tmp/inklecate.zip \
     https://github.com/inkle/ink/releases/latest/download/inklecate_linux.zip \
 && unzip /tmp/inklecate.zip -d /usr/local/bin \
 && chmod +x /usr/local/bin/inklecate \
 && rm /tmp/inklecate.zip

WORKDIR /app

# Copy package manifests and install everything (including devDeps)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of your code
COPY . .

# Build frontend & backend
RUN npm run build

# 2) Production stage — only runtime deps + compiled artifacts
FROM node:20-bookworm-slim

# Copy the compiled inklecate binary from builder
COPY --from=builder /usr/local/bin/inklecate /usr/local/bin/inklecate

WORKDIR /app

# Copy only production deps (prune devDeps)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built assets
COPY --from=builder /app/dist/client ./dist/client
COPY --from=builder /app/server/dist  ./server/dist

# Expose port (Render will override via $PORT)
ENV PORT=3000
EXPOSE 3000

# Healthcheck for Render free tier
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Run as non-root
RUN useradd -m -u 1001 appuser \
 && chown -R appuser:appuser /app
USER appuser

# Start your production server
CMD ["node", "server/dist/index.js"]
