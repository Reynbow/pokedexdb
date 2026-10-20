// Turns PokeAPI slugs ("mr-mime-galar", "charizard-mega-x") into display names
// ("Galarian Mr. Mime", "Charizard X"). Shared by the Pokédex grid, detail panel and tools.

// Official names that can't be recovered by title-casing the slug.
const NAME_OVERRIDES = new Map([
  ["mr-mime", "Mr. Mime"],
  ["mime-jr", "Mime Jr."],
  ["mr-rime", "Mr. Rime"],
  ["farfetchd", "Farfetch’d"],
  ["sirfetchd", "Sirfetch’d"],
  ["type-null", "Type: Null"],
  ["ho-oh", "Ho-Oh"],
  ["porygon-z", "Porygon-Z"],
  ["jangmo-o", "Jangmo-o"],
  ["hakamo-o", "Hakamo-o"],
  ["kommo-o", "Kommo-o"],
  ["nidoran-f", "Nidoran♀"],
  ["nidoran-m", "Nidoran♂"],
  ["flabebe", "Flabébé"],
  ["chi-yu", "Chi-Yu"],
  ["ting-lu", "Ting-Lu"],
  ["chien-pao", "Chien-Pao"],
  ["wo-chien", "Wo-Chien"],
  // Game/version slugs also go through this formatter
  ["legends-za", "Legends: Z-A"],
  ["legends-arceus", "Legends: Arceus"],
  ["lets-go-pikachu", "Let’s Go, Pikachu!"],
  ["lets-go-eevee", "Let’s Go, Eevee!"],
]);

const REGIONAL_PREFIXES = new Map([
  ["alola", "Alolan"],
  ["alolan", "Alolan"],
  ["galar", "Galarian"],
  ["galarian", "Galarian"],
  ["hisui", "Hisuian"],
  ["hisuian", "Hisuian"],
  ["paldea", "Paldean"],
  ["paldean", "Paldean"],
]);

export const humanizeSlug = (value) => String(value || "").replace(/-/g, " ");

export const toTitleCase = (value) =>
  humanizeSlug(value)
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

export const stripMegaGmaxTokens = (rawName) =>
  String(rawName || "")
    .toLowerCase()
    .split("-")
    .filter((token) => token && token !== "mega" && token !== "gmax")
    .join("-");

// Longest known override that prefixes the slug ("mr-mime-galar" -> "mr-mime").
const splitBaseName = (slug) => {
  const tokens = slug.split("-");
  for (let length = tokens.length; length > 0; length--) {
    const candidate = tokens.slice(0, length).join("-");
    if (NAME_OVERRIDES.has(candidate)) {
      return { base: NAME_OVERRIDES.get(candidate), rest: tokens.slice(length) };
    }
  }
  return { base: toTitleCase(tokens[0]), rest: tokens.slice(1) };
};

/** Display name for a Pokémon/form slug. Mega/Gigantamax tokens are dropped (cards tag them). */
export const formatPokemonName = (rawName) => {
  const slug = stripMegaGmaxTokens(rawName);
  if (!slug) return "";
  if (NAME_OVERRIDES.has(slug)) return NAME_OVERRIDES.get(slug);
  const { base, rest } = splitBaseName(slug);
  let prefix = null;
  let formTokens = rest;
  // A regional token right after the species name is a regional form ("darmanitan-galar-zen"),
  // but Pikachu's caps are not ("pikachu-alola-cap" is Pikachu in an Alola Cap).
  if (rest.length > 0 && REGIONAL_PREFIXES.has(rest[0]) && !rest.includes("cap")) {
    prefix = REGIONAL_PREFIXES.get(rest[0]);
    formTokens = rest.slice(1);
  }
  const formLabel = formTokens.length > 0 ? ` ${toTitleCase(formTokens.join("-"))}` : "";
  return `${prefix ? `${prefix} ` : ""}${base}${formLabel}`;
};
