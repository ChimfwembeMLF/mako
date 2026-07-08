# WhatsApp menu bot (configurable)

Each workspace builds **its own menu** — not a fixed loan flow. Customers choose from your options via WhatsApp list/buttons or by typing `1`, `2`, `3`.

## Field guide (Lead Agent → WhatsApp tab)

| Field | What to enter |
|-------|----------------|
| **Enable for this workspace** | Turn on after WhatsApp is connected **and** you have saved at least one menu option. |
| **Business / service name** | Your brand name, e.g. `Tekrem Solutions`, `City Clinic`, `Acme Shop`. Appears in: *"Welcome to Tekrem Solutions"*. |
| **Custom welcome message (optional)** | Override the default welcome. Use `{serviceName}` as a placeholder, e.g. `Hello! Welcome to {serviceName}. Pick an option below.` |
| **Menu options** | What customers can choose. For each option: |
| → **Menu label** | Short name shown in the menu (max ~24 chars), e.g. `Pricing`, `Book appointment`, `Track order`. |
| → **Short hint** | Optional subtitle in the list, e.g. `See our packages`. |
| → **Reply when selected** | The WhatsApp message sent when they pick this option — hours, prices, link text, instructions, etc. |

**Starting the bot:** Customer sends `Hi`, `Hello`, `menu`, `start`, or `0`.

**After selection:** They get your reply text, then a **Main menu** button to choose again.

## Example menu (retail)

| Label | Reply |
|-------|--------|
| Store hours | Mon–Fri 8am–6pm, Sat 9am–1pm. Plot 3, Lusaka. |
| Delivery | We deliver in Lusaka for orders over ZMW 200. Reply with your area. |
| Talk to staff | Thanks — a team member will reply during business hours. |

## Example menu (services)

| Label | Reply |
|-------|--------|
| Request quote | Send your project details and we'll respond within 24 hours. |
| Our services | Branding, web design, social media management. |
| Support | Email support@example.com or wait for an agent here. |

## Setup

```bash
cd autopilot-api
npm run db:migrate   # includes menu_items column
```

1. Connect WhatsApp (Publisher Connect)
2. Lead Agent → WhatsApp → configure menu → **Save menu bot**
3. Enable the toggle → Save again
4. Message your WhatsApp number: `Hi`

## Technical notes

- Up to **10 menu options** per workspace
- **3 or fewer** options → reply buttons; **4+** → list message + numeric USSD fallback
- Session state in PostgreSQL (`whatsapp_flow_sessions`), 24h TTL
- Later: wire options to APIs (CRM, bookings, OTP) by extending `ConfigurableMenuFlow`

## API

```http
GET  /api/v1/whatsapp/flows/config?tenantId=
PATCH /api/v1/whatsapp/flows/config?tenantId=
```

```json
{
  "enabled": true,
  "serviceName": "Acme Shop",
  "welcomeMessage": "Welcome to {serviceName}!",
  "menuItems": [
    {
      "title": "Store hours",
      "description": "When we're open",
      "response": "Mon–Fri 8am–6pm…"
    }
  ]
}
```
