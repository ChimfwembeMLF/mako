# Phase 0: Research

## Encryption Strategy

**Decision**: Use `AES-256-GCM` encryption.
**Rationale**: It provides authenticated encryption (ensuring both confidentiality and integrity). It is an industry standard and well-supported in both Node.js (via the native `crypto` module) and Rust (via the `aes-gcm` crate).
**Alternatives considered**: 
- `AES-CBC`: Rejected because it lacks built-in authentication, making it susceptible to padding oracle attacks.
- Third-party vault (e.g., AWS KMS): Rejected due to added infrastructure complexity and latency overhead, especially when parsing keys for every LLM request.

## Storage Strategy

**Decision**: Store encrypted keys in a new table `tenant_integration_configs`.
**Rationale**: Keeps sensitive credentials isolated from generic tenant metadata, making it easier to restrict query access and apply strict RBAC.
**Alternatives considered**:
- Storing directly on the `tenants` table as a JSONB column: Rejected because loading the tenant object everywhere would unintentionally load the encrypted secrets into memory across the application.

## Fallback Strategy

**Decision**: Fallback to system-level `OPENAI_API_KEY` on `api-rust` when a tenant's configured key is invalid.
**Rationale**: Ensures a smooth user experience. The system can log the tenant's key failure and notify the tenant asynchronously while continuing to fulfill their requests using the platform key.
**Alternatives considered**:
- Hard failure: Rejected because it halts business continuity for the tenant immediately.
