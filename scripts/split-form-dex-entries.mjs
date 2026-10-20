#!/usr/bin/env node
// Separates form-specific Pokédex entries from the base species in public/data/pokemon_all.json.
//
// The scrape behind pokemon_all.json kept one entry per game for each species, so wherever
// Bulbapedia lists a form's own entry (Alolan Vulpix, cap Pikachu, Mow Rotom, Sensu Oricorio,
// Paldean Tauros, Mega forms in Legends: Z-A, ...) the form's text replaced the base species'
// text for that game. This script re-reads the Pokédex entries tables from Bulbapedia and, for
// every species whose table has form sections ({{Dex/Form|...}}):
//   - rebuilds `entries` from the base form's rows only (keeping the current wording where it
//     already matches, so earlier repairs survive), with each row stored under every game it
//     covers;
//   - adds `forms`: { "<PokeAPI Pokémon name>": { "<game>": text } } for each form that has its
//     own entries, so the site can show them on that form's page.
//
//   node scripts/split-form-dex-entries.mjs                 # update in place
//   node scripts/split-form-dex-entries.mjs --dry-run       # report only
//   node scripts/split-form-dex-entries.mjs --cache <file>  # reuse/save the downloaded wikitext
//   add --verbose to list every changed entry and the labels skipped (forms with no page of
//   their own), --labels to print which Pokémon each form label was matched to

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "public", "data");
const DATASET_PATH = path.join(DATA_DIR, "pokemon_all.json");
const INDEX_PATH = path.join(DATA_DIR, "pokemon-index.json");
const API = "https://bulbapedia.bulbagarden.net/w/api.php";
const USER_AGENT = "pokedexdb-form-dex-entries/1.0 (https://pokedexdb.com)";
const DRY_RUN = process.argv.includes("--dry-run");
const cacheIndex = process.argv.indexOf("--cache");
const CACHE_PATH = cacheIndex > 0 ? process.argv[cacheIndex + 1] : null;

// Games the site shows Pokédex text for, as Bulbapedia names them in {{Dex/Entry|v=...}}.
// Spin-offs and Pokopia are left out.
const GAMES = new Set([
  "Red", "Blue", "Yellow", "Gold", "Silver", "Crystal", "Ruby", "Sapphire", "Emerald",
  "FireRed", "LeafGreen", "Diamond", "Pearl", "Platinum", "HeartGold", "SoulSilver",
  "Black", "White", "Black 2", "White 2", "X", "Y", "Omega Ruby", "Alpha Sapphire",
  "Sun", "Moon", "Ultra Sun", "Ultra Moon", "Let's Go Pikachu", "Let's Go Eevee",
  "Sword", "Shield", "Brilliant Diamond", "Shining Pearl", "Legends: Arceus",
  "Scarlet", "Violet", "Legends: Z-A",
]);

// Form labels the token matching below can't resolve, by label or by "<species>|<label>".
// "base" = the species' default form, null = a form with no page of its own on the site
// (cosmetic forms, spin-off costumes).
const LABEL_OVERRIDES = {
  "Both genders": "base",
  "One form": "base",
  "Hero of Many Battles": "base",
  "Hoopa Confined": "base",
  "Ultimate Mode": "base",
  "Apex Build": "base",
  "Type: Normal": "base",
  "''All other forms''": null,
  "Ultra Necrozma": ["necrozma-ultra"],
  "Dusk Mane": ["necrozma-dusk"],
  "Dawn Wings": ["necrozma-dawn"],
  "Crowned Sword": ["zacian-crowned"],
  "Crowned Shield": ["zamazenta-crowned"],
  "Ice Rider": ["calyrex-ice"],
  "Shadow Rider": ["calyrex-shadow"],
  "Ice Face": "base",
  "Noice Face": ["eiscue-noice"],
  "Mega Meowstic": ["meowstic-male-mega", "meowstic-female-mega"],
  "darmanitan|Galarian Form": ["darmanitan-galar-standard"],
  "toxtricity|Gigantamax": ["toxtricity-amped-gmax", "toxtricity-low-key-gmax"],
  "Primal Reversion": "primal",
  "Medium Variety": "base",
  "Small Variety": ["pumpkaboo-small", "gourgeist-small"],
  "Large Variety": ["pumpkaboo-large", "gourgeist-large"],
  "Jumbo Variety": ["pumpkaboo-super", "gourgeist-super"],
  "10% Forme": ["zygarde-10", "zygarde-10-power-construct"],
  "50% Forme": "base",
  "Meteor Form": "base",
  "Original Color": ["magearna-original"],
  "Mega Magearna (Original Color)": ["magearna-original-mega"],
};

// Words that only describe the kind of form ("Alolan Form", "Sensu Style", "Plant Cloak").
const FILLER = new Set(["form", "forme", "style", "mode", "cloak", "the", "and", "breed", "mask", "pattern", "plumage", "size", "variety", "flower", "core", "cream", "swirl", "sea"]);
const TOKEN_ALIASES = { alolan: "alola", galarian: "galar", hisuian: "hisui", paldean: "paldea", gigantamax: "gmax" };

const tokenize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’%]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((token) => TOKEN_ALIASES[token] || token);

const toSlug = (name) =>
  String(name || "")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’.:]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ---------------------------------------------------------------------------------------------
// Bulbapedia wikitext

const curlJson = (url) =>
  // Bulbapedia's bot protection rejects Node's fetch but not curl
  JSON.parse(execFileSync("curl", ["-s", "-f", "-A", USER_AGENT, url], { maxBuffer: 1 << 28 }).toString("utf8"));

async function loadWikitext(names) {
  if (CACHE_PATH && existsSync(CACHE_PATH)) return JSON.parse(await readFile(CACHE_PATH, "utf8"));
  const pages = {};
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    let cont = {};
    for (;;) {
      const params = new URLSearchParams({
        action: "query",
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        format: "json",
        formatversion: "2",
        redirects: "1",
        titles: batch.map((name) => `${name} (Pokémon)`).join("|"),
        ...cont,
      });
      const json = curlJson(`${API}?${params}`);
      const renamed = new Map([...(json.query.normalized || []), ...(json.query.redirects || [])].map((r) => [r.to, r.from]));
      for (const page of json.query.pages) {
        const content = page.revisions?.[0]?.slots?.main?.content;
        if (!content) continue;
        let title = page.title;
        while (renamed.has(title)) title = renamed.get(title);
        pages[title.replace(/ \(Pokémon\)$/, "")] = content;
      }
      if (!json.continue) break;
      cont = json.continue;
    }
    console.log(`Downloaded ${Math.min(i + 50, names.length)}/${names.length} Bulbapedia pages`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (CACHE_PATH) await writeFile(CACHE_PATH, JSON.stringify(pages));
  return pages;
}

/** Splits `{{name|a|b=c}}` into [name, params], respecting nested templates and links. */
const splitTemplate = (source) => {
  const inner = source.slice(2, -2);
  const parts = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      current += two;
      i++;
    } else if ((two === "}}" || two === "]]") && depth > 0) {
      depth--;
      current += two;
      i++;
    } else if (inner[i] === "|" && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += inner[i];
    }
  }
  parts.push(current);
  const [name, ...rest] = parts;
  const named = {};
  const positional = [];
  for (const part of rest) {
    const match = part.match(/^\s*([\w/ ]+?)\s*=([\s\S]*)$/);
    if (match) named[match[1]] = match[2];
    else positional.push(part);
  }
  return { name: name.trim(), named, positional };
};

/** Every top-level `{{...}}` in `text`, in order. */
const topLevelTemplates = (text) => {
  const found = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === "{{") {
      if (depth === 0) start = i;
      depth++;
      i++;
    } else if (two === "}}" && depth > 0) {
      depth--;
      i++;
      if (depth === 0) found.push(text.slice(start, i + 1));
    }
  }
  return found;
};

const renderTemplate = ({ name, positional }) => {
  const [first = "", second] = positional;
  switch (name.toLowerCase()) {
    case "scpkmn":
      return "Pokémon";
    case "scball":
      return "Poké Ball";
    case "berries":
      return "Berries";
    case "sic":
      return "";
    case "obp":
      return positional[2] ?? first;
    case "tt":
      // {{tt|*|Pokédex entry only found in Pokémon HOME}} is a footnote marker
      return first.trim() === "*" ? "" : first;
    default:
      if (/^sup\//i.test(name)) return "";
      // {{p|Pikachu}}, {{m|Thunderbolt|display}}, {{a|...}}, {{status|...}}, {{t|Fire}}, {{wp|...}}
      return second ?? first;
  }
};

const renderWikitext = (text) => {
  let out = String(text || "").replace(/<!--[\s\S]*?-->/g, "");
  // Rows with per-revision or per-language variants ("... <small>(Version 1.0)</small><br>...
  // <small>(Version 1.1)</small>"): keep the English one, else the latest revision
  const variants = out.split(/<br\s*\/?>/i);
  if (variants.length > 1 && variants.every((part) => /<small>/i.test(part))) {
    out = variants.find((part) => /<small>[^<]*English/i.test(part)) || variants[variants.length - 1];
  }
  // Innermost templates first
  for (let guard = 0; guard < 20 && /\{\{/.test(out); guard++) {
    out = out.replace(/\{\{([^{}]*)\}\}/g, (match) => renderTemplate(splitTemplate(match)));
  }
  return out
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<small>[\s\S]*?<\/small>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/'''?/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Rows of the "Pokédex entries" table: [{ label, games, text }]. `label` is the {{Dex/Form}}
 * heading the row sits under within its generation (null for the base species).
 */
const parseDexRows = (wikitext) => {
  const start = wikitext.search(/=+\s*Pok[eé]dex entries\s*=+/);
  if (start < 0) return [];
  const afterHeading = wikitext.indexOf("\n", start);
  const footer = wikitext.indexOf("{{Dex/Footer}}", afterHeading);
  const nextHeading = wikitext.slice(afterHeading).search(/\n==/);
  const ends = [footer, nextHeading >= 0 ? afterHeading + nextHeading : -1].filter((value) => value >= 0);
  const section = wikitext.slice(afterHeading, ends.length ? Math.min(...ends) : undefined);

  const rows = [];
  let label = null;
  for (const source of topLevelTemplates(section)) {
    const template = splitTemplate(source);
    if (/^Dex\/Gen\//.test(template.name)) {
      label = null;
    } else if (template.name === "Dex/Form") {
      label = template.positional[0]?.trim() || null;
    } else if (/^Dex\/Entry\d$/.test(template.name)) {
      const games = ["v", "v2", "v3"].map((key) => template.named[key]?.trim()).filter(Boolean);
      const text = renderWikitext(template.named.entry);
      if (text) rows.push({ label, games, text });
    }
  }
  return rows;
};

// ---------------------------------------------------------------------------------------------
// Form labels -> PokeAPI Pokémon names

/** Resolves a {{Dex/Form}} label to "base", an array of Pokémon names, or null (no page). */
const resolveLabel = (label, species) => {
  const overrideKey = [`${species.slug}|${label}`, label].find((key) => Object.hasOwn(LABEL_OVERRIDES, key));
  if (overrideKey) {
    const override = LABEL_OVERRIDES[overrideKey];
    if (override === "primal") return [`${species.slug}-primal`];
    if (Array.isArray(override)) return override.filter((name) => species.pokemon.includes(name));
    return override;
  }
  // "Original Cap, Hoenn Cap, ..., and Partner Cap" names several forms at once
  const parts = label.split(/,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean);
  if (parts.length > 1) {
    const resolved = parts.map((part) => resolveLabel(part, species));
    if (resolved.includes("base")) return "base";
    const names = resolved.filter(Array.isArray).flat();
    return names.length ? names : null;
  }

  const speciesTokens = new Set(tokenize(species.slug));
  const labelTokens = tokenize(label).filter((token) => !FILLER.has(token) && !speciesTokens.has(token));
  if (labelTokens.length === 0) return "base"; // "Rotom", "Kyurem", "Normal Form"
  const suffixTokens = (pokemonName) => tokenize(pokemonName.slice(species.slug.length)).filter((token) => !FILLER.has(token));
  const sameTokens = (a, b) => a.length === b.length && a.every((token) => b.includes(token));

  const exact = species.pokemon.filter((pokemonName) => sameTokens(suffixTokens(pokemonName), labelTokens));
  if (exact.length) return exact.includes(species.defaultName) ? "base" : exact;
  // The default form's own name ("Plant Cloak" for Burmy, "West Sea" for Shellos, "Male" for
  // Frillish) when PokeAPI gives the default Pokémon no suffix
  if (DEFAULT_FORM_LABELS.has(labelTokens.join(" "))) return "base";
  return null;
};

// Labels of a species' default (first-listed) form when its PokeAPI name carries no suffix.
const DEFAULT_FORM_LABELS = new Set([
  "plant", "west", "spring", "red", "vanilla", "meadow", "overcast", "phony", "counterfeit",
  "unremarkable", "male", "normal", "chest", "teal", "family of four", "ice", "altered",
  "incarnate", "land", "aria", "ordinary", "red striped", "standard", "shield", "disguised",
  "solo", "midday", "full belly", "zero", "curly", "amped", "single strike", "two segment",
  "green", "average", "baile", "50",
]);

// ---------------------------------------------------------------------------------------------

const normalizeForCompare = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");

async function main() {
  const dataset = JSON.parse(await readFile(DATASET_PATH, "utf8"));
  const index = JSON.parse(await readFile(INDEX_PATH, "utf8")).pokemon;

  const pokemonBySpecies = new Map();
  for (const entry of index) {
    if (/-totem/.test(entry.n)) continue;
    if (!pokemonBySpecies.has(entry.s)) pokemonBySpecies.set(entry.s, []);
    pokemonBySpecies.get(entry.s).push(entry);
  }
  const defaults = index.filter((entry) => entry.i === entry.s);
  const speciesFor = (displayName) => {
    const slug = toSlug(displayName);
    const match =
      defaults.find((entry) => entry.n === slug) ||
      defaults.find((entry) => entry.n.startsWith(`${slug}-`));
    if (!match) return null;
    return {
      slug,
      defaultName: match.n,
      pokemon: (pokemonBySpecies.get(match.s) || []).map((entry) => entry.n),
    };
  };

  const pages = await loadWikitext(dataset.map((record) => record.name));

  const ignoredLabels = new Set();
  const changes = [];
  let speciesWithForms = 0;
  let formEntryCount = 0;

  for (const record of dataset) {
    const wikitext = pages[record.name];
    if (!wikitext) {
      console.warn(`No Bulbapedia page for ${record.name}`);
      continue;
    }
    const rows = parseDexRows(wikitext).filter((row) => row.games.some((game) => GAMES.has(game)));
    if (!rows.some((row) => row.label)) continue;
    const species = speciesFor(record.name);
    if (!species) {
      console.warn(`No PokeAPI species for ${record.name}`);
      continue;
    }
    speciesWithForms++;

    const baseEntries = {};
    const forms = {};
    const labelTargets = new Map();
    for (const row of rows) {
      const target = row.label ? resolveLabel(row.label, species) : "base";
      if (row.label) labelTargets.set(row.label, target);
      if (target === null) {
        ignoredLabels.add(`${record.name}: ${row.label}`);
        continue;
      }
      for (const game of row.games.filter((value) => GAMES.has(value))) {
        if (target === "base") {
          if (!baseEntries[game]) baseEntries[game] = row.text;
        } else {
          for (const pokemonName of target) {
            forms[pokemonName] ||= {};
            if (!forms[pokemonName][game]) forms[pokemonName][game] = row.text;
          }
        }
      }
    }

    if (process.argv.includes("--labels")) {
      labelTargets.forEach((target, label) => console.log(`  ${record.name}: ${label} -> ${Array.isArray(target) ? target.join(", ") : target}`));
    }

    // Keep the current wording where it's already the base text (it may carry earlier fixes)
    const previous = record.entries || {};
    const rebuilt = {};
    for (const [game, text] of Object.entries(baseEntries)) {
      rebuilt[game] = normalizeForCompare(previous[game]) === normalizeForCompare(text) ? previous[game] : text;
    }
    for (const game of new Set([...Object.keys(previous), ...Object.keys(rebuilt)])) {
      if (previous[game] === rebuilt[game]) continue;
      // A row now stored under its partner game too is not a change worth reporting
      if (previous[game] == null && Object.values(previous).some((text) => normalizeForCompare(text) === normalizeForCompare(rebuilt[game]))) continue;
      changes.push({ name: record.name, game, before: previous[game] ?? null, after: rebuilt[game] ?? null });
    }

    record.entries = rebuilt;
    const formNames = Object.keys(forms).filter((pokemonName) => Object.keys(forms[pokemonName]).length > 0);
    if (formNames.length) {
      record.forms = Object.fromEntries(formNames.map((pokemonName) => [pokemonName, forms[pokemonName]]));
      formEntryCount += formNames.reduce((sum, pokemonName) => sum + Object.keys(forms[pokemonName]).length, 0);
    } else {
      delete record.forms;
    }
  }

  console.log(`Species with form sections: ${speciesWithForms}`);
  console.log(`Form entries stored: ${formEntryCount}`);
  console.log(`Base entries changed: ${changes.filter((c) => c.before && c.after).length}, removed: ${changes.filter((c) => !c.after).length}, added: ${changes.filter((c) => !c.before).length}`);
  if (process.argv.includes("--verbose")) {
    for (const change of changes) {
      console.log(`  ${change.name} / ${change.game}\n    - ${change.before ?? "(none)"}\n    + ${change.after ?? "(none)"}`);
    }
    console.log(`Labels without a page on the site (${ignoredLabels.size}):`);
    ignoredLabels.forEach((label) => console.log(`  ${label}`));
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
