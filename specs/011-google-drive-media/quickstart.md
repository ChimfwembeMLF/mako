# Quickstart & Validation Guide: Google Drive Media

## Prerequisites
- Google Cloud Platform project with Google Drive API enabled.
- OAuth consent screen configured.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` added to `.env` for both API runtimes.

## End-to-End Validation

### 1. OAuth Connection
**Command/Action**: In the Mako UI (Integrations settings), click "Connect Google Drive".
**Expected**: Redirects to Google consent screen. After consent, redirects back to Mako and shows "Connected". Database has valid refresh token.

### 2. List Files
**Command/Action**: Navigate to Media Library -> Google Drive tab.
**Expected**: UI displays files from the user's Drive. API request returns 200 OK with a list of file metadata.

### 3. Import File
**Command/Action**: Select a file in the UI and click "Import".
**Expected**: API request returns 200 OK. The file is streamed from Google to S3, a new `MediaItem` record is created, and the file is visible in the general Media Library.
