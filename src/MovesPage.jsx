import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";
import { updatePokemonLocation } from "./utils/url.js";
import { getTypeIconUrl } from "./utils/typeIcons.js";
import { formatPokemonName } from "./utils/pokemonNames.js";
import { formatMoveName, getMoveGroupKey, titleCaseSlug } from "./utils/moveNames.js";
import {
  getMoveForVersionGroup,
  loadMoveData,
  loadMoveEffects,
  loadPokemonList,
} from "./data/staticData.js";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const LEARNERS_PAGE_SIZE = 60;
const MAX_FLAVOR_ENTRIES = 6;

const MOVE_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
];
const DAMAGE_CLASSES = ["physical", "special", "status"];

/* ---------------------------------------------------------------- Names */

const formatTypeName = (type) => (type === "unknown" ? "???" : titleCaseSlug(type));

// formatPokemonName drops Mega/Gigantamax tokens because Pokédex cards tag them; spell them out here.
const FORM_PREFIX_TOKENS = new Map([
  ["mega", "Mega"],
  ["gmax", "Gigantamax"],
  ["primal", "Primal"],
]);
const formatLearnerName = (slug) => {
  const tokens = String(slug || "").toLowerCase().split("-");
  const prefixes = tokens.filter((token) => FORM_PREFIX_TOKENS.has(token)).map((token) => FORM_PREFIX_TOKENS.get(token));
  const base = formatPokemonName(tokens.filter((token) => !FORM_PREFIX_TOKENS.has(token)).join("-"));
  return prefixes.length > 0 ? `${prefixes.join(" ")} ${base}` : base;
};

const toSearchKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const VERSION_GROUP_LABELS = new Map([
  ["red-green-japan", "Red / Green (JP)"],
  ["blue-japan", "Blue (JP)"],
  ["red-blue", "Red / Blue"],
  ["gold-silver", "Gold / Silver"],
  ["ruby-sapphire", "Ruby / Sapphire"],
  ["xd", "XD"],
  ["firered-leafgreen", "FireRed / LeafGreen"],
  ["diamond-pearl", "Diamond / Pearl"],
  ["heartgold-soulsilver", "HeartGold / SoulSilver"],
  ["black-white", "Black / White"],
  ["black-2-white-2", "Black 2 / White 2"],
  ["x-y", "X / Y"],
  ["omega-ruby-alpha-sapphire", "Omega Ruby / Alpha Sapphire"],
  ["sun-moon", "Sun / Moon"],
  ["ultra-sun-ultra-moon", "Ultra Sun / Ultra Moon"],
  ["lets-go-pikachu-lets-go-eevee", "Let’s Go, Pikachu! / Let’s Go, Eevee!"],
  ["sword-shield", "Sword / Shield"],
  ["brilliant-diamond-and-shining-pearl", "Brilliant Diamond / Shining Pearl"],
  ["legends-arceus", "Legends: Arceus"],
  ["scarlet-violet", "Scarlet / Violet"],
  ["legends-za", "Legends: Z-A"],
]);
const formatVersionGroup = (name) => VERSION_GROUP_LABELS.get(name) ?? titleCaseSlug(name);

const formatGenerationRange = (from, to) => (from === to ? `Gen ${from}` : `Gen ${from}–${to}`);
const formatAccuracy = (value) => (value == null ? "—" : `${value}%`);
const formatPriority = (value) => (value > 0 ? `+${value}` : String(value ?? 0));

const hideBrokenImage = (event) => {
  event.currentTarget.style.display = "none";
};
const hideBrokenSprite = (event) => {
  event.currentTarget.style.visibility = "hidden";
};

const readSearchParam = (key) => new URLSearchParams(window.location.search).get(key);

/* ---------------------------------------------------------------- Data hooks */

/** Resolves one of the cached static-data loaders (`null` = don't load yet). */
function useStaticResource(loader) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    if (!loader) return undefined;
    let cancelled = false;
    loader().then(
      (data) => {
        if (!cancelled) setState({ data, error: null });
      },
      (error) => {
        if (!cancelled) setState((previous) => (previous.data ? previous : { data: null, error }));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [loader]);
  return state;
}

// `/move/{name}` responses (flavor text, full effect, learners), shared by the detail and learners panels.
// Concurrent callers share one in-flight request; failures are evicted so a later visit retries.
const moveDetailCache = new Map(); // name -> { promise, data }

function fetchMoveDetail(name) {
  let entry = moveDetailCache.get(name);
  if (!entry) {
    entry = { promise: null, data: null };
    const cacheEntry = entry;
    cacheEntry.promise = fetch(`${POKEAPI_BASE}/move/${encodeURIComponent(name)}/`)
      .then((response) => {
        if (!response.ok) throw new Error(`PokeAPI responded with ${response.status}`);
        return response.json();
      })
      .then((data) => {
        cacheEntry.data = data;
        return data;
      })
      .catch((error) => {
        moveDetailCache.delete(name);
        throw error;
      });
    moveDetailCache.set(name, cacheEntry);
  }
  return entry.promise;
}

const IDLE_DETAIL = { data: null, loading: false, error: null };

function useMoveDetail(name) {
  const [result, setResult] = useState({ name: null, data: null, error: null });
  useEffect(() => {
    if (!name) return undefined;
    let cancelled = false;
    fetchMoveDetail(name).then(
      (data) => {
        if (!cancelled) setResult({ name, data, error: null });
      },
      (error) => {
        if (!cancelled) setResult({ name, data: null, error });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [name]);
  if (!name) return IDLE_DETAIL;
  if (result.name === name) return { data: result.data, loading: false, error: result.error };
  const cached = moveDetailCache.get(name)?.data;
  if (cached) return { data: cached, loading: false, error: null };
  return { data: null, loading: true, error: null };
}

/* ---------------------------------------------------------------- Move text helpers */

const cleanGameText = (text) =>
  String(text || "")
    .replace(/\xad\s*/g, "") // soft hyphens from line-wrapped game text
    // PokeAPI markup such as "[HP]{mechanic:hp}" or "[]{move:protect}"
    .replace(/\[([^\]]*)\]\{[^}:]*:([^}]*)\}/g, (_, label, slug) => label || titleCaseSlug(slug))
    .replace(/\s+/g, " ")
    .trim();

/** Full English effect text from a `/move/{name}` response (paragraphs kept, effect chance filled in). */
const getEnglishEffect = (data) => {
  const entries = Array.isArray(data?.effect_entries) ? data.effect_entries : [];
  const entry = entries.find((e) => e?.language?.name === "en");
  const text = entry?.effect || entry?.short_effect || "";
  return data?.effect_chance != null
    ? text.replace(/\$effect_chance/g, String(data.effect_chance))
    : text.replace(/\$effect_chance%?\s*/g, "");
};

// Compares sentences while ignoring numbers, so "Has a chance to burn" matches "Has a 10% chance to burn".
const looseTextKey = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/\$effect_chance|[\d%]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();

/** Splits the full effect into list lines (paragraphs, "* " bullets, sentences), minus lines repeating the summary. */
const toEffectLines = (text, summary) => {
  const summaryKey = looseTextKey(summary);
  return String(text || "")
    .split(/\n+/)
    .map((paragraph) => cleanGameText(paragraph).replace(/^\*\s*/, ""))
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9(“"])/))
    .map((line) => line.trim())
    .filter((line) => line && looseTextKey(line) !== summaryKey);
};

const mentionsStatStages = (text) => {
  const lower = String(text || "").toLowerCase();
  return /\bstages?\b/.test(lower) && /(raise|boost|increase|lower|decrease|drop|sharply|harshly)/.test(lower);
};

const versionGroupIdFromUrl = (url) => Number(String(url || "").split("/").filter(Boolean).pop()) || 0;

/** English flavor text, newest game first, with consecutive identical texts merged into one row. */
function groupFlavorText(entries, versionGroups) {
  // Groups newer than the snapshot aren't in `versionGroups`; their PokeAPI ids still sort them last.
  const orderOf = (group) => versionGroups?.[group.name]?.order ?? 1000 + versionGroupIdFromUrl(group.url);
  const english = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.language?.name === "en" && entry.version_group?.name)
    .map((entry) => ({
      group: entry.version_group.name,
      order: orderOf(entry.version_group),
      text: cleanGameText(entry.flavor_text || entry.text),
    }))
    .filter((entry) => entry.text)
    .sort((a, b) => b.order - a.order);
  const grouped = [];
  for (const entry of english) {
    const last = grouped[grouped.length - 1];
    if (last && last.text === entry.text) last.oldest = entry.group;
    else grouped.push({ newest: entry.group, oldest: entry.group, text: entry.text });
  }
  return grouped.slice(0, MAX_FLAVOR_ENTRIES);
}

/* ---------------------------------------------------------------- Change history */

// Spin-offs and Japan-only releases: listed only when their values differ from their generation's main games.
const SIDE_VERSION_GROUPS = new Set([
  "red-green-japan",
  "blue-japan",
  "colosseum",
  "xd",
  "lets-go-pikachu-lets-go-eevee",
  "legends-arceus",
]);
const HISTORY_FIELDS = ["type", "damage_class", "power", "accuracy", "pp"];
const sameHistoryStats = (a, b) => HISTORY_FIELDS.every((field) => a?.[field] === b?.[field]);

/**
 * Rows of `{ fromGen, toGen, games, stats }` describing how a move's type, category, power, accuracy and
 * PP changed between games (consecutive generations with equal values are merged), or `null` if it never changed.
 * Generations whose main games disagree (e.g. Hypnosis in Diamond/Pearl vs. Platinum) get one row per game set.
 */
function buildMoveHistory(moveData, moveName) {
  const move = moveData?.moves?.[moveName];
  if (!move) return null;
  const introduced = move.g ?? 1;
  const mainGroupsByGeneration = new Map();
  const sideGroups = [];
  const orderedGroups = Object.entries(moveData.versionGroups || {})
    .filter(([, info]) => info.generation >= introduced)
    .sort((a, b) => a[1].order - b[1].order);
  for (const [group, info] of orderedGroups) {
    if (SIDE_VERSION_GROUPS.has(group)) {
      sideGroups.push([group, info.generation]);
    } else {
      if (!mainGroupsByGeneration.has(info.generation)) mainGroupsByGeneration.set(info.generation, []);
      mainGroupsByGeneration.get(info.generation).push(group);
    }
  }

  const rows = [];
  const generationStats = new Map();
  for (const [generation, groups] of mainGroupsByGeneration) {
    const runs = [];
    for (const group of groups) {
      const stats = getMoveForVersionGroup(moveData, moveName, group);
      const last = runs[runs.length - 1];
      if (last && sameHistoryStats(last.stats, stats)) last.games.push(group);
      else runs.push({ games: [group], stats });
    }
    if (runs.length === 1) {
      generationStats.set(generation, runs[0].stats);
      const previous = rows[rows.length - 1];
      if (
        previous &&
        !previous.games &&
        previous.toGen === generation - 1 &&
        sameHistoryStats(previous.stats, runs[0].stats)
      ) {
        previous.toGen = generation;
      } else {
        rows.push({ fromGen: generation, toGen: generation, games: null, stats: runs[0].stats });
      }
    } else {
      for (const run of runs) rows.push({ fromGen: generation, toGen: generation, games: run.games, stats: run.stats });
    }
  }

  for (const [group, generation] of sideGroups) {
    const mainStats = generationStats.get(generation);
    const stats = getMoveForVersionGroup(moveData, moveName, group);
    if (!mainStats || sameHistoryStats(mainStats, stats)) continue;
    // Insert after the last row covering that generation.
    let index = rows.length - 1;
    while (index >= 0 && !(rows[index].fromGen <= generation && generation <= rows[index].toGen)) index -= 1;
    rows.splice(index + 1, 0, { fromGen: generation, toGen: generation, games: [group], stats });
  }

  if (rows.length < 2) return null;
  const fields = HISTORY_FIELDS.filter((field) => rows.some((row) => row.stats[field] !== rows[0].stats[field]));
  if (fields.length === 0) return null;
  const categoryFromType = fields.includes("damage_class") && move.c !== "status" && introduced <= 3;
  return { rows, fields, categoryFromType };
}

/* ---------------------------------------------------------------- Small pieces */

function TypeChip({ type }) {
  return (
    <span className={`type-chip type-${type}`}>
      {type !== "unknown" ? (
        <img src={getTypeIconUrl(type)} alt="" className="type-icon" loading="lazy" onError={hideBrokenImage} />
      ) : null}
      <span className="type-name">{formatTypeName(type)}</span>
    </span>
  );
}

function CategoryChip({ category }) {
  return (
    <span className={category ? `move-category-chip move-category-${category}` : "move-category-chip"}>
      {category ? (
        <img className="move-meta-icon" src={`/move-categories/${category}.png`} alt="" aria-hidden="true" loading="lazy" />
      ) : null}
      {category ? titleCaseSlug(category) : "Unknown"}
    </span>
  );
}

function HistoryValue({ field, value }) {
  if (field === "type") return value ? <TypeChip type={value} /> : <span className="move-stat-chip">Type: —</span>;
  if (field === "damage_class") return <CategoryChip category={value} />;
  if (field === "power") return <span className="move-stat-chip">Power: {value ?? "—"}</span>;
  if (field === "accuracy") return <span className="move-stat-chip">Accuracy: {formatAccuracy(value)}</span>;
  return <span className="move-stat-chip">PP: {value ?? "—"}</span>;
}

function StageInfoPanel() {
  return (
    <div className="effect-window stage-info-panel">
      <div className="stage-info-header">
        <h3 className="stage-info-title">Understanding Stat Stages</h3>
        <p className="stage-info-intro">
          When moves mention &ldquo;stages,&rdquo; they&rsquo;re referring to in-battle stat modifiers. Each stat&rsquo;s
          stage ranges from <strong>−6</strong> (lowest) to <strong>+6</strong> (highest), and stages reset when the
          Pokémon switches out.
        </p>
      </div>

      <div className="stage-info-section">
        <h4 className="stage-info-subtitle">Battle Stats</h4>
        <p className="stage-info-description">Attack, Defense, Special Attack, Special Defense, and Speed:</p>
        <div className="stage-info-chips">
          <div className="stage-info-chip-group">
            <span className="stage-info-label">Boosts:</span>
            <div className="stage-info-chip-row">
              <span className="move-stat-chip positive">+1 stage = 1.5×</span>
              <span className="move-stat-chip positive">+2 stages = 2×</span>
              <span className="move-stat-chip positive">+6 stages = 4×</span>
            </div>
          </div>
          <div className="stage-info-chip-group">
            <span className="stage-info-label">Drops:</span>
            <div className="stage-info-chip-row">
              <span className="move-stat-chip negative">−1 stage = 0.67×</span>
              <span className="move-stat-chip negative">−2 stages = 0.5×</span>
              <span className="move-stat-chip negative">−6 stages = 0.25×</span>
            </div>
          </div>
        </div>
      </div>

      <div className="stage-info-section">
        <h4 className="stage-info-subtitle">Accuracy &amp; Evasion</h4>
        <p className="stage-info-description">
          These also go from −6 to +6 but use a gentler scale. The user&rsquo;s accuracy stage minus the target&rsquo;s
          evasion stage (capped at ±6) multiplies the move&rsquo;s accuracy:
        </p>
        <div className="stage-info-chips">
          <div className="stage-info-chip-group">
            <span className="stage-info-label">Boosts:</span>
            <div className="stage-info-chip-row">
              <span className="move-stat-chip positive">+1 stage = 1.33×</span>
              <span className="move-stat-chip positive">+2 stages = 1.67×</span>
              <span className="move-stat-chip positive">+6 stages = 3×</span>
            </div>
          </div>
          <div className="stage-info-chip-group">
            <span className="stage-info-label">Drops:</span>
            <div className="stage-info-chip-row">
              <span className="move-stat-chip negative">−1 stage = 0.75×</span>
              <span className="move-stat-chip negative">−2 stages = 0.6×</span>
              <span className="move-stat-chip negative">−6 stages = 0.33×</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Page */

export default function MovesPage() {
  const moveData = useStaticResource(loadMoveData);
  const moveEffects = useStaticResource(loadMoveEffects);
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState(null);
  const [selectedDamageClass, setSelectedDamageClass] = useState(null); // 'physical' | 'special' | 'status'
  const [priorityOnly, setPriorityOnly] = useState(false); // true => priority > 0
  const [selectedName, setSelectedName] = useState(() => readSearchParam("m"));

  useEffect(() => {
    // The Moves page only carries its own `?m=` param.
    const url = new URL(window.location.href);
    const foreignKeys = ["p", "i", "a"].filter((key) => url.searchParams.has(key));
    if (foreignKeys.length > 0) {
      foreignKeys.forEach((key) => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, "", url);
    }
    // Back/forward and in-app navigation update the selection from the URL.
    const syncFromUrl = () => setSelectedName(readSearchParam("m"));
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("locationchange", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("locationchange", syncFromUrl);
    };
  }, []);

  const allMoves = useMemo(() => {
    const data = moveData.data;
    if (!data?.moves) return [];
    return Object.keys(data.moves)
      .map((name) => ({
        ...getMoveForVersionGroup(data, name, null),
        searchKey: `${toSearchKey(name)} ${toSearchKey(formatMoveName(name))}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [moveData.data]);

  const movesByName = useMemo(() => new Map(allMoves.map((move) => [move.name, move])), [allMoves]);
  const selectedMove = (selectedName && movesByName.get(selectedName)) || null;
  const selectedGroupKey = selectedMove ? getMoveGroupKey(selectedMove.name) : null;

  const groups = useMemo(() => {
    const search = toSearchKey(query);
    const byKey = new Map();
    for (const move of allMoves) {
      if (selectedType && move.type !== selectedType) continue;
      if (selectedDamageClass && move.damage_class !== selectedDamageClass) continue;
      if (priorityOnly && !(move.priority > 0)) continue;
      if (search && !move.searchKey.includes(search)) continue;
      const key = getMoveGroupKey(move.name);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(move);
    }
    return Array.from(byKey, ([key, variants]) => ({
      key,
      // Prefer the plain move; Z-moves only have "--physical"/"--special" variants.
      primary: variants.find((variant) => !variant.name.includes("--")) ?? variants[0],
    })).sort((a, b) => a.key.localeCompare(b.key));
  }, [allMoves, query, selectedType, selectedDamageClass, priorityOnly]);

  const variantsForSelected = useMemo(
    () => (selectedGroupKey ? allMoves.filter((move) => getMoveGroupKey(move.name) === selectedGroupKey) : []),
    [allMoves, selectedGroupKey]
  );

  const detail = useMoveDetail(selectedMove ? selectedMove.name : null);
  const pokemonList = useStaticResource(selectedMove ? loadPokemonList : null);
  const pokemonById = useMemo(
    () => new Map((pokemonList.data || []).filter((pokemon) => pokemon.id != null).map((pokemon) => [pokemon.id, pokemon])),
    [pokemonList.data]
  );

  const selectMove = useCallback((name) => {
    const url = new URL(window.location.href);
    ["p", "i", "a"].forEach((key) => url.searchParams.delete(key));
    if (url.searchParams.get("m") !== name) {
      url.searchParams.set("m", name);
      window.history.pushState({}, "", url);
    }
    setSelectedName(name);
  }, []);

  const resetFilters = () => {
    setQuery("");
    setSelectedType(null);
    setSelectedDamageClass(null);
    setPriorityOnly(false);
  };

  const loading = !moveData.data && !moveData.error;

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
      <header className="app-header">
        <div className="container">
          <h1 className="title">Moves</h1>
          <p className="subtitle">Search and explore all Pokemon moves</p>
          <CategoryToggle />
          <div className="search-row">
            <input
              className="search"
              placeholder="Search Moves"
              aria-label="Search moves"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="reset-button" onClick={resetFilters}>
              Reset
            </button>
          </div>
          <div className="filters-desktop">
            <div className="filters-row moves-filters">
              {/* Type group */}
              <div className="filter-box-wrap">
                <div className="filter-box-title">Type</div>
                <div className="filter-box type-filters">
                  <button
                    type="button"
                    className={`neutral-chip${selectedType == null ? " is-on" : ""}`}
                    aria-pressed={selectedType == null}
                    onClick={() => setSelectedType(null)}
                  >
                    All
                  </button>
                  {MOVE_TYPES.map((t) => {
                    const isOn = selectedType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`type-chip type-${t}${isOn ? " is-on" : ""}`}
                        aria-pressed={isOn}
                        onClick={() => setSelectedType(isOn ? null : t)}
                      >
                        <img src={getTypeIconUrl(t)} alt="" className="type-icon" loading="lazy" onError={hideBrokenImage} />
                        <span className="type-name">{t}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category group */}
              <div className="filter-box-wrap">
                <div className="filter-box-title">Category</div>
                <div className="filter-box special-filters">
                  {DAMAGE_CLASSES.map((c) => {
                    const isOn = selectedDamageClass === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`special-filter-chip${isOn ? " is-on" : ""}`}
                        aria-pressed={isOn}
                        onClick={() => setSelectedDamageClass(isOn ? null : c)}
                      >
                        {c}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`special-filter-chip${priorityOnly ? " is-on" : ""}`}
                    aria-pressed={priorityOnly}
                    title="Moves with increased priority (+1 or higher)"
                    onClick={() => setPriorityOnly((v) => !v)}
                  >
                    priority
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="container">
        {moveData.error ? (
          <div className="list-empty">Failed to load moves.</div>
        ) : loading ? (
          <div className="list-empty">Loading moves…</div>
        ) : groups.length === 0 ? (
          <div className="list-empty">No moves found.</div>
        ) : (
          <section className="content split">
            <div className="list-panel">
              <div className="list-scroll">
                <div className="list items-list">
                  {groups.map(({ key, primary }) => {
                    const isSelected = selectedGroupKey === key;
                    const type = primary.type;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`item-row${isSelected ? " is-selected" : ""}${type ? ` move-type-${type}` : ""}`}
                        onClick={() => selectMove(primary.name)}
                        aria-pressed={isSelected}
                      >
                        {type ? (
                          <img
                            src={getTypeIconUrl(type)}
                            alt=""
                            className="type-icon type-icon-bg"
                            loading="lazy"
                            aria-hidden="true"
                            onError={hideBrokenImage}
                          />
                        ) : null}
                        <span className="item-name proper-name">{formatMoveName(key)}</span>
                        {type ? (
                          <img
                            src={getTypeIconUrl(type)}
                            alt={type}
                            className="type-icon item-type-icon"
                            loading="lazy"
                            onError={hideBrokenImage}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <aside className="detail-panel">
              <div className="detail-inner moves-detail-inner">
                <MoveDetailPanel
                  move={selectedMove}
                  moveData={moveData.data}
                  shortEffect={selectedMove ? moveEffects.data?.[selectedMove.name] || "" : ""}
                  detail={detail}
                  variants={variantsForSelected}
                  onSelectVariant={selectMove}
                />
                <MoveLearnersPanel
                  key={selectedMove?.name || "none"}
                  move={selectedMove}
                  detail={detail}
                  pokemonById={pokemonById}
                  pokemonListPending={!pokemonList.data && !pokemonList.error}
                />
              </div>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}

function MoveDetailPanel({ move, moveData, shortEffect, detail, variants, onSelectVariant }) {
  const longEffect = useMemo(() => getEnglishEffect(detail.data), [detail.data]);
  const effectLines = useMemo(() => toEffectLines(longEffect, shortEffect), [longEffect, shortEffect]);
  const showStageInfo = useMemo(() => mentionsStatStages(`${shortEffect} ${longEffect}`), [shortEffect, longEffect]);
  const history = useMemo(() => (move ? buildMoveHistory(moveData, move.name) : null), [moveData, move]);
  const flavorEntries = useMemo(
    () => groupFlavorText(detail.data?.flavor_text_entries, moveData?.versionGroups),
    [detail.data, moveData]
  );

  if (!move) {
    return (
      <div className="move-detail-frame">
        <div className="detail-title detail-title-top" style={{ display: "none" }} />
        <div className="move-hero-container" style={{ display: "none" }}>
          <div className="detail-hero single-col" />
        </div>
      </div>
    );
  }

  const otherVariants = variants.filter((variant) => variant.name !== move.name);

  return (
    <div className="move-detail-frame">
      <div className="detail-title detail-title-top">
        <h2 className="proper-name">{formatMoveName(move.name)}</h2>
      </div>
      <div className="move-hero-container">
        <div className="detail-hero single-col">
          <div className="hero-right">
            <div className="main-col">
              <section className="about">
                <h3 className="list-subheading" style={{ textAlign: "left" }}>Overview</h3>
                <div className="about-list" style={{ padding: 0 }}>
                  <div className="about-row">
                    <div className="label">Type</div>
                    <div className="value">{move.type ? <TypeChip type={move.type} /> : <span>Unknown</span>}</div>
                  </div>

                  <div className="about-row">
                    <div className="label">Category</div>
                    <div className="value">
                      <CategoryChip category={move.damage_class} />
                    </div>
                  </div>

                  <div className="about-row">
                    <div className="label">Stats</div>
                    <div className="value move-stats-group">
                      <span className="move-stat-chip">Power: {move.power ?? "—"}</span>
                      <span className="move-stat-chip">Accuracy: {formatAccuracy(move.accuracy)}</span>
                      <span className="move-stat-chip">PP: {move.pp ?? "—"}</span>
                      <span className="move-stat-chip">Priority: {formatPriority(move.priority)}</span>
                    </div>
                  </div>

                  {move.generation ? (
                    <div className="about-row">
                      <div className="label">Introduced</div>
                      <div className="value">Gen {move.generation}</div>
                    </div>
                  ) : null}
                </div>
                {otherVariants.length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <h3 className="list-subheading" style={{ textAlign: "left" }}>Alternate Forms</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {otherVariants.map((variant) => (
                        <button
                          key={variant.name}
                          type="button"
                          className="neutral-chip"
                          onClick={() => onSelectVariant(variant.name)}
                        >
                          {formatMoveName(variant.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              {shortEffect || effectLines.length > 0 ? (
                <div className="effect-window">
                  {shortEffect ? <div className="effect-summary">{shortEffect}</div> : null}
                  {effectLines.length > 0 ? (
                    <ul className="effect-list">
                      {effectLines.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {showStageInfo ? <StageInfoPanel /> : null}

              {history ? (
                <section className="about">
                  <h3 className="list-subheading" style={{ textAlign: "left" }}>Changes by Generation</h3>
                  <div className="about-list" style={{ padding: 0 }}>
                    {history.rows.map((row, idx) => (
                      <div className="about-row" key={idx}>
                        <div className="label">
                          {formatGenerationRange(row.fromGen, row.toGen)}
                          {row.games ? (
                            <span className="move-history-games">{row.games.map(formatVersionGroup).join(", ")}</span>
                          ) : null}
                        </div>
                        <div className="value">
                          {history.fields.map((field) => (
                            <HistoryValue key={field} field={field} value={row.stats[field]} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {history.categoryFromType ? (
                    <p className="move-history-note">
                      Before Gen 4, a damaging move&rsquo;s category came from its type rather than the move itself.
                    </p>
                  ) : null}
                </section>
              ) : null}

              {detail.loading ? (
                <p className="moves-inline-status">Loading game descriptions…</p>
              ) : detail.error ? (
                <p className="moves-inline-status">Couldn&rsquo;t load game descriptions from PokeAPI.</p>
              ) : flavorEntries.length > 0 ? (
                <section className="about">
                  <div className="flavor-window">
                    {flavorEntries.map((entry) => (
                      <div key={entry.newest} className="flavor-row">
                        <div className="flavor-meta">
                          {entry.oldest === entry.newest
                            ? formatVersionGroup(entry.newest)
                            : `${formatVersionGroup(entry.oldest)} – ${formatVersionGroup(entry.newest)}`}
                        </div>
                        <div className="flavor-text">{entry.text}</div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const goToPokemon = (slug) => {
  if (slug) updatePokemonLocation(slug, { pruneKeys: ["i", "m", "a", "p"] });
};

function MoveLearnersPanel({ move, detail, pokemonById, pokemonListPending }) {
  const [visibleCount, setVisibleCount] = useState(LEARNERS_PAGE_SIZE);

  const learners = useMemo(() => {
    const list = Array.isArray(detail.data?.learned_by_pokemon) ? detail.data.learned_by_pokemon : [];
    const byId = new Map();
    for (const entry of list) {
      const id = Number(String(entry?.url || "").split("/").filter(Boolean).pop());
      if (!id || byId.has(id)) continue;
      const known = pokemonById.get(id);
      byId.set(id, {
        id,
        slug: known?.name || entry.name,
        speciesId: known?.speciesId ?? id,
        types: known?.types || [],
      });
    }
    // National Dex order, with each species' forms right after it.
    return [...byId.values()].sort((a, b) => a.speciesId - b.speciesId || a.id - b.id);
  }, [detail.data, pokemonById]);

  if (!move) {
    return <aside className="learners-panel" style={{ display: "none" }} />;
  }

  const loading = detail.loading || (pokemonListPending && learners.length > 0);
  const visible = learners.slice(0, visibleCount);
  const remaining = learners.length - visible.length;

  return (
    <aside className="learners-panel">
      <h4 className="learners-title">
        Learnt By
        {!loading && learners.length > 0 ? (
          <span className="learners-count">({learners.length.toLocaleString()})</span>
        ) : null}
      </h4>
      {loading ? (
        <div className="learners-empty">Loading</div>
      ) : detail.error ? (
        <div className="learners-empty">Failed to load</div>
      ) : learners.length === 0 ? (
        <div className="learners-empty">No Pokémon learn this move</div>
      ) : (
        <ul className="learners-list" role="list">
          {visible.map((pokemon) => {
            const name = formatLearnerName(pokemon.slug);
            return (
              <li key={pokemon.id}>
                <button
                  type="button"
                  className="learners-poke-button"
                  onClick={() => goToPokemon(pokemon.slug)}
                  title={`Open ${name}`}
                >
                  <img
                    className="learners-poke-sprite"
                    src={`${SPRITE_BASE}/${pokemon.id}.png`}
                    alt=""
                    loading="lazy"
                    onError={hideBrokenSprite}
                  />
                  <span className="label proper-name">{name}</span>
                  <span className="types-vertical">
                    {pokemon.types.map((t) => (
                      <span key={t} className={`type-chip type-${t}`}>
                        <img src={getTypeIconUrl(t)} alt={t} className="type-icon" loading="lazy" onError={hideBrokenImage} />
                        <span className="type-name">{t}</span>
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
          {remaining > 0 ? (
            <li className="learners-more">
              <button
                type="button"
                className="neutral-chip learners-more-button"
                onClick={() => setVisibleCount((count) => count + LEARNERS_PAGE_SIZE)}
              >
                Show {Math.min(LEARNERS_PAGE_SIZE, remaining)} more ({remaining.toLocaleString()} left)
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </aside>
  );
}
