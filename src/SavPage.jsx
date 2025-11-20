import React, { useState, useCallback, useEffect, useMemo } from "react";
import "./App.css";
import SpriteImage from "./components/SpriteImage.jsx";
import CategoryToggle from "./CategoryToggle.jsx";
import { getTypeIconUrl } from "./utils/typeIcons.js";
import { buildPokemonPath } from "./utils/url.js";
import gen1TypeMapData from "./data/gen1-types.json";
import gen1TypeChartData from "./data/gen1-type-chart.json";
import parseLazarusSavFile, { normalizeSpeciesSlug } from "./utils/lazarusSave.js";
import { NATIONAL_ID_TO_SLUG } from "./data/pokemonSpeciesMap.js";

// Generation 1 Pokemon names (Pokemon Yellow has 151 Pokemon)
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
  "mew"
];
const GEN1_SLUG_TO_POKEDEX_ID = new Map(
  GEN1_POKEMON_NAMES.map((slug, index) => [slug, index + 1])
);

const LAZARUS_SPRITE_OVERRIDES = new Map([
  ["hisuian-decidueye", "10244"],
  ["mega-chesnaught", "10292"],
  ["mega-delphox", "10293"],
  ["mega-greninja", "10294"],
  ["alolan-marowak", "10115"],
  ["mega-ampharos", "10045"],
  ["alolan-grimer", "10112"],
  ["alolan-muk", "10113"],
  ["mega-gardevoir", "10051"],
  ["mega-gallade", "10068"],
  ["oricorio-baile", "741"],
  ["oricorio-pa-u", "10124"],
  ["oricorio-pom-pom", "10123"],
  ["oricorio-sensu", "10125"],
  ["alolan-sandshrew", "10101"],
  ["alolan-sandslash", "10102"],
  ["mega-mawile", "10052"],
  ["own-tempo-rockruff", "10151"],
  ["dusk-lycanroc", "10152"],
  ["midnight-lycanroc", "10126"],
  ["mega-aggron", "10053"],
  ["mega-heracross", "10047"],
  ["mega-banette", "10056"],
  ["paldean-wooper", "10253"],
  ["alolan-vulpix", "10103"],
  ["alolan-ninetales", "10104"],
  ["aegislash-blade", "10026"],
  ["minior-core", "10140"],
  ["mega-gengar", "10038"],
  ["hero-palafin", "10256"],
  ["mega-houndoom", "10048"],
  ["mega-steelix", "10072"],
  ["mega-glalie", "10074"],
  ["hisuian-zorua", "10238"],
  ["hisuian-zoroark", "10239"],
  ["hisuian-sneasel", "10235"],
  ["alolan-meowth", "10107"],
  ["galarian-meowth", "10161"],
  ["alolan-persian", "10108"],
  ["hisuian-typhlosion", "10233"],
  ["mega-hawlucha", "10300"],
  ["paldean-tauros-a", "10252"],
  ["paldean-tauros-b", "10251"],
  ["paldean-tauros-c", "10250"],
  ["pawmott", "923"],
  ["alolan-raichu", "10100"],
  ["galarian-ponyta", "10162"],
  ["galarian-rapidash", "10163"],
  ["galarian-corsola", "10173"],
  ["mega-scizor", "10046"],
  ["mega-medicham", "10054"],
  ["basculin-blue", "10016"],
  ["basculin-red", "550"],
  ["basculin-white", "10247"],
  ["flab-b", "669"],
  ["eternal-flower-floette", "10061"],
  ["mega-falinks", "10303"],
  ["mega-scrafty", "10289"],
  ["mega-camerupt", "10087"],
  ["mega-gyarados", "10041"],
  ["galarian-zigzagoon", "10174"],
  ["galarian-linoone", "10175"],
  ["hisuian-sliggoo", "10241"],
  ["hisuian-goodra", "10242"],
  ["mega-altaria", "10067"],
  ["hisuian-voltorb", "10231"],
  ["hisuian-electrode", "10232"],
  ["mega-victreebel", "10279"],
  ["hisuian-growlithe", "10229"],
  ["hisuian-arcanine", "10230"],
  ["mega-aerodactyl", "10042"],
  ["hisuian-braviary", "10240"],
  ["mega-abomasnow", "10060"],
  ["mega-tyranitar", "10049"],
  ["mega-dragonite", "10281"],
  ["primal-kyogre", "10077"],
  ["primal-groudon", "10078"],
  ["mega-rayquaza", "10079"],
  ["ogerpon-cornerstone", "10275"],
  ["ogerpon-hearthflame", "10274"],
  ["ogerpon-wellspring", "10273"],
]);

// Pokemon Yellow save file offsets
// According to Bulbapedia: https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_(Generation_I)
// The save file is 32KB divided into 4 banks of 8KB each
// Bank 1 (main data) starts at 0x2000
// Bulbapedia lists these offsets relative to Bank 1, so we derive both the absolute
// position and the copy stored at the mirrored backup bank.
// Common offsets (absolute in the SRAM layout):
// - 0x25A3: US Yellow Pokedex owned (caught) bitfield (19 bytes)
// - 0x25B6: US Yellow Pokedex seen bitfield (19 bytes)
// Some emulators may save without bank structure, so we try both absolute and bank-relative offsets
const BANK1_START = 0x2000;
const MAIN_POKEDEX_OWNED_OFFSET = 0x25A3;
const BACKUP_POKEDEX_OWNED_OFFSET = MAIN_POKEDEX_OWNED_OFFSET - BANK1_START; // 0x05A3
const GEN1_POKEMON_COUNT = 151;
const POKEDEX_FLAG_BYTES = Math.ceil(GEN1_POKEMON_COUNT / 8); // 19 bytes for 151 entries
const POKEDEX_DATA_LOCATIONS = [
  { offset: MAIN_POKEDEX_OWNED_OFFSET, label: "Main data (0x25A3)" },
  { offset: BACKUP_POKEDEX_OWNED_OFFSET, label: "Backup copy (0x05A3)" },
];
const LEGACY_CSV_FILENAME = "data/pokemon_yellow_legacy_list.csv";
const DEFAULT_METHOD_LABEL = "Grass";
const PARTY_DATA_OFFSETS = [0x2F2C, BANK1_START + 0x2F2C];
const PARTY_MAX_SIZE = 6;
const LOCATION_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const LAZARUS_PC_CODE_LOCATION = "Cheat Code";

let legacyEncounterCache = null;
let legacyEncounterPromise = null;

function resolveLegacyCsvUrl() {
  let baseUrl = "/";
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) {
      baseUrl = import.meta.env.BASE_URL;
    }
  } catch {
    baseUrl = "/";
  }
  return `${String(baseUrl || "/").replace(/\/+$/, "/")}${LEGACY_CSV_FILENAME}`;
}

function resolveStaticDataUrl(filename) {
  let baseUrl = "/";
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) {
      baseUrl = import.meta.env.BASE_URL;
    }
  } catch {
    baseUrl = "/";
  }
  return `${String(baseUrl || "/").replace(/\/+$/, "/")}${filename}`;
}

function resolveYellowReferenceUrl() {
  return resolveStaticDataUrl("data/pokemon_yellow_reference.json");
}

function resolveLazarusReferenceUrl() {
  return resolveStaticDataUrl("data/pokemon_lazarus_reference.json");
}

function readUint16(data, offset) {
  if (offset + 1 >= data.length) return 0;
  return (data[offset] << 8) | data[offset + 1];
}

function decodeGen1String(bytes) {
  if (!bytes || bytes.length === 0) return null;
  const chars = [];
  for (const value of bytes) {
    if (value === 0x50 || value === 0xff) {
      break;
    }
    const mapped = GEN1_CHAR_MAP.get(value);
    if (typeof mapped === "string") {
      chars.push(mapped);
    }
  }
  const result = chars.join("").trim();
  return result || null;
}

function interpretStatus(value) {
  if (!value) return "OK";
  const sleepCounter = value & STATUS_FLAG_LABELS[0].mask;
  if (sleepCounter) {
    return "SLP";
  }
  for (let i = 1; i < STATUS_FLAG_LABELS.length; i++) {
    const { mask, label } = STATUS_FLAG_LABELS[i];
    if (value & mask) {
      return label;
    }
  }
  return "OK";
}

function resolveTypeName(code) {
  if (GEN1_TYPE_NAMES.has(code)) {
    return GEN1_TYPE_NAMES.get(code);
  }
  if (code >= 0x09 && code <= 0x13) {
    return "Normal";
  }
  return "Unknown";
}

function formatHeight(decimeters) {
  if (!Number.isFinite(decimeters)) return "Unknown";
  return `${(decimeters / 10).toFixed(1)} m`;
}

function formatWeight(hectograms) {
  if (!Number.isFinite(hectograms)) return "Unknown";
  return `${(hectograms / 10).toFixed(1)} kg`;
}

function normalizeLegacyPokemonName(rawName) {
  if (!rawName) return "";
  return rawName
    .toLowerCase()
    .replace(/\u2640|female/g, "-f")
    .replace(/\u2642|male/g, "-m")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toTitleCase(str) {
  if (typeof str !== "string" || str.length === 0) {
    return "";
  }
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const SLUG_TO_TITLE_NAME = new Map(
  GEN1_POKEMON_NAMES.map((name) => [normalizeLegacyPokemonName(name), toTitleCase(name)])
);

const GEN1_POKEMON_TYPE_MAP = new Map(
  Object.entries(gen1TypeMapData || {}).map(([slug, types]) => [
    slug,
    Array.isArray(types) ? types.map((type) => String(type || "").toLowerCase()) : [],
  ])
);

const GEN1_TYPE_CHART = new Map(
  Object.entries(gen1TypeChartData || {}).map(([defensiveType, attackMap]) => [
    defensiveType,
    Object.fromEntries(
      Object.entries(attackMap || {}).map(([attackType, value]) => [
        attackType,
        Number.isFinite(value) ? Number(value) : 1,
      ])
    ),
  ])
);

const GEN1_ATTACK_TYPES = Object.keys(gen1TypeChartData || {}).sort();
const TYPE_SUMMARY_CACHE = new Map();

function getGen1TypeSummary(slug) {
  if (!slug) return null;
  if (TYPE_SUMMARY_CACHE.has(slug)) {
    return TYPE_SUMMARY_CACHE.get(slug);
  }
  const pokemonTypes = GEN1_POKEMON_TYPE_MAP.get(slug) || [];
  if (pokemonTypes.length === 0) {
    TYPE_SUMMARY_CACHE.set(slug, null);
    return null;
  }
  const summary = {
    types: pokemonTypes,
    weaknesses: [],
    resistances: [],
    immunities: [],
  };
  GEN1_ATTACK_TYPES.forEach((attackType) => {
    let multiplier = 1;
    pokemonTypes.forEach((defensiveType) => {
      const relations = GEN1_TYPE_CHART.get(defensiveType);
      const relationValue =
        relations && Object.prototype.hasOwnProperty.call(relations, attackType)
          ? relations[attackType]
          : 1;
      const parsedValue = Number.isFinite(relationValue) ? relationValue : 1;
      multiplier *= parsedValue;
    });
    if (multiplier === 0) {
      summary.immunities.push({ type: attackType, multiplier: 0 });
    } else if (multiplier > 1) {
      summary.weaknesses.push({ type: attackType, multiplier });
    } else if (multiplier < 1) {
      summary.resistances.push({ type: attackType, multiplier });
    }
  });
  summary.weaknesses.sort(
    (a, b) => b.multiplier - a.multiplier || a.type.localeCompare(b.type)
  );
  summary.resistances.sort(
    (a, b) => a.multiplier - b.multiplier || a.type.localeCompare(b.type)
  );
  summary.immunities.sort((a, b) => a.type.localeCompare(b.type));
  TYPE_SUMMARY_CACHE.set(slug, summary);
  return summary;
}

function formatTypeMultiplier(multiplier) {
  if (multiplier === 0) {
    return "x0";
  }
  const rounded =
    Math.abs(multiplier - Math.round(multiplier)) < 0.001
      ? Math.round(multiplier)
      : Number(multiplier.toFixed(2));
  return `x${rounded}`;
}

const RAW_EVOLUTION_DATA = [
  "Abra~-/-~Level 16~-/-~Kadabra~-/-~Level 42~-/-~Alakazam",
  "Ekans~-/-~Level 22~-/-~Arbok",
  "Growlithe~-/-~Fire Stone~-/-~Arcanine",
  "Weedle~-/-~Level 7~-/-~Kakuna~-/-~Level 10~-/-~Beedrill",
  "Bellsprout~-/-~Level 21~-/-~Weepinbell~-/-~Leaf Stone~-/-~Victreebel",
  "Squirtle~-/-~Level 16~-/-~Wartortle~-/-~Level 36~-/-~Blastoise",
  "Bulbasaur~-/-~Level 16~-/-~Ivysaur~-/-~Level 32~-/-~Venusaur",
  "Caterpie~-/-~Level 7~-/-~Metapod~-/-~Level 10~-/-~Butterfree",
  "Charmander~-/-~Level 16~-/-~Charmeleon~-/-~Level 36~-/-~Charizard",
  "Clefairy~-/-~Moon Stone~-/-~Clefable",
  "Shellder~-/-~Water Stone~-/-~Cloyster",
  "Cubone~-/-~Level 28~-/-~Marowak",
  "Seel~-/-~Level 34~-/-~Dewgong",
  "Diglett~-/-~Level 26~-/-~Dugtrio",
  "Doduo~-/-~Level 31~-/-~Dodrio",
  "Dratini~-/-~Level 30~-/-~Dragonair~-/-~Level 55~-/-~Dragonite",
  "Drowzee~-/-~Level 26~-/-~Hypno",
  "Eevee~-/-~Water/Thunder/Fire Stone~-/-~Vaporeon/Jolteon/Flareon",
  "Voltorb~-/-~Level 30~-/-~Electrode",
  "Exeggcute~-/-~Leaf Stone~-/-~Exeggutor",
  "Spearow~-/-~Level 20~-/-~Fearow",
  "Gastly~-/-~Level 25~-/-~Haunter~-/-~Level 42~-/-~Gengar",
  "Geodude~-/-~Level 25~-/-~Graveler~-/-~Level 38~-/-~Golem",
  "Oddish~-/-~Level 21~-/-~Gloom~-/-~Leaf Stone~-/-~Vileplume",
  "Zubat~-/-~Level 22~-/-~Golbat",
  "Goldeen~-/-~Level 33~-/-~Seaking",
  "Psyduck~-/-~Level 33~-/-~Golduck",
  "Grimer~-/-~Level 38~-/-~Muk",
  "Magikarp~-/-~Level 20~-/-~Gyarados",
  "Horsea~-/-~Level 32~-/-~Seadra",
  "Jigglypuff~-/-~Moon Stone~-/-~Wigglytuff",
  "Kabuto~-/-~Level 40~-/-~Kabutops",
  "Krabby~-/-~Level 28~-/-~Kingler",
  "Koffing~-/-~Level 35~-/-~Weezing",
  "Machop~-/-~Level 28~-/-~Machoke~-/-~Level 38~-/-~Machamp",
  "Magnemite~-/-~Level 30~-/-~Magneton",
  "Mankey~-/-~Level 28~-/-~Primeape",
  "Meowth~-/-~Level 28~-/-~Persian",
  "Nidoran-m~-/-~Level 16~-/-~Nidorino~-/-~Moon Stone~-/-~Nidoking",
  "Nidoran-f~-/-~Level 16~-/-~Nidorina~-/-~Moon Stone~-/-~Nidoqueen",
  "Vulpix~-/-~Fire Stone~-/-~Ninetales",
  "Omanyte~-/-~Level 40~-/-~Omastar",
  "Paras~-/-~Level 24~-/-~Parasect",
  "Pidgey~-/-~Level 18~-/-~Pidgeotto~-/-~Level 36~-/-~Pidgeot",
  "Pikachu~-/-~Thunder Stone~-/-~Raichu",
  "Poliwag~-/-~Level 25~-/-~Poliwhirl~-/-~Water Stone~-/-~Poliwrath",
  "Ponyta~-/-~Level 40~-/-~Rapidash",
  "Rattata~-/-~Level 20~-/-~Raticate",
  "Rhyhorn~-/-~Level 42~-/-~Rhydon",
  "Sandshrew~-/-~Level 22~-/-~Sandslash",
  "Slowpoke~-/-~Level 37~-/-~Slowbro",
  "Staryu~-/-~Water Stone~-/-~Starmie",
  "Tentacool~-/-~Level 30~-/-~Tentacruel",
  "Venonat~-/-~Level 31~-/-~Venomoth",
];

const SPECIES_INDEX_TO_SLUG = new Map([
  [1, "rhydon"],
  [2, "kangaskhan"],
  [3, "nidoran-m"],
  [4, "clefairy"],
  [5, "spearow"],
  [6, "voltorb"],
  [7, "nidoking"],
  [8, "slowbro"],
  [9, "ivysaur"],
  [10, "exeggutor"],
  [11, "lickitung"],
  [12, "exeggcute"],
  [13, "grimer"],
  [14, "gengar"],
  [15, "nidoran-f"],
  [16, "nidoqueen"],
  [17, "cubone"],
  [18, "rhyhorn"],
  [19, "lapras"],
  [20, "arcanine"],
  [21, "mew"],
  [22, "gyarados"],
  [23, "shellder"],
  [24, "tentacool"],
  [25, "gastly"],
  [26, "scyther"],
  [27, "staryu"],
  [28, "blastoise"],
  [29, "pinsir"],
  [30, "tangela"],
  [33, "growlithe"],
  [34, "onix"],
  [35, "fearow"],
  [36, "pidgey"],
  [37, "slowpoke"],
  [38, "kadabra"],
  [39, "graveler"],
  [40, "chansey"],
  [41, "machoke"],
  [42, "mr-mime"],
  [43, "hitmonlee"],
  [44, "hitmonchan"],
  [45, "arbok"],
  [46, "parasect"],
  [47, "psyduck"],
  [48, "drowzee"],
  [49, "golem"],
  [51, "magmar"],
  [53, "electabuzz"],
  [54, "magneton"],
  [55, "koffing"],
  [57, "mankey"],
  [58, "seel"],
  [59, "diglett"],
  [60, "tauros"],
  [64, "farfetchd"],
  [65, "venonat"],
  [66, "dragonite"],
  [70, "doduo"],
  [71, "poliwag"],
  [72, "jynx"],
  [73, "moltres"],
  [74, "articuno"],
  [75, "zapdos"],
  [76, "ditto"],
  [77, "meowth"],
  [78, "krabby"],
  [82, "vulpix"],
  [83, "ninetales"],
  [84, "pikachu"],
  [85, "raichu"],
  [88, "dratini"],
  [89, "dragonair"],
  [90, "kabuto"],
  [91, "kabutops"],
  [92, "horsea"],
  [93, "seadra"],
  [96, "sandshrew"],
  [97, "sandslash"],
  [98, "omanyte"],
  [99, "omastar"],
  [100, "jigglypuff"],
  [101, "wigglytuff"],
  [102, "eevee"],
  [103, "flareon"],
  [104, "jolteon"],
  [105, "vaporeon"],
  [106, "machop"],
  [107, "zubat"],
  [108, "ekans"],
  [109, "paras"],
  [110, "poliwhirl"],
  [111, "poliwrath"],
  [112, "weedle"],
  [113, "kakuna"],
  [114, "beedrill"],
  [116, "dodrio"],
  [117, "primeape"],
  [118, "dugtrio"],
  [119, "venomoth"],
  [120, "dewgong"],
  [123, "caterpie"],
  [124, "metapod"],
  [125, "butterfree"],
  [126, "machamp"],
  [128, "golduck"],
  [129, "hypno"],
  [130, "golbat"],
  [131, "mewtwo"],
  [132, "snorlax"],
  [133, "magikarp"],
  [136, "muk"],
  [138, "kingler"],
  [139, "cloyster"],
  [141, "electrode"],
  [142, "clefable"],
  [143, "weezing"],
  [144, "persian"],
  [145, "marowak"],
  [147, "haunter"],
  [148, "abra"],
  [149, "alakazam"],
  [150, "pidgeotto"],
  [151, "pidgeot"],
  [152, "starmie"],
  [153, "bulbasaur"],
  [154, "venusaur"],
  [155, "tentacruel"],
  [157, "goldeen"],
  [158, "seaking"],
  [163, "ponyta"],
  [164, "rapidash"],
  [165, "rattata"],
  [166, "raticate"],
  [167, "nidorino"],
  [168, "nidorina"],
  [169, "geodude"],
  [170, "porygon"],
  [171, "aerodactyl"],
  [173, "magnemite"],
  [176, "charmander"],
  [177, "squirtle"],
  [178, "charmeleon"],
  [179, "wartortle"],
  [180, "charizard"],
  [182, "fossil-kabutops"],
  [183, "fossil-aerodactyl"],
  [184, "mon-ghost"],
  [185, "oddish"],
  [186, "gloom"],
  [187, "vileplume"],
  [188, "bellsprout"],
  [189, "weepinbell"],
  [190, "victreebel"],
]);

const GEN1_CHAR_MAP = new Map([
  [0x7f, " "],
  [0x50, ""],
  [0x9a, "("],
  [0x9b, ")"],
  [0x9c, ":"],
  [0x9d, ";"],
  [0x9e, "["],
  [0x9f, "]"],
  [0xba, "é"],
  [0xbb, "'d"],
  [0xbc, "'l"],
  [0xbd, "'s"],
  [0xbe, "'t"],
  [0xbf, "'v"],
  [0xe0, "'"],
  [0xe1, "PK"],
  [0xe2, "MN"],
  [0xe3, "-"],
  [0xe4, "'r"],
  [0xe5, "'m"],
  [0xe6, "?"],
  [0xe7, "!"],
  [0xe8, "."],
  [0xf2, "."],
  [0xf3, "/"],
  [0xf4, ","],
]);

const STATUS_FLAG_LABELS = [
  { mask: 0x07, label: "SLP" },
  { mask: 0x08, label: "PSN" },
  { mask: 0x10, label: "BRN" },
  { mask: 0x20, label: "FRZ" },
  { mask: 0x40, label: "PAR" },
];

for (let i = 0; i < 26; i++) {
  GEN1_CHAR_MAP.set(0x80 + i, String.fromCharCode(65 + i));
  GEN1_CHAR_MAP.set(0xa0 + i, String.fromCharCode(97 + i));
}
const GEN1_DIGITS = "0123456789";
for (let i = 0; i < GEN1_DIGITS.length; i++) {
  GEN1_CHAR_MAP.set(0xf6 + i, GEN1_DIGITS[i]);
}

const GEN1_TYPE_NAMES = new Map([
  [0x00, "Normal"],
  [0x01, "Fighting"],
  [0x02, "Flying"],
  [0x03, "Poison"],
  [0x04, "Ground"],
  [0x05, "Rock"],
  [0x06, "Bird"],
  [0x07, "Bug"],
  [0x08, "Ghost"],
  [0x14, "Fire"],
  [0x15, "Water"],
  [0x16, "Grass"],
  [0x17, "Electric"],
  [0x18, "Psychic"],
  [0x19, "Ice"],
  [0x1A, "Dragon"],
]);


const buildEvolutionRequirements = (rawEntries) => {
  const map = new Map();
  rawEntries.forEach((entry) => {
    const tokens = String(entry || "")
      .split("~-/-~")
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length < 3) return;
    const names = [];
    const methods = [];
    tokens.forEach((token, index) => {
      if (index % 2 === 0) {
        names.push(token);
      } else {
        methods.push(token);
      }
    });
    if (names.length < 2) return;

    for (let i = 1; i < names.length; i++) {
      const targetName = names[i];
      const method = methods[i - 1] || "";
      const slug = normalizeLegacyPokemonName(targetName);
      if (!slug) continue;
      if (!map.has(slug)) {
        map.set(slug, {
          method,
          target: targetName,
        });
      }
    }
  });
  return map;
};

const EVOLUTION_REQUIREMENTS = buildEvolutionRequirements(RAW_EVOLUTION_DATA);

function parsePartyPokemon(data) {
  for (const offset of PARTY_DATA_OFFSETS) {
    if (offset + 1 >= data.length) continue;
    const count = data[offset];
    if (!Number.isFinite(count) || count < 0 || count > PARTY_MAX_SIZE) {
      continue;
    }
    if (offset + 1 + PARTY_MAX_SIZE > data.length) {
      continue;
    }

    const entries = [];
    const speciesBuffer = Array.from(data.slice(offset + 1, offset + 1 + PARTY_MAX_SIZE));
    const partyDataOffset = offset + 0x08;
    const otNamesOffset = offset + 0x110;
    const nicknameOffset = offset + 0x152;

    for (let i = 0; i < Math.min(count, speciesBuffer.length); i++) {
      const speciesInternalId = speciesBuffer[i];
      if (!Number.isFinite(speciesInternalId) || speciesInternalId <= 0 || speciesInternalId === 0xff) {
        continue;
      }

      const pokemonDataOffset = partyDataOffset + i * 0x2C;
      if (pokemonDataOffset + 0x2C > data.length) {
        continue;
      }

      const slug = SPECIES_INDEX_TO_SLUG.get(speciesInternalId) || null;
      const dexId = slug ? GEN1_SLUG_TO_POKEDEX_ID.get(slug) || null : null;
      const currentHp = readUint16(data, pokemonDataOffset + 0x01);
      const maxHp = readUint16(data, pokemonDataOffset + 0x22);
      const level = data[pokemonDataOffset + 0x21] || data[pokemonDataOffset + 0x03] || null;
      const status = data[pokemonDataOffset + 0x04] || 0;
      const type1 = resolveTypeName(data[pokemonDataOffset + 0x05]);
      const type2 = resolveTypeName(data[pokemonDataOffset + 0x06]);
      const trainerId = readUint16(data, pokemonDataOffset + 0x0C);
      const attack = readUint16(data, pokemonDataOffset + 0x24);
      const defense = readUint16(data, pokemonDataOffset + 0x26);
      const speed = readUint16(data, pokemonDataOffset + 0x28);
      const special = readUint16(data, pokemonDataOffset + 0x2A);

      const otBytes =
        otNamesOffset + (i * 11) + 11 <= data.length
          ? data.slice(otNamesOffset + i * 11, otNamesOffset + i * 11 + 11)
          : null;
      const nicknameBytes =
        nicknameOffset + (i * 11) + 11 <= data.length
          ? data.slice(nicknameOffset + i * 11, nicknameOffset + i * 11 + 11)
          : null;

      entries.push({
        slot: i + 1,
        speciesInternalId,
        slug,
        dexId,
        currentHp,
        maxHp,
        level,
        status,
        statusText: interpretStatus(status),
        types: type1 === type2 ? [type1] : [type1, type2],
        stats: {
          attack,
          defense,
          speed,
          special,
        },
        originalTrainerId: trainerId,
        originalTrainerIdFormatted: String(trainerId).padStart(5, "0"),
        originalTrainerName: otBytes ? decodeGen1String(otBytes) : null,
        nickname: nicknameBytes ? decodeGen1String(nicknameBytes) : null,
      });
    }

    if (entries.length > 0 || count === 0) {
      return entries;
    }
  }
  return [];
}

function formatLegacyLocationName(raw) {
  if (!raw) return "";
  const cleaned = raw.replace(/_/g, " ");
  const withSpaces = cleaned.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Za-z])([0-9])/g, "$1 $2");
  return withSpaces.replace(/([0-9])\s+([A-Za-z])/g, "$1$2").trim();
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function parseColumnMetadata(header) {
  const trimmed = (header || "").trim();
  if (!trimmed) {
    return { methodLabel: DEFAULT_METHOD_LABEL, methodType: "land", chance: null };
  }
  const chanceMatch = trimmed.match(/(\d+(?:\.\d+)?)%/);
  const chance = chanceMatch ? parseFloat(chanceMatch[1]) : null;
  const labelWithoutChance = trimmed.replace(/(\d+(?:\.\d+)?)%/g, "").trim();
  const methodLabel = labelWithoutChance || DEFAULT_METHOD_LABEL;
  const lower = methodLabel.toLowerCase();
  let methodType = "land";
  if (lower.includes("surf")) methodType = "surf";
  else if (lower.includes("old rod")) methodType = "old-rod";
  else if (lower.includes("good rod")) methodType = "good-rod";
  else if (lower.includes("super rod")) methodType = "super-rod";
  else if (lower.includes("rod")) methodType = "rod";
  else if (lower.includes("fish")) methodType = "fishing";
  return { methodLabel, methodType, chance: Number.isFinite(chance) ? chance : null };
}

function parseEncounterCell(rawValue) {
  if (!rawValue) return null;
  let cleaned = rawValue.trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (!cleaned) return null;
  const match = cleaned.match(/^(\d+)(?:\s*,\s*|\s+)(.+)$/);
  if (!match) return null;
  const level = parseInt(match[1], 10);
  const rawName = match[2]?.trim() || "";
  if (!rawName) return null;
  return { level: Number.isFinite(level) ? level : null, rawName };
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return `${Math.round(value)}%`;
  }
  return `${value.toFixed(1)}%`;
}

function summarizeLevelRange(levelValues) {
  const sorted = levelValues.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return min === max ? `Lv${min}` : `Lv${min}-${max}`;
}

function summarizeChanceRange(chanceValues) {
  const sorted = chanceValues.filter((value) => Number.isFinite(value)).sort((a, b) => b - a);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return formatPercent(sorted[0]);
  if (sorted.length <= 3) {
    return sorted.map((value) => formatPercent(value)).join(" / ");
  }
  return `Up to ${formatPercent(sorted[0])}`;
}

function buildLegacyEncounterMap(csvText) {
  if (!csvText) return new Map();
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return new Map();
  const headers = parseCsvLine(lines[0]);
  const columnMeta = headers.map((header, index) => (index === 0 ? null : parseColumnMetadata(header)));
  const pokemonBuckets = new Map();
  let sequence = 0;

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const cells = parseCsvLine(lines[rowIndex]);
    if (cells.length === 0) continue;
    const rawLocation = (cells[0] || "").trim();
    if (!rawLocation) continue;
    const displayLocation = formatLegacyLocationName(rawLocation);

    for (let columnIndex = 1; columnIndex < cells.length; columnIndex++) {
      const rawCell = (cells[columnIndex] || "").trim();
      if (!rawCell) continue;
      const parsedCell = parseEncounterCell(rawCell);
      if (!parsedCell) continue;
      const slug = normalizeLegacyPokemonName(parsedCell.rawName);
      if (!slug) continue;
      const meta = columnMeta[columnIndex] || { methodLabel: DEFAULT_METHOD_LABEL, methodType: "land", chance: null };

      let pokemonMap = pokemonBuckets.get(slug);
      if (!pokemonMap) {
        pokemonMap = new Map();
        pokemonBuckets.set(slug, pokemonMap);
      }
      const bucketKey = `${rawLocation}|${meta.methodType}`;
      let bucket = pokemonMap.get(bucketKey);
      if (!bucket) {
        bucket = {
          order: sequence++,
          location: displayLocation,
          methodLabel: meta.methodLabel || DEFAULT_METHOD_LABEL,
          methodType: meta.methodType || "land",
          levels: new Set(),
          chances: new Set(),
        };
        pokemonMap.set(bucketKey, bucket);
      }

      if (Number.isFinite(parsedCell.level)) {
        bucket.levels.add(parsedCell.level);
      }
      if (Number.isFinite(meta.chance)) {
        bucket.chances.add(meta.chance);
      }
    }
  }

  const encounterMap = new Map();
  for (const [slug, bucketMap] of pokemonBuckets.entries()) {
    const entries = Array.from(bucketMap.values())
      .sort((a, b) => a.order - b.order)
      .map((bucket) => {
        const levelValues = Array.from(bucket.levels).sort((x, y) => x - y);
        const chanceValues = Array.from(bucket.chances).sort((x, y) => y - x);
        return {
          location: bucket.location,
          methodLabel: bucket.methodLabel,
          methodType: bucket.methodType,
          levelSummary: summarizeLevelRange(levelValues),
          chanceSummary: summarizeChanceRange(chanceValues),
          levelValues,
          chanceValues,
        };
      });
    encounterMap.set(slug, entries);
  }
  return encounterMap;
}

function normalizeLazarusLocationSegment(segment) {
  const trimmed = String(segment || "").trim();
  if (!trimmed || trimmed === "?") return null;
  if (/^\?\s*\(pc code\)/i.test(trimmed)) return LAZARUS_PC_CODE_LOCATION;
  return trimmed;
}

function splitLazarusLocations(locationText) {
  const rawSegments = String(locationText || "")
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  let hasEvolutionFlag = false;
  const segments = [];
  rawSegments.forEach((segment) => {
    if (/\(evolve\)/i.test(segment)) {
      hasEvolutionFlag = true;
      return;
    }
    const cleaned = normalizeLazarusLocationSegment(segment);
    if (cleaned) {
      segments.push(cleaned);
    }
  });
  return { segments, hasEvolutionFlag };
}

function buildLazarusLocationEntries(record) {
  const locationText = String(record?.location || "").trim();
  const evolutionText = String(record?.evolution || "").trim();
  if (!locationText) {
    return { entries: [], evolutionRequirement: null };
  }
  const { segments: locationSegments, hasEvolutionFlag } = splitLazarusLocations(locationText);
  if (locationSegments.length === 0 && !hasEvolutionFlag) {
    return { entries: [], evolutionRequirement: null };
  }

  let evolutionRequirement = null;
  if (hasEvolutionFlag) {
    evolutionRequirement = {
      method: evolutionText || "Evolve",
      target: record?.name || "Evolution",
    };
  }
  const entries = locationSegments.map((segment) => ({
    location: segment,
    methodLabel: "Location",
    methodType: "land",
    levelSummary: "",
    chanceSummary: "",
  }));

  return { entries, evolutionRequirement };
}

async function loadLegacyEncounterData() {
  if (legacyEncounterCache) {
    return legacyEncounterCache;
  }
  if (!legacyEncounterPromise) {
    legacyEncounterPromise = fetch(resolveLegacyCsvUrl())
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load encounter data (${response.status})`);
        }
        return response.text();
      })
      .then((text) => {
        legacyEncounterCache = buildLegacyEncounterMap(text);
        return legacyEncounterCache;
      })
      .finally(() => {
        legacyEncounterPromise = null;
      });
  }
  return legacyEncounterPromise;
}

/**
 * Parse Pokemon Yellow .sav or .srm file to extract caught Pokemon
 * @param {ArrayBuffer} arrayBuffer - The .sav or .srm file data
 * @returns {{caughtPokemon: Array<number>, sourceOffset: number, sourceLabel: string, offsetResults: Array}}
 */
function parseSavFile(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);

  const availableLocations = POKEDEX_DATA_LOCATIONS.filter(
    ({ offset }) => offset + POKEDEX_FLAG_BYTES <= data.length
  );

  if (availableLocations.length === 0) {
    throw new Error("Save file is too small to contain the Pokédex owned flags.");
  }

  const parseAtOffset = (offset) => {
    const caughtPokemon = [];

    for (let pokemonIndex = 0; pokemonIndex < GEN1_POKEMON_COUNT; pokemonIndex++) {
      const byteIndex = offset + Math.floor(pokemonIndex / 8);
      const bitPosition = pokemonIndex % 8;

      if (byteIndex >= data.length) {
        break;
      }

      const isCaught = ((data[byteIndex] >> bitPosition) & 1) !== 0;
      if (isCaught) {
        caughtPokemon.push(pokemonIndex + 1);
      }
    }

    return caughtPokemon;
  };

  const offsetResults = availableLocations.map(({ offset, label }) => {
    const bytes = Array.from(data.slice(offset, offset + POKEDEX_FLAG_BYTES));
    return {
      offset,
      label,
      bytes,
      caughtPokemon: parseAtOffset(offset),
    };
  });

  // Prefer the first location that shows progress; otherwise fall back to the first entry.
  const bestResult =
    offsetResults.find((entry) => entry.caughtPokemon.length > 0) ?? offsetResults[0];

  return {
    caughtPokemon: bestResult.caughtPokemon,
    sourceOffset: bestResult.offset,
    sourceLabel: bestResult.label,
    offsetResults,
  };
}

export default function SavPage() {
  const [gameKey, setGameKey] = useState("yellow");
  const [caughtPokemon, setCaughtPokemon] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [partyMembers, setPartyMembers] = useState([]);
  const [legacyEncounters, setLegacyEncounters] = useState(null);
  const [legacyEncountersReady, setLegacyEncountersReady] = useState(false);
  const [legacyEncounterError, setLegacyEncounterError] = useState(null);
  const [yellowReference, setYellowReference] = useState(null);
  const [yellowReferenceError, setYellowReferenceError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [showCaught, setShowCaught] = useState(true);
  const [lazarusDex, setLazarusDex] = useState([]);
  const [lazarusDexError, setLazarusDexError] = useState(null);
  const speciesSlugLookup = useMemo(() => {
    const map = new Map();
    Object.entries(NATIONAL_ID_TO_SLUG || {}).forEach(([id, slug]) => {
      if (!slug) return;
      const numericId = Number(id);
      if (Number.isFinite(numericId)) {
        map.set(numericId, normalizeSpeciesSlug(slug));
      }
    });
    return map;
  }, []);
  const slugToNationalId = useMemo(() => {
    const map = new Map();
    speciesSlugLookup.forEach((slug, id) => {
      if (slug) {
        map.set(slug, Number(id));
      }
    });
    return map;
  }, [speciesSlugLookup]);
  const lazarusReferenceReady = lazarusDex.length > 0;
  const lazarusDexByCustomId = useMemo(() => {
    const map = new Map();
    lazarusDex.forEach((record) => {
      if (record?.id != null) {
        map.set(Number(record.id), record);
      }
    });
    return map;
  }, [lazarusDex]);
  const lazarusDexBySlug = useMemo(() => {
    const map = new Map();
    lazarusDex.forEach((record) => {
      const slug = normalizeSpeciesSlug(record?.slug || record?.name);
      if (slug) {
        map.set(slug, record);
      }
    });
    return map;
  }, [lazarusDex]);
  const lazarusDexByNationalId = useMemo(() => {
    const map = new Map();
    lazarusDex.forEach((record) => {
      const slug = normalizeSpeciesSlug(record?.slug || record?.name);
      if (!slug) return;
      const nationalId = slugToNationalId.get(slug);
      if (nationalId != null) {
        map.set(nationalId, record);
      }
    });
    return map;
  }, [lazarusDex, slugToNationalId]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const basePath = (import.meta.env.BASE_URL || "/").replace(/\/+$|^$/, "/");
      const expectedPath = basePath === "/" ? "/save" : `${basePath}save`;
      
      // Redirect hash-based #/sav to path-based /save
      if (url.hash === "#/sav" || url.hash.startsWith("#/sav")) {
        url.pathname = expectedPath;
        url.hash = "";
        window.history.replaceState({}, "", url);
        return;
      }
      
      // Ensure path is /save
      if (url.pathname !== expectedPath && !url.pathname.endsWith("/save")) {
        url.pathname = expectedPath;
        url.hash = "";
        window.history.replaceState({}, "", url);
      }
    } catch {
      // Ignore browsers that cannot update the URL/hash
      return;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLegacyEncounterData()
      .then((encounterMap) => {
        if (cancelled) return;
        setLegacyEncounters(encounterMap);
        setLegacyEncountersReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setLegacyEncounters(new Map());
        setLegacyEncounterError(
          `Encounter location data is unavailable right now (${err?.message || "unknown error"}).`
        );
        setLegacyEncountersReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slugToNationalId]);

  useEffect(() => {
    let cancelled = false;
    fetch(resolveYellowReferenceUrl())
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load Yellow reference data (${response.status})`);
        }
        return response.json();
      })
      .then((records) => {
        if (cancelled) return;
        const map = new Map();
        (Array.isArray(records) ? records : []).forEach((record) => {
          if (record?.slug) {
            map.set(record.slug, record);
          }
        });
        setYellowReference(map);
        setYellowReferenceError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setYellowReference(new Map());
        setYellowReferenceError(
          `Pokemon Yellow reference data is unavailable right now (${err?.message || "unknown error"}).`
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(resolveLazarusReferenceUrl())
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load Lazarus reference data (${response.status})`);
        }
        return response.json();
      })
      .then((records) => {
        if (cancelled) return;
        const list = (Array.isArray(records) ? records : []).map((record) => {
          const normalizedSlug = normalizeSpeciesSlug(record?.slug || record?.name);
          const nationalId = normalizedSlug ? slugToNationalId.get(normalizedSlug) ?? null : null;
          return {
            ...record,
            slug: normalizedSlug || record?.slug || null,
            nationalId,
          };
        });
        list.sort((a, b) => {
          const idA = Number.isFinite(a?.id) ? a.id : Number.MAX_SAFE_INTEGER;
          const idB = Number.isFinite(b?.id) ? b.id : Number.MAX_SAFE_INTEGER;
          return idA - idB || String(a?.name || "").localeCompare(String(b?.name || ""));
        });
        setLazarusDex(list);
        setLazarusDexError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLazarusDex([]);
        setLazarusDexError(
          `Pokemon Lazarus reference data is unavailable right now (${err?.message || "unknown error"}).`
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const prepareForNewUpload = useCallback((targetGame) => {
    setGameKey(targetGame);
    setCaughtPokemon([]);
    setPartyMembers([]);
    setError(null);
    setLocationFilter("");
    setSearchTerm("");
    setShowCaught(true);
  }, []);

  const handleYellowFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileNameLower = file.name.toLowerCase();
    if (!fileNameLower.endsWith('.sav') && !fileNameLower.endsWith('.srm')) {
      setError("Please select a .sav or .srm file");
      return;
    }

    prepareForNewUpload("yellow");
    setLoading(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target.result;
        const data = new Uint8Array(arrayBuffer);
        const { caughtPokemon: caught } = parseSavFile(arrayBuffer);
        
        setFileData(data);
        
        const party = parsePartyPokemon(data);

        setCaughtPokemon(caught);
        setPartyMembers(party);
        setError(null);
      } catch (err) {
        setError(`Error parsing save file: ${err.message}`);
        setCaughtPokemon([]);
        setPartyMembers([]);
        setFileData(null);
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError("Error reading file");
      setLoading(false);
    };

    reader.readAsArrayBuffer(file);
  }, [prepareForNewUpload]);

  const handleLazarusFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const fileNameLower = file.name.toLowerCase();
      if (!fileNameLower.endsWith(".sav") && !fileNameLower.endsWith(".srm")) {
        setError("Please select a .sav or .srm file");
        return;
      }
      if (!lazarusReferenceReady) {
        setError("Pokemon Lazarus data is still loading. Please try again in a moment.");
        return;
      }

      prepareForNewUpload("lazarus");
      setLoading(true);
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target.result;
          const data = new Uint8Array(arrayBuffer);
          const { caughtPokemon: caught, partyMembers: party } = parseLazarusSavFile(arrayBuffer, {
            recordsByNationalId: lazarusDexByNationalId,
            recordsBySlug: lazarusDexBySlug,
            slugByNationalId: speciesSlugLookup,
          });
          setFileData(data);
          setCaughtPokemon(caught);
          setPartyMembers(party);
          setError(null);
        } catch (err) {
          setError(`Error parsing Pokemon Lazarus save file: ${err.message}`);
          setCaughtPokemon([]);
          setPartyMembers([]);
          setFileData(null);
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setError("Error reading file");
        setLoading(false);
      };

      reader.readAsArrayBuffer(file);
    },
    [lazarusDexByNationalId, lazarusDexBySlug, lazarusReferenceReady, prepareForNewUpload, speciesSlugLookup]
  );

  const caughtSet = useMemo(() => new Set(caughtPokemon), [caughtPokemon]);
  const hasSaveData = fileData instanceof Uint8Array;
  const showingYellow = gameKey === "yellow";
  const legacyMapReady = showingYellow ? legacyEncountersReady && legacyEncounters instanceof Map : true;
  const yellowReferenceReady = yellowReference instanceof Map;
  const activeGameLabel = showingYellow ? "Pokémon Yellow Legacy" : "Pokémon Lazarus";
  const referenceReady = showingYellow ? yellowReferenceReady : lazarusReferenceReady;
  const referenceError = showingYellow ? yellowReferenceError : lazarusDexError;
  const combinedResults = useMemo(() => {
    if (!showingYellow) {
      return lazarusDex.map((record, index) => {
        const { entries: visibleEntries, evolutionRequirement } = buildLazarusLocationEntries(record);
        const recordSlug = normalizeSpeciesSlug(record?.slug || record?.name);
        const entryId = Number.isFinite(record?.id) ? Number(record.id) : index + 1;
        const entryKey = `${entryId}-${recordSlug || record?.name || "entry"}-${index}`;
        return {
          entryKey,
          id: entryId,
          name: record?.name || `Pokemon ${entryId}`,
          slug: recordSlug || null,
          nationalId: record?.nationalId ?? null,
          caught:
            (record?.nationalId != null && caughtSet.has(Number(record.nationalId))) ||
            (record?.id != null && caughtSet.has(Number(record.id))),
          visibleEntries,
          evolutionRequirement,
          record,
        };
      });
    }
    return GEN1_POKEMON_NAMES.map((name, index) => {
      const pokemonId = index + 1;
      const slug = normalizeLegacyPokemonName(name);
      const encounterEntries = legacyMapReady ? legacyEncounters.get(slug) || [] : [];
      return {
        entryKey: `gen1-${pokemonId}`,
        id: pokemonId,
        name,
        slug,
        caught: caughtSet.has(pokemonId),
        visibleEntries: encounterEntries,
        evolutionRequirement: EVOLUTION_REQUIREMENTS.get(slug) || null,
      };
    });
  }, [caughtSet, lazarusDex, legacyEncounters, legacyMapReady, showingYellow]);
  const { totalDexCount, caughtCount } = useMemo(() => {
    const total = combinedResults.length || (showingYellow ? GEN1_POKEMON_COUNT : 0);
    const caught = combinedResults.reduce((sum, entry) => (entry.caught ? sum + 1 : sum), 0);
    return { totalDexCount: total, caughtCount: caught };
  }, [combinedResults, showingYellow]);
  const partySlots = useMemo(() => {
    return Array.from({ length: PARTY_MAX_SIZE }, (_, index) => partyMembers[index] || null);
  }, [partyMembers]);

  const locationOptions = useMemo(() => {
    const names = new Set();
    if (showingYellow) {
      if (legacyEncounters instanceof Map) {
        for (const entries of legacyEncounters.values()) {
          for (const entry of entries) {
            if (entry?.location) {
              names.add(entry.location);
            }
          }
        }
      }
    } else {
      lazarusDex.forEach((record) => {
        const { segments } = splitLazarusLocations(record?.location);
        segments.forEach((segment) => names.add(segment));
      });
    }
    return Array.from(names).sort((a, b) => LOCATION_COLLATOR.compare(a, b));
  }, [lazarusDex, legacyEncounters, showingYellow]);

  const filteredResults = useMemo(() => {
    const search = String(searchTerm || "").trim().toLowerCase();
    const locationValue = String(locationFilter || "").trim();
    return combinedResults.filter((entry) => {
      if (locationValue) {
        const matchesLocation = entry.visibleEntries.some((loc) => loc.location === locationValue);
        if (!matchesLocation) return false;
      }
      if (!showCaught && entry.caught) return false;
      if (!search) return true;
      return entry.name.toLowerCase().includes(search);
    });
  }, [combinedResults, locationFilter, searchTerm, showCaught]);

  const locationPokemonLookup = useMemo(() => {
    if (!showingYellow) {
      const aggregator = new Map();
      lazarusDex.forEach((record) => {
        const { segments: locationSegments } = splitLazarusLocations(record?.location);
        if (locationSegments.length === 0) {
          return;
        }
        locationSegments.forEach((locationName) => {
          let slugMap = aggregator.get(locationName);
          if (!slugMap) {
            slugMap = new Map();
            aggregator.set(locationName, slugMap);
          }
          const slug = record?.slug || record?.name || locationName;
          if (!slugMap.has(slug)) {
            slugMap.set(slug, {
              name: record?.name || slug,
              slug,
              caught:
                (record?.nationalId != null && caughtSet.has(Number(record.nationalId))) ||
                (record?.id != null && caughtSet.has(Number(record.id))),
            });
          }
        });
      });
      const result = new Map();
      for (const [locationName, slugMap] of aggregator.entries()) {
        result.set(
          locationName,
          Array.from(slugMap.values()).sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      return result;
    }
    if (!legacyMapReady || !(legacyEncounters instanceof Map)) {
      return new Map();
    }
    const aggregator = new Map();
    for (const [slug, entries] of legacyEncounters.entries()) {
      const displayName = SLUG_TO_TITLE_NAME.get(slug) || toTitleCase(slug);
      if (!displayName) continue;
      const pokemonId = GEN1_SLUG_TO_POKEDEX_ID.get(slug);
      const isCaught = pokemonId ? caughtSet.has(pokemonId) : false;
      for (const entryData of entries || []) {
        const locationName = entryData?.location;
        if (!locationName) continue;
        let slugMap = aggregator.get(locationName);
        if (!slugMap) {
          slugMap = new Map();
          aggregator.set(locationName, slugMap);
        }
        if (!slugMap.has(slug)) {
          slugMap.set(slug, {
            name: displayName,
            slug,
            caught: isCaught,
          });
        }
      }
    }
    const result = new Map();
    for (const [locationName, slugMap] of aggregator.entries()) {
      const shared = Array.from(slugMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      result.set(locationName, shared);
    }
    return result;
  }, [caughtSet, lazarusDex, legacyEncounters, legacyMapReady, showingYellow]);

  const hasFileSelected = Boolean(fileName);

  const handleClearSave = useCallback(() => {
    setGameKey("yellow");
    setFileData(null);
    setFileName(null);
    setCaughtPokemon([]);
    setPartyMembers([]);
    setError(null);
    setLegacyEncounterError(null);
    setLocationFilter("");
    setSearchTerm("");
    setShowCaught(true);
    setLoading(false);
  }, []);

  return (
    <div className="app-shell sav-page">
      <a
        className="discord-support-fab"
        href="https://discord.gg/WXMjmyjeC3"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Report a bug or request a feature on Discord"
      >
        Feedback · Discord
      </a>
      <header className="app-header">
        <div className="container">
          <h1 className="title logo">
            <span className="logo-accent">Pokedex</span>
            <div className="logo-dot" />
            <span className="logo-db">DB</span>
          </h1>
          <div className="sav-page__subtitle-wrapper">
            <p className="subtitle sav-page__subtitle">
              Import a <strong>Pokemon Yellow Legacy</strong> or <strong>Pokemon Lazarus</strong>{" "}
              <span className="sav-page__subtitle-emphasis">.sav / .srm</span> file to view your save data entirely in the browser.
            </p>
            <CategoryToggle />
          </div>
        </div>
      </header>
      <main className="container sav-page__content">
        <section className="sav-page__grid">
          {!hasFileSelected && (
            <>
              <article className="sav-card sav-card--primary">
                <div className="sav-card__header">
                  <h2 className="sav-card__title">Pokemon Yellow Legacy</h2>
                  <p className="sav-card__description">
                    Upload your save file to view your caught Pokemon and party.
                  </p>
                </div>
                <div className="sav-card__body">
                  <label className="sav-field-label" htmlFor="sav-upload-input">
                    Choose your save file
                  </label>
                  <input
                    id="sav-upload-input"
                    className="sav-file-input"
                    type="file"
                    accept=".sav,.srm"
                    onChange={handleYellowFileChange}
                    disabled={loading}
                  />
                  <p className="sav-meta">Processing happens locally in the browser. No files are uploaded.</p>
                  {fileName && (
                    <p className="sav-meta" aria-live="polite">
                      <strong>Selected:</strong> {fileName}
                    </p>
                  )}
                  {loading && gameKey === "yellow" && <p className="sav-status">Processing save file...</p>}
                  {error && gameKey === "yellow" && <div className="sav-alert sav-alert--error">{error}</div>}
                </div>
              </article>
              <article className="sav-card sav-card--primary">
                <div className="sav-card__header">
                  <h2 className="sav-card__title">Pokemon Lazarus</h2>
                  <p className="sav-card__description">
                    Upload your save file to view your caught Pokemon and party.
                  </p>
                </div>
                <div className="sav-card__body">
                  <label className="sav-field-label" htmlFor="lazarus-upload-input">
                    Choose your save file
                  </label>
                  <input
                    id="lazarus-upload-input"
                    className="sav-file-input"
                    type="file"
                    accept=".sav,.srm"
                    onChange={handleLazarusFileChange}
                    disabled={loading || !lazarusReferenceReady}
                  />
                  <p className="sav-meta">Processing happens locally in the browser. No files are uploaded.</p>
                  {!lazarusReferenceReady && !lazarusDexError && (
                    <p className="sav-status">Loading Pokemon Lazarus data...</p>
                  )}
                  {lazarusDexError && <div className="sav-alert sav-alert--error">{lazarusDexError}</div>}
                  {loading && gameKey === "lazarus" && <p className="sav-status">Processing save file...</p>}
                  {error && gameKey === "lazarus" && <div className="sav-alert sav-alert--error">{error}</div>}
                </div>
              </article>
              <article className="sav-card sav-card--info-panel-card">
                <div className="sav-card__body sav-card__info-panel-body">
                  <h3 className="sav-card__info-heading">Save Reader Notes</h3>
                  <p>
                    This reader currently supports <strong>Pokemon Yellow Legacy</strong> and{" "}
                    <strong>Pokemon Lazarus</strong> saves. If you are using a different ROM, parsing results may be inaccurate.
                  </p>
                  <p>
                    Learn more about the Legacy ROMs at{" "}
                    <a
                      className="sav-card__info-link"
                      href="https://www.reddit.com/r/PokemonLegacy/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      r/PokemonLegacy
                    </a>{" "}
                    and check out{" "}
                    <a
                      className="sav-card__info-link"
                      href="https://pokemonlazarus.net/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      PokemonLazarus.net
                    </a>{" "}
                    for the latest Lazarus documentation and downloads.
                  </p>
                </div>
              </article>
            </>
          )}
        </section>

        {hasSaveData && (
          <section className="sav-card sav-party-card">
            <div className="sav-card__header sav-card__header--with-actions">
              <div className="sav-card__header-body">
                <h2 className="sav-card__title">
                  Current Party · {activeGameLabel} ({partyMembers.length} / {PARTY_MAX_SIZE})
                </h2>
                <p className="sav-card__description">
                  These are the Pokémon currently stored in your party slots.
                </p>
              </div>
              <button type="button" className="sav-card__reset-button" onClick={handleClearSave}>
                Clear information
              </button>
            </div>
            <div className="sav-card__body">
              {partySlots.some(Boolean) ? (
                <div className="sav-party-grid">
                  {partySlots.map((slot, index) => {
                    if (!slot) {
                      return (
                        <div key={`party-slot-${index}`} className="sav-party-slot is-empty">
                          <div className="sav-party-slot__empty">
                            <span className="sav-party-slot__name">Slot {index + 1}</span>
                            <span className="sav-party-slot__empty-label">Empty</span>
                          </div>
                        </div>
                      );
                    }

                    const displayName =
                      slot.nickname ||
                      slot.displayName ||
                      (slot.slug ? toTitleCase(slot.slug) : `Species #${slot.speciesInternalId}`);
                    const hpPercent =
                      slot.maxHp && slot.maxHp > 0
                        ? Math.max(0, Math.min(100, (slot.currentHp / slot.maxHp) * 100))
                        : 0;
                    const primaryType = slot.types[0] || "Unknown";
                    const secondaryType = slot.types[1] || "";
                    const hasSecondaryType = Boolean(secondaryType);
                    const pokedexNumber =
                      slot.dexId != null ? `No. ${String(slot.dexId).padStart(3, "0")}` : "No. ---";
                    const pokedexUrl = slot.slug ? buildPokemonPath(slot.slug) : null;
                    const spriteNationalId = showingYellow
                      ? slot.dexId ?? slot.speciesInternalId ?? null
                      : slot.nationalId ?? null;
                    const slotSlugForSprite = slot.slug || normalizeSpeciesSlug(displayName);
                    const slotSpriteOverride =
                      !showingYellow && slotSlugForSprite
                        ? LAZARUS_SPRITE_OVERRIDES.get(slotSlugForSprite)
                        : null;
                    // For non-override sprites, use National Dex ID (numeric) for proper sprite lookup
                    const defaultSlotIdentifier = showingYellow
                      ? slot.dexId ?? slot.speciesInternalId ?? 0
                      : spriteNationalId ?? slot.dexId ?? slot.speciesInternalId ?? 0;
                    const spriteIdentifier = showingYellow
                      ? slot.dexId ?? slot.speciesInternalId ?? 0
                      : slotSpriteOverride ?? defaultSlotIdentifier;

                    const partySpriteProps = showingYellow
                      ? {
                          gameSpritePath: "generation-i/yellow/transparent/",
                          style: {
                            width: "192px",
                            height: "192px",
                            imageRendering: "pixelated",
                            transform: "scaleX(-1)",
                          },
                        }
                      : {
                          style: {
                            width: "192px",
                            height: "192px",
                          },
                          speciesId: spriteNationalId ?? undefined,
                          formName: slot.slug || slot.displayName || undefined,
                        };
                    return (
                      <div key={`party-slot-${index}`} className="sav-party-slot has-pokemon">
                        <div className="sav-party-slot__content">
                          <div className="sav-party-slot__sprite-area">
                            <div className="sav-party-slot__sprite-panel">
                              <div className="sav-party-slot__sprite-wrapper">
                                <SpriteImage id={spriteIdentifier} alt={displayName} {...partySpriteProps} />
                              </div>
                            </div>
                          </div>
                          <div className="sav-party-slot__info-area">
                            <div className="sav-party-slot__header-row">
                              {pokedexUrl ? (
                                <a
                                  className="sav-party-slot__display-name sav-party-slot__display-name-link"
                                  href={pokedexUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {displayName}
                                </a>
                              ) : (
                                <div className="sav-party-slot__display-name">{displayName}</div>
                              )}
                              <div className="sav-party-slot__level">
                                {slot.level != null ? `Lv${slot.level}` : "Lv??"}
                              </div>
                            </div>
                            <div className="sav-party-slot__hp">
                              <div className="sav-party-slot__hp-row">
                                <span className="sav-party-slot__hp-label">HP:</span>
                                <div className="sav-party-slot__hp-bar">
                                  <div
                                    className="sav-party-slot__hp-fill"
                                    style={{ width: `${hpPercent}%` }}
                                  />
                                </div>
                              </div>
                              <div className="sav-party-slot__hp-value">
                                {(slot.currentHp ?? 0).toString()} / {(slot.maxHp ?? 0).toString()}
                              </div>
                            </div>
                            <div className="sav-party-slot__status">
                              STATUS / {slot.statusText || "OK"}
                            </div>
                          </div>
                          <div className="sav-party-slot__stats-area">
                            <div className="sav-party-slot__number">{pokedexNumber}</div>
                            <div className="sav-party-slot__stat-grid">
                              {[
                                ["ATTACK", slot.stats?.attack],
                                ["DEFENSE", slot.stats?.defense],
                                ["SP. ATK", slot.stats?.spAttack ?? slot.stats?.special],
                                ["SP. DEF", slot.stats?.spDefense ?? slot.stats?.special],
                                ["SPEED", slot.stats?.speed],
                              ].map(([label, value]) => (
                                <div key={label} className="sav-party-slot__stat-row">
                                  <span>{label}</span>
                                  <span>{value != null ? value : "--"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="sav-party-slot__meta-area">
                            <div className="sav-party-slot__meta-number">{pokedexNumber}</div>
                            <div className="sav-party-slot__meta-block">
                              <div className="sav-party-slot__meta-line">
                                <span className="sav-party-slot__meta-label">
                                  {hasSecondaryType ? "TYPE 1" : "TYPE"}
                                </span>
                                <span className="sav-party-slot__meta-value">{primaryType}</span>
                              </div>
                              <div className="sav-party-slot__meta-line">
                                <span
                                  className={`sav-party-slot__meta-label ${
                                    !secondaryType ? "sav-party-slot__meta-label--hidden" : ""
                                  }`}
                                >
                                  TYPE 2
                                </span>
                                <span className="sav-party-slot__meta-value">
                                  {secondaryType || "\u00A0"}
                                </span>
                              </div>
                              {slot.nature && (
                                <div className="sav-party-slot__meta-line">
                                  <span className="sav-party-slot__meta-label">NATURE</span>
                                  <span className="sav-party-slot__meta-value">{slot.nature}</span>
                                </div>
                              )}
                              <div className="sav-party-slot__meta-line">
                                <span className="sav-party-slot__meta-label">IDNo</span>
                                <span className="sav-party-slot__meta-value">
                                  {slot.originalTrainerIdFormatted}
                                </span>
                              </div>
                              <div className="sav-party-slot__meta-line">
                                <span className="sav-party-slot__meta-label">OT</span>
                                <span className="sav-party-slot__meta-value">
                                  {slot.originalTrainerName || "Unknown"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="sav-party-empty">Party data unavailable (or party is empty).</div>
              )}
            </div>
          </section>
        )}

        <section className="sav-card sav-results-card">
          <div className="sav-card__header">
            <h2 className="sav-card__title">
              Caught Pokemon · {activeGameLabel} ({caughtCount} / {totalDexCount})
            </h2>
            <p className="sav-card__description">
              Review every Pokédex entry and compare your caught status with their encounter locations.
            </p>
            {!hasSaveData && (
              <div className="sav-card__hint">
                All entries default to “Missing” until you select a save file.
              </div>
            )}
            <div className="sav-results-controls">
              <label className="sav-results-controls__item">
                <span className="sav-results-controls__label">Search Pokémon</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Filter by name"
                />
              </label>
              <label className="sav-results-controls__item">
                <span className="sav-results-controls__label">Location</span>
                <select
                  value={locationFilter}
                  onChange={(event) => setLocationFilter(event.target.value)}
                >
                  <option value="">All locations</option>
                  {locationOptions.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sav-results-controls__item sav-results-controls__item--button">
                <button
                  type="button"
                  className={`sav-results-controls__toggle ${showCaught ? "is-active" : ""}`}
                  onClick={() => setShowCaught((prev) => !prev)}
                >
                  {showCaught ? "Hide caught" : "Show caught"}
                </button>
              </div>
            </div>
          </div>
            <div className="sav-card__body">
              {showingYellow && legacyEncounterError && (
                <div className="sav-alert sav-alert--error">{legacyEncounterError}</div>
              )}
              <div className="sav-results-list">
                {filteredResults.length > 0 ? (
                  <>
                    {filteredResults.map((entry) => {
                    const pokemonName = toTitleCase(entry.name);
                    const pokemonSlug = entry.slug || normalizeLegacyPokemonName(entry.name);
                    const referenceRecord = showingYellow
                      ? yellowReferenceReady
                        ? yellowReference.get(pokemonSlug)
                        : null
                      : entry.record || lazarusDexByCustomId.get(entry.id);
                    const speciesLabel = showingYellow
                      ? referenceRecord?.species || "Species unknown"
                      : null;
                    const heightLabel = showingYellow ? formatHeight(referenceRecord?.height) : null;
                    const weightLabel = showingYellow ? formatWeight(referenceRecord?.weight) : null;
                    const entryText = showingYellow
                      ? referenceRecord?.entry || "Yellow Pokedex entry unavailable."
                      : null;
                    const hasLocationInfo = entry.visibleEntries.length > 0;
                    const cardClassNames = [
                      "sav-result-row",
                      entry.caught ? "is-caught" : "is-uncaught",
                      hasLocationInfo ? "sav-result-row--has-locations" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    const pokedexUrl = showingYellow
                      ? `/?p=${encodeURIComponent(pokemonSlug || entry.id)}`
                      : entry.slug
                      ? buildPokemonPath(entry.slug)
                      : null;
                    const spriteNationalId = showingYellow ? entry.id : entry.nationalId ?? null;
                    const entrySlugForSprite = entry.slug || pokemonSlug;
                    const spriteOverride =
                      !showingYellow && entrySlugForSprite
                        ? LAZARUS_SPRITE_OVERRIDES.get(entrySlugForSprite)
                        : null;
                    // For non-override sprites, use National Dex ID (numeric) for proper sprite lookup
                    const defaultResultIdentifier = showingYellow
                      ? entry.id
                      : spriteNationalId ?? entry.id;
                    const spriteIdentifier = showingYellow
                      ? entry.id
                      : spriteOverride ?? defaultResultIdentifier;
                    const resultSpriteProps = showingYellow
                      ? {
                          gameSpritePath: "generation-i/yellow/transparent/",
                          style: {
                            width: "96px",
                            height: "96px",
                            imageRendering: "pixelated",
                          },
                        }
                      : {
                          style: {
                            width: "96px",
                            height: "96px",
                          },
                          // Use entry.id for form-specific sprites, fallback to nationalId for base forms
                          speciesId: spriteNationalId ?? undefined,
                          formName: pokemonSlug || entry.name,
                        };
                    const previewSpriteIdentifier = spriteIdentifier;
                    const previewSpriteProps = showingYellow
                      ? {
                          gameSpritePath: "generation-i/yellow/transparent/",
                          style: {
                            width: "192px",
                            height: "192px",
                            imageRendering: "pixelated",
                          },
                        }
                      : {
                          style: {
                            width: "140px",
                            height: "140px",
                          },
                          // Use entry.id for form-specific sprites, fallback to nationalId for base forms
                          speciesId: spriteNationalId ?? undefined,
                          formName: pokemonSlug || entry.name,
                        };
                    const lazarusStats = referenceRecord?.stats;
                    const lazarusStatRows = lazarusStats
                      ? [
                          ["HP", lazarusStats.hp],
                          ["ATK", lazarusStats.attack],
                          ["DEF", lazarusStats.defense],
                          ["SP. ATK", lazarusStats.spAttack],
                          ["SP. DEF", lazarusStats.spDefense],
                          ["SPEED", lazarusStats.speed],
                        ].filter(([_, value]) => value != null)
                      : [];
                    const lazarusTypes = referenceRecord?.types || [];
                    const lazarusAbilities = referenceRecord?.abilities || [];

                  return (
                    <div key={entry.entryKey || entry.id} className={cardClassNames}>
                      <div className="sav-result-row__pokemon">
                        <div className="sav-result-row__sprite">
                          <SpriteImage id={spriteIdentifier} alt={pokemonName} {...resultSpriteProps} />
                        </div>
                        <div className="sav-result-row__meta">
                          <div className="sav-result-row__nameblock">
                            <div className="sav-result-row__number">#{String(entry.id).padStart(3, "0")}</div>
                            {pokedexUrl ? (
                              <a
                                className="sav-result-row__name"
                                href={pokedexUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {pokemonName}
                              </a>
                            ) : (
                              <div className="sav-result-row__name">{pokemonName}</div>
                            )}
                          </div>
                          <span
                            className={`sav-result-row__status ${
                              entry.caught ? "sav-result-row__status--caught" : "sav-result-row__status--missing"
                            }`}
                          >
                            {entry.caught ? "Caught" : "Missing"}
                          </span>
                        </div>
                      </div>
                      <div className="sav-result-row__locations">
                        <div className="sav-result-row__locations-content">
                          {legacyMapReady ? (
                            entry.visibleEntries.length > 0 ? (
                              <ul className="sav-location-list">
                                {entry.visibleEntries.map((locationEntry, index) => {
                                  const rowClassNames = [
                                    "sav-location-row",
                                    locationEntry.methodType ? `sav-location-row--${locationEntry.methodType}` : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ");

                                  const detailParts = [];
                                  if (locationEntry.levelSummary) {
                                    detailParts.push(locationEntry.levelSummary);
                                  }
                                  if (locationEntry.chanceSummary) {
                                    detailParts.push(locationEntry.chanceSummary);
                                  }

                                  const hasSpecialLabel =
                                    locationEntry.methodLabel &&
                                    locationEntry.methodLabel !== DEFAULT_METHOD_LABEL;

                                  const sharedPokemon =
                                    locationPokemonLookup.get(locationEntry.location) || [];
                                  const sharedOthers = sharedPokemon.filter(
                                    (item) => item.name !== pokemonName
                                  );
                                  const caughtEntries = sharedOthers.filter((item) => item.caught);
                                  const missingEntries = sharedOthers.filter((item) => !item.caught);

                                  return (
                                    <li key={`${locationEntry.location}-${index}`} className={rowClassNames}>
                                      <div className="sav-location-row__name">{locationEntry.location}</div>
                                      {hasSpecialLabel && (
                                        <div className="sav-location-row__method-line">
                                          <span className="sav-location-row__method">{locationEntry.methodLabel}</span>
                                        </div>
                                      )}
                                      {detailParts.length > 0 && (
                                        <div className="sav-location-row__meta">{detailParts.join(" · ")}</div>
                                      )}
                                      <div className="sav-location-row__hover-panel">
                                        <div className="sav-location-row__hover-title">Also found here</div>
                                        {sharedOthers.length > 0 ? (
                                          <div className="sav-location-row__hover-grid">
                                            <div className="sav-location-row__hover-column">
                                              <div className="sav-location-row__hover-subtitle">Caught</div>
                                              {caughtEntries.length > 0 ? (
                                                <ul className="sav-location-row__hover-list">
                                                  {caughtEntries.map(({ name, slug }) => (
                                                    <li
                                                      key={`${slug || name}-caught`}
                                                      className="sav-location-row__hover-item sav-location-row__hover-item--caught"
                                                    >
                                                      <span className="sav-location-row__hover-item-dot" aria-hidden="true" />
                                                      <span>{name}</span>
                                                    </li>
                                                  ))}
                                                </ul>
                                              ) : (
                                                <div className="sav-location-row__hover-empty">None</div>
                                              )}
                                            </div>
                                            <div className="sav-location-row__hover-column">
                                              <div className="sav-location-row__hover-subtitle">Missing</div>
                                              {missingEntries.length > 0 ? (
                                                <ul className="sav-location-row__hover-list">
                                                  {missingEntries.map(({ name, slug }) => (
                                                    <li
                                                      key={`${slug || name}-missing`}
                                                      className="sav-location-row__hover-item sav-location-row__hover-item--missing"
                                                    >
                                                      <span className="sav-location-row__hover-item-dot" aria-hidden="true" />
                                                      <span>{name}</span>
                                                    </li>
                                                  ))}
                                                </ul>
                                              ) : (
                                                <div className="sav-location-row__hover-empty">None</div>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="sav-location-row__hover-empty">
                                            No other Pokémon share this location.
                                          </div>
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              !entry.evolutionRequirement && (
                                <div className="sav-location-empty">No encounter data</div>
                              )
                            )
                          ) : (
                            <div className="sav-location-empty">Loading encounter data...</div>
                          )}
                        </div>
                        <div className="sav-result-row__yellow-hover-panel" aria-hidden="true">
                          {referenceReady ? (
                            referenceRecord ? (
                              showingYellow ? (
                                <div className="sav-party-slot sav-party-slot--dex-preview">
                                  <div className="sav-party-slot__content">
                                    <div className="sav-party-slot__sprite-area">
                                      <div className="sav-party-slot__sprite-panel">
                                        <div className="sav-party-slot__sprite-wrapper">
                                        <SpriteImage
                                          id={previewSpriteIdentifier}
                                          alt={pokemonName}
                                          {...previewSpriteProps}
                                        />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="sav-party-slot__info-area">
                                      <div className="sav-party-slot__header-row">
                                        <div className="sav-party-slot__display-name">{pokemonName}</div>
                                      </div>
                                      <div className="sav-party-slot__hp">
                                        <div className="sav-party-slot__hp-row">
                                          <span className="sav-party-slot__hp-label">{speciesLabel}</span>
                                        </div>
                                        <div className="sav-party-slot__stat-row">
                                          <span className="sav-party-slot__meta-label">Height</span>
                                          <span className="sav-party-slot__meta-value">{heightLabel}</span>
                                        </div>
                                        <div className="sav-party-slot__stat-row">
                                          <span className="sav-party-slot__meta-label">Weight</span>
                                          <span className="sav-party-slot__meta-value">{weightLabel}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="sav-party-slot__entry-block">
                                      <div className="sav-party-slot__entry-label">Yellow Pokedex entry</div>
                                      <p className="sav-party-slot__entry-text">{entryText}</p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="sav-lazarus-hover-card">
                                  <div className="sav-lazarus-hover-card__header">
                                    <div className="sav-lazarus-hover-card__sprite">
                                      <SpriteImage
                                        id={previewSpriteIdentifier}
                                        alt={pokemonName}
                                        {...previewSpriteProps}
                                      />
                                    </div>
                                    <div className="sav-lazarus-hover-card__summary">
                                      <div className="sav-lazarus-hover-card__name">{pokemonName}</div>
                                      <div className="sav-lazarus-hover-card__bst">
                                        <span className="sav-lazarus-hover-card__bst-label">Base stat total</span>
                                        <span className="sav-lazarus-hover-card__bst-value">
                                          {referenceRecord?.bst != null ? referenceRecord.bst : "--"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="sav-lazarus-hover-card__body">
                                    <div className="sav-lazarus-hover-card__meta-grid">
                                      <div className="sav-lazarus-hover-card__meta-line">
                                        <span className="sav-lazarus-hover-card__meta-label">Types</span>
                                        <span className="sav-lazarus-hover-card__meta-value">
                                          {lazarusTypes.length > 0 ? lazarusTypes.join(" / ") : "Unknown"}
                                        </span>
                                      </div>
                                      {lazarusAbilities.length > 0 && (
                                        <div className="sav-lazarus-hover-card__meta-line">
                                          <span className="sav-lazarus-hover-card__meta-label">Abilities</span>
                                          <span className="sav-lazarus-hover-card__meta-value">
                                            {lazarusAbilities.join(" / ")}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    {lazarusStatRows.length > 0 && (
                                      <div className="sav-lazarus-hover-card__stats">
                                        {lazarusStatRows.map(([label, value]) => (
                                          <div key={label} className="sav-lazarus-hover-card__stat">
                                            <span className="sav-lazarus-hover-card__stat-label">{label}</span>
                                            <span className="sav-lazarus-hover-card__stat-value">
                                              {value != null ? value : "--"}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="sav-result-row__yellow-hover-placeholder">
                                {showingYellow ? "Yellow Pokedex entry unavailable." : "Lazarus data unavailable."}
                              </div>
                            )
                          ) : (
                            <div className="sav-result-row__yellow-hover-placeholder">
                              {referenceError || `Loading ${activeGameLabel} data...`}
                            </div>
                          )}
                        </div>
                        {entry.evolutionRequirement && (
                          <div
                            className={
                              legacyMapReady && entry.visibleEntries.length > 0
                                ? "sav-evolution"
                                : "sav-evolution has-no-border"
                            }
                          >
                            <div className="sav-evolution__label">Evolution</div>
                            <div className="sav-evolution__chain">
                              <span className="sav-evolution__method">
                                {entry.evolutionRequirement.method}
                              </span>
                              <span className="sav-evolution__arrow-icon">→</span>
                              <span className="sav-evolution__stage">
                                {entry.evolutionRequirement.target}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                  </>
                ) : (
                  <div className="sav-location-empty">
                    No Pokémon match the current search or location filter.
                  </div>
                )}
              </div>
            </div>
          </section>
      </main>
    </div>
  );
}
