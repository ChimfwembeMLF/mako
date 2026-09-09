# HTTP Contracts

## Set Tenant Integration Config
**Endpoint**: `PUT /api/v1/tenant/integration-configs`
**Authorization**: Tenant Admin only.

**Request Body**:
```json
{
  "provider": "openai",
  "apiKey": "sk-your-custom-openai-key-here"
}
```

**Success Response (200 OK)**:
```json
{
  "status": "success",
  "data": {
    "provider": "openai",
    "isConfigured": true
  }
}
```
*Note: The response never returns the actual `apiKey`, it only returns a status indicating whether it is configured.*

## Get Tenant Integration Configs
**Endpoint**: `GET /api/v1/tenant/integration-configs`
**Authorization**: Tenant Admin only.

**Success Response (200 OK)**:
```json
{
  "status": "success",
  "data": [
    {
      "provider": "openai",
      "isConfigured": true
    }
  ]
}
```

## Delete Tenant Integration Config
**Endpoint**: `DELETE /api/v1/tenant/integration-configs/:provider`
**Authorization**: Tenant Admin only.

**Success Response (200 OK)**:
```json
{
  "status": "success"
}
```
