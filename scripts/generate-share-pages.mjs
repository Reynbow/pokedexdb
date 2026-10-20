#!/usr/bin/env node
// Writes a static HTML page per Pokémon and per tool page into dist/, each with its own title,
// description, canonical URL and social-preview tags (the app itself is a client-side SPA, so
// without these every URL would look like the home page to search engines and link previews).
//
// Pages are written as dist/<path>.html: GitHub Pages serves /pikachu from pikachu.html with a
// 200 and no redirect, so the canonical URL is the clean /pikachu.

import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGE_ROUTES, SITE_NAME, SITE_URL } from "../src/routeMeta.js";
import { formatPokemonName } from "../src/utils/pokemonNames.js";

// "charizard-mega-x" -> "Mega Charizard X", "kyogre-primal" -> "Primal Kyogre"
const formatFormTitle = (slug) => {
  const tokens = slug.split("-");
  if (tokens.includes("gmax")) return `Gigantamax ${formatPokemonName(slug)}`;
  if (tokens.includes("mega")) return `Mega ${formatPokemonName(slug)}`;
  if (tokens.includes("primal")) return `Primal ${formatPokemonName(tokens.filter((t) => t !== "primal").join("-"))}`;
  return formatPokemonName(slug);
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const TEMPLATE_PATH = path.join(DIST_DIR, "index.html");
const DATASET_PATH = path.join(ROOT_DIR, "public", "data", "pokemon_all.json");
const INDEX_PATH = path.join(ROOT_DIR, "public", "data", "pokemon-index.json");

const MARKER_START = "<!-- share-meta:start -->";
const MARKER_END = "<!-- share-meta:end -->";
const SITE_IMAGE = { url: `${SITE_URL}/favicon-og.png`, width: 128, height: 128, alt: `${SITE_NAME} logo` };
const ARTWORK_URL = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

// Newest first: the description uses the most recent Pokédex entry available
const FLAVOR_PRIORITY = [
  "Legends: Z-A",
  "Scarlet",
  "Violet",
  "Legends: Arceus",
  "Brilliant Diamond",
  "Shining Pearl",
  "Sword",
  "Shield",
  "Let's Go Pikachu",
  "Ultra Sun",
  "Ultra Moon",
  "Sun",
  "Moon",
  "Omega Ruby",
  "Alpha Sapphire",
  "X",
  "Y",
  "Black 2",
  "White 2",
  "Black",
  "White",
  "HeartGold",
  "SoulSilver",
  "Platinum",
  "Diamond",
  "Pearl",
  "FireRed",
  "LeafGreen",
  "Emerald",
  "Ruby",
  "Sapphire",
  "Crystal",
  "Gold",
  "Silver",
  "Yellow",
  "Red",
  "Blue",
];

const sanitizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .trim();

const escapeHtml = (value) =>
  String(value).replace(/[&"'<>]/g, (ch) => ({ "&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;" })[ch]);

const normalizeLocalKey = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.:]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toTitle = (slug) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const truncate = (value, max) => {
  if (!value || value.length <= max) return value || "";
  return `${value.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
};

const formatDexNumber = (id) => (id && id < 10000 ? `#${String(id).padStart(4, "0")}` : null);

const pickFlavorEntry = (record) => {
  const entries = record?.entries;
  if (!entries || typeof entries !== "object") return null;
  for (const key of FLAVOR_PRIORITY) {
    if (entries[key]) return entries[key];
  }
  return Object.values(entries).find(Boolean) || null;
};

const buildMetaBlock = ({ canonicalUrl, title, socialTitle, description, image, jsonLd }) => {
  const indent = "    ";
  const lines = [
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(socialTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image.url)}" />`,
    `<meta property="og:image:width" content="${image.width}" />`,
    `<meta property="og:image:height" content="${image.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(image.alt)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeHtml(socialTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image.url)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(image.alt)}" />`,
    `<title>${escapeHtml(title)}</title>`,
  ];
  if (jsonLd) {
    // "<" is escaped so the JSON can never close the script element
    lines.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`);
  }
  return lines.map((line) => `${indent}${line}`).join("\n");
};

const loadTemplate = async () => {
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const startIndex = template.indexOf(MARKER_START);
  const endIndex = template.indexOf(MARKER_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("share meta markers not found in dist/index.html");
  }
  return {
    before: template.slice(0, startIndex + MARKER_START.length),
    after: template.slice(endIndex),
  };
};

const loadDataset = async () => {
  const json = JSON.parse(await readFile(DATASET_PATH, "utf8"));
  const map = new Map();
  for (const record of Array.isArray(json) ? json : []) {
    if (typeof record?.name !== "string") continue;
    const key = normalizeLocalKey(record.name);
    if (key && !map.has(key)) map.set(key, record);
  }
  return map;
};

const loadPokemonIndex = async () => {
  const json = JSON.parse(await readFile(INDEX_PATH, "utf8"));
  return (json.pokemon || []).filter((entry) => entry?.n && !entry.n.includes("totem"));
};

const writePage = async (relativePath, before, after, meta) => {
  const html = `${before}\n${buildMetaBlock(meta)}\n${after}`;
  await writeFile(path.join(DIST_DIR, `${relativePath}.html`), html, "utf8");
};

const generate = async () => {
  const [{ before, after }, dataset, index] = await Promise.all([loadTemplate(), loadDataset(), loadPokemonIndex()]);
  const nameById = new Map(index.map((entry) => [entry.i, entry.n]));

  for (const route of PAGE_ROUTES) {
    await writePage(route.path, before, after, {
      canonicalUrl: `${SITE_URL}/${route.path}`,
      title: route.title,
      socialTitle: route.title,
      description: route.description,
      image: SITE_IMAGE,
      jsonLd: { "@context": "https://schema.org", "@type": "WebPage", name: route.title, description: route.description, url: `${SITE_URL}/${route.path}` },
    });
  }

  for (const entry of index) {
    const slug = entry.n;
    const canonicalUrl = `${SITE_URL}/${encodeURIComponent(slug)}`;
    // Forms share their species' dataset record and dex number
    const speciesSlug = nameById.get(entry.s) || slug;
    const record = dataset.get(normalizeLocalKey(slug)) || dataset.get(normalizeLocalKey(speciesSlug)) || null;
    const isForm = entry.i >= 10000;
    const displayName = !isForm && record?.name ? record.name : formatFormTitle(slug);
    const dexNumber = formatDexNumber(entry.s);
    const types = (entry.t || []).map(toTitle).join("/");
    const flavor = sanitizeText(pickFlavorEntry(record));
    const summary = `${displayName}${dexNumber ? ` (${dexNumber})` : ""} is a${/^[AEIOU]/.test(types) ? "n" : ""} ${types}-type Pokemon.`;
    const description = truncate(
      `${summary} ${flavor ? `${flavor} ` : ""}Stats, evolutions, moves, abilities, weaknesses and where to catch it in every game.`,
      300
    );
    const title = `${displayName}${dexNumber ? ` ${dexNumber}` : ""} - Stats, Evolutions & Weaknesses | ${SITE_NAME}`;
    await writePage(slug, before, after, {
      canonicalUrl,
      title,
      socialTitle: title,
      description,
      image: { url: ARTWORK_URL(entry.i), width: 475, height: 475, alt: `Official artwork of ${displayName}` },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: title,
        description,
        url: canonicalUrl,
        primaryImageOfPage: ARTWORK_URL(entry.i),
      },
    });
  }

  // SPA fallback for any other URL (e.g. old /pikachu/ links with a trailing slash). The
  // Pages workflow also copies this, but `npm run deploy` (gh-pages) relies on it being here.
  await copyFile(TEMPLATE_PATH, path.join(DIST_DIR, "404.html"));

  console.log(`Generated ${PAGE_ROUTES.length} tool pages and ${index.length} Pokemon pages.`);
};

generate().catch((error) => {
  console.error("Failed to generate share metadata pages:", error);
  process.exitCode = 1;
});
