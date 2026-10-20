#!/usr/bin/env node
// Repairs Pokédex entries in public/data/pokemon_all.json whose linked words were stripped
// when the data was scraped (e.g. "When several of these  gather" -> "these Pokémon gather",
// "identify impending danger and  to safety" -> "and Teleport to safety").
//
// Each broken entry is matched against PokeAPI's flavor text for the same species (same
// version first, then any version with the same wording) and the missing words are filled in.
//
//   node scripts/repair-flavor-text.mjs           # repair in place
//   node scripts/repair-flavor-text.mjs --dry-run # report only

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = path.resolve(__dirname, "..", "public", "data", "pokemon_all.json");
const GRAPHQL = "https://beta.pokeapi.co/graphql/v1beta";
const DRY_RUN = process.argv.includes("--dry-run");

// A gap is where the scraper dropped a linked word: leading/trailing space, a double space,
// a space before punctuation, or a space before a possessive ("this 's body").
const GAP_SOURCE = String.raw`^\s+|\s{2,}|\s(?=[.,!?;:])|\s(?=['’]s\b)|\s+$`;
const GAP_PATTERN = new RegExp(GAP_SOURCE);
const forEachGap = (text, render) => {
  let index = 0;
  return text.replace(new RegExp(GAP_SOURCE, "g"), (match, offset) => {
    const atStart = offset === 0;
    const atEnd = offset + match.length === text.length;
    const word = render(index++);
    if (atStart) return `${word} `;
    if (atEnd || match.length === 1) return ` ${word}`;
    return ` ${word} `;
  });
};

async function graphql(query) {
  const response = await fetch(GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "pokedexdb-flavor-repair/1.0" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`GraphQL ${response.status} ${response.statusText}`);
  const json = await response.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 500));
  return json.data;
}

const toVersionSlug = (label) =>
  String(label || "")
    .toLowerCase()
    .replace(/[':.]/g, "")
    .replace(/\s+/g, "-");

const normalizeApiText = (text) =>
  String(text || "")
    .replace(/­\s*/g, "")
    .replace(/-[\f\n\r]+/g, "-")
    .replace(/[\f\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Stands in for dashes while the gap regex is built (dash style and spacing differ between sources)
const DASH_PLACEHOLDER = "~DASH~";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Turn the broken local text into a regex where every gap captures the missing word(s).
const buildGapRegex = (text) => {
  const marked = forEachGap(text, () => "\u0000");
  const pieces = marked.split("\u0000").map((piece) =>
    escapeRegex(piece.replace(/\s*[-—–]+\s*/g, DASH_PLACEHOLDER))
      .replace(/\s+/g, "\\s+")
      .split(DASH_PLACEHOLDER)
      .join("\\s*[-—–]*\\s*")
      .replace(/['’]/g, "['’]")
      .replace(/["“”]/g, "[\"“”]")
      .replace(/é/gi, "[eé]")
  );
  const body = pieces
    .map((piece, index) => (index < pieces.length - 1 ? `${piece}(.{1,40}?)` : piece))
    .join("")
    .replace(/\\s\+\(/g, "\\s*(")
    .replace(/\)\\s\+/g, ")\\s*");
  return new RegExp(`^${body}$`, "i");
};

const fixCase = (word) => {
  const trimmed = word.trim();
  if (/^pok[eé]mon$/i.test(trimmed)) return "Pokémon";
  if (/^pok[eé]mon's$/i.test(trimmed)) return "Pokémon's";
  // Older games print names in caps ("POKéMON", "TELEPORT", "POKé BALL").
  if (trimmed.replace(/é/g, "É") === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .replace(/(^|[\s-])([a-zé])/g, (match, sep, char) => sep + char.toUpperCase())
      .replace(/Pokemon/g, "Pokémon")
      .replace(/Poké(?=[a-z])/g, "Poké");
  }
  return trimmed;
};

const fillGaps = (localText, captures) =>
  forEachGap(localText, (index) => fixCase(captures[index] ?? ""))
    .replace(/\s+/g, " ")
    .trim();

async function main() {
  const dataset = JSON.parse(await readFile(DATASET_PATH, "utf8"));
  console.log("Loading PokeAPI flavor text...");
  const data = await graphql(`{
    pokemon_v2_pokemonspeciesname(where: {language_id: {_eq: 9}}) { name pokemon_species_id }
    pokemon_v2_pokemonspeciesflavortext(where: {language_id: {_eq: 9}}) {
      pokemon_species_id
      flavor_text
      pokemon_v2_version { name }
    }
  }`);
  const nameKey = (name) => String(name || "").toLowerCase().replace(/[’`]/g, "'");
  const speciesIdByName = new Map(
    data.pokemon_v2_pokemonspeciesname.map((row) => [nameKey(row.name), row.pokemon_species_id])
  );
  const textsBySpecies = new Map();
  for (const row of data.pokemon_v2_pokemonspeciesflavortext) {
    const list = textsBySpecies.get(row.pokemon_species_id) || [];
    list.push({ version: row.pokemon_v2_version?.name, text: normalizeApiText(row.flavor_text) });
    textsBySpecies.set(row.pokemon_species_id, list);
  }

  let broken = 0;
  let repaired = 0;
  let replacedGmax = 0;
  const removed = [];
  const unresolved = [];
  for (const pokemon of dataset) {
    const speciesId = speciesIdByName.get(nameKey(pokemon.name));
    const apiTexts = speciesId != null ? textsBySpecies.get(speciesId) || [] : [];
    for (const [versionLabel, text] of Object.entries(pokemon.entries || {})) {
      const slug = toVersionSlug(versionLabel);
      // A few Legends: Z-A rows hold the scraped species info table instead of an entry
      // ("Snake Pokémon 6'07" 2m 15.2lbs 6.9kg 2, 560 Steps 20 Cycles").
      if (/\bSteps\b.*\bCycles\b/.test(text)) {
        delete pokemon.entries[versionLabel];
        removed.push(`${pokemon.name} / ${versionLabel}: ${text}`);
        continue;
      }
      // The scrape stored Gigantamax-form entries under the base species for Sword/Shield.
      if (/gigantamax/i.test(text)) {
        const official = apiTexts.find((entry) => entry.version === slug && !/gigantamax/i.test(entry.text));
        if (official) {
          pokemon.entries[versionLabel] = official.text;
          replacedGmax++;
          continue;
        }
      }
      if (!GAP_PATTERN.test(text)) continue;
      broken++;
      const regex = buildGapRegex(text);
      const candidates = [
        ...apiTexts.filter((entry) => entry.version === slug),
        ...apiTexts.filter((entry) => entry.version !== slug),
      ];
      let fixed = null;
      for (const candidate of candidates) {
        const match = candidate.text.match(regex);
        if (match) {
          fixed = fillGaps(text, match.slice(1));
          break;
        }
      }
      if (fixed && !GAP_PATTERN.test(fixed)) {
        pokemon.entries[versionLabel] = fixed;
        repaired++;
      } else if (apiTexts.some((entry) => entry.version === slug)) {
        // Unrepairable, but PokeAPI has the official text for this version: drop the broken
        // copy so the site falls back to it.
        delete pokemon.entries[versionLabel];
        removed.push(`${pokemon.name} / ${versionLabel}: ${text}`);
      } else {
        // No other source for this version (PokeAPI has no BDSP / Z-A and few SV entries).
        unresolved.push(`${pokemon.name} / ${versionLabel}: ${text}`);
      }
    }
  }

  console.log(`Gigantamax entries replaced: ${replacedGmax}`);
  console.log(
    `Broken entries: ${broken}, repaired: ${repaired}, replaced by PokeAPI text: ${removed.length}, still broken: ${unresolved.length}`
  );
  if (unresolved.length > 0) {
    console.log("Still broken (needs a manual fix):");
    unresolved.forEach((line) => console.log(`  ${line}`));
  }
  if (!DRY_RUN) {
    await writeFile(DATASET_PATH, JSON.stringify(dataset, null, 2) + "\n", "utf8");
    console.log(`Updated ${path.relative(process.cwd(), DATASET_PATH)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
