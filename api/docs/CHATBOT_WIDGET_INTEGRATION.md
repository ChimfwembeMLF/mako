# Chatbot widget integration guide

Integrate the Mako chatbot via the **embed script** (fastest) or the **Widget REST API** (custom UI).

## Prerequisites

1. Enable **Widget** in AI Chatbot → Settings.
2. Create an API key in **Embed** tab (`pk_live_…`).
3. Upload knowledge documents (optional) for RAG-grounded answers.

## Option A — Embed script (recommended)

Add before `</body>`:

```html
<script
  async
  src="https://YOUR_APP_HOST/widget/v1/loader.js"
  data-key="pk_live_YOUR_KEY"
  data-api="https://YOUR_API_HOST"
></script>
```

The loader fetches config, renders the chat UI, and handles sessions automatically.

## Option B — REST API

Base URL: `https://YOUR_API_HOST`  
Auth header on every request:

```http
Authorization: Bearer pk_live_YOUR_KEY
Content-Type: application/json
```

### 1. Get configuration

```bash
curl -s "https://YOUR_API_HOST/api/v1/widget/config" \
  -H "Authorization: Bearer pk_live_YOUR_KEY"
```

### 2. Create a session

```bash
curl -s -X POST "https://YOUR_API_HOST/api/v1/widget/sessions" \
  -H "Authorization: Bearer pk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"visitorId":"user-123"}'
```

Response:

```json
{
  "sessionId": "uuid",
  "visitorId": "user-123",
  "welcomeMessageId": "uuid"
}
```

### 3. Send a message

```bash
curl -s -X POST "https://YOUR_API_HOST/api/v1/widget/sessions/SESSION_ID/messages" \
  -H "Authorization: Bearer pk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Visitor-Id: user-123" \
  -d '{"content":"What are your business hours?"}'
```

Response:

```json
{
  "messageId": "uuid",
  "role": "assistant",
  "content": "We are open Monday–Friday, 9am–5pm.",
  "citations": []
}
```

### 4. Text-to-speech (optional)

```bash
curl -s -X POST "https://YOUR_API_HOST/api/v1/widget/sessions/SESSION_ID/messages/MESSAGE_ID/speech" \
  -H "Authorization: Bearer pk_live_YOUR_KEY" \
  -H "X-Visitor-Id: user-123" \
  --output reply.mp3
```

Requires TTS enabled in chatbot settings.

## JavaScript example

```javascript
const API_BASE = 'https://YOUR_API_HOST';
const API_KEY = 'pk_live_YOUR_KEY';

async function widgetFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Bootstrap
const config = await widgetFetch('/api/v1/widget/config');
const { sessionId, visitorId } = await widgetFetch('/api/v1/widget/sessions', {
  method: 'POST',
  body: JSON.stringify({ visitorId: 'visitor-' + crypto.randomUUID() }),
});

// Chat loop
const reply = await widgetFetch(`/api/v1/widget/sessions/${sessionId}/messages`, {
  method: 'POST',
  headers: { 'X-Visitor-Id': visitorId },
  body: JSON.stringify({ content: 'Hello!' }),
});
console.log(reply.content);
```

## Node.js example

```javascript
const API_KEY = process.env.CHATBOT_API_KEY;
const API_BASE = process.env.API_PUBLIC_URL;

async function chat(userMessage, sessionId, visitorId) {
  const res = await fetch(`${API_BASE}/api/v1/widget/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'X-Visitor-Id': visitorId,
    },
    body: JSON.stringify({ content: userMessage }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

## OpenAPI specification

Standalone spec (Widget API only):

- **URL:** `{API_HOST}/docs/chatbot-widget.openapi.yaml`
- **File:** `autopilot-api/public/docs/chatbot-widget.openapi.yaml`

Interactive docs (full API, JWT + widget):

- **Swagger UI:** `{API_HOST}/documentation` → filter tag **Widget**

## Error codes

| Status | Meaning |
|--------|---------|
| 401 | Invalid or revoked API key |
| 403 | `X-Visitor-Id` does not match session |
| 404 | Session not found, or widget disabled |
| 400 | TTS not enabled (speech endpoint) |

## Security notes

- API keys are shown **once** at creation — store them securely.
- Revoke compromised keys immediately in the Embed tab.
- Use HTTPS in production.
- Do not expose keys in client-side code unless using the official embed (keys in public sites are expected for widgets; rotate if leaked).
