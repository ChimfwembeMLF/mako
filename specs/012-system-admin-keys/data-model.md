# Data Model: System Admin Keys

No new database tables are required.

## Modified Entities

### `system_settings` (Existing)

We will utilize this table to store the integration keys.

- **Primary Key (`key`)**: `'platform_integrations'`
- **Column (`value`)**: `jsonb` 
  - Contains encrypted key-value pairs of integration secrets.
  - Example shape: 
    ```json
    {
      "OPENAI_API_KEY": "encrypted_string",
      "MISTRAL_API_KEY": "encrypted_string",
      "GOOGLE_DRIVE_CLIENT_ID": "encrypted_string",
      "GOOGLE_DRIVE_CLIENT_SECRET": "encrypted_string"
    }
    ```
- **Column (`description`)**: `"Global platform integration keys (encrypted)"`

## Services Impacted

- **NestJS**: `AppConfigService` or equivalent config wrapper should be updated to read from DB (and decrypt) before falling back to `process.env`.
- **Rust**: `Config` struct and initialization logic should load from DB and decrypt before falling back to `std::env`.
