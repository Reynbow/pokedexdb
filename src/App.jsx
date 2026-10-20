import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import SpriteImage from "./components/SpriteImage.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import PokemonCard from "./components/PokemonCard.jsx";
import "./App.css";
import "./styles/pokedex.css";
import "./styles/entry.css";
import "./styles/overlays.css";
import Icon, { Cursor } from "./components/Icon.jsx";
import { AreaPanel, DexDialog, Matchups, MovesPanel, StatMeters, TypeTag } from "./pokedex/EntryParts.jsx";
import DexStrip from "./pokedex/DexStrip.jsx";
import { readGamePreference, writeGamePreference } from "./pokedex/games.js";
import { findRecommendedNature, fetchSmogonSets, fetchSmogonImgsIndex, normalizeSpeciesName } from "./smogonApi";
import { getPokemonSlugFromPath, updatePokemonLocation, normalizePokemonSlug, getPokemonSlugFromLocation, getBasePath } from "./utils/url.js";
import { getTypeIconUrl } from "./utils/typeIcons.js";
import { formatPokemonName } from "./utils/pokemonNames.js";
import { formatMoveName } from "./utils/moveNames.js";
import { DEFAULT_TITLE, SITE_NAME } from "./routeMeta.js";
import { resolveRouteKey } from "./router.js";
import { ULTRA_BEASTS, PARADOX_NAMES, BABY_NAMES, REGIONAL_TOKENS, LEGENDARY_NAMES, MYTHICAL_NAMES } from "./constants/species.js";
import { ALL_TYPES, STAT_TO_EVS_KEY } from "./constants/types.js";
import { NEUTRAL_NATURE_KEY, NATURE_STAT_ORDER, NATURE_STAT_LABELS, NATURE_SUMMARIES } from "./constants/natures.js";
import { EV_ITEM_GUIDE, FEATHER_VARIANTS, POWER_ITEM_VARIANTS } from "./constants/evItems.js";
import { DEX_FILTERS, DEX_LOOKUP } from "./constants/dex.js";
import { NATIONAL_ID_TO_SLUG } from "./data/pokemonSpeciesMap.js";
import { SPECIAL_FILTERS, SPECIAL_TAG_META } from "./constants/tags.js";
import { CONDITION_LABEL_OVERRIDES, TIME_OF_DAY_LABELS, METHOD_LABEL_OVERRIDES } from "./constants/labels.js";
import { FORM_ORDER, ALT_FORM_HIDE_FLAGS } from "./constants/forms.js";
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
import {
  loadPokemonList,
  loadPokedexMaps,
  loadTypeChart,
  loadMoveData,
  getTypesForGeneration,
  getDetailTypesForGeneration,
  getTypeChartForGeneration,
  computeDefensiveMatchups,
  getMoveForVersionGroup,
} from "./data/staticData.js";

// Extra custom Pokémon entries that don't exist in PokeAPI but should appear in the Pokédex
// (only added when PokeAPI doesn't already list them)
const EXTRA_POKEMON = [
  // Use base Zygarde's pokemon URL so selecting the card still loads details
  { name: "zygarde-mega", url: "https://pokeapi.co/api/v2/pokemon/718" },
];

// Extra species allowed to appear in the Mega/Gigantamax preview list per game,
// even if their base species is not present in the active dex list.
const EXTRA_MEGA_SPECIES_BY_GAME = new Map([
  ["legends-za", [718]], // Allow Mega Zygarde to appear in Legends: Z-A
]);

// Extra custom alternate forms keyed by base species id
// Note: Use id >= 100000 to avoid collisions with real PokeAPI pokemon ids
const EXTRA_FORMS_BY_SPECIES = new Map([
  [
    718, // Zygarde (50% Forme) base species id
    [
      {
        id: 100718,
        name: "zygarde-mega",
        displayName: "Zygarde Mega",
        isDefault: false,
        tags: ["Mega", "Legendary"],
        isCurrent: false,
      },
    ],
  ],
]);

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

// "Mr. Mime", "mr mime" and "mr-mime" all become "mrmime"; "Flabébé" becomes "flabebe".
const normalizeSearchText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

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

const isCapFormName = (name) => {
  const lower = String(name || "").toLowerCase();
  return /(?:^|[-_\s])cap(?:$|[-_\s])/.test(lower) || lower.endsWith("cap");
};

// "pikachu-alola-cap" is Pikachu wearing a cap, not an Alolan form.
const isRegionalFormName = (name) => {
  if (isCapFormName(name)) return false;
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

const getEntryDataUrl = (entry) => {
  if (!entry) return null;
  return entry.dataUrl || entry.url || null;
};

const getEntryDisplayId = (entry) => {
  if (!entry) return null;
  if (entry.syntheticId != null) return String(entry.syntheticId);
  return getIdFromUrl(entry.url);
};

const toTitleCase = (value) => {
  const base = humanizeName(value);
  return base.replace(/\b\w/g, (char) => char.toUpperCase()).trim();
};

// Display names ("Mr. Mime", "Galarian Farfetch’d", "Legends: Z-A") come from utils/pokemonNames.js
const formatDisplayName = formatPokemonName;

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

// Newest first. DLC version groups are separate in PokeAPI (moves taught only in DLC are
// listed under them). FireRed/LeafGreen (Jan 2004) came out before Emerald (Sep 2004).
const VERSION_GROUP_RELEASE_ORDER = [
  "mega-dimension",
  "legends-za",
  "the-indigo-disk",
  "the-teal-mask",
  "scarlet-violet",
  "legends-arceus",
  "brilliant-diamond-and-shining-pearl",
  "the-crown-tundra",
  "the-isle-of-armor",
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
  "emerald",
  "firered-leafgreen",
  "ruby-sapphire",
  "crystal",
  "gold-silver",
  "yellow",
  "red-blue",
];

const VERSION_GROUP_ORDER_LOOKUP = new Map(
  VERSION_GROUP_RELEASE_ORDER.map((name, index) => [name, index])
);

// Hidden Machines per version group (HMs were removed in Gen 7)
const HM_MOVES_BY_VERSION_GROUP = (() => {
  const gen1 = ["cut", "fly", "surf", "strength", "flash"];
  const gen2 = [...gen1, "whirlpool", "waterfall"];
  const gen3 = ["cut", "fly", "surf", "strength", "flash", "rock-smash", "waterfall", "dive"];
  const dppt = ["cut", "fly", "surf", "strength", "defog", "rock-smash", "waterfall", "rock-climb"];
  const hgss = ["cut", "fly", "surf", "strength", "whirlpool", "rock-smash", "waterfall", "rock-climb"];
  const gen5 = ["cut", "fly", "surf", "strength", "waterfall", "dive"];
  const xy = ["cut", "fly", "surf", "strength", "waterfall"];
  const oras = [...xy, "rock-smash", "dive"];
  return new Map(
    [
      ["red-blue", gen1],
      ["yellow", gen1],
      ["gold-silver", gen2],
      ["crystal", gen2],
      ["ruby-sapphire", gen3],
      ["emerald", gen3],
      ["firered-leafgreen", gen3],
      ["diamond-pearl", dppt],
      ["platinum", dppt],
      ["heartgold-soulsilver", hgss],
      ["black-white", gen5],
      ["black-2-white-2", gen5],
      ["x-y", xy],
      ["omega-ruby-alpha-sapphire", oras],
    ].map(([group, moves]) => [group, new Set(moves)])
  );
})();

// Release position of a version group, oldest = 0 (unknown -> null)
const VERSION_GROUP_AGE = new Map(
  VERSION_GROUP_RELEASE_ORDER.slice().reverse().map((name, index) => [name, index])
);

// Regional forms that actually appear in a game (games not listed show every regional form
// that existed by then). BDSP has none; Legends: Arceus only has Hisuian forms.
const GAME_REGIONAL_FORMS = new Map([
  ["sun-moon", ["alola"]],
  ["ultra-sun-ultra-moon", ["alola"]],
  ["lets-go", ["alola"]],
  ["sword-shield", ["alola", "galar"]],
  ["brilliant-diamond-shining-pearl", []],
  ["legends-arceus", ["hisui"]],
]);

const GAME_KEY_TO_VERSION_GROUPS = new Map([
  ["scarlet-violet", ["scarlet-violet", "the-teal-mask", "the-indigo-disk"]],
  ["legends-arceus", ["legends-arceus"]],
  ["legends-za", ["legends-za", "mega-dimension"]],
  ["sword-shield", ["sword-shield", "the-isle-of-armor", "the-crown-tundra"]],
  ["ultra-sun-ultra-moon", ["ultra-sun-ultra-moon"]],
  ["sun-moon", ["sun-moon"]],
  ["omega-ruby-alpha-sapphire", ["omega-ruby-alpha-sapphire"]],
  ["x-y", ["x-y"]],
  ["black-2-white-2", ["black-2-white-2"]],
  ["black-white", ["black-white"]],
  ["heartgold-soulsilver", ["heartgold-soulsilver"]],
  ["platinum", ["platinum"]],
  ["diamond-pearl", ["diamond-pearl"]],
  ["brilliant-diamond-shining-pearl", ["brilliant-diamond-and-shining-pearl"]],
  ["firered-leafgreen", ["firered-leafgreen"]],
  ["ruby-sapphire-emerald", ["emerald", "ruby-sapphire"]],
  ["gold-silver-crystal", ["crystal", "gold-silver"]],
  ["red-blue-yellow", ["yellow", "red-blue"]],
  ["lets-go", ["lets-go-pikachu-lets-go-eevee"]],
]);

const DEX_KEY_TO_VERSION_GROUPS = new Map([
  ["paldea", ["scarlet-violet", "the-teal-mask", "the-indigo-disk"]],
  ["hisui", ["legends-arceus"]],
  ["galar", ["sword-shield", "the-isle-of-armor", "the-crown-tundra"]],
  ["alola", ["ultra-sun-ultra-moon", "sun-moon"]],
  ["kalos", ["x-y", "legends-za", "mega-dimension"]],
  ["unova", ["black-2-white-2", "black-white"]],
  ["sinnoh", ["brilliant-diamond-and-shining-pearl", "platinum", "diamond-pearl"]],
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
  ["the-isle-of-armor", "The Isle of Armor"],
  ["the-crown-tundra", "The Crown Tundra"],
  ["brilliant-diamond-and-shining-pearl", "Brilliant Diamond & Shining Pearl"],
  ["legends-arceus", "Legends: Arceus"],
  ["scarlet-violet", "Scarlet & Violet"],
  ["the-teal-mask", "The Teal Mask"],
  ["the-indigo-disk", "The Indigo Disk"],
  ["legends-za", "Legends: Z-A"],
  ["mega-dimension", "Mega Dimension"],
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
          label: formatDisplayName(versionName),
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
          label: toTitleCase(String(areaName).replace(/-area$/, "")),
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
      const methods = Array.from(area.methods.values()).map((method) => {
        const { key: _key, ...rest } = method;
        return rest;
      });
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


const normalizeLocalKey = (value) => {
  if (value == null) return "";
  let normalized = String(value)
    // Keep Nidoran♀ / Nidoran♂ apart (PokeAPI: nidoran-f / nidoran-m)
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
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

// Versions a key in pokemon_all.json refers to. A single-version key ("Red", "Black 2") only
// ever means that version — fanning it out to partner versions made e.g. Yellow show Red's
// Pokédex text and version exclusives show both the wild location and "Trade" in both games.
// Only combined keys ("sv", "Scarlet & Violet", "lets-go") map to several versions.
const resolveLocalVersionKeys = (code) => {
  const normalized = normalizeLocalKey(code);
  if (!normalized) return [];
  if (SPECIAL_VERSION_GROUPS.has(normalized)) {
    return SPECIAL_VERSION_GROUPS.get(normalized) || [];
  }
  const slug = VERSION_ALIAS_LOOKUP.get(normalized);
  return slug ? [slug] : [];
};

// The scraped data stores a row under the second version of a pair only when it differs from
// the first (e.g. Blue only appears when Blue's text differs from Red's). These pairs fill a
// missing partner from its first version. Third versions (Yellow, Crystal, Emerald, Platinum)
// always have their own rows, and Gold/HeartGold rows are missing from the data entirely.
const COLLAPSED_PARTNER_SOURCES = new Map([
  ["blue", "red"],
  ["silver", "gold"],
  ["sapphire", "ruby"],
  ["leafgreen", "firered"],
  ["pearl", "diamond"],
  ["soulsilver", "heartgold"],
  ["white", "black"],
  ["white-2", "black-2"],
  ["y", "x"],
  ["alpha-sapphire", "omega-ruby"],
  ["moon", "sun"],
  ["ultra-moon", "ultra-sun"],
  ["lets-go-eevee", "lets-go-pikachu"],
  ["shield", "sword"],
  ["shining-pearl", "brilliant-diamond"],
  ["violet", "scarlet"],
]);

/** Adds inferred partner entries (`inferred: true`) to a Map<version, value>. */
const fillCollapsedPartners = (versionMap, cloneValue) => {
  COLLAPSED_PARTNER_SOURCES.forEach((source, partner) => {
    if (versionMap.has(partner) || !versionMap.has(source)) return;
    const value = cloneValue(versionMap.get(source));
    if (value) versionMap.set(partner, value);
  });
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

// Pokédex entries and locations (public/data/pokemon_all.json) are served split by the first
// letter of the Pokémon's name (/data/dex/<letter>.json, see scripts/dex-shards-plugin.mjs),
// so opening a Pokémon downloads ~100 KB instead of the whole 2.6 MB file.
const dexShardKey = (normalizedName) => String(normalizedName || "").charAt(0) || "_";
const dexShardCache = new Map(); // shard key -> Promise<Map<normalizedName, record[]>>

const buildCombinedDataMap = (json) => {
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
  return map;
};

const loadDexShard = (key) => {
  if (!dexShardCache.has(key)) {
    const url = `${getBasePath()}data/dex/${key}.json`;
    const promise = queuedFetch(url)
      .then((response) => {
        if (!response?.ok) {
          throw new Error(`Failed to load ${url}: ${response?.status ?? "unknown"}`);
        }
        return response.json();
      })
      .then(buildCombinedDataMap)
      .catch((error) => {
        dexShardCache.delete(key);
        throw error;
      });
    dexShardCache.set(key, promise);
  }
  return dexShardCache.get(key);
};

const normalizedKeyMatches = (left, right) => {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.startsWith(`${right}-`)) return true;
  if (right.startsWith(`${left}-`)) return true;
  return false;
};

const findCombinedRecords = async (nameCandidates = []) => {
  // Names only (numeric ids never match a record)
  const normalizedCandidates = (nameCandidates || []).map(normalizeLocalKey).filter((value) => /^[a-z]/.test(value));
  if (normalizedCandidates.length === 0) return null;
  const shardKeys = Array.from(new Set(normalizedCandidates.map(dexShardKey)));
  const maps = await Promise.all(shardKeys.map(loadDexShard));
  for (const candidate of normalizedCandidates) {
    for (const map of maps) {
      const bucket = map.get(candidate);
      if (bucket && bucket.length > 0) return bucket;
    }
  }
  for (const map of maps) {
    for (const [key, bucket] of map.entries()) {
      if (normalizedCandidates.some((candidate) => normalizedKeyMatches(key, candidate))) {
        return bucket;
      }
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
            .flatMap((gameCode) => resolveLocalVersionKeys(gameCode))
            .filter(Boolean)
        )
      );

      if (versions.length === 0) continue;

      for (const version of versions) {
        if (!versionMap.has(version)) versionMap.set(version, { descriptions: new Set(), inferred: false });
        versionMap.get(version).descriptions.add(description);
      }
    }
  }

  if (versionMap.size === 0) return [];
  fillCollapsedPartners(versionMap, (value) => ({ descriptions: new Set(value.descriptions), inferred: true }));

  const normalized = [];
  for (const [version, { descriptions, inferred }] of versionMap.entries()) {
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
      __inferred: inferred,
    });
  }

  normalized.sort(compareVersionEntries);
  return normalized;
}

const EMPTY_LOCAL_FLAVOR = { entries: [], otherFormTexts: new Set() };

// Pokédex text from pokemon_all.json for one Pokémon. A record's `entries` are the base species';
// `forms` holds each form's own entries by PokeAPI name ("vulpix-alola", "rotom-wash"), which
// replace the base text for that form. Also returns the text of the species' other forms:
// PokeAPI's species text for some games is a form's entry (Hisuian Arcanine in Legends: Arceus,
// Attack Forme Deoxys in FireRed), so it must not be shown for the base species or other forms.
async function loadLocalPokedexEntriesForSpecies(pokemonName, ...nameCandidates) {
  const candidates = nameCandidates.filter(Boolean);
  const records = await findCombinedRecords(candidates);

  if (!Array.isArray(records) || records.length === 0) {
    return EMPTY_LOCAL_FLAVOR;
  }

  const baseTextMap = new Map();
  const formTextMap = new Map();
  let versionTextMap = baseTextMap;

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
      const versions = resolveLocalVersionKeys(gameCode);
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

  const formKey = normalizeLocalKey(pokemonName);
  const otherFormTexts = new Set();
  versionTextMap = formTextMap;
  records.forEach((record) => {
    Object.entries(record?.forms || {}).forEach(([formName, entries]) => {
      if (formKey && normalizeLocalKey(formName) === formKey) {
        processRecord({ entries });
      } else {
        Object.values(entries || {}).forEach((text) => otherFormTexts.add(normalizeSearchText(text)));
      }
    });
  });

  const inferPartner = (info) => ({ ...info, inferred: true });
  fillCollapsedPartners(baseTextMap, inferPartner);
  fillCollapsedPartners(formTextMap, inferPartner);
  const merged = new Map(baseTextMap);
  formTextMap.forEach((info, version) => {
    const base = merged.get(version);
    if (!info.inferred || !base || base.inferred) merged.set(version, info);
  });
  // Text this Pokémon shares with another form is its own too
  merged.forEach((info) => otherFormTexts.delete(normalizeSearchText(info.text)));

  return {
    entries: Array.from(merged.entries()).map(([version, info]) => ({
      version,
      text: info.text,
      language: info.language || "en",
      inferred: Boolean(info.inferred),
    })),
    otherFormTexts,
  };
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
          displayName: formatDisplayName(formName),
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
  
  const formName = currentForm?.displayName || formatDisplayName(pokemonName);
  const displayTitle = isAlternateForm ? `How ${formName} evolves` : "Evolution method";

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
          <Icon name="close" />
        </button>
        <div className="game-modal-header">
          <h2 className="game-modal-title">
            {displayTitle}
          </h2>
          <p className="game-modal-subtitle">
            Everything this evolution needs
          </p>
        </div>
        <div className="game-modal-body" style={{ gridTemplateColumns: "1fr" }}>
          <div className="game-modal-column game-modal-column-left" style={{ overflowY: "auto" }}>
            {evolutionRequirements.length > 0 ? (
              <ul className="game-modal-game-options">
                {evolutionRequirements.map((req, idx) => (
                  <li key={idx}>
                    <div className="game-modal-method evo-req">
                      {req.icon && <img className="evo-req__icon" src={req.icon} alt="" width={32} height={32} />}
                      <div className="evo-req__text">
                        <div className="evo-req__label">{req.label}</div>
                        <div className="evo-req__value">{req.value}</div>
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

function App() {
  const [pokemon, setPokemon] = useState([]);
  const [pokemonLoadError, setPokemonLoadError] = useState(null);
  // ?search= pre-fills the search box (used by the site's search-engine SearchAction)
  const [query, setQuery] = useState(() => {
    try {
      return new URL(window.location.href).searchParams.get("search") || "";
    } catch {
      return "";
    }
  });
  const [selected, setSelected] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState(() => new Set());
  const [selectedTags, setSelectedTags] = useState(() => new Set());
  // The chosen game is remembered: players come back mid-playthrough
  const [selectedGame, setSelectedGame] = useState(readGamePreference);
  const [selectedDex, setSelectedDex] = useState(() => {
    const game = readGamePreference();
    return (game && GAME_LOOKUP.get(game)?.dexKey) || "national";
  });
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
  const [dexIndexes, setDexIndexes] = useState(() => new Map());
  const [gameIndexes, setGameIndexes] = useState(() => new Map());
  const specialTagCacheRef = useRef(new Map());
  const pokedexCacheRef = useRef(new Map());
  const pokedexPromiseRef = useRef(new Map());
  const lastSelectedIdRef = useRef(null);
  const lastSelectedFlashTimerRef = useRef(null);
  const listScrollRef = useRef(null);
  const pendingCenterIdRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
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

  // Track scroll position of window and list container to toggle the scroll-to-top button
  useEffect(() => {
    const updateVisibility = () => {
      const winY = typeof window !== "undefined" ? window.scrollY || document.documentElement.scrollTop || 0 : 0;
      setShowScrollTop((prev) => {
        // Keep previous value if unchanged to avoid extra renders
        const next = winY > 600;
        return prev === next ? prev : next;
      });
    };
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  // Also watch the list panel's own scroll (it can scroll independently of window)
  {
    const scrollEl = listScrollRef.current;
    useEffect(() => {
      if (!scrollEl) return;
      const onListScroll = () => {
        const top = scrollEl.scrollTop || 0;
        setShowScrollTop((prev) => {
          const next = top > 600 || (typeof window !== "undefined" ? (window.scrollY || 0) > 600 : false);
          return prev === next ? prev : next;
        });
      };
      onListScroll();
      scrollEl.addEventListener("scroll", onListScroll, { passive: true });
      return () => scrollEl.removeEventListener("scroll", onListScroll);
    }, [scrollEl]);
  }

  const handleScrollToTop = useCallback(() => {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
    const el = listScrollRef.current;
    if (el) {
      try {
        el.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        el.scrollTop = 0;
      }
    }
  }, []);

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
      const idStr = getEntryDisplayId(entry);
      const idNum = Number(idStr);
      if (!idStr || Number.isNaN(idNum)) continue;
      map.set(idNum, String(entry?.name || "").toLowerCase());
    }
    return map;
  }, [pokemon]);

  const speciesSlugLookup = useMemo(() => {
    const map = new Map();
    Object.entries(NATIONAL_ID_TO_SLUG || {}).forEach(([id, slug]) => {
      if (!slug) return;
      const key = String(slug).toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, Number(id));
      }
    });
    return map;
  }, []);

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
      return pokemon.find((entry) => getEntryDisplayId(entry) === idStr) || null;
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
      if (speciesSlugLookup.has(lower)) {
        return speciesSlugLookup.get(lower);
      }
      const parts = lower.split("-");
      while (parts.length > 1) {
        parts.pop();
        const candidate = parts.join("-");
        if (speciesIdLookup.has(candidate)) {
          return speciesIdLookup.get(candidate);
        }
        if (speciesSlugLookup.has(candidate)) {
          return speciesSlugLookup.get(candidate);
        }
      }
      return fallback;
    },
    [speciesIdLookup, speciesSlugLookup]
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

  const getCanonicalRegionFromName = useCallback(
    (name) => {
      const lower = String(name || "").toLowerCase();
      if (!lower) return null;
      const tokens = lower.split("-");
      for (const token of tokens) {
        const canon = REGION_CANON_MAP.get(token);
        if (canon) return canon;
      }
      return null;
    },
    [REGION_CANON_MAP]
  );

  const activeRegionKey = useMemo(() => {
    if (selectedDex && selectedDex !== "national") return selectedDex;
    if (selectedGame) {
      const gameCfg = GAME_LOOKUP.get(selectedGame);
      return gameCfg?.dexKey || null;
    }
    return null;
  }, [selectedDex, selectedGame]);

  const selectedGameGeneration = useMemo(() => {
    if (!selectedGame) return null;
    return GAME_GENERATION_LOOKUP.get(selectedGame) ?? null;
  }, [selectedGame]);

  const selectedDexGeneration = useMemo(() => {
    if (!selectedDex || selectedDex === "national") return null;
    return DEX_GENERATION_LOOKUP.get(selectedDex) ?? null;
  }, [selectedDex]);

  const activeGenerationCap = useMemo(() => {
    if (selectedGameGeneration != null) return selectedGameGeneration;
    if (selectedDexGeneration != null) return selectedDexGeneration;
    return null;
  }, [selectedGameGeneration, selectedDexGeneration]);

  const getFormGeneration = useCallback(
    (name) => {
      const canonRegion = getCanonicalRegionFromName(name);
      if (!canonRegion) return null;
      const gen = REGION_GENERATION_LOOKUP.get(canonRegion);
      return gen != null ? gen : null;
    },
    [getCanonicalRegionFromName]
  );

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
      // Track regional variants (Pikachu's region caps aren't regional forms)
      const tokens = isCapFormName(lowerName) ? [] : lowerName.split("-");
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
    // Only swap a species' base form for the region's form. Other forms stay themselves
    // (Alolan Meowth in the Galar dex must not turn into Galarian Meowth).
    if (bucket.get("default")?.name !== entry.name) return entry;
    const regional = bucket.get(activeRegionKey);
    return regional || entry;
  }, [activeRegionKey, regionFormsBySpecies, resolveSpeciesId]);

  useEffect(() => {
    let cancelled = false;
    // Served from the static snapshot (and cached for the session), so returning to the
    // Pokédex from another page doesn't refetch anything.
    loadPokemonList()
      .then((list) => {
        if (cancelled) return;
        // Filter out any Totem forms from the root list
        const merged = list.filter((entry) => !String(entry?.name || "").toLowerCase().includes("totem"));
        // Append custom extras if not already present
        const names = new Set(merged.map((e) => String(e?.name || "").toLowerCase()));
        EXTRA_POKEMON.forEach((extra) => {
          if (extra?.name && extra?.url && !names.has(extra.name.toLowerCase())) {
            merged.push({ ...extra });
          }
        });
        setPokemon(merged);
        setPokemonLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load Pokémon list", error);
        setPokemonLoadError("Couldn't load the Pokédex. Check your connection and refresh.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Per-name type info for cards and type filtering (types change between generations,
  // e.g. Clefairy was Normal before Gen 6 and Magnemite was pure Electric in Gen 1).
  const typeRecordByName = useMemo(() => {
    const map = new Map();
    for (const entry of pokemon) {
      if (entry?.name && Array.isArray(entry.types)) {
        map.set(entry.name, entry);
      }
    }
    return map;
  }, [pokemon]);

  const getEntryTypes = useCallback(
    (name) => {
      const record = typeRecordByName.get(name);
      if (!record) return null;
      return getTypesForGeneration(record.types, record.pastTypes, activeGenerationCap);
    },
    [typeRecordByName, activeGenerationCap]
  );

  // type -> Set of Pokémon names with that type in the active generation
  const typeIndex = useMemo(() => {
    const index = new Map(ALL_TYPES.map((t) => [t, new Set()]));
    for (const [name, record] of typeRecordByName) {
      for (const t of getTypesForGeneration(record.types, record.pastTypes, activeGenerationCap)) {
        if (!index.has(t)) index.set(t, new Set());
        index.get(t).add(name);
      }
    }
    return index;
  }, [typeRecordByName, activeGenerationCap]);

  // Types that exist in the active generation (no Dark/Steel before Gen 2, no Fairy before Gen 6)
  const [typeChart, setTypeChart] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadTypeChart()
      .then((chart) => {
        if (!cancelled) setTypeChart(chart);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const availableTypes = useMemo(() => {
    const range = getTypeChartForGeneration(typeChart, activeGenerationCap);
    if (!range) return ALL_TYPES;
    const present = new Set(range.types);
    return ALL_TYPES.filter((t) => present.has(t));
  }, [typeChart, activeGenerationCap]);

  // Drop type filters that don't exist in the newly selected generation
  useEffect(() => {
    setSelectedTypes((prev) => {
      if (prev.size === 0) return prev;
      const allowed = new Set(availableTypes);
      const next = new Set([...prev].filter((t) => allowed.has(t)));
      return next.size === prev.size ? prev : next;
    });
  }, [availableTypes]);

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
          const dexMaps = await loadPokedexMaps();
          // Games with several Pokédexes (X/Y's Central/Coastal/Mountain Kalos, Sword/Shield's
          // DLC areas, Scarlet/Violet's Kitakami & Blueberry) number each list separately in-game,
          // so every species keeps the number from the first list it appears in.
          const finalMap = new Map();
          const order = new Map();
          for (const apiName of names) {
            const dexMap = dexMaps[apiName];
            if (!dexMap) {
              throw new Error(`Unknown Pokédex "${apiName}" (re-run scripts/build-data-snapshot.mjs)`);
            }
            const sortedEntries = Array.from(dexMap.entries()).sort((a, b) => a[1] - b[1]);
            for (const [speciesId, number] of sortedEntries) {
              if (finalMap.has(speciesId)) continue;
              finalMap.set(speciesId, number);
              order.set(speciesId, order.size + 1);
            }
          }
          // Sorting uses list order (list 1 first, then list 2, ...), display uses `finalMap`.
          Object.defineProperty(finalMap, "order", { value: order });
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
      const displayId = getEntryDisplayId(entry) || getIdFromUrl(entry.url);
      const dataUrl = getEntryDataUrl(entry) || entry.url;
      const name = entry.name || `pokemon-${displayId}`;
      setSelected({ id: displayId, name, url: dataUrl });
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
          const displayId = getEntryDisplayId(match) || getIdFromUrl(match.url);
          const dataUrl = getEntryDataUrl(match) || match.url;
          const name = match.name || `pokemon-${displayId}`;
          if (normalizePokemonSlug(slug) !== normalizePokemonSlug(name)) {
            updatePokemonLocation(name, { replace: true, pruneKeys: ["i", "m", "a", "p"] });
            return;
          }
          setSelected({ id: displayId, name, url: dataUrl });
          return;
        }
      }

      const u = new URL(window.location.href);
      const legacy = u.searchParams.get("p");
      if (legacy) {
        const match = findPokemonByIdentifier(legacy);
        if (match) {
          const displayId = getEntryDisplayId(match) || getIdFromUrl(match.url);
          const dataUrl = getEntryDataUrl(match) || match.url;
          const name = match.name || `pokemon-${displayId}`;
          setSelected({ id: displayId, name, url: dataUrl });
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
      // Leaving the Pokédex for another page: keep the current view until the router swaps
      // pages (clearing the selection here would render the whole grid for one frame).
      if (resolveRouteKey() !== "pokemon") return;
      resolveSelectionFromLocation();
    };
    window.addEventListener("popstate", onPop);
    // In-app links (e.g. the "Pokémon" tab while a Pokémon is open) navigate via locationchange
    window.addEventListener("locationchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("locationchange", onPop);
    };
  }, [resolveSelectionFromLocation]);

  useEffect(() => {
    if (!pokemon.length) return;
    if (bootSelection) return;
    resolveSelectionFromLocation();
  }, [pokemon, bootSelection, resolveSelectionFromLocation]);

  const selectPokemon = useCallback((id, name, url, options) => {
    // Clear any persisted highlight from the previously selected card
    try {
      if (lastSelectedFlashTimerRef.current) {
        clearTimeout(lastSelectedFlashTimerRef.current);
        lastSelectedFlashTimerRef.current = null;
      }
      document.querySelectorAll(".mon.is-previous").forEach((el) => el.classList.remove("is-previous"));
    } catch {}
    // Remember which card was selected so we can restore/flash it after closing
    try { lastSelectedIdRef.current = String(id); } catch {}
    try { pendingCenterIdRef.current = String(id); } catch {}
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
    let prefId = parts[parts.length - 1] || id;
    if (opts.displayIdOverride) {
      prefId = opts.displayIdOverride;
    }
    const targetName = target.name || name || `pokemon-${prefId}`;
    updatePokemonLocation(targetName, { pruneKeys: ["i", "m", "a", "p"] });
    setSelected({
      id: prefId,
      name: targetName,
      url: target.url || url,
      syntheticForm: opts.syntheticForm || null,
    });
  }, [getRegionPreferredEntry, updatePokemonLocation, setSelectedDex, setSelectedGame]);

  const clearSelection = () => {
    updatePokemonLocation(null, { pruneKeys: ["i", "m", "a", "p"] });
    setSelected(null);
    // After closing, scroll back to the previously selected card in the grid and highlight it
    const targetId = lastSelectedIdRef.current ? String(lastSelectedIdRef.current) : null;
    if (!targetId) return;
    let attempts = 0;
    const tryRestore = () => {
      const node = document.querySelector(`.mon[data-id="${CSS.escape(targetId)}"]`);
      if (node) {
        try {
          node.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        } catch {
          // older browsers may not support options; fallback
          node.scrollIntoView(true);
        }
        node.classList.add("is-previous");
        if (lastSelectedFlashTimerRef.current) {
          clearTimeout(lastSelectedFlashTimerRef.current);
          lastSelectedFlashTimerRef.current = null;
        }
        return;
      }
      if (attempts < 12) {
        attempts += 1;
        requestAnimationFrame(tryRestore);
      }
    };
    requestAnimationFrame(tryRestore);
  };

  // Keep the open entry's row in view in the list beside it: centred when it's off screen
  // (direct links, ◀ ▶ stepping), left alone when it's already visible (a click in the list).
  // The list can render a few frames after the entry (the Pokédex data may still be loading).
  useLayoutEffect(() => {
    if (!selected) return undefined;
    const id = String(pendingCenterIdRef.current || selected.id);
    pendingCenterIdRef.current = null;
    let frame = 0;
    let attempts = 0;
    const place = () => {
      const container = listScrollRef.current;
      const node = container?.querySelector(`.mon[data-id="${CSS.escape(id)}"]`);
      if (!container || !node) {
        if (attempts++ < 60) frame = requestAnimationFrame(place);
        return;
      }
      const box = container.getBoundingClientRect();
      const row = node.getBoundingClientRect();
      if (row.top >= box.top && row.bottom <= box.bottom) return;
      container.scrollTop += row.top - box.top - Math.max(0, (box.height - row.height) / 2);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [selected]);

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

  // Per-Pokémon values the filters need, computed once per list instead of on every keystroke.
  const pokemonMeta = useMemo(() => {
    const list = [];
    for (const entry of pokemon) {
      const idStr = getIdFromUrl(entry?.url);
      if (!idStr) continue;
      const idNum = Number(idStr);
      if (Number.isNaN(idNum)) continue;
      const tags = getTagsForName(entry.name);
      const isMega = tags.includes("Mega");
      const isGmax = tags.includes("Gigantamax");
      list.push({
        entry,
        idStr,
        idNum,
        tags,
        isMega,
        isGmax,
        speciesId: resolveSpeciesId(entry.name, idNum < 10000 ? idNum : null),
        isRegional: isRegionalFormName(entry.name),
        regionCanon: isRegionalFormName(entry.name) ? getCanonicalRegionFromName(entry.name) : null,
        introAge: entry.introducedIn ? VERSION_GROUP_AGE.get(entry.introducedIn) ?? null : null,
        formGeneration: getFormGeneration(entry.name),
        searchKeys: [normalizeSearchText(entry.name), normalizeSearchText(formatDisplayName(entry.name))],
      });
    }
    return list;
  }, [pokemon, resolveSpeciesId, getFormGeneration, getCanonicalRegionFromName]);

  const pokemonMetaByName = useMemo(() => new Map(pokemonMeta.map((meta) => [meta.entry.name, meta])), [pokemonMeta]);

  // Keep typing responsive: the (large) list re-filters with a deferred copy of the query.
  const deferredQuery = useDeferredValue(query);

  const filteredLists = useMemo(() => {
    const loadingResult = { primary: [], megaGigantamax: [], primarySectionGroups: null, loading: true };
    const q = normalizeSearchText(deferredQuery);
    const qDigits = String(deferredQuery || "").replace(/[^0-9]/g, "");
    const hasTypeFilter = selectedTypes.size > 0;
    const requiredTags = Array.from(selectedTags);
    const hasTagFilter = requiredTags.length > 0;
    if (pokemonMeta.length === 0) {
      return loadingResult;
    }
    const dexData = selectedDex === "national" ? null : dexIndexes.get(selectedDex);
    if (selectedDex !== "national" && !dexData) {
      return loadingResult;
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
      return loadingResult;
    }
    const activeEntryMap =
      selectedDex === "national" ? nationalGameEntryMap : regionGameEntryMap ?? combinedMap;
    const activeSections =
      selectedDex === "national"
        ? nationalGameEntry?.sections ?? null
        : regionGameEntry?.sections ?? null;
    if (selectedDex !== "national" && !activeEntryMap) {
      return loadingResult;
    }

    let typeIntersection = null;
    if (hasTypeFilter) {
      const sets = [];
      for (const t of selectedTypes) {
        sets.push(typeIndex.get(t) || new Set());
      }
      sets.sort((a, b) => a.size - b.size);
      typeIntersection = new Set(sets[0]);
      for (let i = 1; i < sets.length; i++) {
        const next = sets[i];
        typeIntersection = new Set([...typeIntersection].filter((n) => next.has(n)));
        if (typeIntersection.size === 0) break;
      }
    }

    const matchesQuery = (meta) => {
      if (!q && !qDigits) return true;
      if (q && meta.searchKeys.some((key) => key.includes(q))) return true;
      if (qDigits) {
        const { idStr } = meta;
        return idStr.includes(qDigits) || idStr.padStart(3, "0").includes(qDigits) || idStr.padStart(4, "0").includes(qDigits);
      }
      return false;
    };
    const matchesTags = (tags) => {
      if (!hasTagFilter) return true;
      return requiredTags.every((tag) => tags.includes(tag));
    };
    const matchesType = (meta) => {
      if (!hasTypeFilter) return true;
      if (typeIntersection.has(meta.entry.name)) return true;
      // Fallback for custom extras that have no type data: use the base species' types.
      if (typeRecordByName.has(meta.entry.name)) return false;
      const baseNameForTypes = meta.speciesId != null ? pokemonIdLookup.get(meta.speciesId) : null;
      return Boolean(baseNameForTypes && typeIntersection.has(baseNameForTypes));
    };
    const withinGeneration = (meta) =>
      activeGenerationCap == null || meta.formGeneration == null || meta.formGeneration <= activeGenerationCap;

    // Hide forms a game didn't have yet (Mega Swampert in X/Y, Origin Dialga in BDSP, the
    // Legends: Z-A Megas in Sun/Moon) and regional forms the game doesn't include.
    const gameVersionGroups = selectedGame ? GAME_KEY_TO_VERSION_GROUPS.get(selectedGame) || [] : [];
    const gameMaxAge = gameVersionGroups.reduce((max, vg) => Math.max(max, VERSION_GROUP_AGE.get(vg) ?? -1), -1);
    const allowedRegions = selectedGame ? GAME_REGIONAL_FORMS.get(selectedGame) : undefined;
    const formAvailable = (meta) => {
      if (meta.idNum < 10000) return true;
      if (gameMaxAge >= 0 && meta.introAge != null && meta.introAge > gameMaxAge) return false;
      if (allowedRegions && meta.regionCanon && !allowedRegions.includes(meta.regionCanon)) return false;
      return true;
    };

    const regularMatches = [];
    const alternateFormMatches = [];
    const megaGmaxMatches = [];

    // Build the set of species to consider based on the active dex/game (or all species if none)
    const speciesIdsToConsider = activeEntryMap
      ? Array.from(activeEntryMap.keys())
      : Array.from(regionFormsBySpecies.keys());
    const speciesInScope = new Set(speciesIdsToConsider);

    // Primary list: one representative per species, preferring regional form when applicable
    for (const speciesId of speciesIdsToConsider) {
      const bucket = regionFormsBySpecies.get(speciesId);
      if (!bucket) continue;
      const representative = (activeRegionKey ? bucket.get(activeRegionKey) : null) || bucket.get("default") || null;
      if (!representative) continue;
      let meta = pokemonMetaByName.get(representative.name);
      if (meta && !formAvailable(meta)) {
        // e.g. the region's own form doesn't exist in this game; fall back to the base form
        meta = pokemonMetaByName.get(bucket.get("default")?.name);
      }
      if (!meta) continue;
      if (hasTypeFilter && !typeIntersection.has(meta.entry.name)) continue;
      if (!matchesTags(meta.tags)) continue;
      if (!matchesQuery(meta)) continue;
      regularMatches.push({ entry: meta.entry, idNum: meta.idNum, speciesId });
    }
    // A regional form shown as its species' main card (e.g. Galarian Ponyta in the Galar dex)
    // must not be listed again among the alternate forms.
    const representativeNames = new Set(regularMatches.map((match) => match.entry.name));

    const extraMegaSpecies = selectedGame ? EXTRA_MEGA_SPECIES_BY_GAME.get(selectedGame) || null : null;
    const gameFeatures = selectedGame
      ? GAME_FEATURES.get(selectedGame) || { mega: false, gmax: false }
      : selectedDex && selectedDex !== "national"
      ? REGION_FEATURES.get(selectedDex) || { mega: false, gmax: false }
      : null; // National dex without a game selected: allow both

    for (const meta of pokemonMeta) {
      const { speciesId, isMega, isGmax } = meta;
      if (!formAvailable(meta)) continue;
      if (isMega || isGmax) {
        // Tertiary list: Mega/Gigantamax forms that belong to included species
        // (or are explicitly allowed for the selected game)
        const inScope =
          speciesId != null && (speciesInScope.has(speciesId) || (extraMegaSpecies && extraMegaSpecies.includes(speciesId)));
        if (!inScope || !withinGeneration(meta)) continue;
        // Gate by selected game/region feature support
        if (gameFeatures && ((isMega && !gameFeatures.mega) || (isGmax && !gameFeatures.gmax))) continue;
        if (!matchesType(meta) || !matchesTags(meta.tags) || !matchesQuery(meta)) continue;
        megaGmaxMatches.push({ entry: meta.entry, idNum: meta.idNum, speciesId });
        continue;
      }
      // Secondary list: alternate forms (non-Mega, non-Gigantamax) of included species.
      // Alternate forms have id >= 10000 or are regional variants; base forms are in the primary list.
      if (speciesId != null && ALT_FORM_HIDE_FLAGS.has(speciesId)) continue;
      if (!(meta.idNum >= 10000 || meta.isRegional)) continue;
      if (representativeNames.has(meta.entry.name)) continue;
      if (speciesId == null || !speciesInScope.has(speciesId)) continue;
      if (!withinGeneration(meta)) continue;
      if (!matchesType(meta) || !matchesTags(meta.tags) || !matchesQuery(meta)) continue;
      alternateFormMatches.push({ entry: meta.entry, idNum: meta.idNum, speciesId });
    }

    const sortMatches = (matches) => {
      if (matches.length === 0) return;
      if (activeEntryMap) {
        const activeOrder = activeEntryMap.order || activeEntryMap;
        const combinedOrder = combinedMap?.order || combinedMap;
        matches.sort((a, b) => {
          const speciesA = a.speciesId ?? (a.idNum < 10000 ? a.idNum : null);
          const speciesB = b.speciesId ?? (b.idNum < 10000 ? b.idNum : null);
          const lookupA = speciesA ?? a.idNum;
          const lookupB = speciesB ?? b.idNum;
          const aEntry = activeOrder.get(lookupA);
          const bEntry = activeOrder.get(lookupB);
          if (aEntry != null && bEntry != null && aEntry !== bEntry) {
            return aEntry - bEntry;
          }
          if (aEntry != null && bEntry == null) return -1;
          if (aEntry == null && bEntry != null) return 1;
          const combinedA = combinedOrder?.get(lookupA);
          const combinedB = combinedOrder?.get(lookupB);
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

    // Merge alternate forms into the primary list
    regularMatches.push(...alternateFormMatches);
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
      loading: false,
    };
  }, [
    pokemonMeta,
    pokemonMetaByName,
    deferredQuery,
    selectedTypes,
    selectedTags,
    selectedDex,
    selectedGame,
    dexIndexes,
    gameIndexes,
    typeIndex,
    typeRecordByName,
    pokemonIdLookup,
    regionFormsBySpecies,
    activeRegionKey,
    activeGenerationCap,
  ]);

  const regularFiltered = filteredLists.primary;
  const megaGigantamaxFiltered = filteredLists.megaGigantamax;
  const sectionGroups = Array.isArray(filteredLists.primarySectionGroups) ? filteredLists.primarySectionGroups : null;

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

  const getDexNumberForEntry = useCallback(
    (name, idNum) => {
      if (!Number.isFinite(idNum)) return undefined;
      const speciesId = resolveSpeciesId(name, idNum < 10000 ? idNum : null);
      const lookupId = speciesId ?? idNum;
      if (!Number.isFinite(lookupId)) return undefined;
      return formatDexNumber(lookupId);
    },
    [resolveSpeciesId, formatDexNumber]
  );

  const selectedDexNumber = useMemo(() => {
    if (!selected) return null;
    const idNum = Number(selected.id);
    return getDexNumberForEntry(selected.name, idNum);
  }, [selected, getDexNumberForEntry]);

  // Browser tab title follows the open Pokémon (matches the static share pages' titles)
  useEffect(() => {
    document.title = selected?.name
      ? `${formatDisplayName(selected.name)} - Stats, Evolutions & Weaknesses | ${SITE_NAME}`
      : DEFAULT_TITLE;
  }, [selected?.name]);

  // Type indexes come from the static snapshot (see typeIndex above); no per-type API calls.

  const dexName =
    selectedDex === "national" ? "National Pokédex" : `${DEX_LOOKUP.get(selectedDex)?.label ?? ""} Pokédex`;

  // Special categories that exist in the chosen game (no Megas in Scarlet/Violet, no Paradox before Gen IX)
  const availableTags = useMemo(() => {
    const features = selectedGame ? GAME_FEATURES.get(selectedGame) : null;
    return SPECIAL_FILTERS.filter((tag) => {
      if (tag === "Mega") return !features || features.mega;
      if (tag === "Gigantamax") return !features || features.gmax;
      if (tag === "Ultra Beast") return activeGenerationCap == null || activeGenerationCap >= 7;
      if (tag === "Paradox") return activeGenerationCap == null || activeGenerationCap >= 9;
      return true;
    });
  }, [selectedGame, activeGenerationCap]);

  // Drop category filters the newly chosen game doesn't have
  useEffect(() => {
    setSelectedTags((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((tag) => availableTags.includes(tag)));
      return next.size === prev.size ? prev : next;
    });
  }, [availableTags]);

  // The cartridge: one game drives numbering, forms, types, sprites and locations everywhere
  const pickGame = useCallback((gameKey) => {
    const cfg = gameKey ? GAME_LOOKUP.get(gameKey) : null;
    if (cfg) {
      setSelectedDex(cfg.dexKey);
      setSelectedGame(cfg.key);
    } else {
      setSelectedDex("national");
      setSelectedGame(null);
    }
    writeGamePreference(cfg ? cfg.key : null);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedTypes(new Set());
    setSelectedTags(new Set());
  }, []);

  const renderCard = useCallback(
    (p, index, eagerCount) => {
      const pref = getRegionPreferredEntry(p);
      const parts = pref.url.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      const idNum = Number(id);
      const dexDisplay = Number.isNaN(idNum) ? undefined : getDexNumberForEntry(pref.name, idNum);
      return (
        <PokemonCard
          key={pref.name}
          id={id}
          name={pref.name}
          url={pref.url}
          types={getEntryTypes(pref.name)}
          onSelect={selectPokemon}
          selected={selected ? String(selected.id) === String(id) : false}
          dexNumber={dexDisplay}
          shiny={shiny}
          selectedGame={selectedGame}
          detailsCache={detailsCache}
          eagerLoad={index < eagerCount}
        />
      );
    },
    [getRegionPreferredEntry, getDexNumberForEntry, getEntryTypes, selectPokemon, selected, shiny, selectedGame]
  );

  // The Pokédex as headed sections: the game's own dex lists (Paldea, Kitakami, Blueberry…),
  // then the Mega / Gigantamax forms the game has.
  const dexGroups = useMemo(() => {
    const groups = [];
    let other = null;
    if (sectionGroups && sectionGroups.length > 0) {
      sectionGroups.forEach((group, index) => {
        if (!group.entries?.length) return;
        if (group.key === "ungrouped") {
          other = { key: "other", label: "Other forms", entries: group.entries };
          return;
        }
        groups.push({ key: group.key || `section-${index}`, label: group.label || dexName, entries: group.entries });
      });
    } else if (regularFiltered.length > 0) {
      groups.push({ key: "main", label: dexName, entries: regularFiltered });
    }
    if (other) groups.push(other);
    if (megaGigantamaxFiltered.length > 0) {
      const hasMega = megaGigantamaxFiltered.some((entry) => /(^|-)mega(-|$)/.test(entry.name));
      const hasGmax = megaGigantamaxFiltered.some((entry) => /-gmax/.test(entry.name));
      const label = hasMega && hasGmax ? "Mega & Gigantamax forms" : hasGmax ? "Gigantamax forms" : "Mega Evolutions";
      groups.push({ key: "forms", label, entries: megaGigantamaxFiltered });
    }
    return groups;
  }, [sectionGroups, regularFiltered, megaGigantamaxFiltered, dexName]);

  // ◀ ▶ neighbours of the open entry, in the order this Pokédex lists them
  const neighbours = useMemo(() => {
    if (!selected) return { prev: null, next: null };
    const flat = dexGroups.flatMap((group) => group.entries).map((entry) => getRegionPreferredEntry(entry));
    const toStep = (entry) => {
      if (!entry?.url) return null;
      const parts = entry.url.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      return { id, name: entry.name, url: entry.url, dexNumber: getDexNumberForEntry(entry.name, Number(id)) };
    };
    let index = flat.findIndex((entry) => entry.name === selected.name);
    if (index < 0) {
      index = flat.findIndex((entry) => {
        const parts = String(entry.url || "").split("/").filter(Boolean);
        return parts[parts.length - 1] === String(selected.id);
      });
    }
    if (index < 0) return { prev: null, next: null };
    return { prev: toStep(flat[index - 1]), next: toStep(flat[index + 1]) };
  }, [selected, dexGroups, getRegionPreferredEntry, getDexNumberForEntry]);

  const stepTo = useCallback(
    (entry) => {
      if (!entry) return;
      pendingCenterIdRef.current = String(entry.id);
      selectPokemon(entry.id, entry.name, entry.url, { preferExact: true });
    },
    [selectPokemon]
  );

  const resultCount = dexGroups.reduce((sum, group) => sum + group.entries.length, 0);
  // Alternate, regional, Mega and Gigantamax forms have their own Pokémon ids (10000+)
  const formCount = dexGroups.reduce(
    (sum, group) =>
      sum +
      group.entries.filter((entry) => {
        const parts = String(entry?.url || "").split("/").filter(Boolean);
        return Number(parts[parts.length - 1]) >= 10000;
      }).length,
    0
  );
  const showSectionHeads = dexGroups.length > 1;
  const stripSections = showSectionHeads
    ? dexGroups.map((group) => ({ key: group.key, label: group.label.replace(/ Pokédex$/, ""), count: group.entries.length }))
    : null;
  const activeFilterCount = selectedTypes.size + selectedTags.size;
  const isLoadingDex = !pokemonLoadError && filteredLists.loading;

  const renderDex = (variant) => {
    if (pokemonLoadError) {
      return (
        <div className="empty" role="alert">
          <p className="empty__title">The Pokédex didn't load</p>
          <p>{pokemonLoadError}</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      );
    }
    if (isLoadingDex) {
      return (
        <>
          <p className="sr-only" role="status">
            Loading the {dexName}…
          </p>
          <ol className={variant === "rows" ? "dex-rows" : "dex-grid"} aria-hidden="true">
            {Array.from({ length: variant === "rows" ? 10 : 18 }, (_, index) => (
              <li key={index} className="mon-cell">
                <span className="mon mon--ghost">
                  <span className="mon__no skeleton" />
                  <span className="mon__sprite skeleton" />
                  <span className="mon__name skeleton" />
                </span>
              </li>
            ))}
          </ol>
        </>
      );
    }
    if (resultCount === 0) {
      return (
        <div className="empty" role="status">
          <p className="empty__title">No entries match</p>
          <p>
            {query.trim()
              ? `Nothing called “${query.trim()}” in the ${dexName}${activeFilterCount ? " with these filters" : ""}.`
              : `Nothing in the ${dexName} has that combination.`}
          </p>
          <div className="empty__actions">
            {activeFilterCount ? (
              <button type="button" className="btn" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
            {selectedGame && query.trim() ? (
              <button type="button" className="btn" onClick={() => pickGame(null)}>
                Search the National Pokédex
              </button>
            ) : null}
          </div>
        </div>
      );
    }
    return dexGroups.map((group, groupIndex) => (
      <section
        key={group.key}
        id={`dex-${group.key}`}
        className="dex-section"
        aria-labelledby={showSectionHeads ? `dex-${group.key}-head` : undefined}
        aria-label={showSectionHeads ? undefined : group.label}
      >
        {showSectionHeads ? (
          <h2 className="dex-section__head" id={`dex-${group.key}-head`}>
            <span className="dex-section__title">{group.label}</span>
          </h2>
        ) : null}
        <ol className={variant === "rows" ? "dex-rows" : "dex-grid"}>
          {group.entries.map((p, index) => renderCard(p, groupIndex === 0 ? index : Infinity, variant === "rows" ? 12 : 18))}
        </ol>
      </section>
    ));
  };

  return (
    <main className={`dex${selected ? " dex--open" : ""}`}>
      <DexStrip
        selectedGame={selectedGame}
        onPickGame={pickGame}
        query={query}
        setQuery={setQuery}
        availableTypes={availableTypes}
        selectedTypes={selectedTypes}
        setSelectedTypes={setSelectedTypes}
        availableTags={availableTags}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        generationCap={activeGenerationCap}
        resultCount={resultCount}
        formCount={formCount}
        loading={isLoadingDex}
        sections={stripSections}
      />
      {selected ? (
        <div className="dex__split">
          <nav className="dex__list" ref={listScrollRef} aria-label={dexName}>
            {renderDex("rows")}
          </nav>
          <div className="dex__entry">
            <ErrorBoundary
              fallback={
                <div className="empty" role="alert">
                  <p className="empty__title">This entry hit a snag</p>
                  <button type="button" className="btn" onClick={clearSelection}>
                    Back to the list
                  </button>
                </div>
              }
            >
              <DetailPanel
                selected={selected}
                onClose={clearSelection}
                onSelectPokemon={selectPokemon}
                onActivateType={(typename) => {
                  // Filter the Pokédex by this type and return to it
                  const t = String(typename || "").toLowerCase();
                  if (!t) return;
                  setSelectedTypes(new Set([t]));
                  clearSelection();
                }}
                dexNumber={selectedDexNumber}
                selectedDex={selectedDex}
                selectedGame={selectedGame}
                pokemonIdLookup={pokemonIdLookup}
                shiny={shiny}
                setShiny={setShiny}
                animated={animated}
                setAnimated={setAnimated}
                prevEntry={neighbours.prev}
                nextEntry={neighbours.next}
                onStep={stepTo}
                dexName={dexName}
              />
            </ErrorBoundary>
          </div>
        </div>
      ) : (
        <div className="dex__body">{renderDex("grid")}</div>
      )}
      {showScrollTop && !selected ? (
        <button type="button" className="btn btn--sm to-top" onClick={handleScrollToTop}>
          <Icon name="up" />
          Top
        </button>
      ) : null}
    </main>
  );
}

const DEBUG_DETAIL_PANEL = import.meta.env.DEV && false;

// Pages of an entry, like the device's INFO / AREA screens; the last one used is remembered
const ENTRY_TABS = [
  { key: "stats", label: "Stats" },
  { key: "matchups", label: "Matchups" },
  { key: "evolution", label: "Evolution" },
  { key: "area", label: "Area" },
  { key: "moves", label: "Moves" },
];
// Representative main-series version group per Smogon generation (for move stats)
const SMOGON_GENERATION_VERSION_GROUP = new Map([
  ["gen1", "yellow"],
  ["gen2", "crystal"],
  ["gen3", "emerald"],
  ["gen4", "platinum"],
  ["gen5", "black-2-white-2"],
  ["gen6", "omega-ruby-alpha-sapphire"],
  ["gen7", "ultra-sun-ultra-moon"],
  ["gen8", "sword-shield"],
  ["gen9", "scarlet-violet"],
]);
const detailsCache = new Map();
// Full /pokemon/{id} responses, kept for the session so reopening a Pokémon is instant.
const pokemonDetailsCache = new Map();
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
  animated = false,
  setAnimated,
  prevEntry = null,
  nextEntry = null,
  onStep,
  dexName = "",
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
  const [typeChart, setTypeChart] = useState(null);
  const [moveData, setMoveData] = useState(null);
  const [smogonNature, setSmogonNature] = useState(null);
  const [smogonError, setSmogonError] = useState(null);
  const [smogonLoading, setSmogonLoading] = useState(false);
  const [smogonEvs, setSmogonEvs] = useState(null);
  const [smogonItem, setSmogonItem] = useState(null);
  const [smogonMoves, setSmogonMoves] = useState(null);
  const [smogonGeneration, setSmogonGeneration] = useState(null); // e.g. "gen9"
  const [isEvModalOpen, setIsEvModalOpen] = useState(false);
  const [activeItemName, setActiveItemName] = useState(null);
  const [activeAbility, setActiveAbility] = useState(null);
  const [abilityData, setAbilityData] = useState(null);
  const [abilityLoading, setAbilityLoading] = useState(false);
  const [abilityError, setAbilityError] = useState(null);
  const [natureOverlayName, setNatureOverlayName] = useState(null);
  const [gameAvailability, setGameAvailability] = useState([]);
  const [gameAvailabilityLoading, setGameAvailabilityLoading] = useState(false);
  const [gameAvailabilityError, setGameAvailabilityError] = useState(null);
  const [selectedFlavorVersion, setSelectedFlavorVersion] = useState(null);
  const [isEvolutionDetailModalOpen, setIsEvolutionDetailModalOpen] = useState(false);
  const [evolutionDetailData, setEvolutionDetailData] = useState(null);
  const [currentPokemonForm, setCurrentPokemonForm] = useState(null);
  const [localFlavor, setLocalFlavor] = useState(EMPTY_LOCAL_FLAVOR);
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

      // The chosen game or nothing: don't present another game's locations as this one's
      return match || null;
    }

    return gameAvailability[gameAvailability.length - 1];
  }, [gameAvailability, selectedGame]);
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
      const cleaned = String(text || "")
        .replace(/­\s*/g, "") // PokeAPI marks hyphenated line breaks with soft hyphens
        .replace(/\s+/g, " ")
        // Some sources split thousands across a line break: "4, 600 feet" -> "4,600 feet"
        .replace(/(\d), (\d{3})\b/g, "$1,$2")
        .trim();
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
        // PokeAPI's species text is sometimes a form's entry (Hisuian Arcanine in Legends: Arceus)
        if (localFlavor.otherFormTexts.has(normalizeSearchText(entry?.flavor_text))) continue;
        pushEntry(entry?.version?.name, entry?.flavor_text, 1);
      }
    }

    if (Array.isArray(localFlavor.entries)) {
      for (const entry of localFlavor.entries) {
        const versionName = entry?.version;
        const lang = (entry?.language || "en").toLowerCase();
        if (lang && lang !== "en") continue;
        // Local text for the version itself wins (it's PokeAPI's text with modern casing);
        // text copied from a partner version only fills gaps PokeAPI doesn't cover.
        pushEntry(versionName, entry?.text, entry?.inferred ? 2 : 0);
      }
    }

    const result = Array.from(byVersion.values()).map(({ priority, index, ...rest }) => ({
      ...rest,
      priority,
      index,
    }));
    // Newest game first, regardless of which source the text came from
    result.sort((a, b) => {
      if (a.index !== b.index) return b.index - a.index;
      return a.displayName.localeCompare(b.displayName);
    });
    return result;
  }, [species?.flavor_text_entries, localFlavor]);
  
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
  
  const selectFlavorVersion = setSelectedFlavorVersion;

  useEffect(() => {
    setNatureOverlayName(null);
  }, [id]);
  useEffect(() => {
    if (!hasRecommendedEvs) {
      setIsEvModalOpen(false);
    }
  }, [hasRecommendedEvs]);

  useEffect(() => {
    setGameAvailability([]);
    setGameAvailabilityError(null);
    setGameAvailabilityLoading(Boolean(url));
  }, [url]);

  useEffect(() => {
    if (!smogonNature) {
      setNatureOverlayName(null);
    }
  }, [smogonNature]);
  // Debug trace for development only (it used to be stored in state, re-rendering the whole
  // panel on every step without ever being shown).
  const addLog = DEBUG_DETAIL_PANEL ? (msg, data) => console.debug(`[detail] ${msg}`, data ?? "") : () => {};

  useEffect(() => {
    let cancelled = false;
    loadTypeChart()
      .then((chart) => !cancelled && setTypeChart(chart))
      .catch(() => {});
    loadMoveData()
      .then((data) => !cancelled && setMoveData(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Types and matchups as they were in the selected game's generation (latest when none):
  // e.g. Clefairy is Normal before Gen 6 and Gen 1 uses its own type chart.
  const displayTypeNames = useMemo(
    () => getDetailTypesForGeneration(details, targetEvolutionGeneration),
    [details, targetEvolutionGeneration]
  );
  const { weaknesses, resistances, matchupsReady } = useMemo(() => {
    const range = getTypeChartForGeneration(typeChart, targetEvolutionGeneration);
    if (!range || displayTypeNames.length === 0) return { weaknesses: [], resistances: [], matchupsReady: false };
    return { ...computeDefensiveMatchups(range, displayTypeNames), matchupsReady: true };
  }, [typeChart, targetEvolutionGeneration, displayTypeNames]);
  const hasLearnsetContent = (learnset.levelUp?.length || 0) > 0 || (learnset.machine?.length || 0) > 0;
  const shouldShowLearnset = Boolean(details) && (
    hasLearnsetContent || (Array.isArray(details?.moves) && details.moves.length > 0)
  );

  const buildEvolutionTree = useCallback((evoPaths) => {
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
          displayName: node.displayName || formatDisplayName(node.name),
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
  }, [compareForms]);

  // Helper to check if evolution details suggest alternate form evolution
  const isAlternateFormEvolution = useCallback((evolutionDetails) => {
    if (!Array.isArray(evolutionDetails) || evolutionDetails.length === 0) return false;
    
    // Check evolution details for form-specific indicators
    for (const detail of evolutionDetails) {
      // Check for items that suggest alternate forms (e.g., Ice Stone for Alolan forms)
      const itemName = detail.item?.name?.toLowerCase() || "";
      if (itemName.includes("ice-stone") || itemName === "ice-stone") {
        // Ice Stone is typically used for Alolan forms (e.g., Alolan Vulpix)
        return true;
      }
      
      // Check location - some locations are form-specific
      const locationName = detail.location?.name?.toLowerCase() || "";
      if (locationName.includes("alola") || locationName.includes("galar") || 
          locationName.includes("hisui") || locationName.includes("paldea")) {
        return true;
      }
    }
    
    return false;
  }, []);

  // Helper to check if evolution details suggest standard form evolution
  const isStandardFormEvolution = useCallback((evolutionDetails) => {
    if (!Array.isArray(evolutionDetails) || evolutionDetails.length === 0) return true; // Default to standard
    
    for (const detail of evolutionDetails) {
      // Fire Stone is typically for standard forms (e.g., regular Vulpix)
      const itemName = detail.item?.name?.toLowerCase() || "";
      if (itemName.includes("fire-stone") || itemName === "fire-stone") {
        return true;
      }
      
      // If it has Ice Stone, it's likely for alternate forms
      if (itemName.includes("ice-stone") || itemName === "ice-stone") {
        return false;
      }
    }
    
    return true; // Default to standard if unclear
  }, []);

  // Build separate evolution paths for alternate forms by filtering based on evolution details
  const alternateFormsEvoPaths = useMemo(() => {
    if (!evolutionChainData || !Array.isArray(evoPaths) || evoPaths.length === 0) return evoPaths;
    
    // Filter evolution paths to only include those relevant to alternate forms
    return evoPaths.map(path => {
      const filteredPath = [];
      for (let i = 0; i < path.length; i++) {
        const node = path[i];
        const nextNode = i < path.length - 1 ? path[i + 1] : null;
        
        if (nextNode && nextNode.toNext) {
          const evolutionDetails = nextNode.toNext?.details ? [nextNode.toNext.details] : [];
          
          // Check if this evolution is for alternate forms
          const isAltFormEvo = isAlternateFormEvolution(evolutionDetails);
          
          // Include if it's an alternate form evolution
          if (isAltFormEvo) {
            if (filteredPath.length === 0 && i > 0) {
              // Include previous nodes to maintain path continuity
              for (let j = 0; j < i; j++) {
                filteredPath.push(path[j]);
              }
            }
            filteredPath.push(node);
            if (i === path.length - 2) {
              filteredPath.push(nextNode);
            }
          } else if (filteredPath.length > 0) {
            // If we've started a path but this evolution doesn't apply, stop here
            filteredPath.push(node);
            break;
          }
        } else if (filteredPath.length > 0 || i === 0) {
          // Last node - include if we have a path so far or it's the first node
          filteredPath.push(node);
        }
      }
      return filteredPath.length > 0 ? filteredPath : null;
    }).filter(Boolean);
  }, [evoPaths, evolutionChainData, isAlternateFormEvolution]);

  // Build separate evolution paths for standard forms by filtering out alternate form evolutions
  const standardFormsEvoPaths = useMemo(() => {
    if (!evolutionChainData || !Array.isArray(evoPaths) || evoPaths.length === 0) return evoPaths;
    
    // Filter evolution paths to exclude those for alternate forms
    return evoPaths.map(path => {
      const filteredPath = [];
      for (let i = 0; i < path.length; i++) {
        const node = path[i];
        const nextNode = i < path.length - 1 ? path[i + 1] : null;
        
        if (nextNode && nextNode.toNext) {
          const evolutionDetails = nextNode.toNext?.details ? [nextNode.toNext.details] : [];
          
          // Check if this evolution is for standard forms
          const isStandardEvo = isStandardFormEvolution(evolutionDetails);
          
          // Include if it's a standard form evolution
          if (isStandardEvo) {
            filteredPath.push(node);
            if (i === path.length - 2) {
              filteredPath.push(nextNode);
            }
          } else if (filteredPath.length > 0) {
            // If we've started a path but this evolution doesn't apply, stop here
            filteredPath.push(node);
            break;
          }
        } else {
          // Last node - include if we have a path so far or it's the first node
          if (filteredPath.length > 0 || i === 0) {
            filteredPath.push(node);
          }
        }
      }
      return filteredPath.length > 0 ? filteredPath : null;
    }).filter(Boolean);
  }, [evoPaths, isStandardFormEvolution]);

  const evolutionTree = useMemo(() => buildEvolutionTree(standardFormsEvoPaths), [standardFormsEvoPaths, buildEvolutionTree]);

  const hasStandaloneAlternateForms = useMemo(() => {
    if (!Array.isArray(evoPaths) || evoPaths.length === 0) return false;
    return evoPaths.some((path) =>
      path.some((node) => {
        const forms = Array.isArray(node.forms) ? node.forms : [];
        return forms.some((form) => {
          if (!form || form.isDefault) return false;
          const tags = Array.isArray(form.tags) ? form.tags : [];
          if (tags.includes("Mega") || tags.includes("Gigantamax")) return false;
          const speciesId = node.id != null ? Number(node.id) : null;
          if (speciesId != null && speciesId < 10000 && ALT_FORM_HIDE_FLAGS.has(speciesId)) return false;
          return true;
        });
      })
    );
  }, [evoPaths]);

  // Build a separate evolution tree that only shows alternate forms
  const alternateFormsEvolutionTree = useMemo(() => {
    const shouldBuildAltTree = alternateFormsEvoPaths.length > 0 || hasStandaloneAlternateForms;
    if (!shouldBuildAltTree) return [];
    
    const pathsToUse = alternateFormsEvoPaths.length > 0 ? alternateFormsEvoPaths : evoPaths;
    const baseTree = buildEvolutionTree(pathsToUse);
    if (!baseTree || baseTree.length === 0) return [];
    
    const buildAltFormTree = (entry) => {
      if (!entry) return null;
      
      // Get alternate forms for this entry (non-default, non-mega, non-gmax)
      const allForms = Array.isArray(entry.forms) ? entry.forms : [];
      const alternateForms = allForms.filter((form) => {
        if (!form || form.isDefault) return false;
        const isMega = Array.isArray(form?.tags) && form.tags.includes("Mega");
        const isGmax = Array.isArray(form?.tags) && form.tags.includes("Gigantamax");
        if (isMega || isGmax) return false;
        
        // Check ALT_FORM_HIDE_FLAGS - get species ID from the base entry
        const speciesId = entry.id != null && entry.id < 10000 ? entry.id : null;
        if (speciesId != null && ALT_FORM_HIDE_FLAGS.has(speciesId)) return false;
        
        return true;
      });
      
      // If no alternate forms, return null (don't include in tree)
      if (alternateForms.length === 0) return null;
      
      // Sort alternate forms and pick the first one as primary
      alternateForms.sort(compareForms);
      const primaryAltForm = alternateForms[0];
      
      // Build children recursively
      const children = Array.isArray(entry.children) ? entry.children : [];
      const altChildren = children
        .map((edge) => {
          const altChild = buildAltFormTree(edge.child);
          if (!altChild) return null;
          return { child: altChild, condition: edge.condition };
        })
        .filter(Boolean);
      
      // Only include this node if it has alternate forms OR has children with alternate forms
      if (alternateForms.length === 0 && altChildren.length === 0) return null;
      
      return {
        id: primaryAltForm.id,
        name: primaryAltForm.name,
        displayName: primaryAltForm.displayName || formatDisplayName(primaryAltForm.name),
        forms: alternateForms,
        children: altChildren,
        order: entry.order,
        baseEntry: entry, // Keep reference to original entry
      };
    };
    
    const result = baseTree
      .map((root) => buildAltFormTree(root))
      .filter(Boolean);
    
    return result;
  }, [alternateFormsEvoPaths, evoPaths, hasStandaloneAlternateForms, buildEvolutionTree, compareForms]);



  // Collect Mega and GMax forms separately from the evolution tree
  const megaForms = useMemo(() => {
    const seen = new Set();
    const results = [];
    const pushForm = (f) => {
      const fid = f?.id != null ? String(f.id) : null;
      if (!fid || f.isDefault) return;
      const isMega = Array.isArray(f?.tags) && f.tags.includes("Mega");
      if (!isMega) return;
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

  const gmaxForms = useMemo(() => {
    const seen = new Set();
    const results = [];
    const pushForm = (f) => {
      const fid = f?.id != null ? String(f.id) : null;
      if (!fid || f.isDefault) return;
      const isGmax = Array.isArray(f?.tags) && f.tags.includes("Gigantamax");
      if (!isGmax) return;
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
    const nodeName = node.displayName || formatDisplayName(node.name);
    if (!nodeId || !nodeName) return null;
    const isActive = isCurrent || nodeId === String(id);
    const classes = ["evo-tree-pokemon", isRoot ? "is-root" : "", isActive ? "is-current" : ""]
      .filter(Boolean)
      .join(" ");
    const size = isRoot ? 38 : 34;
    const inner = (
      <>
        <span className="evo-tree-icon">
          <SpriteImage
            id={node.id}
            alt={node.name}
            width={size}
            height={size}
            loading="lazy"
            shiny={shiny}
          />
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

  const renderEvolutionBranch = (entry, level = 0, incomingCondition = null, keyPrefix = "node", inheritedRegion = selectedEvolutionRegion, isAlternateTree = false) => {
    if (!entry) return null;
    const nodeKey = entry.id != null ? String(entry.id) : `${entry.name}-${level}`;
    // Filter forms based on which tree we're rendering
    const rawVariantForms = Array.isArray(entry.forms) ? entry.forms : [];
    const filteredVariantForms = isAlternateTree
      ? rawVariantForms.filter((form) => {
          // In alternate tree: only show alternate forms (non-default, non-mega, non-gmax)
          if (!form || form.isDefault) return false;
          const isMega = Array.isArray(form?.tags) && form.tags.includes("Mega");
          const isGmax = Array.isArray(form?.tags) && form.tags.includes("Gigantamax");
          if (isMega || isGmax) return false;
          return true;
        })
      : rawVariantForms.filter((form) => {
          // In standard tree: only show default and regional forms (exclude other alternate forms)
          if (!form) return false;
          const isMega = Array.isArray(form?.tags) && form.tags.includes("Mega");
          const isGmax = Array.isArray(form?.tags) && form.tags.includes("Gigantamax");
          if (isMega || isGmax) return false;
          // Show default forms and regional forms, but not other alternate forms
          if (form.isDefault) return true;
          const isRegional = Array.isArray(form?.tags) && form.tags.includes("Regional");
          return isRegional;
        });
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
    let promotedForm = null;
    let primaryDisplayNode = entry;
    let regionFromActive = null;
    
    if (isAlternateTree) {
      // In alternate forms tree: if current selection is an alternate form of this species, show default form
      
      // Check if current selection matches any alternate form in this entry
      const currentMatchesEntry = filteredVariantForms.some((form) => String(form?.id) === String(id));
      
      // If current selection matches an alternate form in this entry, show default form
      // We know they're the same species because currentMatchesEntry is true
      if (currentMatchesEntry && entry.baseEntry) {
        // Show default form when alternate form is selected
        primaryDisplayNode = {
          id: entry.baseEntry.id,
          name: entry.baseEntry.name,
          displayName: entry.baseEntry.displayName || formatDisplayName(entry.baseEntry.name),
        };
        promotedForm = null; // No promotion, using base entry
      } else {
        // Otherwise, show first alternate form as before
        const activeAltForm = filteredVariantForms.find((form) => String(form?.id) === String(id)) || null;
        promotedForm = activeAltForm || (filteredVariantForms.length > 0 ? filteredVariantForms[0] : null);
        primaryDisplayNode = promotedForm
          ? { id: promotedForm.id, name: promotedForm.name, displayName: promotedForm.displayName }
          : entry;
        regionFromActive = promotedForm ? getCanonRegion(promotedForm.name) : null;
      }
    } else {
      // Standard tree logic
      const activeAltForm = filteredVariantForms.find((form) => String(form?.id) === String(id)) || null;
      regionFromActive = activeAltForm ? getCanonRegion(activeAltForm.name) : null;
      const promotedByRegion = !activeAltForm && inheritedRegion
        ? filteredVariantForms.find((f) => getCanonRegion(f.name) === inheritedRegion) || null
        : null;
      promotedForm = activeAltForm || promotedByRegion;
      primaryDisplayNode = promotedForm
        ? { id: promotedForm.id, name: promotedForm.name, displayName: promotedForm.displayName }
        : entry;
    }
    
    const isCurrentNode = promotedForm
      ? String(promotedForm.id) === String(id)
      : (primaryDisplayNode.id != null && String(primaryDisplayNode.id) === String(id));
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


    return (
      <li key={`${keyPrefix}-${nodeKey}`} className="evo-tree-node">
        <div className="evo-tree-row" style={{ "--level": level }}>
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
              <Icon name="right" />
            </span>
          )}
          <div className="evo-tree-pokemon-group">
            {renderEvolutionPokemon(primaryDisplayNode, { isCurrent: isCurrentNode, isRoot: level === 0, clickOptions: primaryClickOptions })}
          </div>
        </div>
        {children.length > 0 && (
          <ul className="evo-tree-children">
            {children.map((edge, idx) =>
              renderEvolutionBranch(edge.child, level + 1, edge.condition, `${nodeKey}-${idx}`, nextPreferredRegion, isAlternateTree)
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
    setLearnset({ levelUp: [], machine: [] });
    setLearnsetMeta({
      versionGroup: null,
      versionGroupLabel: null,
      hasMixedSources: false,
      levelCount: 0,
      machineCount: 0,
    });
    const cachedDetails = pokemonDetailsCache.get(url);
    if (cachedDetails) {
      setDetails(cachedDetails);
      return;
    }
    // Don't keep showing the previous Pokémon's stats under the new name while loading.
    setDetails(null);
    addLog('Fetching details', { url });
    queuedFetch(url)
      .then((r) => r.json())
      .then((data) => {
        pokemonDetailsCache.set(url, data);
        // Responses can be several hundred KB each; keep only the most recent few.
        if (pokemonDetailsCache.size > 24) {
          pokemonDetailsCache.delete(pokemonDetailsCache.keys().next().value);
        }
        if (ignore) return;
        addLog('Details loaded', { id: data?.id, name: data?.name });
        setDetails(data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [url]);

  // After details are loaded, fetch species, evolution chain and encounters
  // (weaknesses are derived locally from the type chart, see `weaknesses` above)
  useEffect(() => {
    if (!details) return;
    let ignore = false;

    setGameAvailability([]);
    setGameAvailabilityLoading(true);
    setGameAvailabilityError(null);



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
        const local = Array.isArray(localNormalized) ? localNormalized : [];
        // The local data has gaps (no Gold / HeartGold rows at all, few Silver / SoulSilver rows).
        // Fill versions it doesn't cover from PokeAPI's encounter data, which is exact for
        // Gen 1-4 and part of Gen 5-6. Rows copied from a partner version rank below it.
        let apiEntries = [];
        const encountersUrl = details?.location_area_encounters;
        if (encountersUrl) {
          try {
            const response = await queuedFetch(encountersUrl);
            // Skip versions the site doesn't cover (Japan-only Red/Green/Blue, Colosseum, ...)
            if (response?.ok) {
              apiEntries = normalizeEncounterData(await response.json()).filter((entry) =>
                VERSION_ORDER_LOOKUP.has(entry.version)
              );
            }
          } catch {
            apiEntries = [];
          }
        }
        if (ignore) return;
        const exactLocalVersions = new Set(local.filter((entry) => !entry.__inferred).map((entry) => entry.version));
        const apiVersions = new Set(apiEntries.map((entry) => entry.version));
        const merged = [
          ...local.filter((entry) => !entry.__inferred || !apiVersions.has(entry.version)),
          ...apiEntries.filter((entry) => !exactLocalVersions.has(entry.version)),
        ]
          .filter((entry, index, list) => list.findIndex((other) => other.version === entry.version) === index)
          .sort(compareVersionEntries);
        setGameAvailability(merged);
        setGameAvailabilityError(null);
        setGameAvailabilityLoading(false);
        addLog('Encounters loaded', { local: local.length, api: apiEntries.length, games: merged.length });
      } catch (error) {
        if (ignore) return;
        addLog('Encounter load failed (local)', { message: error?.message || String(error) });
        setGameAvailability([]);
        setGameAvailabilityError("Unable to load encounter data.");
        setGameAvailabilityLoading(false);
      }
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
        // Inject custom extra forms (e.g., zygarde-mega) for relevant species
        EXTRA_FORMS_BY_SPECIES.forEach((extras, sidNum) => {
          const key = String(sidNum);
          const existing = formsBySpeciesId.get(key) || [];
          const existingIds = new Set(existing.map((f) => (f?.id != null ? String(f.id) : null)).filter(Boolean));
          const existingNames = new Set(existing.map((f) => String(f?.name || "").toLowerCase()).filter(Boolean));
          const mergedForms = existing.slice();
          (Array.isArray(extras) ? extras : []).forEach((f) => {
            const fid = f?.id != null ? String(f.id) : null;
            // PokeAPI now lists some of these itself (e.g. zygarde-mega); don't add a duplicate.
            if (!fid || existingIds.has(fid) || existingNames.has(String(f?.name || "").toLowerCase())) return;
            mergedForms.push({
              id: f.id,
              name: f.name,
              displayName: f.displayName || formatDisplayName(f.name),
              isDefault: !!f.isDefault,
              tags: Array.isArray(f.tags) ? f.tags.slice() : [],
              isCurrent: !!f.isCurrent,
              baseSpeciesId: key,
            });
          });
          if (mergedForms.length !== existing.length) {
            mergedForms.sort(compareForms);
            formsBySpeciesId.set(key, mergedForms);
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

    // With a game (or region) selected, show only what the Pokémon learns there when PokeAPI has
    // that game's learnset, instead of mixing in moves it can only learn in other games.
    const scopedGroups = new Set(
      (selectedGame
        ? GAME_KEY_TO_VERSION_GROUPS.get(selectedGame)
        : selectedDex && selectedDex !== "national"
        ? DEX_KEY_TO_VERSION_GROUPS.get(selectedDex)
        : null) || []
    );
    const hasScopedData =
      scopedGroups.size > 0 &&
      moves.some((entry) =>
        (entry?.version_group_details || []).some((info) => scopedGroups.has(normalizeGroup(info?.version_group?.name)))
      );

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
        if (hasScopedData && !scopedGroups.has(versionGroupName)) continue;
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
        label: formatMoveName(item.move),
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
        label: formatMoveName(item.move),
        versionGroup: item.versionGroup,
      }));

    const primaryVersionGroup = (() => {
      const preferred = preference.find((group) => usedGroups.has(group));
      if (preferred) return preferred;
      const iterator = usedGroups.keys();
      const next = iterator.next();
      return next.done ? null : next.value;
    })();

    // Separate TM and HM moves (HMs are per game; Gen 7+ has none)
    const isHmMove = (move) => HM_MOVES_BY_VERSION_GROUP.get(move.versionGroup)?.has(move.name) ?? false;
    const hmMoves = machineList.filter(isHmMove);
    const tmMoves = machineList.filter((move) => !isHmMove(move));

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

  // Move details for the learnset, from the static move snapshot (previously one PokeAPI request
  // per move, ~250 for a typical Pokémon). Values are those of the version group each move was
  // listed under, so e.g. Bite shows as Normal-type in Red/Blue and Thunderbolt as 95 power in Gen 1-5.
  const moveDetailsMap = useMemo(() => {
    const map = new Map();
    if (!moveData || !shouldShowLearnset) return map;
    const add = (moveName, versionGroup) => {
      if (!moveName || map.has(moveName)) return;
      const detailsForMove = getMoveForVersionGroup(moveData, moveName, versionGroup);
      if (detailsForMove) map.set(moveName, detailsForMove);
    };
    (learnset.levelUp || []).forEach((move) => add(move.name, move.versionGroup));
    (learnset.machine || []).forEach((move) => add(move.name, move.versionGroup));
    // Recommended moves come from a Smogon set of a specific generation: show that generation's values
    const smogonVersionGroup = SMOGON_GENERATION_VERSION_GROUP.get(smogonGeneration) || null;
    (Array.isArray(smogonMoves) ? smogonMoves : []).forEach((move) => add(normalizeSpeciesName(move), smogonVersionGroup));
    return map;
  }, [moveData, shouldShowLearnset, learnset, smogonMoves, smogonGeneration]);



  // Load local pokedex entries (flavor text) for SV/ZA and prefer them when present
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const sid = species?.id;
      if (sid == null) {
        setLocalFlavor(EMPTY_LOCAL_FLAVOR);
        return;
      }
      try {
        const result = await loadLocalPokedexEntriesForSpecies(
          details?.name,
          species?.name,
          pokemonIdMap.get(Number(details?.id)),
          details?.name
        );
        if (!cancelled) setLocalFlavor(result);
      } catch {
        if (!cancelled) setLocalFlavor(EMPTY_LOCAL_FLAVOR);
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
  const handleItemClick = useCallback(() => {
    if (!smogonItem) return;
    setActiveItemName(smogonItem);
  }, [smogonItem]);
  const closeItemOverlay = useCallback(() => {
    setActiveItemName(null);
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
    const basePath = getBasePath();
    const local = (p) => `${basePath}${p.startsWith("/") ? p.slice(1) : p}`;
    const parseIdFromUrl = (url) => {
      if (typeof url !== "string") return null;
      const parts = url.split("/").filter(Boolean);
      const maybe = Number(parts[parts.length - 1]);
      if (Number.isFinite(maybe) && maybe >= 0 && maybe < 100000) {
        return maybe;
      }
      return null;
    };
    const toNumericId = (value) => {
      if (value == null) return null;
      if (typeof value === "number") {
        if (Number.isFinite(value) && value >= 0 && value < 100000) return value;
        return null;
      }
      const str = String(value).trim();
      if (!str) return null;
      const match = str.match(/\d+/);
      if (!match) return null;
      const num = Number(match[0]);
      if (!Number.isFinite(num) || num < 0 || num >= 100000) return null;
      return num;
    };
    const spriteId = (() => {
      const candidates = [
        id,
        details?.id,
        species?.id,
        details?.species?.id,
        parseIdFromUrl(details?.species?.url),
        parseIdFromUrl(species?.url),
      ];
      for (const candidate of candidates) {
        const numeric = toNumericId(candidate);
        if (numeric != null) {
          return String(numeric);
        }
      }
      return null;
    })();

    const effectiveSpriteId = spriteId ?? "0";
    const localHomeSources = (() => {
      if (!effectiveSpriteId) return [];
      const list = [];
      if (shiny) {
        list.push(local(`/sprites/pokemon/other/home/shiny/${effectiveSpriteId}.png`));
      }
      list.push(local(`/sprites/pokemon/other/home/${effectiveSpriteId}.png`));
      return list;
    })();

    if (!animated && !isFemaleActive) {
      localHomeSources.forEach(push);
    }

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
      if (effectiveSpriteId) {
        // Prefer animated Showdown GIFs with correct gender/shiny where available
        if (shiny && isFemaleActive) {
          push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/female/${effectiveSpriteId}.gif`);
          push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${effectiveSpriteId}-f.gif`);
        }
        if (shiny) {
          push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${effectiveSpriteId}.gif`);
        }
        if (isFemaleActive) {
          push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/female/${effectiveSpriteId}.gif`);
          push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${effectiveSpriteId}-f.gif`);
        }
        push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${effectiveSpriteId}.gif`);

        // PNG fallbacks for female/shiny combinations (if GIFs are not present)
        if (shiny && isFemaleActive) {
          push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/female/${effectiveSpriteId}.png`);
          push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${effectiveSpriteId}-f.png`);
        }
        if (shiny) {
          push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${effectiveSpriteId}.png`);
        }
        if (isFemaleActive) {
          push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/female/${effectiveSpriteId}.png`);
          push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${effectiveSpriteId}-f.png`);
        }
        push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${effectiveSpriteId}.png`);
      }
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
      localHomeSources.forEach(push);
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
    
    // Add unknown pokemon sprite as fallback after pixel
    // Try shiny unknown sprite first if shiny is enabled
    if (shiny && isFemaleActive) {
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/female/0.png`);
    }
    if (shiny) {
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/shiny/0.png`);
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/0.png`);
    }
    // Try animated/showdown unknown sprite if animated
    if (animated) {
      push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/0.png`);
    }
    // Try home variant unknown sprite
    push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/0.png`);
    // Regular unknown sprite fallback
    push(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`);
    
    return sources.length > 0 ? sources : [pixel];
  }, [details, species, id, shiny, animated, isFemaleActive, name]);

  const [detailArtIndex, setDetailArtIndex] = useState(0);

  useEffect(() => {
    setDetailArtIndex(0);
  }, [detailArtSources]);

  const detailImg = detailArtSources.length > 0 ? detailArtSources[Math.min(detailArtIndex, detailArtSources.length - 1)] : "";
  const isUnknownSprite = detailImg && detailImg.includes("/0.png");

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
    setSmogonItem(null);
    setSmogonMoves(null);
    setSmogonError(null);
    setSmogonLoading(false);
    setSmogonGeneration(null);
    if (!alias) return;
    let cancelled = false;
    // Sets for the selected game's generation (e.g. RBY sets when viewing Red/Blue/Yellow);
    // newest generation first otherwise.
    const generationHint = targetEvolutionGeneration ? `gen${targetEvolutionGeneration}` : null;

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
        setSmogonItem(result?.item || null);
        setSmogonMoves(result?.moves || null);
        setSmogonGeneration(result?.generation || null);
        if (hasNature || evs) {
          setSmogonError(null);
          addLog("Smogon recommendations", {
            nature: result?.nature || null,
            item: result?.item || null,
            evs,
            moves: result?.moves || null,
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
        setSmogonMoves(null);
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
  }, [name, targetEvolutionGeneration]);

  const displayName = formatDisplayName(name);
  const genus = useMemo(
    () => (species?.genera || []).find((entry) => entry?.language?.name === "en")?.genus || null,
    [species]
  );
  const inDex = Boolean(dexNumber) && dexNumber !== "-";
  const nationalNumber = species?.id ?? (Number(id) < 10000 ? Number(id) : null);
  const dexNoLabel = inDex
    ? String(dexNumber).replace(/^#/, "No.")
    : nationalNumber != null
    ? `No.${String(nationalNumber).padStart(4, "0")}`
    : "No.—";
  const heightLabel = details?.height != null ? `${(details.height / 10).toFixed(1)} m` : "–";
  const weightLabel = details?.weight != null ? `${(details.weight / 10).toFixed(1)} kg` : "–";
  const abilities = details?.abilities || [];
  const visibleAbilities = abilities.filter((a) => !a.is_hidden);
  const hiddenAbilities = abilities.filter((a) => a.is_hidden);
  const selectedGameLabel = selectedGame ? GAME_LOOKUP.get(selectedGame)?.label || null : null;
  const smogonGenLabel = smogonGeneration ? `Gen ${String(smogonGeneration).replace(/\D/g, "")}` : null;

  // Megas only where the game has them (none in Scarlet/Violet), Gigantamax only in Sword/Shield
  const gameFeatures = selectedGame ? GAME_FEATURES.get(selectedGame) : null;
  const battleForms = [
    ...(gameFeatures && !gameFeatures.mega ? [] : megaForms),
    ...(gameFeatures && !gameFeatures.gmax ? [] : gmaxForms),
  ];
  const doesNotEvolve = evolutionTree.length === 1 && !(evolutionTree[0]?.children?.length > 0);

  const recommendedMoves = useMemo(
    () =>
      (Array.isArray(smogonMoves) ? smogonMoves : []).map((moveName) => {
        const key = normalizeSpeciesName(moveName);
        const info = moveDetailsMap.get(key) || moveDetailsMap.get(moveName) || null;
        return { name: key || moveName, label: formatMoveName(key || moveName), type: info?.type || null };
      }),
    [smogonMoves, moveDetailsMap]
  );

  const [tab, setTab] = useState(() => {
    try {
      const saved = localStorage.getItem("pref:entryTab");
      return ENTRY_TABS.some((entry) => entry.key === saved) ? saved : "stats";
    } catch {
      return "stats";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("pref:entryTab", tab);
    } catch {}
  }, [tab]);

  // Each entry starts at its top
  useLayoutEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [id]);

  // ← → step through the Pokédex, Esc goes back to the list (unless a popup is open)
  useEffect(() => {
    const onKey = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
      if (document.querySelector(".game-modal-backdrop, .ability-modal-backdrop, .ev-modal-backdrop, .popsheet")) return;
      if (event.key === "ArrowLeft" && prevEntry) {
        event.preventDefault();
        onStep?.(prevEntry);
      } else if (event.key === "ArrowRight" && nextEntry) {
        event.preventDefault();
        onStep?.(nextEntry);
      } else if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevEntry, nextEntry, onStep, onClose]);

  const [barSlot, setBarSlot] = useState(null);
  useEffect(() => {
    setBarSlot(document.getElementById("devicebar-slot"));
  }, []);

  // Swipe sideways on a phone to step, like the device's ◀ ▶
  const touchRef = useRef(null);
  const onTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch || event.touches.length > 1) return;
    if (event.target instanceof Element && event.target.closest(".tabs, .moves-scroll, .evo-tree, select")) {
      touchRef.current = null;
      return;
    }
    touchRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  };
  const onTouchEnd = (event) => {
    const start = touchRef.current;
    touchRef.current = null;
    const touch = event.changedTouches?.[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45 || Date.now() - start.t > 700) return;
    if (dx < 0 && nextEntry) onStep?.(nextEntry);
    if (dx > 0 && prevEntry) onStep?.(prevEntry);
  };

  const onTabsKeyDown = (event) => {
    const keys = ENTRY_TABS.map((entry) => entry.key);
    const index = keys.indexOf(tab);
    let next = null;
    if (event.key === "ArrowRight") next = keys[(index + 1) % keys.length];
    if (event.key === "ArrowLeft") next = keys[(index - 1 + keys.length) % keys.length];
    if (event.key === "Home") next = keys[0];
    if (event.key === "End") next = keys[keys.length - 1];
    if (!next) return;
    event.preventDefault();
    setTab(next);
    document.getElementById(`entry-tab-${next}`)?.focus();
  };

  const renderAbility = (a) => (
    <button
      key={a.ability.name}
      type="button"
      className="linkbtn"
      onClick={() => handleAbilityClick(a)}
      aria-label={`${toTitleCase(a.ability.name)}: what this ability does`}
    >
      {toTitleCase(a.ability.name)}
    </button>
  );

  const renderStep = (entry, direction) => {
    const glyph = direction === "prev" ? "left" : "right";
    const word = direction === "prev" ? "Previous" : "Next";
    if (!entry) {
      return (
        <button type="button" className="btn btn--icon entry-step" disabled aria-label={`No ${word.toLowerCase()} entry`}>
          <Icon name={glyph} />
        </button>
      );
    }
    const label = formatDisplayName(entry.name);
    const number = entry.dexNumber && entry.dexNumber !== "-" ? String(entry.dexNumber).replace(/^#/, "No.") : null;
    return (
      <button
        type="button"
        className="btn btn--icon entry-step"
        onClick={() => onStep?.(entry)}
        aria-label={`${word}: ${label}`}
        title={`${word}: ${number ? `${number} ` : ""}${label} (${direction === "prev" ? "←" : "→"})`}
      >
        <Icon name={glyph} />
      </button>
    );
  };

  // On phones the way back to the list sits in the device bar, so the entry spends no row on it
  const backToList = barSlot
    ? createPortal(
        <button
          type="button"
          className="btn btn--quiet btn--icon devicebar__back"
          onClick={onClose}
          aria-label={`Back to the ${dexName || "Pokédex"}`}
        >
          <Icon name="left" className="icon--lg" />
        </button>,
        barSlot
      )
    : null;

  return (
    <article className="entry" aria-labelledby="entry-title" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {backToList}
      <div className="entry-top">
        <div className="entry-screen">
          <div className={`entry-screen__glass${animated ? " is-animated" : ""}`}>
            {detailImg ? (
              <img
                key={id}
                className={`entry-screen__art${isUnknownSprite ? " is-unknown" : ""}`}
                src={detailImg}
                alt={`${displayName}${shiny ? ", shiny colours" : ""}${hasGenderVariants ? (female ? ", female" : ", male") : ""}`}
                onError={handleDetailArtError}
              />
            ) : (
              <span className="entry-screen__ghost skeleton" aria-hidden="true" />
            )}
            {/* Sprite keys live on the screen itself, like the device's view toggles */}
            <div className="screen-keys" role="group" aria-label="Sprite view">
              <button
                type="button"
                className="screen-key"
                aria-pressed={shiny}
                aria-label="Shiny colours"
                title={shiny ? "Shiny colours: on" : "Shiny colours: off"}
                onClick={() => setShiny?.((value) => !value)}
              >
                <Icon name="sparkle" />
              </button>
              <button
                type="button"
                className="screen-key"
                aria-pressed={animated}
                aria-label="Animated sprite"
                title={animated ? "Animated sprite: on" : "Animated sprite: off"}
                onClick={() => setAnimated?.((value) => !value)}
              >
                <Icon name="play" />
              </button>
              {hasGenderVariants ? (
                <button
                  type="button"
                  className="screen-key"
                  aria-pressed={female}
                  aria-label="Female form"
                  title={female ? "Showing the female form" : "Showing the male form"}
                  onClick={() => setFemale((value) => !value)}
                >
                  <Icon name={female ? "female" : "male"} />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="entry-id">
          <div className="entry-id__top">
            <p className="entry-id__no">
              {dexNoLabel}
              {!inDex && selectedGame ? <span className="stamp stamp--red">Not in {dexName}</span> : null}
            </p>
            <nav className="entry-nav" aria-label="Step through the Pokédex">
              {renderStep(prevEntry, "prev")}
              {renderStep(nextEntry, "next")}
              <button
                type="button"
                className="btn btn--quiet btn--icon entry-nav__close"
                onClick={onClose}
                aria-label="Close entry (Esc)"
                title="Close (Esc)"
              >
                <Icon name="close" />
              </button>
            </nav>
          </div>
          <h1 className="entry-id__name" id="entry-title">
            {displayName}
          </h1>
          {genus ? <p className="entry-id__genus">{genus}</p> : <p className="entry-id__genus skeleton entry-id__genus--ghost" aria-hidden="true" />}
          <div className="entry-id__types">
            {displayTypeNames.map((typeName) => (
              <TypeTag
                key={typeName}
                as="button"
                type="button"
                size="lg"
                typeName={typeName}
                title={`Show every ${typeName} type in the ${dexName || "Pokédex"}`}
                onClick={() => onActivateType?.(typeName)}
              />
            ))}
          </div>
          {specialTags.length > 0 ? (
            <p className="entry-id__stamps">
              {specialTags.map((tag) => (
                <span key={tag} className={`stamp${tag === "Legendary" || tag === "Mythical" ? " stamp--gold" : ""}`}>
                  {tag}
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <dl className="kv entry-facts">
          <dt>Height</dt>
          <dd className="num">{heightLabel}</dd>
          <dt>Weight</dt>
          <dd className="num">{weightLabel}</dd>
          <dt>{visibleAbilities.length > 1 ? "Abilities" : "Ability"}</dt>
          <dd className="entry-facts__list">{visibleAbilities.length ? visibleAbilities.map(renderAbility) : "–"}</dd>
          {hiddenAbilities.length ? (
            <>
              <dt>Hidden</dt>
              <dd className="entry-facts__list">{hiddenAbilities.map(renderAbility)}</dd>
            </>
          ) : null}
        </dl>
      </div>

      {flavorTextVersions.length > 0 ? (
        <DexDialog versions={flavorTextVersions} selectedVersion={selectedFlavorVersion} onSelect={selectFlavorVersion} />
      ) : null}

      <div className="tabs entry-tabs" role="tablist" aria-label="Entry pages" onKeyDown={onTabsKeyDown}>
        {ENTRY_TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            id={`entry-tab-${entry.key}`}
            className="tab"
            aria-selected={tab === entry.key}
            aria-controls="entry-panel"
            tabIndex={tab === entry.key ? 0 : -1}
            onClick={() => setTab(entry.key)}
          >
            <Cursor />
            {entry.label}
          </button>
        ))}
      </div>

      <section className="entry-panel" id="entry-panel" role="tabpanel" aria-labelledby={`entry-tab-${tab}`} tabIndex={0}>
        {tab === "stats" ? (
          <div className="entry-stats">
            <StatMeters stats={details?.stats} evs={smogonEvs} evKeyFor={STAT_TO_EVS_KEY} onShowEvs={hasRecommendedEvs ? openEvInfoModal : null} />
            <section className="comp" aria-label="Competitive set">
              <h3 className="label">Competitive set{smogonGenLabel ? ` · ${smogonGenLabel}` : ""}</h3>
              {smogonLoading ? (
                <p className="entry-muted">Loading Smogon sets…</p>
              ) : smogonNature || smogonItem ? (
                <dl className="kv">
                  {smogonNature ? (
                    <>
                      <dt>Nature</dt>
                      <dd>
                        <button type="button" className="linkbtn" onClick={handleNatureClick}>
                          {toTitleCase(smogonNature)}
                        </button>
                      </dd>
                    </>
                  ) : null}
                  {smogonItem ? (
                    <>
                      <dt>Item</dt>
                      <dd>
                        <button type="button" className="linkbtn" onClick={handleItemClick}>
                          {toTitleCase(smogonItem)}
                        </button>
                      </dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <p className="entry-muted">{smogonError || "No competitive sets for this Pokémon."}</p>
              )}
            </section>
          </div>
        ) : null}

        {tab === "matchups" ? (
          <Matchups
            weaknesses={weaknesses}
            resistances={resistances}
            ready={matchupsReady}
            note={targetEvolutionGeneration ? `Using the Gen ${targetEvolutionGeneration} type chart and types for ${selectedGameLabel || dexName}.` : null}
          />
        ) : null}

        {tab === "evolution" ? (
          <div className="evo">
            {evolutionTree.length > 0 ? (
              <div className="evo-tree">
                <ul className="evo-tree-roots">
                  {evolutionTree.map((entry, idx) => renderEvolutionBranch(entry, 0, null, `root-${idx}`))}
                </ul>
              </div>
            ) : species ? (
              <p className="entry-muted">{displayName} does not evolve.</p>
            ) : (
              <p className="entry-muted">Loading the evolution line…</p>
            )}
            {doesNotEvolve ? <p className="entry-muted">{displayName} does not evolve.</p> : null}
            {alternateFormsEvolutionTree.length > 0 ? (
              <section className="evo-alt" aria-label="Other forms">
                <h3 className="label">Other forms</h3>
                <div className="evo-tree evo-tree-alt">
                  <ul className="evo-tree-roots">
                    {alternateFormsEvolutionTree.map((entry, idx) =>
                      renderEvolutionBranch(entry, 0, null, `alt-root-${idx}`, selectedEvolutionRegion, true)
                    )}
                  </ul>
                </div>
              </section>
            ) : null}
            {battleForms.length > 0 ? (
              <section className="evo-alt" aria-label="Battle forms">
                <h3 className="label">Mega Evolution &amp; Gigantamax</h3>
                <ul className="evo-forms">
                  {battleForms.map((form) => (
                    <li key={form.id}>
                      <button
                        type="button"
                        className={`evo-tree-pokemon${String(form.id) === String(id) ? " is-current" : ""}`}
                        aria-pressed={String(form.id) === String(id)}
                        onClick={() => onSelectPokemon?.(String(form.id), form.name, `https://pokeapi.co/api/v2/pokemon/${form.id}`)}
                      >
                        <span className="evo-tree-icon">
                          <SpriteImage id={form.id} alt="" width={48} height={48} loading="lazy" shiny={shiny} formName={form.name} />
                        </span>
                        <span className="evo-tree-name">{formatDisplayName(form.name)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        {tab === "area" ? (
          <AreaPanel
            games={gameAvailability}
            primary={latestCatchGame}
            selectedGameLabel={selectedGameLabel}
            loading={gameAvailabilityLoading}
            error={gameAvailabilityError}
            logoLookup={GAME_LOGO_LOOKUP}
          />
        ) : null}

        {tab === "moves" ? (
          shouldShowLearnset ? (
            <MovesPanel
              learnset={learnset}
              meta={learnsetMeta}
              moveDetailsMap={moveDetailsMap}
              stabTypes={displayTypeNames}
              recommended={recommendedMoves}
              recommendedLabel={smogonGenLabel ? `Competitive set · ${smogonGenLabel}` : "Competitive set"}
            />
          ) : details ? (
            <p className="entry-muted">No move data for this Pokémon.</p>
          ) : (
            <p className="entry-muted">Loading moves…</p>
          )
        ) : null}
      </section>

      {natureOverlayName && smogonNature && (
        <NatureOverlay natureName={natureOverlayName} recommendedNature={smogonNature} onClose={closeNatureOverlay} />
      )}
      {isEvModalOpen && hasRecommendedEvs && (
        <RecommendedEvModal evs={smogonEvs} stats={details?.stats || []} onClose={closeEvInfoModal} />
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
          shiny={shiny}
        />
      )}
      {activeItemName && (
        <ItemOverlay
          itemName={activeItemName}
          onClose={closeItemOverlay}
          pokemonAlias={name}
          generationHint={targetEvolutionGeneration ? `gen${targetEvolutionGeneration}` : null}
          onSelectItem={setActiveItemName}
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
    </article>
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
          // Power Items gave +4 in Gen 4-6 and +8 from Gen 7
          description: `+8 ${statLabel} EVs per battle while held (+4 in Gen 4–6; halves Speed in battle)`,
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
          <Icon name="close" />
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

function ItemOverlay({ itemName, onClose, pokemonAlias, generationHint }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [otherLoading, setOtherLoading] = useState(false);
  const [otherError, setOtherError] = useState(null);
  const [otherItems, setOtherItems] = useState([]);
  const [otherItemDetails, setOtherItemDetails] = useState([]);
  const [imgsIndex, setImgsIndex] = useState(null);

  const normalizedSlug = useMemo(() => {
    const raw = String(itemName || "").toLowerCase();
    return raw
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "");
  }, [itemName]);

  const titleId = normalizedSlug ? `item-modal-title-${normalizedSlug}` : undefined;

  useEffect(() => {
    if (!normalizedSlug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`https://pokeapi.co/api/v2/item/${normalizedSlug}/`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Failed to load item");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [normalizedSlug]);

  // Load Smogon image index (for Global Link artwork fallback)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const idx = await fetchSmogonImgsIndex();
        if (!cancelled) setImgsIndex(idx || null);
      } catch {
        if (!cancelled) setImgsIndex(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = useMemo(() => humanizeName(itemName || data?.name || ""), [itemName, data?.name]);
  const iconUrl = useMemo(() => {
    // 1) Prefer PokeAPI Scarlet/Violet or higher-quality artwork if present
    const sprites = data?.sprites || null;
    const other = sprites?.other || null;
    const fromOther = (() => {
      if (!other || typeof other !== "object") return null;
      const keys = ["scarlet-violet", "sv", "home", "showdown", "official-artwork"];
      for (const key of keys) {
        const entry = other[key];
        if (!entry) continue;
        if (typeof entry === "string" && entry) return entry;
        if (typeof entry === "object") {
          const candidate = entry.default || entry.front_default || entry.image || entry.png || null;
          if (candidate) return candidate;
        }
      }
      return null;
    })();
    if (fromOther) return fromOther;

    // 2) Fallback to Global Link artwork via Smogon imgs index
    const fromGl = (() => {
      if (!imgsIndex || !normalizedSlug) return null;
      const slug = normalizedSlug;
      const candidates = [
        imgsIndex?.items?.[slug],
        imgsIndex?.items_gl?.[slug],
        imgsIndex?.items?.gl?.[slug],
        imgsIndex?.gl?.items?.[slug],
        imgsIndex?.["global-link"]?.items?.[slug],
        imgsIndex?.["items-global-link"]?.[slug],
      ];
      for (const c of candidates) {
        if (!c) continue;
        if (typeof c === "string") return c;
        if (typeof c === "object") {
          const url = c.url || c.href || c.default || c.png || c.svg || null;
          if (url) return url;
        }
      }
      return null;
    })();
    if (fromGl) return fromGl;

    // 3) Default to existing PokeAPI sprite or GitHub fallback
    return sprites?.default || (normalizedSlug ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${normalizedSlug}.png` : null);
  }, [data?.sprites, normalizedSlug, imgsIndex]);
  const effect = useMemo(() => {
    const entries = Array.isArray(data?.effect_entries) ? data.effect_entries : [];
    const en = entries.find((e) => e?.language?.name === "en");
    return en?.short_effect || en?.effect || null;
  }, [data]);
  const flavor = useMemo(() => {
    const entries = Array.isArray(data?.flavor_text_entries) ? data.flavor_text_entries : [];
    const en = entries.find((e) => e?.language?.name === "en");
    return en?.text || null;
  }, [data]);

  const normalizeItemSlug = useCallback((raw) => {
    const v = String(raw || "").toLowerCase();
    return v
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "");
  }, []);

  // Build a best-effort extractor for item values from arbitrary Smogon set data
  const extractItemAny = useCallback((value) => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = extractItemAny(entry);
        if (found) return found;
      }
      return null;
    }
    if (typeof value === "object") {
      const nested = value.item || value.items || value.held_item || value.value;
      const candidate = extractItemAny(nested);
      if (candidate) return candidate;
      for (const key of Object.keys(value)) {
        if (key === "name") continue;
        const next = extractItemAny(value[key]);
        if (next) return next;
      }
    }
    return null;
  }, []);

  // Load other recommended items from Smogon builds for this Pokémon
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setOtherError(null);
      setOtherItems([]);
      if (!pokemonAlias) return;
      setOtherLoading(true);
      try {
        const rec = await findRecommendedNature(pokemonAlias, { generationHint });
        if (cancelled) return;
        const generation = rec?.generation || null;
        const speciesKey = rec?.speciesKey || null;
        if (!generation || !speciesKey) {
          setOtherItems([]);
          return;
        }
        const dataset = await fetchSmogonSets(generation);
        if (cancelled) return;
        const speciesSets = dataset?.[speciesKey] || {};
        const collected = new Set();
        Object.values(speciesSets).forEach((setsByName) => {
          if (!setsByName || typeof setsByName !== "object") return;
          Object.values(setsByName).forEach((set) => {
            const item = extractItemAny(set);
            if (!item) return;
            const normalized = String(item).trim().toLowerCase();
            if (normalized) collected.add(normalized);
          });
        });
        const primary = String(itemName || "").trim().toLowerCase();
        const list = Array.from(collected)
          .filter((i) => i && i !== primary)
          .slice(0, 20);
        setOtherItems(list);
      } catch (e) {
        if (!cancelled) setOtherError(e?.message || "Failed to load other recommendations");
      } finally {
        if (!cancelled) setOtherLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [pokemonAlias, generationHint, itemName, extractItemAny]);

  // Fetch details for other items to display definitions like the primary item
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setOtherItemDetails([]);
      if (!otherItems || otherItems.length === 0) return;
      const slugs = otherItems.map((it) => normalizeItemSlug(it)).filter(Boolean);
      try {
        const results = await Promise.all(
          slugs.map(async (slug) => {
            try {
              const r = await fetch(`https://pokeapi.co/api/v2/item/${slug}/`);
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              const json = await r.json();
              const enEff = Array.isArray(json?.effect_entries)
                ? json.effect_entries.find((e) => e?.language?.name === "en")
                : null;
              const enFlavor = Array.isArray(json?.flavor_text_entries)
                ? json.flavor_text_entries.find((e) => e?.language?.name === "en")
                : null;
              // Select preferred artwork (SV > GL > default)
              const sprites = json?.sprites || null;
              const other = sprites?.other || null;
              let art = null;
              if (other && typeof other === "object") {
                const keys = ["scarlet-violet", "sv", "home", "showdown", "official-artwork"];
                for (const key of keys) {
                  const entry = other[key];
                  if (!entry) continue;
                  if (typeof entry === "string" && entry) { art = entry; break; }
                  if (typeof entry === "object") {
                    const candidate = entry.default || entry.front_default || entry.image || entry.png || null;
                    if (candidate) { art = candidate; break; }
                  }
                }
              }
              if (!art && imgsIndex) {
                const candidates = [
                  imgsIndex?.items?.[slug],
                  imgsIndex?.items_gl?.[slug],
                  imgsIndex?.items?.gl?.[slug],
                  imgsIndex?.gl?.items?.[slug],
                  imgsIndex?.["global-link"]?.items?.[slug],
                  imgsIndex?.["items-global-link"]?.[slug],
                ];
                for (const c of candidates) {
                  if (!c) continue;
                  if (typeof c === "string") { art = c; break; }
                  if (typeof c === "object") {
                    const url = c.url || c.href || c.default || c.png || c.svg || null;
                    if (url) { art = url; break; }
                  }
                }
              }
              if (!art) {
                art = sprites?.default || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
              }
              return {
                slug,
                name: json?.name || slug,
                iconUrl: art,
                effect: enEff?.short_effect || enEff?.effect || null,
                flavor: enFlavor?.text || null,
              };
            } catch {
              return {
                slug,
                name: slug,
                iconUrl: (imgsIndex && (imgsIndex?.items?.[slug] || imgsIndex?.items_gl?.[slug])) || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`,
                effect: null,
                flavor: null,
              };
            }
          })
        );
        if (!cancelled) setOtherItemDetails(results);
      } catch {
        if (!cancelled) setOtherItemDetails([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [otherItems, normalizeItemSlug, imgsIndex]);

  const [isMouseDownOnBackdrop, setIsMouseDownOnBackdrop] = useState(false);
  const handleBackdropMouseDown = (event) => {
    // Only start close gesture if the original target is the backdrop itself
    if (event.target === event.currentTarget) {
      setIsMouseDownOnBackdrop(true);
    }
  };
  const handleModalMouseDown = (event) => {
    // Prevent backdrop from receiving the bubbled event
    event.stopPropagation();
    setIsMouseDownOnBackdrop(false);
  };
  const handleBackdropMouseUp = (event) => {
    // Only close if the mouse interaction ended on the backdrop and began there
    if (event.target === event.currentTarget && isMouseDownOnBackdrop) {
      onClose?.();
    }
    setIsMouseDownOnBackdrop(false);
  };
  const handleModalContextMenu = (event) => {
    // Ensure right-click inside the modal does not trigger backdrop handlers
    event.stopPropagation();
  };

  return (
    <div className="ability-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown} onMouseUp={handleBackdropMouseUp}>
      <div
        className="ability-modal item-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={handleModalMouseDown}
        onContextMenu={handleModalContextMenu}
      >
        <button type="button" className="ability-modal-close" onClick={onClose} aria-label="Close item details">
          <Icon name="close" />
        </button>
        <div className="ability-modal-left">
          <div className="ability-modal-header">
            <h2 className="ability-modal-title" id={titleId}>
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt=""
                  width={60}
                  height={60}
                  loading="lazy"
                  aria-hidden="true"
                  style={{ borderRadius: 6 }}
                />
              ) : null}
              <span className="text-capitalize">{displayName}</span>
            </h2>
            <div className="ability-modal-subtle">Held item details</div>
          </div>
          <div className="ability-modal-body">
            {loading ? (
              <div className="ability-modal-loading">Loading</div>
            ) : error ? (
              <div className="ability-modal-error">{error}</div>
            ) : (
              <div className="effect-summary">
                <span>{effect || flavor || "No description available."}</span>
              </div>
            )}

            {/* Other Smogon build items */}
            <div className="item-modal-other">
              <h3 className="ability-modal-subtitle" style={{ marginTop: 16 }}>Other recommended items from Smogon builds</h3>
              {otherLoading ? (
                <div className="ability-modal-loading">Loading recommendations…</div>
              ) : otherError ? (
                <div className="ability-modal-subtle">{otherError}</div>
              ) : otherItemDetails.length > 0 ? (
                <ul className="nature-info-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, listStyle: "none", padding: 0, margin: 0 }}>
                  {otherItemDetails.map((it) => (
                    <li key={it.slug} className="nature-info-card">
                      <div className="nature-info-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {it.iconUrl ? (
                          <img src={it.iconUrl} alt="" width={24} height={24} loading="lazy" />
                        ) : null}
                        <span className="text-capitalize">{humanizeName(it.name)}</span>
                      </div>
                      <div className="nature-info-card-text">
                        {it.effect || it.flavor || "No description available."}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="ability-learners-empty">No other items found across builds.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AbilityOverlay({ ability, data, loading, error, onClose, onRetry, onSelectPokemon, currentPokemonId, shiny = false }) {
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

  // Learner types come from the static Pokémon index (this used to fetch up to 140 full
  // /pokemon/{id} payloads, several hundred KB each, per ability).
  useEffect(() => {
    if (!data?.pokemon || data.pokemon.length === 0) return;
    let ignore = false;
    loadPokemonList()
      .then((list) => {
        if (ignore) return;
        const typesById = new Map(list.map((entry) => [String(entry.id), entry.types || []]));
        const next = new Map();
        for (const entry of data.pokemon) {
          const id = getIdNumberFromUrl(entry?.pokemon?.url);
          const types = id != null ? typesById.get(String(id)) : null;
          if (types && types.length > 0) next.set(String(id), types);
        }
        setLearnerTypes(next);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [data]);

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
          <Icon name="close" />
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
          <h3 className="ability-modal-subtitle">Pokémon with this ability</h3>
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
                                <span key={`${pokemon.url}-${type}`} className={`ability-learner-type type-${type}`} data-tooltip={type} aria-label={type}>
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




