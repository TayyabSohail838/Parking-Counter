# Parking Counter: Design System

The visual language for the Parking Counter landing page (`/`) and live counter app (`/app`). Read this before changing styles, adding sections or creating marketing material.

**Design idea in one line:** *a live security-camera feed in an underground car park.* Dark concrete, warm strip lights, amber headlights and signage, and computer-vision brackets locking onto every vehicle.

---

## 1. Brand

### Name
**Parking Counter**: always two words, both capitalised. Don't abbreviate it ("PC") or use it as a verb.

### Logo
A bold off-white **"P"** for parking, framed by **four amber corner brackets**, the same detection-box marks the app draws around every vehicle. A small amber square inside marks the point where the tracker anchors a vehicle. It reads as *"a parking spot, being detected."*

| Asset | File | Use |
|---|---|---|
| Logo mark (transparent) | [src/components/brand/LogoMark.tsx](src/components/brand/LogoMark.tsx) | Navbars and in-page use. `<LogoMark size={32} />` |
| Favicon (on a dark tile) | [src/app/icon.svg](src/app/icon.svg) | Browser tab. Served automatically by Next.js |

**Lock-up:** the mark followed by "Parking Counter" in Anton, with a 10 px gap. Mark size: 32 px on the landing page, 26 px in the app.

**Don't:** recolour the brackets anything other than amber, put the mark on a gradient or coloured tile, add shadows or glows, rotate it, or separate the "P" from its brackets.

---

## 2. Colour

All colours are CSS variables in [src/app/globals.css](src/app/globals.css). **Always use the variables, never hard-coded hex values.**

### Surfaces: warm graphite (the concrete)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0a0a0b` | Page background |
| `--bg-2` | `#0f0f11` | Secondary background |
| `--surface` | `#141416` | Solid cards (app) |
| `--surface-2` | `#1a1a1d` | Inputs, secondary buttons |
| `--surface-3` | `#222226` | Hover states, tracks |
| `--border` | `#26262b` | Hairlines |
| `--border-strong` | `#35353b` | Input and button outlines |

### Text: warm off-white (the strip lights)
| Token | Value | Use |
|---|---|---|
| `--text` | `#f3f1ec` | Headings, primary text |
| `--text-2` | `#c6c2b9` | Body copy, nav links |
| `--muted` | `#8e8a82` | Captions, labels, metadata |

### Accent: amber (headlights and parking signage)
| Token | Value | Use |
|---|---|---|
| `--accent` | `#f2b544` | Primary buttons, kickers, logo brackets, car detections |
| `--accent-2` | `#ffcd6b` | Gradient highlight, focus ring, icons |
| `--accent-ink` | `#1a1306` | Text on amber backgrounds |
| `--accent-glow` | `rgba(242,181,68,.32)` | Soft glow under primary buttons |

### Data colours (charts and detections only)
| Token / value | Meaning |
|---|---|
| `--green` `#34d399` | **IN** crossings, positive trends, "live" dot |
| `--rose` `#fb7185` | **OUT** crossings, LIVE label in the camera overlay |
| `--cyan` `#2dd4bf` | Zones; trucks in detections |
| Car `#f2b544`, bus `#a3e635`, motorcycle `#f472b6`, bicycle `#4cc9f0`, person `#ffc857` | Detection boxes (see `CLASS_COLORS` in [src/lib/vision/types.ts](src/lib/vision/types.ts)) |

### Chart colours (dashboard)
Validated with the dataviz palette checker on the card surface `#141416` (dark mode, all checks pass):

| Series | Colour | Checks |
|---|---|---|
| **In** | aqua `#199e70` | Lightness band ✓, contrast ≥ 3:1 ✓ |
| **Out** | orange `#d95926` | Colourblind separation ΔE 9.4 (target ≥ 8) ✓, normal-vision ΔE 26.5 ✓ |
| Single-series magnitude (e.g. "By type") | amber `--accent` | One series, so no categorical palette is needed |

The brighter UI greens and roses (`--green`, `--rose`) **fail** colourblind separation as a pair, so charts use the aqua/orange pair above. Don't swap them back. A vehicle-type breakdown is drawn as **one amber bar per type with a text label**, never six colours (the six detection colours fail the all-pairs checks).

### Colour rules
- **No blue.** The brand moved from navy and electric blue to graphite and amber. Don't reintroduce blue for UI chrome.
- **Amber is a highlight, not a fill.** Use it for one primary action per view, small labels, icons and detection marks. Large amber areas are reserved for primary buttons.
- **Data colours stay in data.** Green, rose and cyan mean something (in, out, zone). Don't use them for decoration.
- The highlighted headline words use the "headlight" gradient: `linear-gradient(90deg, #fff1d6, #ffcd6b 45%, #f2b544 90%)`.

---

## 3. Typography

Loaded with `next/font` in [src/app/layout.tsx](src/app/layout.tsx).

| Role | Font | Notes |
|---|---|---|
| Display: headings, logo, buttons, big numbers | **Anton** (`--font-display`) | Single weight (400). Never set `font-weight` above 400. Fake bolding is switched off with `font-synthesis-weight: none`. |
| Body: paragraphs, nav links, labels | **Inter** (`--font-body`) | 15 px base, line-height 1.55 |
| Data: camera overlay, timestamps, step numbers | **Geist Mono** (`--font-mono`) | Gives the "camera feed" feel |

### Type scale
| Element | Size | Letter spacing | Line height |
|---|---|---|---|
| Hero `h1` | `clamp(40px, 6vw, 76px)` | 0.012em | 1.08 |
| Chapter `h2` | `clamp(30px, 4vw, 50px)` | 0.012em | 1.14 |
| Section `h2` | `clamp(28px, 3.4vw, 40px)` | 0.012em | 1.08 |
| Card `h3` | 21 px | 0.025em | 1.08 |
| Logo wordmark | 21 px (landing), 19 px (app) | 0.04em | — |
| Buttons | 15 px (sm), 16 px, 19 px (lg) | 0.04em | — |
| Kicker ("FEATURES", "01 · DETECT") | 13 px, uppercase, amber | 0.08–0.1em | — |
| Body / lead | 15 px / 17–18 px | — | 1.55 |

### Type rules
- **Anton is for short text only:** headings, buttons, numbers and the logo. Never use it for paragraphs; it's a condensed poster face and is tiring to read at length.
- Anton gets *more* letter spacing as it gets smaller. Small Anton with no extra spacing looks cramped.
- Headings use sentence case ("Every vehicle, counted live."), not title case or all caps. Kickers are the only uppercase text.

---

## 4. Shape, spacing and layout

### Corners: crisp, not pills
| Element | Radius |
|---|---|
| Tags, chips, hover highlights, overlays | **6 px** |
| Buttons | 8 px (sm), 10 px, 12 px (lg) |
| Inner nodes (pipeline steps) | 12 px |
| Cards | `--radius` 14 px |
| Large panels (pipeline, CTA) | `--radius-lg` 22 px |
| Status dots | 50% (circles are fine for dots) |

**Never use pill shapes** (`border-radius: 999px`) on tags, badges, links or buttons.

### Layout
- **Content column:** max 1200 px, centred, with 24 px side padding (16 px on phones). Everything aligns to this column, including fixed overlays such as the LIVE camera badge, whose right edge lines up with the navbar's "Launch app" button.
- **Section rhythm:** 96 px vertical padding (64 px on phones). Section head (kicker + `h2` + lead) max 640 px wide, 44 px above its content.
- **Grids:** features and use cases use 4 columns → 2 at ≤1024 px → 1 at ≤720 px. Steps use 3 → 1.
- **Breakpoints:** 1100 px (app goes single-column), 1024 px, 720 px (phone).

---

## 5. Signature: the video background

The landing page runs **one piece of footage behind the entire page**, scrubbed by scroll. It's the defining element of the design.

- **Implementation:** [src/components/landing/ScrollStory.tsx](src/components/landing/ScrollStory.tsx) draws pre-extracted WebP frames on a fixed full-screen `<canvas>`. Frame = whole-page scroll progress.
- **Frames and detections** come from [tools/make_scroll_sequence.py](tools/make_scroll_sequence.py). OpenCV extracts and enhances the frames (CLAHE local contrast, gamma lift, unsharp mask), and YOLO11 runs on each one to pre-compute the boxes.
- **Intro (first ~400 vh):** four text chapters fade in and out over the clear video: the hero, then *01 · Detect*, *02 · Track & count* and *03 · Decide*. Text sits at 42% of the screen height, left-aligned to the content column, clear of the vehicles in the lower half.
- **Detection boxes** fade in after the hero chapter: a 2 px outline, bold corner brackets, and a label pill ("car 91%") anchored to the box's top-right corner, away from the text column.
- **After the intro**, a 60% graphite dim layer fades in, and the boxes and LIVE overlay fade out, so the content sections stay readable. The video keeps playing behind them.
- **Shading:** only enough to keep text legible: a left-side gradient behind the text column and light top and bottom vignettes. Keep the footage visible.
- **Fallback:** if `public/scroll/` doesn't exist, the page shows the tablet-dashboard hero instead.

### Footage rules
- **Only footage we own or have a licence for.** The current clip is [Parking lot by Oleh Budurov on Pexels](https://www.pexels.com/video/parking-lot-18320892/) (free under the Pexels license), last 10 seconds. Never use video saved or screen-recorded from Pinterest, Instagram and similar sites.
- Prefer dark, real car-park or road footage with vehicles **moving**, so there's something to detect. 1080p or better.
- Keep the generated frames ≤ ~20 MB (`--quality 70–78`, `--frames 120–150`).

---

## 6. Components

### Navbar
Sticky, **no solid bar and no border**: a dark-to-transparent fade (`rgba(8,8,9,.82)` → transparent) that blends into the footage. Nav links are Inter 14 px `--text-2`, with a 6 px rounded hover highlight. The single primary action is **"Dashboard"** (`.btn-primary.btn-sm` → `/dashboard`). The hero's "Launch live counter" button opens the counter itself.

### Buttons ([globals.css](src/app/globals.css))
| Class | Look | Use |
|---|---|---|
| `.btn-primary` | Amber gradient, `--accent-ink` text, soft glow | The one main action per view |
| `.btn` | Graphite, `--border-strong` outline | Secondary actions |
| `.btn-ghost` | Transparent | Tertiary actions |
| `.btn-sm` / `.btn-lg` | Size modifiers | — |

Buttons are set in Anton. Hover lifts the primary button by 1 px. The disabled state is 45% opacity.

### Eyebrow tag
A green "live" dot plus a short line in Inter 13 px, on a **transparent background with no border and no padding box**. Example: *• Computer vision that runs in your browser*.

### Kicker
An uppercase amber label above section headings: "FEATURES" (Inter, 13 px, 0.1em) or the chapter numbers "01 · DETECT" (Geist Mono).

### Smoked-glass cards
Feature, step, use-case and pipeline cards over the video: `rgba(20,20,22,.62)` with `backdrop-filter: blur(12px)`, a 1 px `--border` and a 14 px radius. Hover lifts feature cards by 2 px and strengthens their border.

### Icons
24 × 24 line icons, 1.8 px stroke, round caps and joins, `currentColor`, shown at 28 px in `--accent-2`. **No background tile or tint behind icons.**

### LIVE camera overlay (HUD)
Geist Mono 12 px on `rgba(12,12,13,.55)` with a 10 px blur, 10 px radius and a 12% white hairline. Contents: a blinking rose **LIVE** dot, "Camera 03 · Level −1", and "Vehicles in view N", which updates per frame. It aligns to the content column's right edge and fades out after the intro. On phones it spans the top and hides the camera name.

### Live counter (`/app`, [src/components/counter/](src/components/counter/))
Built like the dashboard: the same video-still background, glass recipe and transparent nav aligned to the landing page. The nav has Home and Live counter (current) links, with **Dashboard** as the primary button.

- **Header:** kicker "LIVE COUNTER", the `h1` "Count what crosses the line", a lead line, and glass status chips on the right (GPU/CPU backend; Ready, or Live · FPS with a green square).
- **Video stage:** a glass frame; 16:9 on phones.
- **Camera icon:** the placeholder's icon is a bare amber line icon with a **transparent background (no tile)**, like the landing feature icons.
- **KPI tiles:** text-coloured Anton numbers with a colour swatch in the label. IN and OUT use the validated aqua `#199e70` and orange `#d95926`, in the sparklines, the timeline and the IN/OUT tags.
- **By type:** amber bars, with a small dot matching each class's box colour on the video.

On the canvas, the counting line is off-white `#f5f3ee` with IN and OUT arrows labelled in green and rose, and the zone is cyan with a 14% fill.

### Dashboard (`/dashboard`, [src/components/dashboard/](src/components/dashboard/))
Shows everything the live counter has counted **on this device**. The counter saves each crossing to `localStorage` through [src/lib/history.ts](src/lib/history.ts), and nothing is uploaded.

- **Top bar:** built like the landing nav: a transparent fade, the same 1200 px container, 64 px height, 32 px logo with 21 px Anton wordmark, and 14 px Inter links (Home, Dashboard; the current page keeps its 6 px highlight). **Open live counter** is the primary action. On phones the links hide and only the logo and button remain. The counter app's top bar links back with a secondary **Dashboard** button.
- **Header:** the amber kicker "DASHBOARD", the Anton `h1` "Counts on this device", and a privacy line. Controls on the right: a **segmented range control** (Today / Last 7 days / All time: 8 px track, 6 px buttons, the selected one in `--surface-3` with an inset hairline), **Export CSV**, and **Clear data** (asks to confirm; hover tints it orange).
- **KPI tiles (4):** Total crossings, Inbound, Outbound (with the net arrived or left) and Busiest hour. Anton 40 px numbers with tabular figures. Inbound and Outbound labels carry a 10 px swatch in the chart colour; the number itself stays in text colour.
- **Charts:** *Crossings by hour* (24 stacked IN/OUT bars) and *Daily totals* (for multi-day ranges). Thin bars (≤ 22 px), 4 px rounded tops, a 2 px surface gap between the IN and OUT segments, recessive grid (5% white), Geist Mono axis labels, a legend above, a per-bar hover/focus tooltip, and a **View as table / View as chart** toggle that swaps the chart for a table of the same data *in the same space* (fixed height, sticky header, empty rows muted), so the card never changes size.
- **By type** rows spread evenly to fill the card's height, which matches the chart beside it, so there's no empty gap.
- **By type:** one amber bar per type, with the name, count and share.
- **Recent crossings** table and **Sessions** list (date, time span, duration, camera or file, crossing count).
- **No empty state:** the dashboard always shows data. Until this device has counted anything, it shows a realistic sample week, generated in memory and not saved. An amber-edged glass notice says it's preview data and links to **Start counting**. Real crossings replace the preview automatically, and **Clear data** appears only once real data exists.
- **Default range:** "Today" if anything was counted today, otherwise "Last 7 days".
- **Background and glass:** a still from the landing-page footage ([public/dashboard/bg.webp](public/dashboard/bg.webp), frame 60) is fixed behind the page. It's brightened slightly and shaded top and bottom so text keeps its contrast. The top bar is transparent like the landing nav: no border and no blur, just a dark-to-transparent fade. Every panel (KPI tiles, cards, notice, segmented control, tooltip) uses one glass recipe:
  - fill `rgba(16,16,18,.48)` with a 5% white top highlight;
  - a 1 px `rgba(255,255,255,.09)` border;
  - `backdrop-filter: blur(18px) saturate(1.25)`;
  - an inset top hairline and a soft drop shadow.

  Browsers without `backdrop-filter` fall back to an opaque `rgba(16,16,18,.9)`. Don't put a moving video behind the data; keep the background a still.

---

## 7. Motion
- **Scroll is the only timeline.** The video and chapters move with the user's scroll, never on their own.
- Chapter text fades and rises 24 px using smoothstep easing over about 6% of the scroll.
- Micro-interactions are 150 ms: button hover, card lift, nav highlight.
- Ambient loops are limited to the blinking LIVE dot and the "scroll" hint line.
- `prefers-reduced-motion`: CSS animations and smooth scrolling are switched off. Scroll-driven frames still follow the user's own scrolling.

---

## 8. Voice and copy
- **Short, concrete and confident.** "Every vehicle, counted live." "Follows each one and counts it exactly once."
- Lead with what the user gets, then how: *what you see* before *YOLO11 / OpenCV*.
- Privacy is a feature, so say it plainly: "Video never leaves the browser."
- Use numbers over adjectives where possible.
- Avoid hype words ("revolutionary", "AI-powered magic") and exclamation marks.

---

## 9. Accessibility
- Body text on graphite is well above WCAG AA contrast. On amber buttons, use `--accent-ink`, never white.
- Text over video always has shading behind it. Check new copy at the brightest frame of the footage.
- Visible focus ring: 2 px `--accent-2`, 3 px offset.
- Decorative canvases, the HUD and the logo mark are `aria-hidden`. The scroll section and the tablet mock-up have `aria-label`s.
- Never put essential information only in the video.

---

## 10. Do and don't

| Do | Don't |
|---|---|
| Graphite surfaces, warm off-white text, amber highlights | Navy backgrounds or blue UI accents |
| 6 px rounded tags and chips | Pill shapes (`999px`) |
| Bare line icons in amber | Icons on tinted squares |
| Borderless, transparent eyebrow tags | Bordered "badge" eyebrows |
| Anton for headings, buttons and numbers | Anton for paragraphs, or fake-bold Anton |
| Align overlays to the 1200 px content column | Elements pinned to the screen edge |
| Keep the footage visible, with light shading | Heavy dark overlays that hide the video |
| Licensed or own footage, with credit | Pinterest or Instagram video rips |

---

## 11. Where things live

```
src/app/globals.css                 design tokens, base type, buttons
src/app/layout.tsx                  fonts (Anton, Inter, Geist Mono), metadata
src/app/icon.svg                    favicon
src/components/brand/LogoMark.tsx   logo mark
src/components/landing/
  landing.module.css                navbar, sections, cards, footer
  ScrollStory.tsx / scroll.module.css   video background, chapters, HUD
  TabletDashboard.tsx, ShowroomBackdrop.tsx   fallback hero (no video)
src/components/counter/             live counter app UI
src/components/dashboard/           dashboard page, stacked bar chart
src/lib/history.ts                  on-device counting history (localStorage)
src/lib/vision/types.ts             detection class colours
tools/make_scroll_sequence.py       footage → frames + detections
```
