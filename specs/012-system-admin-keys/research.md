# Research: System Admin Keys

## Decisions

### 1. Storage Mechanism
**Decision**: Use the existing `system_settings` table to store platform integration keys under the key `platform_integrations`.
**Rationale**: Avoids creating a new table just for global secrets. The `value` column is `jsonb`, allowing us to store multiple integration keys (e.g. `{ "MISTRAL_API_KEY": "encrypted_value", "OPENAI_API_KEY": "encrypted_value" }`).
**Alternatives considered**: Creating a dedicated `platform_integrations` table. Rejected because `system_settings` is perfectly suited for global configuration.

### 2. Encryption
**Decision**: Use the existing `EncryptionService` to encrypt values before saving them to the database and decrypt them when loading into memory.
**Rationale**: Standard practice in the Mako platform (already used for tenant OAuth tokens and BYOK settings).
**Alternatives considered**: Storing in plain text. Rejected due to security risks.

### 3. Caching & Performance
**Decision**: The resolved configuration should be cached in memory (with a short TTL, e.g., 5 minutes) or fetched once and updated via a pub/sub mechanism or simple polling. Given the monolithic nature, a short cache or fetching on demand for low-frequency operations is acceptable. For high-frequency AI calls, an in-memory cache is required to avoid DB hits on every request.
**Rationale**: We don't want to hit the database for every single API request just to check if there is an OpenAI key.
**Alternatives considered**: Restarting the app on config change. Rejected because the requirement explicitly asks to avoid restarts.

### 4. Dual-Runtime Parity
**Decision**: Both NestJS (`api/`) and Rust (`api-rust/`) must implement the fallback logic. 
**Rationale**: Adherence to the Mako Constitution. Both runtimes serve the live API and need to make external calls (e.g., AI classification, S3 uploads).
