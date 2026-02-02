# Linera Checkers - Docker Build
# Multi-stage build for optimal image size

# ============================================================================
# Stage 1: Build Rust Contracts
# ============================================================================
FROM rust:1.75-bookworm AS contract-builder

# Install wasm target
RUN rustup target add wasm32-unknown-unknown

# Install Linera CLI
RUN cargo install linera-service@0.15.7

# Copy contract source
WORKDIR /app
COPY contracts ./contracts

# Build contracts
WORKDIR /app/contracts
RUN cargo build --release --target wasm32-unknown-unknown

# ============================================================================
# Stage 2: Build Frontend
# ============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY frontend ./

# Build production bundle
RUN npm run build

# ============================================================================
# Stage 3: Final Runtime Image
# ============================================================================
FROM rust:1.75-slim-bookworm

# Install Node.js for frontend serving
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Linera CLI
RUN cargo install linera-service@0.15.7

# Install serve for frontend
RUN npm install -g serve

# Copy built artifacts
WORKDIR /app

# Copy contracts
COPY --from=contract-builder /app/contracts/target/wasm32-unknown-unknown/release/*.wasm ./contracts/

# Copy frontend build
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/package.json ./frontend/
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules

# Copy startup script
COPY docker-entrypoint.sh /app/

RUN chmod +x /app/docker-entrypoint.sh

# Expose ports
# 8080: Linera GraphQL Service
# 3000: Frontend
EXPOSE 8080 3000

# Environment variables
ENV RUST_LOG=info
ENV NEXT_PUBLIC_LINERA_GRAPHQL_URL=http://localhost:8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
