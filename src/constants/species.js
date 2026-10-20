// Special-tag membership for every Pokémon and form name (forms inherit their species' tag:
// zygarde-50, ogerpon masks, the Legends: Z-A Megas, Gigantamax Melmetal, ...).
// Generated from PokeAPI's species flags by scripts/build-data-snapshot.mjs; Ultra Beasts and
// Paradox Pokémon (which PokeAPI doesn't flag) are listed in that script.
import SPECIES_FLAGS from "../data/species-flags.json";

export const ULTRA_BEASTS = new Set(SPECIES_FLAGS.ultraBeast);

export const PARADOX_NAMES = new Set(SPECIES_FLAGS.paradox);

export const BABY_NAMES = new Set(SPECIES_FLAGS.baby);

export const LEGENDARY_NAMES = new Set(SPECIES_FLAGS.legendary);

export const MYTHICAL_NAMES = new Set(SPECIES_FLAGS.mythical);

// Name tokens that mark regional variants. Region names like "kalos" or "alola" also appear in
// Pikachu's cap forms ("pikachu-kalos-cap"); see isRegionalFormName in App.jsx.
export const REGIONAL_TOKENS = new Set([
  "alola",
  "alolan",
  "galar",
  "galarian",
  "hisui",
  "hisuan",
  "paldea",
  "paldean",
  "kanto",
  "johto",
  "hoenn",
  "sinnoh",
  "unova",
  "kalos",
]);
