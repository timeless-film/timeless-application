# Timeless — Brand Design System

> Reference document for aligning the platform's visual theme with the Timeless Cinema brand identity.

---

## 1. Brand overview

Timeless Cinema is an **editorial, premium B2B marketplace**. The visual identity evokes the prestige of classic film heritage: stark black-and-white cinema frames contrasted with warm gold, generous typography, and a deliberately uncluttered layout. Every design decision should feel like it belongs in a film festival catalogue.

**Tone**: Prestigious · Heritage · Trust · Editorial  
**NOT**: Playful · Startup-generic · Over-engineered

---

## 2. Color palette

### Primary colors

| Name | Role | Hex | OKLCH |
|---|---|---|---|
| **Cinema Black** | Hero backgrounds, dark sections | `#0A0A0A` | `oklch(0.10 0 0)` |
| **Gold** | Primary actions, CTAs, icons, links, accents | `#F7B229` | `oklch(0.81 0.18 82)` |
| **White** | Text on dark backgrounds, card backgrounds | `#FFFFFF` | `oklch(1 0 0)` |

### Neutral palette

| Name | Role | Hex | OKLCH |
|---|---|---|---|
| **Off-white** | Page background (light sections) | `#F7F5F0` | `oklch(0.975 0.005 80)` |
| **Ink** | Body text, headings on light sections | `#1A1A1A` | `oklch(0.155 0 0)` |
| **Warm Gray** | Muted text, captions | `#6B6560` | `oklch(0.50 0.01 60)` |
| **Border** | Subtle dividers | `#E5E0D8` | `oklch(0.90 0.008 75)` |

### Gold tint scale (for states)

| Name | Usage | OKLCH |
|---|---|---|
| Gold hover | Button hover state | `oklch(0.74 0.18 82)` |
| Gold light | Backgrounds behind gold elements | `oklch(0.94 0.05 82)` |
| Gold foreground | Text on gold backgrounds | `oklch(0.10 0 0)` |

---

## 3. Typography

### Fonts in use

| Role | Font | Import |
|---|---|---|
| **Display / Headings** | Gloock | `next/font/google` — already loaded |
| **Body / UI** | Open Sans | `next/font/google` — already loaded |

Gloock is a **high-contrast editorial serif** with strong thick/thin strokes, ideal for large display sizes. Open Sans provides clean, legible neutrality for body copy, labels, and UI chrome.

### Type scale guidance

| Element | Font | Weight | Size guidance |
|---|---|---|---|
| Hero headline | Gloock | 400 (regular) | `text-6xl` – `text-8xl` |
| Section heading (H1) | Gloock | 400 | `text-4xl` – `text-5xl` |
| Sub-heading (H2) | Gloock | 400 | `text-2xl` – `text-3xl` |
| Card title | Gloock | 400 | `text-xl` |
| Body copy | Open Sans | 400 | `text-base` (`16px`) |
| Label / caption | Open Sans | 400 – 600 | `text-sm` |
| Overline (e.g. "A SIMPLE STEP BY STEP PROCESS") | Open Sans | 600 | `text-xs` uppercase + tracking-widest |

### Typography rules

- Headings **always** use Gloock — add `font-heading` utility everywhere a heading appears in the app.
- Never use Gloock below `text-lg`; it is only legible and effective at large sizes.
- Letter-spacing on body text: default (no manual tracking). On overlines/labels in caps: `tracking-widest`.

---

## 4. Spacing & radius

| Token | Value | Rationale |
|---|---|---|
| Base radius | `0.375rem` (6px) | Slightly sharper than current 10px — more editorial, less "SaaS rounded" |
| Button radius | `0.375rem` | Consistent with base |
| Card radius | `0.5rem` | Allows cards to breathe without looking toy-like |
| Input radius | `0.375rem` | Matches buttons |

---

## 5. Component guidance

### Buttons

- **Primary** (`bg-primary`): Deep black (`#0A0A0A`) background, white text. Used for secondary actions in the app.
- **Gold CTA** (custom `bg-gold` utility to be added): Gold background (`#F7B229`), white or black text. Used for the **main call-to-action** throughout the platform.
- **Outline**: Black border, black text, transparent background.
- Arrow (`→`) on CTAs (matching landing page convention).

### Sidebar & navigation

- Sidebar background: Cinema Black (`#0A0A0A`) or near-black.
- Active nav item: Gold accent left border or gold text.
- Muted nav items: Warm Gray.

### Cards

- White background, warm border (`#E5E0D8`), subtle shadow.
- Card titles in Gloock.

### Badges / tags

- Use gold tint for "active" / "available" states.
- Use neutral gray for secondary/inactive states.
- Avoid colored badges that don't come from the brand palette.

### Form inputs

- Border: `#E5E0D8` (warm, not cold gray).
- Focus ring: Gold (`#F7B229`).
- Destructive: keep current red.

### Icons

- Use thin-stroke line icons (consistent with landing page art direction).
- On dark backgrounds: white or gold icons.
- On light backgrounds: ink or gold icons.

---

## 6. Theme migration — CSS variable mapping

Below is the target value for each shadcn/ui CSS variable to bring the platform in line with the brand.

### Light mode (`:root`)

```css
:root {
  --radius: 0.375rem;

  /* Surfaces */
  --background:         oklch(0.975 0.005 80);   /* Off-white #F7F5F0 */
  --foreground:         oklch(0.155 0 0);         /* Ink #1A1A1A */
  --card:               oklch(1 0 0);             /* White */
  --card-foreground:    oklch(0.155 0 0);

  /* Popover */
  --popover:            oklch(1 0 0);
  --popover-foreground: oklch(0.155 0 0);

  /* Primary — Cinema Black */
  --primary:            oklch(0.10 0 0);          /* #0A0A0A */
  --primary-foreground: oklch(1 0 0);             /* White */

  /* Secondary — warm gray surface */
  --secondary:          oklch(0.94 0.005 75);
  --secondary-foreground: oklch(0.155 0 0);

  /* Muted */
  --muted:              oklch(0.94 0.005 75);
  --muted-foreground:   oklch(0.50 0.01 60);      /* Warm Gray */

  /* Accent — Gold */
  --accent:             oklch(0.81 0.18 82);      /* Gold #F7B229 */
  --accent-foreground:  oklch(0.10 0 0);

  /* Destructive — unchanged */
  --destructive:        oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);

  /* Borders & inputs */
  --border:             oklch(0.90 0.008 75);     /* #E5E0D8 */
  --input:              oklch(0.90 0.008 75);
  --ring:               oklch(0.81 0.18 82);      /* Gold focus ring */

  /* Sidebar — dark */
  --sidebar:                    oklch(0.10 0 0);  /* Cinema Black */
  --sidebar-foreground:         oklch(0.985 0 0);
  --sidebar-primary:            oklch(0.81 0.18 82); /* Gold */
  --sidebar-primary-foreground: oklch(0.10 0 0);
  --sidebar-accent:             oklch(0.18 0 0);
  --sidebar-accent-foreground:  oklch(0.985 0 0);
  --sidebar-border:             oklch(1 0 0 / 8%);
  --sidebar-ring:               oklch(0.81 0.18 82);
}
```

### Dark mode (`.dark`)

```css
.dark {
  --background:         oklch(0.10 0 0);
  --foreground:         oklch(0.985 0 0);
  --card:               oklch(0.155 0 0);
  --card-foreground:    oklch(0.985 0 0);
  --popover:            oklch(0.18 0 0);
  --popover-foreground: oklch(0.985 0 0);

  --primary:            oklch(0.985 0 0);         /* White on dark */
  --primary-foreground: oklch(0.10 0 0);

  --secondary:          oklch(0.22 0 0);
  --secondary-foreground: oklch(0.985 0 0);

  --muted:              oklch(0.22 0 0);
  --muted-foreground:   oklch(0.60 0.01 60);

  --accent:             oklch(0.81 0.18 82);      /* Gold stays the same */
  --accent-foreground:  oklch(0.10 0 0);

  --destructive:        oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);

  --border:             oklch(1 0 0 / 8%);
  --input:              oklch(1 0 0 / 12%);
  --ring:               oklch(0.81 0.18 82);

  --sidebar:                    oklch(0.08 0 0);
  --sidebar-foreground:         oklch(0.985 0 0);
  --sidebar-primary:            oklch(0.81 0.18 82);
  --sidebar-primary-foreground: oklch(0.10 0 0);
  --sidebar-accent:             oklch(0.18 0 0);
  --sidebar-accent-foreground:  oklch(0.985 0 0);
  --sidebar-border:             oklch(1 0 0 / 8%);
  --sidebar-ring:               oklch(0.81 0.18 82);
}
```

### Custom utilities to add

```css
/* Add to @theme inline block */
--color-gold:           oklch(0.81 0.18 82);
--color-gold-foreground: oklch(0.10 0 0);
--color-gold-hover:     oklch(0.74 0.18 82);
```

---

## 7. Design principles (applied to the platform)

1. **Black sidebar, always.** The app sidebar and top navigation should use Cinema Black — never the default light gray sidebar.
2. **Gold is reserved for actions.** Only primary CTAs, active states, focus rings, and key highlights use gold. Don't apply it decoratively.
3. **Gloock for page titles.** Every route-level heading (page title, section heading) must use `font-heading` (Gloock). Form labels, table headers, and body copy remain in Open Sans.
4. **Off-white page background.** The main content area uses `#F7F5F0` (off-white), not pure white — it's warmer and more prestigious.
5. **Warm borders everywhere.** Replace cool-gray borders (`oklch(0.922 0 0)`) with warm-tinted borders (`oklch(0.90 0.008 75)`) to maintain palette coherence.
6. **No blue.** The platform currently inherits blue chart colors and blue focus rings from shadcn defaults. Replace all with gold (focus rings) and the chart palette below.

### Chart colors (brand-aligned)

Replace the default blue chart palette with a gold-to-neutral palette:

```css
--chart-1: oklch(0.81 0.18 82);   /* Gold */
--chart-2: oklch(0.50 0.01 60);   /* Warm gray */
--chart-3: oklch(0.88 0.10 82);   /* Light gold */
--chart-4: oklch(0.35 0.01 60);   /* Dark warm gray */
--chart-5: oklch(0.92 0.06 82);   /* Very light gold tint */
```

---

## 8. Reference screenshots

Screenshots of the Timeless Cinema marketing site are stored alongside this document:

- `landing-1.png` — Hero section: black background, Gloock headline, gold CTA button
- `landing-2.png` — "How it works" section: white background, thin gold line icons, editorial type scale
- `landing-3.png` — "Let's meet" section: black background, founder bio block
- `landing-4.png` — Feature bento / CNC section: mixed backgrounds (gold, blue, white) — **note**: the yellow/blue tones are marketing-site-only; the app palette stays black/gold/off-white.
