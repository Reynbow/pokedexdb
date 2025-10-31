#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const TEMPLATE_PATH = path.join(DIST_DIR, "index.html");
const DATASET_PATH = path.join(ROOT_DIR, "public", "data", "pokemon_all.json");

const MARKER_START = "<!-- share-meta:start -->";
const MARKER_END = "<!-- share-meta:end -->";
const BASE_URL = "https://pokedexdb.com";
const FLAVOR_PRIORITY = [
  "Scarlet",
  "Violet",
  "Legends: Z-A",
  "Legends: Z-a",
  "Legends: Arceus",
  "Legends: Arceus",
  "Brilliant Diamond",
  "Shining Pearl",
  "Sword",
  "Shield",
  "Ultra Sun",
  "Ultra Moon",
  "Sun",
  "Moon",
  "X",
  "Y",
  "Black 2",
  "White 2",
  "Black",
  "White",
  "HeartGold",
  "SoulSilver",
  "Platinum",
  "Emerald",
  "Ruby",
  "Sapphire",
  "Crystal",
  "Gold",
  "Silver",
  "Red",
  "Blue",
  "Yellow",
];

const sanitizeText = (value) => {
  if (!value) return "";
  let text = String(value)
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-");
  text = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]+/g, "")
    .trim();
  return text;
};

const escapeHtmlAttr = (value) =>
  String(value).replace(/[&"'<>]/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      default:
        return ch;
    }
  });

const normalizeLocalKey = (value) => {
  if (value == null) return "";
  let normalized = String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  normalized = normalized
    .replace(/pok[eé]mon/g, "pokemon")
    .replace(/["'’]/g, "")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ");
  normalized = normalized.replace(/[^a-z0-9]+/g, "-");
  normalized = normalized.replace(/-([a-z0-9])-(?=[a-z0-9]($|-))/g, "-$1");
  normalized = normalized.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return normalized;
};

const toDisplayName = (slug) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const pickFlavorEntry = (record) => {
  if (!record || typeof record !== "object") return null;
  const entries = record.entries;
  if (!entries || typeof entries !== "object") return null;
  for (const key of FLAVOR_PRIORITY) {
    if (entries[key]) return entries[key];
  }
  for (const value of Object.values(entries)) {
    if (value) return value;
  }
  return null;
};

const formatDexNumber = (id) => {
  if (!id || Number.isNaN(Number(id))) return null;
  const num = Number(id);
  if (num < 10000) {
    return `#${String(num).padStart(4, "0")}`;
  }
  return `#${num}`;
};

const selectImageUrl = (id) => {
  if (!id || Number.isNaN(Number(id))) {
    return {
      primary: `${BASE_URL}/og-preview.png`,
      alt: "Pokedex DB detail preview card.",
    };
  }
  const num = Number(id);
  const primary = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${num}.png`;
  if (num >= 10000) {
    const fallback = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${num}.png`;
    return {
      primary: fallback,
      alt: "Pixel sprite showing this Pokemon.",
    };
  }
  return {
    primary,
    alt: "Official artwork of this Pokemon.",
  };
};

const truncate = (value, max = 280) => {
  if (!value) return "";
  if (value.length <= max) return value;
  const sliced = value.slice(0, max - 1).trimEnd();
  return `${sliced}…`;
};

const buildMetaBlock = ({
  canonicalUrl,
  description,
  ogTitle,
  twitterTitle,
  imageUrl,
  imageAlt,
  pageTitle,
}) => {
  const indent = "    ";
  const lines = [
    `${indent}<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`,
    `${indent}<meta name="description" content="${escapeHtmlAttr(description)}" />`,
    `${indent}<meta property="og:site_name" content="Pokedex DB" />`,
    `${indent}<meta property="og:type" content="website" />`,
    `${indent}<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`,
    `${indent}<meta property="og:title" content="${escapeHtmlAttr(ogTitle)}" />`,
    `${indent}<meta property="og:description" content="${escapeHtmlAttr(description)}" />`,
    `${indent}<meta property="og:image" content="${escapeHtmlAttr(imageUrl)}" />`,
    `${indent}<meta property="og:image:width" content="1200" />`,
    `${indent}<meta property="og:image:height" content="1200" />`,
    `${indent}<meta property="og:image:alt" content="${escapeHtmlAttr(imageAlt)}" />`,
    `${indent}<meta name="twitter:card" content="summary_large_image" />`,
    `${indent}<meta name="twitter:title" content="${escapeHtmlAttr(twitterTitle)}" />`,
    `${indent}<meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`,
    `${indent}<meta name="twitter:image" content="${escapeHtmlAttr(imageUrl)}" />`,
    `${indent}<meta name="twitter:image:alt" content="${escapeHtmlAttr(imageAlt)}" />`,
    `${indent}<title>${escapeHtmlAttr(pageTitle)}</title>`,
  ];
  return lines.join("\n");
};

const loadTemplate = async () => {
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const startIndex = template.indexOf(MARKER_START);
  const endIndex = template.indexOf(MARKER_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("share meta markers not found in dist/index.html");
  }
  const blockStart = startIndex + MARKER_START.length;
  const before = template.slice(0, blockStart);
  const after = template.slice(endIndex);
  return { before, after };
};

const loadDataset = async () => {
  const raw = await readFile(DATASET_PATH, "utf8");
  const json = JSON.parse(raw);
  const map = new Map();
  if (Array.isArray(json)) {
    for (const record of json) {
      if (!record || typeof record.name !== "string") continue;
      const key = normalizeLocalKey(record.name);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, record);
      }
    }
  }
  return map;
};

const fetchPokemonList = async () => {
  const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=100000&offset=0", {
    headers: { "User-Agent": "pokedexdb-share-generator/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Pokemon index: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  if (!json || !Array.isArray(json.results)) {
    throw new Error("Unexpected payload from Pokemon index endpoint");
  }
  return json.results
    .filter((entry) => entry?.name && !entry.name.includes("totem"))
    .map((entry) => {
      const urlParts = String(entry.url || "").split("/").filter(Boolean);
      const id = Number(urlParts[urlParts.length - 1]) || null;
      return {
        slug: entry.name,
        id,
      };
    })
    .filter((entry) => entry.slug)
    .sort((a, b) => a.slug.localeCompare(b.slug));
};

const buildDescription = (displayName, flavor) => {
  if (flavor) {
    const clean = sanitizeText(flavor);
    if (clean) {
      return truncate(`${clean} Explore detailed stats, evolutions, abilities, moves, and weakness chart on Pokedex DB.`, 260);
    }
  }
  return `${displayName}'s complete stats, evolutions, abilities, moves, and weakness chart on Pokedex DB.`;
};

const generate = async () => {
  const [{ before, after }, dataset, index] = await Promise.all([
    loadTemplate(),
    loadDataset(),
    fetchPokemonList(),
  ]);

  let created = 0;
  for (const entry of index) {
    const { slug, id } = entry;
    const normalized = normalizeLocalKey(slug);
    const canonicalUrl = `${BASE_URL}/${encodeURIComponent(slug)}`;
    const record = dataset.get(normalized) || null;
    const displayName = record?.name || toDisplayName(slug);
    const flavor = pickFlavorEntry(record);
    const description = sanitizeText(buildDescription(displayName, flavor));
    const dexNumber = formatDexNumber(id);
    const { primary: imageUrl, alt: imageAltBase } = selectImageUrl(id);
    const imageAlt = imageAltBase.replace("this Pokemon", displayName ? `${displayName}` : "this Pokemon");
    const ogTitle = dexNumber
      ? `${displayName} ${dexNumber} - Stats, Evolutions & Weaknesses | Pokedex DB`
      : `${displayName} - Stats, Evolutions & Weaknesses | Pokedex DB`;
    const twitterTitle = ogTitle;
    const pageTitle = dexNumber ? `${displayName} ${dexNumber} | Pokedex DB` : `${displayName} | Pokedex DB`;

    const metaBlock = buildMetaBlock({
      canonicalUrl,
      description,
      ogTitle,
      twitterTitle,
      imageUrl,
      imageAlt,
      pageTitle,
    });

    const html = `${before}\n${metaBlock}\n${after}`;
    const dir = path.join(DIST_DIR, slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), html, "utf8");
    created += 1;
  }

  console.log(`Generated share metadata pages for ${created} Pokemon routes.`);
};

generate().catch((error) => {
  console.error("Failed to generate share metadata pages:", error);
  process.exitCode = 1;
});

