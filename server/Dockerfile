# server/Dockerfile
FROM node:20-bookworm-slim

# Install dependencies for downloading and unzipping
RUN apt-get update && \
    apt-get install -y curl unzip && \
    rm -rf /var/lib/apt/lists/*

# Download latest inklecate binary
RUN curl -L -o /tmp/inklecate.zip \
    https://github.com/inkle/ink/releases/latest/download/inklecate_linux.zip && \
    unzip /tmp/inklecate.zip -d /usr/local/bin && \
    chmod +x /usr/local/bin/inklecate && \
    rm /tmp/inklecate.zip

# Verify inklecate works
RUN inklecate --version

# Set up app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Create temp directory for compilation
RUN mkdir -p /tmp/inkpad

# Set environment (PORT will be overridden by Render)
ENV NODE_ENV=production

# Health check - use PORT env variable
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-10000}/health || exit 1

# Run as non-root user
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Start the hardened server directly (no build needed for JS)
CMD ["node", "index-hardened.js"]