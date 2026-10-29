---
version: 1
name: Coral Trust Mobile
colors:
  primary: "#FF6A55"
  on-primary: "#FFFFFF"
  surface: "#FFFFFF"
  surface-alt: "#FAF9F6"
  surface-contrast: "#1A2138"
  on-surface: "#1A2138"
  on-surface-variant: "#6A6F7E"
  on-surface-muted: "#A0A4B0"
  border: "#F0EFEA"
  warning: "#F5A623"
  illus-coral-bg: "#FFF0EE"
  illus-warm-yellow: "#F5C842"
  illus-warm-orange: "#E89A4A"
  illus-neutral-cream: "#E8DFD3"
  illus-cool-blue: "#1E3A5F"
typography:
  display-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: 800
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: 800
    lineHeight: 26px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: 800
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 700
    lineHeight: 22px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: 500
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 700
    lineHeight: 18px
    letterSpacing: -0.005em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 700
    lineHeight: 16px
    letterSpacing: 0em
  label-uppercase:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: 600
    lineHeight: 14px
    letterSpacing: 0.08em
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  card-padding: 16px
  section-gap: 24px
icons:
  set: lucide
  default_variant: line
  active_variant: line
  stroke_weight: 2px
  default_size: 24px
shadows:
  soft-card: "0 12px 32px -8px rgba(26, 33, 56, 0.08)"
  floating-nav: "0 20px 40px -10px rgba(26, 33, 56, 0.4)"
  btn: "0 8px 20px -6px rgba(255, 106, 85, 0.4)"
components:
  card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    borderWidth: 1px
    rounded: "{rounded.xl}"
    padding: 16px
    # box-shadow: shadows.soft-card
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    paddingX: 24px
    paddingY: 12px
    # box-shadow: shadows.btn
    pressedBackground: "#FA5B45"
  button-icon:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    size: 40px
    iconSize: 18px
    # box-shadow: shadows.btn
  input-text:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    borderWidth: 1px
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    paddingX: 20px
    paddingY: 8px
    # box-shadow: shadows.soft-card
  badge-pill:
    backgroundColor: "{colors.surface-contrast}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    paddingX: 12px
    paddingY: 6px
    iconSize: 14px
    gap: 6px
  badge-stat:
    backgroundColor: "{colors.border}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.sm}"
    paddingX: 8px
    paddingY: 4px
    gap: 4px
  avatar:
    rounded: "{rounded.full}"
    size: 24px
    borderColor: "{colors.surface}"
    borderWidth: 2px
  icon-button:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    borderWidth: 1px
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    size: 44px
    iconSize: 20px
    # box-shadow: shadows.soft-card
  category-tile:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    borderWidth: 1px
    rounded: "{rounded.xl}"
    padding: 16px
    width: 104px
    # box-shadow: shadows.soft-card
  tab-bar:
    backgroundColor: "{colors.surface-contrast}"
    rounded: "{rounded.full}"
    paddingX: 32px
    paddingY: 20px
    # box-shadow: shadows.floating-nav
  tab-item-active:
    textColor: "{colors.on-primary}"
    iconSize: 24px
  tab-item-inactive:
    textColor: "rgba(255,255,255,0.4)"
    iconSize: 24px
---

# Coral Trust Mobile

## Overview

**Confident. Warm. Reassuring.** This aesthetic pairs a deep slate-indigo (the trust anchor) with an energetic warm coral (the action accent) on a crisp warm off-white canvas. The result feels like a service-oriented, locally-warm tech app — professional enough to handle a transaction, friendly enough to feel like a neighbor's recommendation.

The mood is *premium-everyday*: rounded everything, soft elevated cards, generous whitespace, and one bright accent color carrying every call-to-action. Typography is heavy at the top of the hierarchy (extrabold 800 headings) and warm-medium in the body, giving each screen a confident editorial feel without becoming shouty. A floating dark pill nav at the bottom anchors the screen with high contrast against the cream surface.

The aesthetic resists drabness through three signature moves: (1) a single saturated coral that owns CTAs, accents, and brand sparks, (2) layered soft shadows that lift cards off the cream surface without ever using a hard line, and (3) extrabold display weight as a visual personality.

## Colors

The palette splits into four roles. Boundaries are strict.

- **Chrome**: `{colors.surface}` (white) is the card and input fill; `{colors.surface-alt}` (warm off-white #FAF9F6) is the page background. `{colors.border}` (#F0EFEA) is the slightly-darker hairline used on card edges and as the fill of secondary stat chips.
- **Ink**: `{colors.on-surface}` (deep slate-indigo #1A2138) carries primary text and headings. `{colors.on-surface-variant}` is for secondary metadata, and `{colors.on-surface-muted}` for tertiary captions. Slate-indigo is also the fill for the floating nav and high-contrast pill badges.
- **Brand action**: `{colors.primary}` (warm coral #FF6A55) is reserved for primary CTAs, the icon-button on the search field, the active-state dot in the tab bar, notification dots, link-style "see all" links, and the small accent icon inside contrast badges. Coral never fills a card or large surface.
- **Illustration / photography**: portraits and scene photography use natural color, but the recurring solid-color portrait backdrops (warm yellow, warm orange, neutral cream) become the categorical color language for the system. Tokens `illus-warm-yellow`, `illus-warm-orange`, `illus-neutral-cream`, `illus-cool-blue` document the recurring set. These NEVER bleed into UI chrome roles — no coral cards, no yellow buttons.

Semantic: `{colors.warning}` (#F5A623) appears as the rating star fill only. No green/red semantic system was observed.

Tinted accent fills (e.g. `#FFF0EE` behind an active category icon) are derived as ~10% coral on white — used sparingly to mark a "brand-relevant" category or selection.

## Typography

**Plus Jakarta Sans** across the entire system, weights 400/500/600/700/800. The voice is geometric-but-warm with friendly rounded terminals — confident without being corporate.

Weight strategy is the load-bearing typographic decision:

- **Extrabold 800** is the display/heading personality (`{typography.display-md}`, `{typography.headline-lg}`, `{typography.headline-md}`). Section titles, card subject names, and price numerals all carry 800 — they're the loudest element on the screen.
- **Bold 700** is the workhorse for chip/button labels and small card titles (`{typography.headline-sm}`, `{typography.label-md}`, `{typography.label-sm}`).
- **Semibold 600** is reserved for tracked-out uppercase eyebrows (`{typography.label-uppercase}`) — a load-bearing detail used for "YOUR LOCATION" / "HOURLY RATE" style metadata kickers.
- **Medium 500** is body and secondary info (`{typography.body-md}`, `{typography.body-sm}`, `{typography.caption}`). Plain Regular 400 is essentially unused.

Tracking is consistently negative on headings (-0.01 to -0.02em) for tight, modern compression, and positive (~0.08em) on uppercase eyebrows for the editorial tracked-caps look. Body sits at 0.

Numerals (price, rating, distance) inherit the heading weight family — large prices are extrabold 800 to act as a visual anchor next to the CTA.

## Spacing & Layout

Density is **balanced-airy**. Side gutter is `{spacing.gutter}` (24px) — generous but not cavernous. Cards breathe with `{spacing.card-padding}` (16px) internal padding plus an additional 4px text inset that lets type sit slightly inboard of the card's image well.

Vertical rhythm uses `{spacing.section-gap}` (24px) between major sections and 16–20px within a section. Inline icon-to-text gap defaults to 6–8px (small, intimate). Negative gaps (-space-x-2) are used for the overlapping micro-avatar stacks.

Horizontal scrollers (categories) extend to the right edge of the screen — content begins at the gutter, but cards continue beyond the gutter so the next item is visibly clipped, signaling scroll affordance.

The floating bottom nav sits 24px above the bottom edge, centered, narrower than the screen (~345px in a 393px frame), so the cream surface frames it on all four sides.

## Elevation & Depth

Three explicit recipes, all soft and downward-blurred (no hard borders for elevation):

- **soft-card**: `0 12px 32px -8px rgba(26, 33, 56, 0.08)` — every elevated card, the search bar, the bell icon button, category tiles. The shadow is tinted slate-indigo (not gray) so it warms into the cream surface.
- **btn**: `0 8px 20px -6px rgba(255, 106, 85, 0.4)` — coral-tinted glow under primary buttons and the search submit button. The button casts its own colored aura.
- **floating-nav**: `0 20px 40px -10px rgba(26, 33, 56, 0.4)` — dramatic, deep dark cast under the floating bottom nav, anchoring it firmly above the surface.

Cards always combine shadow + 1px hairline border (`{colors.border}` at ~30% opacity) — the border provides crispness, the shadow provides float. Removing either flattens the system.

## Shapes

The shape philosophy is **fully rounded, never sharp**. Radius scale:

- `{rounded.sm}` (8px) — small inline chips like the rating stat badge.
- `{rounded.md}` (16px) — the inner icon container inside category tiles (a square-ish soft tile).
- `{rounded.lg}` (24px) — image wells inside cards (the 16px image radius is also valid; treat lg as a flexible mid-tier).
- `{rounded.xl}` (32px) — the primary card silhouette and category tile silhouette. This is the signature radius — large, generous, friendly.
- `{rounded.full}` — every interactive control (buttons, pills, search bar, icon buttons, the bottom nav itself, all avatars and overlay buttons).

Rule of thumb: any element a finger touches is fully rounded. Any container holding content is `{rounded.xl}`. Inline accents drop to `{rounded.sm}`.

## Components

### card

The signature container — generous radius, soft shadow, hairline border, white fill on a cream page. Internal layout typically pairs an image well (rounded inner 16px) with a text region.

```html
<div class="bg-white border border-[#F0EFEA]/30 rounded-[32px] p-4 shadow-[0_12px_32px_-8px_rgba(26,33,56,0.08)]">
  <div class="relative w-full h-44 rounded-2xl overflow-hidden mb-4">
    <img src="[image-url]" alt="[alt]" class="w-full h-full object-cover">
    <!-- overlay badges/buttons go here -->
  </div>
  <div class="px-1">
    <div class="flex justify-between items-start mb-1">
      <h3 class="text-lg font-extrabold tracking-tight">[Card title]</h3>
      <!-- inline stat badge -->
    </div>
    <p class="text-sm text-[#1A2138]/60 font-medium mb-4 flex items-center gap-1.5">
      <iconify-icon icon="lucide:[icon-name]" class="text-xs"></iconify-icon> [Subtitle] · [Meta]
    </p>
    <div class="flex items-center justify-between mt-5 pt-4 border-t border-[#F0EFEA]/60">
      <div class="flex flex-col">
        <span class="text-[11px] text-[#1A2138]/50 font-semibold uppercase tracking-wider">[Eyebrow]</span>
        <span class="text-lg font-extrabold">[Value]</span>
      </div>
      <!-- primary CTA -->
    </div>
  </div>
</div>
```

### button-primary

Coral pill with white extrabold label, coral-tinted shadow glow, active scale-95 press feedback.

```html
<button class="bg-[#FF6A55] text-white px-6 py-3 rounded-full font-bold text-sm shadow-[0_8px_20px_-6px_rgba(255,106,85,0.4)] hover:bg-[#FA5B45] active:scale-95 transition">
  [Action label]
</button>
```

### button-icon (coral submit)

A 40×40 coral circle used in the trailing slot of the search bar or as a primary inline action.

```html
<button class="w-10 h-10 bg-[#FF6A55] rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_-6px_rgba(255,106,85,0.4)] active:scale-95 transition-transform">
  <iconify-icon icon="lucide:[icon-name]" class="size-[18px]"></iconify-icon>
</button>
```

### input-text (search-bar style)

Pill-shaped white input with leading icon, soft-card shadow, optional trailing coral icon-button. The input itself uses no border-radius of its own — the wrapper carries the pill shape.

```html
<div class="relative flex items-center bg-white border border-[#F0EFEA]/30 rounded-full p-2 pl-5 shadow-[0_12px_32px_-8px_rgba(26,33,56,0.08)]">
  <iconify-icon icon="lucide:[icon-name]" class="size-5 text-[#1A2138]/40"></iconify-icon>
  <input type="text" placeholder="[Placeholder]" class="bg-transparent border-none outline-none flex-1 px-3 text-sm font-medium placeholder:text-[#1A2138]/40 text-[#1A2138]">
  <button class="w-10 h-10 bg-[#FF6A55] rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_-6px_rgba(255,106,85,0.4)]">
    <iconify-icon icon="lucide:[icon-name]" class="size-[18px]"></iconify-icon>
  </button>
</div>
```

### icon-button (chrome)

44×44 white circle with hairline border + soft shadow, used in headers (notifications, profile shortcuts). May carry a coral notification dot offset top-right.

```html
<button class="w-11 h-11 bg-white border border-[#F0EFEA]/50 rounded-full flex items-center justify-center shadow-[0_12px_32px_-8px_rgba(26,33,56,0.08)] relative">
  <span class="absolute top-2.5 right-2.5 w-2 h-2 bg-[#FF6A55] rounded-full border-2 border-white"></span>
  <iconify-icon icon="lucide:[icon-name]" class="size-5 text-[#1A2138]"></iconify-icon>
</button>
```

### badge-pill (high-contrast overlay)

Slate-indigo pill with white bold text and a small coral leading icon. Used as an overlay on imagery (top-left of image wells) for trust/status callouts.

```html
<div class="bg-[#1A2138] text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-sm bg-opacity-95 border border-white/10">
  <iconify-icon icon="lucide:[icon-name]" class="size-[14px] text-[#FF6A55]"></iconify-icon>
  <span class="text-xs font-bold tracking-wide">[Status label]</span>
</div>
```

### badge-stat (inline rating-style)

Compact rectangular chip with `{rounded.sm}`, neutral fill, used to display an inline numeric stat (rating, count) next to a card title.

```html
<div class="flex items-center gap-1 bg-[#F0EFEA] px-2 py-1 rounded-lg">
  <iconify-icon icon="lucide:[icon-name]" class="size-[14px] text-[#F5A623] fill-current"></iconify-icon>
  <span class="text-sm font-bold">[Value]</span>
</div>
```

### avatar (micro stack)

24px circular crops with a 2px white border, overlapped by -8px (`-space-x-2`). The "+N" overflow is the same circle shape filled with `{colors.border}` and centered tiny bold numeric text.

```html
<div class="flex -space-x-2">
  <img src="[image-url]" alt="" class="w-6 h-6 rounded-full border-2 border-white object-cover shadow-sm">
  <img src="[image-url]" alt="" class="w-6 h-6 rounded-full border-2 border-white object-cover shadow-sm">
  <div class="w-6 h-6 rounded-full border-2 border-white bg-[#F0EFEA] flex items-center justify-center text-[9px] font-bold text-[#1A2138]/60 shadow-sm">+[N]</div>
</div>
```

### category-tile

A small fixed-width card (~104px) for horizontal scrollers. Stacks: tinted icon-square → bold label → micro-avatar stack. The first / brand-relevant tile uses the coral-tint icon background (`#FFF0EE` + coral icon); other tiles use a 5%-slate-indigo neutral tint.

```html
<div class="shrink-0 flex flex-col items-center min-w-[104px] bg-white p-4 rounded-3xl border border-[#F0EFEA]/20 shadow-[0_12px_32px_-8px_rgba(26,33,56,0.08)]">
  <div class="w-12 h-12 bg-[#1A2138]/5 rounded-2xl flex items-center justify-center mb-3 text-[#1A2138]">
    <iconify-icon icon="lucide:[icon-name]" class="size-6"></iconify-icon>
  </div>
  <span class="text-sm font-bold mb-3">[Category label]</span>
  <!-- avatar stack -->
</div>
```

### tab-bar (floating dark pill)

Slate-indigo full-radius pill, ~345px wide, floats 24px above the bottom edge with a deep shadow. Active item is a white icon with a 4px coral dot 12px below it; inactive items are white at 40% alpha.

```html
<nav class="absolute bottom-6 left-1/2 -translate-x-1/2 w-[345px] bg-[#1A2138] rounded-full px-8 py-5 shadow-[0_20px_40px_-10px_rgba(26,33,56,0.4)]">
  <ul class="flex justify-between items-center">
    <li>
      <a href="#" class="flex flex-col items-center gap-1 group relative">
        <iconify-icon icon="lucide:[icon-name]" class="size-6 text-white group-active:scale-90 transition-transform"></iconify-icon>
        <span class="absolute -bottom-3 w-1 h-1 bg-[#FF6A55] rounded-full"></span>
      </a>
    </li>
    <li>
      <a href="#" class="flex flex-col items-center gap-1 group">
        <iconify-icon icon="lucide:[icon-name]" class="size-6 text-white/40 group-hover:text-white/80 group-active:scale-90 transition-all"></iconify-icon>
      </a>
    </li>
  </ul>
</nav>
```

## Iconography

**Lucide**, line variant only — `stroke-width: 2`, square-cap-leaning, friendly geometric proportions. Active vs. inactive is conveyed by **color/opacity, not by switching to a fill variant** (white at 100% vs white at 40% in the floating nav; coral vs. slate-indigo elsewhere). Icons stay outlined throughout, which is part of the system's lightness.

Rule for icon size:
- 14–16px for inline-with-text icons (subtitle metadata, badge leading icons)
- 18–20px for input-bar / button-icon glyphs
- 24px for chrome (top bar, tab bar, category tiles)

The single exception to the line-only rule is the rating star, which uses `fill-current` at warning amber `#F5A623`.

Universal-role icons (notifications bell, location pin, chevron-down, search, sliders, heart, home, calendar, message, user) keep their concrete Lucide names since they describe a UI role, not a domain.

## Illustration & Imagery

**Style / Technique**: photographic portrait and scene photography, naturally lit, slightly warmed in grade. Two distinct treatments coexist: (1) **studio portrait** with a flat solid-color seamless backdrop in a saturated warm hue (yellow, orange, cream, or muted neutral), tight head-and-shoulders crop; (2) **environmental scene** of a person in a soft, light-flooded interior (kitchen, living room) holding the tools of their context. Both share a clean, modern, shallow-depth-of-field commercial-photography sensibility.

**Palette**: warm and natural. Backdrops in studio portraits draw from `illus-warm-yellow` (#F5C842), `illus-warm-orange` (#E89A4A), and `illus-neutral-cream` (#E8DFD3). Subjects wear muted earthy or workwear tones (navy, denim blue, soft browns, white). Environmental scenes are dominated by light neutrals (off-white walls, warm wood, soft greenery). 3–5 dominant tones per image, never neon, never desaturated to gray.

**Edge treatment**: none — these are photographs. The container provides the edge.

**Shading & light**: soft, diffused, slightly warm key light — the sort of bright-overcast or large-softbox lighting that flatters skin and mutes harsh shadows. No hard edge-light, no dramatic chiaroscuro.

**Composition & framing**: portraits are tightly cropped (head-and-shoulders, subject occupies ~55–65% of frame), eye-level, often with a slight off-center compositional bias (rule-of-thirds head placement). Scene photography frames the subject at chest-up to waist-up, centered, with environmental context blurred behind. Subjects look at camera with a warm, professional smile or a calm confident expression.

**Background within the illustration**: studio portraits — single flat saturated color, completely uniform. Scene photographs — softly defocused realistic interior, never busy.

**Container styling**: image wells live inside a card. The image well is `rounded-2xl` (16px) with `overflow-hidden`, occupies full card width, height 176px (`h-44`). The well sits inside a `{rounded.xl}` (32px) parent card with 16px padding, so the image is visibly inboard of the card silhouette. No additional border on the image well — the parent card carries the hairline.

**CSS treatment on the `<img>`**: `object-cover`, `w-full h-full`. No blend modes, no opacity reduction, no filter. Photos render at full fidelity.

**Box-shadow on the image or its frame**: none on the image itself — it sits flat inside its well. The parent card carries the soft-card shadow that lifts the entire composition.

**Aspect ratio rule**: the image well is roughly 16:9 (full card width × 176px). Crop rather than letterbox; preserve the subject's face/upper body in frame.

**Anti-references**: NOT illustration, NOT vector, NOT 3D-rendered, NOT claymation, NOT pastel-tinted, NOT desaturated editorial, NOT high-contrast moody, NOT collage, NOT cutout-with-hard-shadow.

**Style recipe prompt**:

> *Professional commercial photograph of [SUBJECT], natural warm lighting, clean and friendly mood. Either: (a) studio portrait against a flat saturated warm-color seamless backdrop (warm yellow, warm orange, or neutral cream), tight head-and-shoulders crop, eye-level, subject smiling warmly or showing calm confident expression, off-center compositional placement; OR (b) environmental scene in a bright softly-defocused modern interior, subject at chest-up to waist-up holding context-relevant items, warm overcast key light. Subject wears muted earthy or workwear tones. Shallow depth of field, soft natural shadows, clean modern commercial photography sensibility. NOT illustration, NOT 3D, NOT vector, NOT desaturated, NOT moody, NOT collage.*

The 24px micro-avatars use the same photography style, square-cropped to a circle with the face centered.

## Hierarchy & Emphasis

Weight, color, and shadow stack to create three hierarchy tiers:

- **Loud**: extrabold 800 + slate-indigo + on a white card with full soft-card shadow (primary card titles, big numerals). Coral CTA buttons are loud through color saturation + their own colored shadow.
- **Medium**: bold 700 in slate-indigo, no shadow, on neutral or border-tinted chips (rating chips, category labels).
- **Whisper**: medium 500 at 50–60% slate-indigo opacity, often paired with tiny inline icons (subtitles, distance, "1.2 mi away" metadata). Uppercase tracked-out semibold 600 at 50% opacity for eyebrows ("YOUR LOCATION", "HOURLY RATE").

Saturated coral is reserved — never used for text-on-card, never used as a card fill. Coral is the visual reward at the moment of decision (the CTA, the "see all" link, the active-state dot).

## Distinctive Details

1. **The coral submit button inside the search pill.** The white search bar already has a soft shadow; nesting a coral icon-circle (with its own coral-glow shadow) inside the trailing slot creates a button-within-a-button moment that announces "this is where action happens" on every screen.
2. **High-contrast overlay pills on imagery.** Slate-indigo pill + coral leading icon + white tracked label, sitting on top of a photograph. The coral icon is the single saturated spark in an otherwise dark chip — it becomes the recognizable "trust mark" pattern of the system.
3. **Layered shadow palette.** Three named shadow recipes, each tinted with intent: soft slate-indigo for cards (warm float), saturated coral for buttons (colored aura), deep slate-indigo for the floating nav (heavy anchor). Shadows are colored, not gray, and that's the system's depth signature.

## Do's and Don'ts

### Do

- Use coral exclusively for primary actions, accents, and brand sparks — one accent color carries the entire system.
- Pair every elevated card with both the soft-card shadow and a 1px `{colors.border}` hairline.
- Set headings and prices to extrabold 800 with negative tracking — that's the visual personality.
- Use Lucide line icons throughout; convey active state through opacity/color, not variant switching.
- Use `{rounded.full}` on every interactive control and `{rounded.xl}` on every content card.
- Use uppercase tracked-out semibold eyebrows above key numeric values.
- Place the floating dark tab bar centered with margin on all four sides above the cream surface.
- Apply the `btn` coral-tinted shadow to primary buttons — the colored glow is part of the button.

### Don't

- Don't use coral as a card or surface fill. It owns CTAs, not real estate.
- Don't switch to filled-icon variants for active state. Color/opacity does that job.
- Don't use hard black for shadows or text. Slate-indigo is the deepest dark in this system.
- Don't drop the hairline border on cards "for cleanliness" — shadow + border together is the recipe.
- Don't use Regular 400 for headings or labels. Bold 700 minimum at heading level, Extrabold 800 preferred.
- Don't crowd the gutter — 24px side inset is a feature, not a constraint.
- Don't introduce a second saturated accent color. The palette's restraint is what makes coral pop.
- Don't render imagery in any non-photographic style — illustration, vector, or 3D will break the trust photography establishes.
- Don't let the `illus-*` color tokens drift into UI chrome (no yellow buttons, no orange cards).
