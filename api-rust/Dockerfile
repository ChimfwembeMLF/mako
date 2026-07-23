# syntax=docker/dockerfile:1
# Dokploy / docker compose: context = ./api-rust

FROM rust:1-bookworm AS builder

WORKDIR /app

# Limit parallel rustc jobs to avoid OOM in constrained Docker builders
ENV CARGO_BUILD_JOBS=1

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/api-rust /usr/local/bin/api-rust

ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" || exit 1

CMD ["api-rust"]
