# API Client Contract

The mobile app does not expose its own API but acts as a consumer of the existing `api-rust` interfaces. 

## Base URL Configuration

The mobile app will connect to the API via an environment variable (`EXPO_PUBLIC_API_URL`). 
- **Development**: typically `http://localhost:3000` (or the IP of the machine if running on a physical device, e.g. `http://192.168.1.100:3000`).
- **Production**: The live production URL (e.g., `https://api.example.mako.dev`).

## Authentication Headers

All authenticated requests must include the token obtained during the login flow:
```http
Authorization: Bearer <accessToken>
```

## Supported Endpoints

The mobile app primarily relies on the standard REST API endpoints defined by `api-rust`, including:
- `POST /api/v1/auth/login`: Issue tokens.
- `POST /api/v1/auth/register`: Create a new user.
- `POST /api/v1/auth/{provider}-auth`: Social OAuth token verification (e.g., `google-auth`, `facebook-auth`).
- `GET /api/v1/users/me`: Fetch the current user profile.
- `GET /api/v1/workspaces`: Fetch the user's active workspaces.
