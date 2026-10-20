# PokedexDB

A fast, static Pokémon database built with React and Vite.

[View the site](https://pokedexdb.com)

## Features
- Browse Pokémon with clean card layout
- Filter by types, tags, games, items, moves, and more
- Dedicated pages for Abilities, Items, Moves, plus a minigame
- Fully static build served from GitHub Pages

## Tech Stack
- React 19 + Vite 7
- ESLint 9
- GitHub Pages deployment

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Install & Run
```bash
npm install
npm run dev
```

### Build & Deploy
```bash
npm run build    # Builds the site (+ static SEO pages and sitemap)
npm run preview  # Preview production build
npm run deploy   # Deploys to GitHub Pages
```
Pushing to `main` also deploys via the GitHub Actions workflow in `.github/workflows/pages.yml`.

## Data

Most Pokémon data is served from static snapshots in `public/data/` instead of being requested
from PokeAPI on every visit:

| File | Contents |
| --- | --- |
| `pokemon-index.json` | Every Pokémon/form: id, species, current types, past types (e.g. Clefairy was Normal before Gen 6), and the version group each form was introduced in |
| `pokedexes.json` | Entry numbers for every regional Pokédex the site uses (incl. DLC dexes) |
| `moves.json` | Move type / power / accuracy / PP / category, plus PokeAPI's per-generation change log |
| `move-effects.json`, `abilities.json` | Short effect texts; abilities with the Pokémon that have them |
| `type-chart.json` | Type effectiveness for Gen 1, Gen 2–5 and Gen 6+ |
| `pokemon_all.json` | Pokédex entries and catch locations per game (served to the app split by first letter, see `scripts/dex-shards-plugin.mjs`) |

`src/data/species-flags.json` (Legendary / Mythical / Baby / Ultra Beast / Paradox names) is
generated alongside them.

Refresh the snapshots when PokeAPI adds new Pokémon, games or Pokédexes:
```bash
npm run data:snapshot
```
`npm run data:repair-flavor` re-checks `pokemon_all.json` for Pokédex entries with words
missing from the original scrape and fills them in from PokeAPI.

## License
No license specified.

## Acknowledgements
Pokémon and all respective names/images are trademarks of their respective owners. This is a community project with no affiliation to Nintendo, Game Freak, or The Pokémon Company.
