# server/Dockerfile
FROM node:20-bookworm-slim

# Install dependencies
RUN apt-get update && \
    apt-get install -y curl unzip && \
    rm -rf /var/lib/apt/lists/*

# Download inklecate
RUN curl -L -o /tmp/inklecate.zip \
    https://github.com/inkle/ink/releases/latest/download/inklecate_linux.zip && \
    unzip /tmp/inklecate.zip -d /usr/local/bin && \
    chmod +x /usr/local/bin/inklecate && \
    rm /tmp/inklecate.zip

# Verify inklecate
RUN inklecate --version

WORKDIR /app

# Copy all files
COPY . .

# Install dependencies
RUN npm ci

# Build the backend
RUN cd server && npx tsc

# Remove dev dependencies
RUN npm prune --production

# Create temp directory
RUN mkdir -p /tmp/inkpad

ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-10000}/health || exit 1

# Run as non-root
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Start with Node ESM flag
CMD ["node", "--experimental-specifier-resolution=node", "server/dist/index-hardened.js"]