import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const ULTRA_BEASTS = new Set([
  "nihilego",
  "buzzwole",
  "pheromosa",
  "xurkitree",
  "celesteela",
  "kartana",
  "guzzlord",
  "poipole",
  "naganadel",
  "stakataka",
  "blacephalon",
]);

const PARADOX_NAMES = new Set([
  "great-tusk",
  "scream-tail",
  "brute-bonnet",
  "flutter-mane",
  "slither-wing",
  "roaring-moon",
  "sandy-shocks",
  "walking-wake",
  "gouging-fire",
  "raging-bolt",
  "iron-treads",
  "iron-bundle",
  "iron-hands",
  "iron-jugulis",
  "iron-moth",
  "iron-thorns",
  "iron-valiant",
  "iron-leaves",
  "iron-boulder",
  "iron-crown",
  "koraidon",
  "miraidon",
  "bloodmoon-ursaluna",
]);

const BABY_NAMES = new Set([
  "pichu",
  "cleffa",
  "igglybuff",
  "togepi",
  "tyrogue",
  "smoochum",
  "elekid",
  "magby",
  "azurill",
  "wynaut",
  "budew",
  "chingling",
  "bonsly",
  "mime-jr",
  "happiny",
  "munchlax",
  "riolu",
  "mantyke",
  "toxel",
]);

const REGIONAL_TOKENS = new Set([
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

const ALL_TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];

const DEX_FILTERS = [
  { key: "national", label: "National", apiNames: ["national"], pad: 4, games: [] },
  {
    key: "kanto",
    label: "Kanto",
    apiNames: ["kanto"],
    pad: 3,
    games: [
      {
        key: "red-blue-yellow",
        label: "Red, Blue & Yellow",
        apiNames: ["kanto"],
        logos: ["red.png", "blue.png", "yellow.png"],
      },
      {
        key: "lets-go",
        label: "Let's Go Pikachu & Let's Go Eevee",
        apiNames: ["letsgo-kanto"],
        logos: ["letsgopikachu.png", "letsgoeevee.png"],
      },
      {
        key: "firered-leafgreen",
        label: "FireRed & LeafGreen",
        apiNames: ["kanto"],
        logos: ["firered.png", "leafgreen.png"],
      },
    ],
  },
  {
    key: "johto",
    label: "Johto",
    apiNames: ["original-johto", "updated-johto"],
    pad: 3,
    games: [
      {
        key: "gold-silver-crystal",
        label: "Gold, Silver & Crystal",
        apiNames: ["original-johto"],
        logos: ["gold.png", "silver.png", "crystal.png"],
      },
      {
        key: "heartgold-soulsilver",
        label: "HeartGold & SoulSilver",
        apiNames: ["updated-johto"],
        logos: ["heartgold.png", "soulsilver.png"],
      },
    ],
  },
  {
    key: "hoenn",
    label: "Hoenn",
    apiNames: ["hoenn", "updated-hoenn"],
    pad: 3,
    games: [
      {
        key: "ruby-sapphire-emerald",
        label: "Ruby, Sapphire & Emerald",
        apiNames: ["hoenn"],
        logos: ["ruby.png", "sapphire.png", "emerald.png"],
      },
      {
        key: "omega-ruby-alpha-sapphire",
        label: "Omega Ruby & Alpha Sapphire",
        apiNames: ["updated-hoenn"],
        logos: ["omegaruby.png", "alphasapphire.png"],
      },
    ],
  },
  {
    key: "sinnoh",
    label: "Sinnoh",
    apiNames: ["original-sinnoh", "extended-sinnoh"],
    pad: 3,
    games: [
      {
        key: "diamond-pearl",
        label: "Diamond & Pearl",
        apiNames: ["original-sinnoh"],
        logos: ["diamond.png", "pearl.png"],
      },
      {
        key: "platinum",
        label: "Platinum",
        apiNames: ["extended-sinnoh"],
        logos: ["platinum.png"],
      },
      {
        key: "brilliant-diamond-shining-pearl",
        label: "Brilliant Diamond & Shining Pearl",
        apiNames: ["original-sinnoh"],
        logos: ["brilliantdiamond.png", "shiningpearl.png"],
      },
    ],
  },
  {
    key: "unova",
    label: "Unova",
    apiNames: ["original-unova", "updated-unova"],
    pad: 3,
    games: [
      {
        key: "black-white",
        label: "Black & White",
        apiNames: ["original-unova"],
        logos: ["black.png", "white.png"],
      },
      {
        key: "black-2-white-2",
        label: "Black 2 & White 2",
        apiNames: ["updated-unova"],
        logos: ["black2.png", "white2.png"],
      },
    ],
  },
  {
    key: "kalos",
    label: "Kalos",
    apiNames: ["kalos-central", "kalos-coastal", "kalos-mountain", "lumiose-city"],
    pad: 3,
    games: [
      {
        key: "x-y",
        label: "X & Y",
        apiNames: ["kalos-central", "kalos-coastal", "kalos-mountain"],
        logos: ["x.png", "y.png"],
      },
      {
        key: "legends-za",
        label: "Legends: Z-A",
        apiNames: ["lumiose-city"],
        logos: ["za.png"],
      },
    ],
  },
  {
    key: "alola",
    label: "Alola",
    apiNames: ["original-alola", "updated-alola"],
    pad: 3,
    games: [
      {
        key: "sun-moon",
        label: "Sun & Moon",
        apiNames: ["original-alola"],
        logos: ["sun.png", "moon.png"],
      },
      {
        key: "ultra-sun-ultra-moon",
        label: "Ultra Sun & Ultra Moon",
        apiNames: ["updated-alola"],
        logos: ["ultrasun.png", "ultramoon.png"],
      },
    ],
  },
  {
    key: "galar",
    label: "Galar",
    apiNames: ["galar"],
    pad: 3,
    games: [
      {
        key: "sword-shield",
        label: "Sword & Shield",
        apiNames: ["galar"],
        logos: ["sword.png", "shield.png"],
      },
    ],
  },
  {
    key: "hisui",
    label: "Hisui",
    apiNames: ["hisui"],
    pad: 3,
    games: [
      {
        key: "legends-arceus",
        label: "Legends: Arceus",
        apiNames: ["hisui"],
        logos: ["arceus.png"],
      },
    ],
  },
  {
    key: "paldea",
    label: "Paldea",
    apiNames: ["paldea"],
    pad: 3,
    games: [
      {
        key: "scarlet-violet",
        label: "Scarlet & Violet",
        apiNames: ["paldea"],
        logos: ["scarlet.png", "violet.png"],
      },
    ],
  },
];

const GAME_LOGO_IMPORTS = import.meta.glob("./assets/game-logos/*", {
  eager: true,
  import: "default",
  query: "?url",
});

const GAME_LOGO_LOOKUP = new Map(
  Object.entries(GAME_LOGO_IMPORTS).map(([path, url]) => {
    const parts = path.split("/");
    return [parts[parts.length - 1], url];
  })
);

const NATIONAL_GAME_ORDER = [
  "red-blue-yellow",
  "gold-silver-crystal",
  "ruby-sapphire-emerald",
  "firered-leafgreen",
  "diamond-pearl",
  "platinum",
  "heartgold-soulsilver",
  "black-white",
  "black-2-white-2",
  "x-y",
  "omega-ruby-alpha-sapphire",
  "sun-moon",
  "ultra-sun-ultra-moon",
  "lets-go",
  "sword-shield",
  "brilliant-diamond-shining-pearl",
  "legends-arceus",
  "scarlet-violet",
  "legends-za",
];

const GAME_METADATA = new Map();
for (const cfg of DEX_FILTERS) {
  for (const game of cfg.games || []) {
    if (!GAME_METADATA.has(game.key)) {
      GAME_METADATA.set(game.key, {
        ...game,
        dexKey: cfg.key,
        pad: cfg.pad ?? 3,
      });
    }
  }
}

const ALL_GAME_OPTIONS = Array.from(GAME_METADATA.values());

const NATIONAL_GAME_OPTIONS = [
  ...NATIONAL_GAME_ORDER.map((key) => GAME_METADATA.get(key)).filter(Boolean),
  ...ALL_GAME_OPTIONS.filter((game) => !NATIONAL_GAME_ORDER.includes(game.key)),
];

const GAME_LOOKUP = new Map(GAME_METADATA);

const DEX_LOOKUP = new Map(DEX_FILTERS.map((cfg) => [cfg.key, cfg]));
const LEGENDARY_NAMES = new Set([
  "articuno",
  "articuno-galar",
  "zapdos",
  "zapdos-galar",
  "moltres",
  "moltres-galar",
  "mewtwo",
  "mewtwo-mega-x",
  "mewtwo-mega-y",
  "raikou",
  "entei",
  "suicune",
  "lugia",
  "ho-oh",
  "regirock",
  "regice",
  "registeel",
  "latias",
  "latias-mega",
  "latios",
  "latios-mega",
  "kyogre",
  "kyogre-primal",
  "groudon",
  "groudon-primal",
  "rayquaza",
  "rayquaza-mega",
  "uxie",
  "mesprit",
  "azelf",
  "dialga",
  "dialga-origin",
  "palkia",
  "palkia-origin",
  "heatran",
  "regigigas",
  "giratina-altered",
  "giratina-origin",
  "cresselia",
  "cobalion",
  "terrakion",
  "virizion",
  "tornadus-incarnate",
  "tornadus-therian",
  "thundurus-incarnate",
  "thundurus-therian",
  "landorus-incarnate",
  "landorus-therian",
  "reshiram",
  "zekrom",
  "kyurem",
  "kyurem-black",
  "kyurem-white",
  "xerneas",
  "yveltal",
  "zygarde",
  "zygarde-50",
  "zygarde-10",
  "zygarde-10-power-construct",
  "zygarde-50-power-construct",
  "zygarde-complete",
  "zygarde-mega",
  "type-null",
  "silvally",
  "tapu-koko",
  "tapu-lele",
  "tapu-bulu",
  "tapu-fini",
  "cosmog",
  "cosmoem",
  "solgaleo",
  "lunala",
  "necrozma",
  "necrozma-dawn",
  "necrozma-dusk",
  "necrozma-ultra",
  "zacian",
  "zacian-crowned",
  "zamazenta",
  "zamazenta-crowned",
  "eternatus",
  "eternatus-eternamax",
  "kubfu",
  "urshifu-single-strike",
  "urshifu-rapid-strike",
  "urshifu-single-strike-gmax",
  "urshifu-rapid-strike-gmax",
  "regieleki",
  "regidrago",
  "glastrier",
  "spectrier",
  "calyrex",
  "calyrex-ice",
  "calyrex-shadow",
  "enamorus-incarnate",
  "enamorus-therian",
  "koraidon",
  "miraidon",
  "wo-chien",
  "chien-pao",
  "ting-lu",
  "chi-yu",
  "okidogi",
  "munkidori",
  "fezandipiti",
  "ogerpon",
  "ogerpon-wellspring-mask",
  "ogerpon-hearthflame-mask",
  "ogerpon-cornerstone-mask",
  "terapagos",
  "terapagos-terastal",
  "terapagos-stellar",
]);

const MYTHICAL_NAMES = new Set([
  "mew",
  "celebi",
  "jirachi",
  "deoxys-normal",
  "deoxys-attack",
  "deoxys-defense",
  "deoxys-speed",
  "phione",
  "manaphy",
  "darkrai",
  "shaymin-land",
  "shaymin-sky",
  "arceus",
  "victini",
  "keldeo-ordinary",
  "keldeo-resolute",
  "meloetta-aria",
  "meloetta-pirouette",
  "genesect",
  "diancie",
  "diancie-mega",
  "hoopa",
  "hoopa-unbound",
  "volcanion",
  "magearna",
  "magearna-original",
  "marshadow",
  "zeraora",
  "meltan",
  "melmetal",
  "melmetal-gmax",
  "zarude",
  "zarude-dada",
  "pecharunt",
]);

const SPECIAL_FILTERS = ["Legendary", "Mythical", "Mega", "Primal", "Ultra Beast", "Paradox", "Gigantamax", "Baby"];
const SPECIAL_TAG_META = new Map([
  ["Legendary", { short: "LEG", className: "legendary" }],
  ["Mythical", { short: "MYTH", className: "mythical" }],
  ["Mega", { short: "MEGA", className: "mega" }],
  ["Primal", { short: "PRIM", className: "primal" }],
  ["Ultra Beast", { short: "UB", className: "ultra-beast" }],
  ["Paradox", { short: "PDX", className: "paradox" }],
  ["Gigantamax", { short: "GMAX", className: "gigantamax" }],
  ["Baby", { short: "BABY", className: "baby" }],
]);

const humanizeName = (s) => String(s || "").replace(/-/g, " ");

const deriveSpecialTags = (name) => {
  const lower = String(name || "").toLowerCase();
  if (!lower) return [];
  const tags = [];
  if (LEGENDARY_NAMES.has(lower)) tags.push("Legendary");
  if (MYTHICAL_NAMES.has(lower)) tags.push("Mythical");
  if (lower.includes("-mega") || lower.startsWith("mega-")) tags.push("Mega");
  if (lower.includes("-primal")) tags.push("Primal");
  if (ULTRA_BEASTS.has(lower)) tags.push("Ultra Beast");
  if (PARADOX_NAMES.has(lower)) tags.push("Paradox");
  if (lower.includes("-gmax")) tags.push("Gigantamax");
  if (BABY_NAMES.has(lower)) tags.push("Baby");
  return tags;
};

const isRegionalFormName = (name) => {
  const parts = String(name || "").toLowerCase().split("-");
  return parts.some((part) => REGIONAL_TOKENS.has(part));
};

const getIdFromUrl = (url) => {
  const parts = (url || "").split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
};

const getIdNumberFromUrl = (url) => {
  const id = Number(getIdFromUrl(url));
  return Number.isNaN(id) ? null : id;
};

const FORM_ORDER = new Map([
  ["Default", 0],
  ["Regional", 1],
  ["Mega", 2],
  ["Primal", 3],
  ["Ultra Beast", 4],
  ["Paradox", 5],
  ["Gigantamax", 6],
  ["Baby", 7],
]);

const getFormPriority = (entry) => {
  if (!entry?.tags || entry.tags.length === 0) return 99;
  const priorities = entry.tags.map((tag) => FORM_ORDER.get(tag) ?? 99);
  return Math.min(...priorities);
};

const compareForms = (a, b) => {
  const priorityA = getFormPriority(a);
  const priorityB = getFormPriority(b);
  if (priorityA !== priorityB) return priorityA - priorityB;
  if (a?.isDefault !== b?.isDefault) return a?.isDefault ? -1 : 1;
  if (a?.isCurrent !== b?.isCurrent) return a?.isCurrent ? -1 : 1;
  const nameA = a?.displayName || a?.name || "";
  const nameB = b?.displayName || b?.name || "";
  return nameA.localeCompare(nameB);
};

const mapVarietiesToForms = (speciesData, { currentId = null, includeDefault = true } = {}) => {
  if (!speciesData) return [];
  const currentIdStr = currentId != null && currentId !== "" ? String(currentId) : null;
  const baseSpeciesId = speciesData?.id != null ? String(speciesData.id) : null;
  const entries =
    (speciesData?.varieties || [])
      .map((variant) => {
        const formName = variant?.pokemon?.name;
        const formUrl = variant?.pokemon?.url;
        if (!formName || !formUrl) return null;
        const formId = getIdFromUrl(formUrl);
        if (!formId) return null;
        const tags = new Set(deriveSpecialTags(formName));
        if (isRegionalFormName(formName)) tags.add("Regional");
        if (variant.is_default) tags.add("Default");
        const orderedTags = Array.from(tags).sort((a, b) => a.localeCompare(b));
        return {
          id: formId,
          name: formName,
          displayName: humanizeName(formName),
          isDefault: Boolean(variant.is_default),
          tags: orderedTags,
          isCurrent: currentIdStr != null && String(formId) === currentIdStr,
          baseSpeciesId,
        };
      })
      .filter(Boolean) || [];

  entries.sort(compareForms);

  return includeDefault ? entries : entries.filter((entry) => !entry.isDefault);
};

function App() {
  const [pokemon, setPokemon] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState(() => new Set());
  const [selectedTags, setSelectedTags] = useState(() => new Set());
  const [selectedDex, setSelectedDex] = useState("national");
  const [selectedGame, setSelectedGame] = useState(null);
  const [dexIndexes, setDexIndexes] = useState(() => new Map());
  const [gameIndexes, setGameIndexes] = useState(() => new Map());
  const typeIndexRef = useRef(new Map()); // type -> Set(names)
  const specialTagCacheRef = useRef(new Map()); // name -> cached tag array
  const gameFiltersRef = useRef(null);
  const pokedexCacheRef = useRef(new Map());
  const pokedexPromiseRef = useRef(new Map());
  const [bootParam, setBootParam] = useState(() => {
    const u = new URL(window.location.href);
    return u.searchParams.get("p");
  });

  const getTagsForName = (name) => {
    const lower = String(name || "").toLowerCase();
    if (!lower) return [];
    const cached = specialTagCacheRef.current.get(lower);
    if (cached) return cached;
    const computed = Object.freeze(deriveSpecialTags(name));
    specialTagCacheRef.current.set(lower, computed);
    return computed;
  };

  const speciesIdLookup = useMemo(() => {
    const map = new Map();
    for (const entry of pokemon) {
      const idStr = getIdFromUrl(entry?.url);
      const idNum = Number(idStr);
      if (!idStr || Number.isNaN(idNum) || idNum >= 10000) continue;
      const name = String(entry?.name || "").toLowerCase();
      if (!name) continue;
      if (!map.has(name)) {
        map.set(name, idNum);
      }
    }
    return map;
  }, [pokemon]);

  const pokemonIdLookup = useMemo(() => {
    const map = new Map();
    for (const entry of pokemon) {
      const idStr = getIdFromUrl(entry?.url);
      const idNum = Number(idStr);
      if (!idStr || Number.isNaN(idNum)) continue;
      map.set(idNum, String(entry?.name || "").toLowerCase());
    }
    return map;
  }, [pokemon]);

  const resolveSpeciesId = useCallback(
    (name, fallback = null) => {
      const lower = String(name || "").toLowerCase();
      if (!lower) return fallback;
      if (speciesIdLookup.has(lower)) {
        return speciesIdLookup.get(lower);
      }
      const parts = lower.split("-");
      while (parts.length > 1) {
        parts.pop();
        const candidate = parts.join("-");
        if (speciesIdLookup.has(candidate)) {
          return speciesIdLookup.get(candidate);
        }
      }
      return fallback;
    },
    [speciesIdLookup]
  );

  useEffect(() => {
    fetch("https://pokeapi.co/api/v2/pokemon?limit=100000&offset=0")
      .then((r) => r.json())
      .then((data) => setPokemon(data.results || []));
  }, []);

  const loadEntryMap = useCallback(
    async (apiNames = []) => {
      const names = Array.from(new Set((apiNames || []).filter(Boolean)));
      if (names.length === 0) {
        return new Map();
      }
      const cacheKey = names.join("|");
      if (pokedexCacheRef.current.has(cacheKey)) {
        return pokedexCacheRef.current.get(cacheKey);
      }
      if (pokedexPromiseRef.current.has(cacheKey)) {
        return pokedexPromiseRef.current.get(cacheKey);
      }
      const promise = (async () => {
        try {
          const sources = new Map();
          for (const apiName of names) {
            const response = await queuedFetch(`https://pokeapi.co/api/v2/pokedex/${apiName}`);
            if (!response?.ok) {
              throw new Error(`Failed to load pokedex/${apiName}: ${response?.status} ${response?.statusText}`);
            }
            const data = await response.json();
            sources.set(apiName, data);
          }
          const finalMap = new Map();
          const seen = new Set();
          let counter = 1;
          const multipleLists = names.length > 1;
          for (const apiName of names) {
            const data = sources.get(apiName);
            if (!data) continue;
            const entries = data.pokemon_entries || [];
            for (const entry of entries) {
              const idNum = getIdNumberFromUrl(entry.pokemon_species?.url);
              if (idNum == null || seen.has(idNum)) continue;
              seen.add(idNum);
              let number;
              if (multipleLists) {
                number = counter++;
              } else {
                number = entry.entry_number;
                counter = Math.max(counter, number + 1);
              }
              finalMap.set(idNum, number);
            }
          }
          pokedexCacheRef.current.set(cacheKey, finalMap);
          return finalMap;
        } finally {
          pokedexPromiseRef.current.delete(cacheKey);
        }
      })();
      pokedexPromiseRef.current.set(cacheKey, promise);
      return promise;
    },
    []
  );

  useEffect(() => {
    if (selectedDex === "national") {
      setSelectedGame(null);
      return;
    }
    const cfg = DEX_LOOKUP.get(selectedDex);
    if (!cfg?.games || cfg.games.length === 0) {
      setSelectedGame(null);
      return;
    }
    setSelectedGame((prev) => {
      if (prev && cfg.games.some((game) => game.key === prev)) {
        return prev;
      }
      return cfg.games[0]?.key ?? null;
    });
  }, [selectedDex]);

  useEffect(() => {
    const cfg = DEX_LOOKUP.get(selectedDex);
    if (!cfg || selectedDex === "national") return;
    if (dexIndexes.has(selectedDex)) return;
    let cancelled = false;
    const loadDex = async () => {
      try {
        const combined = await loadEntryMap(cfg.apiNames || []);
        const gameEntries = new Map();
        await Promise.all(
          (cfg.games || []).map(async (game) => {
            const entryMap = await loadEntryMap(
              (game.apiNames && game.apiNames.length > 0) ? game.apiNames : cfg.apiNames
            );
            if (!cancelled) {
              gameEntries.set(game.key, {
                key: game.key,
                label: game.label,
                entryMap,
              });
            }
          })
        );
        if (cancelled) return;
        setDexIndexes((prev) => {
          if (prev.has(selectedDex)) return prev;
          const next = new Map(prev);
          next.set(selectedDex, { combined, games: gameEntries });
          return next;
        });
        setGameIndexes((prev) => {
          const next = new Map(prev);
          for (const [gameKey, info] of gameEntries) {
            next.set(gameKey, info.entryMap);
          }
          return next;
        });
      } catch (err) {
        console.error(`Failed to load dex data for ${selectedDex}`, err);
      }
    };
    loadDex();
    return () => {
      cancelled = true;
    };
  }, [selectedDex, dexIndexes, loadEntryMap]);

  useEffect(() => {
    if (!selectedGame) return;
    if (gameIndexes.has(selectedGame)) return;
    const cfg = GAME_LOOKUP.get(selectedGame);
    if (!cfg) return;
    let cancelled = false;
    const loadGame = async () => {
      try {
        const entryMap = await loadEntryMap(cfg.apiNames || []);
        if (cancelled) return;
        setGameIndexes((prev) => {
          if (prev.has(selectedGame)) return prev;
          const next = new Map(prev);
          next.set(selectedGame, entryMap);
          return next;
        });
      } catch (err) {
        console.error(`Failed to load dex data for ${selectedGame}`, err);
      }
    };
    loadGame();
    return () => {
      cancelled = true;
    };
  }, [selectedGame, gameIndexes, loadEntryMap]);

  // Apply URL param selection after data loads
  useEffect(() => {
    if (!pokemon.length) return;
    if (!bootParam) return;
    const id = String(bootParam);
    const match = pokemon.find((p) => p.url.split("/").filter(Boolean).pop() === id);
    const name = match?.name;
    const url = match?.url || `https://pokeapi.co/api/v2/pokemon/${id}`;
    setSelected({ id, name: name || `pokemon-${id}`, url });
    setBootParam(null);
  }, [pokemon, bootParam]);

  // Handle back/forward navigation to sync selection
  useEffect(() => {
    const onPop = () => {
      const u = new URL(window.location.href);
      const pid = u.searchParams.get("p");
      if (!pid) {
        setSelected(null);
        return;
      }
      const id = String(pid);
      const match = pokemon.find((p) => p.url.split("/").filter(Boolean).pop() === id);
      const name = match?.name;
      const url = match?.url || `https://pokeapi.co/api/v2/pokemon/${id}`;
      setSelected({ id, name: name || `pokemon-${id}`, url });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [pokemon]);

  const selectPokemon = (id, name, url) => {
    const u = new URL(window.location.href);
    u.searchParams.set("p", id);
    window.history.pushState({}, "", u);
    setSelected({ id, name, url });
  };

  const clearSelection = () => {
    const u = new URL(window.location.href);
    u.searchParams.delete("p");
    window.history.pushState({}, "", u);
    setSelected(null);
  };

  const filteredLists = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/[^0-9]/g, "");
    const hasTypeFilter = selectedTypes.size > 0;
    const requiredTags = Array.from(selectedTags);
    const hasTagFilter = requiredTags.length > 0;
    const dexData = selectedDex === "national" ? null : dexIndexes.get(selectedDex);
    if (selectedDex !== "national" && !dexData) {
      return [];
    }
    const combinedMap = selectedDex === "national" ? null : dexData?.combined ?? null;
    const regionGameEntryMap =
      selectedDex !== "national" && selectedGame ? dexData?.games?.get(selectedGame)?.entryMap ?? null : null;
    const nationalGameEntryMap =
      selectedDex === "national" && selectedGame ? gameIndexes.get(selectedGame) ?? null : null;
    if (selectedDex === "national" && selectedGame && !nationalGameEntryMap) {
      return [];
    }
    const activeEntryMap =
      selectedDex === "national" ? nationalGameEntryMap : regionGameEntryMap ?? combinedMap;
    if (selectedDex !== "national" && !activeEntryMap) {
      return [];
    }

    let typeIntersection = null;
    if (hasTypeFilter) {
      const sets = [];
      for (const t of selectedTypes) {
        const set = typeIndexRef.current.get(t);
        if (!set) {
          return [];
        }
        sets.push(set);
      }
      sets.sort((a, b) => a.size - b.size);
      typeIntersection = new Set(sets[0]);
      for (let i = 1; i < sets.length; i++) {
        const next = sets[i];
        typeIntersection = new Set([...typeIntersection].filter((n) => next.has(n)));
        if (typeIntersection.size === 0) break;
      }
    }

    const regularMatches = [];
    const megaGmaxMatches = [];

    for (const p of pokemon) {
      const idStr = getIdFromUrl(p.url);
      if (!idStr) continue;
      const idNum = Number(idStr);
      if (Number.isNaN(idNum)) continue;
      const tags = getTagsForName(p.name);
      const speciesId = resolveSpeciesId(p.name, idNum < 10000 ? idNum : null);
      const isSpecialForm = idNum >= 10000;
      const hasSpecialTag = tags.some((tag) => SPECIAL_FILTERS.includes(tag));
      const isMegaOrGmax = tags.includes("Mega") || tags.includes("Gigantamax");
      if (isSpecialForm && !hasSpecialTag) {
        continue;
      }
      if (activeEntryMap) {
        const lookupId = speciesId ?? (idNum < 10000 ? idNum : null);
        if (lookupId != null) {
          if (!activeEntryMap.has(lookupId)) {
            if (!(isSpecialForm && hasSpecialTag && speciesId == null)) {
              continue;
            }
          }
        } else if (!(isSpecialForm && hasSpecialTag)) {
          continue;
        }
      }
      if (hasTypeFilter && (!typeIntersection || !typeIntersection.has(p.name))) {
        continue;
      }
      if (hasTagFilter) {
        let hasAllTags = true;
        for (const tag of requiredTags) {
          if (!tags.includes(tag)) {
            hasAllTags = false;
            break;
          }
        }
        if (!hasAllTags) continue;
      }

      if (q || qDigits) {
        let matchedQuery = false;
        const lower = p.name.toLowerCase();
        if (q && lower.includes(q)) {
          matchedQuery = true;
        } else if (qDigits) {
          const idPad3 = idStr.padStart(3, "0");
          const idPad4 = idStr.padStart(4, "0");
          if (idStr.includes(qDigits) || idPad3.includes(qDigits) || idPad4.includes(qDigits)) {
            matchedQuery = true;
          }
        }
        if (!matchedQuery) continue;
      }

      if (isMegaOrGmax) {
        megaGmaxMatches.push({ entry: p, idNum, speciesId });
      } else {
        regularMatches.push({ entry: p, idNum, speciesId });
      }
    }

    const sortMatches = (matches) => {
      if (matches.length === 0) return;
      if (activeEntryMap) {
        matches.sort((a, b) => {
          const speciesA = a.speciesId ?? (a.idNum < 10000 ? a.idNum : null);
          const speciesB = b.speciesId ?? (b.idNum < 10000 ? b.idNum : null);
          const lookupA = speciesA ?? a.idNum;
          const lookupB = speciesB ?? b.idNum;
          const aEntry = activeEntryMap.get(lookupA);
          const bEntry = activeEntryMap.get(lookupB);
          if (aEntry != null && bEntry != null && aEntry !== bEntry) {
            return aEntry - bEntry;
          }
          if (aEntry != null && bEntry == null) return -1;
          if (aEntry == null && bEntry != null) return 1;
          const combinedA = combinedMap?.get(lookupA);
          const combinedB = combinedMap?.get(lookupB);
          if (combinedA != null && combinedB != null && combinedA !== combinedB) {
            return combinedA - combinedB;
          }
          if (combinedA != null && combinedB == null) return -1;
          if (combinedA == null && combinedB != null) return 1;
          if (lookupA !== lookupB) return lookupA - lookupB;
          return a.idNum - b.idNum;
        });
      } else {
        matches.sort((a, b) => {
          const lookupA = (a.speciesId ?? (a.idNum < 10000 ? a.idNum : null)) ?? a.idNum;
          const lookupB = (b.speciesId ?? (b.idNum < 10000 ? b.idNum : null)) ?? b.idNum;
          if (lookupA !== lookupB) return lookupA - lookupB;
          return a.idNum - b.idNum;
        });
      }
    };

    sortMatches(regularMatches);
    sortMatches(megaGmaxMatches);

    return {
      primary: regularMatches.map((item) => item.entry),
      megaGigantamax: megaGmaxMatches.map((item) => item.entry),
    };
  }, [pokemon, query, selectedTypes, selectedTags, selectedDex, selectedGame, dexIndexes, gameIndexes, resolveSpeciesId]);

  const regularFiltered = filteredLists.primary ?? [];
  const megaGigantamaxFiltered = filteredLists.megaGigantamax ?? [];

  const formatDexNumber = useCallback(
    (value) => {
      const idNum = Number(value);
      if (!Number.isFinite(idNum)) return "-";
      const name = pokemonIdLookup.get(idNum);
      const speciesId = resolveSpeciesId(name, idNum);
      const lookupId = speciesId ?? idNum;
      const gameCfg = selectedGame ? GAME_LOOKUP.get(selectedGame) : null;
      const padSource =
        selectedDex === "national" && gameCfg?.dexKey
          ? DEX_LOOKUP.get(gameCfg.dexKey) ?? DEX_LOOKUP.get(selectedDex)
          : DEX_LOOKUP.get(selectedDex);
      const pad = Math.max(1, padSource?.pad ?? 3);
      if (selectedDex === "national") {
        if (!selectedGame) {
          return `#${String(lookupId).padStart(pad, "0")}`;
        }
        const entryMap = gameIndexes.get(selectedGame);
        if (!entryMap) return "-";
        const entry = entryMap.get(lookupId);
        if (entry == null) return "-";
        return `#${String(entry).padStart(pad, "0")}`;
      }
      const dexData = dexIndexes.get(selectedDex);
      if (!dexData) return "-";
      const gameEntryMap = selectedGame ? dexData.games?.get(selectedGame)?.entryMap : null;
      const entryMap = gameEntryMap ?? dexData.combined;
      if (!entryMap) return "-";
      const entry = entryMap.get(lookupId);
      if (entry == null) return "-";
      return `#${String(entry).padStart(pad, "0")}`;
    },
    [dexIndexes, selectedDex, selectedGame, gameIndexes, pokemonIdLookup, resolveSpeciesId]
  );

  const selectedDexNumber = useMemo(() => {
    if (!selected) return null;
    return formatDexNumber(selected.id);
  }, [selected, formatDexNumber]);

  // Ensure we have indexes for currently selected types so include filtering is accurate
  useEffect(() => {
    for (const t of selectedTypes) {
      if (!typeIndexRef.current.get(t)) {
        fetch(`https://pokeapi.co/api/v2/type/${t}`)
          .then((r) => r.json())
          .then((data) => {
            const items = new Set((data.pokemon || []).map((x) => x.pokemon.name));
            typeIndexRef.current.set(t, items);
          })
          .catch(() => {});
      }
    }
  }, [selectedTypes]);

  // Prefetch all type indexes once so first selection works immediately
  useEffect(() => {
    let cancelled = false;
    const load = async (t) => {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/type/${t}`);
        const data = await res.json();
        const items = new Set((data.pokemon || []).map((x) => x.pokemon.name));
        if (!cancelled) {
          typeIndexRef.current.set(t, items);
          // Nudge a re-render so filtering recomputes when the cache fills
          setSelectedTypes((prev) => new Set(prev));
        }
      } catch {}
    };
    ALL_TYPES.forEach((t) => {
      if (!typeIndexRef.current.get(t)) {
        load(t);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDexConfig = DEX_LOOKUP.get(selectedDex);
  const availableGames = selectedDex === "national" ? NATIONAL_GAME_OPTIONS : selectedDexConfig?.games || [];
  const showGameFilters = availableGames.length > 0;

  useEffect(() => {
    const el = gameFiltersRef.current;
    if (!el) return;
    const onWheel = (event) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      el.scrollBy({ left: event.deltaY * 2, behavior: "smooth" });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [selectedDex, availableGames.length]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container">
          <h1 className="title">Pokedex</h1>
          <p className="subtitle">Search and explore every Pokemon</p>
          <input
            className="search"
            placeholder="Search Pokemon"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filters-stack">
            <div className="filters-row">
              <div className="type-filters">
                {ALL_TYPES.map((t) => (
                  <span
                    key={t}
                    className={`type-chip type-${t}${selectedTypes.has(t) ? "" : " off"}`}
                    role="button"
                    title={`Toggle ${t}`}
                    onClick={() => {
                      setSelectedTypes((prev) => {
                        const next = new Set(prev);
                        if (next.has(t)) {
                          next.delete(t);
                        } else {
                          // turning on: ensure index exists
                          if (!typeIndexRef.current.get(t)) {
                            fetch(`https://pokeapi.co/api/v2/type/${t}`)
                              .then((r) => r.json())
                              .then((data) => {
                                const items = new Set((data.pokemon || []).map((x) => x.pokemon.name));
                                typeIndexRef.current.set(t, items);
                              })
                              .catch(() => {});
                          }
                          next.add(t);
                        }
                        return next;
                      });
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="type-chip neutral-chip reset-chip"
                onClick={() => {
                  setSelectedTypes(new Set());
                  setSelectedTags(new Set());
                  setSelectedDex("national");
                  setSelectedGame(null);
                  setQuery("");
                  clearSelection();
                }}
              >
                Reset
              </button>
            </div>
            <div className="filters-row special-filters-row">
              <div className="special-filters">
                {SPECIAL_FILTERS.map((tag) => {
                  const isOn = selectedTags.has(tag);
                  const meta = SPECIAL_TAG_META.get(tag);
                  const classNames = ["type-chip", "special-filter-chip"];
                  if (meta?.className) classNames.push(meta.className);
                  if (isOn) classNames.push("is-on");
                  const buttonClassName = classNames.join(" ");
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={buttonClassName}
                      onClick={() => {
                        setSelectedTags((prev) => {
                          const next = new Set(prev);
                          if (next.has(tag)) {
                            next.delete(tag);
                          } else {
                            next.add(tag);
                          }
                          return next;
                        });
                      }}
                      aria-pressed={isOn}
                      title={`Toggle ${tag}`}
                    >
                      {tag}
                    </button>
                  );
                })} 
              </div>
            </div>
            <div className="filters-row dex-filters-row">
              <div className="dex-filters">
                {DEX_FILTERS.map((dex) => {
                  const isActive = dex.key === selectedDex;
                  return (
                    <button
                      key={dex.key}
                      type="button"
                      className={`type-chip neutral-chip${isActive ? " is-on" : ""}`}
                      onClick={() => {
                        setSelectedGame(dex.games?.[0]?.key ?? null);
                        setSelectedDex(dex.key);
                        clearSelection();
                      }}
                      aria-pressed={isActive}
                      title={`Use ${dex.label} Pokedex`}
                    >
                      {dex.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        {showGameFilters && (
          <div className="game-filters-row">
            <span className="game-filters-label">Games</span>
            <div className="game-filters-controls">
              <div
                className={`game-filters${selectedDex === "national" ? " game-filters--left" : ""}`}
                ref={gameFiltersRef}
              >
                {availableGames.map((game) => {
                  const isOn = game.key === selectedGame;
                  const logoUrls = (game.logos || [])
                    .map((logo) => GAME_LOGO_LOOKUP.get(logo))
                    .filter(Boolean);
                  return (
                    <button
                      key={game.key}
                      type="button"
                      className={`filter-chip game-chip${isOn ? " is-on" : ""}`}
                      onClick={() => {
                        if (selectedGame === game.key) {
                          if (selectedDex === "national") {
                            setSelectedGame(null);
                            clearSelection();
                          }
                          return;
                        }
                        setSelectedGame(game.key);
                        clearSelection();
                      }}
                      aria-pressed={isOn}
                      aria-label={game.label}
                    >
                      {logoUrls.length > 0 && (
                        <span className="game-chip-logos" aria-hidden="true">
                          {logoUrls.map((src) => (
                            <img key={src} src={src} alt="" className="game-chip-logo" />
                          ))}
                        </span>
                      )}
                      <span className="game-chip-label">{game.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {selected ? (
          <section className="content split">
            <div className="list-panel">
              <div className="list-scroll">
                {regularFiltered.length > 0 && (
                  <div className="list">
                    {regularFiltered.map((p) => {
                      const parts = p.url.split("/").filter(Boolean);
                      const id = parts[parts.length - 1];
                      const idNum = Number(id);
                      const dexDisplay = Number.isNaN(idNum) ? undefined : formatDexNumber(idNum);
                      return (
                        <PokemonCard
                          key={p.name}
                          id={id}
                          name={p.name}
                          url={p.url}
                          onSelect={() => selectPokemon(id, p.name, p.url)}
                          selected={String(selected.id) === String(id)}
                          dexNumber={dexDisplay}
                        />
                      );
                    })}
                  </div>
                )}
                {megaGigantamaxFiltered.length > 0 && (
                  <div className="list-special">
                    {regularFiltered.length > 0 && <div className="list-divider" role="separator" />}
                    <h3 className="list-subheading">Mega &amp; Gigantamax Forms</h3>
                    <div className="list">
                      {megaGigantamaxFiltered.map((p) => {
                        const parts = p.url.split("/").filter(Boolean);
                        const id = parts[parts.length - 1];
                        const idNum = Number(id);
                        const dexDisplay = Number.isNaN(idNum) ? undefined : formatDexNumber(idNum);
                        return (
                          <PokemonCard
                            key={p.name}
                            id={id}
                            name={p.name}
                            url={p.url}
                            onSelect={() => selectPokemon(id, p.name, p.url)}
                            selected={String(selected.id) === String(id)}
                            dexNumber={dexDisplay}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                {regularFiltered.length === 0 && megaGigantamaxFiltered.length === 0 && (
                  <div className="list-empty">No Pokémon found.</div>
                )}
              </div>
            </div>
            <ErrorBoundary fallback={<button className="toggle-btn" onClick={clearSelection}>Close</button>}>
            <DetailPanel
              selected={selected}
              onClose={clearSelection}
              onSelectPokemon={selectPokemon}
              onActivateType={(typename) => {
                // Activate top-level type filter and close detail
                const t = String(typename || "").toLowerCase();
                if (!t) return;
                if (!typeIndexRef.current.get(t)) {
                  fetch(`https://pokeapi.co/api/v2/type/${t}`)
                    .then((r) => r.json())
                    .then((data) => {
                      const items = new Set((data.pokemon || []).map((x) => x.pokemon.name));
                      typeIndexRef.current.set(t, items);
                    })
                    .catch(() => {});
                }
                setSelectedTypes(new Set([t]));
                clearSelection();
              }}
              dexNumber={selectedDexNumber}
            />
            </ErrorBoundary>
          </section>
        ) : (
          <>
            {regularFiltered.length > 0 && (
              <section className="grid">
                {regularFiltered.map((p) => {
                  const parts = p.url.split("/").filter(Boolean);
                  const id = parts[parts.length - 1];
                  const idNum = Number(id);
                  const dexDisplay = Number.isNaN(idNum) ? undefined : formatDexNumber(idNum);
                  return (
                    <PokemonCard
                      key={p.name}
                      id={id}
                      name={p.name}
                      url={p.url}
                      onSelect={() => selectPokemon(id, p.name, p.url)}
                      dexNumber={dexDisplay}
                    />
                  );
                })}
              </section>
            )}
            {megaGigantamaxFiltered.length > 0 && (
              <>
                <h2 className="grid-subheading">Mega &amp; Gigantamax Forms</h2>
                <section className="grid grid-special">
                  {megaGigantamaxFiltered.map((p) => {
                    const parts = p.url.split("/").filter(Boolean);
                    const id = parts[parts.length - 1];
                    const idNum = Number(id);
                    const dexDisplay = Number.isNaN(idNum) ? undefined : formatDexNumber(idNum);
                    return (
                      <PokemonCard
                        key={p.name}
                        id={id}
                        name={p.name}
                        url={p.url}
                        onSelect={() => selectPokemon(id, p.name, p.url)}
                        dexNumber={dexDisplay}
                      />
                    );
                  })}
                </section>
              </>
            )}
            {regularFiltered.length === 0 && megaGigantamaxFiltered.length === 0 && (
              <section className="grid">
                <div className="dex-loading">No Pokémon found.</div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const detailsCache = new Map();
const abilityCache = new Map();

// Simple global fetch queue to limit concurrent requests
let IN_FLIGHT = 0;
const MAX_CONCURRENT = 6;
const FETCH_QUEUE = [];
function runNext() {
  if (IN_FLIGHT >= MAX_CONCURRENT) return;
  const task = FETCH_QUEUE.shift();
  if (!task) return;
  IN_FLIGHT++;
  task()
    .catch(() => {})
    .finally(() => {
      IN_FLIGHT = Math.max(0, IN_FLIGHT - 1);
      runNext();
    });
}
function queuedFetch(url, init) {
  return new Promise((resolve, reject) => {
    const exec = () => fetch(url, init).then(resolve, reject);
    FETCH_QUEUE.push(exec);
    runNext();
  });
}

const SPRITE_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='12' fill='%23202631'/><text x='50%' y='52%' text-anchor='middle' dominant-baseline='middle' font-family='Arial' font-size='12' fill='%23cbd5f5'>No Sprite</text></svg>";

const buildSpriteSources = (id) => {
  const clean = String(id ?? "").trim();
  const sources = [];
  if (clean) {
    sources.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${clean}.png`);
    sources.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${clean}.png`);
    sources.push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${clean}.png`);
  }
  sources.push(SPRITE_PLACEHOLDER);
  return sources;
};

function SpriteImage({ id, alt, onError, ...rest }) {
  const sources = useMemo(() => buildSpriteSources(id), [id]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [id]);

  const handleError = (event) => {
    setIndex((prev) => {
      const next = prev + 1;
      if (next < sources.length) {
        return next;
      }
      if (onError) {
        onError(event);
      }
      return prev;
    });
  };

  const src = sources[Math.min(index, sources.length - 1)];
  return <img {...rest} alt={alt} src={src} onError={handleError} />;
}

function useInView(options) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      options || { root: null, rootMargin: "200px 0px", threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options]);
  return [ref, inView];
}

function PokemonCard({ name, id, url, onSelect, selected, dexNumber }) {
  const [types, setTypes] = useState(detailsCache.get(id)?.types || []);
  const [cardRef, inView] = useInView({ root: null, rootMargin: "300px 0px", threshold: 0.01 });
  const specialTags = useMemo(() => {
    const tags = deriveSpecialTags(name) || [];
    return tags
      .map((tag) => {
        const meta = SPECIAL_TAG_META.get(tag);
        if (!meta) return null;
        const order = SPECIAL_FILTERS.indexOf(tag);
        return {
          key: tag,
          tag,
          short: meta.short,
          className: meta.className,
          order: order >= 0 ? order : 99,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.tag.localeCompare(b.tag);
      });
  }, [name]);

  // Load types lazily when the card is near the viewport
  useEffect(() => {
    let ignore = false;
    if (!inView) return;
    const key = String(id);
    if (detailsCache.has(key)) {
      setTypes(detailsCache.get(key).types);
      return;
    }
    try {
      const cached = localStorage.getItem(`types:${key}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        detailsCache.set(key, { types: parsed });
        setTypes(parsed);
        return;
      }
    } catch {}

    queuedFetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (ignore) return;
        const t = (data.types || [])
          .sort((a, b) => a.slot - b.slot)
          .map((x) => x.type.name);
        detailsCache.set(key, { types: t });
        try { localStorage.setItem(`types:${key}`, JSON.stringify(t)); } catch {}
        setTypes(t);
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, [id, url, inView]);

  useEffect(() => {
    const node = cardRef.current;
    if (!selected || !node || !node.isConnected) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [selected]);

  const dexNo = dexNumber || `#${id}`;

  return (
    <div
      className={`card${selected ? " is-selected" : ""}`}
      title={name}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.()}
      ref={cardRef}
      aria-current={selected ? "true" : undefined}
    >
      {specialTags.length > 0 && (
        <div className="card-tags">
          {specialTags.map((tag) => (
            <span
              key={tag.key}
              className={`card-tag ${tag.className}`}
              title={tag.tag}
              aria-label={tag.tag}
            >
              {tag.short}
            </span>
          ))}
        </div>
      )}
      <div className="dexno">{dexNo}</div>
      {inView ? (
        <SpriteImage className="sprite" id={id} alt={name} width={144} height={144} loading="lazy" />
      ) : (
        <div style={{ width: 144, height: 144 }} />
      )}
      <div className="name">{name}</div>
      <div className="types">
        {types.length === 0 ? (
          <span className="type-chip skeleton" />
        ) : (
          types.map((t) => (
            <span key={t} className={`type-chip type-${t}`}>
              {t}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error('DetailPanel crashed:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h2>Something went wrong loading details.</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {String(this.state.error)}
            {this.state.info ? '\n' + (this.state.info.componentStack || '') : ''}
          </pre>
          {this.props.fallback}
        </div>
      );
    }
    return this.props.children;
  }
}

function DetailPanel({ selected, onClose, onSelectPokemon, onActivateType, dexNumber }) {
  const { id, name, url } = selected || {};
  const [details, setDetails] = useState(null);
  const [shiny, setShiny] = useState(() => {
    try {
      return localStorage.getItem("pref:shiny") === "1";
    } catch {
      return false;
    }
  });
  const [animated, setAnimated] = useState(() => {
    try {
      return localStorage.getItem("pref:animated") === "1";
    } catch {
      return false;
    }
  });
  const [species, setSpecies] = useState(null);
  const [forms, setForms] = useState([]);
  const [evoPaths, setEvoPaths] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]); // [{type, mult}]
  const [resistances, setResistances] = useState([]); // [{type, mult}]
  const [debugLog, setDebugLog] = useState([]);
  const [smogonNature, setSmogonNature] = useState(null);
  const [smogonError, setSmogonError] = useState(null);
  const [smogonLoading, setSmogonLoading] = useState(false);
  const [activeAbility, setActiveAbility] = useState(null);
  const [abilityData, setAbilityData] = useState(null);
  const [abilityLoading, setAbilityLoading] = useState(false);
  const [abilityError, setAbilityError] = useState(null);
  const addLog = (msg, data) => {
    const line = `[${new Date().toISOString()}] ${msg}` + (data !== undefined ? ` :: ${typeof data === 'string' ? data : JSON.stringify(data)}` : '');
    setDebugLog((d) => d.concat(line).slice(-200));
  };
  const displayDexNumber = dexNumber || (id ? `#${id}` : "-");

  const evolutionTree = useMemo(() => {
    if (!Array.isArray(evoPaths) || evoPaths.length === 0) return [];
    const nodeMap = new Map();
    const rootSet = new Set();
    let orderCounter = 0;

    const ensureEntry = (node) => {
      if (!node) return null;
      const key = node.id != null ? String(node.id) : node.name;
      if (!key) return null;
      let entry = nodeMap.get(key);
      if (!entry) {
        entry = {
          id: node.id,
          name: node.name,
          displayName: node.displayName || humanizeName(node.name),
          forms: Array.isArray(node.forms) ? node.forms.slice() : [],
          children: [],
          order: orderCounter++,
        };
        nodeMap.set(key, entry);
      } else {
        if (!entry.displayName && node.displayName) {
          entry.displayName = node.displayName;
        }
        if (Array.isArray(node.forms) && node.forms.length) {
          const existingIds = new Set(
            (entry.forms || []).map((form) => (form?.id != null ? String(form.id) : null)).filter(Boolean)
          );
          node.forms.forEach((form) => {
            const formId = form?.id != null ? String(form.id) : null;
            if (!formId || existingIds.has(formId)) return;
            existingIds.add(formId);
            entry.forms.push(form);
          });
        }
      }
      if (entry.forms && entry.forms.length > 1) {
        entry.forms.sort(compareForms);
      }
      return entry;
    };

    for (const path of evoPaths) {
      for (let i = 0; i < path.length; i += 1) {
        const node = path[i];
        const entry = ensureEntry(node);
        if (!entry) continue;
        if (i === 0) {
          rootSet.add(entry);
        }
        if (i < path.length - 1) {
          const nextNode = path[i + 1];
          const childEntry = ensureEntry(nextNode);
          if (!childEntry) continue;
          const condition = node?.toNext || null;
          const exists = entry.children.some(
            (edge) =>
              edge.child === childEntry &&
              (edge.condition?.text || "") === (condition?.text || "") &&
              (edge.condition?.itemSprite || "") === (condition?.itemSprite || "")
          );
          if (!exists) {
            entry.children.push({ child: childEntry, condition });
          }
        }
      }
    }

    const sortChildren = (entry) => {
      entry.children.sort((a, b) => {
        const aOrder = a.child.order ?? 0;
        const bOrder = b.child.order ?? 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        const aName = a.child.displayName || a.child.name || "";
        const bName = b.child.displayName || b.child.name || "";
        return aName.localeCompare(bName);
      });
      entry.children.forEach(({ child }) => sortChildren(child));
    };

    rootSet.forEach((entry) => sortChildren(entry));

    return Array.from(rootSet).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [evoPaths]);

  const renderEvolutionPokemon = (node, { isCurrent = false, isRoot = false } = {}) => {
    if (!node) return null;
    const nodeId = node.id != null ? String(node.id) : null;
    const nodeName = node.displayName || humanizeName(node.name);
    if (!nodeId || !nodeName) return null;
    const isActive = isCurrent || nodeId === String(id);
    const classes = ["evo-tree-pokemon", isRoot ? "is-root" : "", isActive ? "is-current" : ""]
      .filter(Boolean)
      .join(" ");
    const size = isRoot ? 38 : 34;
    const inner = (
      <>
        <span className="evo-tree-icon">
          <SpriteImage id={node.id} alt={node.name} width={size} height={size} loading="lazy" />
        </span>
        <span className="evo-tree-name text-capitalize">{nodeName}</span>
      </>
    );
    return (
      <button
        type="button"
        className={classes}
        title={nodeName}
        onClick={() => onSelectPokemon?.(nodeId, node.name, `https://pokeapi.co/api/v2/pokemon/${nodeId}`)}
        aria-pressed={isActive}
      >
        {inner}
      </button>
    );
  };

  const renderEvolutionBranch = (entry, level = 0, incomingCondition = null, keyPrefix = "node") => {
    if (!entry) return null;
    const nodeKey = entry.id != null ? String(entry.id) : `${entry.name}-${level}`;
    const isCurrentNode = entry.id != null && String(entry.id) === String(id);
    const variantForms = Array.isArray(entry.forms)
      ? entry.forms.filter((form) => form && !form.isDefault)
      : [];
    const children = Array.isArray(entry.children) ? entry.children : [];

    return (
      <li key={`${keyPrefix}-${nodeKey}`} className="evo-tree-node">
        <div className="evo-tree-row" style={{ "--level": level }}>
          {incomingCondition?.text ? (
            <span className="evo-tree-cond">{incomingCondition.text}</span>
          ) : null}
          {incomingCondition?.itemSprite ? (
            <img
              src={incomingCondition.itemSprite}
              alt=""
              width={20}
              height={20}
              loading="lazy"
              className="evo-tree-item"
            />
          ) : null}
          {level > 0 && (
            <span className="evo-tree-arrow" aria-hidden="true">
              &rarr;
            </span>
          )}
          {renderEvolutionPokemon(entry, { isCurrent: isCurrentNode, isRoot: level === 0 })}
        </div>
        {variantForms.length > 0 && (
          <div className="evo-tree-forms" style={{ "--level": level }}>
            {variantForms.map((form) => {
              const formId = form?.id != null ? String(form.id) : null;
              if (!formId) return null;
              const formName = form.displayName || humanizeName(form.name);
              const isActiveForm = formId === String(id);
              return (
                <button
                  key={`${nodeKey}-form-${formId}`}
                  type="button"
                  className={`evo-tree-form${isActiveForm ? " is-current" : ""}`}
                  onClick={() =>
                    onSelectPokemon?.(formId, form.name, `https://pokeapi.co/api/v2/pokemon/${formId}`)
                  }
                  aria-pressed={isActiveForm}
                  title={formName}
                >
                  <SpriteImage id={form.id} alt={form.name} width={30} height={30} loading="lazy" />
                  <span className="evo-tree-form-name">{formName}</span>
                </button>
              );
            })}
          </div>
        )}
        {children.length > 0 && (
          <ul className="evo-tree-children">
            {children.map((edge, idx) =>
              renderEvolutionBranch(edge.child, level + 1, edge.condition, `${nodeKey}-${idx}`)
            )}
          </ul>
        )}
      </li>
    );
  };

  useEffect(() => {
    try { localStorage.setItem("pref:shiny", shiny ? "1" : "0"); } catch {}
  }, [shiny]);

  useEffect(() => {
    try { localStorage.setItem("pref:animated", animated ? "1" : "0"); } catch {}
  }, [animated]);

  useEffect(() => {
    if (!url) return;
    let ignore = false;
    setSpecies(null);
    setForms([]);
    setEvoPaths([]);
    setWeaknesses([]);
    addLog('Fetching details', { url });
    queuedFetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (ignore) return;
        addLog('Details loaded', { id: data?.id, name: data?.name });
        setDetails(data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [url]);

  // After details are loaded, fetch species, evolution chain, and compute weaknesses
  useEffect(() => {
    if (!details) return;
    let ignore = false;

    // Helper to extract id from a PokeAPI URL
    const getId = (u) => {
      const parts = (u || "").split("/").filter(Boolean);
      return parts[parts.length - 1];
    };

    // Compute defensive multipliers by aggregating damage relations across all types
    const computeMultipliers = async () => {
      try {
        const typeUrls = (details.types || []).map((t) => t.type.url);
        addLog('Loading type relations', { count: typeUrls.length });
        const typeDatas = await Promise.all(typeUrls.map((tu) => queuedFetch(tu).then((r) => r.json())));
        const mult = new Map(); // type -> multiplier
        const inc = (arr, factor) => {
          (arr || []).forEach((t) => {
            const key = t.name;
            const prev = mult.get(key) ?? 1;
            mult.set(key, prev * factor);
          });
        };
        for (const td of typeDatas) {
          const dr = td.damage_relations || {};
          inc(dr.double_damage_from, 2);
          inc(dr.half_damage_from, 0.5);
          inc(dr.no_damage_from, 0);
        }
        const weak = [];
        const resist = [];
        mult.forEach((v, k) => {
          if (v > 1) weak.push({ type: k, mult: v });
          else if (v < 1 || v === 0) resist.push({ type: k, mult: v });
        });
        weak.sort((a, b) => b.mult - a.mult || a.type.localeCompare(b.type));
        resist.sort((a, b) => a.mult - b.mult || a.type.localeCompare(b.type));
        if (!ignore) {
          setWeaknesses(weak);
          setResistances(resist);
        }
        addLog('Computed matchups', { weak: weak.length, resist: resist.length });
      } catch {}
    };

    const humanize = (s) => String(s || "").replace(/-/g, " ");
    const describeEvolution = (eds) => {
      if (!eds || eds.length === 0) return null;
      const ed = eds[0];
      const trig = ed.trigger?.name;
      const parts = [];
      const gender = ed.gender;
      if (trig === "level-up") {
        if (ed.min_level != null) parts.push(`Lv. ${ed.min_level}`);
        if (ed.min_happiness != null) parts.push(`Friendship ${ed.min_happiness}`);
        if (ed.min_affection != null) parts.push(`Affection ${ed.min_affection}`);
        if (ed.min_beauty != null) parts.push(`Beauty ${ed.min_beauty}`);
        if (gender === 1) parts.push("Female");
        else if (gender === 2) parts.push("Male");
        if (ed.time_of_day) parts.push(ed.time_of_day === "day" ? "Daytime" : humanize(ed.time_of_day));
        if (ed.needs_overworld_rain) parts.push("Raining");
        if (ed.party_species?.name) parts.push(`With ${humanize(ed.party_species.name)}`);
        if (ed.party_type?.name) parts.push(`With ${humanize(ed.party_type.name)} ally`);
        if (ed.location?.name) parts.push(`At ${humanize(ed.location.name)}`);
        if (ed.known_move?.name) parts.push(`Know ${humanize(ed.known_move.name)}`);
        if (ed.known_move_type?.name) parts.push(`Know ${humanize(ed.known_move_type.name)} move`);
        if (parts.length === 0) parts.push("Level up");
        return { text: parts.join(" • ") };
      }
      if (trig === "use-item") {
        if (ed.item?.name) {
          const name = ed.item.name;
          const isStone = name.includes("stone");
          const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`;
          return {
            text: `Use ${humanize(name)}`,
            itemSprite: isStone ? sprite : undefined,
          };
        }
        return { text: "Use item" };
      }
      if (trig === "trade") {
        if (ed.trade_species?.name) parts.push(`for ${humanize(ed.trade_species.name)}`);
        if (ed.held_item?.name) parts.push(`holding ${humanize(ed.held_item.name)}`);
        return { text: parts.length ? `Trade ${parts.join(", ")}` : "Trade" };
      }
      if (trig === "shed") {
        return { text: "Shed evolution" };
      }
      if (trig) return { text: humanize(trig) };
      return null;
    };

    // Build evolution paths from chain, attaching condition to the edge to next node
    const buildPaths = (node, prefix = [], formsMap) => {
      const speciesId = getId(node.species.url);
      const rawForms = speciesId && formsMap ? formsMap.get(String(speciesId)) : null;
      const formBranches = rawForms && rawForms.length ? rawForms.map((form) => ({ ...form })) : [];
      const currentNode = {
        name: node.species.name,
        displayName: humanizeName(node.species.name),
        id: speciesId,
        forms: formBranches,
      };
      const current = [...prefix, currentNode];
      if (!node.evolves_to || node.evolves_to.length === 0) return [current];
      let paths = [];
      for (const child of node.evolves_to) {
        const cond = describeEvolution(child.evolution_details);
        const withCond = current.slice();
        withCond[withCond.length - 1] = {
          ...withCond[withCond.length - 1],
          toNext: cond,
        };
        paths = paths.concat(buildPaths(child, withCond, formsMap));
      }
      return paths;
    };

    const fetchEvolution = async () => {
      try {
        const speciesUrl = details.species?.url;
        if (!speciesUrl) return;
        addLog('Fetching species', { speciesUrl });
        const sp = await queuedFetch(speciesUrl).then((r) => r.json());
        if (ignore) return;
        setSpecies(sp);

        const currentId = details?.id != null ? String(details.id) : "";
        const formList = mapVarietiesToForms(sp, { currentId });
        setForms(formList);

        const evoUrl = sp.evolution_chain?.url;
        if (!evoUrl) return;
        addLog('Fetching evolution chain', { evoUrl });
        const chain = await queuedFetch(evoUrl).then((r) => r.json());
        if (ignore) return;
        const collectSpeciesIds = (node, acc) => {
          if (!node) return;
          const sid = getId(node.species?.url);
          if (sid) acc.add(String(sid));
          (node.evolves_to || []).forEach((child) => collectSpeciesIds(child, acc));
        };
        const speciesIds = new Set();
        collectSpeciesIds(chain?.chain, speciesIds);
        const speciesMap = new Map();
        if (sp?.id != null) {
          speciesMap.set(String(sp.id), sp);
        }
        const missingIds = Array.from(speciesIds).filter((sid) => sid && !speciesMap.has(sid));
        if (missingIds.length > 0) {
          const siblingSpecies = await Promise.all(
            missingIds.map(async (sid) => {
              try {
                const response = await queuedFetch(`https://pokeapi.co/api/v2/pokemon-species/${sid}/`);
                if (!response?.ok) return null;
                const data = await response.json();
                return data;
              } catch {
                return null;
              }
            })
          );
          if (ignore) return;
          for (const sibling of siblingSpecies) {
            if (!sibling || sibling?.id == null) continue;
            speciesMap.set(String(sibling.id), sibling);
          }
        }
        if (ignore) return;
        const formsBySpeciesId = new Map();
        const currentSpeciesId = sp?.id != null ? String(sp.id) : null;
        if (currentSpeciesId) {
          const altForms = formList.filter((form) => !form.isDefault);
          if (altForms.length) {
            formsBySpeciesId.set(currentSpeciesId, altForms);
          }
        }
        speciesMap.forEach((data, speciesId) => {
          if (speciesId === currentSpeciesId) return;
          const altForms = mapVarietiesToForms(data, { includeDefault: false });
          if (altForms.length) {
            formsBySpeciesId.set(speciesId, altForms);
          }
        });
        if (!chain?.chain) return;
        const paths = buildPaths(chain.chain, [], formsBySpeciesId);
        setEvoPaths(paths);
        addLog('Evolution paths built', { paths: paths.length });
      } catch {}
    };

    computeMultipliers();
    fetchEvolution();

    return () => { ignore = true; };
  }, [details]);

  useEffect(() => {
    setActiveAbility(null);
    setAbilityData(null);
    setAbilityError(null);
    setAbilityLoading(false);
  }, [id]);

  const handleAbilityClick = useCallback((entry) => {
    const abilityInfo = entry?.ability;
    if (!abilityInfo?.url) return;
    const abilityName = abilityInfo.name;
    const abilityUrl = abilityInfo.url;
    const cached =
      abilityCache.get(abilityUrl) || (abilityName ? abilityCache.get(abilityName) : null);
    setAbilityError(null);
    if (cached) {
      setAbilityData(cached);
      setAbilityLoading(false);
    } else {
      setAbilityData(null);
      setAbilityLoading(true);
    }
    setActiveAbility({
      name: abilityName,
      url: abilityUrl,
      isHiddenForSelected: !!entry.is_hidden,
      retryToken: 0,
    });
  }, []);

  const handleAbilityRetry = useCallback(() => {
    setAbilityError(null);
    setAbilityData(null);
    setAbilityLoading(true);
    setActiveAbility((prev) => {
      if (!prev) return prev;
      return { ...prev, retryToken: (prev.retryToken || 0) + 1 };
    });
  }, []);

  const closeAbilityOverlay = useCallback(() => {
    setActiveAbility(null);
    setAbilityData(null);
    setAbilityError(null);
    setAbilityLoading(false);
  }, []);

  useEffect(() => {
    if (!activeAbility) return;
    const abilityUrl = activeAbility.url;
    const abilityName = activeAbility.name;
    const retryToken = activeAbility.retryToken || 0;
    if (!abilityUrl) return;
    const cacheKey = abilityUrl || abilityName;
    if (retryToken === 0) {
      const cached =
        abilityCache.get(cacheKey) || (abilityName ? abilityCache.get(abilityName) : null);
      if (cached) {
        setAbilityData(cached);
        setAbilityLoading(false);
        return;
      }
    }
    let ignore = false;
    const controller = new AbortController();
    setAbilityError(null);
    setAbilityLoading(true);
    queuedFetch(abilityUrl, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed with status ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (ignore) return;
        abilityCache.set(cacheKey, data);
        if (abilityName) {
          abilityCache.set(abilityName, data);
        }
        setAbilityData(data);
        setAbilityLoading(false);
      })
      .catch((err) => {
        if (ignore || err?.name === "AbortError") return;
        setAbilityError("Unable to load ability details. Please try again.");
        setAbilityLoading(false);
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [activeAbility]);

  // Prefer higher quality sources. If animated is enabled, try Showdown; otherwise use HD static (HOME > official-artwork > dream_world if not shiny) before pixel fallback.
  const detailImg = (() => {
    const d = details?.sprites?.other || {};
    const pixel = shiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

    if (animated) {
      const showdown = d?.showdown?.[shiny ? "front_shiny" : "front_default"];
      if (showdown) return showdown;
      // fall through to HD static if no animated available
    }

    const home = d?.home?.[shiny ? "front_shiny" : "front_default"];
    if (home) return home;
    const art = d?.["official-artwork"]?.[shiny ? "front_shiny" : "front_default"];
    if (art) return art;
    if (!shiny) {
      const dream = d?.dream_world?.front_default;
      if (dream) return dream;
    }
    return pixel;
  })();

  const specialTags = useMemo(() => {
    if (!details && !species) return [];
    const tags = new Set();
    const detailName = details?.name || "";
    const baseName = species?.name || details?.species?.name || detailName;
    const detailLower = detailName.toLowerCase();
    const baseLower = baseName.toLowerCase();

    deriveSpecialTags(detailName).forEach((tag) => tags.add(tag));
    if (baseLower && baseLower !== detailLower) {
      deriveSpecialTags(baseName).forEach((tag) => tags.add(tag));
    }

    if (species?.is_legendary || LEGENDARY_NAMES.has(baseLower)) tags.add("Legendary");
    if (species?.is_mythical || MYTHICAL_NAMES.has(baseLower)) tags.add("Mythical");
    if (species?.is_baby || BABY_NAMES.has(baseLower)) tags.add("Baby");
    if (detailLower.includes("primal-") || detailLower.includes("-primal")) tags.add("Primal");
    if (detailLower.includes("mega-") || detailLower.includes("-mega")) tags.add("Mega");
    if (ULTRA_BEASTS.has(baseLower)) tags.add("Ultra Beast");
    if (PARADOX_NAMES.has(baseLower)) tags.add("Paradox");
    if (detailLower.includes("-gmax")) tags.add("Gigantamax");

    return Array.from(tags);
  }, [details, species]);
  // Fetch recommended nature from Smogon (SV), preferring OU sets when available.
  useEffect(() => {
    const alias = (name || "").toLowerCase();
    setSmogonNature(null);
    setSmogonError(null);
    setSmogonLoading(false);
    if (!alias) return;
    const controller = new AbortController();
    let cancelled = false;
    const smogonUrl = `https://www.smogon.com/dex/sv/pokemon/${encodeURIComponent(alias)}/`;
    const sources = [
      { label: "direct", url: smogonUrl },
      { label: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(smogonUrl)}` },
    ];

    const extractNature = (html) => {
      const flag = "dexSettings = ";
      const idx = html.indexOf(flag);
      if (idx < 0) throw new Error("dexSettings not found (page structure/CORS)");
      const rest = html.substring(idx + flag.length);
      const end = rest.indexOf("</script>");
      const blob = rest.substring(0, end);
      const m = blob.match(/"injectRpcs":(\[[\s\S]*\])/);
      if (!m) throw new Error("injectRpcs not found");
      const parsed = JSON.parse('{"injectRpcs":' + m[1] + "}");
      const pair = parsed.injectRpcs.find((p) => (p?.[0] || "").includes("dump-pokemon"));
      const resp = pair?.[1] || {};
      const strategies = Array.isArray(resp.strategies) ? resp.strategies : [];
      const formats = strategies.map((s) => s.format);
      const ouFirst = [
        ...strategies.filter((s) => (s.format || "").toUpperCase() === "OU"),
        ...strategies.filter((s) => (s.format || "").toUpperCase() !== "OU"),
      ];
      let found = null;
      for (const strat of ouFirst) {
        if (!strat?.movesets) continue;
        for (const ms of strat.movesets) {
          if (Array.isArray(ms?.natures) && ms.natures.length > 0) {
            found = ms.natures[0];
            break;
          }
        }
        if (found) break;
      }
      return { nature: found, formats };
    };

    const run = async () => {
      setSmogonLoading(true);
      let lastError = null;

      for (const source of sources) {
        try {
          addLog("Fetching Smogon dex", { via: source.label, url: source.url });
          const resp = await fetch(source.url, { signal: controller.signal });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const html = await resp.text();
          if (cancelled) return;
          const { nature, formats } = extractNature(html);
          if (!nature) {
            if (cancelled) return;
            const msg = `No natures found for ${name} in SV. Formats: ${formats.join(", ")}`;
            setSmogonLoading(false);
            setSmogonError(msg);
            setSmogonNature(null);
            addLog("Smogon nature not found", msg);
            return;
          }
          setSmogonLoading(false);
          setSmogonNature(nature);
          addLog("Smogon nature", { nature, via: source.label });
          return;
        } catch (err) {
          if (controller.signal.aborted || cancelled) return;
          lastError = new Error(`[${source.label}] ${String(err)}`);
          addLog("Smogon fetch failed", { via: source.label, error: String(err) });
        }
      }

      if (!cancelled && lastError) {
        const msg = `Smogon fetch failed for ${name}: ${lastError.message || String(lastError)}`;
        setSmogonLoading(false);
        setSmogonError(msg);
        setSmogonNature(null);
        addLog("Smogon fetch failed", msg);
      }
    };

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [name]);

  return (
    <aside className="detail-panel">
      <div className="detail-inner">
        <button className="close" onClick={onClose} aria-label="Close">x</button>
        <div className="detail-hero">
          <div className="hero-left">
            <div className="detail-art-wrap">
              <img
                className={`detail-art ${animated ? "is-animated" : "is-static"}`}
                src={detailImg}
                alt={name}
                loading="lazy"
              />
            </div>
            <div className="hero-controls">
              <div className="toggle-group">
                <button
                  type="button"
                  className={`toggle-btn${animated ? " is-on" : ""}`}
                  onClick={() => setAnimated((v) => !v)}
                  aria-pressed={animated}
                  title={animated ? "Use HD static sprite" : "Use animated sprite"}
                >
                  🎞️ Animate
                </button>
                <button
                  type="button"
                  className={`toggle-btn${shiny ? " is-on" : ""}`}
                  onClick={() => setShiny((v) => !v)}
                  aria-pressed={shiny}
                  title={shiny ? "Show default variant" : "Show shiny variant"}
                >
                  ✨ Shiny
                </button>
              </div>
            </div>
            <section className="about single-col">
              <h3 className="section-title">About</h3>
              <div className="about-list">
                <div className="about-row">
                  <span className="label">Types</span>
                  <div className="value">
                    {(details?.types || [])
                      .slice()
                      .sort((a, b) => a.slot - b.slot)
                      .map((t) => (
                        <span
                          key={t.type.name}
                          className={`type-chip type-${t.type.name}`}
                          role="button"
                          title={`Filter by ${t.type.name}`}
                          onClick={() => onActivateType?.(t.type.name)}
                        >
                          {t.type.name}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="about-row">
                  <span className="label">Abilities</span>
                  <div className="value">
                    {(details?.abilities || []).map((a) => (
                      <button
                        key={a.ability.name}
                        type="button"
                        className={`ability-chip${a.is_hidden ? " is-hidden" : ""}`}
                        onClick={() => handleAbilityClick(a)}
                        aria-label={`View details for ${humanizeName(a.ability.name)} ability`}
                      >
                        <span className="text-capitalize">{a.ability.name}</span>
                        {a.is_hidden && <span className="ability-tag">Hidden</span>}
                      </button>
                    ))}
                  </div>
                </div>
                {specialTags.length > 0 && (
                  <div className="about-row">
                    <span className="label">Tags</span>
                    <div className="value">
                      {specialTags.map((tag) => (
                        <span key={tag} className="special-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {!smogonError && (
                  <div className="about-row">
                    <span className="label">Recommended Nature</span>
                    <div className="value nature-value">
                      {smogonLoading ? (
                        <span className="nature-loading" aria-live="polite">
                          <span className="nature-spinner" aria-hidden="true" />
                          Loading
                        </span>
                      ) : smogonNature ? (
                        <span className="nature-chip">
                          <span className="text-capitalize">{smogonNature}</span>
                        </span>
                      ) : (
                        <span className="nature-placeholder">-</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
            <div className="weak-resist">
                      <div className="matchup-box weak-matchup">
                <div className="matchup-title">Weak To</div>
                <div className="types">
                  {weaknesses.length === 0 ? (
                    <span className="type-chip skeleton" />
                  ) : (
                    weaknesses.map((w) => (
                      <span key={w.type} className={`type-chip type-${w.type}`} title={`x${w.mult}`}>
                        {w.type}
                        {w.mult >= 4 ? " x4" : w.mult > 1 ? " x2" : ""}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="matchup-box resist-matchup">
        <div className="matchup-title">Resists</div>
                <div className="types">
                  {resistances.length === 0 ? (
                    <span className="type-chip skeleton" />
                  ) : (
                    resistances.map((r) => (
                      <span key={r.type} className={`type-chip type-${r.type}`} title={`x${r.mult}`}>
                        {r.type}
                        {r.mult === 0 ? " x0" : r.mult <= 0.25 ? " x0.25" : " x0.5"}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="hero-right">
            <div className="detail-title">
              {id ? <span className="dexno">{displayDexNumber}</span> : null}
              <h2>{name}</h2>
            </div>
            <section className="stats hero-stats">
              <div className="stats-list">
                {(details?.stats || []).map((s) => (
                  <div className="stat-row" key={s.stat.name}>
                    <div className="stat-label">{s.stat.name.replace("-", " ")}</div>
                    <div className="stat-bar">
                      <div
                        className="stat-fill"
                        style={{ width: `${Math.min(100, (s.base_stat / 180) * 100)}%` }}
                        title={`${s.base_stat}`}
                      />
                    </div>
                    <div className="stat-value">{s.base_stat}</div>
                  </div>
                ))}
              </div>
            </section>
            {evoPaths.length > 0 && (
              <section className="evo-section">
                <h3 className="section-title">Evolution</h3>
                <div className="evo-tree">
                  {evolutionTree.length > 0 ? (
                    <ul className="evo-tree-roots">
                      {evolutionTree.map((entry, idx) =>
                        renderEvolutionBranch(entry, 0, null, `root-${idx}`)
                      )}
                    </ul>
                  ) : (
                    <div className="evo-empty">Evolution data unavailable.</div>
                  )}
                </div>
              </section>
            )}
  </div>
        </div>
        {details && (
          <>

            {/* detail-body no longer used since about moved under sprite */}
          </>
        )}
      </div>
      {activeAbility && (
        <AbilityOverlay
          ability={activeAbility}
          data={abilityData}
          loading={abilityLoading}
          error={abilityError}
          onClose={closeAbilityOverlay}
          onRetry={handleAbilityRetry}
          onSelectPokemon={onSelectPokemon}
          currentPokemonId={id}
        />
      )}
      <div style={{ maxHeight: 140, overflow: 'auto', background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Debug</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginBottom: 8 }}>
          <div><strong>ID</strong>: {String(id)}</div>
          <div><strong>Name</strong>: {String(name)}</div>
          <div><strong>Has details</strong>: {details ? 'yes' : 'no'}</div>
          <div><strong>Types</strong>: {(details?.types||[]).map(t=>t.type.name).join(', ')}</div>
          <div><strong>Weak</strong>: {weaknesses.length}</div>
          <div><strong>Resist</strong>: {resistances.length}</div>
          <div><strong>Evo paths</strong>: {evoPaths.length}</div>
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, lineHeight: 1.2 }}>{debugLog.join('\n')}</pre>
      </div>
    </aside>
  );
}

function AbilityOverlay({ ability, data, loading, error, onClose, onRetry, onSelectPokemon, currentPokemonId }) {
  const abilityTitleId = ability?.name ? `ability-modal-title-${ability.name}` : undefined;
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [learnerTypes, setLearnerTypes] = useState(() => new Map());

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setSearchTerm("");
    setSelectedTypes([]);
    setLearnerTypes(new Map());
  }, [ability?.url]);

  const upsertLearnerTypes = useCallback((key, types) => {
    if (!types || types.length === 0) return;
    const normalized = types.filter(Boolean);
    if (normalized.length === 0) return;
    setLearnerTypes((prev) => {
      const existing = prev.get(key);
      if (existing && existing.length === normalized.length && existing.every((val, idx) => val === normalized[idx])) {
        return prev;
      }
      const next = new Map(prev);
      next.set(key, normalized);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!data?.pokemon || data.pokemon.length === 0) return;
    let ignore = false;
    const entries = data.pokemon.slice(0, 140);

    const loadTypes = async () => {
      for (const entry of entries) {
        if (ignore) break;
        const poke = entry?.pokemon;
        if (!poke?.url) continue;
        const id = getIdNumberFromUrl(poke.url);
        if (id == null) continue;
        const key = String(id);

        if (ignore) break;
        const cached = detailsCache.get(key);
        if (cached?.types && cached.types.length > 0) {
          upsertLearnerTypes(key, cached.types.slice());
          continue;
        }

        let storedTypes = null;
        try {
          const stored = localStorage.getItem(`types:${key}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              storedTypes = parsed.filter(Boolean);
            }
          }
        } catch {}
        if (storedTypes && storedTypes.length > 0) {
          detailsCache.set(key, { ...(detailsCache.get(key) || {}), types: storedTypes });
          upsertLearnerTypes(key, storedTypes);
          continue;
        }

        try {
          const response = await queuedFetch(poke.url);
          if (!response?.ok) continue;
          const json = await response.json();
          if (ignore) break;
          const types = (json?.types || [])
            .slice()
            .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
            .map((t) => t?.type?.name)
            .filter(Boolean);
          if (types.length > 0) {
            const existing = detailsCache.get(key) || {};
            detailsCache.set(key, { ...existing, types });
            try { localStorage.setItem(`types:${key}`, JSON.stringify(types)); } catch {}
            upsertLearnerTypes(key, types);
          }
        } catch {}
      }
    };

    loadTypes();
    return () => { ignore = true; };
  }, [data, upsertLearnerTypes]);

  const effectEntry = useMemo(() => {
    if (!data?.effect_entries) return null;
    const english = data.effect_entries.find((entry) => entry?.language?.name === "en");
    return english || data.effect_entries[0] || null;
  }, [data]);

  const flavorEntry = useMemo(() => {
    if (!data?.flavor_text_entries) return null;
    const englishEntries = data.flavor_text_entries.filter((entry) => entry?.language?.name === "en");
    if (englishEntries.length === 0) return null;
    return englishEntries[englishEntries.length - 1];
  }, [data]);

  const flavorText = useMemo(() => {
    if (!flavorEntry?.flavor_text) return null;
    return flavorEntry.flavor_text.replace(/[\n\f\r]+/g, " ");
  }, [flavorEntry]);

  const generationLabel = useMemo(() => {
    const name = data?.generation?.name;
    if (!name) return null;

    if (/^generation-/i.test(name)) {
      const romanNumeral = name.replace(/^generation-/i, "");
      return `Generation ${romanNumeral.toUpperCase()}`;
    }

    const humanized = humanizeName(name);
    if (!humanized) return null;

    return humanized
      .replace(/\bgeneration\b/i, "Generation")
      .replace(/\b([ivxlcdm]+)\b/gi, (match) => match.toUpperCase());
  }, [data]);

  const learners = useMemo(() => {
    if (!data?.pokemon) return [];
    const currentIdStr = currentPokemonId != null ? String(currentPokemonId) : null;
    return data.pokemon
      .map((entry) => {
        const poke = entry?.pokemon;
        if (!poke?.name || !poke?.url) return null;
        const id = getIdNumberFromUrl(poke.url);
        return {
          id,
          name: poke.name,
          url: poke.url,
          isHidden: !!entry.is_hidden,
        };
      })
      .filter((p) => p && (!currentIdStr || String(p.id ?? "") !== currentIdStr))
      .sort((a, b) => {
        const aId = a.id ?? Number.POSITIVE_INFINITY;
        const bId = b.id ?? Number.POSITIVE_INFINITY;
        if (aId !== bId) return aId - bId;
        return a.name.localeCompare(b.name);
      });
  }, [data, currentPokemonId]);

  const availableTypes = useMemo(() => {
    if (learners.length === 0) return [];
    const present = new Set();
    for (const learner of learners) {
      const key = learner.id != null ? String(learner.id) : getIdFromUrl(learner.url);
      if (!key) continue;
      const types = learnerTypes.get(key);
      if (!types) continue;
      types.forEach((t) => present.add(t));
    }
    return ALL_TYPES.filter((type) => present.has(type));
  }, [learners, learnerTypes]);

  const filteredLearners = useMemo(() => {
    if (learners.length === 0) return [];
    const query = searchTerm.trim().toLowerCase();
    const hasQuery = query.length > 0;
    const hasTypeFilters = selectedTypes.length > 0;

    return learners.filter((pokemon) => {
      const key = pokemon.id != null ? String(pokemon.id) : getIdFromUrl(pokemon.url);
      const types = (key && learnerTypes.get(key)) || [];
      if (hasQuery) {
        const nameMatch = humanizeName(pokemon.name).toLowerCase().includes(query);
        const idMatch = pokemon.id != null ? String(pokemon.id).includes(query) : false;
        if (!nameMatch && !idMatch) {
          return false;
        }
      }
      if (hasTypeFilters) {
        if (types.length === 0) return false;
        for (const type of selectedTypes) {
          if (!types.includes(type)) {
            return false;
          }
        }
      }
      return true;
    });
  }, [learners, searchTerm, selectedTypes, learnerTypes]);

  const handleLearnerClick = (pokemon) => {
    if (!pokemon) return;
    const idStr = pokemon.id != null ? String(pokemon.id) : getIdFromUrl(pokemon.url);
    if (!idStr) return;
    onSelectPokemon?.(idStr, pokemon.name, pokemon.url);
    onClose();
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const toggleType = (type) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return prev.concat(type);
    });
  };

  const handleTypeClear = () => {
    setSelectedTypes([]);
  };

  const handleBackdropMouseDown = (event) => {
    event.stopPropagation();
    onClose();
  };

  const handleModalMouseDown = (event) => {
    event.stopPropagation();
  };

  const abilityLabel = ability?.name ? humanizeName(ability.name) : "Ability";
  const hasTypeFilters = selectedTypes.length > 0;

  return (
    <div className="ability-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <div
        className="ability-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={abilityTitleId}
        onMouseDown={handleModalMouseDown}
      >
        <button type="button" className="ability-modal-close" onClick={onClose} aria-label="Close ability details">
          X
        </button>
        <div className="ability-modal-left">
          <div className="ability-modal-header">
            <h2 className="ability-modal-title" id={abilityTitleId}>
              <span className="text-capitalize">{abilityLabel}</span>
              {ability?.isHiddenForSelected && <span className="ability-tag ability-title-tag">Hidden on this Pokemon</span>}
            </h2>
            {generationLabel && <div className="ability-modal-subtle">Introduced in {generationLabel}</div>}
          </div>
          <div className="ability-modal-body">
            {loading ? (
              <div className="ability-modal-loading">Loading ability details...</div>
            ) : error ? (
              <div className="ability-modal-error">
                <p>{error}</p>
                {onRetry && (
                  <button type="button" className="ability-retry-btn" onClick={onRetry}>
                    Retry
                  </button>
                )}
              </div>
            ) : (
              <>
                {effectEntry?.effect && (
                  <p className="ability-effect">{effectEntry.effect}</p>
                )}
                {flavorText && (
                  <p className="ability-flavor">
                    "{flavorText}"
                    {flavorEntry?.version?.name && (
                      <span className="ability-flavor-version"> - {humanizeName(flavorEntry.version.name)}</span>
                    )}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="ability-type-filter-shell">
            <div className="ability-type-filter-header">
              <span className="ability-modal-subtle">Filter by type</span>
              {hasTypeFilters && (
                <button type="button" className="ability-type-clear" onClick={handleTypeClear}>
                  Clear
                </button>
              )}
            </div>
            {availableTypes.length > 0 ? (
              <div className="ability-type-filters">
                {availableTypes.map((type) => {
                  const isActive = selectedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`type-chip ability-type-chip type-${type} ${isActive ? "is-active" : "off"}`}
                      onClick={() => toggleType(type)}
                      aria-pressed={isActive}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            ) : loading ? (
              <div className="ability-type-filters-empty">Loading type data...</div>
            ) : learners.length > 0 ? (
              <div className="ability-type-filters-empty">Loading type data...</div>
            ) : (
              <div className="ability-type-filters-empty">No other Pokemon to filter.</div>
            )}
          </div>
        </div>
        <div className="ability-modal-right">
          <h3 className="ability-modal-subtitle">Also Learns</h3>
          <div className="ability-learners-header">
            <input
              type="search"
              className="ability-search-input"
              placeholder="Search by name or number..."
              value={searchTerm}
              onChange={handleSearchChange}
              aria-label="Search Pokémon"
            />
          </div>
          <div className="ability-learners-scroll">
            {loading ? (
              <div className="ability-learners-loading">Loading Pokemon...</div>
            ) : error ? (
              <div className="ability-learners-error">Unable to load Pokemon list.</div>
            ) : learners.length > 0 ? (
              filteredLearners.length > 0 ? (
                <ul className="ability-learners">
                  {filteredLearners.map((pokemon) => {
                    const key = pokemon.id != null ? String(pokemon.id) : getIdFromUrl(pokemon.url);
                    const typeList = (key && learnerTypes.get(key)) || [];
                    return (
                      <li key={pokemon.url}>
                        <button
                          type="button"
                          className="ability-learner"
                          onClick={() => handleLearnerClick(pokemon)}
                          title={humanizeName(pokemon.name)}
                        >
                          <SpriteImage id={pokemon.id} alt={pokemon.name} width={44} height={44} loading="lazy" />
                          <div className="ability-learner-meta">
                            <div className="ability-learner-top">
                              <span className="ability-learner-name text-capitalize">{pokemon.name}</span>
                              {pokemon.isHidden && <span className="ability-learner-tag">Hidden</span>}
                            </div>
                          </div>
                          {typeList.length > 0 && (
                            <div className="ability-learner-types">
                              {typeList.map((type) => (
                                <span key={`${pokemon.url}-${type}`} className={`ability-learner-type type-${type}`}>
                                  {type}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      </li>
                  );
                })}
              </ul>
              ) : (
                <div className="ability-learners-empty">No Pokémon match your filters.</div>
              )
            ) : (
              <div className="ability-learners-empty">No other Pokemon learn this ability in the main series.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

