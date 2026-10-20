import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import "./styles/pages/save.css";
import SpriteImage from "./components/SpriteImage.jsx";
import Icon, { Cursor } from "./components/Icon.jsx";
import Sheet from "./components/Sheet.jsx";
import { DexDialog, TypeTag } from "./pokedex/EntryParts.jsx";
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
// "Save data structure (Generation I)" and pret/pokeyellow ram/sram.asm + ram/wram.asm.
// - The file is 32 KiB (0x8000): four 8 KiB banks. Bank 0 is scratch + Hall of Fame,
//   bank 1 (0x2000) is the main data, banks 2-3 hold PC boxes. There is no backup copy.
// - 0x2598: player name (11 bytes, 0x50-terminated).
// - 0x25A3: Pokedex owned flags, 19 bytes, bit (n - 1) for dex number n, LSB first.
// - 0x25C9: bag (count, item/quantity pairs, 0xFF). Money, rival name, badges, player ID and
//   the current box number follow it, so they sit later when the bag is bigger (see below).
// - 0x29C3: the player's starter (internal species ID; Pikachu in Yellow).
// - 0x2CED: play time: hours, a "maxed out" flag, minutes, seconds, frames.
// - 0x2F2C: party list (count, 6 species + 0xFF, 6 x 44-byte mons, OT names, nicknames).
// - 0x30C0: the current PC box (same list layout with 20 x 33-byte mons). The game copies it
//   back to bank 2/3 only when you change boxes, so that copy of the current box is stale.
// - 0x3523: checksum = bitwise NOT of the 8-bit sum of bytes 0x2598..0x3522.
// - 0x4000 / 0x6000: boxes 1-6 / 7-12, 0x462 bytes each. They are only initialised the first
//   time the player changes boxes (bit 7 of the current box number); until then they are junk.
const GEN1_SAVE_SIZE = 0x8000;
const GEN1_CHECKSUM_START = 0x2598;
const GEN1_CHECKSUM_END = 0x3522; // inclusive
const GEN1_CHECKSUM_OFFSET = 0x3523;
const GEN1_PLAYER_NAME_OFFSET = 0x2598;
const GEN1_POKEDEX_OWNED_OFFSET = 0x25A3;
const GEN1_BAG_OFFSET = 0x25C9;
const GEN1_PLAYER_STARTER_OFFSET = 0x29C3;
const GEN1_PLAY_TIME_OFFSET = 0x2CED;
const GEN1_POKEMON_COUNT = 151;
const PARTY_DATA_OFFSET = 0x2F2C;
const PARTY_MAX_SIZE = 6;
const PARTY_MON_SIZE = 0x2C;
const GEN1_NAME_LENGTH = 11;
const CURRENT_BOX_DATA_OFFSET = 0x30C0;
const BOX_BANK_OFFSETS = [0x4000, 0x6000];
const BOX_COUNT = 12;
const BOXES_PER_BANK = 6;
const BOX_MAX_SIZE = 20;
const BOX_MON_SIZE = 0x21;
const BOX_DATA_SIZE = 0x462;
// The current box number byte: bits 0-6 are the box index; bit 7 is set once the player has
// changed boxes, so banks 2-3 hold real boxes.
const BOX_NUMBER_MASK = 0x7f;
const BOXES_INITIALISED_FLAG = 0x80;
// Pokemon Yellow Legacy grows the bag from 20 to 59 items (78 bytes) and drops 78 unused bytes
// at the end of the game progress flags, so everything between the two sits 0x4E bytes later;
// the Pokedex flags, play time, party and boxes stay put. (Legacy constants/menu_constants.asm,
// ram/wram.asm.) The two layouts are told apart in detectGen1Layout.
const GEN1_LAYOUTS = [
  {
    key: "legacy",
    bagCapacity: 59,
    money: 0x2641,
    rivalName: 0x2644,
    badges: 0x2650,
    playerId: 0x2653,
    currentBox: 0x289A,
  },
  {
    key: "vanilla",
    bagCapacity: 20,
    money: 0x25F3,
    rivalName: 0x25F6,
    badges: 0x2602,
    playerId: 0x2605,
    currentBox: 0x284C,
  },
];
// wObtainedBadges, bit 0 first (pret constants/ram_constants.asm).
const GEN1_BADGES = ["Boulder", "Cascade", "Thunder", "Rainbow", "Soul", "Marsh", "Volcano", "Earth"];
// wPlayerStarter, internal species IDs: Pikachu in Yellow; Bulbasaur, Charmander, Squirtle in Red/Blue.
const YELLOW_STARTER_ID = 0x54;
const RED_BLUE_STARTER_IDS = new Set([0x99, 0xb0, 0xb1]);
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
// Only Gen 1 saves can be loaded, so party slots (and the Yellow Pokédex) use Yellow sprites.
const YELLOW_SPRITE_PATH = "generation-i/yellow/transparent/";
const NO_OP = () => {};

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

// Party and box lists share one layout (Bulbapedia "Pokémon lists"; pret macros/ram.asm):
// count, capacity + 1 species IDs (0xFF-terminated), capacity mons, capacity 11-byte OT names,
// capacity 11-byte nicknames. Party mons are 44 bytes; box mons are the first 33 of those
// (no level copy, max HP or stats). Multi-byte values are big-endian.
// Returns null when the list isn't well formed (a strict list must also be 0xFF-terminated).
function parseMonList(data, offset, capacity, monSize, { strict = false } = {}) {
  const count = data[offset];
  if (!Number.isInteger(count) || count > capacity) {
    return null;
  }
  if (strict && data[offset + 1 + count] !== 0xff) {
    return null;
  }

  const entries = [];
  const monsOffset = offset + capacity + 2;
  const otNamesOffset = monsOffset + capacity * monSize;
  const nicknameOffset = otNamesOffset + capacity * GEN1_NAME_LENGTH;
  const isParty = monSize === PARTY_MON_SIZE;

  for (let i = 0; i < count; i++) {
    const speciesInternalId = data[offset + 1 + i];
    if (!speciesInternalId || speciesInternalId === 0xff) {
      continue;
    }

    const pokemonDataOffset = monsOffset + i * monSize;
    const slug = SPECIES_INDEX_TO_SLUG.get(speciesInternalId) || null;
    const dexId = slug ? GEN1_SLUG_TO_POKEDEX_ID.get(slug) || null : null;
    const status = data[pokemonDataOffset + 0x04] || 0;
    const type1 = resolveTypeName(data[pokemonDataOffset + 0x05]);
    const type2 = resolveTypeName(data[pokemonDataOffset + 0x06]);
    const trainerId = readUint16(data, pokemonDataOffset + 0x0C);
    const otStart = otNamesOffset + i * GEN1_NAME_LENGTH;
    const nicknameStart = nicknameOffset + i * GEN1_NAME_LENGTH;
    const boxLevel = data[pokemonDataOffset + 0x03] || null;

    entries.push({
      slot: i + 1,
      speciesInternalId,
      slug,
      dexId,
      currentHp: readUint16(data, pokemonDataOffset + 0x01),
      maxHp: isParty ? readUint16(data, pokemonDataOffset + 0x22) : null,
      level: isParty ? data[pokemonDataOffset + 0x21] || boxLevel : boxLevel,
      status,
      statusText: interpretStatus(status),
      types: type1 === type2 ? [type1] : [type1, type2],
      stats: isParty
        ? {
            attack: readUint16(data, pokemonDataOffset + 0x24),
            defense: readUint16(data, pokemonDataOffset + 0x26),
            speed: readUint16(data, pokemonDataOffset + 0x28),
            special: readUint16(data, pokemonDataOffset + 0x2A),
          }
        : null,
      originalTrainerId: trainerId,
      originalTrainerIdFormatted: String(trainerId).padStart(5, "0"),
      originalTrainerName: decodeGen1String(data.subarray(otStart, otStart + GEN1_NAME_LENGTH)),
      nickname: decodeGen1String(data.subarray(nicknameStart, nicknameStart + GEN1_NAME_LENGTH)),
    });
  }
  return entries;
}

// A player-typed name: 1-10 known characters, then the 0x50 terminator.
function isGen1Name(data, offset) {
  for (let i = 0; i < GEN1_NAME_LENGTH; i++) {
    const value = data[offset + i];
    if (value === 0x50) return i > 0;
    if (!GEN1_CHAR_MAP.has(value)) return false;
  }
  return false;
}

function isBcd(data, offset, length) {
  for (let i = 0; i < length; i++) {
    const value = data[offset + i];
    if ((value >> 4) > 9 || (value & 0x0f) > 9) return false;
  }
  return true;
}

function readBcd(data, offset, length) {
  let result = 0;
  for (let i = 0; i < length; i++) {
    const value = data[offset + i];
    result = result * 100 + (value >> 4) * 10 + (value & 0x0f);
  }
  return result;
}

// Yellow Legacy's bag can hold more than 20 items, which settles it. Otherwise both layouts
// fit the bag, so each is scored by whether the player's own Pokemon (OT name = player name)
// carry the player ID found there, and whether its money, rival name and box number are valid.
function detectGen1Layout(data, ownMons) {
  const bagCount = data[GEN1_BAG_OFFSET];
  const bagTerminated = data[GEN1_BAG_OFFSET + 1 + bagCount * 2] === 0xff;
  let best = null;
  let bestScore = -1;
  for (const layout of GEN1_LAYOUTS) {
    if (bagCount > layout.bagCapacity || !bagTerminated) continue;
    const playerId = readUint16(data, layout.playerId);
    let score = ownMons.filter((mon) => mon.originalTrainerId === playerId).length * 4;
    if (isBcd(data, layout.money, 3)) score += 1;
    if (isGen1Name(data, layout.rivalName)) score += 1;
    if ((data[layout.currentBox] & BOX_NUMBER_MASK) < BOX_COUNT) score += 1;
    // Ties go to the first layout listed (Yellow Legacy, the game this reader is for).
    if (score > bestScore) {
      best = layout;
      bestScore = score;
    }
  }
  return best || GEN1_LAYOUTS[GEN1_LAYOUTS.length - 1];
}

function describeGen1Game(data, layout) {
  if (layout.key === "legacy") return "Pokémon Yellow Legacy";
  const starter = data[GEN1_PLAYER_STARTER_OFFSET];
  if (starter === YELLOW_STARTER_ID) return "Pokémon Yellow";
  if (RED_BLUE_STARTER_IDS.has(starter)) return "Pokémon Red or Blue";
  return "Pokémon Red, Blue or Yellow";
}

// The current box is read from the main bank; the others from banks 2-3, once they exist.
function parseBoxes(data, layout) {
  const boxByte = data[layout.currentBox];
  const boxIndex = boxByte & BOX_NUMBER_MASK;
  const currentIndex = boxIndex < BOX_COUNT ? boxIndex : 0;
  const initialised = Boolean(boxByte & BOXES_INITIALISED_FLAG);
  const boxes = Array.from({ length: BOX_COUNT }, (_, index) => {
    if (index !== currentIndex && !initialised) {
      return { number: index + 1, members: [], readable: true };
    }
    const offset =
      index === currentIndex
        ? CURRENT_BOX_DATA_OFFSET
        : BOX_BANK_OFFSETS[Math.floor(index / BOXES_PER_BANK)] + (index % BOXES_PER_BANK) * BOX_DATA_SIZE;
    const members = parseMonList(data, offset, BOX_MAX_SIZE, BOX_MON_SIZE, { strict: true });
    return { number: index + 1, members: members || [], readable: members !== null };
  });
  return { boxes, currentBox: currentIndex + 1 };
}

function parseTrainer(data, layout) {
  const playerId = readUint16(data, layout.playerId);
  const badgeFlags = data[layout.badges];
  const maxed = data[GEN1_PLAY_TIME_OFFSET + 1] !== 0;
  return {
    name: decodeGen1String(data.subarray(GEN1_PLAYER_NAME_OFFSET, GEN1_PLAYER_NAME_OFFSET + GEN1_NAME_LENGTH)),
    rivalName: decodeGen1String(data.subarray(layout.rivalName, layout.rivalName + GEN1_NAME_LENGTH)),
    id: playerId,
    idFormatted: String(playerId).padStart(5, "0"),
    money: isBcd(data, layout.money, 3) ? readBcd(data, layout.money, 3) : null,
    badges: GEN1_BADGES.map((name, bit) => ({ name, earned: Boolean((badgeFlags >> bit) & 1) })),
    // The clock stops at 255:59 and sets the "maxed" flag.
    playTime: {
      hours: maxed ? 255 : data[GEN1_PLAY_TIME_OFFSET],
      minutes: maxed ? 59 : Math.min(59, data[GEN1_PLAY_TIME_OFFSET + 2]),
      maxed,
    },
    game: describeGen1Game(data, layout),
  };
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
 * @returns {{caughtPokemon: Array<number>, partyMembers: Array<object>, trainer: object,
 *   boxes: Array<{number: number, members: Array<object>, readable: boolean}>, currentBox: number}}
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

  const partyMembers = parseMonList(data, PARTY_DATA_OFFSET, PARTY_MAX_SIZE, PARTY_MON_SIZE) || [];
  // The party and the current box don't move between layouts, so they can pick the layout.
  const playerName = decodeGen1String(
    data.subarray(GEN1_PLAYER_NAME_OFFSET, GEN1_PLAYER_NAME_OFFSET + GEN1_NAME_LENGTH)
  );
  const currentBoxMembers =
    parseMonList(data, CURRENT_BOX_DATA_OFFSET, BOX_MAX_SIZE, BOX_MON_SIZE, { strict: true }) || [];
  const ownMons = [...partyMembers, ...currentBoxMembers].filter(
    (mon) => playerName && mon.originalTrainerName === playerName
  );
  const layout = detectGen1Layout(data, ownMons);

  return {
    caughtPokemon,
    partyMembers,
    trainer: parseTrainer(data, layout),
    ...parseBoxes(data, layout),
  };
}

/* ------------------------------------------------------------------ View helpers */

const formatDexNo = (id) => (id != null ? `No.${String(id).padStart(3, "0")}` : "No.---");

// Gen 1 HP bar tiers: full above half, warning above a fifth, danger below.
const hpTier = (percent) => (percent > 50 ? "" : percent > 20 ? " meter--mid" : " meter--low");

// Base stat tiers, matching the Pokédex stat meters.
const statTier = (value) => (value >= 100 ? "" : value >= 60 ? " meter--mid" : " meter--low");

// The badges shown with a location. Yellow Legacy shows a method only when it isn't plain grass,
// then level, odds and notes; Lazarus shows method, level, notes and odds.
function describeLocationParts(locationEntry, showingYellow) {
  const parts = [];
  if (showingYellow) {
    if (locationEntry.methodLabel && locationEntry.methodLabel !== DEFAULT_METHOD_LABEL) {
      parts.push({ kind: "method", text: locationEntry.methodLabel });
    }
    if (locationEntry.levelSummary) parts.push({ kind: "level", text: locationEntry.levelSummary });
    if (locationEntry.chanceSummary) parts.push({ kind: "chance", text: locationEntry.chanceSummary });
    if (locationEntry.notes) parts.push({ kind: "note", text: locationEntry.notes });
  } else {
    if (locationEntry.methodLabel) parts.push({ kind: "method", text: locationEntry.methodLabel });
    if (locationEntry.levelSummary) parts.push({ kind: "level", text: locationEntry.levelSummary });
    if (locationEntry.notes) parts.push({ kind: "note", text: locationEntry.notes });
    if (locationEntry.chanceSummary) parts.push({ kind: "chance", text: locationEntry.chanceSummary });
  }
  return parts;
}

function LocationParts({ parts }) {
  return parts.map((part, index) =>
    part.kind === "note" ? (
      <span key={index} className="sv-loc__note">
        {part.text}
      </span>
    ) : (
      <span key={index} className={`stamp sv-loc__badge sv-loc__badge--${part.kind}`}>
        {part.text}
      </span>
    )
  );
}

// Name, links, reference record and sprite settings for one Pokédex entry (row and detail).
function buildEntryView(entry, { showingYellow, yellowReference, yellowReferenceReady }) {
  const pokemonName = entry.displayName;
  const pokemonSlug = entry.slug || normalizeSpeciesSlug(entry.name);
  const referenceRecord = showingYellow
    ? yellowReferenceReady
      ? yellowReference.get(pokemonSlug)
      : null
    : entry.record;
  const pokedexUrl = pokemonSlug ? buildPokemonPath(pokemonSlug) : null;
  const spriteNationalId = showingYellow ? entry.id : entry.nationalId ?? null;
  const entrySlugForSprite = entry.slug || pokemonSlug;
  const spriteOverride =
    !showingYellow && entrySlugForSprite ? LAZARUS_SPRITE_OVERRIDES.get(entrySlugForSprite) : null;
  // For non-override sprites, use National Dex ID (numeric) for proper sprite lookup
  const defaultResultIdentifier = showingYellow ? entry.id : spriteNationalId ?? entry.id;
  const spriteIdentifier = showingYellow ? entry.id : spriteOverride ?? defaultResultIdentifier;
  const spriteProps = showingYellow
    ? { gameSpritePath: YELLOW_SPRITE_PATH }
    : {
        // Use entry.id for form-specific sprites, fallback to nationalId for base forms
        speciesId: spriteNationalId ?? undefined,
        formName: pokemonSlug || entry.name,
      };
  return { pokemonName, pokemonSlug, referenceRecord, pokedexUrl, spriteIdentifier, spriteProps };
}

// A Game Boy cartridge, drawn on the same 12×12 pixel grid as Icon.jsx.
const CART_PIXELS = [
  ".########...",
  ".#......##..",
  ".#.......##.",
  ".#.######.#.",
  ".#.#....#.#.",
  ".#.#....#.#.",
  ".#.#....#.#.",
  ".#.######.#.",
  ".#........#.",
  ".#.#.#.#..#.",
  ".##########.",
  "............",
];
// Each row of "#" runs becomes one rect, as in Icon.jsx.
function toPixelRects(pixels) {
  return pixels.flatMap((row, y) => {
    const rects = [];
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "#") {
        x += 1;
        continue;
      }
      let run = 1;
      while (row[x + run] === "#") run += 1;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} />);
      x += run;
    }
    return rects;
  });
}

function PixelGlyph({ rects, className = "" }) {
  return (
    <svg className={`icon ${className}`.trim()} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      {rects}
    </svg>
  );
}

const CART_RECTS = toPixelRects(CART_PIXELS);

function CartIcon({ className = "" }) {
  return <PixelGlyph rects={CART_RECTS} className={className} />;
}

// The eight Kanto badges on the 12×12 grid, after their in-game shapes, in GEN1_BADGES order.
const BADGE_PIXELS = {
  Boulder: [
    "............",
    "...######...",
    "..#......#..",
    ".#..####..#.",
    ".#.#....#.#.",
    ".#.#....#.#.",
    ".#.#....#.#.",
    ".#.#....#.#.",
    ".#..####..#.",
    "..#......#..",
    "...######...",
    "............",
  ],
  Cascade: [
    ".....##.....",
    ".....##.....",
    "....####....",
    "....####....",
    "...######...",
    "..##.#####..",
    "..#.######..",
    ".##.#######.",
    ".##.#######.",
    ".###.######.",
    "..########..",
    "...######...",
  ],
  Thunder: [
    ".....##.....",
    ".#...##...#.",
    "..#.####.#..",
    "...######...",
    "..###..###..",
    "#####..#####",
    "#####..#####",
    "..###..###..",
    "...######...",
    "..#.####.#..",
    ".#...##...#.",
    ".....##.....",
  ],
  Rainbow: [
    "....####....",
    "...######...",
    "...######...",
    ".##.####.##.",
    "####....####",
    "####.##.####",
    "####.##.####",
    "####....####",
    ".##.####.##.",
    "...######...",
    "...######...",
    "....####....",
  ],
  Soul: [
    "............",
    ".###....###.",
    "#####..#####",
    "##.#########",
    "#.##########",
    "############",
    ".##########.",
    "..########..",
    "...######...",
    "....####....",
    ".....##.....",
    "............",
  ],
  Marsh: [
    "....####....",
    "..##....##..",
    ".#........#.",
    ".#..####..#.",
    "#..#....#..#",
    "#..#.##.#..#",
    "#..#.##.#..#",
    "#..#....#..#",
    ".#..####..#.",
    ".#........#.",
    "..##....##..",
    "....####....",
  ],
  Volcano: [
    ".....#......",
    "....##......",
    "....###.....",
    "...####..#..",
    "...#####.##.",
    "..#########.",
    ".##########.",
    ".####..####.",
    ".###....###.",
    ".###....###.",
    "..###..###..",
    "...######...",
  ],
  Earth: [
    "..........##",
    "........####",
    "......######",
    ".....####.##",
    "....####.###",
    "...####.###.",
    "...###.###..",
    "..###.###...",
    "..#.####....",
    ".##.........",
    "##..........",
    "#...........",
  ],
};
const BADGE_RECTS = new Map(Object.entries(BADGE_PIXELS).map(([name, pixels]) => [name, toPixelRects(pixels)]));

const formatPlayTime = ({ hours, minutes }) => `${hours}:${String(minutes).padStart(2, "0")}`;

// One Pokémon's save data, as a party row or in the box slot sheet. Box Pokémon store no max HP
// or stats (the game works them out again on withdrawal), so those parts give way to a note.
function MonSummary({ mon, as = "li", className = "" }) {
  const Tag = as;
  const speciesName = mon.slug ? getGen1DisplayName(mon.slug) : null;
  const displayName = mon.nickname || speciesName || `Species #${mon.speciesInternalId}`;
  const showSpecies = Boolean(speciesName) && speciesName.toLowerCase() !== displayName.toLowerCase();
  const hasMaxHp = mon.maxHp != null && mon.maxHp > 0;
  const hpPercent = hasMaxHp ? Math.max(0, Math.min(100, (mon.currentHp / mon.maxHp) * 100)) : 0;
  const pokedexUrl = mon.dexId != null ? buildPokemonPath(mon.slug) : null;
  const statusText = mon.statusText || "OK";
  return (
    <Tag className={`sv-mon ${className}`.trim()}>
      <span className="sv-mon__sprite">
        <SpriteImage
          id={mon.dexId ?? 0}
          alt=""
          className="sv-mon__img"
          width={96}
          height={96}
          gameSpritePath={YELLOW_SPRITE_PATH}
        />
      </span>
      <div className="sv-mon__id">
        <p className="sv-mon__no">{formatDexNo(mon.dexId)}</p>
        <h3 className="sv-mon__name">
          {pokedexUrl ? (
            <a href={pokedexUrl} target="_blank" rel="noopener noreferrer">
              {displayName}
              <Icon name="external" className="sv-ext-icon" />
              <span className="sr-only"> (opens the Pokédex in a new tab)</span>
            </a>
          ) : (
            displayName
          )}
        </h3>
        {showSpecies ? <p className="sv-mon__species">{speciesName}</p> : null}
        <p className="sv-types sv-mon__types">
          {mon.types.map((type) => (
            <TypeTag key={type} typeName={String(type).toLowerCase()} icon={false} />
          ))}
        </p>
      </div>
      <div className="sv-mon__vitals">
        <p className="sv-mon__lv">
          <span className="sv-mon__lv-label">Lv</span>
          {mon.level != null ? mon.level : "??"}
        </p>
        {hasMaxHp ? (
          <div className={`sv-hp${hpTier(hpPercent)}`} style={{ "--pct": hpPercent }}>
            <span className="sv-hp__label">HP</span>
            <span className="meter__track sv-hp__track" aria-hidden="true">
              <span className="meter__fill" />
            </span>
            <span className="sv-hp__value">
              {(mon.currentHp ?? 0).toString()}
              <span aria-hidden="true">/</span>
              <span className="sr-only"> of </span>
              {mon.maxHp.toString()}
            </span>
          </div>
        ) : (
          <p className="sv-hp sv-hp--plain">
            <span className="sv-hp__label">HP</span>
            <span className="sv-hp__value">{(mon.currentHp ?? 0).toString()}</span>
          </p>
        )}
        <p className="sv-mon__status">
          <span className="sv-mini-label">Status</span>
          <span className={`stamp${statusText !== "OK" ? " stamp--gold" : ""}`}>{statusText}</span>
        </p>
      </div>
      {/* Gen 1 (including Yellow Legacy) has a single Special stat. */}
      {mon.stats ? (
        <dl className="sv-mon__stats">
          {[
            ["Attack", mon.stats.attack],
            ["Defense", mon.stats.defense],
            ["Speed", mon.stats.speed],
            ["Special", mon.stats.special],
          ].map(([label, value]) => (
            <div key={label} className="sv-mon__stat">
              <dt>{label}</dt>
              <dd>{value != null ? value : "--"}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="sv-mon__note">
          Boxed Pokémon don&apos;t keep their stats in the save. The game works them out again when you withdraw
          one.
        </p>
      )}
      <dl className="sv-mon__ot">
        <div>
          <dt>OT</dt>
          <dd>{mon.originalTrainerName || "Unknown"}</dd>
        </div>
        <div>
          <dt>IDNo</dt>
          <dd className="sv-num">{mon.originalTrainerIdFormatted}</dd>
        </div>
      </dl>
    </Tag>
  );
}

const monDisplayName = (mon) =>
  mon.nickname || (mon.slug ? getGen1DisplayName(mon.slug) : `Species #${mon.speciesInternalId}`);

export default function SavPage() {
  const [gameKey, setGameKey] = useState("yellow");
  const [caughtPokemon, setCaughtPokemon] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Only set once a save has been parsed successfully.
  const [fileName, setFileName] = useState(null);
  const [partyMembers, setPartyMembers] = useState([]);
  const [trainer, setTrainer] = useState(null);
  const [boxes, setBoxes] = useState(EMPTY_LIST);
  // The box selected in-game, and the box being viewed here (1-based).
  const [currentBox, setCurrentBox] = useState(1);
  const [viewedBox, setViewedBox] = useState(1);
  // The box slot whose Pokémon is open in the Sheet: { box, slot }, both 1-based.
  const [openBoxSlot, setOpenBoxSlot] = useState(null);
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

  // The open Pokédex entry shows in a Sheet (popover on desktop, bottom sheet on phones), which
  // closes on Escape or a click/tap outside it and returns focus to the entry's sprite button.
  const dexAnchorRef = useRef(null);
  // A box slot opens its Pokémon in a Sheet the same way, anchored to the slot.
  const monAnchorRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const resetResultFilters = useCallback(() => {
    setLocationFilter("");
    setSearchTerm("");
    setShowCaught(true);
    setOpenDexEntryKey(null);
    setOpenBoxSlot(null);
  }, []);

  const readSaveFile = useCallback(
    async (file) => {
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
        const save = parseSavFile(await file.arrayBuffer());
        setGameKey("yellow");
        resetResultFilters();
        setCaughtPokemon(save.caughtPokemon);
        setPartyMembers(save.partyMembers);
        setTrainer(save.trainer);
        setBoxes(save.boxes);
        setCurrentBox(save.currentBox);
        setViewedBox(save.currentBox);
        setFileName(file.name);
      } catch (err) {
        setError(`Couldn't read "${file.name}": ${err?.message || "unknown error"}`);
      } finally {
        setLoading(false);
      }
    },
    [resetResultFilters]
  );

  const handleYellowFileChange = useCallback(
    (event) => {
      const input = event.target;
      const file = input.files?.[0];
      // Reset the input so choosing the same file again (e.g. after an error) fires onChange.
      input.value = "";
      readSaveFile(file);
    },
    [readSaveFile]
  );

  // The drop zone takes a save file dragged in from the desktop.
  const handleDragOver = useCallback(
    (event) => {
      if (loading || !Array.from(event.dataTransfer?.types || []).includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDragging(true);
    },
    [loading]
  );
  const handleDragLeave = useCallback((event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setDragging(false);
  }, []);
  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragging(false);
      if (loading) return;
      readSaveFile(event.dataTransfer?.files?.[0]);
    },
    [loading, readSaveFile]
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
    setTrainer(null);
    setBoxes(EMPTY_LIST);
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

  const openDexEntry = useCallback(
    (event, entryKey) => {
      const trigger = event.currentTarget;
      dexAnchorRef.current = trigger;
      // On wide screens the entry opens as a popover under its row: bring a low row up so the
      // popover has room below it. Phones get a bottom sheet instead.
      if (!window.matchMedia?.("(max-width: 900px)").matches) {
        const rect = trigger.getBoundingClientRect();
        if (rect.bottom > window.innerHeight - 420) {
          trigger.closest("[data-dex-entry-key]")?.scrollIntoView({ block: "start" });
        }
      }
      toggleDexEntry(entryKey);
    },
    [toggleDexEntry]
  );
  const closeDexEntry = useCallback(() => setOpenDexEntryKey(null), []);

  const openBoxMon = useCallback((event, box, slot) => {
    const trigger = event.currentTarget;
    monAnchorRef.current = trigger;
    if (!window.matchMedia?.("(max-width: 900px)").matches) {
      const rect = trigger.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 420) {
        trigger.scrollIntoView({ block: "start" });
      }
    }
    setOpenBoxSlot({ box, slot });
  }, []);
  const closeBoxMon = useCallback(() => setOpenBoxSlot(null), []);
  const stepBox = useCallback((delta) => {
    setViewedBox((current) => ((current - 1 + delta + BOX_COUNT) % BOX_COUNT) + 1);
  }, []);

  const viewContext = { showingYellow, yellowReference, yellowReferenceReady };
  const openEntry =
    openDexEntryKey != null ? combinedResults.find((entry) => entry.entryKey === openDexEntryKey) || null : null;
  const openView = openEntry ? buildEntryView(openEntry, viewContext) : null;
  const ownedPercent = totalDexCount > 0 ? Math.min(100, (caughtCount / totalDexCount) * 100) : 0;
  const shownBox = boxes[viewedBox - 1] || null;
  const boxedCount = boxes.reduce((sum, box) => sum + box.members.length, 0);
  const openSlotMon = openBoxSlot
    ? boxes[openBoxSlot.box - 1]?.members.find((mon) => mon.slot === openBoxSlot.slot) || null
    : null;
  const earnedBadgeCount = trainer ? trainer.badges.filter((badge) => badge.earned).length : 0;

  const renderEvolution = (requirement) => (
    <p className="sv-evo">
      <span className="sv-evo__label">Evolution</span>
      <span className="sv-evo__chain">
        {requirement.from && (
          <>
            <span className="sv-evo__stage">{requirement.from}</span>
            <Icon name="right" className="sv-evo__arrow" />
            <span className="sr-only">evolves by</span>
          </>
        )}
        <span className="sv-evo__method">{requirement.method}</span>
        <Icon name="right" className="sv-evo__arrow" />
        <span className="sr-only">into</span>
        <span className="sv-evo__stage">{requirement.target}</span>
      </span>
    </p>
  );

  const renderDexDetail = () => {
    if (!openEntry || !openView) return null;
    const { pokemonName, pokemonSlug, referenceRecord, pokedexUrl, spriteIdentifier, spriteProps } = openView;

    let facts = null;
    let extra = null;
    if (!referenceReady) {
      facts = referenceError ? (
        <p className="sv-detail__note" role="alert">
          {referenceError}
        </p>
      ) : (
        <p className="sv-detail__note" role="status">
          <span className="skeleton sv-detail__ghost" aria-hidden="true" />
          {`Loading ${activeGameLabel} data...`}
        </p>
      );
    } else if (!referenceRecord) {
      facts = (
        <p className="sv-detail__note">
          {showingYellow ? "Yellow Pokedex entry unavailable." : "Lazarus data unavailable."}
        </p>
      );
    } else if (showingYellow) {
      facts = (
        <dl className="kv sv-detail__facts">
          <dt>Species</dt>
          <dd>{referenceRecord?.species || "Species unknown"}</dd>
          <dt>Height</dt>
          <dd>{formatHeight(referenceRecord?.height)}</dd>
          <dt>Weight</dt>
          <dd>{formatWeight(referenceRecord?.weight)}</dd>
        </dl>
      );
      extra = (
        <DexDialog
          versions={[
            {
              name: "yellow",
              displayName: "Pokémon Yellow",
              text: referenceRecord?.entry || "Yellow Pokedex entry unavailable.",
            },
          ]}
          selectedVersion="yellow"
          onSelect={NO_OP}
        />
      );
    } else {
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
      facts = (
        <dl className="kv sv-detail__facts">
          <dt>Types</dt>
          <dd>
            {lazarusTypes.length > 0 ? (
              <span className="sv-types">
                {lazarusTypes.map((type) => (
                  <TypeTag key={type} typeName={String(type).toLowerCase()} />
                ))}
              </span>
            ) : (
              "Unknown"
            )}
          </dd>
          {lazarusAbilities.length > 0 && (
            <>
              <dt>Abilities</dt>
              <dd>{lazarusAbilities.join(" / ")}</dd>
            </>
          )}
          <dt>Base stat total</dt>
          <dd className="sv-num">{referenceRecord?.bst != null ? referenceRecord.bst : "--"}</dd>
        </dl>
      );
      extra =
        lazarusStatRows.length > 0 ? (
          <ul className="sv-detail__stats" aria-label="Base stats">
            {lazarusStatRows.map(([label, value]) => (
              <li
                key={label}
                className={`meter${statTier(value)}`}
                style={{ "--pct": Math.min(100, (value / 200) * 100) }}
              >
                <span className="meter__label">{label}</span>
                <span className="meter__value">{value != null ? value : "--"}</span>
                <span className="meter__track" aria-hidden="true">
                  <span className="meter__fill" />
                </span>
              </li>
            ))}
          </ul>
        ) : null;
    }

    const visibleEntries = openEntry.visibleEntries;
    const showWhere = !legacyMapReady || visibleEntries.length > 0 || !openEntry.evolutionRequirement;

    return (
      <>
        <div className="popsheet__head">
          <h2 className="popsheet__title sv-detail__title">
            <span className="sv-detail__no">{formatDexNo(openEntry.id)}</span>
            {pokemonName}
          </h2>
          <button type="button" className="btn btn--quiet btn--icon btn--sm" onClick={closeDexEntry} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="popsheet__body sv-detail">
          <div className="sv-detail__top">
            <span className={`sv-detail__screen${showingYellow ? " is-gb" : ""}`}>
              <SpriteImage
                id={spriteIdentifier}
                alt={pokemonName}
                className="sv-detail__img"
                width={192}
                height={192}
                {...spriteProps}
              />
            </span>
            <div className="sv-detail__id">
              <span className={`stamp sv-status${openEntry.caught ? " is-caught" : ""}`}>
                {openEntry.caught ? <Icon name="ball" /> : null}
                {openEntry.caught ? "Caught" : "Missing"}
              </span>
              {facts}
            </div>
          </div>
          {extra}

          {showWhere && (
            <section className="sv-detail__section" aria-labelledby="sv-detail-where">
              <h3 className="label" id="sv-detail-where">
                Where to find
              </h3>
              {legacyMapReady ? (
                visibleEntries.length > 0 ? (
                  <ul className="sv-where">
                    {visibleEntries.map((locationEntry, index) => {
                      const sharedPokemon = locationPokemonLookup.get(locationEntry.location) || [];
                      const sharedOthers = sharedPokemon.filter((item) => item.slug !== pokemonSlug);
                      const caughtEntries = sharedOthers.filter((item) => item.caught);
                      const missingEntries = sharedOthers.filter((item) => !item.caught);
                      return (
                        <li key={`${locationEntry.location}-${index}`} className="sv-where__item">
                          <p className="sv-loc sv-where__head">
                            <span className="sv-loc__name">{locationEntry.location}</span>
                            <LocationParts parts={describeLocationParts(locationEntry, showingYellow)} />
                          </p>
                          <p className="sv-where__title">Also found here</p>
                          {sharedOthers.length > 0 ? (
                            <div className="sv-where__cols">
                              <div>
                                <p className="sv-where__sub">Caught</p>
                                {caughtEntries.length > 0 ? (
                                  <ul className="sv-where__list">
                                    {caughtEntries.map(({ name, slug }) => (
                                      <li key={`${slug || name}-caught`} className="sv-where__mon is-caught">
                                        <Icon name="ball" />
                                        <span>{name}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="sv-where__none">None</p>
                                )}
                              </div>
                              <div>
                                <p className="sv-where__sub">Missing</p>
                                {missingEntries.length > 0 ? (
                                  <ul className="sv-where__list">
                                    {missingEntries.map(({ name, slug }) => (
                                      <li key={`${slug || name}-missing`} className="sv-where__mon">
                                        <span>{name}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="sv-where__none">None</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="sv-where__none">No other Pokémon share this location.</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="sv-detail__note">No encounter data</p>
                )
              ) : (
                <p className="sv-detail__note" role="status">
                  Loading encounter data...
                </p>
              )}
            </section>
          )}

          {openEntry.evolutionRequirement && (
            <section className="sv-detail__section">{renderEvolution(openEntry.evolutionRequirement)}</section>
          )}

          {pokedexUrl ? (
            <a className="btn btn--sm sv-detail__link" href={pokedexUrl} target="_blank" rel="noopener noreferrer">
              Open in the Pokédex
              <Icon name="external" />
            </a>
          ) : null}
        </div>
      </>
    );
  };

  return (
    <main className="sv">
      <header className="sv-head">
        <h1 className="sv-title">Save Reader</h1>
        <p className="sv-intro">
          Import a <strong>Pokémon Yellow Legacy</strong> <span className="sv-ext">.sav / .srm</span> file to view your
          save data entirely in the browser, or preview the <strong>Pokémon Lazarus</strong> Pokédex.
        </p>
      </header>

      {!hasSaveData ? (
        <section className="win sv-load" aria-labelledby="sv-load-title">
          <div className="win__head">
            <h2 className="win__title" id="sv-load-title">
              Load a save file
            </h2>
          </div>
          <div className="win__body sv-load__body">
            <div className="sv-load__main">
              <label
                className={`sv-drop${dragging ? " is-dragging" : ""}${loading ? " is-busy" : ""}`}
                htmlFor="sv-upload-input"
                onDragEnter={handleDragOver}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  id="sv-upload-input"
                  className="sr-only sv-drop__input"
                  type="file"
                  accept=".sav,.srm"
                  onChange={handleYellowFileChange}
                  disabled={loading}
                />
                <CartIcon className="sv-drop__icon" />
                <span className="sv-drop__title">Choose your save file</span>
                <span className="sv-drop__sub">or drop a .sav or .srm file here</span>
                <span className="btn btn--primary sv-drop__btn" aria-hidden="true">
                  Choose file
                </span>
              </label>
              <p className="sv-load__privacy">Processing happens locally in the browser. No files are uploaded.</p>
              {loading && (
                <p className="sv-status-line" role="status">
                  <span className="skeleton sv-status-line__bar" aria-hidden="true" />
                  Processing save file...
                </p>
              )}
              {error && (
                <div className="sv-alert" role="alert">
                  <span className="stamp stamp--red">Can&apos;t read</span>
                  <p>{error}</p>
                </div>
              )}
            </div>

            <div className="sv-support">
              <h3 className="label">Supported saves</h3>
              <ul className="sv-support__list">
                <li>
                  <span className="stamp">Reads</span>
                  <p>
                    <strong>Pokémon Yellow Legacy</strong> saves. English Red, Blue and Yellow saves use the same format,
                    but locations and evolutions shown are Yellow Legacy&apos;s.
                  </p>
                </li>
                <li>
                  <span className="stamp">Preview</span>
                  <p>
                    <strong>Pokémon Lazarus</strong> saves can&apos;t be read yet, but you can preview its Pokédex below.
                  </p>
                </li>
              </ul>
              <p className="sv-support__links">
                Learn more about the Legacy ROMs at{" "}
                <a href="https://www.reddit.com/r/PokemonLegacy/" target="_blank" rel="noreferrer">
                  r/PokemonLegacy
                </a>{" "}
                and check out{" "}
                <a href="https://pokemonlazarus.net/" target="_blank" rel="noreferrer">
                  PokemonLazarus.net
                </a>{" "}
                for the latest Lazarus documentation and downloads.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <div className="sv-save">
          <section className="win sv-card" aria-labelledby="sv-card-title">
            <div className="win__head">
              <h2 className="win__title" id="sv-card-title">
                Trainer card
              </h2>
              <button type="button" className="btn btn--sm" onClick={handleClearSave}>
                Close file
              </button>
            </div>
            <div className="win__body sv-card__body">
              <div className="sv-trainer">
                <p className="sv-trainer__name">{trainer?.name || "Unknown"}</p>
                <dl className="kv sv-card__facts">
                  <dt>ID No.</dt>
                  <dd className="sv-num">{trainer?.idFormatted ?? "-----"}</dd>
                  <dt>Money</dt>
                  <dd className="sv-num">
                    {trainer?.money != null ? (
                      <>
                        <span aria-hidden="true">¥</span>
                        {trainer.money.toLocaleString("en-US")}
                      </>
                    ) : (
                      "--"
                    )}
                  </dd>
                  <dt>Time</dt>
                  <dd className="sv-num">{trainer ? formatPlayTime(trainer.playTime) : "--"}</dd>
                  <dt>Rival</dt>
                  <dd className="sv-card__rival">{trainer?.rivalName || "Unknown"}</dd>
                </dl>
              </div>

              <div className="sv-card__section">
                <p className="sv-card__section-head">
                  <span className="label">Badges</span>
                  <span>
                    <span className="sv-num">{earnedBadgeCount}</span>
                    <span className="sv-num-of"> / {GEN1_BADGES.length}</span>
                  </span>
                </p>
                <ul className="sv-badges">
                  {(trainer?.badges || []).map((badge) => (
                    <li key={badge.name} className={`sv-badge${badge.earned ? " is-earned" : ""}`}>
                      <PixelGlyph rects={BADGE_RECTS.get(badge.name)} className="sv-badge__icon" />
                      <span className="sv-badge__name">{badge.name}</span>
                      <span className="sr-only">{badge.earned ? " Badge, earned" : " Badge, not earned"}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sv-card__section">
                <p className="sv-card__section-head">
                  <span className="label">Pokédex owned</span>
                  <span>
                    <span className="sv-num sv-num--lg">{caughtCount}</span>
                    <span className="sv-num-of"> / {totalDexCount}</span>
                  </span>
                </p>
                <span className="meter__track sv-card__meter" style={{ "--pct": ownedPercent }} aria-hidden="true">
                  <span className="meter__fill" />
                </span>
              </div>

              <dl className="sv-card__meta">
                <div>
                  <dt>Game</dt>
                  <dd>{trainer?.game || activeGameLabel}</dd>
                </div>
                <div>
                  <dt>File</dt>
                  <dd className="sv-card__file">{fileName}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="win sv-party" aria-labelledby="sv-party-title">
            <div className="win__head">
              <h2 className="win__title" id="sv-party-title">
                Party
              </h2>
              <p className="sv-count">
                <span className="sv-num">{partyMembers.length}</span> / {PARTY_MAX_SIZE}
              </p>
            </div>
            <div className="win__body">
              {partySlots.some(Boolean) ? (
                <ol className="sv-party__list">
                  {partySlots.map((slot, index) =>
                    slot ? (
                      <MonSummary key={`party-slot-${index}`} mon={slot} />
                    ) : (
                      <li key={`party-slot-${index}`} className="sv-mon sv-mon--empty">
                        <span className="sv-mon__sprite" aria-hidden="true" />
                        <span className="sv-mon__empty-name">Slot {index + 1}</span>
                        <span className="sv-mon__empty-label">Empty</span>
                      </li>
                    )
                  )}
                </ol>
              ) : (
                <div className="empty">
                  <p className="empty__title">No party Pokémon</p>
                  <p>Party data unavailable (or party is empty).</p>
                </div>
              )}
            </div>
          </section>

          <section className="win sv-boxes" aria-labelledby="sv-boxes-title">
            <div className="win__head">
              <h2 className="win__title" id="sv-boxes-title">
                PC boxes
              </h2>
              <p className="sv-count">
                <span className="sv-num">{boxedCount}</span> stored
              </p>
            </div>
            <div className="win__body sv-boxes__body">
              <div className="sv-boxbar">
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => stepBox(-1)}
                  aria-label={`Previous box (Box ${((viewedBox + BOX_COUNT - 2) % BOX_COUNT) + 1})`}
                >
                  <Icon name="left" />
                </button>
                <p className="sv-boxbar__label" aria-live="polite">
                  <span className="sv-boxbar__name">Box {viewedBox}</span>
                  <span className="sr-only">: </span>
                  <span className="sv-boxbar__count">
                    <span className="sv-num">{shownBox ? shownBox.members.length : 0}</span>
                    <span className="sv-num-of">
                      <span aria-hidden="true"> / </span>
                      <span className="sr-only"> of </span>
                      {BOX_MAX_SIZE}
                    </span>
                  </span>
                  {viewedBox === currentBox ? (
                    <>
                      <span className="sr-only">, </span>
                      <span className="stamp stamp--select">Current</span>
                    </>
                  ) : null}
                </p>
                <button
                  type="button"
                  className="btn btn--icon"
                  onClick={() => stepBox(1)}
                  aria-label={`Next box (Box ${(viewedBox % BOX_COUNT) + 1})`}
                >
                  <Icon name="right" />
                </button>
              </div>

              <ol className="sv-boxlist" aria-label="Boxes">
                {boxes.map((box) => (
                  <li key={box.number}>
                    <button
                      type="button"
                      className={`sv-boxlist__btn${box.members.length === 0 ? " is-empty" : ""}`}
                      aria-pressed={box.number === viewedBox}
                      aria-label={`Box ${box.number}, ${box.members.length} Pokémon${
                        box.number === currentBox ? ", current box" : ""
                      }`}
                      onClick={() => setViewedBox(box.number)}
                    >
                      <span className="sv-boxlist__no">{box.number}</span>
                      <span className="sv-boxlist__count" aria-hidden="true">
                        {box.members.length}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>

              {!shownBox || !shownBox.readable ? (
                <div className="empty sv-boxes__empty">
                  <p className="empty__title">Can&apos;t read Box {viewedBox}</p>
                  <p>This box&apos;s data in the save isn&apos;t a valid box list.</p>
                </div>
              ) : shownBox.members.length === 0 ? (
                <div className="empty sv-boxes__empty">
                  <p className="empty__title">Box {viewedBox} is empty</p>
                </div>
              ) : (
                <ol className="sv-slots" aria-label={`Box ${viewedBox}`}>
                  {Array.from({ length: BOX_MAX_SIZE }, (_, index) => {
                    const mon = shownBox.members[index];
                    if (!mon) {
                      // Empty slots only fill out the last row, at 5 or 4 across; n / 20 gives the rest.
                      const count = shownBox.members.length;
                      const padsFive = index < Math.ceil(count / 5) * 5;
                      const padsFour = index < Math.ceil(count / 4) * 4;
                      if (!padsFive && !padsFour) return null;
                      return (
                        <li
                          key={`empty-${index}`}
                          className={`sv-slot sv-slot--empty${padsFive ? " is-pad-5" : ""}${padsFour ? " is-pad-4" : ""}`}
                          aria-hidden="true"
                        />
                      );
                    }
                    const name = monDisplayName(mon);
                    const isOpen = openBoxSlot?.box === viewedBox && openBoxSlot?.slot === mon.slot;
                    return (
                      <li key={`slot-${mon.slot}`} className={`sv-slot${isOpen ? " is-open" : ""}`}>
                        <button
                          type="button"
                          className="sv-slot__btn"
                          aria-haspopup="dialog"
                          aria-expanded={isOpen}
                          aria-label={`${name}, level ${mon.level ?? "unknown"}`}
                          onClick={(event) => openBoxMon(event, viewedBox, mon.slot)}
                        >
                          <Cursor className="sv-slot__cursor" />
                          <span className="sv-slot__sprite">
                            <SpriteImage
                              id={mon.dexId ?? 0}
                              alt=""
                              className="sv-slot__img"
                              width={96}
                              height={96}
                              gameSpritePath={YELLOW_SPRITE_PATH}
                            />
                          </span>
                          <span className="sv-slot__name">{name}</span>
                          <span className="sv-slot__lv">
                            <span className="sv-slot__lv-label">Lv</span>
                            {mon.level ?? "??"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        </div>
      )}

      <section className="win sv-dex" aria-labelledby="sv-dex-title">
        <div className="win__head">
          <h2 className="win__title" id="sv-dex-title">
            Caught Pokémon
          </h2>
          <p className="sv-count">
            <span className="sv-num">{caughtCount}</span> / {totalDexCount}
          </p>
        </div>
        <div className="win__body">
          <div className="sv-dex__intro">
            {hasSaveData ? (
              <p className="sv-dex__game">{activeGameLabel}</p>
            ) : (
              <div className="sv-dex__switch" role="group" aria-label="Pokédex to preview">
                <div className="seg">
                  <button
                    type="button"
                    className="seg__btn"
                    aria-pressed={showingYellow}
                    onClick={() => handlePreviewPokedex("yellow")}
                  >
                    Yellow Legacy
                  </button>
                  <button
                    type="button"
                    className="seg__btn"
                    aria-pressed={!showingYellow}
                    onClick={() => handlePreviewPokedex("lazarus")}
                  >
                    Lazarus
                  </button>
                </div>
              </div>
            )}
            <p className="sv-dex__desc">
              Review every Pokédex entry and compare your caught status with their encounter locations.
            </p>
            {!hasSaveData && (
              <p className="sv-dex__hint">All entries default to “Missing” until you select a save file.</p>
            )}
          </div>

          <div className="sv-tools">
            <label className="field sv-tools__search">
              <span className="sr-only">Search Pokémon</span>
              <Icon name="search" />
              <input
                type="search"
                className="field__input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Filter by name"
              />
            </label>
            <label className="sv-tools__loc">
              <span className="sr-only">Location</span>
              <select
                className="field__input"
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
            <button
              type="button"
              className="btn sv-tools__toggle"
              aria-pressed={!showCaught}
              onClick={() => setShowCaught((prev) => !prev)}
            >
              Hide caught
            </button>
          </div>

          {showingYellow && legacyEncounterError && (
            <p className="sv-alert" role="alert">
              {legacyEncounterError}
            </p>
          )}
          {!showingYellow && lazarusDexError && (
            <p className="sv-alert" role="alert">
              {lazarusDexError}
            </p>
          )}

          {!showingYellow && !lazarusReferenceReady ? (
            <div className="sv-entries" role="status">
              <span className="sr-only">Loading Pokémon Lazarus data...</span>
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="sv-entry sv-entry--ghost" aria-hidden="true">
                  <span className="sv-entry__open">
                    <span className="skeleton sv-ghost__no" />
                    <span className="skeleton sv-ghost__sprite" />
                  </span>
                  <span className="sv-entry__main">
                    <span className="skeleton sv-ghost__line" />
                    <span className="skeleton sv-ghost__line sv-ghost__line--short" />
                  </span>
                </div>
              ))}
            </div>
          ) : filteredResults.length > 0 ? (
            <ul className="sv-entries">
              {filteredResults.map((entry) => {
                const view = buildEntryView(entry, viewContext);
                const isDexOpen = openDexEntryKey === entry.entryKey;
                return (
                  <li
                    key={entry.entryKey || entry.id}
                    className={`sv-entry${entry.caught ? " is-caught" : ""}${isDexOpen ? " is-open" : ""}`}
                    data-dex-entry-key={entry.entryKey}
                  >
                    <button
                      type="button"
                      className="sv-entry__open"
                      aria-haspopup="dialog"
                      aria-expanded={isDexOpen}
                      aria-label={`${isDexOpen ? "Hide" : "Show"} ${dexPanelLabel} for ${view.pokemonName}`}
                      title={`${dexPanelLabel}: ${view.pokemonName}`}
                      onClick={(event) => openDexEntry(event, entry.entryKey)}
                    >
                      <Cursor className="sv-entry__cursor" />
                      <span className="sv-entry__no">{formatDexNo(entry.id)}</span>
                      <span className="sv-entry__sprite">
                        <SpriteImage
                          id={view.spriteIdentifier}
                          alt=""
                          className="sv-entry__img"
                          width={64}
                          height={64}
                          {...view.spriteProps}
                        />
                      </span>
                    </button>
                    <div className="sv-entry__main">
                      <p className="sv-entry__title">
                        {view.pokedexUrl ? (
                          <a className="sv-entry__name" href={view.pokedexUrl} target="_blank" rel="noopener noreferrer">
                            {view.pokemonName}
                            <Icon name="external" className="sv-ext-icon" />
                            <span className="sr-only"> (opens the Pokédex in a new tab)</span>
                          </a>
                        ) : (
                          <span className="sv-entry__name">{view.pokemonName}</span>
                        )}
                        <span className={`stamp sv-status${entry.caught ? " is-caught" : ""}`}>
                          {entry.caught ? <Icon name="ball" /> : null}
                          {entry.caught ? "Caught" : "Missing"}
                        </span>
                      </p>
                      {legacyMapReady ? (
                        entry.visibleEntries.length > 0 ? (
                          <ul className="sv-entry__locs">
                            {entry.visibleEntries.map((locationEntry, index) => (
                              <li
                                key={`${locationEntry.location}-${index}`}
                                className={`sv-loc${locationEntry.methodType ? ` sv-loc--${locationEntry.methodType}` : ""}`}
                              >
                                <span className="sv-loc__name">{locationEntry.location}</span>
                                <LocationParts parts={describeLocationParts(locationEntry, showingYellow)} />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          !entry.evolutionRequirement && <p className="sv-entry__none">No encounter data</p>
                        )
                      ) : (
                        <p className="sv-entry__loading">
                          <span className="skeleton sv-ghost__line" aria-hidden="true" />
                          <span className="sr-only">Loading encounter data...</span>
                        </p>
                      )}
                      {entry.evolutionRequirement && renderEvolution(entry.evolutionRequirement)}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty sv-dex__empty">
              <p className="empty__title">No matches</p>
              <p>No Pokémon match the current search or location filter.</p>
              <button type="button" className="btn btn--sm" onClick={resetResultFilters}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      <Sheet
        open={Boolean(openEntry)}
        onClose={closeDexEntry}
        anchorRef={dexAnchorRef}
        label={openView ? `${dexPanelLabel}: ${openView.pokemonName}` : dexPanelLabel}
        width={440}
        className="sv-sheet"
      >
        {renderDexDetail()}
      </Sheet>

      <Sheet
        open={Boolean(openSlotMon)}
        onClose={closeBoxMon}
        anchorRef={monAnchorRef}
        label={openSlotMon ? `Box ${openBoxSlot.box}: ${monDisplayName(openSlotMon)}` : "Box Pokémon"}
        width={440}
        className="sv-sheet"
      >
        {openSlotMon ? (
          <>
            <div className="popsheet__head">
              <h2 className="popsheet__title">
                Box {openBoxSlot.box}
                <span className="sv-sheet__slot"> · Slot {openSlotMon.slot}</span>
              </h2>
              <button
                type="button"
                className="btn btn--quiet btn--icon btn--sm"
                onClick={closeBoxMon}
                aria-label="Close"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="popsheet__body">
              <MonSummary mon={openSlotMon} as="div" className="sv-mon--sheet" />
            </div>
          </>
        ) : null}
      </Sheet>
    </main>
  );
}
