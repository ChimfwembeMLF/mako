# Data Model: Mobile Power Features

## Entities

### DevicePushToken (Backend: `api-rust`)
Stores the push token for a given user's device so the backend can send notifications.
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key to User)
- `token`: String (e.g., "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")
- `platform`: String ('ios' | 'android')
- `created_at`: Timestamp
- `updated_at`: Timestamp

### LocalDraft (Frontend: `AsyncStorage`)
Stores unsynced drafts locally on the device.
- `id`: String (UUID generated on client)
- `tenant_id`: String
- `content`: String (Text content of the draft)
- `media_uris`: Array of Strings (Local file URIs for attached media)
- `scheduled_for`: Timestamp (Optional)
- `created_at`: Timestamp
- `updated_at`: Timestamp

## Relationships
- A `User` can have multiple `DevicePushToken`s (e.g., a phone and a tablet).
- `LocalDraft` is stored per `tenant_id` on the device and is removed once successfully synced to the backend's Post/Draft tables.
