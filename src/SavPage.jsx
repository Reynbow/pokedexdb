import React, { useState, useCallback, useEffect, useMemo } from "react";
import "./App.css";
import SpriteImage from "./components/SpriteImage.jsx";

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
  const [caughtPokemon, setCaughtPokemon] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [manualOffset, setManualOffset] = useState('0x25A3');
  const [manualBitOrder, setManualBitOrder] = useState('lsb');
  const [showDebugTools, setShowDebugTools] = useState(false);
  const [legacyEncounters, setLegacyEncounters] = useState(null);
  const [legacyEncountersReady, setLegacyEncountersReady] = useState(false);
  const [legacyEncounterError, setLegacyEncounterError] = useState(null);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const basePath = (import.meta.env.BASE_URL || "/").replace(/\/+$|^$/, "/");
      if (url.pathname !== basePath) {
        url.pathname = basePath;
      }
      if (url.hash !== "#/sav") {
        url.hash = "#/sav";
      }
      window.history.replaceState({}, "", url);
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
  }, []);

  const handleFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileNameLower = file.name.toLowerCase();
    if (!fileNameLower.endsWith('.sav') && !fileNameLower.endsWith('.srm')) {
      setError("Please select a .sav or .srm file");
      return;
    }

    setLoading(true);
    setError(null);
    setFileName(file.name);
    setCaughtPokemon([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target.result;
        const data = new Uint8Array(arrayBuffer);
        const {
          caughtPokemon: caught,
          sourceOffset,
          sourceLabel,
          offsetResults,
        } = parseSavFile(arrayBuffer);
        
        // Store file data for debugging
        setFileData(data);
        
        // Store some debug info about the file
        // Show both the main and backup Pokédex locations
        setDebugInfo({
          fileSize: data.length,
          offsetResults: offsetResults.map((entry) => ({
            offset: entry.label,
            absoluteOffset: `0x${entry.offset.toString(16).toUpperCase()}`,
            bytes: entry.bytes.map((b) => `0x${b.toString(16).padStart(2, "0").toUpperCase()}`).join(" "),
            caughtCount: entry.caughtPokemon.length,
            sample: entry.caughtPokemon.slice(0, 5),
            isActive: entry.offset === sourceOffset,
          })),
          usedOffset: `0x${sourceOffset.toString(16).toUpperCase()}`,
          usedLabel: sourceLabel,
        });
        
        setCaughtPokemon(caught);
        setError(null);
      } catch (err) {
        setError(`Error parsing save file: ${err.message}`);
        setCaughtPokemon([]);
        setDebugInfo(null);
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
  }, []);

  const toTitleCase = (str) => {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  const testManualOffset = useCallback((overrideOffset, overrideBitOrder) => {
    if (!fileData) return;
    
    try {
      const offsetText = (overrideOffset ?? manualOffset ?? '').trim();
      const bitOrder = overrideBitOrder ?? manualBitOrder;
      const offset = parseInt(offsetText, 16);
      if (isNaN(offset) || offset < 0 || offset + 20 >= fileData.length) {
        setError(`Invalid offset: ${offsetText}`);
        return;
      }
      
      const caught = [];
      
      // Try the selected bit order
      for (let i = 0; i < GEN1_POKEMON_COUNT; i++) {
        const byteIndex = offset + Math.floor(i / 8);
        const bitPosition = i % 8;
        if (byteIndex >= fileData.length) break;
        
        let isCaught = false;
        if (bitOrder === 'lsb') {
          isCaught = ((fileData[byteIndex] >> bitPosition) & 1) !== 0;
        } else if (bitOrder === 'msb') {
          isCaught = ((fileData[byteIndex] >> (7 - bitPosition)) & 1) !== 0;
        } else if (bitOrder === 'reverse-lsb') {
          const reverseBitPos = 7 - bitPosition;
          isCaught = ((fileData[byteIndex] >> reverseBitPos) & 1) !== 0;
        }
        
        if (isCaught) {
          caught.push(i + 1);
        }
      }
      
      setCaughtPokemon(caught);
      setError(null);
    } catch (err) {
      setError(`Error testing offset: ${err.message}`);
    }
  }, [fileData, manualOffset, manualBitOrder]);

  const handleManualPreset = useCallback((offsetValue, bitOrderValue) => {
    setManualOffset(offsetValue);
    setManualBitOrder(bitOrderValue);
    testManualOffset(offsetValue, bitOrderValue);
  }, [testManualOffset]);

  const manualPresets = [
    { label: 'Main 0x25A3 (LSB)', offset: '0x25A3', bitOrder: 'lsb' },
    { label: 'Backup 0x05A3 (LSB)', offset: '0x05A3', bitOrder: 'lsb' },
  ];

  const caughtSet = useMemo(() => new Set(caughtPokemon), [caughtPokemon]);
  const hasSaveData = fileData instanceof Uint8Array;
  const legacyMapReady = legacyEncountersReady && legacyEncounters instanceof Map;
  const combinedResults = useMemo(() => {
    if (!hasSaveData) {
      return [];
    }
    return GEN1_POKEMON_NAMES.map((name, index) => {
      const pokemonId = index + 1;
      const slug = normalizeLegacyPokemonName(name);
      const encounterEntries = legacyMapReady ? legacyEncounters.get(slug) || [] : [];
      const visibleEntries = encounterEntries;
      return {
        id: pokemonId,
        name,
        caught: caughtSet.has(pokemonId),
        visibleEntries,
        evolutionRequirement: EVOLUTION_REQUIREMENTS.get(slug) || null,
      };
    });
  }, [caughtSet, hasSaveData, legacyMapReady, legacyEncounters]);

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
          <h1 className="title">Save File Reader</h1>
          <p className="subtitle">
            Import a Pokemon Yellow .sav or .srm file to preview which Pokedex entries are marked as caught.
          </p>
        </div>
      </header>
      <main className="container sav-page__content">
        <section className="sav-page__grid">
          <article className="sav-card sav-card--primary">
            <div className="sav-card__header">
              <span className="sav-card__eyebrow">Step 1</span>
              <h2 className="sav-card__title">Upload your save</h2>
              <p className="sav-card__description">
                Works with emulator exports or flash-cart backups (32KB Pokemon Yellow saves in .sav or .srm format).
              </p>
            </div>
            <div className="sav-card__body">
              <label className="sav-field-label" htmlFor="sav-upload-input">
                Pokemon Yellow save file
              </label>
              <input
                id="sav-upload-input"
                className="sav-file-input"
                type="file"
                accept=".sav,.srm"
                onChange={handleFileChange}
                disabled={loading}
              />
              <p className="sav-meta">Processing happens locally in the browser—no files are uploaded.</p>
              {fileName && (
                <p className="sav-meta">
                  <strong>Selected:</strong> {fileName}
                </p>
              )}
              {loading && <p className="sav-status">Processing save file...</p>}
              {error && <div className="sav-alert sav-alert--error">{error}</div>}
            </div>
          </article>

          {debugInfo && (
            <article className="sav-card sav-card--debug">
              <div className="sav-card__header">
                <span className="sav-card__eyebrow">Step 2</span>
                <h2 className="sav-card__title">Debug details</h2>
                <p className="sav-card__description">
                  Review the offsets we attempted or manually try a different bit order.
                </p>
              </div>
              <div className="sav-card__body">
                <p className="sav-meta">
                  <strong>File size:</strong> {debugInfo.fileSize} bytes ({debugInfo.fileSize.toString(16).toUpperCase()} hex)
                </p>
                {debugInfo.usedLabel && (
                  <p className="sav-meta">
                    <strong>Active offset:</strong> {debugInfo.usedLabel} (<code>{debugInfo.usedOffset}</code>)
                  </p>
                )}
                <button
                  type="button"
                  className="sav-debug-toggle"
                  onClick={() => setShowDebugTools((value) => !value)}
                >
                  {showDebugTools ? "Hide debug tools" : "Show debug tools"}
                </button>

                {showDebugTools && (
                  <div className="sav-debug-panel">
                    <div className="sav-debug-section">
                      <div className="sav-debug-section__title">Test results at common offsets</div>
                      <div className="sav-debug-table-wrapper">
                        <table className="sav-debug-table">
                          <thead>
                            <tr>
                              <th>Offset</th>
                              <th>Absolute</th>
                              <th>Count</th>
                              <th>Sample</th>
                              <th>Used</th>
                            </tr>
                          </thead>
                          <tbody>
                            {debugInfo.offsetResults.map((result, idx) => {
                              const rowClassNames = [
                                result.caughtCount === GEN1_POKEMON_COUNT ? "is-complete" : "",
                                result.isActive ? "is-active" : "",
                                result.caughtCount === 0 ? "is-empty" : "",
                              ]
                                .filter(Boolean)
                                .join(" ");
                              return (
                                <tr key={`${result.offset}-${idx}`} className={rowClassNames}>
                                  <td>{result.offset}</td>
                                  <td>
                                    <code>{result.absoluteOffset}</code>
                                  </td>
                                  <td>{result.caughtCount}</td>
                                  <td>{result.sample.map((id) => `#${id}`).join(", ")}</td>
                                  <td>{result.isActive ? "Yes" : "No"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="sav-debug-section">
                      <div className="sav-debug-section__title">Manual offset tester</div>
                      <div className="sav-manual-controls">
                        <label className="visually-hidden" htmlFor="manual-offset-input">
                          Manual offset
                        </label>
                        <input
                          id="manual-offset-input"
                          className="sav-manual-input"
                          type="text"
                          value={manualOffset}
                          onChange={(e) => setManualOffset(e.target.value)}
                          placeholder="0x25A3"
                        />
                        <label className="visually-hidden" htmlFor="manual-bit-order">
                          Manual bit order
                        </label>
                        <select
                          id="manual-bit-order"
                          className="sav-manual-select"
                          value={manualBitOrder}
                          onChange={(e) => setManualBitOrder(e.target.value)}
                        >
                          <option value="lsb">LSB (bit 0 = #1)</option>
                          <option value="msb">MSB (bit 7 = #1)</option>
                          <option value="reverse-lsb">Reverse LSB</option>
                        </select>
                        <button
                          type="button"
                          className="sav-manual-button"
                          onClick={() => testManualOffset()}
                          disabled={!fileData}
                        >
                          Test
                        </button>
                      </div>
                      <p className="sav-meta">
                        Compare the count below with your in-game Pokedex to confirm the correct combination.
                      </p>
                      <div className="sav-quick-buttons">
                        <span className="sav-quick-label">Quick tests:</span>
                        {manualPresets.map((preset) => (
                          <button
                            key={`${preset.offset}-${preset.bitOrder}`}
                            type="button"
                            className="sav-quick-button"
                            onClick={() => handleManualPreset(preset.offset, preset.bitOrder)}
                            disabled={!fileData}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </article>
          )}
        </section>

        {hasSaveData && (
          <section className="sav-card sav-results-card">
            <div className="sav-card__header">
              <span className="sav-card__eyebrow">Results</span>
              <h2 className="sav-card__title">
                Caught Pokemon ({caughtPokemon.length} / {GEN1_POKEMON_COUNT})
              </h2>
              <p className="sav-card__description">
                Review every Pokédex entry and compare your caught status with their encounter locations.
              </p>
            </div>
            <div className="sav-card__body">
              {legacyEncounterError && (
                <div className="sav-alert sav-alert--error">{legacyEncounterError}</div>
              )}
              <div className="sav-results-list">
                {combinedResults.map((entry) => {
                  const pokemonName = toTitleCase(entry.name);
                  const cardClassNames = [
                    "sav-result-row",
                    entry.caught ? "is-caught" : "is-uncaught",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <div key={entry.id} className={cardClassNames}>
                      <div className="sav-result-row__pokemon">
                        <div className="sav-result-row__sprite">
                          <SpriteImage
                            id={entry.id}
                            alt={pokemonName}
                            gameSpritePath="generation-i/yellow/transparent/"
                            style={{
                              width: "96px",
                              height: "96px",
                              imageRendering: "pixelated",
                            }}
                          />
                        </div>
                        <div className="sav-result-row__meta">
                          <div className="sav-result-row__nameblock">
                            <div className="sav-result-row__number">#{String(entry.id).padStart(3, "0")}</div>
                            <div className="sav-result-row__name">{pokemonName}</div>
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
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
