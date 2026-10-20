#!/usr/bin/env node
// Writes dist/sitemap.xml: the home page, every tool page and every Pokémon page, all as the
// clean path URLs that generate-share-pages.mjs creates (no hash URLs, no redirects).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PAGE_ROUTES, SITE_URL } from "../src/routeMeta.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SITEMAP_PATH = path.join(ROOT_DIR, "dist", "sitemap.xml");
const INDEX_PATH = path.join(ROOT_DIR, "public", "data", "pokemon-index.json");

const escapeXml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const urlEntry = (loc, { changefreq, priority }) =>
  `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

const generateSitemap = async () => {
  const index = JSON.parse(await readFile(INDEX_PATH, "utf8"));
  const pokemonNames = (index.pokemon || [])
    .map((entry) => entry?.n)
    .filter((name) => name && !name.includes("totem"))
    .sort();

  const urls = [
    urlEntry(`${SITE_URL}/`, { changefreq: "weekly", priority: "1.0" }),
    ...PAGE_ROUTES.filter((route) => route.nav).map((route) =>
      urlEntry(`${SITE_URL}/${route.path}`, { changefreq: "monthly", priority: "0.8" })
    ),
    ...pokemonNames.map((name) =>
      urlEntry(`${SITE_URL}/${encodeURIComponent(name)}`, { changefreq: "monthly", priority: "0.7" })
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  await writeFile(SITEMAP_PATH, xml, "utf8");
  console.log(`Generated sitemap.xml with ${urls.length} URLs.`);
};

generateSitemap().catch((error) => {
  console.error("Failed to generate sitemap:", error);
  process.exitCode = 1;
});
