# Phase 1: Data Model

## `tenant_integration_configs`

This table stores the encrypted API keys configured by the tenant for 3rd-party integrations.

### Fields

| Name | Type | Constraints | Description |
|------|------|-------------|-------------|
| `id` | UUID | Primary Key | Unique identifier for the integration configuration. |
| `tenant_id` | UUID | Foreign Key, Not Null, Unique (with `provider`) | Links to the `tenants` table. Enforces tenant isolation. |
| `provider` | VARCHAR | Not Null | The name of the integration provider (e.g., `'openai'`). |
| `encrypted_api_key` | TEXT | Not Null | The AES-256-GCM encrypted API key. |
| `iv` | VARCHAR | Not Null | The initialization vector used during encryption. |
| `auth_tag` | VARCHAR | Not Null | The authentication tag for GCM integrity checks. |
| `created_at` | TIMESTAMPTZ | Default Now | Creation timestamp. |
| `updated_at` | TIMESTAMPTZ | Default Now | Last updated timestamp. |

### Relationships

- **Tenant**: `ManyToOne` (or `OneToOne` if restricted to one provider type per tenant). Specifically, a tenant can have many `tenant_integration_configs` but only one per `provider` (unique constraint on `tenant_id, provider`).

### Validation Rules

- `encrypted_api_key`, `iv`, and `auth_tag` MUST be securely generated using the system's `ENCRYPTION_KEY`.
- `provider` must be a valid supported integration (e.g., `openai`).
