# Dockerfile (in root directory) - SIMPLIFIED VERSION
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
RUN which inklecate && echo "inklecate installed successfully"

WORKDIR /app

# Copy everything
COPY . .

# Install ALL dependencies (including tsx for runtime)
RUN npm ci

# Create temp directory
RUN mkdir -p /tmp/inkpad

ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-10000}/health || exit 1

# Run as non-root
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Use tsx to run TypeScript directly (simpler, no build step)
CMD ["npx", "tsx", "server/index-hardened.ts"]