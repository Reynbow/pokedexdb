---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/MovesPage.jsx","src/AbilitiesPage.jsx","src/ItemsPage.jsx","src/EvTrainingPage.jsx","src/MinigamePage.jsx","src/SavPage.jsx"]
---

# Surface: the whole site (Pokédex first)

Mode: Operate. A player mid-playthrough looks something up for the game they are playing, usually on a phone, in a few seconds.

Task: pick the game once; find a Pokémon by name, number, type or tag; open its entry and read where to catch it, how it evolves, matchups, stats, moves and dex text for that game; step to neighbouring entries. Tool pages (Moves, Abilities, Items, EV Training, Who's That?, Save Reader) share the same shell and component language.

Constraints: dark only; per-game data must stay visible as the context; all existing functions, URLs and data stay; the `/home` page is removed; type colours remain the data colours for types.

Memorable moment: the entry's dex text types itself into a Game Boy dialog box, and ◀ ▶ (or a swipe) steps to the next entry like the device.

Unresolved: none blocking. Icons: authored SVG set in one stroke; type icons stay hotlinked (unlicensed source).

## Direction contract

THESIS: The site is the in-game Pokédex device, rebuilt for today — a numbered list and a live entry page that always show the chosen game. It refuses the category default: a sprite-card dashboard under a wall of filter chips.

OWN-WORLD: Pokédex screen-dark in slate greys and blues — the user deeply dislikes green in UI, so no green anywhere in the chrome. Blue-black ground, two slate panel layers, cool pale ink, the blue-grey screen ramp as the only neutrals. One bright blue is the selection colour (cursor, active game, focus) and nothing else; Pokédex red only for the wordmark and in-place stamps; type colours only on type tags (Grass and Bug stay green there because that is type data). Double-ruled window frames, a drawn ▶ cursor, inverse-video selected rows, a dot-matrix pixel face (DotGothic16) for numbers, headings, labels, tabs and the dex text, a plain sans for names and reading; the chunky Pixelify Sans only in the wordmark. Flat fills: no gradients, glows or glass.

STORY: The player picks their cartridge once, scrolls or searches the numbered dex, opens an entry that answers where, how and what for that game, and steps through neighbours without going back.

FIRST VIEWPORT: Desktop — a 56px device bar (wordmark, section tabs, jump-to search); a context strip with the game cartridge button (logo, games, "Kanto · 151"), the dex search field, a Filters button with active-filter tokens and the result count; the numbered grid fills the rest. With an entry open the grid becomes a 320px numbered list on the left and the entry page fills the right: No. and name header with category, a sprite screen, HT / WT / types, the dialog box with the dex text, three-tier stat meters (blue / amber / red, never green). Phone — device bar shrinks to wordmark + search; context strip is the cartridge button and filter; a bottom tab bar carries the sections; the entry is a full screen with ◀ ▶.

FORM: The Pokédex Device — #1 of 7 on the grounded list, chosen by the user as the pick card; seed: none (unavailable) — the concept roll printed "SEED REFERENCE unavailable". Signature interaction: the typewriter dialog box with a blinking ▼, plus ◀ ▶ / swipe entry stepping.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
