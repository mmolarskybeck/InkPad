# Use Node.js slim image
FROM node:20-bookworm-slim

# Install dependencies for downloading and unzipping
RUN apt-get update && \
    apt-get install -y curl unzip && \
    rm -rf /var/lib/apt/lists/*

# Download latest inklecate binary (self-contained, no .NET required)
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

# Install all dependencies (need dev deps for build)
RUN npm ci

# Copy application code
COPY . .

# Build the backend
RUN npm run build:backend

# Install only production dependencies
RUN npm ci --omit=dev

# Create temp directory for compilation
RUN mkdir -p /tmp/inkpad

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run as non-root user
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Start server
CMD ["node", "dist/index.js"]
