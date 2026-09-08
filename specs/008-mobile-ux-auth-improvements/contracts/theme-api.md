# API Contract: Theme Configuration

## Endpoint: Get Tenant Theme

Fetches the visual theme settings for a specific tenant/workspace.

**Request**:
`GET /api/v1/tenants/:tenantId/theme`

**Headers**:
- `Authorization`: Bearer `<token>` (Optional if public tenant branding is required before login, but usually required for authenticated mobile sessions)

**Response (200 OK)**:
```json
{
  "tenantId": "uuid",
  "primaryColor": "#FF5733",
  "secondaryColor": "#33C1FF",
  "logoUrl": "https://mako.tekreminnovations.com/assets/logo.png",
  "radius": 8
}
```

**Response (404 Not Found)**:
```json
{
  "error": "Tenant not found or theme not configured"
}
```
