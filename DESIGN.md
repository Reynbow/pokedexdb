---
name: Pokedex DB
description: The in-game Pokédex device, rebuilt for today, dark slate screen, per-game data always in view.
colors:
  screen-0: "#0b0e13"
  screen-1: "#121720"
  screen-2: "#18202b"
  screen-3: "#212b38"
  line: "#2a3442"
  frame: "#44536a"
  frame-strong: "#8796ad"
  ink: "#e3e8f0"
  ink-2: "#aeb8c7"
  ink-3: "#8592a5"
  ink-mute: "#566275"
  select: "#62b2ff"
  select-ink: "#06101c"
  select-wash: "#142740"
  red: "#e5483a"
  red-wash: "#2b1512"
  lens: "#3d8fd6"
  meter-high: "#62b2ff"
  meter-mid: "#e3b341"
  meter-low: "#e0503f"
  warn: "#e3b341"
  error: "#ef6a5b"
  info: "#8cc4f0"
  t-normal: "#7a7650"
  t-fire: "#b24a1e"
  t-water: "#3a64ad"
  t-electric: "#8a6610"
  t-grass: "#457a3a"
  t-ice: "#3d7f87"
  t-fighting: "#93241c"
  t-poison: "#6b2769"
  t-ground: "#85642e"
  t-flying: "#5f56ad"
  t-psychic: "#973a5f"
  t-bug: "#627419"
  t-rock: "#776227"
  t-ghost: "#52407e"
  t-dragon: "#4b24b3"
  t-dark: "#563d2a"
  t-steel: "#66688a"
  t-fairy: "#8f4570"
  t-stellar: "#3c6fa8"
  t-unknown: "#505a68"
typography:
  wordmark:
    fontFamily: "Pixelify Sans, DotGothic16, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.02em"
  display:
    fontFamily: "DotGothic16, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "0.02em"
  headline:
    fontFamily: "DotGothic16, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.04em"
  title:
    fontFamily: "DotGothic16, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.02em"
  dialog:
    fontFamily: "DotGothic16, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "DotGothic16, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    letterSpacing: "0.02em"
  number:
    fontFamily: "DotGothic16, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontWeight: 500
    letterSpacing: "0"
    fontFeature: "tnum"
  name:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
rounded:
  r-1: "2px"
  r-2: "4px"
  r-3: "6px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
components:
  button:
    backgroundColor: "{colors.screen-2}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.r-2}"
    padding: "0 16px"
    height: "36px"
  button-hover:
    backgroundColor: "{colors.screen-3}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.screen-0}"
    rounded: "{rounded.r-2}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.screen-0}"
    textColor: "{colors.ink}"
  button-select:
    backgroundColor: "{colors.select}"
    textColor: "{colors.select-ink}"
    rounded: "{rounded.r-2}"
    height: "36px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.r-2}"
    height: "36px"
  button-sm:
    padding: "0 12px"
    height: "28px"
  field:
    backgroundColor: "{colors.screen-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.r-2}"
    padding: "0 12px"
    height: "40px"
  window:
    backgroundColor: "{colors.screen-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r-3}"
    padding: "12px 16px 16px"
  dialog:
    backgroundColor: "{colors.screen-1}"
    textColor: "{colors.ink}"
    typography: "{typography.dialog}"
    rounded: "{rounded.r-3}"
    padding: "16px 24px 24px"
  type-tag:
    backgroundColor: "{colors.t-unknown}"
    textColor: "#ffffff"
    rounded: "{rounded.r-1}"
    padding: "0 8px"
    height: "22px"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.r-1}"
    padding: "0 5px"
    height: "18px"
  stamp-red:
    textColor: "{colors.red}"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    padding: "0 12px"
    height: "36px"
  tab-current:
    textColor: "{colors.ink}"
  segment-selected:
    backgroundColor: "{colors.select}"
    textColor: "{colors.select-ink}"
    rounded: "{rounded.r-1}"
    height: "28px"
  dex-cell-selected:
    backgroundColor: "{colors.select}"
    textColor: "{colors.select-ink}"
  device-bar:
    backgroundColor: "{colors.screen-0}"
    textColor: "{colors.ink-3}"
    height: "56px"
  tabbar-current:
    backgroundColor: "{colors.select}"
    textColor: "{colors.select-ink}"
    height: "60px"
---

# Design System: Pokedex DB

## Overview

**Creative North Star: "The Pokédex Device"**

The site is the in-game Pokédex, rebuilt for today. It is a numbered list and a live entry page that always show the chosen game. It is not a dashboard of sprite cards under a wall of filter chips. Everything sits on a dark, cool slate screen. Content lives inside double-ruled Game Boy windows. Selection works like the device menu: a drawn ▶ cursor and inverse video. A dot-matrix pixel face carries the device's voice: numbers, headings, labels, tabs, buttons and the dex text. A plain system sans carries names and reading text, so a lookup made on a phone in a few seconds stays legible.

Density is high but ordered. The browse Pokédex is one window whose cells are split by hairline rules. With an entry open, the grid becomes a 336px numbered list beside the entry page. On phones, cells become numbered rows and a bottom tab bar holds the sections. Motion is short and functional, with one signature moment: the dex text types itself into a dialog box, a ▼ prompt blinks, and ◀ ▶ (arrow keys or a swipe) steps to the neighbouring entry.

The world is dark only, in slate greys and blues. Green never appears in the chrome. Fills are flat: no gradients, glows or glass.

**Key Characteristics:**
- Dark slate screen ramp as the only neutrals; one bright blue for selection and nothing else.
- Double-ruled window frames (frame rule, gap, hairline) for every major container.
- Inverse-video selection with a drawn ▶ cursor, on dex cells, tabs, menu rows and the phone tab bar.
- DotGothic16 for the device voice, system sans for names and prose, Pixelify Sans for the wordmark only.
- Pixel icons drawn on a 12×12 grid with crisp edges, in one stroke weight.
- Tabular figures everywhere numbers line up.

## Colors

The palette is a cool blue-black screen with pale ink, plus a few rationed signal colours: selection blue, device red, three stat-meter tiers and flat type colours.

### Primary
- **Cursor Blue** (select): the one selection colour. It marks the cursor, the active game, focus rings, the current tab underline, pressed segments, the selected dex cell, the current phone tab, text selection and the caret. Text on it is always **Screen-Off Ink** (select-ink). **Selection Wash** (select-wash) is its tint for a selected row on dark.

### Secondary
- **Pokédex Red** (red): the device red. It is used only for the "DB" plate in the wordmark and for red in-place stamps. **Red Wash** (red-wash) is its dark tint behind red marks.
- **Lens Blue** (lens): the lens in the wordmark mark. It is not used in the UI.

### Tertiary
- **Meter tiers** (meter-high blue, meter-mid amber, meter-low red): stat bars use exactly three tiers. High is blue, never green.
- **State colours** (warn amber, error coral, info pale blue): status text and gold stamps.
- **Type colours** (t-normal … t-unknown): flat, darkened so white text reads on them. They are data. They appear only on type tags and type-coded marks. Grass and Bug are green because that is the type's identity, not the UI's.

### Neutral
- **Screen Off** (screen-0): page ground, device bar, tab bar, meter tracks, segment wells.
- **Window Fill** (screen-1): the inside of every window, dialog and sheet.
- **Second Layer** (screen-2): buttons, inputs, rails and wells inside windows.
- **Pressed Well** (screen-3): hover and pressed button fill.
- **Hairline** (line): dividers, inner window rule, cell rules, quiet borders.
- **Frame Rule** (frame): window frames, button and field borders, device bar rule.
- **Lit Frame** (frame-strong): hover and emphasised frames, sheet frames, link underlines.
- **Ink** (ink): primary text. **Ink 2** (ink-2): secondary text and window titles. **Ink 3** (ink-3): labels, meta, dex numbers and inactive tabs (at least 4.5:1 on Window Fill). **Ink Mute** (ink-mute): disabled only.

### Named Rules
**The No Green Rule.** Nothing in the chrome is green: no buttons, states, meters, success marks or accents. Green appears only where a type colour is the data.

**The One Selection Colour Rule.** Cursor Blue means "selected, current or focused" and nothing else. The page's main action is inverse ink (Ink fill, Screen Off text), never blue, so blue keeps its meaning.

**The Red Is The Device Rule.** Pokédex Red is for the wordmark plate and stamps. It is not a call-to-action colour.

## Typography

**Display Font:** DotGothic16 (OFL, via @fontsource), with the system-ui stack as fallback
**Body Font:** system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif
**Wordmark Font:** Pixelify Sans (OFL, self-hosted in `public/fonts/`), with DotGothic16 as fallback

**Character:** DotGothic16 is a monospaced dot-matrix gothic that reads as a Game Boy screen. Its B/G, C/O and digits stay distinct at every size. The system sans next to it keeps names and prose quick to read.

### Hierarchy
- **Wordmark** (Pixelify Sans 600, 1.375rem, line-height 1): the "Pokédex" wordmark only. The "DB" plate beside it is UI sans 800 on red, because the pixel B reads as an 8 at that size.
- **Display** (DotGothic16 600, 2.25rem, 1.05; 1.75rem on narrow screens): the entry's Pokémon name.
- **Headline** (DotGothic16 500, 1.125rem, 0.04em): section heads such as the dex section title, followed by a double rule that fills the line. Tool page titles use the pixel face at 1.375rem.
- **Title** (DotGothic16 500, 0.9375rem): window titles and sheet titles (uppercase, Ink 2), buttons, tabs and device-bar links.
- **Dialog** (DotGothic16, 1rem, line-height 1.6, max 62ch): the dex-text dialog box.
- **Label** (DotGothic16 500, 0.8125rem, 0.02em, uppercase, Ink 3): key/value terms, meter labels and field labels.
- **Number** (DotGothic16 500, tabular): dex numbers ("No. 0006"), stat values and counts.
- **Name** (UI sans 600, 0.9375rem): Pokémon, move, item and ability names in lists and cells.
- **Body** (UI sans 400, 0.9375rem, 1.5): reading text, field input and meta lines.

The scale steps are 0.75 / 0.8125 / 0.9375 / 1.125 / 1.375 / 1.75 / 2.25rem. Stamps sit just below the scale at 0.6875rem.

### Named Rules
**The Pixel Voice, Sans Names Rule.** The device speaks in DotGothic16: numbers, headings, labels, tabs, buttons and dex text. Names and anything read as prose use the UI sans. Pixelify Sans was the first pixel face. It was demoted to the wordmark because its 5 reads as S and its B/C read as G/O.

**The Near-Zero Tracking Rule.** DotGothic16 is monospaced. Pixel text keeps 0 to 0.04em tracking; small pixel text stays at 0 to 0.02em.

**The One Face Per Number Rule.** A figure is set in one face. A number is never split between the pixel face and the sans. Tabular figures are on site-wide.

**The No-Zoom Field Rule.** Form fields render at 16px on touch screens (`pointer: coarse`) so iOS never zooms the page.

## Layout

The page is centred to 1360px. A sticky 56px device bar carries the wordmark, section tabs and a jump-to search (focus it with `/`). On the Pokédex, a sticky context strip sits below it: the game cartridge button (logo, game, dex size), the dex search, a Filters button that opens a sheet, active-filter tokens, the result count including forms, and section jump chips. One count is shown per scope.

The browse grid is a single window. Cells are `auto-fill, minmax(156px, 1fr)`, separated by hairline rules rather than gaps. A container query on the dex (600px or less) turns cells into numbered rows: cursor, number, sprite, name over types, stamps. The same rows serve the 336px list when an entry is open. On desktop that list sits on the left and the entry page fills the right.

Spacing follows a 4px base scale (4 / 8 / 12 / 16 / 24 / 32 / 48). Inside windows, 12px and 16px are the working steps. Section breaks use 24px and 32px.

Breakpoints: 1180px and 1100px compact the device bar and the entry. At 900px the phone layout takes over: the device bar keeps the wordmark and a search toggle, the section tabs move to a fixed 60px bottom tab bar (five slots, the last a More sheet), sheets become bottom sheets, and the entry becomes a full screen with ◀ ▶. 600px is the row-layout container threshold. Safe-area insets are respected at the bottom.

## Elevation & Depth

Depth comes from tone and ruling, not shadow. Surfaces step from Screen Off to Window Fill to Second Layer to Pressed Well. Containers are distinguished by their double rule. Inset `box-shadow` draws that inner hairline; it is not a cast shadow. The only cast shadow is on floating layers (popovers and sheets), over a 70% Screen Off scrim on phones.

### Shadow Vocabulary
- **Pop** (`box-shadow: 0 10px 28px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4)`): popover sheets and jump results only, combined with the window's inset double rule.
- **Window rule** (`box-shadow: inset 0 0 0 2px <fill>, inset 0 0 0 3px <hairline>`): the inner rule of the double-ruled frame. This is structure, not elevation.

### Named Rules
**The Flat Screen Rule.** Fills are flat. No gradients, glows, blurs or glass. A surface rises by changing tone and frame, and floats only when it is a popover.

## Shapes

Corners are barely softened, like a handheld's LCD bezel: 2px for tags, stamps and meter tracks, 4px for buttons, fields and segments, 6px for windows, dialogs and sheets. Bottom sheets round only their top corners. Borders are structural. Windows use a 2px frame rule plus an inset hairline. Buttons and fields use a 2px frame. Dense repeated items use a single 1px hairline. The dialog box uses a heavier 3px Ink 2 outer rule with an inner frame rule. Icons and the ▶ cursor are drawn on a pixel grid with `shape-rendering: crispEdges`.

## Components

### Buttons
Device keys: chunky, framed, set in the pixel face.
- **Shape:** gently squared (4px), 2px frame border, 36px tall (28px small, square icon variants at 36 and 28).
- **Default:** Second Layer fill, Ink text. Hover lifts to Pressed Well with a Lit Frame. Active nudges down 1px.
- **Primary:** the page's one main action is inverse ink (Ink fill, Screen Off text). Hover inverts back to Screen Off with an Ink frame.
- **Select / pressed:** `aria-pressed="true"` or the select variant fills Cursor Blue with Screen-Off Ink text. Hover keeps the blue and lights the frame to Ink.
- **Quiet:** transparent with Ink 2 text. Hover gains a Second Layer fill and a hairline.
- **Disabled:** Window Fill, hairline border, Ink Mute text, no motion.
- Transitions are 120ms on background, border and colour.

### Type Tags and Stamps
- **Type tag:** a flat type-colour fill, white uppercase pixel text at 0.75rem, 22px tall (26px large), 2px corners, an optional 13px type icon. An off state uses Second Layer with a hairline and Ink 3. Clickable tags brighten slightly on hover.
- **Stamp:** an in-place status mark, so nothing silently disappears. It is a 1px current-colour outline, uppercase pixel text at 0.6875rem, 18px tall, in Ink 2, red, blue or gold.

### Windows
- **Window:** Window Fill, 2px Frame Rule, 6px corners, inset gap and hairline (the double rule). The head has an uppercase pixel title in Ink 2. Body padding is 12px/16px.
- **Plain window:** a single 1px hairline for dense repeats.

### Inputs / Fields
- **Style:** Second Layer fill, 2px Frame Rule, 4px corners, 40px tall (36px in the device bar), UI sans text, Ink 3 placeholder, optional 16px pixel icon inset at 12px.
- **Hover / Focus:** hover lights the frame. Focus turns the frame Cursor Blue with no glow.
- **Select:** same field with a drawn pixel chevron.

### Navigation
- **Device bar:** Screen Off with a 2px Frame Rule below. Pixel links in Ink 3. The current link turns Ink with a 3px Cursor Blue underline.
- **Tabs:** pixel text in Ink 3. The selected tab turns Ink with a 2px blue underline and shows the ▶ cursor. The entry remembers the last tab.
- **Phone tab bar:** fixed 60px bar with five icon-over-label slots. The current section is inverse video (Cursor Blue fill).
- **Segmented control:** a Screen Off well with a hairline. The pressed segment is a Cursor Blue fill (Normal/Shiny, Art/Animated, Male/Female).

### Dex Cell and Row (signature)
Each Pokémon is a cell on the device screen: a dex number, sprite, sans name and type tags. Hover (on hover-capable devices), focus and selection invert it to Cursor Blue with Screen-Off Ink and reveal the ▶ cursor. In the 336px list and on phones the cell becomes a numbered row.

### Dialog Box (signature)
The Game Boy text box: a 3px Ink 2 outer rule, inner Frame Rule, Window Fill, pixel text at 1rem/1.6 and up to 62ch. The dex text types itself in, then a ▼ blinks in the corner (900ms stepped). A version select picks the game's entry.

### Stat Meters
A label, a tabular value, then a 10px track on Screen Off with a Frame Rule. The fill is blue, amber or red by tier and animates its width over 420ms.

### Sheets
One popover on desktop and a bottom sheet on phone. The frame is Lit Frame plus the double rule plus the Pop shadow. The head and foot are split by hairlines, with a 40×4px grip on phone. It enters in 120ms (popover) or 200ms (bottom sheet) with an ease-out.

### Loading and Empty
Skeletons are Second Layer blocks with a slow 1.4s opacity pulse, shaped like the content they replace. Empty states are centred, with a pixel title in Ink and sans text in Ink 2.

## Do's and Don'ts

### Do:
- **Do** put every major container in a double-ruled window (2px Frame Rule, inset hairline, 6px corners).
- **Do** show selection as inverse video in Cursor Blue (#62b2ff) with Screen-Off Ink, plus the ▶ cursor where the item is a list or tab.
- **Do** set numbers, headings, labels, tabs, buttons and dex text in DotGothic16, and names and reading text in the UI sans.
- **Do** keep tabular figures and keep each number in one face.
- **Do** keep the chosen game visible as the context on every Pokédex view.
- **Do** mark status in place with a stamp rather than hiding the item.
- **Do** use three meter tiers, blue / amber / red.
- **Do** draw new icons on the 12×12 pixel grid with crisp edges.

### Don't:
- **Don't** use green anywhere in the chrome. Type colours on type tags are the only exception.
- **Don't** use Cursor Blue for anything that isn't selection, current or focus. That includes the main action, which is inverse ink.
- **Don't** use Pokédex Red as a button or accent colour. It belongs to the wordmark and stamps.
- **Don't** add gradients, glows, blurs or glass, or cast shadows on anything that doesn't float.
- **Don't** use Pixelify Sans outside the wordmark.
- **Don't** track pixel text beyond 0.04em.
- **Don't** set form fields below 16px on touch screens.
- **Don't** add a light theme.
