#!/usr/bin/env node
// Builds static data snapshots from PokeAPI so the site no longer makes hundreds of
// API calls at runtime (one per card, one per move, one per Pokédex, ...).
//
// Re-run whenever PokeAPI adds new Pokémon, games or Pokédexes:
//   node scripts/build-data-snapshot.mjs
//
// Outputs (all committed, served from /data/):
//   public/data/pokemon-index.json  every Pokémon/form with species id, current types and past types
//   public/data/pokedexes.json      entry numbers for every regional Pokédex the site uses
//   public/data/moves.json          move type/power/accuracy/PP/category plus per-version-group history
//   public/data/type-chart.json     type effectiveness per generation (Gen 1, Gen 2-5, Gen 6+)
//   public/data/move-effects.json   short English effect text per move
//   public/data/abilities.json      main-series abilities with effect text and the Pokémon that have them
//   src/data/species-flags.json     Legendary/Mythical/Baby/Ultra Beast/Paradox Pokémon names (bundled)

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "public", "data");
const SRC_DATA_DIR = path.resolve(__dirname, "..", "src", "data");
const REST = "https://pokeapi.co/api/v2";
const GRAPHQL = "https://beta.pokeapi.co/graphql/v1beta";
const HEADERS = { "User-Agent": "pokedexdb-data-snapshot/1.0" };

const POKEDEXES = [
  "kanto",
  "letsgo-kanto",
  "original-johto",
  "updated-johto",
  "hoenn",
  "updated-hoenn",
  "original-sinnoh",
  "extended-sinnoh",
  "original-unova",
  "updated-unova",
  "kalos-central",
  "kalos-coastal",
  "kalos-mountain",
  "lumiose-city",
  "hyperspace",
  "original-alola",
  "updated-alola",
  "galar",
  "isle-of-armor",
  "crown-tundra",
  "hisui",
  "paldea",
  "kitakami",
  "blueberry",
];

const GENERATION_NUMBERS = new Map([
  ["generation-i", 1],
  ["generation-ii", 2],
  ["generation-iii", 3],
  ["generation-iv", 4],
  ["generation-v", 5],
  ["generation-vi", 6],
  ["generation-vii", 7],
  ["generation-viii", 8],
  ["generation-ix", 9],
]);
const MAX_GENERATION = 9;

const idFromUrl = (url) => Number(String(url || "").split("/").filter(Boolean).pop());

async function getJson(url, attempt = 1) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    if (attempt < 4 && response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      return getJson(url, attempt + 1);
    }
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

async function graphql(query) {
  const response = await fetch(GRAPHQL, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`GraphQL ${response.status} ${response.statusText}`);
  const json = await response.json();
  if (json.errors) throw new Error(`GraphQL error: ${JSON.stringify(json.errors).slice(0, 500)}`);
  return json.data;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function writeJson(fileName, data, dir = DATA_DIR) {
  const target = path.join(dir, fileName);
  const text = JSON.stringify(data);
  await writeFile(target, text + "\n", "utf8");
  console.log(`  wrote ${path.relative(process.cwd(), target)} (${(text.length / 1024).toFixed(1)} KB)`);
}

async function buildTypes() {
  const list = await getJson(`${REST}/type?limit=100`);
  const details = await mapLimit(list.results, 6, (entry) => getJson(entry.url));
  // "stellar" and "unknown" have no Pokémon and no matchups; shadow is Colosseum-only.
  const types = details.filter((t) => t.pokemon.length > 0 && t.name !== "shadow");
  return types.map((t) => ({
    name: t.name,
    generation: GENERATION_NUMBERS.get(t.generation?.name) ?? 1,
    pokemon: t.pokemon.map((p) => ({ name: p.pokemon.name, slot: p.slot })),
    current: t.damage_relations,
    past: (t.past_damage_relations || [])
      .map((p) => ({ generation: GENERATION_NUMBERS.get(p.generation?.name), relations: p.damage_relations }))
      .filter((p) => p.generation != null)
      .sort((a, b) => a.generation - b.generation),
  }));
}

function buildTypeChart(types) {
  // past_damage_relations entries hold the full relation set that was in effect up to and
  // including that generation; the current relations apply after the last entry.
  const relationsFor = (type, generation) => {
    const past = type.past.find((p) => p.generation >= generation);
    return past ? past.relations : type.current;
  };
  const chartFor = (generation) => {
    const available = types.filter((t) => t.generation <= generation);
    const availableNames = new Set(available.map((t) => t.name));
    const chart = {};
    for (const attacker of available) {
      const rel = relationsFor(attacker, generation);
      const row = {};
      for (const t of rel.double_damage_to || []) if (availableNames.has(t.name)) row[t.name] = 2;
      for (const t of rel.half_damage_to || []) if (availableNames.has(t.name)) row[t.name] = 0.5;
      for (const t of rel.no_damage_to || []) if (availableNames.has(t.name)) row[t.name] = 0;
      chart[attacker.name] = row;
    }
    return { types: available.map((t) => t.name), chart };
  };
  const ranges = [];
  for (let gen = 1; gen <= MAX_GENERATION; gen++) {
    const current = chartFor(gen);
    const last = ranges[ranges.length - 1];
    if (last && JSON.stringify(last.types) === JSON.stringify(current.types) && JSON.stringify(last.chart) === JSON.stringify(current.chart)) {
      last.to = gen;
    } else {
      ranges.push({ from: gen, to: gen, ...current });
    }
  }
  ranges[ranges.length - 1].to = null; // latest chart applies to every newer generation too
  return { ranges };
}

async function buildPokemonIndex(types) {
  const list = await getJson(`${REST}/pokemon?limit=100000&offset=0`);
  const typesByName = new Map();
  for (const type of types) {
    for (const entry of type.pokemon) {
      const slots = typesByName.get(entry.name) || [];
      slots.push({ slot: entry.slot, type: type.name });
      typesByName.set(entry.name, slots);
    }
  }
  const data = await graphql(`{
    pokemon_v2_pokemon(order_by: {id: asc}) {
      id
      name
      pokemon_species_id
      pokemon_v2_pokemontypepasts(order_by: {slot: asc}) { generation_id slot pokemon_v2_type { name } }
      pokemon_v2_pokemonforms(where: {is_default: {_eq: true}}) { pokemon_v2_versiongroup { name } }
    }
  }`);
  const graphById = new Map(data.pokemon_v2_pokemon.map((p) => [p.id, p]));
  const defaultIdByName = new Map(
    list.results.map((entry) => [entry.name, idFromUrl(entry.url)]).filter(([, id]) => id < 10000)
  );
  // The GraphQL mirror lags behind REST for brand-new forms (e.g. Legends: Z-A Megas), so fall
  // back to the longest name prefix that matches a base species ("raichu-mega-x" -> "raichu").
  const speciesFromName = (name) => {
    const parts = name.split("-");
    while (parts.length > 1) {
      parts.pop();
      const id = defaultIdByName.get(parts.join("-"));
      if (id != null) return id;
    }
    // Species whose default form carries a suffix ("zygarde-50", "tatsugiri-curly").
    const first = name.split("-")[0];
    for (const [defaultName, id] of defaultIdByName) {
      if (defaultName.split("-")[0] === first) return id;
    }
    return null;
  };

  const pokemon = list.results.map((entry) => {
    const id = idFromUrl(entry.url);
    const graph = graphById.get(id);
    const typeSlots = (typesByName.get(entry.name) || []).sort((a, b) => a.slot - b.slot).map((s) => s.type);
    const speciesId = graph?.pokemon_species_id ?? (id < 10000 ? id : speciesFromName(entry.name));
    const record = { i: id, n: entry.name, s: speciesId, t: typeSlots };
    const pasts = graph?.pokemon_v2_pokemontypepasts || [];
    if (pasts.length > 0) {
      const byGeneration = new Map();
      for (const past of pasts) {
        const list = byGeneration.get(past.generation_id) || [];
        list.push(past.pokemon_v2_type.name);
        byGeneration.set(past.generation_id, list);
      }
      // [[lastGenerationInEffect, [types]], ...] sorted oldest first
      record.p = Array.from(byGeneration.entries()).sort((a, b) => a[0] - b[0]);
    }
    return record;
  });
  // Version group each alternate form was introduced in, so games can hide forms that didn't
  // exist yet (Mega Swampert in X/Y, Origin Dialga in BDSP, Z-A Megas in Sun/Moon, ...).
  const missingIntro = [];
  for (const record of pokemon) {
    if (record.i < 10000) continue;
    const intro = graphById.get(record.i)?.pokemon_v2_pokemonforms?.[0]?.pokemon_v2_versiongroup?.name;
    if (intro) record.v = intro;
    else missingIntro.push(record);
  }
  await mapLimit(missingIntro, 6, async (record) => {
    try {
      const details = await getJson(`${REST}/pokemon/${record.i}/`);
      const formUrl = details.forms?.[0]?.url;
      if (!formUrl) return;
      const form = await getJson(formUrl);
      if (form.version_group?.name) record.v = form.version_group.name;
    } catch (error) {
      console.warn(`  warning: no form data for ${record.n}: ${error.message}`);
    }
  });

  const missingTypes = pokemon.filter((p) => p.t.length === 0).map((p) => p.n);
  if (missingTypes.length > 0) {
    console.warn(`  warning: ${missingTypes.length} Pokémon have no types: ${missingTypes.slice(0, 10).join(", ")}`);
  }
  return { count: pokemon.length, pokemon };
}

async function buildPokedexes() {
  const result = {};
  const dexes = await mapLimit(POKEDEXES, 6, (name) => getJson(`${REST}/pokedex/${name}`));
  dexes.forEach((dex, index) => {
    const name = POKEDEXES[index];
    const entries = (dex.pokemon_entries || [])
      .map((e) => [e.entry_number, idFromUrl(e.pokemon_species.url)])
      .sort((a, b) => a[0] - b[0]);
    const contiguous = entries.every(([number], i) => number === entries[0][0] + i);
    result[name] = contiguous
      ? { start: entries[0]?.[0] ?? 1, species: entries.map(([, species]) => species) }
      : { entries };
  });
  return result;
}

async function buildMoves() {
  const data = await graphql(`{
    pokemon_v2_versiongroup(order_by: {order: asc}) { name order generation_id }
    pokemon_v2_move(order_by: {id: asc}) {
      id
      name
      power
      accuracy
      pp
      priority
      generation_id
      pokemon_v2_type { name }
      pokemon_v2_movedamageclass { name }
      pokemon_v2_movechanges { power accuracy pp pokemon_v2_type { name } pokemon_v2_versiongroup { name } }
    }
  }`);
  const versionGroups = {};
  for (const vg of data.pokemon_v2_versiongroup) {
    versionGroups[vg.name] = { order: vg.order, generation: vg.generation_id };
  }
  const moves = {};
  for (const move of data.pokemon_v2_move) {
    // Max/G-Max/Z-moves have id >= 10000 in PokeAPI; skip them.
    if (move.id >= 10000) continue;
    const record = {
      t: move.pokemon_v2_type?.name ?? null,
      p: move.power,
      a: move.accuracy,
      pp: move.pp,
      pr: move.priority,
      c: move.pokemon_v2_movedamageclass?.name ?? null,
      g: move.generation_id,
    };
    const changes = (move.pokemon_v2_movechanges || [])
      .map((change) => {
        const out = { vg: change.pokemon_v2_versiongroup?.name };
        if (change.power != null) out.p = change.power;
        if (change.accuracy != null) out.a = change.accuracy;
        if (change.pp != null) out.pp = change.pp;
        if (change.pokemon_v2_type?.name) out.t = change.pokemon_v2_type.name;
        return out;
      })
      .filter((change) => change.vg && Object.keys(change).length > 1)
      .sort((a, b) => (versionGroups[a.vg]?.order ?? 0) - (versionGroups[b.vg]?.order ?? 0));
    // Each change holds the values in effect *before* that version group.
    if (changes.length > 0) record.h = changes;
    moves[move.name] = record;
  }
  return { versionGroups, moves };
}

const fillEffectChance = (text, chance) =>
  String(text || "")
    .replace(/\$effect_chance/g, chance != null ? String(chance) : "")
    .replace(/\s+/g, " ")
    .trim();

async function buildMoveEffects() {
  const data = await graphql(`{
    pokemon_v2_move(order_by: {id: asc}, where: {id: {_lt: 10000}}) {
      name
      move_effect_chance
      pokemon_v2_moveeffect { pokemon_v2_moveeffecteffecttexts(where: {language_id: {_eq: 9}}) { short_effect } }
    }
  }`);
  const effects = {};
  for (const move of data.pokemon_v2_move) {
    const text = move.pokemon_v2_moveeffect?.pokemon_v2_moveeffecteffecttexts?.[0]?.short_effect;
    if (text) effects[move.name] = fillEffectChance(text, move.move_effect_chance);
  }
  return effects;
}

async function buildAbilities() {
  const data = await graphql(`{
    pokemon_v2_ability(order_by: {name: asc}, where: {is_main_series: {_eq: true}}) {
      id
      name
      generation_id
      pokemon_v2_abilityeffecttexts(where: {language_id: {_eq: 9}}) { short_effect }
      pokemon_v2_abilityflavortexts(where: {language_id: {_eq: 9}}, order_by: {version_group_id: desc}, limit: 1) { flavor_text }
      pokemon_v2_pokemonabilities(order_by: {pokemon_id: asc}) { pokemon_id is_hidden }
    }
  }`);
  return {
    abilities: data.pokemon_v2_ability.map((ability) => ({
      n: ability.name,
      g: ability.generation_id,
      e:
        ability.pokemon_v2_abilityeffecttexts?.[0]?.short_effect?.replace(/\s+/g, " ").trim() ||
        ability.pokemon_v2_abilityflavortexts?.[0]?.flavor_text?.replace(/\s+/g, " ").trim() ||
        null,
      // [pokemonId, isHidden ? 1 : 0]
      p: ability.pokemon_v2_pokemonabilities.map((entry) => [entry.pokemon_id, entry.is_hidden ? 1 : 0]),
    })),
  };
}

// PokeAPI has no flag for these groups; species lists from Bulbapedia.
const ULTRA_BEAST_SPECIES = [
  "nihilego", "buzzwole", "pheromosa", "xurkitree", "celesteela", "kartana", "guzzlord",
  "poipole", "naganadel", "stakataka", "blacephalon",
];
const PARADOX_SPECIES = [
  "great-tusk", "scream-tail", "brute-bonnet", "flutter-mane", "slither-wing", "sandy-shocks",
  "roaring-moon", "walking-wake", "gouging-fire", "raging-bolt", "iron-treads", "iron-bundle",
  "iron-hands", "iron-jugulis", "iron-moth", "iron-thorns", "iron-valiant", "iron-leaves",
  "iron-boulder", "iron-crown", "koraidon", "miraidon",
];

// Tag membership for every Pokémon/form name (forms inherit their species' flags), bundled
// into the app as src/data/species-flags.json and used for the Legendary/Mythical/... filters.
async function buildSpeciesFlags(indexPokemon) {
  const data = await graphql(`{
    pokemon_v2_pokemonspecies(order_by: {id: asc}) { id name is_legendary is_mythical is_baby }
  }`);
  const speciesById = new Map(data.pokemon_v2_pokemonspecies.map((s) => [s.id, s]));
  const ultraBeastIds = new Set(data.pokemon_v2_pokemonspecies.filter((s) => ULTRA_BEAST_SPECIES.includes(s.name)).map((s) => s.id));
  const paradoxIds = new Set(data.pokemon_v2_pokemonspecies.filter((s) => PARADOX_SPECIES.includes(s.name)).map((s) => s.id));
  const flags = { legendary: [], mythical: [], baby: [], ultraBeast: [], paradox: [] };
  for (const record of indexPokemon) {
    const species = speciesById.get(record.s);
    if (!species) continue;
    if (species.is_legendary) flags.legendary.push(record.n);
    if (species.is_mythical) flags.mythical.push(record.n);
    if (species.is_baby) flags.baby.push(record.n);
    if (ultraBeastIds.has(record.s)) flags.ultraBeast.push(record.n);
    if (paradoxIds.has(record.s)) flags.paradox.push(record.n);
  }
  return flags;
}

async function main() {
  console.log("Fetching types...");
  const types = await buildTypes();
  console.log("Building type chart...");
  await writeJson("type-chart.json", buildTypeChart(types));
  console.log("Building Pokémon index...");
  const pokemonIndex = await buildPokemonIndex(types);
  await writeJson("pokemon-index.json", pokemonIndex);
  console.log("Building species flags...");
  await writeJson("species-flags.json", await buildSpeciesFlags(pokemonIndex.pokemon), SRC_DATA_DIR);
  console.log("Fetching Pokédexes...");
  await writeJson("pokedexes.json", await buildPokedexes());
  console.log("Fetching moves...");
  await writeJson("moves.json", await buildMoves());
  await writeJson("move-effects.json", await buildMoveEffects());
  console.log("Fetching abilities...");
  await writeJson("abilities.json", await buildAbilities());
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
