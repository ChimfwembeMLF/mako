# Data Model: Google Drive Media Integration

## Entities

### Integration / Config (Existing Table)
We will utilize the existing `tenant_integration_configs` (or equivalent) to store Google Drive credentials.
- `provider`: 'google_drive'
- `tenantId`: string (FK to Tenant)
- `accessToken`: string (encrypted)
- `refreshToken`: string (encrypted)
- `expiresAt`: timestamp
- `scope`: string

### MediaItem (Updates)
- `source`: Add 'google_drive' to the enum/types to track provenance.
- `externalId`: Store the Google Drive file ID to prevent duplicate imports and trace the origin.
