import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HeaderSection from "./sections/Header.jsx";
import GameFilters from "./sections/GameFilters.jsx";
import FilterTabs from "./sections/FilterTabs.jsx";
import SpriteImage from "./components/SpriteImage.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import PokemonCard from "./components/PokemonCard.jsx";
import "./App.css";
import { findRecommendedNature } from "./smogonApi";
import CategoryToggle from "./CategoryToggle.jsx";
import { getPokemonSlugFromPath, updatePokemonLocation, normalizePokemonSlug, getPokemonSlugFromLocation, getBasePath } from "./utils/url.js";
import { getTypeIconUrl } from "./utils/typeIcons.js";
import { ULTRA_BEASTS, PARADOX_NAMES, BABY_NAMES, REGIONAL_TOKENS, LEGENDARY_NAMES, MYTHICAL_NAMES } from "./constants/species.js";
import { ALL_TYPES, STAT_TO_EVS_KEY } from "./constants/types.js";
import { NEUTRAL_NATURE_KEY, NATURE_STAT_ORDER, NATURE_STAT_LABELS, NATURE_SUMMARIES } from "./constants/natures.js";
import { EV_ITEM_GUIDE, FEATHER_VARIANTS, POWER_ITEM_VARIANTS } from "./constants/evItems.js";
import { DEX_FILTERS, DEX_LOOKUP } from "./constants/dex.js";
import { SPECIAL_FILTERS, SPECIAL_TAG_META } from "./constants/tags.js";
import { CONDITION_LABEL_OVERRIDES, TIME_OF_DAY_LABELS, METHOD_LABEL_OVERRIDES } from "./constants/labels.js";
import { FORM_ORDER } from "./constants/forms.js";
import { MAX_CONCURRENT } from "./constants/config.js";
import {
  GAME_LOGO_LOOKUP,
  VERSION_LOGO_FILES,
  VERSION_RELEASE_SEQUENCE,
  VERSION_ORDER_LOOKUP,
  NATIONAL_GAME_OPTIONS,
  GAME_LOOKUP,
  GENERATION_NAME_LOOKUP,
  REGION_GENERATION_LOOKUP,
  DEX_GENERATION_LOOKUP,
  GAME_GENERATION_LOOKUP,
  GAME_FEATURES,
  REGION_FEATURES,
} from "./constants/games.js";

const itemGenerationCache = new Map();
const locationGenerationCache = new Map();
const moveGenerationCache = new Map();
const speciesGenerationCache = new Map();

const getGenerationNumber = (name) => {
  if (!name) return null;
  const value = GENERATION_NAME_LOOKUP.get(name);
  return value != null ? value : null;
};

const getRegionGeneration = (regionName) => {
  if (!regionName) return null;
  const normalized = String(regionName).toLowerCase();
  return REGION_GENERATION_LOOKUP.get(normalized) ?? null;
};

const humanizeName = (s) => String(s || "").replace(/-/g, " ");

// Type color mapping - using the primary (first) color from the gradient
const getTypeColor = (typeName) => {
  const typeColors = {
    normal: "#b0aa79",
    fire: "#d17f56",
    water: "#5d8ed2",
    electric: "#c09c38",
    grass: "#6ea964",
    ice: "#6baab4",
    fighting: "#bb544c",
    poison: "#955b9a",
    ground: "#bd975f",
    flying: "#8f84d1",
    psychic: "#c0668f",
    bug: "#8fa43a",
    rock: "#aa9150",
    ghost: "#7768a3",
    dragon: "#7158cc",
    dark: "#826a52",
    steel: "#a6a8c2",
    fairy: "#bd82a7",
  };
  return typeColors[typeName?.toLowerCase()] || "#b0aa79"; // Default to normal if type not found
};

const getStatLabel = (statName, isMobile) => {
  const label = humanizeName(statName);
  if (isMobile) {
    if (label === "Special Attack") return "Sp. Attack";
    if (label === "Special Defense") return "Sp. Defense";
  }
  return label;
};

const getStatColor = (baseStat) => {
  // Normalize stat value from 0-180 range to 0-1 for interpolation
  const normalized = Math.max(0, Math.min(1, baseStat / 180));
  
  // Interpolate from red (low) to green (high)
  // Red: rgb(220, 50, 50), Green: rgb(50, 220, 50)
  const red = Math.round(220 - (normalized * 170));
  const green = Math.round(50 + (normalized * 170));
  const blue = Math.round(50);
  
  return `rgb(${red}, ${green}, ${blue})`;
};

const deriveSpecialTags = (name) => {
  const lower = String(name || "").toLowerCase();
  if (!lower) return [];
  const tags = [];
  if (LEGENDARY_NAMES.has(lower)) tags.push("Legendary");
  if (MYTHICAL_NAMES.has(lower)) tags.push("Mythical");
  if (lower.includes("-mega") || lower.startsWith("mega-")) tags.push("Mega");
  // Primal tag still derivable internally if needed, but no filter chip
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

const isCapFormName = (name) => {
  const lower = String(name || "").toLowerCase();
  return /(?:^|[-_\s])cap(?:$|[-_\s])/.test(lower) || lower.endsWith("cap");
};

const getIdFromUrl = (url) => {
  const parts = (url || "").split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
};

const getIdNumberFromUrl = (url) => {
  const id = Number(getIdFromUrl(url));
  return Number.isNaN(id) ? null : id;
};

const toTitleCase = (value) => {
  const base = humanizeName(value);
  return base.replace(/\b\w/g, (char) => char.toUpperCase()).trim();
};

const stripMegaGmaxTokens = (rawName) => {
  const lower = String(rawName || "").toLowerCase();
  if (!lower) return "";
  const tokens = lower.split("-");
  const filtered = tokens.filter((t) => t !== "mega" && t !== "gmax");
  return filtered.join("-");
};

const DISPLAY_NAME_OVERRIDES = new Map([
  ["legends-za", "Legends: Z-A"],
]);

const formatDisplayName = (rawName) => {
  const stripped = stripMegaGmaxTokens(rawName);
  const key = String(stripped || "").toLowerCase();
  if (DISPLAY_NAME_OVERRIDES.has(key)) {
    return DISPLAY_NAME_OVERRIDES.get(key);
  }
  return toTitleCase(stripped);
};

const formatEncounterDescriptor = (name) => {
  if (!name) return null;
  const override = CONDITION_LABEL_OVERRIDES[name];
  if (override) return override;
  return toTitleCase(name);
};

const formatTimeOfDay = (value) => {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
  return TIME_OF_DAY_LABELS[normalized] || toTitleCase(normalized);
};

const VERSION_GROUP_RELEASE_ORDER = [
  "legends-za",
  "scarlet-violet",
  "legends-arceus",
  "brilliant-diamond-shining-pearl",
  "sword-shield",
  "lets-go-pikachu-lets-go-eevee",
  "ultra-sun-ultra-moon",
  "sun-moon",
  "omega-ruby-alpha-sapphire",
  "x-y",
  "black-2-white-2",
  "black-white",
  "heartgold-soulsilver",
  "platinum",
  "diamond-pearl",
  "firered-leafgreen",
  "emerald",
  "ruby-sapphire",
  "crystal",
  "gold-silver",
  "yellow",
  "red-blue",
];

const VERSION_GROUP_ORDER_LOOKUP = new Map(
  VERSION_GROUP_RELEASE_ORDER.map((name, index) => [name, index])
);

const GAME_KEY_TO_VERSION_GROUPS = new Map([
  ["scarlet-violet", ["scarlet-violet"]],
  ["legends-arceus", ["legends-arceus"]],
  ["legends-za", ["legends-za"]],
  ["sword-shield", ["sword-shield"]],
  ["ultra-sun-ultra-moon", ["ultra-sun-ultra-moon"]],
  ["sun-moon", ["sun-moon"]],
  ["omega-ruby-alpha-sapphire", ["omega-ruby-alpha-sapphire"]],
  ["x-y", ["x-y"]],
  ["black-2-white-2", ["black-2-white-2"]],
  ["black-white", ["black-white"]],
  ["heartgold-soulsilver", ["heartgold-soulsilver"]],
  ["platinum", ["platinum"]],
  ["diamond-pearl", ["diamond-pearl"]],
  ["brilliant-diamond-shining-pearl", ["brilliant-diamond-shining-pearl"]],
  ["firered-leafgreen", ["firered-leafgreen"]],
  ["ruby-sapphire-emerald", ["emerald", "ruby-sapphire"]],
  ["gold-silver-crystal", ["crystal", "gold-silver"]],
  ["red-blue-yellow", ["yellow", "red-blue"]],
  ["lets-go", ["lets-go-pikachu-lets-go-eevee"]],
]);

const DEX_KEY_TO_VERSION_GROUPS = new Map([
  ["paldea", ["scarlet-violet"]],
  ["hisui", ["legends-arceus"]],
  ["galar", ["sword-shield"]],
  ["alola", ["ultra-sun-ultra-moon", "sun-moon"]],
  ["kalos", ["x-y"]],
  ["unova", ["black-2-white-2", "black-white"]],
  ["sinnoh", ["brilliant-diamond-shining-pearl", "platinum", "diamond-pearl"]],
  ["hoenn", ["omega-ruby-alpha-sapphire", "emerald", "ruby-sapphire"]],
  ["johto", ["heartgold-soulsilver", "crystal", "gold-silver"]],
  ["kanto", ["lets-go-pikachu-lets-go-eevee", "firered-leafgreen", "yellow", "red-blue"]],
]);

const VERSION_GROUP_LABEL_OVERRIDES = new Map([
  ["red-blue", "Red & Blue"],
  ["yellow", "Yellow"],
  ["gold-silver", "Gold & Silver"],
  ["crystal", "Crystal"],
  ["ruby-sapphire", "Ruby & Sapphire"],
  ["emerald", "Emerald"],
  ["firered-leafgreen", "FireRed & LeafGreen"],
  ["diamond-pearl", "Diamond & Pearl"],
  ["platinum", "Platinum"],
  ["heartgold-soulsilver", "HeartGold & SoulSilver"],
  ["black-white", "Black & White"],
  ["black-2-white-2", "Black 2 & White 2"],
  ["x-y", "X & Y"],
  ["omega-ruby-alpha-sapphire", "Omega Ruby & Alpha Sapphire"],
  ["sun-moon", "Sun & Moon"],
  ["ultra-sun-ultra-moon", "Ultra Sun & Ultra Moon"],
  ["lets-go-pikachu-lets-go-eevee", "Let's Go Pikachu & Let's Go Eevee"],
  ["sword-shield", "Sword & Shield"],
  ["brilliant-diamond-shining-pearl", "Brilliant Diamond & Shining Pearl"],
  ["legends-arceus", "Legends: Arceus"],
  ["scarlet-violet", "Scarlet & Violet"],
  ["legends-za", "Legends: Z-A"],
]);

const buildVersionGroupPreference = (gameKey, dexKey) => {
  const seen = new Set();
  const preference = [];
  const pushValue = (value) => {
    if (!value) return;
    const normalized = String(value).toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    preference.push(normalized);
  };
  const pushAll = (values) => {
    (values || []).forEach((value) => pushValue(value));
  };
  if (gameKey) {
    pushAll(GAME_KEY_TO_VERSION_GROUPS.get(gameKey));
  }
  if (dexKey) {
    pushAll(DEX_KEY_TO_VERSION_GROUPS.get(dexKey));
  }
  VERSION_GROUP_RELEASE_ORDER.forEach((value) => pushValue(value));
  return preference;
};

const formatVersionGroupLabel = (value) => {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
  if (VERSION_GROUP_LABEL_OVERRIDES.has(normalized)) {
    return VERSION_GROUP_LABEL_OVERRIDES.get(normalized);
  }
  return toTitleCase(normalized);
};

const formatMoveLevelLabel = (level) => {
  if (level == null) return null;
  if (level <= 0) return "Start";
  return `Lv. ${level}`;
};

const normalizeEncounterData = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const versionMap = new Map();

  for (const entry of entries) {
    const areaName = entry?.location_area?.name;
    if (!areaName) continue;
    const versionDetails = Array.isArray(entry?.version_details) ? entry.version_details : [];
    if (versionDetails.length === 0) continue;

    for (const detail of versionDetails) {
      const versionName = detail?.version?.name;
      if (!versionName) continue;

      const rawDetails = Array.isArray(detail?.encounter_details) ? detail.encounter_details : [];
      if (rawDetails.length === 0) continue;

      let versionEntry = versionMap.get(versionName);
      if (!versionEntry) {
        const logoFile = VERSION_LOGO_FILES.get(versionName);
        versionEntry = {
          version: versionName,
          label: toTitleCase(versionName),
          areas: new Map(),
          logos: logoFile ? [logoFile] : [],
        };
        versionMap.set(versionName, versionEntry);
      }

      const methodMap = new Map();
      for (const info of rawDetails) {
        const methodName = info?.method?.name || null;
        const descriptors = [];
        const timeLabel = formatTimeOfDay(info?.time_of_day);
        if (timeLabel) descriptors.push(timeLabel);
        const conditions = Array.isArray(info?.condition_values) ? info.condition_values : [];
        for (const condition of conditions) {
          const label = formatEncounterDescriptor(condition?.name);
          if (label) descriptors.push(label);
        }
        const uniqueDescriptors = Array.from(new Set(descriptors));
        const minLevel = info?.min_level ?? null;
        const maxLevel = info?.max_level ?? null;
        const chance = info?.chance ?? detail?.max_chance ?? null;
        const descriptorKey = uniqueDescriptors.slice().sort((a, b) => a.localeCompare(b)).join("|");
        const methodKey = [methodName || "", descriptorKey].join("::");
        const label =
          methodName && METHOD_LABEL_OVERRIDES[methodName]
            ? METHOD_LABEL_OVERRIDES[methodName]
            : methodName
            ? toTitleCase(methodName)
            : null;
        const existing = methodMap.get(methodKey);
        if (existing) {
          if (chance != null) {
            existing.chance =
              existing.chance != null ? Math.max(existing.chance, chance) : chance;
          }
          if (minLevel != null) {
            existing.minLevel =
              existing.minLevel != null ? Math.min(existing.minLevel, minLevel) : minLevel;
          }
          if (maxLevel != null) {
            existing.maxLevel =
              existing.maxLevel != null ? Math.max(existing.maxLevel, maxLevel) : maxLevel;
          }
          existing.descriptors = Array.from(
            new Set([...existing.descriptors, ...uniqueDescriptors])
          );
        } else {
          methodMap.set(methodKey, {
            key: methodKey,
            method: methodName,
            label,
            chance: chance != null ? chance : null,
            minLevel,
            maxLevel,
            descriptors: uniqueDescriptors,
          });
        }
      }

      if (methodMap.size === 0) continue;

      let versionArea = versionEntry.areas.get(areaName);
      if (!versionArea) {
        versionArea = {
          name: areaName,
          label: toTitleCase(areaName),
          methods: new Map(),
        };
        versionEntry.areas.set(areaName, versionArea);
      }

      methodMap.forEach((method) => {
        const existing = versionArea.methods.get(method.key);
        if (existing) {
          if (method.chance != null) {
            existing.chance =
              existing.chance != null ? Math.max(existing.chance, method.chance) : method.chance;
          }
          if (method.minLevel != null) {
            existing.minLevel =
              existing.minLevel != null
                ? Math.min(existing.minLevel, method.minLevel)
                : method.minLevel;
          }
          if (method.maxLevel != null) {
            existing.maxLevel =
              existing.maxLevel != null
                ? Math.max(existing.maxLevel, method.maxLevel)
                : method.maxLevel;
          }
          if (method.label && !existing.label) {
            existing.label = method.label;
          }
          existing.descriptors = Array.from(
            new Set([...existing.descriptors, ...method.descriptors])
          );
        } else {
          versionArea.methods.set(method.key, { ...method });
        }
      });
    }
  }

  const result = Array.from(versionMap.values()).map((versionEntry) => {
    const areas = Array.from(versionEntry.areas.values()).map((area) => {
      const methods = Array.from(area.methods.values()).map(({ key, ...rest }) => rest);
      methods.sort((a, b) => {
        const chanceA = a.chance ?? -1;
        const chanceB = b.chance ?? -1;
        if (chanceA !== chanceB) return chanceB - chanceA;
        const labelA = a.label || "";
        const labelB = b.label || "";
        if (labelA !== labelB) return labelA.localeCompare(labelB);
        return a.descriptors.join(", ").localeCompare(b.descriptors.join(", "));
      });
      return {
        name: area.name,
        label: area.label,
        methods,
      };
    });
    areas.sort((a, b) => a.label.localeCompare(b.label));

    let maxChance = 0;
    let totalMethods = 0;
    areas.forEach((area) => {
      area.methods.forEach((method) => {
        if (method.chance != null) {
          maxChance = Math.max(maxChance, method.chance);
        }
      });
      totalMethods += area.methods.length;
    });

    const totalLocations = areas.length;
    return {
      version: versionEntry.version,
      label: versionEntry.label,
      logos: Array.isArray(versionEntry.logos) ? versionEntry.logos.slice() : [],
      areas,
      totalLocations,
      totalMethods,
      maxChance,
      summary:
        totalLocations > 0 && totalMethods > 0
          ? `${totalLocations} ${totalLocations === 1 ? "location" : "locations"}`
          : "No wild encounters",
    };
  });

  result.sort((a, b) => {
    const orderA = VERSION_ORDER_LOOKUP.has(a.version)
      ? VERSION_ORDER_LOOKUP.get(a.version)
      : Number.POSITIVE_INFINITY;
    const orderB = VERSION_ORDER_LOOKUP.has(b.version)
      ? VERSION_ORDER_LOOKUP.get(b.version)
      : Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    return a.label.localeCompare(b.label);
  });
  return result;
};

const LOCAL_COMBINED_DATA_PATH = "/data/pokemon_all.json";

const combinedDataCache = {
  map: null,
  promise: null,
};

const normalizeLocalKey = (value) => {
  if (value == null) return "";
  let normalized = String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  normalized = normalized
    .replace(/pok[eé]mon/g, "pokemon")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ");
  normalized = normalized.replace(/[^a-z0-9]+/g, "-");
  normalized = normalized.replace(/-([a-z0-9])-(?=[a-z0-9]($|-))/g, "-$1");
  normalized = normalized.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return normalized;
};

const VERSION_ALIAS_LOOKUP = (() => {
  const map = new Map();
  const add = (alias, slug) => {
    const key = normalizeLocalKey(alias);
    if (!key || !slug) return;
    if (!map.has(key)) {
      map.set(key, slug);
    }
  };

  VERSION_RELEASE_SEQUENCE.forEach((slug) => {
    add(slug, slug);
    add(toTitleCase(slug), slug);
    add(formatDisplayName(slug), slug);
  });

  const extraAliases = [
    ["legends arceus", "legends-arceus"],
    ["legends: arceus", "legends-arceus"],
    ["pokemon legends arceus", "legends-arceus"],
    ["legends za", "legends-za"],
    ["legends: z-a", "legends-za"],
    ["pokemon legends za", "legends-za"],
    ["lets go pikachu", "lets-go-pikachu"],
    ["let's go pikachu", "lets-go-pikachu"],
    ["lets go, pikachu!", "lets-go-pikachu"],
    ["lets go eevee", "lets-go-eevee"],
    ["let's go eevee", "lets-go-eevee"],
    ["lets go, eevee!", "lets-go-eevee"],
  ];

  extraAliases.forEach(([alias, slug]) => add(alias, slug));

  return map;
})();

const VERSION_PARTNER_GROUP_DEFS = [
  ["scarlet", "violet"],
  ["brilliant-diamond", "shining-pearl"],
  ["sword", "shield"],
  ["lets-go-pikachu", "lets-go-eevee"],
  ["ultra-sun", "ultra-moon"],
  ["sun", "moon"],
  ["omega-ruby", "alpha-sapphire"],
  ["x", "y"],
  ["black-2", "white-2"],
  ["black", "white"],
  ["heartgold", "soulsilver"],
  ["diamond", "pearl"],
  ["firered", "leafgreen"],
  ["ruby", "sapphire", "emerald"],
  ["gold", "silver", "crystal"],
  ["red", "blue", "yellow"],
];

const VERSION_PARTNER_GROUP_SLUGS = VERSION_PARTNER_GROUP_DEFS.map((names) => {
  const slugs = Array.from(
    new Set(
      names
        .map((name) => {
          const normalized = normalizeLocalKey(name);
          if (!normalized) return null;
          return VERSION_ALIAS_LOOKUP.get(normalized) || normalized;
        })
        .filter(Boolean)
    )
  );
  return slugs.length >= 2 ? Object.freeze(slugs) : null;
}).filter(Boolean);

const VERSION_PARTNER_GROUPS = (() => {
  const map = new Map();
  VERSION_PARTNER_GROUP_SLUGS.forEach((group) => {
    group.forEach((slug) => {
      if (!map.has(slug)) {
        map.set(slug, group);
      }
    });
  });
  return map;
})();

const SPECIAL_VERSION_GROUPS = (() => {
  const baseEntries = [
    ["sv", ["scarlet", "violet"]],
    ["bdsp", ["brilliant-diamond", "shining-pearl"]],
    ["lza", ["legends-za"]],
    ["pla", ["legends-arceus"]],
    ["scarlet-violet", ["scarlet", "violet"]],
    ["brilliant-diamond-shining-pearl", ["brilliant-diamond", "shining-pearl"]],
    ["lets-go", ["lets-go-pikachu", "lets-go-eevee"]],
  ];

  const map = new Map();
  const register = (alias, values) => {
    if (!alias || !values || values.length === 0) return;
    const key = normalizeLocalKey(alias);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, values);
    }
  };

  baseEntries.forEach(([alias, values]) => register(alias, values));

  VERSION_PARTNER_GROUP_SLUGS.forEach((group) => {
    if (!group || group.length === 0) return;
    if (group.length === 1) {
      register(group[0], group);
      return;
    }

    const joinHyphen = group.join("-");
    register(joinHyphen, group);

    if (group.length === 2) {
      register(`${group[0]} and ${group[1]}`, group);
      register(`${group[0]} & ${group[1]}`, group);
    } else {
      const head = group.slice(0, -1).join("-");
      const last = group[group.length - 1];
      register(`${head} and ${last}`, group);
      register(`${group.slice(0, -1).join(", ")} & ${last}`, group);
      register(`${group.slice(0, -1).join(", ")} and ${last}`, group);
    }
  });

  return map;
})();

const mapGameCodeToVersions = (code) => {
  const normalized = normalizeLocalKey(code);
  if (!normalized) return [];
  if (SPECIAL_VERSION_GROUPS.has(normalized)) {
    return SPECIAL_VERSION_GROUPS.get(normalized) || [];
  }
  const slug = VERSION_ALIAS_LOOKUP.get(normalized);
  if (!slug) return [];
  const partnerGroup = VERSION_PARTNER_GROUPS.get(slug);
  if (partnerGroup && partnerGroup.length > 0) {
    return partnerGroup;
  }
  return [slug];
};

const compareVersionEntries = (a, b) => {
  const orderA = VERSION_ORDER_LOOKUP.has(a?.version)
    ? VERSION_ORDER_LOOKUP.get(a.version)
    : Number.POSITIVE_INFINITY;
  const orderB = VERSION_ORDER_LOOKUP.has(b?.version)
    ? VERSION_ORDER_LOOKUP.get(b.version)
    : Number.POSITIVE_INFINITY;
  if (orderA !== orderB) return orderA - orderB;
  const labelA = a?.label || "";
  const labelB = b?.label || "";
  return labelA.localeCompare(labelB);
};

const loadCombinedDataMap = async () => {
  if (combinedDataCache.map) return combinedDataCache.map;
  if (!combinedDataCache.promise) {
    combinedDataCache.promise = queuedFetch(LOCAL_COMBINED_DATA_PATH)
      .then((response) => {
        if (!response?.ok) {
          throw new Error(`Failed to load ${LOCAL_COMBINED_DATA_PATH}: ${response?.status ?? "unknown"}`);
        }
        return response.json();
      })
      .then((json) => {
        const map = new Map();

        const register = (key, record) => {
          const normalized = normalizeLocalKey(key);
          if (!normalized || !record) return;
          const bucket = map.get(normalized);
          if (bucket) {
            if (!bucket.includes(record)) bucket.push(record);
          } else {
            map.set(normalized, [record]);
          }
        };

        const processRecord = (record, fallbackName) => {
          if (!record || typeof record !== "object") return;
          if (fallbackName) register(fallbackName, record);
          if (typeof record.name === "string") register(record.name, record);
          if (typeof record.slug === "string") register(record.slug, record);

          if (Array.isArray(record.names)) {
            record.names.forEach((value) => {
              if (typeof value === "string") register(value, record);
            });
          }

          if (Array.isArray(record.aliases)) {
            record.aliases.forEach((value) => {
              if (typeof value === "string") register(value, record);
            });
          }

          if (record?.pokedex_entry?.name) register(record.pokedex_entry.name, record);

          if (Array.isArray(record?.encounters)) {
            record.encounters.forEach((encounter) => {
              if (encounter?.name) register(encounter.name, record);
            });
          }
        };

        if (Array.isArray(json)) {
          json.forEach((record) => {
            const fallbackName = typeof record?.name === "string" ? record.name : null;
            processRecord(record, fallbackName);
          });
        } else if (json && typeof json === "object") {
          Object.entries(json).forEach(([name, record]) => {
            processRecord(record, name);
          });
        }

        combinedDataCache.map = map;
        return map;
      })
      .catch((error) => {
        combinedDataCache.map = null;
        throw error;
      })
      .finally(() => {
        combinedDataCache.promise = null;
      });
  }
  return combinedDataCache.promise;
};

const normalizedKeyMatches = (left, right) => {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.startsWith(`${right}-`)) return true;
  if (right.startsWith(`${left}-`)) return true;
  return false;
};

const findCombinedRecords = async (nameCandidates = []) => {
  const map = await loadCombinedDataMap();
  if (!map || map.size === 0) return null;
  const normalizedCandidates = (nameCandidates || []).map(normalizeLocalKey).filter(Boolean);
  for (const candidate of normalizedCandidates) {
    const bucket = map.get(candidate);
    if (bucket && bucket.length > 0) return bucket;
  }
  for (const [key, bucket] of map.entries()) {
    if (normalizedCandidates.some((candidate) => normalizedKeyMatches(key, candidate))) {
      return bucket;
    }
  }
  return null;
};

async function loadLocalEncounterEntriesForPokemon(_pokemonId, ...nameCandidates) {
  const candidates = nameCandidates.filter(Boolean);
  const records = await findCombinedRecords(candidates);

  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  const versionMap = new Map();

  for (const record of records) {
    const encounterSources = [];

    if (Array.isArray(record?.encounters)) {
      encounterSources.push(...record.encounters);
    }

    if (record?.locations && typeof record.locations === "object" && !Array.isArray(record.locations)) {
      Object.entries(record.locations).forEach(([gameName, info]) => {
        if (!gameName) return;
        let description;
        if (Array.isArray(info)) {
          description = info
            .map((value) => String(value ?? "").trim())
            .filter(Boolean)
            .join("; ");
        } else if (info && typeof info === "object") {
          const candidates = ["text", "description", "details", "location", "note", "notes", "value"];
          let maybeText = null;
          for (const key of candidates) {
            const candidate = info?.[key];
            if (typeof candidate === "string" && candidate.trim()) {
              maybeText = candidate;
              break;
            }
          }
          if (!maybeText) {
            const joined = Object.values(info || {})
              .filter((value) => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
              .join("; ");
            maybeText = joined || null;
          }
          description = String(maybeText ?? "").trim();
        } else {
          description = String(info ?? "").trim();
        }

        if (!description) return;
        encounterSources.push({ location: description, games: [gameName] });
      });
    }

    for (const encounter of encounterSources) {
      const description = String(
        encounter?.location ?? encounter?.details ?? encounter?.note ?? encounter?.notes ?? ""
      ).trim();
      if (!description) continue;

      let games = [];
      if (Array.isArray(encounter?.games) && encounter.games.length > 0) games = encounter.games;
      else if (encounter?.game) games = [encounter.game];
      if (games.length === 0) continue;

      const versions = Array.from(
        new Set(
          games
            .flatMap((gameCode) => mapGameCodeToVersions(gameCode))
            .filter(Boolean)
        )
      );

      if (versions.length === 0) continue;

      for (const version of versions) {
        if (!versionMap.has(version)) versionMap.set(version, new Set());
        versionMap.get(version).add(description);
      }
    }
  }

  if (versionMap.size === 0) return [];

  const normalized = [];
  for (const [version, descriptions] of versionMap.entries()) {
    const descriptionList = Array.from(descriptions);
    if (descriptionList.length === 0) continue;
    const logoFile = VERSION_LOGO_FILES.get(version);
    const methods = descriptionList.map((text, idx) => ({
      key: `local-${version}-${idx}`,
      method: null,
      label: `Location ${idx + 1}`,
      chance: null,
      minLevel: null,
      maxLevel: null,
      descriptors: [],
      description: text,
    }));
    const count = methods.length;
    normalized.push({
      version,
      label: formatDisplayName(version),
      logos: logoFile ? [logoFile] : [],
      areas: [
        {
          name: `local-${version}`,
          label: "Locations",
          methods,
        },
      ],
      totalLocations: count,
      totalMethods: count,
      maxChance: 0,
      summary: count > 0 ? `${count} ${count === 1 ? "location" : "locations"}` : "No wild encounters",
      __local: true,
    });
  }

  normalized.sort(compareVersionEntries);
  return normalized;
}

async function loadLocalPokedexEntriesForSpecies(_speciesId, ...nameCandidates) {
  const candidates = nameCandidates.filter(Boolean);
  const records = await findCombinedRecords(candidates);

  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  const versionTextMap = new Map();

  const addVersionText = (version, text, language) => {
    const cleaned = String(text ?? "").trim();
    if (!cleaned) return;
    const normalizedVersion = normalizeLocalKey(version) || String(version ?? "").trim();
    if (!normalizedVersion) return;
    if (!versionTextMap.has(normalizedVersion)) {
      versionTextMap.set(normalizedVersion, {
        text: cleaned,
        language: (language || "en").toLowerCase(),
      });
    }
  };

  const addTextForGames = (games, text, language) => {
    const cleaned = String(text ?? "").trim();
    if (!cleaned) return;
    const list = Array.isArray(games) ? games.filter(Boolean) : games ? [games] : [];
    if (list.length === 0) return;

    list.forEach((gameCode) => {
      const versions = mapGameCodeToVersions(gameCode);
      const normalizedGame = normalizeLocalKey(gameCode);
      const targets = versions.length > 0 ? versions : normalizedGame ? [normalizedGame] : [];
      targets.forEach((version) => addVersionText(version, cleaned, language));
    });
  };

  const processRecord = (record) => {
    if (!record || typeof record !== "object") return;

    const entry = record?.pokedex_entry;
    if (entry) {
      const text = entry?.entry ?? entry?.text;
      addTextForGames(entry?.games ?? entry?.game, text, entry?.language);
    }

    const entries = record?.entries;
    if (Array.isArray(entries)) {
      entries.forEach((item) => {
        if (!item || typeof item !== "object") return;
        const text = item?.text ?? item?.entry;
        const language = item?.language;
        const targets = [];
        if (item?.version) targets.push(item.version);
        if (item?.versions && Array.isArray(item.versions)) targets.push(...item.versions);
        if (targets.length > 0) {
          targets.forEach((version) => addVersionText(version, text, language));
        }
        addTextForGames(item?.games ?? item?.game, text, language);
      });
    } else if (entries && typeof entries === "object") {
      Object.entries(entries).forEach(([gameName, value]) => {
        if (!gameName) return;
        let text = value;
        let language = "en";
        if (value && typeof value === "object") {
          if (typeof value.text === "string") text = value.text;
          else if (typeof value.entry === "string") text = value.entry;
          if (typeof value.language === "string") language = value.language;
        }
        addTextForGames(gameName, text, language);
      });
    }
  };

  records.forEach(processRecord);

  return Array.from(versionTextMap.entries()).map(([version, info]) => ({
    version,
    text: info.text,
    language: info.language || "en",
  }));
}

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
        if (String(formName).toLowerCase().includes("totem")) return null;
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

function EvolutionDetailModal({ data, onClose, currentForm, pokemonName }) {
  const handleBackdropMouseDown = (event) => {
    event.stopPropagation();
    onClose();
  };

  const handleModalMouseDown = (event) => {
    event.stopPropagation();
  };

  const humanize = (s) => String(s || "").replace(/-/g, " ");
  const humanizeName = (name) => name?.replace(/-/g, " ");
  
  if (!data) return null;

    const isAlternateForm = currentForm?.tags?.some(tag => 
    tag === 'Alolan' || tag === 'Galarian' || tag === 'Hisuian' || 
    tag === 'Paldean' || tag === 'Regional' || tag === 'Mega' || 
    tag === 'Primal' || tag === 'Gigantamax'
  );
  
  const formName = currentForm?.displayName || humanizeName(pokemonName);
  const displayTitle = isAlternateForm ? `Evolution Details (${formName})` : 'Evolution Requirement Details';

  const trigger = data.trigger?.name;
  const item = data.item?.name;
  const heldItem = data.held_item?.name;
  const knownMove = data.known_move?.name;
  const knownMoveType = data.known_move_type?.name;
  const location = data.location?.name;
  const partySpecies = data.party_species?.name;
  const partyType = data.party_type?.name;
  const tradeSpecies = data.trade_species?.name;

  const evolutionRequirements = [];

  if (trigger) {
    evolutionRequirements.push({
      label: "Trigger",
      value: humanize(trigger),
    });
  }

  if (data.min_level != null) {
    evolutionRequirements.push({
      label: "Minimum Level",
      value: `Level ${data.min_level}`,
    });
  }

  if (data.min_happiness != null) {
    evolutionRequirements.push({
      label: "Happiness",
      value: `${data.min_happiness} happiness`,
    });
  }

  if (data.min_affection != null) {
    evolutionRequirements.push({
      label: "Affection",
      value: `${data.min_affection} affection`,
    });
  }

  if (data.min_beauty != null) {
    evolutionRequirements.push({
      label: "Beauty",
      value: `${data.min_beauty} beauty`,
    });
  }

  if (data.gender === 1) {
    evolutionRequirements.push({
      label: "Gender",
      value: "Female",
    });
  } else if (data.gender === 2) {
    evolutionRequirements.push({
      label: "Gender",
      value: "Male",
    });
  }

  if (data.time_of_day) {
    evolutionRequirements.push({
      label: "Time of Day",
      value: data.time_of_day === "day" ? "Daytime" : humanize(data.time_of_day),
    });
  }

  if (data.needs_overworld_rain) {
    evolutionRequirements.push({
      label: "Weather",
      value: "Raining",
    });
  }

  if (item) {
    evolutionRequirements.push({
      label: "Item Required",
      value: humanize(item),
      icon: item.includes("stone") 
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item}.png`
        : null,
    });
  }

  if (heldItem) {
    evolutionRequirements.push({
      label: "Held Item",
      value: humanize(heldItem),
      icon: heldItem.includes("stone")
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${heldItem}.png`
        : null,
    });
  }

  if (tradeSpecies) {
    evolutionRequirements.push({
      label: "Trade Partner",
      value: humanizeName(tradeSpecies),
    });
  }

  if (partySpecies) {
    evolutionRequirements.push({
      label: "Party Member",
      value: `Must have ${humanizeName(partySpecies)} in party`,
    });
  }

  if (partyType) {
    evolutionRequirements.push({
      label: "Party Type",
      value: `Must have ${humanize(partyType)} type Pokémon in party`,
    });
  }

  if (location) {
    evolutionRequirements.push({
      label: "Location",
      value: humanize(location),
    });
  }

  if (knownMove) {
    evolutionRequirements.push({
      label: "Known Move",
      value: humanizeName(knownMove),
    });
  }

  if (knownMoveType) {
    evolutionRequirements.push({
      label: "Known Move Type",
      value: `Must know a ${humanize(knownMoveType)} type move`,
    });
  }

  return (
    <div className="game-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <div
        className="game-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={handleModalMouseDown}
        style={{ width: "min(560px, 90vw)" }}
      >
        <button type="button" className="game-modal-close" onClick={onClose} aria-label="Close">
          X
        </button>
        <div className="game-modal-header">
          <h2 className="game-modal-title">
            {displayTitle}
          </h2>
          <p className="game-modal-subtitle">
            {isAlternateForm 
              ? `Evolution conditions for ${formName}` 
              : 'Complete conditions for this evolution method'}
          </p>
        </div>
        <div className="game-modal-body" style={{ gridTemplateColumns: "1fr" }}>
          <div className="game-modal-column game-modal-column-left" style={{ overflowY: "auto" }}>
            {evolutionRequirements.length > 0 ? (
              <ul className="game-modal-game-options">
                {evolutionRequirements.map((req, idx) => (
                  <li key={idx}>
                    <div
                      className="game-modal-method"
                      style={{
                        borderRadius: "12px",
                        border: "1px solid rgba(148, 163, 184, 0.18)",
                        background: "rgba(15, 23, 42, 0.55)",
                        padding: "10px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      {req.icon && (
                        <img
                          src={req.icon}
                          alt=""
                          width={32}
                          height={32}
                          style={{
                            imageRendering: "pixelated",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "6px",
                            padding: "2px",
                          }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: "#e2e8f0", marginBottom: "2px" }}>
                          {req.label}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                          {req.value}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="game-modal-empty">
                No specific requirements for this evolution method.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PokedexEntriesModal({ versions, selectedVersion, onSelect, onClose, pokemonName }) {
  const handleBackdropMouseDown = (event) => {
    event.stopPropagation();
    onClose();
  };

  const handleModalMouseDown = (event) => {
    event.stopPropagation();
  };

  const getVersionLogo = (versionName) => {
    const logoFile = VERSION_LOGO_FILES.get(versionName);
    return logoFile ? GAME_LOGO_LOOKUP.get(logoFile) : null;
  };

  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => {
      const orderA = VERSION_ORDER_LOOKUP.has(a.name)
        ? VERSION_ORDER_LOOKUP.get(a.name)
        : Number.NEGATIVE_INFINITY;
      const orderB = VERSION_ORDER_LOOKUP.has(b.name)
        ? VERSION_ORDER_LOOKUP.get(b.name)
        : Number.NEGATIVE_INFINITY;

      if (orderA !== orderB) return orderB - orderA;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [versions]);

  return (
    <div className="game-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <div
        className="game-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={handleModalMouseDown}
        style={{ width: "min(560px, 90vw)" }}
      >
        <button type="button" className="game-modal-close" onClick={onClose} aria-label="Close">
          X
        </button>
        <div className="game-modal-header">
          <h2 className="game-modal-title">
            Pokedex Entries for <span className="game-modal-title-name text-capitalize">{formatDisplayName(pokemonName)}</span>
          </h2>
          <p className="game-modal-subtitle">
            Select a version to view its Pokedex entry
          </p>
        </div>
        <div className="game-modal-body" style={{ gridTemplateColumns: "1fr" }}>
          <div className="game-modal-column game-modal-column-left" style={{ overflowY: "auto" }}>
            <ul className="game-modal-game-options">
              {sortedVersions.map((version) => {
                const logo = getVersionLogo(version.name);
                const isSelected = version.name === selectedVersion;
                return (
                  <li key={version.name}>
                    <button
                      type="button"
                      className={`game-modal-game-button${isSelected ? " is-active" : ""}`}
                      onClick={() => onSelect(version.name)}
                    >
                      {logo && (
                        <span className="game-modal-game-logos">
                          <img src={logo} alt="" className="game-modal-game-logo" />
                        </span>
                      )}
                      <div className="game-modal-game-info">
                        <div className="game-modal-game-name text-capitalize">{version.displayName}</div>
                        {version.text && (
                          <div className="game-modal-game-summary" style={{ 
                            fontSize: "0.8rem", 
                            color: "#94a3b8",
                            fontStyle: "italic",
                            lineHeight: "1.3",
                            marginTop: "4px"
                          }}>
                            {version.text}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function LearnsetModal({ learnset, learnsetMeta, pokemonName, onClose, moveDetailsMap }) {
  const handleBackdropMouseDown = (event) => {
    event.stopPropagation();
    onClose();
  };

  const handleModalMouseDown = (event) => {
    event.stopPropagation();
  };

  const renderMoveItem = (move, category) => {
    const details = moveDetailsMap.get(move.name);
    const moveType = details?.type || 'normal';
    const typeColor = getTypeColor(moveType);
    
    return (
      <li key={move.name} className="learnset-item-single">
        <div className="learnset-move-row">
          <div className={`learnset-move-pill type-${moveType}`} style={{
            background: `linear-gradient(135deg, ${typeColor}, ${typeColor}dd)`,
            borderColor: `${typeColor}cc`,
          }}>
            <div className="learnset-move-name-wrapper">
              {details?.type && (
                <img 
                  src={getTypeIconUrl(details.type)} 
                  alt={details.type} 
                  className="learnset-move-type-icon"
                />
              )}
              <span className="learnset-move-name">{move.label}</span>
            </div>
            {category === 'levelUp' && move.levelLabel && (
              <span className="learnset-move-level-badge">{move.levelLabel}</span>
            )}
            {category === 'tm' && <span className="learnset-move-badge">TM</span>}
            {category === 'hm' && <span className="learnset-move-badge">HM</span>}
          </div>
          <div className="learnset-move-details">
            <span className="learnset-move-detail">
              <span className="learnset-detail-label">Power</span>
              <span className="learnset-detail-value">
                {details?.power != null ? details.power : '—'}
              </span>
            </span>
            <span className="learnset-move-detail">
              <span className="learnset-detail-label">Acc</span>
              <span className="learnset-detail-value">
                {details?.accuracy != null ? `${details.accuracy}%` : '—'}
              </span>
            </span>
            <span className="learnset-move-detail">
              <span className="learnset-detail-label">PP</span>
              <span className="learnset-detail-value">
                {details?.pp != null ? details.pp : '—'}
              </span>
            </span>
            <span className="learnset-move-detail">
              <span className="learnset-detail-label">Class</span>
              <span className={`learnset-detail-value learnset-damage-class learnset-damage-class-${details?.damage_class || ''}`}>
                {details?.damage_class ? (
                  <>
                    <img 
                      src={`/moves/${details.damage_class}.png`} 
                      alt={details.damage_class}
                      className="learnset-damage-class-icon"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    {details.damage_class}
                  </>
                ) : '—'}
              </span>
            </span>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="game-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <div
        className="game-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={handleModalMouseDown}
        style={{ width: "min(800px, 92vw)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <button type="button" className="game-modal-close" onClick={onClose} aria-label="Close learned moves">
          X
        </button>
        <div className="game-modal-header">
          <h2 className="game-modal-title">
            Learned Moves for <span className="game-modal-title-name text-capitalize">{formatDisplayName(pokemonName)}</span>
          </h2>
          {learnsetMeta.versionGroupLabel ? (
            <p className="game-modal-subtitle">
              {learnsetMeta.hasMixedSources ? "Latest data: " : "Data source: "}
              {learnsetMeta.versionGroupLabel}
            </p>
          ) : null}
        </div>
        <div className="game-modal-body" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="game-modal-column game-modal-column-left" style={{ flex: 1, overflowY: "auto", paddingRight: "8px" }}>
            <div className="learnset-modal-content">
              {learnset.levelUp.length > 0 && (
                <div className="learnset-section">
                  <div className="learnset-section-title">
                    Level Up Moves ({learnsetMeta.levelCount})
                  </div>
                  <ul className="learnset-list-single">
                    {learnset.levelUp.map((move) => renderMoveItem(move, 'levelUp'))}
                  </ul>
                </div>
              )}
              {learnset.tm && learnset.tm.length > 0 && (
                <div className="learnset-section">
                  <div className="learnset-section-title">
                    TM Moves ({learnsetMeta.tmCount})
                  </div>
                  <ul className="learnset-list-single">
                    {learnset.tm.map((move) => renderMoveItem(move, 'tm'))}
                  </ul>
                </div>
              )}
              {learnset.hm && learnset.hm.length > 0 && (
                <div className="learnset-section">
                  <div className="learnset-section-title">
                    HM Moves ({learnsetMeta.hmCount})
                  </div>
                  <ul className="learnset-list-single">
                    {learnset.hm.map((move) => renderMoveItem(move, 'hm'))}
                  </ul>
                </div>
              )}
              {learnsetMeta.hasMixedSources && (
                <div className="learnset-footnote">Includes moves from multiple game versions.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlternateFormsModal({ forms, onClose, onSelectPokemon, title, shiny = false }) {
  const handleBackdropMouseDown = (event) => {
    event.stopPropagation();
    onClose();
  };

  const handleModalMouseDown = (event) => {
    event.stopPropagation();
  };

  if (!Array.isArray(forms) || forms.length === 0) return null;

  return (
    <div className="game-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <div
        className="game-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={handleModalMouseDown}
        style={{ width: "min(720px, 92vw)" }}
      >
        <button type="button" className="game-modal-close" onClick={onClose} aria-label="Close alternate forms">
          X
        </button>
        <div className="game-modal-header">
          <h2 className="game-modal-title">{title || "Alternate Forms"}</h2>
          <p className="game-modal-subtitle">Select a form to view details</p>
        </div>
        <div className="game-modal-body" style={{ gridTemplateColumns: "1fr" }}>
          <div className="game-modal-column game-modal-column-left" style={{ overflowY: "auto" }}>
            <div className="forms-grid">
              {forms.map((form) => {
                const formId = form?.id != null ? String(form.id) : null;
                if (!formId) return null;
                const formName = form.displayName || humanizeName(form.name);
                return (
                  <button
                    key={formId}
                    type="button"
                    className="form-card"
                    onClick={() => {
                      onSelectPokemon?.(formId, form.name, `https://pokeapi.co/api/v2/pokemon/${formId}`);
                      onClose();
                    }}
                    title={formName}
                  >
                    <SpriteImage id={form.id} alt={form.name} width={72} height={72} loading="lazy" shiny={shiny} />
                    <div className="form-name">{formName}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [pokemon, setPokemon] = useState([]);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState(() => new Set());
  const [selectedTags, setSelectedTags] = useState(() => new Set());
  const [selectedDex, setSelectedDex] = useState("national");
  const [selectedGame, setSelectedGame] = useState(null);
  const [shiny, setShiny] = useState(() => {
    try {
      return localStorage.getItem("pref:shiny") === "1";
    } catch {
      return false;
    }
  });
  const [dexIndexes, setDexIndexes] = useState(() => new Map());
  const [gameIndexes, setGameIndexes] = useState(() => new Map());
  const typeIndexRef = useRef(new Map());
  const specialTagCacheRef = useRef(new Map());
  const gameFiltersRef = useRef(null);
  const pokedexCacheRef = useRef(new Map());
  const pokedexPromiseRef = useRef(new Map());
  const [bootSelection, setBootSelection] = useState(() => {
    try {
      const current = new URL(window.location.href);
      const slug = getPokemonSlugFromPath(current.pathname);
      if (slug) {
        return { type: "slug", value: slug };
      }
      const legacy = current.searchParams.get("p");
      if (legacy) {
        return { type: "legacy", value: legacy };
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      ["i", "m", "a"].forEach((k) => u.searchParams.delete(k));
      window.history.replaceState({}, "", u);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pref:shiny", shiny ? "1" : "0");
    } catch {}
  }, [shiny]);

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

  const findPokemonBySlug = useCallback(
    (slug) => {
      const normalized = normalizePokemonSlug(slug);
      if (!normalized) return null;
      return pokemon.find((entry) => normalizePokemonSlug(entry?.name) === normalized) || null;
    },
    [pokemon]
  );

  const findPokemonById = useCallback(
    (id) => {
      const idStr = String(id || "").trim();
      if (!idStr) return null;
      return pokemon.find((entry) => getIdFromUrl(entry?.url) === idStr) || null;
    },
    [pokemon]
  );

  const findPokemonByIdentifier = useCallback(
    (value) => {
      if (value == null) return null;
      const bySlug = findPokemonBySlug(value);
      if (bySlug) return bySlug;
      return findPokemonById(value);
    },
    [findPokemonBySlug, findPokemonById]
  );

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

  const REGION_CANON_MAP = useMemo(() => new Map([
    ["alola", "alola"],
    ["alolan", "alola"],
    ["galar", "galar"],
    ["galarian", "galar"],
    ["hisui", "hisui"],
    ["hisuan", "hisui"],
    ["paldea", "paldea"],
    ["paldean", "paldea"],
  ]), []);

  const activeRegionKey = useMemo(() => {
    if (selectedDex && selectedDex !== "national") return selectedDex;
    if (selectedGame) {
      const gameCfg = GAME_LOOKUP.get(selectedGame);
      return gameCfg?.dexKey || null;
    }
    return null;
  }, [selectedDex, selectedGame]);

  const regionFormsBySpecies = useMemo(() => {
    const result = new Map();
    for (const entry of pokemon) {
      const idStr = getIdFromUrl(entry?.url);
      const idNum = Number(idStr);
      if (!idStr || Number.isNaN(idNum)) continue;
      const lowerName = String(entry?.name || "").toLowerCase();
      const speciesId = resolveSpeciesId(lowerName, idNum < 10000 ? idNum : null);
      if (speciesId == null) continue;
      let bucket = result.get(speciesId);
      if (!bucket) {
        bucket = new Map();
        result.set(speciesId, bucket);
      }
      // Track default/base form (prefer < 10000 ids without regional token)
      if (!bucket.has("default") && idNum < 10000) {
        bucket.set("default", entry);
      }
      // Track regional variants
      const tokens = lowerName.split("-");
      for (const token of tokens) {
        const canon = REGION_CANON_MAP.get(token);
        if (canon && !bucket.has(canon)) {
          bucket.set(canon, entry);
          break;
        }
      }
    }
    return result;
  }, [pokemon, resolveSpeciesId, REGION_CANON_MAP]);

  const getRegionPreferredEntry = useCallback((entry) => {
    if (!entry || !activeRegionKey) return entry;
    const idStr = getIdFromUrl(entry?.url);
    const idNum = Number(idStr);
    if (!idStr || Number.isNaN(idNum)) return entry;
    const lowerName = String(entry?.name || "").toLowerCase();
    const speciesId = resolveSpeciesId(lowerName, idNum < 10000 ? idNum : null);
    if (speciesId == null) return entry;
    const bucket = regionFormsBySpecies.get(speciesId);
    if (!bucket) return entry;
    const regional = bucket.get(activeRegionKey);
    return regional || entry;
  }, [activeRegionKey, regionFormsBySpecies, resolveSpeciesId]);

  // moved earlier

  useEffect(() => {
    fetch("https://pokeapi.co/api/v2/pokemon?limit=100000&offset=0")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : [];
        // Filter out any Totem forms from the root list
        const filtered = list.filter((entry) => !String(entry?.name || "").toLowerCase().includes("totem"));
        setPokemon(filtered);
      });
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
            const baseApiNames =
              game.apiNames && game.apiNames.length > 0 ? game.apiNames : cfg.apiNames;
            const entryMap = await loadEntryMap(baseApiNames);
            let sections = null;
            if (Array.isArray(game.sections) && game.sections.length > 0) {
              const sectionResults = await Promise.all(
                game.sections.map(async (section, index) => {
                  const sectionApiNames =
                    section?.apiNames && section.apiNames.length > 0 ? section.apiNames : baseApiNames;
                  const sectionEntryMap = await loadEntryMap(sectionApiNames);
                  return {
                    key: section?.key || section?.label || `section-${index}`,
                    label: section?.label ?? null,
                    apiNames: sectionApiNames,
                    entryMap: sectionEntryMap,
                  };
                })
              );
              sections = sectionResults;
            }
            if (!cancelled) {
              gameEntries.set(game.key, {
                key: game.key,
                label: game.label,
                entryMap,
                sections,
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
            next.set(gameKey, { entryMap: info.entryMap, sections: info.sections || null });
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
    const cfg = GAME_LOOKUP.get(selectedGame);
    if (!cfg) return;
    const needsSections = Array.isArray(cfg.sections) && cfg.sections.length > 0;
    const existing = gameIndexes.get(selectedGame);
    const existingEntryMap = existing instanceof Map ? existing : existing?.entryMap ?? null;
    const existingSections = existing instanceof Map ? null : existing?.sections ?? null;
    if (existingEntryMap && (!needsSections || (existingSections && existingSections.length > 0))) {
      return;
    }
    let cancelled = false;
    const loadGame = async () => {
      try {
        const entryMap = existingEntryMap || (await loadEntryMap(cfg.apiNames || []));
        let sections = existingSections;
        if (needsSections && (!sections || sections.length === 0)) {
          const sectionResults = await Promise.all(
            cfg.sections.map(async (section, index) => {
              const sectionApiNames =
                section?.apiNames && section.apiNames.length > 0 ? section.apiNames : cfg.apiNames;
              const sectionEntryMap = await loadEntryMap(sectionApiNames || []);
              return {
                key: section?.key || section?.label || `section-${index}`,
                label: section?.label ?? null,
                apiNames: sectionApiNames,
                entryMap: sectionEntryMap,
              };
            })
          );
          sections = sectionResults;
        }
        if (cancelled) return;
        setGameIndexes((prev) => {
          const next = new Map(prev);
          next.set(selectedGame, { entryMap, sections: sections || null });
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

  // Apply initial selection derived from URL once data loads
  useEffect(() => {
    if (!pokemon.length) return;
    if (!bootSelection) return;

    const finalizeSelection = (entry, shouldReplace) => {
      if (!entry) {
        setSelected(null);
        setBootSelection(null);
        return;
      }
      const id = getIdFromUrl(entry.url);
      const name = entry.name || `pokemon-${id}`;
      setSelected({ id, name, url: entry.url });
      if (shouldReplace) {
        updatePokemonLocation(name, { replace: true, pruneKeys: ["i", "m", "a", "p"] });
      }
      setBootSelection(null);
    };

    if (bootSelection.type === "slug") {
      const match = findPokemonByIdentifier(bootSelection.value);
      const shouldReplace = !!(match && normalizePokemonSlug(bootSelection.value) !== normalizePokemonSlug(match.name));
      finalizeSelection(match, shouldReplace);
      return;
    }

    if (bootSelection.type === "legacy") {
      const match = findPokemonByIdentifier(bootSelection.value);
      finalizeSelection(match, true);
      return;
    }

    setBootSelection(null);
  }, [pokemon, bootSelection, findPokemonBySlug, findPokemonByIdentifier]);

  const resolveSelectionFromLocation = useCallback(() => {
    try {
      const slug = getPokemonSlugFromLocation();
      if (slug) {
        const match = findPokemonByIdentifier(slug);
        if (match) {
          const id = getIdFromUrl(match.url);
          const name = match.name || `pokemon-${id}`;
          if (normalizePokemonSlug(slug) !== normalizePokemonSlug(name)) {
            updatePokemonLocation(name, { replace: true, pruneKeys: ["i", "m", "a", "p"] });
            return;
          }
          setSelected({ id, name, url: match.url });
          return;
        }
      }

      const u = new URL(window.location.href);
      const legacy = u.searchParams.get("p");
      if (legacy) {
        const match = findPokemonByIdentifier(legacy);
        if (match) {
          const id = getIdFromUrl(match.url);
          const name = match.name || `pokemon-${id}`;
          setSelected({ id, name, url: match.url });
          updatePokemonLocation(name, { replace: true, pruneKeys: ["i", "m", "a", "p"] });
          return;
        }
      }
    } catch {}
    setSelected(null);
  }, [findPokemonByIdentifier, updatePokemonLocation, normalizePokemonSlug]);

  // Handle back/forward navigation to sync selection
  useEffect(() => {
    const onPop = () => {
      resolveSelectionFromLocation();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [resolveSelectionFromLocation]);

  useEffect(() => {
    if (!pokemon.length) return;
    if (bootSelection) return;
    resolveSelectionFromLocation();
  }, [pokemon, bootSelection, resolveSelectionFromLocation]);

  const selectPokemon = (id, name, url, options) => {
    const opts = options || {};
    if (opts.forceNational) {
      setSelectedDex("national");
      setSelectedGame(null);
    }
    // If preferExact is set, do not remap to region-preferred form
    let target = { name, url };
    if (!opts.preferExact) {
      try {
        if (url) {
          const pref = getRegionPreferredEntry({ name, url });
          if (pref && pref.url) target = pref;
        }
      } catch {}
    }
    const parts = (target.url || "").split("/").filter(Boolean);
    const prefId = parts[parts.length - 1] || id;
    const targetName = target.name || name || `pokemon-${prefId}`;
    updatePokemonLocation(targetName, { pruneKeys: ["i", "m", "a", "p"] });
    setSelected({ id: prefId, name: targetName, url: target.url || url });
  };

  const clearSelection = () => {
    updatePokemonLocation(null, { pruneKeys: ["i", "m", "a", "p"] });
    setSelected(null);
  };

  // When region changes, migrate current selection to region-preferred form if available
  useEffect(() => {
    if (!selected) return;
    const { id, name, url } = selected;
    if (!url) return;
    const pref = getRegionPreferredEntry({ name, url });
    if (pref && pref.url && pref.url !== url) {
      const parts = pref.url.split("/").filter(Boolean);
      const prefId = parts[parts.length - 1] || id;
      updatePokemonLocation(pref.name, { pruneKeys: ["i", "m", "a", "p"] });
      setSelected({ id: prefId, name: pref.name, url: pref.url });
    }
  }, [activeRegionKey]);

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
    const regionGameEntry =
      selectedDex !== "national" && selectedGame ? dexData?.games?.get(selectedGame) ?? null : null;
    const regionGameEntryMap = regionGameEntry?.entryMap ?? null;
    let nationalGameEntry = null;
    if (selectedDex === "national" && selectedGame) {
      const stored = gameIndexes.get(selectedGame) ?? null;
      if (stored instanceof Map) {
        nationalGameEntry = { entryMap: stored, sections: null };
      } else if (stored) {
        nationalGameEntry = stored;
      }
    }
    const nationalGameEntryMap = nationalGameEntry?.entryMap ?? null;
    if (selectedDex === "national" && selectedGame && !nationalGameEntryMap) {
      return [];
    }
    const activeEntryMap =
      selectedDex === "national" ? nationalGameEntryMap : regionGameEntryMap ?? combinedMap;
    const activeSections =
      selectedDex === "national"
        ? nationalGameEntry?.sections ?? null
        : regionGameEntry?.sections ?? null;
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

    // Build the set of species to consider based on the active dex/game (or all species if none)
    const speciesIdsToConsider = activeEntryMap
      ? Array.from(activeEntryMap.keys())
      : Array.from(regionFormsBySpecies.keys());

    // Primary list: one representative per species, preferring regional form when applicable
    for (const speciesId of speciesIdsToConsider) {
      const bucket = regionFormsBySpecies.get(speciesId);
      if (!bucket) continue;
      const representative = (activeRegionKey ? bucket.get(activeRegionKey) : null) || bucket.get("default") || null;
      if (!representative) continue;

      const idStr = getIdFromUrl(representative.url);
      if (!idStr) continue;
      const idNum = Number(idStr);
      if (Number.isNaN(idNum)) continue;

      // Filters: type, tags, query
      if (hasTypeFilter && (!typeIntersection || !typeIntersection.has(representative.name))) {
        continue;
      }
      if (hasTagFilter) {
        const repTags = getTagsForName(representative.name);
        let hasAllTags = true;
        for (const tag of requiredTags) {
          if (!repTags.includes(tag)) {
            hasAllTags = false;
            break;
          }
        }
        if (!hasAllTags) continue;
      }
      if (q || qDigits) {
        let matchedQuery = false;
        const lower = representative.name.toLowerCase();
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

      regularMatches.push({ entry: representative, idNum, speciesId });
    }

    // Secondary list: Mega/Gigantamax forms that belong to included species
    for (const p of pokemon) {
      const idStr = getIdFromUrl(p.url);
      if (!idStr) continue;
      const idNum = Number(idStr);
      if (Number.isNaN(idNum)) continue;
      const tags = getTagsForName(p.name);
      const speciesId = resolveSpeciesId(p.name, idNum < 10000 ? idNum : null);
      const isMega = tags.includes("Mega");
      const isGmax = tags.includes("Gigantamax");
      const isMegaOrGmax = isMega || isGmax;
      if (!isMegaOrGmax) continue;
      if (speciesId == null || !speciesIdsToConsider.includes(speciesId)) continue;
      // Gate by selected game/region feature support
      if (selectedGame) {
        const gf = GAME_FEATURES.get(selectedGame) || { mega: false, gmax: false };
        if ((isMega && !gf.mega) || (isGmax && !gf.gmax)) continue;
      } else if (selectedDex && selectedDex !== "national") {
        const rf = REGION_FEATURES.get(selectedDex) || { mega: false, gmax: false };
        if ((isMega && !rf.mega) || (isGmax && !rf.gmax)) continue;
      } else {
        // National dex without a game selected: allow both
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
      megaGmaxMatches.push({ entry: p, idNum, speciesId });
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

    let primarySectionGroups = null;
    const normalizedSections = Array.isArray(activeSections)
      ? activeSections
          .map((section, index) => {
            if (!section) return null;
            const entryMap = section.entryMap instanceof Map ? section.entryMap : null;
            if (!entryMap) return null;
            return {
              key: section.key || section.label || `section-${index}`,
              label: section.label ?? null,
              entryMap,
            };
          })
          .filter(Boolean)
      : [];
    if (normalizedSections.length > 0) {
      const sectionBuckets = normalizedSections.map(() => []);
      const fallbackEntries = [];
      const resolveLookupId = (match) => {
        const preferred = match.speciesId ?? (match.idNum < 10000 ? match.idNum : null);
        return preferred ?? match.idNum;
      };
      for (const match of regularMatches) {
        const lookupId = resolveLookupId(match);
        let assigned = false;
        for (let idx = 0; idx < normalizedSections.length; idx++) {
          const sectionMap = normalizedSections[idx].entryMap;
          if (sectionMap?.has(lookupId)) {
            sectionBuckets[idx].push(match.entry);
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          fallbackEntries.push(match.entry);
        }
      }
      const groups = [];
      if (fallbackEntries.length > 0) {
        groups.push({ key: "ungrouped", label: null, entries: fallbackEntries });
      }
      normalizedSections.forEach((section, index) => {
        const entries = sectionBuckets[index];
        if (!entries || entries.length === 0) return;
        groups.push({ key: section.key || `section-${index}`, label: section.label ?? null, entries });
      });
      if (groups.length > 0) {
        primarySectionGroups = groups;
      }
    }

    return {
      primary: regularMatches.map((item) => item.entry),
      megaGigantamax: megaGmaxMatches.map((item) => item.entry),
      primarySectionGroups,
    };
  }, [pokemon, query, selectedTypes, selectedTags, selectedDex, selectedGame, dexIndexes, gameIndexes, resolveSpeciesId]);

  const regularFiltered = filteredLists.primary ?? [];
  const megaGigantamaxFiltered = filteredLists.megaGigantamax ?? [];
  const regularSectionGroups = filteredLists.primarySectionGroups ?? null;
  const sectionGroups = Array.isArray(regularSectionGroups) ? regularSectionGroups : null;
  const hasPrimaryContent =
    (sectionGroups && sectionGroups.some((group) => (group.entries?.length ?? 0) > 0)) || regularFiltered.length > 0;

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
        const entryInfo = gameIndexes.get(selectedGame);
        const entryMap = entryInfo instanceof Map ? entryInfo : entryInfo?.entryMap ?? null;
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
  const nationalOrderIndex = useMemo(() => new Map(NATIONAL_GAME_OPTIONS.map((g, idx) => [g.key, idx])), []);
  const sortedAvailableGames = useMemo(() => {
    const list = availableGames || [];
    return list.slice().sort((a, b) => {
      const ia = nationalOrderIndex.get(a?.key);
      const ib = nationalOrderIndex.get(b?.key);
      if (ia == null && ib == null) return 0;
      if (ia == null) return 1;
      if (ib == null) return -1;
      return ib - ia; // newest first
    });
  }, [availableGames, nationalOrderIndex]);
  const showGameFilters = availableGames.length > 0;

  const handleGameClick = useCallback((gameKey) => {
    if (selectedGame === gameKey) {
      if (selectedDex === "national") {
        setSelectedGame(null);
        clearSelection();
      }
      return;
    }
    setSelectedGame(gameKey);
    clearSelection();
  }, [selectedGame, selectedDex, setSelectedGame, clearSelection]);

  const resolveLogoUrls = useCallback((game) => {
    const logos = (game.logos || []);
    return logos
      .map((logo) => GAME_LOGO_LOOKUP.get(logo))
      .filter(Boolean);
  }, []);

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

  const shouldShowActiveFilters =
    !showFilters && (selectedTypes.size + selectedTags.size > 0 || selectedDex || selectedGame);

  const renderActiveFilterTokens = () => (
    <>
      {selectedDex && (
        <span className="filter-token" key={`dex-${selectedDex}`}>
          {DEX_FILTERS.find((d) => d.key === selectedDex)?.label || selectedDex}
        </span>
      )}
      {selectedGame && (
        <span className="filter-token" key={`game-${selectedGame}`}>
          {(selectedDexConfig?.games || []).find((g) => g.key === selectedGame)?.label || selectedGame}
        </span>
      )}
      {Array.from(selectedTypes).map((t) => (
        <span key={`t-${t}`} className="filter-token">
          {t}
        </span>
      ))}
      {Array.from(selectedTags).map((tag) => (
        <span key={`tag-${tag}`} className="filter-token">
          {tag}
        </span>
      ))}
    </>
  );

  const renderListEntries = (entries) => {
    if (!entries || entries.length === 0) return null;
    return (
      <div className="list">
        {entries.map((p) => {
          const pref = getRegionPreferredEntry(p);
          const parts = pref.url.split("/").filter(Boolean);
          const id = parts[parts.length - 1];
          const idNum = Number(id);
          const dexDisplay = Number.isNaN(idNum) ? undefined : formatDexNumber(idNum);
          return (
            <PokemonCard
              key={pref.name}
              id={id}
              name={pref.name}
              url={pref.url}
              onSelect={() => selectPokemon(id, pref.name, pref.url)}
              selected={selected ? String(selected.id) === String(id) : undefined}
              dexNumber={dexDisplay}
              shiny={shiny}
              detailsCache={detailsCache}
            />
          );
        })}
      </div>
    );
  };

  const renderGridEntries = (entries, className = "grid") => {
    if (!entries || entries.length === 0) return null;
    return (
      <section className={className}>
        {entries.map((p) => {
          const pref = getRegionPreferredEntry(p);
          const parts = pref.url.split("/").filter(Boolean);
          const id = parts[parts.length - 1];
          const idNum = Number(id);
          const dexDisplay = Number.isNaN(idNum) ? undefined : formatDexNumber(idNum);
          return (
            <PokemonCard
              key={pref.name}
              id={id}
              name={pref.name}
              url={pref.url}
              onSelect={() => selectPokemon(id, pref.name, pref.url)}
              dexNumber={dexDisplay}
              shiny={shiny}
              detailsCache={detailsCache}
            />
          );
        })}
      </section>
    );
  };

  const listPrimaryContent = sectionGroups && sectionGroups.length > 0
    ? sectionGroups
        .map((group, index) => {
          const content = renderListEntries(group.entries);
          if (!content) return null;
          return (
            <div key={group.key || `section-${index}`} className="list-section">
              {index > 0 && <div className="list-divider" role="separator" />}
              {group.label && <h3 className="list-subheading">{group.label}</h3>}
              {content}
            </div>
          );
        })
        .filter(Boolean)
    : renderListEntries(regularFiltered);

  const gridPrimaryContent = sectionGroups && sectionGroups.length > 0
    ? sectionGroups
        .map((group, index) => {
          const content = renderGridEntries(group.entries);
          if (!content) return null;
          return (
            <React.Fragment key={group.key || `section-${index}`}>
              {group.label && <h2 className="grid-subheading">{group.label}</h2>}
              {content}
            </React.Fragment>
          );
        })
        .filter(Boolean)
    : renderGridEntries(regularFiltered);

  return (
    <div className="app-shell">
      <a
        className="discord-support-fab"
        href="https://discord.gg/WXMjmyjeC3"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Report a bug or request a feature on Discord"
      >
        Feedback · Discord
      </a>
      <HeaderSection
        title="Pokedex"
        subtitle="Search and explore every Pokemon"
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        query={query}
        setQuery={setQuery}
        onReset={() => {
          setSelectedTypes(new Set());
          setSelectedTags(new Set());
          setSelectedDex("national");
          setSelectedGame(null);
          setQuery("");
        }}
        FilterTabsComponent={FilterTabs}
        filterTabsProps={{
          selectedTypes,
          setSelectedTypes,
          typeIndexRef,
          selectedTags,
          setSelectedTags,
          selectedDex,
          setSelectedGame,
          setSelectedDex,
          clearSelection,
        }}
      />

      <main className="container">
        {showFilters && showGameFilters && (
          <GameFilters
            showFilters={showFilters}
            showGameFilters={showGameFilters}
            selectedDex={selectedDex}
            gameFiltersRef={gameFiltersRef}
            availableGames={sortedAvailableGames}
            selectedGame={selectedGame}
            onGameClick={handleGameClick}
            resolveLogoUrls={resolveLogoUrls}
          />
        )}
        {shouldShowActiveFilters && (
          <h2 className="active-filters-header">{renderActiveFilterTokens()}</h2>
        )}
        {selected ? (
          <section className="content split">
            <div className="list-panel">
              <div className="list-scroll">
                {listPrimaryContent}
                {megaGigantamaxFiltered.length > 0 && (
                  <div className="list-special">
                    {hasPrimaryContent && <div className="list-divider" role="separator" />}
                    <h3 className="list-subheading">Mega &amp; Gigantamax Forms</h3>
                    <div className="list">
                      {megaGigantamaxFiltered.map((p) => {
                        const pref = getRegionPreferredEntry(p);
                        const parts = pref.url.split("/").filter(Boolean);
                        const id = parts[parts.length - 1];
                        const idNum = Number(id);
                        const dexDisplay = Number.isNaN(idNum) ? undefined : formatDexNumber(idNum);
                        return (
                          <PokemonCard
                            key={pref.name}
                            id={id}
                            name={pref.name}
                            url={pref.url}
                            onSelect={() => selectPokemon(id, pref.name, pref.url)}
                            selected={String(selected.id) === String(id)}
                            dexNumber={dexDisplay}
                            shiny={shiny}
                            detailsCache={detailsCache}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                {!hasPrimaryContent && megaGigantamaxFiltered.length === 0 && (
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
              selectedDex={selectedDex}
              selectedGame={selectedGame}
            pokemonIdLookup={pokemonIdLookup}
            shiny={shiny}
            setShiny={setShiny}
            />
            </ErrorBoundary>
          </section>
        ) : (
          <>
            {gridPrimaryContent}
            {megaGigantamaxFiltered.length > 0 && (
              <>
                <h2 className="grid-subheading">Mega &amp; Gigantamax Forms</h2>
                <section className="grid grid-special">
                  {megaGigantamaxFiltered.map((p) => {
                    const pref = getRegionPreferredEntry(p);
                    const parts = pref.url.split("/").filter(Boolean);
                    const id = parts[parts.length - 1];
                    const idNum = Number(id);
                    const dexDisplay = Number.isNaN(idNum) ? undefined : formatDexNumber(idNum);
                    return (
                      <PokemonCard
                        key={pref.name}
                        id={id}
                        name={pref.name}
                        url={pref.url}
                        onSelect={() => selectPokemon(id, pref.name, pref.url)}
                        dexNumber={dexDisplay}
                        shiny={shiny}
                        detailsCache={detailsCache}
                      />
                    );
                  })}
                </section>
              </>
            )}
            {!hasPrimaryContent && megaGigantamaxFiltered.length === 0 && (
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
const natureDetailsCache = new Map();
let cachedNatureList = null;


function sortNatureEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .slice()
    .sort((a, b) => {
      const orderA = a?.sortIndex ?? NATURE_STAT_ORDER.size;
      const orderB = b?.sortIndex ?? NATURE_STAT_ORDER.size;
      if (orderA !== orderB) return orderA - orderB;
      const nameA = a?.name ?? "";
      const nameB = b?.name ?? "";
      return nameA.localeCompare(nameB);
    });
}

function decorateNatureEntry(name, url) {
  const normalized = String(name || "").toLowerCase();
  const summary = NATURE_SUMMARIES.get(normalized) || {};
  const raises = summary.raises ?? null;
  const lowers = summary.lowers ?? null;
  const primaryKey = raises ?? NEUTRAL_NATURE_KEY;
  const sortIndex = NATURE_STAT_ORDER.get(primaryKey) ?? NATURE_STAT_ORDER.size;
  return {
    name: normalized,
    url,
    raises,
    lowers,
    primaryStat: raises ?? null,
    sortIndex,
  };
}

function normalizeNatureEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  return sortNatureEntries(
    entries
      .map((entry) => {
        if (!entry) return null;
        if (entry.sortIndex != null && entry.name) {
          return entry;
        }
        return decorateNatureEntry(entry.name, entry.url);
      })
      .filter(Boolean),
  );
}

// Simple global fetch queue to limit concurrent requests
let IN_FLIGHT = 0;
// moved to constants (MAX_CONCURRENT)
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

// Moved to ./components/SpriteImage.jsx

// Moved into ./components/PokemonCard.jsx

// Moved to ./components/PokemonCard.jsx

// Moved to ./components/ErrorBoundary.jsx

function DetailPanel({
  selected,
  onClose,
  onSelectPokemon,
  onActivateType,
  dexNumber,
  selectedDex,
  selectedGame,
  pokemonIdLookup,
  shiny = false,
  setShiny,
}) {
  const pokemonIdMap = useMemo(() => {
    if (pokemonIdLookup instanceof Map) return pokemonIdLookup;
    if (!pokemonIdLookup) return new Map();
    if (Array.isArray(pokemonIdLookup)) return new Map(pokemonIdLookup);
    if (typeof pokemonIdLookup === "object") return new Map(Object.entries(pokemonIdLookup));
    return new Map();
  }, [pokemonIdLookup]);
  const { id, name, url } = selected || {};
  const [details, setDetails] = useState(null);
  const [animated, setAnimated] = useState(() => {
    try {
      return localStorage.getItem("pref:animated") === "1";
    } catch {
      return false;
    }
  });
  const [female, setFemale] = useState(() => {
    try {
      return localStorage.getItem("pref:female") === "1";
    } catch {
      return false;
    }
  });
  const [species, setSpecies] = useState(null);
  const [forms, setForms] = useState([]);
  const [evoPaths, setEvoPaths] = useState([]);
  const [evolutionChainData, setEvolutionChainData] = useState(null);
  const [weaknesses, setWeaknesses] = useState([]); // [{type, mult}]
  const [resistances, setResistances] = useState([]); // [{type, mult}]
  const [debugLog, setDebugLog] = useState([]);
  const [smogonNature, setSmogonNature] = useState(null);
  const [smogonError, setSmogonError] = useState(null);
  const [smogonLoading, setSmogonLoading] = useState(false);
  const [smogonEvs, setSmogonEvs] = useState(null);
  const [isEvModalOpen, setIsEvModalOpen] = useState(false);
  const [activeAbility, setActiveAbility] = useState(null);
  const [abilityData, setAbilityData] = useState(null);
  const [abilityLoading, setAbilityLoading] = useState(false);
  const [abilityError, setAbilityError] = useState(null);
  const [natureOverlayName, setNatureOverlayName] = useState(null);
  const [gameAvailability, setGameAvailability] = useState([]);
  const [gameAvailabilityLoading, setGameAvailabilityLoading] = useState(false);
  const [gameAvailabilityError, setGameAvailabilityError] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [selectedFlavorVersion, setSelectedFlavorVersion] = useState(null);
  const [isFlavorModalOpen, setIsFlavorModalOpen] = useState(false);
  const [isEvolutionDetailModalOpen, setIsEvolutionDetailModalOpen] = useState(false);
  const [isLearnsetModalOpen, setIsLearnsetModalOpen] = useState(false);
  const [evolutionDetailData, setEvolutionDetailData] = useState(null);
  const [currentPokemonForm, setCurrentPokemonForm] = useState(null);
  const [isAltFormsModalOpen, setIsAltFormsModalOpen] = useState(false);
  const [altFormsForModal, setAltFormsForModal] = useState([]);
  const [altFormsModalTitle, setAltFormsModalTitle] = useState("");
  const [localFlavorEntries, setLocalFlavorEntries] = useState([]);
  const [learnset, setLearnset] = useState({ levelUp: [], machine: [], tm: [], hm: [] });
  const [learnsetMeta, setLearnsetMeta] = useState({
    versionGroup: null,
    versionGroupLabel: null,
    hasMixedSources: false,
    levelCount: 0,
    machineCount: 0,
    tmCount: 0,
    hmCount: 0,
  });
  const [moveDetailsMap, setMoveDetailsMap] = useState(() => new Map()); // move name -> {type, power, accuracy, pp, damage_class}
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const hasRecommendedEvs = useMemo(() => {
    if (!smogonEvs || typeof smogonEvs !== "object") return false;
    return Object.values(smogonEvs).some((value) => typeof value === "number" && value > 0);
  }, [smogonEvs]);
  const latestCatchGame = useMemo(() => {
    if (!Array.isArray(gameAvailability) || gameAvailability.length === 0) {
      return null;
    }

    if (selectedGame) {
      const preferredVersions = [];
      const mappedVersions = mapGameCodeToVersions(selectedGame);
      if (Array.isArray(mappedVersions) && mappedVersions.length > 0) {
        preferredVersions.push(...mappedVersions);
      }
      preferredVersions.push(selectedGame);

      const normalizedTargets = new Set(
        preferredVersions
          .map((value) => normalizeLocalKey(value))
          .filter(Boolean)
      );

      const match = gameAvailability.find((entry) => {
        if (!entry) return false;
        const version = normalizeLocalKey(entry.version);
        if (version && normalizedTargets.has(version)) return true;
        if (Array.isArray(entry.versions)) {
          for (const value of entry.versions) {
            const normalized = normalizeLocalKey(value);
            if (normalized && normalizedTargets.has(normalized)) {
              return true;
            }
          }
        }
        const code = normalizeLocalKey(entry.gameCode || entry.game);
        if (code && normalizedTargets.has(code)) return true;
        return false;
      });

      if (match) return match;
    }

    return gameAvailability[gameAvailability.length - 1];
  }, [gameAvailability, selectedGame]);
  const latestCatchLogos = useMemo(() => {
    if (!latestCatchGame) return [];
    return (latestCatchGame.logos || [])
      .map((logo) => GAME_LOGO_LOOKUP.get(logo))
      .filter(Boolean);
  }, [latestCatchGame]);
  const latestCatchLocationPreview = useMemo(() => {
    if (!latestCatchGame) return "";
    const areas = Array.isArray(latestCatchGame.areas) ? latestCatchGame.areas : [];
    const entries = [];

    areas.forEach((area) => {
      const methods = Array.isArray(area?.methods) ? area.methods : [];
      if (methods.length > 0) {
        methods.forEach((method) => {
          const description = String(method?.description || "").trim();
          if (description) {
            entries.push(description);
            return;
          }
          const labelParts = [area?.label, method?.label]
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter(Boolean);
          if (labelParts.length > 0) entries.push(labelParts.join(" - "));
        });
      } else {
        const label = String(area?.label || "").trim();
        if (label) entries.push(label);
      }
    });

    const uniqueEntries = Array.from(new Set(entries.filter(Boolean)));
    if (uniqueEntries.length === 0) {
      const summary = String(latestCatchGame.summary || "").trim();
      return summary;
    }

    const maxPreview = 3;
    const previewEntries = uniqueEntries.slice(0, maxPreview);
    const remaining = uniqueEntries.length - previewEntries.length;
    return remaining > 0
      ? `${previewEntries.join(" • ")} • +${remaining} more`
      : previewEntries.join(" • ");
  }, [latestCatchGame]);
  const targetEvolutionGeneration = useMemo(() => {
    if (selectedGame) {
      return GAME_GENERATION_LOOKUP.get(selectedGame) ?? null;
    }
    if (selectedDex && selectedDex !== "national") {
      return DEX_GENERATION_LOOKUP.get(selectedDex) ?? null;
    }
    return null;
  }, [selectedDex, selectedGame]);
  const preferLatestEvolution = selectedDex === "national" && !selectedGame;
  
  // Compute available flavor text versions
  const flavorTextVersions = useMemo(() => {
    const byVersion = new Map();
    const pushEntry = (versionName, text, priority) => {
      if (!versionName || !text) return;
      const normalizedKey = normalizeLocalKey(versionName);
      const slug = VERSION_ALIAS_LOOKUP.get(normalizedKey) || versionName;
      const cleaned = String(text || "").replace(/\s+/g, " ").trim();
      if (!cleaned) return;
      const existing = byVersion.get(slug);
      if (existing && existing.priority <= priority) {
        return;
      }
      byVersion.set(slug, {
        name: slug,
        displayName: formatDisplayName(slug),
        text: cleaned,
        priority,
        index: VERSION_ORDER_LOOKUP.has(slug)
          ? VERSION_ORDER_LOOKUP.get(slug)
          : Number.NEGATIVE_INFINITY,
      });
    };

    if (Array.isArray(species?.flavor_text_entries)) {
      for (const entry of species.flavor_text_entries) {
        if (entry?.language?.name !== "en") continue;
        pushEntry(entry?.version?.name, entry?.flavor_text, 1);
      }
    }

    if (Array.isArray(localFlavorEntries)) {
      for (const entry of localFlavorEntries) {
        const versionName = entry?.version;
        const lang = (entry?.language || "en").toLowerCase();
        if (lang && lang !== "en") continue;
        pushEntry(versionName, entry?.text, 0);
      }
    }

    const result = Array.from(byVersion.values()).map(({ priority, index, ...rest }) => ({
      ...rest,
      priority,
      index,
    }));
    result.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.index !== b.index) return b.index - a.index;
      return a.displayName.localeCompare(b.displayName);
    });
    return result;
  }, [species?.flavor_text_entries, localFlavorEntries]);
  
  // Auto-select flavor text version based on selectedDex/selectedGame
  useEffect(() => {
    if (!flavorTextVersions.length) {
      setSelectedFlavorVersion(null);
      return;
    }

    // If a specific game is selected, use that game's entry when available
    if (selectedGame) {
      const targetVersions = mapGameCodeToVersions(selectedGame);
      for (const version of targetVersions) {
        const matching = flavorTextVersions.find((v) => v.name === version);
        if (matching) {
          setSelectedFlavorVersion(matching.name);
          return;
        }
      }
      const normalizedGame = normalizeLocalKey(selectedGame);
      const fallbackMatch = flavorTextVersions.find((v) => {
        const versionKey = normalizeLocalKey(v.name);
        return (
          versionKey === normalizedGame
          || versionKey.includes(normalizedGame)
          || normalizedGame.includes(versionKey)
        );
      });
      if (fallbackMatch) {
        setSelectedFlavorVersion(fallbackMatch.name);
        return;
      }
    }

    // Otherwise default to the most recent release (first entry after sorting)
    setSelectedFlavorVersion(flavorTextVersions[0]?.name || null);
  }, [flavorTextVersions, selectedGame]);
  
  // Get the selected flavor text
  const selectedFlavorText = useMemo(() => {
    if (!selectedFlavorVersion) return null;
    const entry = flavorTextVersions.find((v) => v.name === selectedFlavorVersion);
    return entry?.text ?? null;
  }, [flavorTextVersions, selectedFlavorVersion]);
  
  // Get logo for current version
  const currentVersionLogo = useMemo(() => {
    if (!selectedFlavorVersion) return null;
    // Map version name to logo file
    const logoFile = VERSION_LOGO_FILES.get(selectedFlavorVersion);
    return logoFile ? GAME_LOGO_LOOKUP.get(logoFile) : null;
  }, [selectedFlavorVersion]);
  
  const openFlavorModal = useCallback(() => {
    setIsFlavorModalOpen(true);
  }, []);
  
  const closeFlavorModal = useCallback(() => {
    setIsFlavorModalOpen(false);
  }, []);
  
  const selectFlavorVersion = useCallback((versionName) => {
    setSelectedFlavorVersion(versionName);
    closeFlavorModal();
  }, [closeFlavorModal]);
  
  useEffect(() => {
    setNatureOverlayName(null);
    setSelectedFlavorVersion(null);
    setIsFlavorModalOpen(false);
  }, [id]);
  useEffect(() => {
    if (!hasRecommendedEvs) {
      setIsEvModalOpen(false);
    }
  }, [hasRecommendedEvs]);

  useEffect(() => {
    setGameAvailability([]);
    setGameAvailabilityError(null);
    setActiveGame(null);
    setGameAvailabilityLoading(Boolean(url));
  }, [url]);

  useEffect(() => {
    if (!smogonNature) {
      setNatureOverlayName(null);
    }
  }, [smogonNature]);
  const addLog = (msg, data) => {
    const line = `[${new Date().toISOString()}] ${msg}` + (data !== undefined ? ` :: ${typeof data === 'string' ? data : JSON.stringify(data)}` : '');
    setDebugLog((d) => d.concat(line).slice(-200));
  };
  const displayDexNumber = dexNumber || (id ? `#${id}` : "-");
  const hasLearnsetContent = (learnset.levelUp?.length || 0) > 0 || (learnset.machine?.length || 0) > 0;
  const shouldShowLearnset = Boolean(details) && (
    hasLearnsetContent || (Array.isArray(details?.moves) && details.moves.length > 0)
  );

  const handleShinyToggle = useCallback(() => {
    if (typeof setShiny === "function") {
      setShiny((prev) => !prev);
    }
  }, [setShiny]);

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

  // Collect all non-regional, non-default alternate forms across the entire evolution tree
  const aggregatedAlternateForms = useMemo(() => {
    const seen = new Set();
    const results = [];
    const pushForm = (f) => {
      const fid = f?.id != null ? String(f.id) : null;
      if (!fid || f.isDefault) return; // exclude default forms
      const isRegional = Array.isArray(f?.tags) && f.tags.includes("Regional");
      const isCap = isCapFormName(f?.name);
      if (isRegional && !isCap) return; // exclude regionals except Pikachu cap variants
      if (seen.has(fid)) return;
      seen.add(fid);
      results.push(f);
    };
    const walkEntry = (entry) => {
      if (!entry) return;
      const forms = Array.isArray(entry.forms) ? entry.forms : [];
      forms.forEach(pushForm);
      const children = Array.isArray(entry.children) ? entry.children : [];
      children.forEach((edge) => walkEntry(edge.child));
    };
    evolutionTree.forEach(walkEntry);
    return results;
  }, [evolutionTree]);

  const hasAnyAlternateForms = aggregatedAlternateForms.length > 0;

  const openAggregatedAltForms = useCallback(() => {
    if (!aggregatedAlternateForms.length) return;
    const titleBase = formatDisplayName(name || selected?.name || "");
    setAltFormsModalTitle(`Alternate Forms — ${titleBase}`);
    setAltFormsForModal(aggregatedAlternateForms);
    setIsAltFormsModalOpen(true);
  }, [aggregatedAlternateForms, name, selected]);

  // Preferred region for evolution tree based on the currently selected form name
  const selectedEvolutionRegion = useMemo(() => {
    const raw = selected?.name || null;
    if (!raw) return null;
    const lower = String(raw).toLowerCase();
    const tokens = lower.split("-");
    const CANON = {
      alola: "alola",
      alolan: "alola",
      galar: "galar",
      galarian: "galar",
      hisui: "hisui",
      hisuan: "hisui",
      paldea: "paldea",
      paldean: "paldea",
    };
    for (const token of tokens) {
      if (CANON[token]) return CANON[token];
    }
    return null;
  }, [selected?.name]);

  const renderEvolutionPokemon = (node, { isCurrent = false, isRoot = false, clickOptions = null } = {}) => {
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
          <SpriteImage id={node.id} alt={node.name} width={size} height={size} loading="lazy" shiny={shiny} />
        </span>
        <span className="evo-tree-name text-capitalize">{nodeName}</span>
      </>
    );
    return (
      <button
        type="button"
        className={classes}
        title={nodeName}
        onClick={() => onSelectPokemon?.(nodeId, node.name, `https://pokeapi.co/api/v2/pokemon/${nodeId}`, clickOptions || undefined)}
        aria-pressed={isActive}
      >
        {inner}
      </button>
    );
  };

  const renderEvolutionBranch = (entry, level = 0, incomingCondition = null, keyPrefix = "node", inheritedRegion = selectedEvolutionRegion) => {
    if (!entry) return null;
    const nodeKey = entry.id != null ? String(entry.id) : `${entry.name}-${level}`;
    const rawVariantForms = Array.isArray(entry.forms)
      ? entry.forms.filter((form) => form && !form.isDefault)
      : [];
    // Helper: derive canonical region key (e.g., "alola", "galar") from a name
    const getCanonRegion = (rawName) => {
      const tokens = String(rawName || "").toLowerCase().split("-");
      // Local canonical region mapping to avoid external dependencies
      const CANON = {
        alola: "alola",
        alolan: "alola",
        galar: "galar",
        galarian: "galar",
        hisui: "hisui",
        hisuan: "hisui",
        paldea: "paldea",
        paldean: "paldea",
      };
      for (const token of tokens) {
        const canon = CANON[token];
        if (canon) return canon;
      }
      return null;
    };
    // Determine which form to promote as primary for this node
    const activeAltForm = rawVariantForms.find((form) => String(form?.id) === String(id)) || null;
    const regionFromActive = activeAltForm ? getCanonRegion(activeAltForm.name) : null;
    const promotedByRegion = !activeAltForm && inheritedRegion
      ? rawVariantForms.find((f) => getCanonRegion(f.name) === inheritedRegion) || null
      : null;
    const promotedForm = activeAltForm || promotedByRegion;
    const isCurrentNode = Boolean(promotedForm)
      ? String(promotedForm.id) === String(id)
      : (entry.id != null && String(entry.id) === String(id));
    const primaryDisplayNode = promotedForm
      ? { id: promotedForm.id, name: promotedForm.name, displayName: promotedForm.displayName }
      : entry;
    const variantForms = promotedForm
      ? [
          ...rawVariantForms.filter((f) => String(f?.id) !== String(promotedForm.id)),
          {
            id: entry.id,
            name: entry.name,
            displayName: entry.displayName || humanizeName(entry.name),
            isDefault: true,
            tags: ["Default"],
          },
        ]
      : rawVariantForms;
    const children = Array.isArray(entry.children) ? entry.children : [];
    // Determine the preferred region to pass to children
    const nextPreferredRegion = promotedForm ? (regionFromActive || getCanonRegion(promotedForm.name)) : inheritedRegion;
    const regionActive = selectedDex !== "national" || Boolean(selectedGame);
    const primaryIsDefault = !promotedForm; // when no promotion, primary is the base/default species
    const primaryClickOptions = regionActive && primaryIsDefault ? { forceNational: true, preferExact: true } : null;

    const handleConditionClick = () => {
      if (incomingCondition?.details) {
        // Get the current form info from details
        const formData = details?.forms?.find(f => f.id === parseInt(id)) || 
                        forms?.find(f => String(f.id) === String(id));
        setCurrentPokemonForm(formData);
        setEvolutionDetailData(incomingCondition.details);
        setIsEvolutionDetailModalOpen(true);
      }
    };

    const regionalForms = (variantForms || []).filter((f) =>
      Array.isArray(f?.tags) && f.tags.includes("Regional") && !isCapFormName(f?.name)
    );
    const defaultForms = (variantForms || []).filter((f) => Boolean(f?.isDefault));
    const inlineForms = (() => {
      const byId = new Map();
      [...regionalForms, ...defaultForms].forEach((f) => {
        const fid = f?.id != null ? String(f.id) : null;
        if (!fid || byId.has(fid)) return;
        byId.set(fid, f);
      });
      return Array.from(byId.values());
    })();

    return (
      <li key={`${keyPrefix}-${nodeKey}`} className="evo-tree-node">
        <div className="evo-tree-split" style={{ "--level": level }}>
          <div className="evo-tree-left">
            <div className="evo-tree-row">
              {incomingCondition?.text ? (
                <button
                  type="button"
                  className="evo-tree-cond"
                  onClick={handleConditionClick}
                  title="Click for details"
                >
                  {incomingCondition.text}
                </button>
              ) : null}
              {incomingCondition?.itemSprite ? (
                <button
                  type="button"
                  className="evo-tree-item-wrapper"
                  onClick={handleConditionClick}
                  title="Click for details"
                >
                  <img
                    src={incomingCondition.itemSprite}
                    alt=""
                    width={20}
                    height={20}
                    loading="lazy"
                    className="evo-tree-item"
                  />
                </button>
              ) : null}
              {level > 0 && (
                <span className="evo-tree-arrow" aria-hidden="true">
                  &rarr;
                </span>
              )}
              {renderEvolutionPokemon(primaryDisplayNode, { isCurrent: isCurrentNode, isRoot: level === 0, clickOptions: primaryClickOptions })}
            </div>
          </div>
          <div className="evo-tree-right">
            {inlineForms.length > 0 && (
              <div className="evo-tree-forms">
                {inlineForms.map((form) => {
                  const formId = form?.id != null ? String(form.id) : null;
                  if (!formId) return null;
                  const formName = form.displayName || humanizeName(form.name);
                  const isActiveForm = formId === String(id);
                  const clickOptions = regionActive && form?.isDefault ? { forceNational: true, preferExact: true } : null;
                  return (
                    <button
                      key={`${nodeKey}-form-${formId}`}
                      type="button"
                      className={`evo-tree-form${isActiveForm ? " is-current" : ""}`}
                      onClick={() =>
                        onSelectPokemon?.(formId, form.name, `https://pokeapi.co/api/v2/pokemon/${formId}`, clickOptions || undefined)
                      }
                      aria-pressed={isActiveForm}
                      title={formName}
                    >
                      <SpriteImage id={form.id} alt={form.name} width={30} height={30} loading="lazy" shiny={shiny} />
                      <span className="evo-tree-form-name">{formName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {children.length > 0 && (
          <ul className="evo-tree-children">
            {children.map((edge, idx) =>
              renderEvolutionBranch(edge.child, level + 1, edge.condition, `${nodeKey}-${idx}`, nextPreferredRegion)
            )}
          </ul>
        )}
      </li>
    );
  };

  useEffect(() => {
    try { localStorage.setItem("pref:animated", animated ? "1" : "0"); } catch {}
  }, [animated]);
  useEffect(() => {
    try { localStorage.setItem("pref:female", female ? "1" : "0"); } catch {}
  }, [female]);

  useEffect(() => {
    if (!url) return;
    let ignore = false;
    setSpecies(null);
    setForms([]);
    setEvoPaths([]);
    setEvolutionChainData(null);
    setWeaknesses([]);
    setLearnset({ levelUp: [], machine: [] });
    setLearnsetMeta({
      versionGroup: null,
      versionGroupLabel: null,
      hasMixedSources: false,
      levelCount: 0,
      machineCount: 0,
    });
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

    setGameAvailability([]);
    setGameAvailabilityLoading(true);
    setGameAvailabilityError(null);
    setActiveGame(null);

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

    const fetchEncounters = async () => {
      if (!details) return;
      setGameAvailabilityLoading(true);
      setGameAvailabilityError(null);
      try {
        const defaultName = pokemonIdMap.get(Number(details?.id)) || details?.name;
        const localNormalized = await loadLocalEncounterEntriesForPokemon(
          details?.id,
          details?.name,
          defaultName,
          details?.species?.name
        );
        if (ignore) return;
        const normalized = Array.isArray(localNormalized) ? localNormalized : [];
        setGameAvailability(normalized);
        setGameAvailabilityError(null);
        setGameAvailabilityLoading(false);
        addLog('Encounters loaded (local)', { games: normalized.length });
      } catch (error) {
        if (ignore) return;
        addLog('Encounter load failed (local)', { message: error?.message || String(error) });
        setGameAvailability([]);
        setGameAvailabilityError("Unable to load encounter data.");
        setGameAvailabilityLoading(false);
      }
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
        return { text: parts.join(" • "), details: ed };
      }
      if (trig === "use-item") {
        if (ed.item?.name) {
          const name = ed.item.name;
          const isStone = name.includes("stone");
          const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`;
          return {
            text: `Use ${humanize(name)}`,
            itemSprite: isStone ? sprite : undefined,
            details: ed,
          };
        }
        return { text: "Use item", details: ed };
      }
      if (trig === "trade") {
        if (ed.trade_species?.name) parts.push(`for ${humanize(ed.trade_species.name)}`);
        if (ed.held_item?.name) parts.push(`holding ${humanize(ed.held_item.name)}`);
        return { text: parts.length ? `Trade ${parts.join(", ")}` : "Trade", details: ed };
      }
      if (trig === "shed") {
        return { text: "Shed evolution", details: ed };
      }
      if (trig) return { text: humanize(trig), details: ed };
      return null;
    };

    // Build evolution paths from chain, attaching condition to the edge to next node
    const buildPaths = (node, prefix = [], formsMap) => {
      const speciesId = getIdFromUrl(node.species?.url);
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
          const sid = getIdFromUrl(node.species?.url);
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
        setEvoPaths([]);
        setEvolutionChainData({
          chain,
          speciesEntries: Array.from(speciesMap.entries()),
          formsBySpeciesEntries: Array.from(formsBySpeciesId.entries()),
        });
        addLog('Evolution chain cached', { species: speciesMap.size });
      } catch {}
    };

    computeMultipliers();
    fetchEvolution();
    fetchEncounters();

    return () => { ignore = true; };
  }, [details, pokemonIdMap]);

  useEffect(() => {
    if (!details) {
      setLearnset({ levelUp: [], machine: [], tm: [], hm: [] });
      setLearnsetMeta({
        versionGroup: null,
        versionGroupLabel: null,
        hasMixedSources: false,
        levelCount: 0,
        machineCount: 0,
        tmCount: 0,
        hmCount: 0,
      });
      return;
    }

    const preference = buildVersionGroupPreference(selectedGame, selectedDex);
    const levelMap = new Map();
    const machineMap = new Map();
    const usedGroups = new Map();

    const normalizeGroup = (value) => (value ? String(value).toLowerCase() : null);

    const preferenceIndex = (group) => {
      if (!group) return Number.POSITIVE_INFINITY;
      const idx = preference.findIndex((value) => value === group);
      if (idx !== -1) return idx;
      if (VERSION_GROUP_ORDER_LOOKUP.has(group)) {
        return preference.length + VERSION_GROUP_ORDER_LOOKUP.get(group);
      }
      return preference.length + VERSION_GROUP_RELEASE_ORDER.length + 10;
    };

    const recordGroupUsage = (group) => {
      if (!group) return;
      const key = normalizeGroup(group);
      if (!key) return;
      usedGroups.set(key, (usedGroups.get(key) || 0) + 1);
    };

    const moves = Array.isArray(details.moves) ? details.moves : [];

    for (const entry of moves) {
      const moveName = entry?.move?.name;
      if (!moveName) continue;
      const versionEntries = Array.isArray(entry?.version_group_details)
        ? entry.version_group_details
        : [];
      if (versionEntries.length === 0) continue;

      let bestLevel = null;
      let bestMachine = null;

      for (const info of versionEntries) {
        const method = info?.move_learn_method?.name;
        const versionGroupName = normalizeGroup(info?.version_group?.name);
        if (!method || !versionGroupName) continue;
        const score = preferenceIndex(versionGroupName);

        if (method === "level-up") {
          const rawLevel = Number(info?.level_learned_at);
          const level = Number.isFinite(rawLevel) ? rawLevel : null;
          const candidate = {
            move: moveName,
            level,
            score,
            versionGroup: versionGroupName,
          };
          const shouldUpdate = () => {
            if (!bestLevel) return true;
            if (candidate.score < bestLevel.score) return true;
            if (candidate.score > bestLevel.score) return false;
            const candidateLevel = candidate.level == null ? Number.POSITIVE_INFINITY : candidate.level;
            const currentLevel = bestLevel.level == null ? Number.POSITIVE_INFINITY : bestLevel.level;
            if (candidateLevel !== currentLevel) {
              return candidateLevel < currentLevel;
            }
            return candidate.move.localeCompare(bestLevel.move) < 0;
          };
          if (shouldUpdate()) {
            bestLevel = candidate;
          }
        } else if (method === "machine") {
          const candidate = {
            move: moveName,
            score,
            versionGroup: versionGroupName,
          };
          const shouldUpdate = () => {
            if (!bestMachine) return true;
            if (candidate.score < bestMachine.score) return true;
            if (candidate.score > bestMachine.score) return false;
            return candidate.move.localeCompare(bestMachine.move) < 0;
          };
          if (shouldUpdate()) {
            bestMachine = candidate;
          }
        }
      }

      if (bestLevel) {
        levelMap.set(moveName, bestLevel);
        recordGroupUsage(bestLevel.versionGroup);
      }
      if (bestMachine) {
        machineMap.set(moveName, bestMachine);
        recordGroupUsage(bestMachine.versionGroup);
      }
    }

    const levelUpList = Array.from(levelMap.values())
      .sort((a, b) => {
        const levelA = a.level == null ? Number.POSITIVE_INFINITY : a.level;
        const levelB = b.level == null ? Number.POSITIVE_INFINITY : b.level;
        if (levelA !== levelB) return levelA - levelB;
        if (a.score !== b.score) return a.score - b.score;
        return a.move.localeCompare(b.move);
      })
      .map((item) => ({
        name: item.move,
        label: toTitleCase(item.move),
        level: item.level,
        levelLabel: formatMoveLevelLabel(item.level),
        versionGroup: item.versionGroup,
      }));

    const machineList = Array.from(machineMap.values())
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.move.localeCompare(b.move);
      })
      .map((item) => ({
        name: item.move,
        label: toTitleCase(item.move),
        versionGroup: item.versionGroup,
      }));

    const primaryVersionGroup = (() => {
      const preferred = preference.find((group) => usedGroups.has(group));
      if (preferred) return preferred;
      const iterator = usedGroups.keys();
      const next = iterator.next();
      return next.done ? null : next.value;
    })();

    // Separate TM and HM moves
    const hmMoves = machineList.filter((move) => {
      const name = String(move.name || "").toLowerCase();
      return name.startsWith("hm") || name.includes("-hm");
    });
    const tmMoves = machineList.filter((move) => {
      const name = String(move.name || "").toLowerCase();
      return !name.startsWith("hm") && !name.includes("-hm");
    });

    setLearnset({ levelUp: levelUpList, machine: machineList, tm: tmMoves, hm: hmMoves });
    setLearnsetMeta({
      versionGroup: primaryVersionGroup,
      versionGroupLabel: formatVersionGroupLabel(primaryVersionGroup),
      hasMixedSources: usedGroups.size > 1,
      levelCount: levelUpList.length,
      machineCount: machineList.length,
      tmCount: tmMoves.length,
      hmCount: hmMoves.length,
    });
  }, [details, selectedGame, selectedDex]);

  // Fetch move details for learnset moves
  useEffect(() => {
    if (!shouldShowLearnset) {
      setMoveDetailsMap(new Map());
      return;
    }

    let cancelled = false;
    const allMoves = [
      ...(learnset.levelUp || []).map(m => m.name),
      ...(learnset.machine || []).map(m => m.name),
    ];
    const toFetch = allMoves.filter(name => !moveDetailsMap.has(name));
    
    if (toFetch.length === 0) return;

    (async () => {
      const chunks = [];
      for (let i = 0; i < toFetch.length; i += 10) {
        chunks.push(toFetch.slice(i, i + 10));
      }
      
      for (const chunk of chunks) {
        if (cancelled) return;
        
        const results = await Promise.all(
          chunk.map(async (name) => {
            try {
              const response = await fetch(`https://pokeapi.co/api/v2/move/${name}`);
              const data = await response.json();
              return {
                name,
                type: data?.type?.name || null,
                power: data?.power ?? null,
                accuracy: data?.accuracy ?? null,
                pp: data?.pp ?? null,
                priority: data?.priority ?? 0,
                damage_class: data?.damage_class?.name || null,
              };
            } catch {
              return {
                name,
                type: null,
                power: null,
                accuracy: null,
                pp: null,
                priority: 0,
                damage_class: null,
              };
            }
          })
        );

        if (!cancelled) {
          setMoveDetailsMap((prev) => {
            const next = new Map(prev);
            for (const result of results) {
              next.set(result.name, result);
            }
            return next;
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [learnset, shouldShowLearnset, moveDetailsMap]);

  // Load local pokedex entries (flavor text) for SV/ZA and prefer them when present
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const sid = species?.id;
      if (sid == null) {
        setLocalFlavorEntries([]);
        return;
      }
      try {
        const entries = await loadLocalPokedexEntriesForSpecies(
          sid,
          species?.name,
          pokemonIdMap.get(Number(details?.id)),
          details?.name
        );
        if (!cancelled) {
          setLocalFlavorEntries(Array.isArray(entries) ? entries : []);
        }
      } catch {
        if (!cancelled) setLocalFlavorEntries([]);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [species?.id, species?.name, details?.id, details?.name, pokemonIdMap]);

  useEffect(() => {
    if (!evolutionChainData) return;
    let cancelled = false;

    const ensureSpeciesGeneration = (speciesId, speciesData) => {
      if (!speciesId || !speciesData) return;
      const key = String(speciesId);
      if (speciesGenerationCache.has(key)) return;
      const genName = speciesData?.generation?.name;
      if (genName) {
        const genValue = getGenerationNumber(genName);
        if (genValue != null) {
          speciesGenerationCache.set(key, genValue);
        }
      }
    };

    const run = async () => {
      try {
        const { chain, speciesEntries, formsBySpeciesEntries } = evolutionChainData;
        if (!chain?.chain) return;
        const speciesMap = new Map(Array.isArray(speciesEntries) ? speciesEntries : []);
        const formsMap = new Map(Array.isArray(formsBySpeciesEntries) ? formsBySpeciesEntries : []);

        speciesMap.forEach((data, key) => ensureSpeciesGeneration(key, data));

        const detailMetaMap = new WeakMap();
        const detailRecords = [];
        const itemUrls = new Set();
        const locationUrls = new Set();
        const moveUrls = new Set();
        const extraSpeciesIds = new Set();

        const traverse = (node) => {
          if (!node) return;
          const children = Array.isArray(node.evolves_to) ? node.evolves_to : [];
          children.forEach((child) => {
            const childSpeciesId = getIdFromUrl(child.species?.url);
            const details = Array.isArray(child.evolution_details) ? child.evolution_details : [];
            details.forEach((detail, index) => {
              detailRecords.push({ detail, index, childSpeciesId });
              if (detail.item?.url) itemUrls.add(detail.item.url);
              if (detail.held_item?.url) itemUrls.add(detail.held_item.url);
              if (detail.location?.url) locationUrls.add(detail.location.url);
              if (detail.known_move?.url) moveUrls.add(detail.known_move.url);
              if (detail.trade_species?.url) {
                const sid = getIdFromUrl(detail.trade_species.url);
                if (sid) extraSpeciesIds.add(sid);
              }
              if (detail.party_species?.url) {
                const sid = getIdFromUrl(detail.party_species.url);
                if (sid) extraSpeciesIds.add(sid);
              }
            });
            traverse(child);
          });
        };

        traverse(chain.chain);

        const missingExtras = Array.from(extraSpeciesIds).filter(
          (sid) => sid && !speciesMap.has(String(sid)),
        );
        if (missingExtras.length > 0) {
          const fetched = await Promise.all(
            missingExtras.map(async (sid) => {
              try {
                const response = await queuedFetch(`https://pokeapi.co/api/v2/pokemon-species/${sid}/`);
                if (!response?.ok) return null;
                return response.json();
              } catch {
                return null;
              }
            }),
          );
          if (cancelled) return;
          for (const data of fetched) {
            if (!data || data.id == null) continue;
            speciesMap.set(String(data.id), data);
            ensureSpeciesGeneration(data.id, data);
          }
        }

        await Promise.all(
          Array.from(itemUrls).map(async (url) => {
            if (itemGenerationCache.has(url)) return;
            try {
              const response = await queuedFetch(url);
              if (!response?.ok) throw new Error();
              const data = await response.json();
              const gen = getGenerationNumber(data?.generation?.name);
              itemGenerationCache.set(url, gen ?? null);
            } catch {
              itemGenerationCache.set(url, null);
            }
          }),
        );

        await Promise.all(
          Array.from(locationUrls).map(async (url) => {
            if (locationGenerationCache.has(url)) return;
            try {
              const response = await queuedFetch(url);
              if (!response?.ok) throw new Error();
              const data = await response.json();
              const regionName = data?.region?.name;
              locationGenerationCache.set(url, getRegionGeneration(regionName));
            } catch {
              locationGenerationCache.set(url, null);
            }
          }),
        );

        await Promise.all(
          Array.from(moveUrls).map(async (url) => {
            if (moveGenerationCache.has(url)) return;
            try {
              const response = await queuedFetch(url);
              if (!response?.ok) throw new Error();
              const data = await response.json();
              const gen = getGenerationNumber(data?.generation?.name);
              moveGenerationCache.set(url, gen ?? null);
            } catch {
              moveGenerationCache.set(url, null);
            }
          }),
        );

        detailRecords.forEach(({ detail, index, childSpeciesId }) => {
          const genCandidates = [];
          const pushGen = (value) => {
            if (typeof value === "number" && !Number.isNaN(value)) {
              genCandidates.push(value);
            }
          };

          if (detail.location?.url) pushGen(locationGenerationCache.get(detail.location.url));
          if (detail.item?.url) pushGen(itemGenerationCache.get(detail.item.url));
          if (detail.held_item?.url) pushGen(itemGenerationCache.get(detail.held_item.url));
          if (detail.known_move?.url) pushGen(moveGenerationCache.get(detail.known_move.url));
          if (detail.trade_species?.url) {
            const sid = getIdFromUrl(detail.trade_species.url);
            if (sid) pushGen(speciesGenerationCache.get(String(sid)));
          }
          if (detail.party_species?.url) {
            const sid = getIdFromUrl(detail.party_species.url);
            if (sid) pushGen(speciesGenerationCache.get(String(sid)));
          }
          if (detail.min_affection != null) pushGen(6);
          if (detail.known_move_type?.name === "fairy") pushGen(6);
          if (detail.turn_upside_down) pushGen(6);

          const childGen = childSpeciesId != null ? speciesGenerationCache.get(String(childSpeciesId)) : null;
          if (childGen != null) pushGen(childGen);

          const generation = genCandidates.length > 0 ? Math.max(...genCandidates) : null;
          let priority = index;
          if (detail.trigger?.name === "use-item") priority += 50;
          if (detail.held_item?.url || detail.item?.url) priority += 10;
          if (detail.location?.url) {
            const locGen = locationGenerationCache.get(detail.location.url);
            if (locGen != null) priority += locGen;
          }
          if (detail.min_affection != null) priority += 5;
          if (detail.known_move_type?.name === "fairy") priority += 3;
          if (detail.trade_species?.url) priority += 2;

          detailMetaMap.set(detail, {
            generation,
            priority,
            index,
          });
        });

        const humanize = (value) => String(value || "").replace(/-/g, " ");
        const targetGen = targetEvolutionGeneration;
        const preferLatest = preferLatestEvolution;

        const selectEvolutionDetail = (eds, childSpeciesId) => {
          if (!Array.isArray(eds) || eds.length === 0) return null;
          const childGen = childSpeciesId != null ? speciesGenerationCache.get(String(childSpeciesId)) ?? null : null;
          const entries = eds.map((detail, idx) => {
            const meta = detailMetaMap.get(detail) || {};
            const generation = meta.generation != null ? meta.generation : childGen;
            const priority = meta.priority != null ? meta.priority : idx;
            return { detail, generation, priority, index: idx };
          });
          const computeScore = (entry) => {
            const base = entry.priority ?? entry.index ?? 0;
            if (targetGen == null) return base;
            const detail = entry.detail || {};
            let score = base;
            if (targetGen >= 8) {
              if (detail.trigger?.name === "use-item") score += 120;
              if (detail.item?.url || detail.held_item?.url) score += 60;
              if (detail.location?.url) score -= 15;
            }
            if (targetGen <= 4 && detail.location?.url) {
              score += 20;
            }
            if (targetGen <= 4 && detail.trigger?.name === "use-item") {
              score -= 40;
            }
            if (targetGen >= 6 && detail.known_move_type?.name === "fairy") {
              score += 10;
            }
            return score;
          };

          if (preferLatest) {
            entries.sort((a, b) => {
              if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
              if ((b.generation ?? -1) !== (a.generation ?? -1)) return (b.generation ?? -1) - (a.generation ?? -1);
              return b.index - a.index;
            });
            return entries[0]?.detail ?? eds[eds.length - 1];
          }

          if (targetGen != null) {
            const withGen = entries.filter((entry) => entry.generation != null);
            const suitable = withGen.filter((entry) => entry.generation <= targetGen);
            if (suitable.length > 0) {
              suitable.sort((a, b) => {
                const scoreA = computeScore(a);
                const scoreB = computeScore(b);
                if (scoreB !== scoreA) return scoreB - scoreA;
                if ((b.generation ?? -1) !== (a.generation ?? -1)) return (b.generation ?? -1) - (a.generation ?? -1);
                return b.index - a.index;
              });
              return suitable[0]?.detail ?? eds[0];
            }
            if (withGen.length > 0) {
              withGen.sort((a, b) => {
                const scoreA = computeScore(a);
                const scoreB = computeScore(b);
                if (scoreB !== scoreA) return scoreB - scoreA;
                if ((a.generation ?? Infinity) !== (b.generation ?? Infinity)) {
                  return (a.generation ?? Infinity) - (b.generation ?? Infinity);
                }
                return a.index - b.index;
              });
              return withGen[0]?.detail ?? eds[0];
            }
          }

          entries.sort((a, b) => a.index - b.index);
          return entries[0]?.detail ?? eds[0];
        };

        const describeEvolution = (eds, childSpeciesId) => {
          if (!eds || eds.length === 0) return null;
          const chosen = selectEvolutionDetail(eds, childSpeciesId) || eds[0];
          const trig = chosen?.trigger?.name;
          const parts = [];
          const gender = chosen?.gender;
          if (trig === "level-up") {
            if (chosen.min_level != null) parts.push(`Lv. ${chosen.min_level}`);
            if (chosen.min_happiness != null) parts.push(`Friendship ${chosen.min_happiness}`);
            if (chosen.min_affection != null) parts.push(`Affection ${chosen.min_affection}`);
            if (chosen.min_beauty != null) parts.push(`Beauty ${chosen.min_beauty}`);
            if (gender === 1) parts.push("Female");
            else if (gender === 2) parts.push("Male");
            if (chosen.time_of_day) parts.push(chosen.time_of_day === "day" ? "Daytime" : humanize(chosen.time_of_day));
            if (chosen.needs_overworld_rain) parts.push("Raining");
            if (chosen.party_species?.name) parts.push(`With ${humanize(chosen.party_species.name)}`);
            if (chosen.party_type?.name) parts.push(`With ${humanize(chosen.party_type.name)} ally`);
            if (chosen.location?.name) parts.push(`At ${humanize(chosen.location.name)}`);
            if (chosen.known_move?.name) parts.push(`Know ${humanize(chosen.known_move.name)}`);
            if (chosen.known_move_type?.name) parts.push(`Know ${humanize(chosen.known_move_type.name)} move`);
            if (parts.length === 0) parts.push("Level up");
            return { text: parts.join(" • "), details: chosen };
          }
          if (trig === "use-item") {
            if (chosen.item?.name) {
              const name = chosen.item.name;
              const isStone = name.includes("stone");
              const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`;
              return {
                text: `Use ${humanize(name)}`,
                itemSprite: isStone ? sprite : undefined,
                details: chosen,
              };
            }
            return { text: "Use item", details: chosen };
          }
          if (trig === "trade") {
            if (chosen.trade_species?.name) parts.push(`for ${humanize(chosen.trade_species.name)}`);
            if (chosen.held_item?.name) parts.push(`holding ${humanize(chosen.held_item.name)}`);
            return { text: parts.length ? `Trade ${parts.join(", ")}` : "Trade", details: chosen };
          }
          if (trig === "shed") {
            return { text: "Shed evolution", details: chosen };
          }
          if (trig) return { text: humanize(trig), details: chosen };
          return null;
        };

        const buildPaths = (node, prefix = []) => {
          if (!node) return [];
          const speciesId = getIdFromUrl(node.species?.url);
          const rawForms = speciesId && formsMap ? formsMap.get(String(speciesId)) : null;
          const formBranches = rawForms && rawForms.length ? rawForms.map((form) => ({ ...form })) : [];
          const currentNode = {
            name: node.species.name,
            displayName: humanizeName(node.species.name),
            id: speciesId,
            forms: formBranches,
          };
          const current = [...prefix, currentNode];
          const children = Array.isArray(node.evolves_to) ? node.evolves_to : [];
          if (children.length === 0) {
            return [current];
          }
          let paths = [];
          children.forEach((child) => {
            const childSpeciesId = getIdFromUrl(child.species?.url);
            const cond = describeEvolution(child.evolution_details, childSpeciesId);
            const withCond = current.slice();
            withCond[withCond.length - 1] = {
              ...withCond[withCond.length - 1],
              toNext: cond,
            };
            paths = paths.concat(buildPaths(child, withCond));
          });
          return paths;
        };

        const paths = buildPaths(chain.chain, []);
        if (!cancelled) {
          setEvoPaths(paths);
          addLog('Evolution paths built', {
            paths: paths.length,
            targetGeneration: targetGen ?? (preferLatest ? "latest" : null),
          });
        }
      } catch (error) {
        if (!cancelled) {
          addLog('Evolution processing failed', { message: error?.message || String(error) });
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [evolutionChainData, targetEvolutionGeneration, preferLatestEvolution]);

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

  const handleNatureClick = useCallback(() => {
    if (!smogonNature) return;
    setNatureOverlayName(smogonNature);
  }, [smogonNature]);

  const closeNatureOverlay = useCallback(() => {
    setNatureOverlayName(null);
  }, []);
  const openEvInfoModal = useCallback(() => {
    setIsEvModalOpen(true);
  }, []);
  const closeEvInfoModal = useCallback(() => {
    setIsEvModalOpen(false);
  }, []);

  const closeAbilityOverlay = useCallback(() => {
    setActiveAbility(null);
    setAbilityData(null);
    setAbilityError(null);
    setAbilityLoading(false);
  }, []);

  const handleCatchModalOpen = useCallback(() => {
    if (!latestCatchGame) return;
    setActiveGame(latestCatchGame);
  }, [latestCatchGame]);

  const closeGameModal = useCallback(() => {
    setActiveGame(null);
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

  // Prefer higher quality sources. If animated is enabled, try Showdown; otherwise use official-artwork > Gen 6 (omega-ruby-alpha-sapphire > x-y) > dream_world if not shiny before pixel fallback.
  const hasGenderVariants = useMemo(() => {
    const showdown = details?.sprites?.other?.showdown || {};
    const hasFemaleSprite = Boolean(
      details?.sprites?.front_female ||
      details?.sprites?.front_shiny_female ||
      showdown?.front_female ||
      showdown?.front_shiny_female
    );
    return Boolean(species?.has_gender_differences) || hasFemaleSprite;
  }, [details, species]);
  const isFemaleActive = hasGenderVariants && female;

  const detailArtSources = useMemo(() => {
    const d = details?.sprites?.other || {};
    const v = details?.sprites?.versions || {};
    const sources = [];
    const seen = new Set();
    const push = (value) => {
      const str = typeof value === "string" ? value.trim() : "";
      if (!str) return;
      if (seen.has(str)) return;
      seen.add(str);
      sources.push(str);
    };

    const pixel = (() => {
      if (shiny && isFemaleActive) {
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/female/${id}.png`;
      }
      if (shiny) {
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`;
      }
      if (isFemaleActive) {
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/female/${id}.png`;
      }
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    })();

    if (animated) {
      const showdownKey = shiny
        ? (isFemaleActive ? "front_shiny_female" : "front_shiny")
        : (isFemaleActive ? "front_female" : "front_default");
      const showdown = d?.showdown?.[showdownKey] || d?.showdown?.[shiny ? "front_shiny" : "front_default"];
      push(showdown);
    }

    if (isFemaleActive) {
      const homeFem = d?.home?.[shiny ? "front_shiny_female" : "front_female"];
      const femStatic = details?.sprites?.[shiny ? "front_shiny_female" : "front_female"];
      push(homeFem);
      if (femStatic && femStatic !== homeFem) {
        push(femStatic);
      }
    }

    const home = d?.home?.[shiny ? "front_shiny" : "front_default"];
    push(home);

    const art = d?.["official-artwork"]?.[shiny ? "front_shiny" : "front_default"];
    push(art);

    const gen6 = v?.["generation-vi"] || {};
    const oras = gen6?.["omega-ruby-alpha-sapphire"]?.[shiny ? "front_shiny" : "front_default"];
    const xy = gen6?.["x-y"]?.[shiny ? "front_shiny" : "front_default"];
    push(oras);
    push(xy);

    if (!shiny) {
      const dream = d?.dream_world?.front_default;
      push(dream);
    }

    if (!animated && !shiny && !isFemaleActive) {
      const detailName = String(details?.name || name || "").toLowerCase();
      const speciesName = String(species?.name || details?.species?.name || "").toLowerCase();
      if (detailName.includes("mega")) {
        const toTitleToken = (token) => {
          if (!token) return "";
          if (/^\d+$/.test(token)) return token;
          return token.charAt(0).toUpperCase() + token.slice(1);
        };

        const baseId = (() => {
          const speciesUrl = details?.species?.url || species?.url;
          if (typeof speciesUrl === "string") {
            const parts = speciesUrl.split("/").filter(Boolean);
            const maybe = Number(parts[parts.length - 1]);
            if (Number.isFinite(maybe)) return maybe;
          }
          const speciesId = Number(species?.id);
          if (Number.isFinite(speciesId) && speciesId > 0) return speciesId;
          const detailIdNum = Number(details?.id);
          if (Number.isFinite(detailIdNum) && detailIdNum < 10000) return detailIdNum;
          const fallbackIdNum = Number(id);
          if (Number.isFinite(fallbackIdNum) && fallbackIdNum > 0 && fallbackIdNum < 10000) return fallbackIdNum;
          return null;
        })();

        if (baseId != null) {
          const padded = String(baseId).padStart(4, "0");
          const basePath = getBasePath();
          const buildPath = (suffix) => {
            const cleanSuffix = suffix.startsWith("/") ? suffix.slice(1) : suffix;
            return `${basePath}${cleanSuffix}`;
          };

          const speciesTokens = speciesName.split("-").filter(Boolean);
          const detailTokens = detailName.split("-").filter(Boolean);
          let variantTokens = detailTokens.slice();
          if (
            speciesTokens.length &&
            speciesTokens.every((token, idx) => detailTokens[idx] === token)
          ) {
            variantTokens = detailTokens.slice(speciesTokens.length);
          } else if (detailTokens.length > 1) {
            variantTokens = detailTokens.slice(1);
          }

          if (!variantTokens.includes("mega")) {
            variantTokens = [...variantTokens, "mega"];
          }

          const formattedTokens = variantTokens
            .map((token) => token.replace(/[^a-z0-9]/g, ""))
            .filter(Boolean)
            .map(toTitleToken);

          const labels = new Set();
          if (formattedTokens.length) {
            labels.add(formattedTokens.join("."));
            labels.add(formattedTokens[0]);
            labels.add(formattedTokens.join(""));
          }
          labels.add("Mega");

          const sanitizedDetail = detailName
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+/, "")
            .replace(/-+$/, "");

          labels.forEach((label) => {
            if (!label) return;
            push(buildPath(`/sprites/${padded}.${label}.png`));
            push(buildPath(`/sprites/${padded}.${label}.1.png`));
            push(buildPath(`/sprites/${padded}.${label}.2.png`));
          });

          if (sanitizedDetail) {
            push(buildPath(`/sprites/${sanitizedDetail}.png`));
          }
        }
      }
    }

    if (isFemaleActive) {
      const fem = details?.sprites?.[shiny ? "front_shiny_female" : "front_female"];
      push(fem);
    }

    push(pixel);
    return sources.length > 0 ? sources : [pixel];
  }, [details, species, id, shiny, animated, isFemaleActive, name]);

  const [detailArtIndex, setDetailArtIndex] = useState(0);

  useEffect(() => {
    setDetailArtIndex(0);
  }, [detailArtSources]);

  const detailImg = detailArtSources.length > 0 ? detailArtSources[Math.min(detailArtIndex, detailArtSources.length - 1)] : "";

  const handleDetailArtError = useCallback(() => {
    setDetailArtIndex((prev) => {
      if (prev >= detailArtSources.length - 1) {
        return prev;
      }
      return prev + 1;
    });
  }, [detailArtSources.length]);

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
  // Fetch recommended nature from Smogon datasets.
  useEffect(() => {
    const alias = (name || "").toLowerCase();
    setSmogonNature(null);
    setSmogonEvs(null);
    setSmogonError(null);
    setSmogonLoading(false);
    if (!alias) return;
    let cancelled = false;
    const generationHint = species?.generation?.name || null;

    const run = async () => {
      setSmogonLoading(true);
      addLog("Fetching Smogon sets", { alias, generationHint });
      try {
        const result = await findRecommendedNature(alias, { generationHint });
        if (cancelled) return;
        const hasNature = Boolean(result?.nature);
        const formatKey = String(result?.format || "").toLowerCase();
        const isBalancedHackmons =
          formatKey === "balancedhackmons" || formatKey.endsWith("balancedhackmons");
        const evs =
          !isBalancedHackmons && result?.evs && typeof result.evs === "object" && Object.keys(result.evs).length > 0
            ? result.evs
            : null;
        setSmogonNature(hasNature ? result.nature : null);
        setSmogonEvs(evs);
        if (hasNature || evs) {
          setSmogonError(null);
          addLog("Smogon recommendations", {
            nature: result?.nature || null,
            evs,
            generation: result.generation,
            format: result.format,
            set: result.setName,
            species: result.speciesKey,
          });
        } else {
          // Don't treat "not found" as an error - it's just informational
          setSmogonError(null);
          addLog("Smogon data unavailable (not competitive)", {
            alias,
            generation: result?.generation,
            species: result?.speciesKey,
            searched: result?.searched,
          });
        }
      } catch (error) {
        if (cancelled) return;
        const msg = `Smogon data unavailable for ${name}.`;
        setSmogonNature(null);
        setSmogonEvs(null);
        setSmogonError(msg);
        addLog("Smogon fetch failed", { alias, error: String(error) });
      } finally {
        if (!cancelled) {
          setSmogonLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [name, species?.generation?.name]);

  // Calculate learnset summary stats
  const learnsetSummary = useMemo(() => {
    const allMoves = [...(learnset.levelUp || []), ...(learnset.machine || [])];
    const movesWithDetails = allMoves
      .map(move => {
        const details = moveDetailsMap.get(move.name);
        return { ...move, details };
      })
      .filter(m => m.details);

    if (movesWithDetails.length === 0) {
      return {
        strongestMove: null,
        typeCoverage: new Set(),
        avgPower: null,
        physicalCount: 0,
        specialCount: 0,
        statusCount: 0,
      };
    }

    const strongestMove = movesWithDetails.reduce((best, move) => {
      const power = move.details.power ?? 0;
      const bestPower = best?.details?.power ?? 0;
      return power > bestPower ? move : best;
    }, null);

    const typeCoverage = new Set();
    const damageClassCounts = { physical: 0, special: 0, status: 0 };
    let totalPower = 0;
    let powerCount = 0;

    movesWithDetails.forEach(move => {
      if (move.details.type) typeCoverage.add(move.details.type);
      const damageClass = move.details.damage_class;
      if (damageClass === 'physical') damageClassCounts.physical++;
      else if (damageClass === 'special') damageClassCounts.special++;
      else if (damageClass === 'status') damageClassCounts.status++;
      
      if (move.details.power != null) {
        totalPower += move.details.power;
        powerCount++;
      }
    });

    return {
      strongestMove,
      typeCoverage,
      avgPower: powerCount > 0 ? Math.round(totalPower / powerCount) : null,
      physicalCount: damageClassCounts.physical,
      specialCount: damageClassCounts.special,
      statusCount: damageClassCounts.status,
    };
  }, [learnset, moveDetailsMap]);

  // Get primary type and create gradient style
  const heroGradientStyle = useMemo(() => {
    if (!details?.types || details.types.length === 0) {
      return {};
    }
    
    // Get primary type (slot 1 or first type)
    const primaryType = details.types
      .slice()
      .sort((a, b) => a.slot - b.slot)[0];
    
    if (!primaryType?.type?.name) {
      return {};
    }
    
    const typeColor = getTypeColor(primaryType.type.name);
    
    // Create radial gradient from top-left corner (0% 0%) outward
    // Using rgba for transparency
    const rgb = typeColor.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
    if (!rgb) return {};
    
    const r = parseInt(rgb[1], 16);
    const g = parseInt(rgb[2], 16);
    const b = parseInt(rgb[3], 16);
    
    return {
      background: `radial-gradient(circle at 0% 0%, rgba(${r}, ${g}, ${b}, 0.25) 0%, rgba(${r}, ${g}, ${b}, 0.1) 40%, transparent 70%)`,
    };
  }, [details?.types]);

  return (
    <aside className="detail-panel">
      <div className="detail-inner" style={heroGradientStyle}>
        <button className="close" onClick={onClose} aria-label="Close">
          <span className="close-icon" aria-hidden="true" />
        </button>
        <div className="detail-title detail-title-top">
          {id ? <span className="dexno">{displayDexNumber}</span> : null}
          <h2>{formatDisplayName(name)}</h2>
        </div>
        <div className="detail-hero">
          <div className="hero-left">
            <div className="detail-art-wrap">
              <img
                className={`detail-art ${animated ? "is-animated" : "is-static"}`}
                src={detailImg}
                alt={name}
                loading="lazy"
                onError={handleDetailArtError}
              />
            </div>
            <div className="hero-controls">
              <div className="toggle-group">
                <button
                  type="button"
                  className={`ability-chip toggle-chip${animated ? " is-on" : ""}`}
                  onClick={() => setAnimated((v) => !v)}
                  onMouseUp={(e) => e.currentTarget.blur()}
                  aria-pressed={animated}
                  title={animated ? "Use HD static sprite" : "Use animated sprite"}
                  aria-label={`Animation ${animated ? "on" : "off"}`}
                >
                  <span className="toggle-label">Animate</span>
                </button>
                <button
                  type="button"
                  className={`ability-chip toggle-chip${shiny ? " is-on" : ""}`}
                  onClick={handleShinyToggle}
                  onMouseUp={(e) => e.currentTarget.blur()}
                  aria-pressed={shiny}
                  title={shiny ? "Show default variant" : "Show shiny variant"}
                  aria-label={`Shiny ${shiny ? "on" : "off"}`}
                >
                  <span className="toggle-label">Shiny</span>
                </button>
                {hasGenderVariants && (
                  <button
                    type="button"
                    className={`ability-chip toggle-chip gender-toggle${female ? " is-on" : ""}`}
                    onClick={() => setFemale((v) => !v)}
                    onMouseUp={(e) => e.currentTarget.blur()}
                    aria-pressed={female}
                    title={female ? "Female selected. Click to switch to Male" : "Male selected. Click to switch to Female"}
                    aria-label={female ? "Selected gender: Female" : "Selected gender: Male"}
                  >
                    <span
                      className={`gender-symbol ${female ? "is-female" : "is-male"}`}
                      aria-hidden="true"
                    >
                      {female ? "♀" : "♂"}
                    </span>
                  </button>
                )}
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
                          <img 
                            src={getTypeIconUrl(t.type.name)} 
                            alt={t.type.name} 
                            className="type-icon"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <span className="type-name">{t.type.name}</span>
                        </span>
                      ))}
                  </div>
                </div>
                <div className="about-row">
                  <span className="label">Abilities</span>
                  <div className="value">
                    {(details?.abilities || [])
                      .filter((a) => !a.is_hidden)
                      .map((a) => (
                        <button
                          key={a.ability.name}
                          type="button"
                          className="ability-chip"
                          onClick={() => handleAbilityClick(a)}
                          aria-label={`View details for ${humanizeName(a.ability.name)} ability`}
                        >
                          <span className="text-capitalize">{humanizeName(a.ability.name)}</span>
                        </button>
                      ))}
                  </div>
                </div>
                {(details?.abilities || []).some((a) => a.is_hidden) && (
                  <div className="about-row">
                    <span className="label">Hidden Ability</span>
                    <div className="value">
                      {(details?.abilities || [])
                        .filter((a) => a.is_hidden)
                        .map((a) => (
                          <button
                            key={a.ability.name}
                            type="button"
                            className="ability-chip is-hidden"
                            onClick={() => handleAbilityClick(a)}
                            aria-label={`View details for ${humanizeName(a.ability.name)} ability`}
                          >
                            <span className="text-capitalize">{humanizeName(a.ability.name)}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
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
                <div className="about-row">
                  <span className="label">Recommended Nature</span>
                  <div className="value nature-value">
                    {smogonLoading ? (
                      <span className="nature-loading" aria-live="polite">
                        <span className="nature-spinner" aria-hidden="true" />
                        Loading
                      </span>
                    ) : smogonError ? (
                      <span className="nature-placeholder" title={smogonError}>
                        Unavailable
                      </span>
                    ) : smogonNature ? (
                      <button
                        type="button"
                        className="nature-chip"
                        onClick={handleNatureClick}
                        aria-label={`View details for ${smogonNature} nature`}
                      >
                        <span className="text-capitalize">{smogonNature}</span>
                      </button>
                    ) : (
                      <span className="nature-placeholder" title="No competitive data available">
                        -
                      </span>
                    )}
                  </div>
                </div>
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
                        <img 
                          src={getTypeIconUrl(w.type)} 
                          alt={w.type} 
                          className="type-icon"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <span className="type-name">
                          {w.type}
                          {w.mult >= 4 ? " x4" : w.mult > 1 ? " x2" : ""}
                        </span>
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
                        <img 
                          src={getTypeIconUrl(r.type)} 
                          alt={r.type} 
                          className="type-icon"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <span className="type-name">
                          {r.type}
                          {r.mult === 0 ? " x0" : r.mult <= 0.25 ? " x0.25" : " x0.5"}
                        </span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="hero-right">
            <section className="stats hero-stats">
              <div className="stats-header">
                <div className="stats-header-left">
                  {Array.isArray(details?.stats) && details.stats.length > 0 && (
                    <span className="stat-total-pill" title="Base stat total">
                      <span className="stat-total-label">Stat Total</span>
                      <span className="stat-total-value">
                        {(details?.stats || []).reduce(
                          (sum, s) => sum + (typeof s?.base_stat === "number" ? s.base_stat : 0),
                          0,
                        )}
                      </span>
                    </span>
                  )}
                </div>
                {hasRecommendedEvs && (
                  <div className="ev-info-cta">
                    <button
                      type="button"
                      className="ev-info-button"
                      onClick={openEvInfoModal}
                    >
                      Recommended EV Information
                    </button>
                  </div>
                )}
              </div>
              <div className="stats-list">
                {(details?.stats || []).map((s) => {
                  const statName = s?.stat?.name || "";
                  const evKey = STAT_TO_EVS_KEY[statName];
                  const recommendedEv =
                    evKey && smogonEvs && typeof smogonEvs[evKey] === "number"
                      ? smogonEvs[evKey]
                      : null;
                  const showRecommended = typeof recommendedEv === "number" && recommendedEv > 0;
                  const statLabel = getStatLabel(statName, isMobile);
                  return (
                    <div className="stat-row" key={statName}>
                      <div className="stat-label">{statLabel}</div>
                      <div className="stat-bar-wrap">
                        <div className="stat-bar">
                          <div
                            className="stat-fill"
                            style={{ 
                              width: `${Math.min(100, (s.base_stat / 180) * 100)}%`,
                              background: getStatColor(s.base_stat)
                            }}
                            title={`${s.base_stat}`}
                          />
                        </div>
                        <span className="stat-base">{s.base_stat}</span>
                      </div>
                      <div className="stat-value">
                        {showRecommended ? (
                          <span
                            className="stat-recommend"
                            title={`Recommended ${statLabel} EVs: ${recommendedEv}`}
                          >
                            <span className="stat-recommend-icon" aria-hidden="true" />
                            <span className="stat-recommend-text">{recommendedEv}</span>
                            <span className="stat-recommend-suffix" aria-hidden="true">
                              EVs
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            {evoPaths.length > 0 && (
              <section className="evo-section">
                {hasAnyAlternateForms && (
                  <div className="evo-tree-actions">
                    <button
                      type="button"
                      className="alt-forms-button"
                      onClick={openAggregatedAltForms}
                      title="Alt forms"
                    >
                      alt forms
                    </button>
                  </div>
                )}
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
            <section className="catch-section single-col catch-section-inline">
              {gameAvailabilityLoading ? (
                <div className="catch-loading">Loading encounter data...</div>
              ) : gameAvailabilityError ? (
                <div className="catch-error">{gameAvailabilityError}</div>
              ) : gameAvailability.length > 0 && latestCatchGame ? (
                <button
                  type="button"
                  className="catch-pill catch-trigger-button"
                  onClick={handleCatchModalOpen}
                  aria-label={`View catch locations for ${name || "this Pokemon"} in ${latestCatchGame.label || "the latest game"}`}
                >
                  {latestCatchLogos.length > 0 && (
                    <span className="catch-pill-logos" aria-hidden="true">
                      {latestCatchLogos.map((src) => (
                        <img key={src} src={src} alt="" className="catch-pill-logo" />
                      ))}
                    </span>
                  )}
                  <span className="catch-trigger-text">
                    <span className="catch-trigger-primary">{latestCatchGame.label}</span>
                    {latestCatchLocationPreview ? (
                      <span className="catch-trigger-secondary">{latestCatchLocationPreview}</span>
                    ) : null}
                  </span>
                  <span className="catch-trigger-count">catch locations</span>
                </button>
              ) : (
                <div className="catch-empty">No wild encounter data for this Pokemon.</div>
              )}
            </section>
            {flavorTextVersions.length > 0 && (
              <section
                className="catch-section single-col"
                style={{ padding: "0 16px 0", marginTop: "-16px" }}
              >
                <div className="matchup-box pokedex-entry-box">
                  <div className="matchup-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <span>Pokedex Entry</span>
                    {flavorTextVersions.length > 1 && currentVersionLogo && (
                      <button
                        type="button"
                        onClick={openFlavorModal}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: "8px",
                          padding: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          transition: "border-color 0.15s ease, transform 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                        title="View all Pokedex entries"
                      >
                        <img
                          src={currentVersionLogo}
                          alt=""
                          width={28}
                          height={28}
                          className="pokedex-entry-logo"
                          style={{ display: "block" }}
                        />
                      </button>
                    )}
                  </div>
                  {selectedFlavorText && (
                    <div style={{ fontSize: "0.9rem", color: "#cbd5f5", lineHeight: "1.5", fontStyle: "italic" }}>
                      {selectedFlavorText}
                    </div>
                  )}
                </div>
              </section>
            )}
            {shouldShowLearnset && (
              <section className="learnset-panel">
                <button
                  type="button"
                  className="learnset-summary-button"
                  onClick={() => setIsLearnsetModalOpen(true)}
                  aria-label="View learned moves"
                >
                  <div className="learnset-summary-content">
                    <span className="learnset-summary-title">Learned Moves</span>
                    <div className="learnset-summary-stats">
                      <span className="learnset-summary-stat">
                        <span className="learnset-summary-label">Strongest</span>
                        <span className="learnset-summary-value">
                          {learnsetSummary.strongestMove 
                            ? `${learnsetSummary.strongestMove.label} (${learnsetSummary.strongestMove.details?.power ?? '—'})`
                            : '—'}
                        </span>
                      </span>
                      <span className="learnset-summary-stat">
                        <span className="learnset-summary-label">Types</span>
                        <span className="learnset-summary-value">{learnsetSummary.typeCoverage.size}</span>
                      </span>
                      {learnsetSummary.avgPower != null && (
                        <span className="learnset-summary-stat">
                          <span className="learnset-summary-label">Avg Power</span>
                          <span className="learnset-summary-value">{learnsetSummary.avgPower}</span>
                        </span>
                      )}
                      <span className="learnset-summary-stat">
                        <span className="learnset-summary-label">Total Moves</span>
                        <span className="learnset-summary-value">
                          {learnsetMeta.levelCount + learnsetMeta.machineCount}
                        </span>
                      </span>
                    </div>
                  </div>
                </button>
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
      {natureOverlayName && smogonNature && (
        <NatureOverlay
          natureName={natureOverlayName}
          recommendedNature={smogonNature}
          onClose={closeNatureOverlay}
        />
      )}
      {activeGame && (
        <GameAvailabilityModal
          games={gameAvailability}
          activeGame={activeGame}
          pokemonName={name}
          onClose={closeGameModal}
        />
      )}
      {isEvModalOpen && hasRecommendedEvs && (
        <RecommendedEvModal
          evs={smogonEvs}
          stats={details?.stats || []}
          onClose={closeEvInfoModal}
        />
      )}
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
      {isFlavorModalOpen && flavorTextVersions.length > 0 && (
        <PokedexEntriesModal
          versions={flavorTextVersions}
          selectedVersion={selectedFlavorVersion}
          onSelect={selectFlavorVersion}
          onClose={closeFlavorModal}
          pokemonName={name}
        />
      )}
      {isEvolutionDetailModalOpen && evolutionDetailData && (
        <EvolutionDetailModal
          data={evolutionDetailData}
          currentForm={currentPokemonForm}
          pokemonName={name}
          onClose={() => setIsEvolutionDetailModalOpen(false)}
        />
      )}
      {isAltFormsModalOpen && altFormsForModal.length > 0 && (
        <AlternateFormsModal
          forms={altFormsForModal}
          onClose={() => setIsAltFormsModalOpen(false)}
          onSelectPokemon={onSelectPokemon}
          title={altFormsModalTitle}
          shiny={shiny}
        />
      )}
      {isLearnsetModalOpen && shouldShowLearnset && (
        <LearnsetModal
          learnset={learnset}
          learnsetMeta={learnsetMeta}
          pokemonName={name}
          moveDetailsMap={moveDetailsMap}
          onClose={() => setIsLearnsetModalOpen(false)}
        />
      )}
    </aside>
  );
}

function RecommendedEvModal({ evs, stats, onClose }) {
  const modalTitleId = "recommended-ev-modal-title";
  const evEntries = useMemo(() => {
    if (!evs || typeof evs !== "object") return [];
    const statList = Array.isArray(stats) ? stats : [];
    return statList
      .map((entry) => {
        const statName = entry?.stat?.name;
        if (!statName) return null;
        const evKey = STAT_TO_EVS_KEY[statName];
        const value = evKey ? evs[evKey] : null;
        if (typeof value !== "number" || value <= 0) return null;
        return {
          stat: statName,
          label: humanizeName(statName),
          value,
          baseStat: typeof entry?.base_stat === "number" ? entry.base_stat : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.value - a.value);
  }, [evs, stats]);

  const totalRecommended = useMemo(
    () => evEntries.reduce((sum, entry) => sum + entry.value, 0),
    [evEntries],
  );
  
  const recommendedStatKeys = useMemo(() => {
    const set = new Set();
    for (const entry of evEntries) {
      if (entry?.stat) {
        set.add(entry.stat);
      }
    }
    return set;
  }, [evEntries]);

  const groupedItems = useMemo(() => {
    const hasEntries = evEntries.length > 0;
    if (!hasEntries) return {};

    const baseItems = [];
    const generalItems = [];

    EV_ITEM_GUIDE.forEach((item) => {
      if (!item) return;
      const { statKeys = [] } = item;
      const matches =
        statKeys.includes("*") || statKeys.some((key) => recommendedStatKeys.has(key));
      if (!matches) return;
      if (statKeys.includes("*")) {
        generalItems.push(item);
      } else {
        baseItems.push(item);
      }
    });

    const powerItems = Array.from(recommendedStatKeys)
      .map((stat) => {
        const variant = POWER_ITEM_VARIANTS[stat];
        if (!variant) return null;
        const statLabel = humanizeName(stat);
        return {
          name: variant.name,
          stat: statLabel,
          description: `+8 ${statLabel} EVs per battle while held (halves Speed in battle)`,
          icon: variant.icon,
          category: "Held Items",
          order: variant.order ?? 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);

    const featherItems = Array.from(recommendedStatKeys)
      .map((stat) => {
        const variant = FEATHER_VARIANTS[stat];
        if (!variant) return null;
        const statLabel = humanizeName(stat);
        return {
          name: variant.name,
          stat: statLabel,
          description: `+1 ${statLabel} EV instantly`,
          icon: variant.icon,
          category: "Consumables",
          order: variant.order ?? 100,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);

    const allItems = [...baseItems, ...powerItems, ...featherItems, ...generalItems];

    // Group items by category
    const grouped = {};
    allItems.forEach((item) => {
      const category = item.category || "Other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });

    // Sort items within each category
    Object.keys(grouped).forEach((category) => {
      grouped[category].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });

    return grouped;
  }, [recommendedStatKeys, evEntries]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleBackdropMouseDown = (event) => {
    event.stopPropagation();
    onClose?.();
  };

  const handleModalMouseDown = (event) => {
    event.stopPropagation();
  };

  if (evEntries.length === 0) return null;

  return (
    <div className="ev-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <div
        className="ev-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        onMouseDown={handleModalMouseDown}
      >
        <button
          type="button"
          className="ev-modal-close"
          onClick={onClose}
          aria-label="Close recommended EV information"
        >
          Close
        </button>
        <h3 id={modalTitleId} className="ev-modal-title">
          Recommended EV Information
        </h3>
        <p className="ev-modal-intro">
          Smogon recommended EV spreads focus on maximizing the stats that matter most. Use the spread summary and
          training items below to reach the suggested build quickly.
        </p>
        <div className="ev-modal-content-layout">
          <section className="ev-modal-column ev-modal-spread-column">
            <h4 className="ev-modal-subtitle">Recommended Spread</h4>
            <ul className="ev-modal-spread">
              {evEntries.map((entry) => (
                <li key={entry.stat} className="ev-spread-row">
                  <span className="ev-spread-stat text-capitalize">{entry.label}</span>
                  <span className="ev-spread-value">{entry.value}</span>
                  {entry.baseStat != null && <span className="ev-spread-base">Base {entry.baseStat}</span>}
                </li>
              ))}
            </ul>
            <div className="ev-modal-total">Total recommended EVs: {totalRecommended}</div>
            <div className="ev-modal-explanation">
              <p className="ev-modal-explanation-text">
                EVs increase stats in increments of 4. Every 4 EVs = +1 to the stat at level 100. The recommended spread 
                optimizes stat gains without wasting EVs on values that don't reach the next breakpoint.
              </p>
            </div>
          </section>
          <div className="ev-modal-items-columns">
            {Object.keys(groupedItems).length > 0 ? (
              Object.entries(groupedItems).map(([category, items]) => (
                <div key={category} className="ev-item-category">
                  <h5 className="ev-item-category-title">{category}</h5>
                  <ul className="ev-modal-items">
                    {items.map((item) => (
                      <li key={item.name} className="ev-item-row">
                        <div className="ev-item-left">
                          {item.icon && (
                            <span className="ev-item-icon">
                              <img src={item.icon} alt={`${item.name} icon`} loading="lazy" />
                            </span>
                          )}
                          <div className="ev-item-title">
                            <span className="ev-item-name">{item.name}</span>
                            <span className="ev-item-stat">{item.stat}</span>
                          </div>
                        </div>
                        <div className="ev-item-description">{item.description}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <div className="ev-modal-empty">No EV training items match this spread.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NatureOverlay({ natureName, recommendedNature, onClose }) {
  const normalizedNature = (natureName || "").toLowerCase();
  const recommendedNormalized = (recommendedNature || "").toLowerCase();
  const natureTitleId = normalizedNature ? `nature-modal-title-${normalizedNature}` : undefined;
  const initialSelectedNature = normalizedNature || null;
  const initialNatureData =
    initialSelectedNature ? natureDetailsCache.get(initialSelectedNature) || null : null;

  const [selectedNature, setSelectedNature] = useState(initialSelectedNature);
  const [natureData, setNatureData] = useState(initialNatureData);
  const [natureLoading, setNatureLoading] = useState(() => !!initialSelectedNature && !initialNatureData);
  const [natureError, setNatureError] = useState(null);
  const [natureList, setNatureList] = useState(() => normalizeNatureEntries(cachedNatureList));
  const [listLoading, setListLoading] = useState(
    () => !Array.isArray(cachedNatureList) || cachedNatureList.length === 0,
  );
  const [listError, setListError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

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
    setSelectedNature(normalizedNature || null);
  }, [normalizedNature]);

  useEffect(() => {
    if (cachedNatureList) {
      const normalized = normalizeNatureEntries(cachedNatureList);
      cachedNatureList = normalized;
      setNatureList(normalized);
      setListLoading(false);
      return;
    }
    let ignore = false;
    setListLoading(true);
    setListError(null);
    queuedFetch("https://pokeapi.co/api/v2/nature?limit=100")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (ignore) return;
        const decorated = Array.isArray(data?.results)
          ? data.results
              .filter((entry) => entry?.name)
              .map((entry) => decorateNatureEntry(entry.name, entry.url))
          : [];
        const normalized = sortNatureEntries(decorated);
        cachedNatureList = normalized;
        setNatureList(normalized);
        setListLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setListError("Unable to load nature list. Please try again.");
        setListLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedNature) {
      setNatureData(null);
      setNatureError(null);
      setNatureLoading(false);
      return;
    }
    const cached = natureDetailsCache.get(selectedNature);
    if (cached) {
      setNatureData(cached);
      setNatureError(null);
      setNatureLoading(false);
      return;
    }
    let ignore = false;
    setNatureLoading(true);
    setNatureError(null);
    setNatureData(null);
    queuedFetch(`https://pokeapi.co/api/v2/nature/${selectedNature}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (ignore) return;
        natureDetailsCache.set(selectedNature, data);
        setNatureData(data);
        setNatureLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setNatureError("Unable to load nature details. Please try again.");
        setNatureLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [selectedNature]);

  const filteredNatures = useMemo(() => {
    if (!Array.isArray(natureList) || natureList.length === 0) return [];
    const query = searchTerm.trim().toLowerCase();
    if (!query) return natureList;
    return natureList.filter((entry) => entry.name.includes(query));
  }, [natureList, searchTerm]);

  const getStatLabel = (stat) => {
    if (!stat) return "";
    return NATURE_STAT_LABELS.get(stat) || humanizeName(stat);
  };

  const likesFlavor = natureData?.likes_flavor?.name || null;
  const hatesFlavor = natureData?.hates_flavor?.name || null;
  const increasedStat = natureData?.increased_stat?.name || null;
  const decreasedStat = natureData?.decreased_stat?.name || null;
  const isNeutralNature =
    increasedStat && decreasedStat && increasedStat === decreasedStat;

  const battlePreferences = useMemo(() => {
    if (!Array.isArray(natureData?.move_battle_style_preferences)) return [];
    return natureData.move_battle_style_preferences
      .map((pref) => {
        const style = pref?.move_battle_style?.name;
        if (!style) return null;
        return {
          style,
          low: pref.low_hp_preference ?? null,
          high: pref.high_hp_preference ?? null,
        };
      })
      .filter(Boolean);
  }, [natureData]);

  const pokeathlonChanges = useMemo(() => {
    if (!Array.isArray(natureData?.pokeathlon_stat_changes)) return [];
    return natureData.pokeathlon_stat_changes
      .map((entry) => {
        const stat = entry?.pokeathlon_stat?.name;
        if (!stat) return null;
        const change = entry.max_change ?? 0;
        if (change === 0) return null;
        return { stat, change };
      })
      .filter(Boolean)
      .sort((a, b) => a.stat.localeCompare(b.stat));
  }, [natureData]);

  const selectedLabel = selectedNature ? humanizeName(selectedNature) : "Nature";
  const isRecommendedSelection =
    selectedNature && selectedNature === recommendedNormalized;

  const handleBackdropMouseDown = (event) => {
    event.stopPropagation();
    onClose();
  };

  const handleModalMouseDown = (event) => {
    event.stopPropagation();
  };

  const handleNatureSelect = (name) => {
    if (!name) return;
    setSelectedNature(name);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  return (
    <div className="ability-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <div
        className="ability-modal nature-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={natureTitleId}
        onMouseDown={handleModalMouseDown}
      >
        <button type="button" className="ability-modal-close" onClick={onClose} aria-label="Close nature details">
          X
        </button>
        <div className="ability-modal-left">
          <div className="ability-modal-header">
            <h2 className="ability-modal-title" id={natureTitleId}>
              <span className="text-capitalize">{selectedLabel}</span>
              {isRecommendedSelection && <span className="ability-tag ability-title-tag">Recommended</span>}
            </h2>
            <div className="ability-modal-subtle">
              {isRecommendedSelection ? "Smogon recommended nature" : "Comparing alternative nature"}
            </div>
          </div>
          <div className="ability-modal-body nature-modal-body">
            {natureLoading ? (
              <div className="ability-modal-loading">Loading nature details...</div>
            ) : natureError ? (
              <div className="ability-modal-error">
                <p>{natureError}</p>
              </div>
            ) : natureData ? (
              <>
                <div className="nature-section">
                  <h3 className="nature-section-title">Stat Changes</h3>
                  <p className="nature-section-description">
                    Natures apply a 10% modifier to the listed stats during battle, boosting one stat while lowering another.
                  </p>
                  {isNeutralNature ? (
                    <div className="nature-neutral-card">This nature does not alter stats.</div>
                  ) : (
                    <div className="nature-highlight-grid">
                      {increasedStat && (
                        <div className="nature-highlight nature-highlight-positive">
                          <span className="nature-highlight-label">Raises</span>
                          <span className="nature-highlight-value text-capitalize">
                            {humanizeName(increasedStat)}
                          </span>
                        </div>
                      )}
                      {decreasedStat && (
                        <div className="nature-highlight nature-highlight-negative">
                          <span className="nature-highlight-label">Lowers</span>
                          <span className="nature-highlight-value text-capitalize">
                            {humanizeName(decreasedStat)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {(likesFlavor || hatesFlavor) && (
                  <div className="nature-section">
                    <h3 className="nature-section-title">Flavor Preferences</h3>
                    <p className="nature-section-description">
                      Influences which Berry flavors this Pokemon enjoys or dislikes when making Pokeblocks or Poffins.
                    </p>
                    <div className="nature-highlight-grid">
                      {likesFlavor && (
                        <div className="nature-highlight nature-highlight-flavor-like">
                          <span className="nature-highlight-label">Likes</span>
                          <span className="nature-highlight-value text-capitalize">
                            {humanizeName(likesFlavor)} flavor
                          </span>
                        </div>
                      )}
                      {hatesFlavor && (
                        <div className="nature-highlight nature-highlight-flavor-hate">
                          <span className="nature-highlight-label">Dislikes</span>
                          <span className="nature-highlight-value text-capitalize">
                            {humanizeName(hatesFlavor)} flavor
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {battlePreferences.length > 0 && (
                  <div className="nature-section">
                    <h3 className="nature-section-title">Move Style Preference</h3>
                    <p className="nature-section-description">
                      Used in the Battle Palace to decide whether the AI favors attacking, defensive, or support moves at different HP ranges.
                    </p>
                    <ul className="nature-info-list">
                      {battlePreferences.map((pref) => (
                        <li key={pref.style} className="nature-info-card">
                          <div className="nature-info-card-title text-capitalize">
                            {humanizeName(pref.style)}
                          </div>
                          <div className="nature-info-card-grid">
                            <div>
                              <span className="nature-info-chip-label">Low HP</span>
                              <span className="nature-info-chip-value">{pref.low ?? "-"}</span>
                            </div>
                            <div>
                              <span className="nature-info-chip-label">High HP</span>
                              <span className="nature-info-chip-value">{pref.high ?? "-"}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {pokeathlonChanges.length > 0 && (
                  <div className="nature-section">
                    <h3 className="nature-section-title">Pokeathlon Impact</h3>
                    <p className="nature-section-description">
                      Adjusts the stats used during the HeartGold and SoulSilver Pokeathlon events.
                    </p>
                    <ul className="nature-info-list">
                      {pokeathlonChanges.map((entry) => (
                        <li key={entry.stat} className="nature-info-card">
                          <div className="nature-info-card-title text-capitalize">
                            {humanizeName(entry.stat)}
                          </div>
                          <div className={`nature-info-change ${entry.change > 0 ? "is-positive" : "is-negative"}`}>
                            {entry.change > 0 ? "+" : ""}
                            {entry.change}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="ability-modal-error">
                <p>Nature details unavailable.</p>
              </div>
            )}
          </div>
        </div>
        <div className="ability-modal-right nature-modal-right">
          <h3 className="ability-modal-subtitle">All Natures</h3>
          <div className="ability-learners-header">
            <input
              type="search"
              className="ability-search-input"
              placeholder="Search natures..."
              value={searchTerm}
              onChange={handleSearchChange}
              aria-label="Search natures"
            />
          </div>
          <div className="ability-learners-scroll nature-list-scroll">
            {listLoading ? (
              <div className="ability-learners-loading">Loading natures...</div>
            ) : listError ? (
              <div className="ability-learners-error">{listError}</div>
            ) : filteredNatures.length > 0 ? (
              <ul className="nature-list">
                {filteredNatures.map((entry) => {
                  const isActive = entry.name === selectedNature;
                  const isRecommended = entry.name === recommendedNormalized;
                  const hasStatChange = Boolean(entry.primaryStat);
                  return (
                    <li key={entry.name}>
                      <button
                        type="button"
                        className={`nature-item${isActive ? " is-active" : ""}${isRecommended ? " is-recommended" : ""}`}
                        onClick={() => handleNatureSelect(entry.name)}
                        aria-pressed={isActive}
                      >
                        <div className="nature-item-main">
                          <span className="nature-item-name text-capitalize">{humanizeName(entry.name)}</span>
                          <div className={`nature-item-statline${hasStatChange ? "" : " is-neutral"}`}>
                            {hasStatChange ? (
                              <>
                                <span className="nature-item-chip nature-item-chip-positive">
                                  +{getStatLabel(entry.raises)}
                                </span>
                                {entry.lowers && (
                                  <span className="nature-item-chip nature-item-chip-negative">
                                    -{getStatLabel(entry.lowers)}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="nature-item-chip nature-item-chip-neutral">No stat change</span>
                            )}
                          </div>
                        </div>
                        {isRecommended && <span className="nature-item-tag">Recommended</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="ability-learners-empty">No natures match your search.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GameAvailabilityModal({ games, activeGame, pokemonName, onClose }) {
  const gameList = Array.isArray(games) ? games : [];
  const activeVersion = activeGame?.version ?? null;
  const displayPokemonName = pokemonName ? formatDisplayName(pokemonName) : "";
  const titleId = "game-modal-title";
  const sortedGameList = useMemo(() => {
    const copy = gameList.slice();
    if (copy.length <= 1) return copy;

    const toOrderValue = (value) => {
      if (!value) return -1;
      if (VERSION_ORDER_LOOKUP.has(value)) return VERSION_ORDER_LOOKUP.get(value);
      const normalized = normalizeLocalKey(value);
      if (normalized && VERSION_ORDER_LOOKUP.has(normalized)) {
        return VERSION_ORDER_LOOKUP.get(normalized);
      }
      return -1;
    };

    const toGameOrder = (game) => {
      if (!game) return -1;

      const version = game.version;
      if (version) {
        const order = toOrderValue(version);
        if (order >= 0) return order;
      }

      if (Array.isArray(game.versions) && game.versions.length > 0) {
        const values = game.versions.map(toOrderValue).filter((value) => value >= 0);
        if (values.length > 0) return Math.max(...values);
      }

      const labelOrder = toOrderValue(game.label);
      if (labelOrder >= 0) return labelOrder;

      return -1;
    };

    copy.sort((a, b) => {
      const orderA = toGameOrder(a);
      const orderB = toGameOrder(b);
      if (orderA !== orderB) return orderB - orderA;

      const labelA = String(a?.label ?? "").toLowerCase();
      const labelB = String(b?.label ?? "").toLowerCase();
      if (labelA && labelB) return labelA.localeCompare(labelB);
      if (labelA) return -1;
      if (labelB) return 1;
      return 0;
    });

    return copy;
  }, [gameList]);
  const totalGames = sortedGameList.length;
  const activeSectionRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!activeVersion) return;
    if (!activeSectionRef.current) return;
    try {
      activeSectionRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    } catch {
      activeSectionRef.current.scrollIntoView();
    }
  }, [activeVersion]);

  const handleBackdropMouseDown = (event) => {
    event.stopPropagation();
    onClose?.();
  };

  const handleModalMouseDown = (event) => {
    event.stopPropagation();
  };

  let summaryText;
  if (totalGames === 0) {
    summaryText = "No wild encounter data available.";
  } else if (totalGames === 1) {
    summaryText = `Encounter data available in ${sortedGameList[0]?.label ?? "this game"}.`;
  } else {
    summaryText = `Encounter data across ${totalGames} games.`;
    if (activeGame?.label) {
      summaryText += ` Latest: ${activeGame.label}.`;
    }
  }

  return (
    <div className="game-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <div
        className="game-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={handleModalMouseDown}
      >
        <button type="button" className="game-modal-close" onClick={onClose} aria-label="Close catch locations">
          X
        </button>
        <header className="game-modal-header">
          <h2 className="game-modal-title" id={titleId}>
            {displayPokemonName && (
              <>
                <span className="game-modal-title-name">{displayPokemonName}</span>
                <span className="game-modal-title-sep"> – </span>
              </>
            )}
            <span className="game-modal-title-game">Encounter Locations</span>
          </h2>
          <p className="game-modal-subtitle">{summaryText}</p>
        </header>
        <div className="game-modal-body game-modal-body--single">
          {totalGames > 0 ? (
            <ul className="game-modal-area-list">
              {sortedGameList.map((game, gameIndex) => {
                const logos = Array.isArray(game?.logos)
                  ? game.logos
                      .map((logo) => GAME_LOGO_LOOKUP.get(logo))
                      .filter(Boolean)
                  : [];
                const methodEntries = [];
                const areas = Array.isArray(game?.areas) ? game.areas : [];
                areas.forEach((area, areaIndex) => {
                  const methods = Array.isArray(area?.methods) ? area.methods : [];
                  methods.forEach((method, methodIndex) => {
                    methodEntries.push({
                      method: method || {},
                      areaLabel: area?.label || "",
                      key: `${game.version || game.label || gameIndex}-${areaIndex}-${methodIndex}`,
                    });
                  });
                });
                const isActive = activeVersion != null && game.version === activeVersion;

                return (
                  <li
                    key={game.version || game.label || gameIndex}
                    className={`game-modal-area game-modal-game-area${isActive ? " is-active" : ""}`}
                    ref={isActive ? activeSectionRef : undefined}
                  >
                    {methodEntries.length > 0 ? (
                      <ul className="game-modal-methods">
                        {methodEntries.map(({ method, areaLabel, key }, methodIndex) => {
                          const descriptors = Array.isArray(method?.descriptors) ? method.descriptors : [];
                          const minLevel = method?.minLevel ?? method?.min_level ?? null;
                          const maxLevel = method?.maxLevel ?? method?.max_level ?? null;
                          const chance = method?.chance ?? null;
                          const metaParts = [];
                          if (minLevel != null || maxLevel != null) {
                            if (minLevel != null && maxLevel != null) {
                              metaParts.push(
                                minLevel === maxLevel ? `Lv. ${minLevel}` : `Lv. ${minLevel}-${maxLevel}`
                              );
                            } else if (minLevel != null) {
                              metaParts.push(`Lv. ${minLevel}+`);
                            } else if (maxLevel != null) {
                              metaParts.push(`Up to Lv. ${maxLevel}`);
                            }
                          }
                          if (chance != null) {
                            metaParts.push(`${chance}%`);
                          }
                          if (descriptors.length > 0) {
                            metaParts.push(descriptors.join(", "));
                          }
                          const areaTitle =
                            areaLabel &&
                            areaLabel.trim() &&
                            areaLabel.trim().toLowerCase() !== "locations"
                              ? areaLabel.trim()
                              : null;
                          const rawLabel = String(method?.label || "").trim();
                          const isGenericLabel = /^location\s+\d+$/i.test(rawLabel);
                          const labelParts = [];
                          if (areaTitle) labelParts.push(areaTitle);
                          if (rawLabel && !isGenericLabel) labelParts.push(rawLabel);
                          const displayLabel = labelParts.join(" • ");
                          const descriptionText = String(method?.description || "").trim();
                          const formattedDescription = (() => {
                            if (!descriptionText) return [];

                            const segments = [];
                            let buffer = "";
                            let parenDepth = 0;

                            const commit = () => {
                              const trimmed = buffer.trim();
                              if (trimmed) {
                                segments.push(trimmed);
                              }
                              buffer = "";
                            };

                            for (let idx = 0; idx < descriptionText.length; idx += 1) {
                              const char = descriptionText[idx];

                              if (char === "\r") {
                                continue;
                              }

                              if (char === "(") {
                                parenDepth += 1;
                                buffer += char;
                                continue;
                              }

                              if (char === ")") {
                                parenDepth = Math.max(0, parenDepth - 1);
                                buffer += char;
                                continue;
                              }

                              if (char === "\n" || char === ";" || char === "•") {
                                commit();
                                continue;
                              }

                              if (char === ",") {
                                if (parenDepth > 0) {
                                  buffer += char;
                                  continue;
                                }
                                commit();
                                continue;
                              }

                              buffer += char;
                            }

                            commit();
                            return segments;
                          })();
                          const showEmptyState =
                            formattedDescription.length === 0 && !displayLabel && metaParts.length === 0;
                          const isFirstMethod = methodIndex === 0;

                          return (
                            <li key={key} className="game-modal-method">
                              {isFirstMethod && (
                                <div className="game-modal-method-game">
                                  {logos.length > 0 && (
                                    <span className="game-modal-method-game-logos" aria-hidden="true">
                                      {logos.map((src) => (
                                        <img key={src} src={src} alt="" className="game-modal-logo" />
                                      ))}
                                    </span>
                                  )}
                                  <span className="game-modal-method-game-name">{game.label}</span>
                                </div>
                              )}
                              {displayLabel && (
                                <span className="game-modal-method-label">{displayLabel}</span>
                              )}
                              {metaParts.length > 0 && (
                                <span className="game-modal-method-meta">{metaParts.join(" • ")}</span>
                              )}
                              {formattedDescription.length > 0 && (
                                <ul className="game-modal-method-description">
                                  {formattedDescription.map((line, lineIdx) => (
                                    <li key={`${key}-desc-${lineIdx}`}>{line}</li>
                                  ))}
                                </ul>
                              )}
                              {showEmptyState && (
                                <div className="game-modal-methods-empty">Encounter details unavailable.</div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="game-modal-methods-empty">
                        <div className="game-modal-method-game">
                          {logos.length > 0 && (
                            <span className="game-modal-method-game-logos" aria-hidden="true">
                              {logos.map((src) => (
                                <img key={src} src={src} alt="" className="game-modal-logo" />
                              ))}
                            </span>
                          )}
                          <span className="game-modal-method-game-name">{game.label}</span>
                        </div>
                        <div>No encounter details available.</div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="game-modal-empty">No wild encounter data available.</div>
          )}
        </div>
      </div>
    </div>
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
                      <img 
                        src={getTypeIconUrl(type)} 
                        alt={type} 
                        className="type-icon"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <span className="type-name">{type}</span>
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
                          <SpriteImage
                            id={pokemon.id}
                            alt={pokemon.name}
                            width={44}
                            height={44}
                            loading="lazy"
                            shiny={shiny}
                          />
                          <div className="ability-learner-meta">
                            <div className="ability-learner-top">
                              <span className="ability-learner-name text-capitalize">{pokemon.name}</span>
                              {pokemon.isHidden && <span className="ability-learner-tag">H</span>}
                            </div>
                          </div>
                          {typeList.length > 0 && (
                            <div className="ability-learner-types">
                              {typeList.map((type) => (
                                <span key={`${pokemon.url}-${type}`} className={`ability-learner-type type-${type}`}>
                                  <img 
                                    src={getTypeIconUrl(type)} 
                                    alt={type} 
                                    className="type-icon"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                  <span className="type-name">{type}</span>
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




