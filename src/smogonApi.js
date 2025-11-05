const SMOGON_API_BASE = "https://data.pkmn.cc";

export const SMOGON_SET_GENERATIONS = ["gen9", "gen8", "gen7", "gen6", "gen5", "gen4", "gen3", "gen2", "gen1"];

const setCache = new Map();
const setPromises = new Map();

const analysisCache = new Map();
const analysisPromises = new Map();

const statsCache = new Map();
const statsPromises = new Map();

const teamsCache = new Map();
const teamsPromises = new Map();

const normalizedSetIndexes = new Map();

const stripDiacritics = (value) => {
  if (!value) return "";
  try {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return value;
  }
};

export const normalizeSpeciesName = (value) =>
  stripDiacritics(String(value || ""))
    .toLowerCase()
    .replace(/[♀]/g, "-f")
    .replace(/[♂]/g, "-m")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");

const formatWeight = (key) => {
  const k = String(key || "").toLowerCase();
  if (k === "ou") return 0;
  if (k === "ubers" || k === "uber") return 1;
  if (k === "uu") return 2;
  if (k === "ru") return 3;
  if (k === "nu") return 4;
  if (k === "pu") return 5;
  if (k === "zu") return 6;
  if (k === "lc" || k === "littlecup") return 7;
  if (k === "battlestadiumsingles") return 8;
  if (k.startsWith("vgc")) return 9;
  if (k === "doublesou" || k === "doublesouclassic") return 10;
  if (k === "monotype") return 11;
  if (k.endsWith("monotype")) return 12;
  if (k === "nationaldex") return 13;
  if (k === "nationaldexmonotype") return 14;
  return 100 + k.charCodeAt(0);
};

const extractNatureValue = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = extractNatureValue(entry);
      if (candidate) return candidate;
    }
    return null;
  }
  if (typeof value === "object") {
    const nested = value.nature || value.value;
    const candidate = extractNatureValue(nested);
    if (candidate) return candidate;
    for (const key of Object.keys(value)) {
      const next = extractNatureValue(value[key]);
      if (next) return next;
    }
  }
  return null;
};

// Try to pull a reasonable item string out of a Smogon set-like structure
const extractItemValue = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = extractItemValue(entry);
      if (candidate) return candidate;
    }
    return null;
  }
  if (typeof value === "object") {
    // Common fields we might see in datasets
    const nested = value.item || value.items || value.held_item || value.value;
    const candidate = extractItemValue(nested);
    if (candidate) return candidate;
    for (const key of Object.keys(value)) {
      if (key === "name") continue; // avoid picking set names or move names as items
      const next = extractItemValue(value[key]);
      if (next) return next;
    }
  }
  return null;
};

const parseSpreadNature = (spread) => {
  if (!spread) return null;
  if (typeof spread === "string") {
    const parts = spread.split(":");
    if (parts.length > 1) {
      return parts[0].trim();
    }
    return null;
  }
  if (typeof spread === "object") {
    return extractNatureValue(spread);
  }
  return null;
};

const EV_ALIAS_MAP = {
  hp: "hp",
  health: "hp",
  atk: "atk",
  attack: "atk",
  att: "atk",
  offense: "atk",
  def: "def",
  defense: "def",
  df: "def",
  spa: "spa",
  spatk: "spa",
  spattack: "spa",
  specialattack: "spa",
  spc: "spa",
  spd: "spd",
  spdef: "spd",
  specialdefense: "spd",
  spe: "spe",
  speed: "spe",
};

const normalizeEvKey = (rawKey) => {
  if (!rawKey) return null;
  const cleaned = String(rawKey).toLowerCase().replace(/[^a-z]/g, "");
  return EV_ALIAS_MAP[cleaned] || null;
};

const normalizeEvs = (evs) => {
  if (!evs || typeof evs !== "object") return null;
  const result = {};
  Object.entries(evs).forEach(([key, value]) => {
    const mappedKey = normalizeEvKey(key);
    const numericValue = Number(value);
    if (!mappedKey || Number.isNaN(numericValue)) {
      return;
    }
    result[mappedKey] = numericValue;
  });
  return Object.keys(result).length > 0 ? result : null;
};

const parseSpreadEvsString = (value) => {
  if (!value) return null;
  const chunks = String(value)
    .split("/")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (chunks.length === 0) return null;
  const evs = {};
  chunks.forEach((chunk) => {
    const match = chunk.match(/(\d+)\s*([A-Za-z]+)/);
    if (!match) return;
    const mappedKey = normalizeEvKey(match[2]);
    if (!mappedKey) return;
    evs[mappedKey] = Number(match[1]);
  });
  return normalizeEvs(evs);
};

const parseSpreadEvs = (spreads) => {
  if (!spreads) return null;
  if (typeof spreads === "string") {
    return parseSpreadEvsString(spreads);
  }
  if (Array.isArray(spreads)) {
    for (const entry of spreads) {
      const parsed = parseSpreadEvs(entry);
      if (parsed) return parsed;
    }
    return null;
  }
  if (typeof spreads === "object") {
    for (const [key, value] of Object.entries(spreads)) {
      const fromKey = parseSpreadEvs(key);
      if (fromKey) return fromKey;
      const nested = parseSpreadEvs(value);
      if (nested) return nested;
    }
  }
  return null;
};

const extractNatureFromSpreads = (spreads) => {
  if (!spreads) return null;
  if (Array.isArray(spreads)) {
    for (const entry of spreads) {
      const candidate = parseSpreadNature(entry);
      if (candidate) return candidate;
    }
    return null;
  }
  if (typeof spreads === "object") {
    for (const key of Object.keys(spreads)) {
      const candidate = parseSpreadNature(key);
      if (candidate) return candidate;
      const nested = parseSpreadNature(spreads[key]);
      if (nested) return nested;
    }
  }
  return null;
};

const selectNatureFromSpeciesSets = (speciesSets) => {
  if (!speciesSets || typeof speciesSets !== "object") {
    return null;
  }
  const formats = Object.keys(speciesSets);
  if (formats.length === 0) {
    return null;
  }
  const orderedFormats = formats
    .slice()
    .sort((a, b) => {
      const diff = formatWeight(a) - formatWeight(b);
      if (diff !== 0) return diff;
      return String(a).localeCompare(String(b));
    });
  for (const formatKey of orderedFormats) {
    const sets = speciesSets[formatKey];
    if (!sets || typeof sets !== "object") continue;
    const setNames = Object.keys(sets);
    for (const setName of setNames) {
      const set = sets[setName];
      const direct = extractNatureValue(set?.nature);
      if (direct) {
        return {
          nature: direct,
          item: extractItemValue(set) || null,
          format: formatKey,
          setName,
          evs: normalizeEvs(set?.evs) || parseSpreadEvs(set?.spreads),
        };
      }
      const fromSpreads = extractNatureFromSpreads(set?.spreads);
      if (fromSpreads) {
        return {
          nature: fromSpreads,
          item: extractItemValue(set) || null,
          format: formatKey,
          setName,
          evs: normalizeEvs(set?.evs) || parseSpreadEvs(set?.spreads),
        };
      }
      const evs = normalizeEvs(set?.evs) || parseSpreadEvs(set?.spreads);
      if (evs) {
        return {
          nature: null,
          item: extractItemValue(set) || null,
          format: formatKey,
          setName,
          evs,
        };
      }
    }
  }
  return null;
};

const buildSetIndex = (generation, dataset) => {
  if (normalizedSetIndexes.has(generation)) {
    return normalizedSetIndexes.get(generation);
  }
  const index = new Map();
  Object.keys(dataset || {}).forEach((key) => {
    const normalized = normalizeSpeciesName(key);
    if (!index.has(normalized)) {
      index.set(normalized, key);
    }
  });
  normalizedSetIndexes.set(generation, index);
  return index;
};

const findSpeciesKey = (generation, dataset, normalizedAlias) => {
  if (!normalizedAlias) return null;
  const index = buildSetIndex(generation, dataset);
  if (index.has(normalizedAlias)) {
    return index.get(normalizedAlias);
  }
  let candidate = normalizedAlias;
  while (candidate.includes("-")) {
    candidate = candidate.slice(0, candidate.lastIndexOf("-"));
    if (index.has(candidate)) {
      return index.get(candidate);
    }
  }
  return null;
};

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
};

const createResourceFetcher = (cache, pending, buildUrl) => {
  return async (key) => {
    if (cache.has(key)) {
      return cache.get(key);
    }
    if (pending.has(key)) {
      return pending.get(key);
    }
    const url = buildUrl(key);
    const promise = fetchJson(url)
      .then((data) => {
        cache.set(key, data);
        return data;
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, promise);
    return promise;
  };
};

export const fetchSmogonSets = createResourceFetcher(
  setCache,
  setPromises,
  (generation) => `${SMOGON_API_BASE}/sets/${generation}.json`
);

export const fetchSmogonAnalyses = createResourceFetcher(
  analysisCache,
  analysisPromises,
  (generation) => `${SMOGON_API_BASE}/analyses/${generation}.json`
);

export const fetchSmogonStats = createResourceFetcher(
  statsCache,
  statsPromises,
  (format) => `${SMOGON_API_BASE}/stats/${format}.json`
);

export const fetchSmogonTeams = createResourceFetcher(
  teamsCache,
  teamsPromises,
  (format) => `${SMOGON_API_BASE}/teams/${format}.json`
);

export const fetchSmogonFormatsIndex = () =>
  fetchJson(`${SMOGON_API_BASE}/formats/index.json`);

export const fetchSmogonImgsIndex = () =>
  fetchJson(`${SMOGON_API_BASE}/imgs/index.json`);

const buildGenerationOrder = (generationHint) => {
  if (!generationHint) return [...SMOGON_SET_GENERATIONS];
  const normalized = String(generationHint || "")
    .toLowerCase()
    .replace("generation-", "gen");
  if (!SMOGON_SET_GENERATIONS.includes(normalized)) {
    return [...SMOGON_SET_GENERATIONS];
  }
  const preferred = [normalized];
  const remaining = SMOGON_SET_GENERATIONS.filter((gen) => gen !== normalized);
  return [...preferred, ...remaining];
};

export const findRecommendedNature = async (alias, options = {}) => {
  const normalizedAlias = normalizeSpeciesName(alias);
  if (!normalizedAlias) {
    return {
      nature: null,
      item: null,
      generation: null,
      format: null,
      setName: null,
      speciesKey: null,
      searched: [],
    };
  }
  const generationOrder = buildGenerationOrder(options.generationHint);
  const searched = [];
  let lastError = null;
  for (const generation of generationOrder) {
    searched.push(generation);
    try {
      const dataset = await fetchSmogonSets(generation);
      const speciesKey = findSpeciesKey(generation, dataset, normalizedAlias);
      if (!speciesKey) {
        continue;
      }
      const selection = selectNatureFromSpeciesSets(dataset[speciesKey]);
      if (selection) {
        return {
          nature: selection.nature || null,
          item: selection.item || null,
          evs: selection.evs || null,
          generation,
          format: selection.format,
          setName: selection.setName,
          speciesKey,
          searched,
        };
      }
      return {
        nature: null,
        item: null,
        evs: null,
        generation,
        format: null,
        setName: null,
        speciesKey,
        searched,
      };
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
  return {
    nature: null,
    item: null,
    evs: null,
    generation: null,
    format: null,
    setName: null,
    speciesKey: null,
    searched,
  };
};
