# Mobile UI Shell Contract

**Feature**: `007-mobile-ui-parity` | **Date**: 2026-08-27

Visual and navigation contract aligning mobile with web Social shell (`client/src/lib/nav-config.ts`, `DESIGN.md`).

## Color tokens (light)

| Token | Hex | Usage |
|-------|-----|-------|
| primary | `#9fe870` | Primary CTA fill |
| on-primary | `#0e0f0c` | Text on primary |
| ink | `#0e0f0c` | Headings, input borders |
| body | `#454745` | Body copy |
| mute | `#868685` | Subtitles, meta |
| canvas | `#ffffff` | Cards, tab bar |
| canvas-soft | `#e8ebe6` | Screen background |
| positive-deep | `#054d28` | Success badges |
| negative | `#d03238` | Errors |

Dark mode: invert ink/canvas per web `.dark` CSS vars; primary lime unchanged.

## Typography

| Role | Font | Sizes |
|------|------|-------|
| Display / page titles | Manrope 600–800 | 24–32px |
| Body | Inter 400 | 14–16px |
| Buttons | Inter 600 | 16px |
| Captions / badges | Inter 400–600 | 12px |

## Layout

| Element | Spec |
|---------|------|
| Page header | 40×40 icon tile (`primary-pale` bg) + title + subtitle; optional right-aligned primary/outline action |
| Primary button | min-height 48px, radius 24px, lime fill |
| Outline button | ink 1px border, white fill |
| Card | white, radius 24px, no drop shadow |
| Tab bar | white bg, ink active label, mute inactive, top border `rgba(14,15,12,0.12)` |
| Stack header | white bg, ink title, no shadow |

## Bottom tabs (fixed)

| Tab | Route group | Notes |
|-----|-------------|-------|
| Home | `(tabs)/index` | Social dashboard + quick links |
| Content | `(tabs)/content` | Stack |
| Connect | `(tabs)/connections` | |
| Inbox | `(tabs)/inbox` | Stack |
| Schedule | `(tabs)/schedule` | Calendar + list |
| More | `(tabs)/more` | Permission-filtered menu |
| Profile | `(tabs)/profile` | Account summary |

*Note*: Profile may merge into More in implement if seven tabs feel crowded — Profile stays until tasks phase decides.

## More menu destinations (minimum 8 for SC-003)

Required entries when permission allows:

1. Brand Brain  
2. Media  
3. Post Templates  
4. Campaigns  
5. Analytics  
6. Settings  
7. Team  
8. Approvals  

Additional P3: Leads, Mail, WhatsApp, Auto-reply rules.

Locked items: show row with lock icon + “Not available for your role” — do not navigate.

## Core screen patterns

| Screen | Header title | Primary action |
|--------|--------------|----------------|
| Home | (hero, no duplicate header) | Create post |
| Content | Content Engine | New post |
| Scheduler | Scheduler | New post |
| Connections | Connections | — |
| Inbox | Social Inbox | Sync |
| Brand Brain | Brand Brain | Save |
| Media | Media | — |
| Templates | Post Templates | — |

## Feedback

| Event | UI |
|-------|-----|
| Save success | Toast success |
| Save/publish/reply failure | Toast error + inline error where applicable |
| Offline | Existing offline banner + toast |
| Empty list | EmptyState with CTA |

## Inbox thread

| Type | Layout |
|------|--------|
| DM inbound | Left-aligned white bubble, avatar initials |
| DM outbound | Right-aligned lime bubble |
| Comment | Selectable inbound bubble; green border when selected |
| Composer | Fixed bottom Input + Send (lime) |

## Scheduler

| Mode | UI |
|------|-----|
| Calendar | Month grid, platform-colored day chips, Today + prev/next |
| List | Card rows with SCHEDULED badge |
| Stats | Scheduled / Due today / Overdue counts |

## Auth screens

Centered card on `canvas-soft`, logo 120px, display title, ink-bordered inputs, lime Log in / Sign up, outline Google, ghost link to alternate auth.

Forgot password: link on login → email field → submit → opaque confirmation.

## Acceptance audit (SC-001)

Auditor checks six core tabs + one More destination for:

- [ ] PageHeader or HeroBanner present  
- [ ] Primary CTA uses lime Button  
- [ ] Background `canvas-soft`, cards white  
- [ ] Manrope/Inter loaded (not system fallback on device)  
- [ ] Empty state not blank  
