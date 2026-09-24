# Quickstart: Validation Guide for System-Wide Tours

## Prerequisites

1. Have a valid user account logged into the application.
2. The user account must NOT have the `tours.dashboard` or `tours.content-engine` preference set to completed. (You can clear this in the DB or use a fresh user).

## Test Scenario 1: Main Page Auto-Start

1. Navigate to the main `/dashboard`.
2. **Expected**: The tour for the Dashboard automatically starts because the user's `preferences.tours.dashboard` is undefined or false.
3. Click "Next" through the steps and finally click "Finish" (or click "Skip" / the X button).
4. **Expected**: An API call is sent to `PATCH /api/v1/users/me/preferences` with `{ "tours": { "dashboard": { "completed": true } } }`.
5. Refresh the page.
6. **Expected**: The tour does **not** auto-start again.

## Test Scenario 2: Manual Trigger for Deep Micro-Tours

1. Navigate to a page with a modal or sheet (e.g. Media Library upload modal or a specific complex filter).
2. **Expected**: No tour auto-starts.
3. Open the modal/sheet.
4. Click the contextual "Help/Tour" button (e.g. `?` icon) near the modal header.
5. **Expected**: The tour starts immediately, correctly highlighting the elements inside the modal.

## Test Scenario 3: Dynamic Element Readiness

1. Trigger a tour that relies on dynamic data (e.g., Content Engine generated list).
2. Ensure network throttling is on (e.g. Slow 3G in browser dev tools) so elements take a second to render.
3. **Expected**: The tour Engine waits gracefully for the element to appear in the DOM (up to 3 seconds) before drawing the highlight, preventing UI breakage or misplaced highlights.

## API Validation

To manually check if your preferences are saved:
```bash
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <your-jwt>"
```
Verify `preferences.tours` contains your completed tours.
