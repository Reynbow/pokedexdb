import React, { useState, useCallback, useEffect, useMemo } from "react";
import "./App.css";
import SpriteImage from "./components/SpriteImage.jsx";
import CategoryToggle from "./CategoryToggle.jsx";
import { buildPokemonPath, getBasePath } from "./utils/url.js";
import { normalizeSpeciesSlug } from "./utils/lazarusSave.js";
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
// Names whose slug doesn't title-case cleanly.
const GEN1_DISPLAY_NAME_OVERRIDES = new Map([
  ["nidoran-f", "Nidoran\u2640"],
  ["nidoran-m", "Nidoran\u2642"],
  ["farfetchd", "Farfetch\u2019d"],
  ["mr-mime", "Mr. Mime"],
]);

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

// Gen 1 (English Red/Blue/Yellow) save layout, verified against Bulbapedia
// "Save data structure (Generation I)" and pret/pokeyellow ram/sram.asm.
// Pokemon Yellow Legacy keeps the same layout: it removes 78 unused bytes from the
// main data block but grows the bag by the same amount (BAG_ITEM_CAPACITY 20 -> 59).
// - The file is 32 KiB (0x8000): four 8 KiB banks. Bank 0 is scratch + Hall of Fame,
//   bank 1 (0x2000) is the main data, banks 2-3 hold PC boxes. There is no backup copy.
// - 0x25A3: Pokedex owned flags, 19 bytes, bit (n - 1) for dex number n, LSB first.
// - 0x2F2C: party list (count, 6 species + 0xFF, 6 x 44-byte mons, OT names, nicknames).
// - 0x3523: checksum = bitwise NOT of the 8-bit sum of bytes 0x2598..0x3522.
const GEN1_SAVE_SIZE = 0x8000;
const GEN1_CHECKSUM_START = 0x2598;
const GEN1_CHECKSUM_END = 0x3522; // inclusive
const GEN1_CHECKSUM_OFFSET = 0x3523;
const GEN1_POKEDEX_OWNED_OFFSET = 0x25A3;
const GEN1_POKEMON_COUNT = 151;
const PARTY_DATA_OFFSET = 0x2F2C;
const PARTY_MAX_SIZE = 6;
const PARTY_MON_SIZE = 0x2C;
const PARTY_NAME_LENGTH = 11;
// Largest file accepted before reading it (GBA saves are 128 KiB).
const MAX_SAVE_FILE_BYTES = 0x40000;
// Every 4 KiB Gen 3 (GBA) save section ends with this signature at offset 0xFF8.
const GEN3_SECTION_SIGNATURE = 0x08012025;

const LEGACY_CSV_FILENAME = "data/pokemon_yellow_legacy_list.csv";
const YELLOW_REFERENCE_FILENAME = "data/pokemon_yellow_reference.json";
const LAZARUS_REFERENCE_FILENAME = "data/pokemon_lazarus_reference.json";
const DEFAULT_METHOD_LABEL = "Grass";
const LOCATION_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const LAZARUS_PC_CODE_LOCATION = "Cheat Code";
const EMPTY_LIST = Object.freeze([]);
const PARTY_SPRITE_STYLE = {
  width: "192px",
  height: "192px",
  imageRendering: "pixelated",
  transform: "scaleX(-1)",
};

function resolveStaticDataUrl(filename) {
  return `${getBasePath()}${filename}`;
}

// Static reference files are fetched at most once per page load and only when the
// game that needs them is shown. A failed request is dropped so it can be retried.
const staticResourceCache = new Map();

function loadStaticResource(filename, parseResponse) {
  if (!staticResourceCache.has(filename)) {
    const promise = fetch(resolveStaticDataUrl(filename))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return parseResponse(response);
      })
      .catch((err) => {
        staticResourceCache.delete(filename);
        throw err;
      });
    staticResourceCache.set(filename, promise);
  }
  return staticResourceCache.get(filename);
}

function readUint16(data, offset) {
  if (offset + 1 >= data.length) return 0;
  return (data[offset] << 8) | data[offset + 1];
}

function decodeGen1String(bytes) {
  if (!bytes || bytes.length === 0) return null;
  const chars = [];
  for (const value of bytes) {
    // 0x50 terminates names (0xFF is the digit "9", not a terminator).
    if (value === 0x50) {
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

function toTitleCase(str) {
  if (typeof str !== "string" || str.length === 0) {
    return "";
  }
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getGen1DisplayName(slug) {
  return GEN1_DISPLAY_NAME_OVERRIDES.get(slug) || toTitleCase(slug);
}

// Evolution methods in Pokemon Yellow Legacy (the hack's data/pokemon/evos_moves.asm).
// The optional fourth value is the method in the original Pokemon Yellow when it differs
// (pret/pokeyellow data/pokemon/evos_moves.asm): Legacy turns the four trade evolutions
// into level-ups and moves Poliwag's evolution from level 25 to 18.
const GEN1_EVOLUTIONS = [
  ["bulbasaur", "ivysaur", "Level 16"],
  ["ivysaur", "venusaur", "Level 32"],
  ["charmander", "charmeleon", "Level 16"],
  ["charmeleon", "charizard", "Level 36"],
  ["squirtle", "wartortle", "Level 16"],
  ["wartortle", "blastoise", "Level 36"],
  ["caterpie", "metapod", "Level 7"],
  ["metapod", "butterfree", "Level 10"],
  ["weedle", "kakuna", "Level 7"],
  ["kakuna", "beedrill", "Level 10"],
  ["pidgey", "pidgeotto", "Level 18"],
  ["pidgeotto", "pidgeot", "Level 36"],
  ["rattata", "raticate", "Level 20"],
  ["spearow", "fearow", "Level 20"],
  ["ekans", "arbok", "Level 22"],
  ["pikachu", "raichu", "Thunder Stone"],
  ["sandshrew", "sandslash", "Level 22"],
  ["nidoran-f", "nidorina", "Level 16"],
  ["nidorina", "nidoqueen", "Moon Stone"],
  ["nidoran-m", "nidorino", "Level 16"],
  ["nidorino", "nidoking", "Moon Stone"],
  ["clefairy", "clefable", "Moon Stone"],
  ["vulpix", "ninetales", "Fire Stone"],
  ["jigglypuff", "wigglytuff", "Moon Stone"],
  ["zubat", "golbat", "Level 22"],
  ["oddish", "gloom", "Level 21"],
  ["gloom", "vileplume", "Leaf Stone"],
  ["paras", "parasect", "Level 24"],
  ["venonat", "venomoth", "Level 31"],
  ["diglett", "dugtrio", "Level 26"],
  ["meowth", "persian", "Level 28"],
  ["psyduck", "golduck", "Level 33"],
  ["mankey", "primeape", "Level 28"],
  ["growlithe", "arcanine", "Fire Stone"],
  ["poliwag", "poliwhirl", "Level 18", "Level 25"],
  ["poliwhirl", "poliwrath", "Water Stone"],
  ["abra", "kadabra", "Level 16"],
  ["kadabra", "alakazam", "Level 42", "Trade"],
  ["machop", "machoke", "Level 28"],
  ["machoke", "machamp", "Level 38", "Trade"],
  ["bellsprout", "weepinbell", "Level 21"],
  ["weepinbell", "victreebel", "Leaf Stone"],
  ["tentacool", "tentacruel", "Level 30"],
  ["geodude", "graveler", "Level 25"],
  ["graveler", "golem", "Level 38", "Trade"],
  ["ponyta", "rapidash", "Level 40"],
  ["slowpoke", "slowbro", "Level 37"],
  ["magnemite", "magneton", "Level 30"],
  ["doduo", "dodrio", "Level 31"],
  ["seel", "dewgong", "Level 34"],
  ["grimer", "muk", "Level 38"],
  ["shellder", "cloyster", "Water Stone"],
  ["gastly", "haunter", "Level 25"],
  ["haunter", "gengar", "Level 42", "Trade"],
  ["drowzee", "hypno", "Level 26"],
  ["krabby", "kingler", "Level 28"],
  ["voltorb", "electrode", "Level 30"],
  ["exeggcute", "exeggutor", "Leaf Stone"],
  ["cubone", "marowak", "Level 28"],
  ["koffing", "weezing", "Level 35"],
  ["rhyhorn", "rhydon", "Level 42"],
  ["horsea", "seadra", "Level 32"],
  ["goldeen", "seaking", "Level 33"],
  ["staryu", "starmie", "Water Stone"],
  ["magikarp", "gyarados", "Level 20"],
  ["eevee", "vaporeon", "Water Stone"],
  ["eevee", "jolteon", "Thunder Stone"],
  ["eevee", "flareon", "Fire Stone"],
  ["omanyte", "omastar", "Level 40"],
  ["kabuto", "kabutops", "Level 40"],
  ["dratini", "dragonair", "Level 30"],
  ["dragonair", "dragonite", "Level 55"],
];

// Keyed by the evolved Pokemon: how it is obtained from its pre-evolution.
const EVOLUTION_REQUIREMENTS = new Map(
  GEN1_EVOLUTIONS.map(([from, to, method, vanillaMethod]) => [
    to,
    {
      from: getGen1DisplayName(from),
      method: vanillaMethod ? `${method} (${vanillaMethod} in original Yellow)` : method,
      target: getGen1DisplayName(to),
    },
  ])
);

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

// English Gen 1 text encoding (Bulbapedia "Character encoding (Generation I)";
// pret/pokeyellow constants/charmap.asm). Letters and digits are added below.
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
  [0xef, "\u2642"], // ♂
  [0xf1, "\u00d7"], // ×
  [0xf2, "."],
  [0xf3, "/"],
  [0xf4, ","],
  [0xf5, "\u2640"], // ♀
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

// Party list layout (Bulbapedia "Full Party Data"; pret macros/ram.asm party_struct):
// +0x000 count, +0x001 species IDs (6 + 0xFF terminator), +0x008 6 x 44-byte mons,
// +0x110 6 x 11-byte OT names, +0x152 6 x 11-byte nicknames. Multi-byte values are big-endian.
function parsePartyPokemon(data) {
  const offset = PARTY_DATA_OFFSET;
  const count = data[offset];
  if (!Number.isInteger(count) || count > PARTY_MAX_SIZE) {
    return [];
  }

  const entries = [];
  const partyDataOffset = offset + 0x08;
  const otNamesOffset = offset + 0x110;
  const nicknameOffset = offset + 0x152;

  for (let i = 0; i < count; i++) {
    const speciesInternalId = data[offset + 1 + i];
    if (!speciesInternalId || speciesInternalId === 0xff) {
      continue;
    }

    const pokemonDataOffset = partyDataOffset + i * PARTY_MON_SIZE;
    const slug = SPECIES_INDEX_TO_SLUG.get(speciesInternalId) || null;
    const dexId = slug ? GEN1_SLUG_TO_POKEDEX_ID.get(slug) || null : null;
    const status = data[pokemonDataOffset + 0x04] || 0;
    const type1 = resolveTypeName(data[pokemonDataOffset + 0x05]);
    const type2 = resolveTypeName(data[pokemonDataOffset + 0x06]);
    const trainerId = readUint16(data, pokemonDataOffset + 0x0C);
    const otStart = otNamesOffset + i * PARTY_NAME_LENGTH;
    const nicknameStart = nicknameOffset + i * PARTY_NAME_LENGTH;

    entries.push({
      slot: i + 1,
      speciesInternalId,
      slug,
      dexId,
      currentHp: readUint16(data, pokemonDataOffset + 0x01),
      maxHp: readUint16(data, pokemonDataOffset + 0x22),
      level: data[pokemonDataOffset + 0x21] || data[pokemonDataOffset + 0x03] || null,
      status,
      statusText: interpretStatus(status),
      types: type1 === type2 ? [type1] : [type1, type2],
      stats: {
        attack: readUint16(data, pokemonDataOffset + 0x24),
        defense: readUint16(data, pokemonDataOffset + 0x26),
        speed: readUint16(data, pokemonDataOffset + 0x28),
        special: readUint16(data, pokemonDataOffset + 0x2A),
      },
      originalTrainerId: trainerId,
      originalTrainerIdFormatted: String(trainerId).padStart(5, "0"),
      originalTrainerName: decodeGen1String(data.subarray(otStart, otStart + PARTY_NAME_LENGTH)),
      nickname: decodeGen1String(data.subarray(nicknameStart, nicknameStart + PARTY_NAME_LENGTH)),
    });
  }
  return entries;
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
      const slug = normalizeSpeciesSlug(parsedCell.rawName);
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
          // A species can fill several encounter slots in one area; its odds are the sum.
          chanceTotal: 0,
          hasChance: false,
        };
        pokemonMap.set(bucketKey, bucket);
      }

      if (Number.isFinite(parsedCell.level)) {
        bucket.levels.add(parsedCell.level);
      }
      if (Number.isFinite(meta.chance)) {
        bucket.chanceTotal += meta.chance;
        bucket.hasChance = true;
      }
    }
  }

  const encounterMap = new Map();
  for (const [slug, bucketMap] of pokemonBuckets.entries()) {
    const entries = Array.from(bucketMap.values())
      .sort((a, b) => a.order - b.order)
      .map((bucket) => {
        const levelValues = Array.from(bucket.levels).sort((x, y) => x - y);
        // Column headers carry rounded slot rates, so a full table can sum to 100.1%.
        const chanceTotal = bucket.hasChance ? Math.min(100, bucket.chanceTotal) : null;
        return {
          location: bucket.location,
          methodLabel: bucket.methodLabel,
          methodType: bucket.methodType,
          levelSummary: summarizeLevelRange(levelValues),
          chanceSummary: chanceTotal != null ? formatPercent(chanceTotal) : "",
          levelValues,
          chanceTotal,
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

function extractBaseLocationName(locationText) {
  // Remove all parenthetical information to get the base location name
  // This includes (fish), (surf), (Peak), (West), (North), etc.
  let baseName = String(locationText || "").trim();
  if (!baseName) return "";

  // Remove level information first
  baseName = baseName.replace(/Lv\.\s*\d+(?:\s*-\s*\d+)?/gi, "").trim();

  // Remove all parenthetical information
  baseName = baseName.replace(/\s*\([^)]*\)/g, "").trim();

  // Clean up extra spaces
  baseName = baseName.replace(/\s+/g, " ").trim();

  return baseName;
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

function getLazarusLocationSegments(record) {
  const details = Array.isArray(record?.locationDetails) ? record.locationDetails : null;
  if (details && details.length > 0) {
    return details
      .map((detail) => String(detail?.location || "").trim())
      .filter((value) => value.length > 0);
  }
  const { segments } = splitLazarusLocations(record?.location);
  return segments;
}

function deriveMethodTypeFromLabel(label) {
  const normalized = String(label || "").toLowerCase();
  if (!normalized) return "land";
  if (normalized.includes("surf")) return "surf";
  if (normalized.includes("fish")) return "fishing";
  if (normalized.includes("rod")) return "fishing";
  if (normalized.includes("event") || normalized.includes("quest") || normalized.includes("gift")) {
    return "event";
  }
  return "land";
}

function formatLazarusLevel(levelText) {
  const cleaned = String(levelText || "").trim();
  if (!cleaned) return "";
  if (/^lv/i.test(cleaned)) {
    return cleaned;
  }
  return `Lv. ${cleaned}`;
}

function buildLazarusLocationEntries(record) {
  const locationText = String(record?.location || "").trim();
  const evolutionText = String(record?.evolution || "").trim();
  const detailEntries = Array.isArray(record?.locationDetails) ? record.locationDetails : null;
  let evolutionRequirement = null;

  if (detailEntries && detailEntries.length > 0) {
    const entries = detailEntries
      .filter((detail) => String(detail?.location || "").trim().length > 0)
      .map((detail) => {
        const locationName = String(detail.location || "").trim();
        const methodLabel = String(detail.method || "").trim() || null;
        const methodType = deriveMethodTypeFromLabel(methodLabel);
        const levelSummary = detail.level ? formatLazarusLevel(detail.level) : "";
        const notes = [detail.moreInfo, detail.extraInfo]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .join(" · ");
        return {
          location: locationName,
          methodLabel,
          methodType,
          levelSummary,
          chanceSummary: "",
          notes,
        };
      });
    return { entries, evolutionRequirement };
  }

  if (!locationText) {
    return { entries: [], evolutionRequirement: null };
  }
  const { segments: locationSegments, hasEvolutionFlag } = splitLazarusLocations(locationText);
  if (locationSegments.length === 0 && !hasEvolutionFlag) {
    return { entries: [], evolutionRequirement: null };
  }

  if (hasEvolutionFlag) {
    evolutionRequirement = {
      method: evolutionText || "Evolve",
      target: record?.name || "Evolution",
    };
  }
  const entries = locationSegments.map((segment) => {
    // Extract method type from segment (fish, surf)
    let methodType = "land";
    let methodLabel = "Location";
    let cleanSegment = segment;
    let levelSummary = "";
    const noteParts = [];

    // Extract and inspect parenthetical segments
    const parentheticalMatches = Array.from(segment.matchAll(/\(([^)]+)\)/g));
    parentheticalMatches.forEach((match) => {
      const fullText = match[0];
      const value = match[1]?.trim() || "";
      const lower = value.toLowerCase();
      if (lower === "fish") {
        methodType = "fishing";
        methodLabel = "Fish";
        cleanSegment = cleanSegment.replace(fullText, "").trim();
      } else if (lower === "surf") {
        methodType = "surf";
        methodLabel = "Surf";
        cleanSegment = cleanSegment.replace(fullText, "").trim();
      } else {
        noteParts.push(value);
        cleanSegment = cleanSegment.replace(fullText, "").trim();
      }
    });

    // Extract level information: "Lv. X" or "Lv. X-Y"
    // Can appear before or after method parentheses
    const levelMatch = cleanSegment.match(/Lv\.\s*(\d+)(?:\s*-\s*(\d+))?/i);
    if (levelMatch) {
      const minLevel = parseInt(levelMatch[1], 10);
      const maxLevel = levelMatch[2] ? parseInt(levelMatch[2], 10) : minLevel;
      if (minLevel === maxLevel) {
        levelSummary = `Lv. ${minLevel}`;
      } else {
        levelSummary = `Lv. ${minLevel}-${maxLevel}`;
      }
      cleanSegment = cleanSegment.replace(/Lv\.\s*\d+(?:\s*-\s*\d+)?/gi, "").trim();
    }

    // Extract base location name (remove any remaining parenthetical info like (West), (Peak), etc.)
    const baseLocation = extractBaseLocationName(cleanSegment) || cleanSegment || "Unknown Location";
    const notes = noteParts.join(", ");

    return {
      location: baseLocation,
      methodLabel,
      methodType,
      levelSummary,
      chanceSummary: "",
      notes,
    };
  });

  return { entries, evolutionRequirement };
}

function loadLegacyEncounterData() {
  return loadStaticResource(LEGACY_CSV_FILENAME, async (response) =>
    buildLegacyEncounterMap(await response.text())
  );
}

function loadYellowReference() {
  return loadStaticResource(YELLOW_REFERENCE_FILENAME, async (response) => {
    const records = await response.json();
    const map = new Map();
    (Array.isArray(records) ? records : []).forEach((record) => {
      if (record?.slug) {
        map.set(record.slug, record);
      }
    });
    return map;
  });
}

let slugToNationalIdCache = null;

function getSlugToNationalId() {
  if (!slugToNationalIdCache) {
    slugToNationalIdCache = new Map();
    Object.entries(NATIONAL_ID_TO_SLUG || {}).forEach(([id, slug]) => {
      const numericId = Number(id);
      const normalizedSlug = normalizeSpeciesSlug(slug);
      if (normalizedSlug && Number.isFinite(numericId)) {
        slugToNationalIdCache.set(normalizedSlug, numericId);
      }
    });
  }
  return slugToNationalIdCache;
}

function loadLazarusReference() {
  return loadStaticResource(LAZARUS_REFERENCE_FILENAME, async (response) => {
    const records = await response.json();
    const slugToNationalId = getSlugToNationalId();
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
    return list;
  });
}

function computeGen1Checksum(data) {
  let sum = 0;
  for (let i = GEN1_CHECKSUM_START; i <= GEN1_CHECKSUM_END; i++) {
    sum = (sum + data[i]) & 0xff;
  }
  return ~sum & 0xff;
}

function looksLikeGen3Save(data) {
  for (let offset = 0; offset + 0x1000 <= data.length && offset < 0x20000; offset += 0x1000) {
    const signatureOffset = offset + 0xff8;
    const signature =
      (data[signatureOffset] |
        (data[signatureOffset + 1] << 8) |
        (data[signatureOffset + 2] << 16) |
        (data[signatureOffset + 3] << 24)) >>>
      0;
    if (signature === GEN3_SECTION_SIGNATURE) {
      return true;
    }
  }
  return false;
}

const NOT_GEN1_SAVE_MESSAGE =
  "This doesn't look like a Gen 1 (Red/Blue/Yellow) save. Choose the .sav or .srm file of an English Pokémon Red, Blue, Yellow or Yellow Legacy game that has been saved in-game at least once.";

/**
 * Parse an English Gen 1 (Red/Blue/Yellow, Yellow Legacy) .sav/.srm file.
 * Throws an Error with a user-facing message when the file isn't a valid Gen 1 save.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {{caughtPokemon: Array<number>, partyMembers: Array<object>}}
 */
function parseSavFile(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);

  if (data.length < GEN1_SAVE_SIZE) {
    throw new Error(
      `${NOT_GEN1_SAVE_MESSAGE} (The file is ${data.length.toLocaleString()} bytes; Gen 1 saves are 32 KB.)`
    );
  }
  if (computeGen1Checksum(data) !== data[GEN1_CHECKSUM_OFFSET]) {
    if (looksLikeGen3Save(data)) {
      throw new Error(
        "This is a Game Boy Advance save (for example Pokémon Lazarus or FireRed). The save reader can only read Gen 1 (Red/Blue/Yellow) saves."
      );
    }
    throw new Error(`${NOT_GEN1_SAVE_MESSAGE} (Its checksum doesn't match.)`);
  }

  const caughtPokemon = [];
  for (let pokemonIndex = 0; pokemonIndex < GEN1_POKEMON_COUNT; pokemonIndex++) {
    const flags = data[GEN1_POKEDEX_OWNED_OFFSET + (pokemonIndex >> 3)];
    if ((flags >> (pokemonIndex & 7)) & 1) {
      caughtPokemon.push(pokemonIndex + 1);
    }
  }

  return {
    caughtPokemon,
    partyMembers: parsePartyPokemon(data),
  };
}

export default function SavPage() {
  const [gameKey, setGameKey] = useState("yellow");
  const [caughtPokemon, setCaughtPokemon] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Only set once a save has been parsed successfully.
  const [fileName, setFileName] = useState(null);
  const [partyMembers, setPartyMembers] = useState([]);
  const [legacyEncounters, setLegacyEncounters] = useState(null);
  const [legacyEncountersReady, setLegacyEncountersReady] = useState(false);
  const [legacyEncounterError, setLegacyEncounterError] = useState(null);
  const [yellowReference, setYellowReference] = useState(null);
  const [yellowReferenceError, setYellowReferenceError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [showCaught, setShowCaught] = useState(true);
  const [lazarusDex, setLazarusDex] = useState(null);
  const [lazarusDexError, setLazarusDexError] = useState(null);
  const [openDexEntryKey, setOpenDexEntryKey] = useState(null);
  const showingYellow = gameKey === "yellow";
  const lazarusRecords = lazarusDex ?? EMPTY_LIST;
  const lazarusReferenceReady = Array.isArray(lazarusDex);

  // URL routing (including legacy #/sav redirects) is handled centrally in src/router.js.

  // Reference data is fetched only for the game currently shown.
  useEffect(() => {
    if (!showingYellow || legacyEncountersReady) return undefined;
    let cancelled = false;
    loadLegacyEncounterData()
      .then((encounterMap) => {
        if (cancelled) return;
        setLegacyEncounters(encounterMap);
        setLegacyEncounterError(null);
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
  }, [showingYellow, legacyEncountersReady]);

  useEffect(() => {
    if (!showingYellow || yellowReference) return undefined;
    let cancelled = false;
    loadYellowReference()
      .then((map) => {
        if (cancelled) return;
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
  }, [showingYellow, yellowReference]);

  useEffect(() => {
    if (showingYellow || lazarusReferenceReady) return undefined;
    let cancelled = false;
    loadLazarusReference()
      .then((list) => {
        if (cancelled) return;
        setLazarusDex(list);
        setLazarusDexError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLazarusDex(EMPTY_LIST);
        setLazarusDexError(
          `Pokemon Lazarus reference data is unavailable right now (${err?.message || "unknown error"}).`
        );
      });
    return () => {
      cancelled = true;
    };
  }, [showingYellow, lazarusReferenceReady]);

  // Close the open Pokedex panel on Escape or a click/tap outside its row.
  useEffect(() => {
    if (openDexEntryKey == null) return undefined;
    const handlePointerDown = (event) => {
      const row = event.target instanceof Element ? event.target.closest("[data-dex-entry-key]") : null;
      if (row?.getAttribute("data-dex-entry-key") !== openDexEntryKey) {
        setOpenDexEntryKey(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenDexEntryKey(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openDexEntryKey]);

  const resetResultFilters = useCallback(() => {
    setLocationFilter("");
    setSearchTerm("");
    setShowCaught(true);
    setOpenDexEntryKey(null);
  }, []);

  const handleYellowFileChange = useCallback(
    async (event) => {
      const input = event.target;
      const file = input.files?.[0];
      // Reset the input so choosing the same file again (e.g. after an error) fires onChange.
      input.value = "";
      if (!file) {
        return;
      }

      const fileNameLower = file.name.toLowerCase();
      if (!fileNameLower.endsWith(".sav") && !fileNameLower.endsWith(".srm")) {
        setError(`"${file.name}" isn't a .sav or .srm file.`);
        return;
      }
      if (file.size > MAX_SAVE_FILE_BYTES) {
        setError(`"${file.name}" is too large to be a Game Boy save file.`);
        return;
      }

      setError(null);
      setLoading(true);
      try {
        const { caughtPokemon: caught, partyMembers: party } = parseSavFile(await file.arrayBuffer());
        setGameKey("yellow");
        resetResultFilters();
        setCaughtPokemon(caught);
        setPartyMembers(party);
        setFileName(file.name);
      } catch (err) {
        setError(`Couldn't read "${file.name}": ${err?.message || "unknown error"}`);
      } finally {
        setLoading(false);
      }
    },
    [resetResultFilters]
  );

  const caughtSet = useMemo(() => new Set(caughtPokemon), [caughtPokemon]);
  const hasSaveData = fileName != null;
  const legacyMapReady = showingYellow ? legacyEncountersReady && legacyEncounters instanceof Map : true;
  const yellowReferenceReady = yellowReference instanceof Map;
  const activeGameLabel = showingYellow ? "Pokémon Yellow Legacy" : "Pokémon Lazarus";
  const referenceReady = showingYellow ? yellowReferenceReady : lazarusReferenceReady;
  const referenceError = showingYellow ? yellowReferenceError : lazarusDexError;
  const dexPanelLabel = showingYellow ? "Pokédex entry" : "Pokédex data";
  const combinedResults = useMemo(() => {
    if (!showingYellow) {
      return lazarusRecords.map((record, index) => {
        const { entries: visibleEntries, evolutionRequirement } = buildLazarusLocationEntries(record);
        const recordSlug = normalizeSpeciesSlug(record?.slug || record?.name);
        const entryId = Number.isFinite(record?.id) ? Number(record.id) : index + 1;
        const entryKey = `${entryId}-${recordSlug || "entry"}-${index}`;
        const recordId = Number.isFinite(record?.id) ? Number(record.id) : null;
        const nationalId = record?.nationalId != null ? Number(record.nationalId) : null;
        const name = record?.name || `Pokemon ${entryId}`;
        return {
          entryKey,
          id: entryId,
          name,
          displayName: toTitleCase(name),
          slug: recordSlug || null,
          nationalId,
          // Matches either the Lazarus custom ID or the National Dex ID.
          caught:
            (recordId != null && caughtSet.has(recordId)) ||
            (nationalId != null && caughtSet.has(nationalId)),
          visibleEntries,
          evolutionRequirement,
          record,
        };
      });
    }
    return GEN1_POKEMON_NAMES.map((slug, index) => {
      const pokemonId = index + 1;
      const encounterEntries = legacyMapReady ? legacyEncounters.get(slug) || [] : [];
      return {
        entryKey: `gen1-${pokemonId}`,
        id: pokemonId,
        name: slug,
        displayName: getGen1DisplayName(slug),
        slug,
        caught: caughtSet.has(pokemonId),
        visibleEntries: encounterEntries,
        evolutionRequirement: EVOLUTION_REQUIREMENTS.get(slug) || null,
      };
    });
  }, [caughtSet, lazarusRecords, legacyEncounters, legacyMapReady, showingYellow]);
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
      lazarusRecords.forEach((record) => {
        const segments = getLazarusLocationSegments(record);
        segments.forEach((segment) => {
          const baseName = extractBaseLocationName(segment);
          if (baseName) {
            names.add(baseName);
          }
        });
      });
    }
    return Array.from(names).sort((a, b) => LOCATION_COLLATOR.compare(a, b));
  }, [lazarusRecords, legacyEncounters, showingYellow]);

  const filteredResults = useMemo(() => {
    const search = String(searchTerm || "").trim().toLowerCase();
    const searchSlug = normalizeSpeciesSlug(search);
    const locationValue = String(locationFilter || "").trim();
    return combinedResults.filter((entry) => {
      if (locationValue) {
        const matchesLocation = entry.visibleEntries.some((loc) => loc.location === locationValue);
        if (!matchesLocation) return false;
      }
      if (!showCaught && entry.caught) return false;
      if (!search) return true;
      return (
        entry.displayName.toLowerCase().includes(search) ||
        entry.name.toLowerCase().includes(search) ||
        Boolean(searchSlug && entry.slug?.includes(searchSlug))
      );
    });
  }, [combinedResults, locationFilter, searchTerm, showCaught]);

  const locationPokemonLookup = useMemo(() => {
    if (!showingYellow) {
      const aggregator = new Map();
      lazarusRecords.forEach((record) => {
        const locationSegments = getLazarusLocationSegments(record);
        if (locationSegments.length === 0) {
          return;
        }
        locationSegments.forEach((locationName) => {
          const baseLocationName = extractBaseLocationName(locationName);
          if (!baseLocationName) return;
          let slugMap = aggregator.get(baseLocationName);
          if (!slugMap) {
            slugMap = new Map();
            aggregator.set(baseLocationName, slugMap);
          }
          const slug = normalizeSpeciesSlug(record?.slug || record?.name) || baseLocationName;
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
      const displayName = getGen1DisplayName(slug);
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
  }, [caughtSet, lazarusRecords, legacyEncounters, legacyMapReady, showingYellow]);

  const handleClearSave = useCallback(() => {
    setGameKey("yellow");
    setFileName(null);
    setCaughtPokemon([]);
    setPartyMembers([]);
    setError(null);
    resetResultFilters();
    setLoading(false);
  }, [resetResultFilters]);

  const handlePreviewPokedex = useCallback(
    (gameType) => {
      setGameKey(gameType);
      resetResultFilters();
    },
    [resetResultFilters]
  );

  const toggleDexEntry = useCallback((entryKey) => {
    setOpenDexEntryKey((current) => (current === entryKey ? null : entryKey));
  }, []);

  return (
    <div className="app-shell sav-page">
      <header className="app-header">
        <div className="container">
          <h1 className="title logo">
            <span className="logo-accent">Pokedex</span>
            <div className="logo-dot" />
            <span className="logo-db">DB</span>
          </h1>
          <div className="sav-page__subtitle-wrapper">
            <p className="subtitle sav-page__subtitle">
              Import a <strong>Pokemon Yellow Legacy</strong>{" "}
              <span className="sav-page__subtitle-emphasis">.sav / .srm</span> file to view your save data entirely in the
              browser, or preview the <strong>Pokemon Lazarus</strong> Pokedex.
            </p>
            <CategoryToggle />
          </div>
        </div>
      </header>
      <main className="container sav-page__content">
        <section className="sav-page__grid">
          {!hasSaveData && (
            <>
              <article className="sav-card sav-card--primary">
                <div className="sav-card__header sav-card__header--with-actions">
                  <div className="sav-card__header-body">
                    <h2 className="sav-card__title">Pokemon Yellow Legacy</h2>
                  </div>
                  <button
                    type="button"
                    className="sav-card__preview-button"
                    onClick={() => handlePreviewPokedex("yellow")}
                  >
                    Preview Pokedex
                  </button>
                  <p className="sav-card__description">
                    Choose your save file to view your caught Pokemon and party.
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
                  {loading && (
                    <p className="sav-status" role="status">
                      Processing save file...
                    </p>
                  )}
                  {error && (
                    <div className="sav-alert sav-alert--error" role="alert">
                      {error}
                    </div>
                  )}
                </div>
              </article>
              <article className="sav-card sav-card--primary">
                <div className="sav-card__header sav-card__header--with-actions">
                  <div className="sav-card__header-body">
                    <h2 className="sav-card__title">Pokemon Lazarus</h2>
                  </div>
                  <button
                    type="button"
                    className="sav-card__preview-button"
                    onClick={() => handlePreviewPokedex("lazarus")}
                  >
                    Preview Pokedex
                  </button>
                  <p className="sav-card__description">
                    Preview the complete Pokedex for Pokemon Lazarus.
                  </p>
                </div>
              </article>
              <article className="sav-card sav-card--info-panel-card">
                <div className="sav-card__body sav-card__info-panel-body">
                  <h3 className="sav-card__info-heading">Save Reader Notes</h3>
                  <p>
                    This reader currently supports <strong>Pokemon Yellow Legacy</strong> saves (English Red, Blue and
                    Yellow saves use the same format, but locations and evolutions shown are Yellow Legacy&apos;s).{" "}
                    <strong>Pokemon Lazarus</strong> saves can&apos;t be read yet, but you can preview its Pokedex.
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
                <p className="sav-meta">
                  <strong>Loaded:</strong> {fileName}
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
                      (slot.slug ? getGen1DisplayName(slot.slug) : `Species #${slot.speciesInternalId}`);
                    const hpPercent =
                      slot.maxHp && slot.maxHp > 0
                        ? Math.max(0, Math.min(100, (slot.currentHp / slot.maxHp) * 100))
                        : 0;
                    const primaryType = slot.types[0] || "Unknown";
                    const secondaryType = slot.types[1] || "";
                    const hasSecondaryType = Boolean(secondaryType);
                    const pokedexNumber =
                      slot.dexId != null ? `No. ${String(slot.dexId).padStart(3, "0")}` : "No. ---";
                    // Only Gen 1 saves can be loaded, so party slots always use Yellow sprites.
                    const pokedexUrl = slot.dexId != null ? buildPokemonPath(slot.slug) : null;
                    const spriteIdentifier = slot.dexId ?? 0;
                    return (
                      <div key={`party-slot-${index}`} className="sav-party-slot has-pokemon">
                        <div className="sav-party-slot__content">
                          <div className="sav-party-slot__sprite-area">
                            <div className="sav-party-slot__sprite-panel">
                              <div className="sav-party-slot__sprite-wrapper">
                                <SpriteImage
                                  id={spriteIdentifier}
                                  alt={displayName}
                                  gameSpritePath="generation-i/yellow/transparent/"
                                  style={PARTY_SPRITE_STYLE}
                                />
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
                              {/* Gen 1 (including Yellow Legacy) has a single Special stat. */}
                              {[
                                ["ATTACK", slot.stats?.attack],
                                ["DEFENSE", slot.stats?.defense],
                                ["SPEED", slot.stats?.speed],
                                ["SPECIAL", slot.stats?.special],
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
              {!showingYellow && lazarusDexError && (
                <div className="sav-alert sav-alert--error">{lazarusDexError}</div>
              )}
              <div className="sav-results-list">
                {!showingYellow && !lazarusReferenceReady ? (
                  <div className="sav-location-empty" role="status">
                    Loading Pokémon Lazarus data...
                  </div>
                ) : filteredResults.length > 0 ? (
                  <>
                    {filteredResults.map((entry) => {
                    const pokemonName = entry.displayName;
                    const pokemonSlug = entry.slug || normalizeSpeciesSlug(entry.name);
                    const referenceRecord = showingYellow
                      ? yellowReferenceReady
                        ? yellowReference.get(pokemonSlug)
                        : null
                      : entry.record;
                    const isDexOpen = openDexEntryKey === entry.entryKey;
                    const dexPanelId = `sav-dex-panel-${entry.entryKey}`;
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
                      isDexOpen ? "is-dex-open" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    const pokedexUrl = pokemonSlug ? buildPokemonPath(pokemonSlug) : null;
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
                        ].filter(([, value]) => value != null)
                      : [];
                    const lazarusTypes = referenceRecord?.types || [];
                    const lazarusAbilities = referenceRecord?.abilities || [];

                  return (
                    <div
                      key={entry.entryKey || entry.id}
                      className={cardClassNames}
                      data-dex-entry-key={entry.entryKey}
                    >
                      <div className="sav-result-row__pokemon">
                        <button
                          type="button"
                          className="sav-result-row__sprite sav-result-row__dex-toggle"
                          aria-expanded={isDexOpen}
                          aria-controls={dexPanelId}
                          aria-label={`${isDexOpen ? "Hide" : "Show"} ${dexPanelLabel} for ${pokemonName}`}
                          title={`${dexPanelLabel}: ${pokemonName}`}
                          onClick={() => toggleDexEntry(entry.entryKey)}
                        >
                          <SpriteImage id={spriteIdentifier} alt="" {...resultSpriteProps} />
                        </button>
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
                                  if (locationEntry.levelSummary && showingYellow) {
                                    detailParts.push(locationEntry.levelSummary);
                                  }
                                  if (locationEntry.chanceSummary && showingYellow) {
                                    detailParts.push(locationEntry.chanceSummary);
                                  }
                                  if (locationEntry.notes && showingYellow) {
                                    detailParts.push(locationEntry.notes);
                                  }

                                  const hasSpecialLabel =
                                    locationEntry.methodLabel &&
                                    locationEntry.methodLabel !== DEFAULT_METHOD_LABEL;
                                  const shouldShowMethodBadge = showingYellow
                                    ? hasSpecialLabel
                                    : Boolean(locationEntry.methodLabel);
                                  const shouldShowBadgeRow =
                                    !showingYellow &&
                                    (shouldShowMethodBadge ||
                                      locationEntry.levelSummary ||
                                      locationEntry.notes ||
                                      locationEntry.chanceSummary);

                                  const sharedPokemon =
                                    locationPokemonLookup.get(locationEntry.location) || [];
                                  const sharedOthers = sharedPokemon.filter(
                                    (item) => item.slug !== pokemonSlug
                                  );
                                  const caughtEntries = sharedOthers.filter((item) => item.caught);
                                  const missingEntries = sharedOthers.filter((item) => !item.caught);

                                  return (
                                    <li key={`${locationEntry.location}-${index}`} className={rowClassNames}>
                                      <div className="sav-location-row__name">{locationEntry.location}</div>
                                      {shouldShowBadgeRow && (
                                        <div className="sav-location-row__badges">
                                          {shouldShowMethodBadge && (
                                            <span className="sav-location-row__badge sav-location-row__badge--method">
                                              {locationEntry.methodLabel}
                                            </span>
                                          )}
                                          {locationEntry.levelSummary && (
                                            <span className="sav-location-row__badge sav-location-row__badge--level">
                                              {locationEntry.levelSummary}
                                            </span>
                                          )}
                                          {locationEntry.notes && (
                                            <span className="sav-location-row__badge sav-location-row__badge--note">
                                              {locationEntry.notes}
                                            </span>
                                          )}
                                          {locationEntry.chanceSummary && (
                                            <span className="sav-location-row__badge sav-location-row__badge--chance">
                                              {locationEntry.chanceSummary}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {showingYellow && hasSpecialLabel && (
                                        <div className="sav-location-row__method-line">
                                          <span className="sav-location-row__method">{locationEntry.methodLabel}</span>
                                        </div>
                                      )}
                                      {showingYellow && detailParts.length > 0 && (
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
                        <div
                          id={dexPanelId}
                          className="sav-result-row__yellow-hover-panel"
                          role="region"
                          aria-label={`${dexPanelLabel}: ${pokemonName}`}
                          aria-hidden={!isDexOpen}
                        >
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
                              {entry.evolutionRequirement.from && (
                                <>
                                  <span className="sav-evolution__stage">
                                    {entry.evolutionRequirement.from}
                                  </span>
                                  <span className="sav-evolution__arrow-icon" aria-hidden="true">
                                    →
                                  </span>
                                </>
                              )}
                              <span className="sav-evolution__method">
                                {entry.evolutionRequirement.method}
                              </span>
                              <span className="sav-evolution__arrow-icon" aria-hidden="true">
                                →
                              </span>
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
