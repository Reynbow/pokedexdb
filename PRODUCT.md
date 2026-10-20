# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pokémon players in the middle of a playthrough of a specific game, looking things up while they play — often on a phone next to the console. Typical jobs: where to catch a Pokémon in this game, how and when it evolves, what it is weak to, what it learns, its Pokédex number in this game's regional dex.

## Product Purpose

Pokedex DB is a free Pokémon database whose data is accurate *per game*: pick a game and the Pokédex, types, type matchups, learnsets, move stats, forms, version exclusives and catch locations all reflect that game. Around the Pokédex sit reference tools (Moves, Abilities, Items), an EV training guide per game, a daily "Who's That Pokémon?" game and a save-file reader for Pokémon Yellow and the Yellow Legacy ROM hack.

Success: a player finds the answer for *their* game in a few seconds, on a phone, without wrong data from another generation.

## Positioning

Per-game accuracy across every main-series game (Red/Blue/Yellow through Legends: Z-A and its DLC): Gen 1 type chart and types, past move values, regional dex numbering per sub-dex, forms hidden in games that predate them, exclusives per version. Most Pokédex sites show current-generation data with per-game notes; this one switches the whole view to the chosen game.

## Operating Context

- Used alongside a game in progress; frequently on mobile, one-handed, in short lookups.
- Static site on GitHub Pages (pokedexdb.com), deployed by pushing to `main`.
- Data comes from static PokeAPI snapshots in `public/data/` (regenerated with `npm run data:snapshot`), Bulbapedia-checked constants, and live PokeAPI / Smogon requests only when a Pokémon is opened.

## Capabilities and Constraints

- Pages: Pokédex (browse, search, filter by type / special tag / region / game, Pokémon detail at `/<slug>`), Moves, Abilities, Items, EV Training, Who's That? (daily, UTC rollover), Save Reader (Gen 1 Yellow / Yellow Legacy `.sav`/`.srm`, client-side only).
- The `/home` all-forms grid page is to be removed (the Pokédex covers it).
- Every Pokémon and tool page has a static SEO page generated at build time; URLs are clean paths.
- Priority order for ease of access: Pokédex browse + Pokémon detail first; the other tools are secondary.
- React 19 + Vite 7, no UI framework; sprites from local files and the PokeAPI sprites repo; type icons hotlinked from duiker101/pokemon-type-svg-icons (no license — cannot be bundled).

## Brand Commitments

- Name: "Pokedex DB". The logo and wordmark are open to redesign.
- The UI stays dark — no light theme.
- No green in the UI: the palette is dark greys and blues (type colours like Grass stay, they are data).
- Look and feel (user brief): a modern take on the original Game Boy Pokémon games' UI elements — clearly modern, inspired by those games.
- Not affiliated with Nintendo, Game Freak or The Pokémon Company; Pokémon names and images are their trademarks.

## Evidence on Hand

- Real data: 1,351 Pokémon and forms, 24 regional Pokédexes, 919 moves, 307 abilities, ~1,400 items, Pokédex entries and catch locations per game (`public/data/`).
- No testimonials, user counts, press or partnerships exist; don't fabricate any.

## Product Principles

1. The selected game is the context for everything: never show another generation's data without saying so.
2. Answer the lookup fast: search and the Pokémon detail view are one tap away from anywhere.
3. Phone first, desktop richer: the core lookup must work one-handed on a small screen.
4. Accuracy over volume: show less rather than show something wrong.
