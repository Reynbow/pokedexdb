import { writeFile } from "node:fs/promises";

const GEN1_POKEMON_NAMES = [
  "bulbasaur", "ivysaur", "venusaur", "charmander", "charmeleon", "charizard",
  "squirtle", "wartortle", "blastoise", "caterpie", "metapod", "butterfree",
  "weedle", "kakuna", "beedrill", "pidgey", "pidgeotto", "pidgeot",
  "rattata", "raticate", "spearow", "fearow", "ekans", "arbok",
  "pikachu", "raichu", "sandshrew", "sandslash", "nidoran-f", "nidorina",
  "nidoqueen", "nidoran-m", "nidorino", "nidoking", "clefairy", "clefable",
  "vulpix", "ninetales", "jigglypuff", "wigglytuff", "zubat", "golbat",
  "oddish", "gloom", "vileplume", "paras", "parasect", "venonat",
  "venomoth", "diglett", "dugtrio", "meowth", "persian", "psyduck",
  "golduck", "mankey", "primeape", "growlithe", "arcanine", "poliwag",
  "poliwhirl", "poliwrath", "abra", "kadabra", "alakazam", "machop",
  "machoke", "machamp", "bellsprout", "weepinbell", "victreebel", "tentacool",
  "tentacruel", "geodude", "graveler", "golem", "ponyta", "rapidash",
  "slowpoke", "slowbro", "magnemite", "magneton", "farfetchd", "doduo",
  "dodrio", "seel", "dewgong", "grimer", "muk", "shellder",
  "cloyster", "gastly", "haunter", "gengar", "onix", "drowzee",
  "hypno", "krabby", "kingler", "voltorb", "electrode", "exeggcute",
  "exeggutor", "cubone", "marowak", "hitmonlee", "hitmonchan", "lickitung",
  "koffing", "weezing", "rhyhorn", "rhydon", "chansey", "tangela",
  "kangaskhan", "horsea", "seadra", "goldeen", "seaking", "staryu",
  "starmie", "mr-mime", "scyther", "jynx", "electabuzz", "magmar",
  "pinsir", "tauros", "magikarp", "gyarados", "lapras", "ditto",
  "eevee", "vaporeon", "jolteon", "flareon", "porygon", "omanyte",
  "omastar", "kabuto", "kabutops", "aerodactyl", "snorlax", "articuno",
  "zapdos", "moltres", "dratini", "dragonair", "dragonite", "mewtwo",
  "mew",
];

const YELLOW_REFERENCE_FILE = "public/data/pokemon_yellow_reference.json";
const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const REQUEST_DELAY_MS = 60;

const sanitizeText = (value) => {
  if (!value) return null;
  const text = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
};

const normalizeLegacyPokemonName = (rawName) => {
  if (!rawName) return "";
  return rawName
    .toLowerCase()
    .replace(/\u2640|female/g, "-f")
    .replace(/\u2642|male/g, "-m")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "PokedexDB Yellow-reference-generator",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return response.json();
};

const buildYellowReference = async () => {
  const reference = [];
  for (let index = 0; index < GEN1_POKEMON_NAMES.length; index++) {
    const id = index + 1;
    const slug = normalizeLegacyPokemonName(GEN1_POKEMON_NAMES[index]);

    try {
      const [pokemonData, speciesData] = await Promise.all([
        fetchJson(`${POKEAPI_BASE}/pokemon/${id}`),
        fetchJson(`${POKEAPI_BASE}/pokemon-species/${id}`),
      ]);

      const genus = (speciesData?.genera || []).find(
        (entry) => entry?.language?.name === "en"
      )?.genus;

      const yellowEntry = (speciesData?.flavor_text_entries || []).find(
        (entry) =>
          entry?.language?.name === "en" && entry?.version?.name === "yellow"
      )?.flavor_text;

      reference.push({
        id,
        slug,
        species: sanitizeText(genus),
        height: Number.isFinite(pokemonData?.height) ? pokemonData.height : null,
        weight: Number.isFinite(pokemonData?.weight) ? pokemonData.weight : null,
        entry: sanitizeText(yellowEntry),
      });
    } catch (error) {
      console.error(`Failed to fetch data for ${slug} (#${id}):`, error);
    }

    await pause(REQUEST_DELAY_MS);
  }

  await writeFile(YELLOW_REFERENCE_FILE, JSON.stringify(reference, null, 2), "utf-8");
  console.log(`Saved ${reference.length} entries to ${YELLOW_REFERENCE_FILE}`);
};

buildYellowReference().catch((error) => {
  console.error("Failed to build yellow reference:", error);
  process.exit(1);
});
