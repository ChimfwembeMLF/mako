# Research: Google Drive Media Integration

## Decision: OAuth2 Strategy
- **Decision**: Use standard Google OAuth2 web server flow with `access_type=offline` and `prompt=consent` to guarantee a refresh token is provided. Store the refresh token securely in the existing tenant integrations table.
- **Rationale**: Mako operates on behalf of tenants for background processing and subsequent visits, requiring persistent access without re-prompting.
- **Alternatives considered**: Google Picker API (client-side only), but we decided in the spec (FR-008) to copy the file to S3, which means the backend needs to download the file directly using the backend credentials.

## Decision: File Download Strategy
- **Decision**: Stream the file from Google Drive API directly to our S3 storage bucket.
- **Rationale**: Media files can be large. Streaming is memory efficient and prevents the server from crashing or running out of memory.
- **Alternatives considered**: Loading into memory (would crash the server on large videos), downloading to disk and then uploading to S3 (requires disk space and cleanup).

## Decision: Dual Runtime Implementation
- **Decision**: The Google Drive API interactions (OAuth callback, list files, download file) must be implemented in both NestJS (`api/`) and Rust (`api-rust/`) runtimes.
- **Rationale**: Mako Constitution (Principle I) mandates Nest-Rust behavioral parity for live API features.
