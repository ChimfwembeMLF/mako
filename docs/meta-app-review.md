# Meta App Review — Mako submission kit

Paste-ready copy and screencast scripts for Facebook / Instagram / WhatsApp / Ads Advanced Access.

Official docs:

- [App Review introduction](https://developers.facebook.com/docs/resp-plat-initiatives/app-review/introduction/)
- [Screen recordings](https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/)
- [Permissions reference](https://developers.facebook.com/docs/permissions)

**Finish Business Verification before submitting App Review.**

---

## 1. App verification details (paste into submission)

```
App name: Mako (Tekrem Innovation Solutions)
App URL: https://mako.tekreminnovations.com
Privacy Policy: https://mako.tekreminnovations.com/privacy
Terms of Service: https://mako.tekreminnovations.com/terms
Data Deletion Instructions: https://mako.tekreminnovations.com/data-deletion

TEST ACCOUNT (Mako login — email/password, not Facebook Login):
Email: [REVIEWER_EMAIL]
Password: [REVIEWER_PASSWORD]

Pre-setup for reviewers:
1. Workspace already exists with Brand Brain filled.
2. Facebook Page “[PAGE_NAME]” and linked Instagram Professional account are ready to connect (or already connected — see notes per video).
3. No 2FA on the Mako test account.
4. English UI.

How to access the Meta features:
1. Open https://mako.tekreminnovations.com and Sign in with the credentials above.
2. Open sidebar → Connections (/publisher) to connect Facebook / Instagram / WhatsApp.
3. Open Content Engine (/content) to create and publish posts.
4. Open Social Inbox (/replies) to pull comments and reply to DMs.
5. Open Ads (/ads) for Meta ad campaigns.
6. Open WhatsApp (/whatsapp) for WhatsApp Business messaging.

Please follow the attached screencasts exactly. Each video is labeled with the permission being demonstrated.
```

Replace bracketed placeholders before submit.

---

## 2. Permissions Mako requests

From `api/src/modules/social_accounts/social_accounts-oauth.scopes.ts`:

| Product | Permissions |
|---------|-------------|
| Facebook Pages | `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `pages_manage_engagement` |
| Ads | `ads_read`, `ads_management`, `business_management` |
| Instagram | `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_messages` |
| WhatsApp | `business_management`, `whatsapp_business_management`, `whatsapp_business_messaging` |

Only submit permissions you can demo end-to-end in a screencast.

**Prerequisite:** at least one successful Graph API call per permission within ~30 days before requesting Advanced Access.

---

## 3. Per-permission use cases (paste into each permission)

### `pages_show_list`

```
Mako is a social publishing platform. After a Page admin connects Facebook in Connections, we list the Facebook Pages they manage so they can choose which Page to link to their workspace. We use pages_show_list only to show that Page list and store the selected Page ID for publishing and inbox features.
```

### `pages_manage_posts`

```
Mako lets Page admins create posts in Content Engine and publish or schedule them to their connected Facebook Page. We use pages_manage_posts only to create, update, or delete posts/photos/videos on Pages the user explicitly connected. We do not post to Pages the user did not select.
```

### `pages_read_engagement`

```
After a post is published, Mako’s Social Inbox pulls comments and engagement from the connected Facebook Page so the user can review conversations in one place. We use pages_read_engagement only to read comments and related engagement on Pages the user connected, and to display them in Social Inbox.
```

### `pages_manage_engagement`

```
From Social Inbox, Page admins reply to Facebook Page comments without leaving Mako. We use pages_manage_engagement only to create replies (and manage comment engagement) on behalf of the connected Page after the user clicks Send.
```

### `instagram_basic`

```
Mako connects Instagram Professional accounts that are linked to a Facebook Page. We use instagram_basic to identify the connected Instagram Business/Creator profile and show it in Connections so the user can publish and manage comments for that account.
```

### `instagram_content_publish`

```
Mako lets users create image/video posts in Content Engine and publish them to their connected Instagram Professional account. We use instagram_content_publish only to create and publish media content to that connected Instagram account after the user chooses Instagram as a destination and confirms publish/schedule.
```

### `instagram_manage_comments`

```
Mako’s Social Inbox shows Instagram comments on published posts and lets the user reply from Mako. We use instagram_manage_comments only to read and reply to comments on the Instagram Professional account the user connected.
```

### `instagram_manage_messages`

```
Mako’s Social Inbox (All inbox) shows Instagram Direct conversations for the connected Professional account and lets the user send replies. We use instagram_manage_messages only to read and respond to Instagram DMs for accounts the user connected, to help businesses manage customer messages in one inbox.
```

### `ads_read`

```
Mako’s Ads product lets marketers view Meta (Facebook/Instagram) ad campaign performance inside Mako. We use ads_read only to read ad account, campaign, and metrics data for ad accounts the user authorized, and to display that data in Ads.
```

### `ads_management`

```
Mako’s Ads product lets marketers create and publish Meta ad campaigns (Facebook & Instagram) from Ads → Create Campaign, then publish/pause them. We use ads_management only to create and manage campaigns/ad sets/ads on Meta ad accounts the user authorized through Connections / Facebook Login.
```

### `business_management`

```
Mako needs business_management so users can select the correct Meta Business assets (Pages, ad accounts, WhatsApp Business Accounts) they administer when connecting Facebook, Ads, or WhatsApp. We use it only to list and associate assets the user owns or manages with their Mako workspace; we do not manage unrelated businesses.
```

### `whatsapp_business_management`

```
Mako’s WhatsApp hub lets businesses connect their WhatsApp Business Account and phone number via Meta OAuth in Connections. We use whatsapp_business_management only to list WhatsApp Business Accounts and phone numbers the user manages, and to store the selected phone number ID for messaging in that workspace.
```

### `whatsapp_business_messaging`

```
After WhatsApp is connected, Mako sends and receives customer messages (including approved templates) via Social Inbox → WhatsApp and the WhatsApp hub. We use whatsapp_business_messaging only to send messages/templates and process inbound messages for the phone number the user connected, for customer support and marketing follow-up.
```

### Facebook Login (`email` / `public_profile`) — if requested

```
Optional: users may sign in to Mako with Facebook. We use public_profile and email only to create or match their Mako account (name, email, profile id). Separately, Facebook Login for Business in Connections is used to grant Page/Instagram/WhatsApp/Ads permissions described above. We do not use Facebook Login data for advertising to non-users of Mako.
```

---

## 4. Screencast scripts (shot-by-shot)

### Recording prep

- Log out of Mako and Facebook (clean browser profile recommended).
- English UI, large cursor, 1080p+, record browser window only.
- No microphone audio (reviewers ignore it).
- Annotate each permission at the moment it is used.
- Always end with proof on Meta (Page / Instagram / Ads Manager / phone), not only a Mako toast.
- Have a Facebook Page + linked Instagram Professional ready; pre-stage a test comment/DM where needed.

### Video 01 — Login + Connect Facebook

**Permissions:** `pages_show_list` (+ consent for Page scopes)

| Time | Action | On-screen note |
|------|--------|----------------|
| 0:00 | Start on Mako login (`/auth`), logged out | `Start: logged out of Mako` |
| 0:10 | Sign in with email/password (test account) | `Mako login (email/password)` |
| 0:25 | Open **Connections** (`/publisher`) | `Sidebar → Connections` |
| 0:35 | Click **Connect** on **Facebook** | `Start Facebook Login for Business` |
| 0:45 | Complete Meta login + consent; pause so scopes are readable | `User grants Page permissions` |
| 1:10 | Page picker sheet appears | `pages_show_list — list managed Pages` |
| 1:20 | Select demo Page → finalize | `User selects Page to connect` |
| 1:35 | Show Facebook card as **Connected** | `Page linked to workspace` |

### Video 02 — Facebook publish

**Permissions:** `pages_manage_posts`

| Time | Action | On-screen note |
|------|--------|----------------|
| 0:00 | Logged in; Facebook Connected | `Facebook Page already connected` |
| 0:10 | **Content Engine** (`/content`) → new post | `Create post` |
| 0:25 | Caption + optional image from **Media** | — |
| 0:45 | Select **Facebook** | `Destination: Facebook Page` |
| 0:55 | **Publish** | `pages_manage_posts — publish` |
| 1:15 | Success in Mako | `Publish succeeded` |
| 1:25 | Open live Facebook Page; show the post | `Proof on facebook.com` |

### Video 03 — Facebook comments

**Permissions:** `pages_read_engagement`, `pages_manage_engagement`

| Time | Action | On-screen note |
|------|--------|----------------|
| 0:00 | Leave a public comment on the Video 02 Page post | `Test comment on live Page post` |
| 0:20 | **Social Inbox** (`/replies`) | `Social Inbox` |
| 0:30 | **Pull comments** | `pages_read_engagement — fetch comments` |
| 0:45 | **Comments** tab → open post with comment | `Comment visible in Mako` |
| 1:00 | Type reply → **Send** | `pages_manage_engagement — reply` |
| 1:25 | Refresh Facebook Page; show reply | `Proof on facebook.com` |

### Video 04 — Instagram connect + publish

**Permissions:** `instagram_basic`, `instagram_content_publish`

| Time | Action | On-screen note |
|------|--------|----------------|
| 0:00 | **Connections** → **Connect** on **Instagram** | `Connect Instagram Professional` |
| 0:15 | Meta consent; select Page linked to IG | `instagram_basic — identify IG account` |
| 0:45 | Instagram **Connected** | `IG Business linked` |
| 1:00 | **Content Engine** → post with image | `Create IG post` |
| 1:20 | Select **Instagram** → **Publish** | `instagram_content_publish` |
| 1:50 | Open Instagram; show published media | `Proof on Instagram` |

### Video 05 — Instagram comments + DMs

**Permissions:** `instagram_manage_comments`, `instagram_manage_messages`

**Part A — Comments**

| Time | Action | On-screen note |
|------|--------|----------------|
| 0:00 | Comment on the IG post from Video 04 | `Test IG comment` |
| 0:20 | **Social Inbox** → **Pull comments** | `instagram_manage_comments — read` |
| 0:40 | **Comments** → reply → Send | `instagram_manage_comments — reply` |
| 1:00 | Show reply on Instagram | `Proof on Instagram` |

**Part B — DMs**

| Time | Action | On-screen note |
|------|--------|----------------|
| 1:15 | Second IG account sends a DM to the Professional account | `Inbound IG DM` |
| 1:35 | **Social Inbox** → **All inbox** → open thread | `instagram_manage_messages — read` |
| 1:50 | Reply from Mako | `instagram_manage_messages — reply` |
| 2:05 | Show reply on Instagram | `Proof on Instagram` |

### Video 06 — Meta Ads

**Permissions:** `ads_read`, `ads_management`, `business_management`

| Time | Action | On-screen note |
|------|--------|----------------|
| 0:00 | Reconnect Facebook if needed; show ads scopes on consent | `business_management / ads scopes granted` |
| 0:30 | Open **Ads** (`/ads`) | `Ads product` |
| 0:40 | **Create Campaign** → **Facebook & Instagram (META)** | `ads_management — create` |
| 1:10 | Fill budget, copy, creative → save | — |
| 1:30 | **Publish** on the campaign | `ads_management — publish to Meta` |
| 2:00 | Open metrics / refresh stats | `ads_read — load metrics` |
| 2:15 | Optional: Ads Manager shows the campaign | `Proof in Ads Manager` |

### Video 07 — WhatsApp

**Permissions:** `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`

| Time | Action | On-screen note |
|------|--------|----------------|
| 0:00 | **Connections** → **Connect** on **WhatsApp** | `Meta WhatsApp OAuth` |
| 0:15 | Consent / business asset flow | `business_management + whatsapp_business_management` |
| 0:40 | Pick phone number → finalize | `Select WABA phone number` |
| 0:55 | WhatsApp **Connected** | — |
| 1:05 | **WhatsApp** (`/whatsapp`) connection status | `WhatsApp hub` |
| 1:20 | Optional: pull templates from Meta | `Templates from Meta` |
| 1:35 | Phone messages the business number | `Inbound customer message` |
| 1:50 | **Social Inbox** → **WhatsApp** → reply (or approved template) | `whatsapp_business_messaging` |
| 2:15 | Show message on the phone | `Proof on WhatsApp` |

---

## 5. Submission mapping

| Permission | Video | Cue |
|------------|-------|-----|
| `pages_show_list` | 01 | Page picker |
| `pages_manage_posts` | 02 | Publish + live Page |
| `pages_read_engagement` | 03 | Pull comments |
| `pages_manage_engagement` | 03 | Send reply |
| `instagram_basic` | 04 | Connect success |
| `instagram_content_publish` | 04 | Publish + IG proof |
| `instagram_manage_comments` | 05A | Reply |
| `instagram_manage_messages` | 05B | DM reply |
| `ads_read` / `ads_management` / `business_management` | 06 | Create / publish / metrics |
| WhatsApp trio | 07 | Connect + send |

In each permission form field, add: `See Video 0X at [timestamp].`

---

## 6. Dashboard checklist

- [ ] Business Verification approved; app claimed by that Business Manager
- [ ] Privacy, Terms, Data Deletion URLs live on production domain
- [ ] Data deletion callback configured and working
- [ ] Each permission has written allowed-use text (section 3)
- [ ] Each permission has a screencast segment (section 4)
- [ ] Reviewer test credentials work without developer help
- [ ] No “coming soon” UI for requested scopes
- [ ] Successful API calls logged per permission recently
- [ ] App icon, category, and contact email filled in App Dashboard

---

## 7. Related product docs

- User: [Getting started](./user/getting-started.md), [How to manage content](./user/how-to-manage-content.md), [After you publish](./user/after-you-publish.md)
- Legal UI: `/privacy`, `/terms`, `/data-deletion`
- Scopes source: `api/src/modules/social_accounts/social_accounts-oauth.scopes.ts`
