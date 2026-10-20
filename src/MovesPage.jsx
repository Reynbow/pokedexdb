import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon, { Cursor } from "./components/Icon.jsx";
import Sheet from "./components/Sheet.jsx";
import { TypeTag } from "./pokedex/EntryParts.jsx";
import { buildPokemonPath, updatePokemonLocation } from "./utils/url.js";
import { getTypeIconUrl } from "./utils/typeIcons.js";
import { formatPokemonName } from "./utils/pokemonNames.js";
import { formatMoveName, getMoveGroupKey, titleCaseSlug } from "./utils/moveNames.js";
import {
  getMoveForVersionGroup,
  loadMoveData,
  loadMoveEffects,
  loadPokemonList,
} from "./data/staticData.js";
import "./styles/pages/moves.css";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const LEARNERS_PAGE_SIZE = 60;
const MAX_FLAVOR_ENTRIES = 6;

const MOVE_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
];
const DAMAGE_CLASSES = ["physical", "special", "status"];
const CATEGORY_LABELS = { physical: "Physical", special: "Special", status: "Status" };

// Same breakpoint as the shell and Sheet: below it the list and the open move take turns.
const PHONE_QUERY = "(max-width: 900px)";
const isPhoneLayout = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(PHONE_QUERY).matches);

// History entries this page pushes remember how many steps back the plain list is.
const BACK_STATE_KEY = "mvBack";

const isPlainLeftClick = (event) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/* ---------------------------------------------------------------- Names */

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
const formatPriority = (value) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0");
const formatMoveNo = (value) => (value ? String(value).padStart(3, "0") : "—");

const hideBrokenImage = (event) => {
  event.currentTarget.style.display = "none";
};
const hideBrokenSprite = (event) => {
  event.currentTarget.style.visibility = "hidden";
};

const readSearchParam = (key) => new URLSearchParams(window.location.search).get(key);
const moveHref = (name) => `?m=${encodeURIComponent(name)}`;

/* ---------------------------------------------------------------- Data hooks */

/** Resolves one of the cached static-data loaders (`null` = don't load yet). Bump `attempt` to retry. */
function useStaticResource(loader, attempt = 0) {
  const [state, setState] = useState({ data: null, error: null, attempt });
  useEffect(() => {
    if (!loader) return undefined;
    let cancelled = false;
    loader().then(
      (data) => {
        if (!cancelled) setState({ data, error: null, attempt });
      },
      (error) => {
        if (!cancelled) setState((previous) => (previous.data ? previous : { data: null, error, attempt }));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [loader, attempt]);
  // A retry in flight reads as loading, not as the previous failure.
  return state.error && state.attempt !== attempt ? { data: null, error: null, attempt } : state;
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

function useMoveDetail(name, attempt = 0) {
  const [result, setResult] = useState({ name: null, attempt: 0, data: null, error: null });
  useEffect(() => {
    if (!name) return undefined;
    let cancelled = false;
    fetchMoveDetail(name).then(
      (data) => {
        if (!cancelled) setResult({ name, attempt, data, error: null });
      },
      (error) => {
        if (!cancelled) setResult({ name, attempt, data: null, error });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [name, attempt]);
  if (!name) return IDLE_DETAIL;
  if (result.name === name && result.attempt === attempt) return { data: result.data, loading: false, error: result.error };
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
const HISTORY_LABELS = { type: "Type", damage_class: "Category", power: "Power", accuracy: "Accuracy", pp: "PP" };
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

/** A type tag; Curse's old "???" type gets the neutral tag. */
function MoveType({ type, size = "", icon = false }) {
  if (!type) return <span className="mv-none">—</span>;
  if (type === "unknown") {
    return <span className={`tag t-unknown${size ? ` tag--${size}` : ""}`}>???</span>;
  }
  return <TypeTag typeName={type} size={size} icon={icon} />;
}

function CategoryIcon({ category }) {
  if (!category) return null;
  return (
    <img
      className="mv-cat__icon"
      src={`/move-categories/${category}.png`}
      alt={CATEGORY_LABELS[category] || titleCaseSlug(category)}
      title={CATEGORY_LABELS[category] || titleCaseSlug(category)}
      width="20"
      height="16"
      loading="lazy"
      decoding="async"
      onError={hideBrokenImage}
    />
  );
}

function CategoryChip({ category }) {
  return (
    <span className="mv-cat">
      {category ? (
        <img
          className="mv-cat__icon"
          src={`/move-categories/${category}.png`}
          alt=""
          width="20"
          height="16"
          loading="lazy"
          decoding="async"
          onError={hideBrokenImage}
        />
      ) : null}
      {category ? CATEGORY_LABELS[category] || titleCaseSlug(category) : "Unknown"}
    </span>
  );
}

function HistoryValue({ field, value }) {
  if (field === "type") return <MoveType type={value} />;
  if (field === "damage_class") return <CategoryChip category={value} />;
  if (field === "power") return <span className="mv-num">{value ?? "—"}</span>;
  if (field === "accuracy") return <span className="mv-num">{formatAccuracy(value)}</span>;
  return <span className="mv-num">{value ?? "—"}</span>;
}

/** Type picker: every type as a tag, one at a time (picking the current one clears it). */
function TypeGrid({ selected, onPick }) {
  return (
    <div className="mv-types" role="group" aria-label="Type">
      <button type="button" className="btn btn--sm mv-types__all" aria-pressed={selected == null} onClick={() => onPick(null)}>
        All types
      </button>
      {MOVE_TYPES.map((type) => {
        const on = selected === type;
        return (
          <button
            key={type}
            type="button"
            className={`tag t-${type} mv-type${on ? "" : " tag--off"}`}
            aria-pressed={on}
            onClick={() => onPick(on ? null : type)}
          >
            <img src={getTypeIconUrl(type)} alt="" loading="lazy" decoding="async" onError={hideBrokenImage} />
            {type}
          </button>
        );
      })}
    </div>
  );
}

function CategorySeg({ value, onChange, className = "", labelledBy }) {
  return (
    <div
      className={`seg mv-seg ${className}`.trim()}
      role="group"
      aria-label={labelledBy ? undefined : "Category"}
      aria-labelledby={labelledBy}
    >
      <button type="button" className="seg__btn" aria-pressed={value == null} onClick={() => onChange(null)}>
        All
      </button>
      {DAMAGE_CLASSES.map((category) => (
        <button
          key={category}
          type="button"
          className="seg__btn"
          aria-pressed={value === category}
          onClick={() => onChange(value === category ? null : category)}
        >
          {CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  );
}

function GenerationSelect({ value, onChange, generations, className = "", labelledBy }) {
  return (
    <select
      className={`field__input mv-gen${value ? " is-active" : ""} ${className}`.trim()}
      value={value ?? ""}
      aria-label={labelledBy ? undefined : "Introduced in"}
      aria-labelledby={labelledBy}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
    >
      <option value="">Any gen</option>
      {generations.map((generation) => (
        <option key={generation} value={generation}>
          New in Gen {generation}
        </option>
      ))}
    </select>
  );
}

function StageInfo() {
  return (
    <details className="win mv-sec mv-stages">
      <summary className="mv-stages__summary">
        <h3 className="win__title">How stat stages work</h3>
        <Icon name="down" className="mv-stages__chevron" />
      </summary>
      <div className="win__body mv-stages__body">
        <p className="mv-prose">
          When moves mention &ldquo;stages,&rdquo; they&rsquo;re referring to in-battle stat modifiers. Each stat&rsquo;s
          stage ranges from <strong>−6</strong> (lowest) to <strong>+6</strong> (highest), and stages reset when the
          Pokémon switches out.
        </p>

        <h4 className="label mv-stages__head">Battle stats</h4>
        <p className="mv-prose">Attack, Defense, Special Attack, Special Defense, and Speed:</p>
        <table className="mv-table mv-stages__table">
          <thead>
            <tr>
              <td />
              <th scope="col">1 stage</th>
              <th scope="col">2 stages</th>
              <th scope="col">6 stages</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Boosts</th>
              <td>1.5×</td>
              <td>2×</td>
              <td>4×</td>
            </tr>
            <tr>
              <th scope="row">Drops</th>
              <td>0.67×</td>
              <td>0.5×</td>
              <td>0.25×</td>
            </tr>
          </tbody>
        </table>

        <h4 className="label mv-stages__head">Accuracy &amp; evasion</h4>
        <p className="mv-prose">
          These also go from −6 to +6 but use a gentler scale. The user&rsquo;s accuracy stage minus the target&rsquo;s
          evasion stage (capped at ±6) multiplies the move&rsquo;s accuracy:
        </p>
        <table className="mv-table mv-stages__table">
          <thead>
            <tr>
              <td />
              <th scope="col">1 stage</th>
              <th scope="col">2 stages</th>
              <th scope="col">6 stages</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Boosts</th>
              <td>1.33×</td>
              <td>1.67×</td>
              <td>3×</td>
            </tr>
            <tr>
              <th scope="row">Drops</th>
              <td>0.75×</td>
              <td>0.6×</td>
              <td>0.33×</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}

function SkeletonLines({ count = 3 }) {
  return (
    <span className="mv-lines" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="skeleton mv-lines__line" />
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- Page */

export default function MovesPage() {
  const [dataAttempt, setDataAttempt] = useState(0);
  const moveData = useStaticResource(loadMoveData, dataAttempt);
  const moveEffects = useStaticResource(loadMoveEffects, dataAttempt);
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState(null);
  const [selectedDamageClass, setSelectedDamageClass] = useState(null); // 'physical' | 'special' | 'status'
  const [selectedGeneration, setSelectedGeneration] = useState(null); // generation the move was introduced in
  const [priorityOnly, setPriorityOnly] = useState(false); // true => priority > 0
  const [selectedName, setSelectedName] = useState(() => readSearchParam("m"));
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [typeOpen, setTypeOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const pageRef = useRef(null);
  const stripRef = useRef(null);
  const listScrollRef = useRef(null);
  const searchRef = useRef(null);
  const typeButtonRef = useRef(null);
  const filtersButtonRef = useRef(null);
  const listScrollYRef = useRef(null); // phone: where the list was when a move opened
  const lastKeyRef = useRef(null);
  const previousSelectedRef = useRef(selectedName);

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

  // The list sits under the sticky strip, so publish the strip's height for it.
  useEffect(() => {
    const strip = stripRef.current;
    const page = pageRef.current;
    if (!strip || !page || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      if (strip.offsetHeight > 0) page.style.setProperty("--mv-strip-h", `${strip.offsetHeight}px`);
    });
    observer.observe(strip);
    return () => observer.disconnect();
  }, []);

  const allMoves = useMemo(() => {
    const data = moveData.data;
    if (!data?.moves) return [];
    // The snapshot lists moves in PokeAPI id order, which is the games' move number.
    return Object.keys(data.moves)
      .map((name, index) => ({
        ...getMoveForVersionGroup(data, name, null),
        no: index + 1,
        searchKey: `${toSearchKey(name)} ${toSearchKey(formatMoveName(name))}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [moveData.data]);

  const generations = useMemo(
    () => [...new Set(allMoves.map((move) => move.generation).filter(Boolean))].sort((a, b) => a - b),
    [allMoves]
  );

  const movesByName = useMemo(() => new Map(allMoves.map((move) => [move.name, move])), [allMoves]);
  const selectedMove = (selectedName && movesByName.get(selectedName)) || null;
  const selectedGroupKey = selectedMove ? getMoveGroupKey(selectedMove.name) : null;

  const groups = useMemo(() => {
    const search = toSearchKey(query);
    const byKey = new Map();
    for (const move of allMoves) {
      if (selectedType && move.type !== selectedType) continue;
      if (selectedDamageClass && move.damage_class !== selectedDamageClass) continue;
      if (selectedGeneration && move.generation !== selectedGeneration) continue;
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
  }, [allMoves, query, selectedType, selectedDamageClass, selectedGeneration, priorityOnly]);

  const variantsForSelected = useMemo(
    () => (selectedGroupKey ? allMoves.filter((move) => getMoveGroupKey(move.name) === selectedGroupKey) : []),
    [allMoves, selectedGroupKey]
  );

  const detail = useMoveDetail(selectedMove ? selectedMove.name : null, detailAttempt);
  const pokemonList = useStaticResource(selectedMove ? loadPokemonList : null);
  const pokemonById = useMemo(
    () => new Map((pokemonList.data || []).filter((pokemon) => pokemon.id != null).map((pokemon) => [pokemon.id, pokemon])),
    [pokemonList.data]
  );

  const selectMove = useCallback((name) => {
    const url = new URL(window.location.href);
    ["p", "i", "a"].forEach((key) => url.searchParams.delete(key));
    if (url.searchParams.get("m") !== name) {
      // Count the steps back to the plain list, so "back" can return there instead of stacking entries.
      const depth = url.searchParams.has("m") ? window.history.state?.[BACK_STATE_KEY] : 0;
      url.searchParams.set("m", name);
      window.history.pushState(typeof depth === "number" ? { [BACK_STATE_KEY]: depth + 1 } : {}, "", url);
    }
    setSelectedName(name);
  }, []);

  const openFromList = useCallback(
    (name) => {
      if (isPhoneLayout()) listScrollYRef.current = window.scrollY;
      selectMove(name);
    },
    [selectMove]
  );

  const backToList = useCallback(() => {
    const depth = window.history.state?.[BACK_STATE_KEY];
    if (typeof depth === "number" && depth > 0 && readSearchParam("m")) {
      window.history.go(-depth);
      return;
    }
    // Opened from a link: there's no list entry behind this one, so add one.
    const url = new URL(window.location.href);
    url.searchParams.delete("m");
    window.history.pushState({}, "", url);
    setSelectedName(null);
  }, []);

  // A move opening starts at the top; on phones, closing it returns to where the list was.
  useLayoutEffect(() => {
    const previous = previousSelectedRef.current;
    previousSelectedRef.current = selectedName;
    if (previous === selectedName) return;
    if (previous) lastKeyRef.current = getMoveGroupKey(previous);
    if (selectedName) {
      if (window.scrollY > 0) window.scrollTo(0, 0);
      return;
    }
    if (!isPhoneLayout()) return;
    if (listScrollYRef.current != null) {
      window.scrollTo(0, listScrollYRef.current);
    } else if (lastKeyRef.current) {
      const row = listScrollRef.current?.querySelector(`[data-key="${CSS.escape(lastKeyRef.current)}"]`);
      row?.scrollIntoView({ block: "center" });
    }
  }, [selectedName]);

  // Desktop: keep the open move's row in view inside the list (deep links, back/forward).
  const listReady = groups.length > 0;
  useEffect(() => {
    const list = listScrollRef.current;
    if (!list || !selectedGroupKey || !listReady) return;
    if (list.scrollHeight <= list.clientHeight + 1) return; // phones: the page scrolls, not the list
    const row = list.querySelector(`[data-key="${CSS.escape(selectedGroupKey)}"]`);
    if (!row) return;
    const listBox = list.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    if (rowBox.top >= listBox.top && rowBox.bottom <= listBox.bottom) return;
    list.scrollTop += rowBox.top - listBox.top - (list.clientHeight - rowBox.height) / 2;
  }, [selectedGroupKey, listReady]);

  const clearFilters = useCallback(() => {
    setSelectedType(null);
    setSelectedDamageClass(null);
    setSelectedGeneration(null);
    setPriorityOnly(false);
  }, []);

  const resetAll = () => {
    setQuery("");
    clearFilters();
  };

  const closeType = useCallback(() => setTypeOpen(false), []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const retryDetail = useCallback(() => setDetailAttempt((attempt) => attempt + 1), []);

  const activeFilterCount =
    (selectedType ? 1 : 0) + (selectedDamageClass ? 1 : 0) + (selectedGeneration ? 1 : 0) + (priorityOnly ? 1 : 0);
  const loading = !moveData.data && !moveData.error;
  // If the move data failed to load there is nothing to open; the list shows the error instead.
  const open = Boolean(selectedName) && !moveData.error;
  const resultLabel = `${groups.length.toLocaleString()} ${groups.length === 1 ? "move" : "moves"}`;

  const onSearchKeyDown = (event) => {
    if (event.key === "Escape" && query) {
      event.stopPropagation();
      setQuery("");
    } else if (event.key === "Enter") {
      event.preventDefault();
      // Phones: the search key just puts the keyboard away. Desktop: open the top match.
      if (isPhoneLayout()) event.currentTarget.blur();
      else if (groups.length > 0) openFromList(groups[0].primary.name);
    } else if (event.key === "ArrowDown") {
      const first = listScrollRef.current?.querySelector("a.mv-row");
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const onListKeyDown = (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const item = event.target.closest?.("li");
    if (!item) return;
    const next = event.key === "ArrowDown" ? item.nextElementSibling : item.previousElementSibling;
    const link = next?.querySelector("a.mv-row") || (event.key === "ArrowUp" ? searchRef.current : null);
    if (!link) return;
    event.preventDefault();
    link.focus();
  };

  return (
    <main ref={pageRef} className={`mv${open ? " mv--open" : ""}`}>
      <div className="mv-strip" ref={stripRef}>
        <div className="mv-strip__row">
          <h1 className="mv-strip__title">Moves</h1>

          <label className="field mv-strip__search">
            <span className="sr-only">Search moves</span>
            <Icon name="search" />
            <input
              ref={searchRef}
              className="field__input"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck="false"
              placeholder="Search moves"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            {query ? (
              <button
                type="button"
                className="btn btn--quiet btn--icon btn--sm field__clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <Icon name="close" />
              </button>
            ) : null}
          </label>

          <div className="mv-strip__controls">
            <button
              ref={typeButtonRef}
              type="button"
              className={`btn mv-strip__type${selectedType ? " is-active" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={typeOpen}
              onClick={() => setTypeOpen(true)}
            >
              <span className="sr-only">Type: </span>
              {selectedType ? <MoveType type={selectedType} /> : "All types"}
              <Icon name="down" className="mv-strip__chevron" />
            </button>
            <CategorySeg value={selectedDamageClass} onChange={setSelectedDamageClass} className="mv-strip__seg" />
            <GenerationSelect
              value={selectedGeneration}
              onChange={setSelectedGeneration}
              generations={generations}
              className="mv-strip__gen"
            />
            <button
              type="button"
              className="btn mv-strip__prio"
              aria-pressed={priorityOnly}
              title="Moves with increased priority (+1 or higher)"
              onClick={() => setPriorityOnly((value) => !value)}
            >
              Priority
            </button>
            {query || activeFilterCount > 0 ? (
              <button type="button" className="btn btn--quiet btn--sm mv-strip__reset" onClick={resetAll}>
                Reset
              </button>
            ) : null}
          </div>

          <button
            ref={filtersButtonRef}
            type="button"
            className={`btn mv-strip__filters${activeFilterCount ? " is-active" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(true)}
          >
            <Icon name="filter" />
            <span className="sr-only">Filters</span>
            {activeFilterCount ? <span className="mv-strip__badge">{activeFilterCount}</span> : null}
          </button>
        </div>

        {activeFilterCount > 0 ? (
          <ul className="mv-strip__tokens" aria-label="Active filters">
            {selectedType ? (
              <li>
                <button
                  type="button"
                  className={`tag t-${selectedType} mv-token`}
                  onClick={() => setSelectedType(null)}
                >
                  {selectedType}
                  <Icon name="close" />
                  <span className="sr-only">Remove filter</span>
                </button>
              </li>
            ) : null}
            {selectedDamageClass ? (
              <li>
                <button type="button" className="btn btn--sm mv-token" onClick={() => setSelectedDamageClass(null)}>
                  {CATEGORY_LABELS[selectedDamageClass]}
                  <Icon name="close" />
                  <span className="sr-only">Remove filter</span>
                </button>
              </li>
            ) : null}
            {selectedGeneration ? (
              <li>
                <button type="button" className="btn btn--sm mv-token" onClick={() => setSelectedGeneration(null)}>
                  New in Gen {selectedGeneration}
                  <Icon name="close" />
                  <span className="sr-only">Remove filter</span>
                </button>
              </li>
            ) : null}
            {priorityOnly ? (
              <li>
                <button type="button" className="btn btn--sm mv-token" onClick={() => setPriorityOnly(false)}>
                  Priority
                  <Icon name="close" />
                  <span className="sr-only">Remove filter</span>
                </button>
              </li>
            ) : null}
            <li>
              <button type="button" className="btn btn--quiet btn--sm" onClick={clearFilters}>
                Clear all
              </button>
            </li>
          </ul>
        ) : null}

        <Sheet open={typeOpen} onClose={closeType} anchorRef={typeButtonRef} label="Move type" width={420}>
          <div className="popsheet__head">
            <h2 className="popsheet__title">Type</h2>
            <button type="button" className="btn btn--quiet btn--icon btn--sm" onClick={closeType} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <div className="popsheet__body">
            <TypeGrid
              selected={selectedType}
              onPick={(type) => {
                setSelectedType(type);
                closeType();
              }}
            />
          </div>
        </Sheet>

        <Sheet open={filtersOpen} onClose={closeFilters} anchorRef={filtersButtonRef} label="Move filters" width={440} align="end">
          <div className="popsheet__head">
            <h2 className="popsheet__title">Filters</h2>
            <button type="button" className="btn btn--quiet btn--icon btn--sm" onClick={closeFilters} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <div className="popsheet__body">
            <section className="mv-fgroup" aria-labelledby="mv-filter-type">
              <h3 className="label mv-fgroup__head" id="mv-filter-type">
                Type
              </h3>
              <TypeGrid selected={selectedType} onPick={setSelectedType} />
            </section>
            <section className="mv-fgroup" aria-labelledby="mv-filter-category">
              <h3 className="label mv-fgroup__head" id="mv-filter-category">
                Category
              </h3>
              <CategorySeg
                value={selectedDamageClass}
                onChange={setSelectedDamageClass}
                className="mv-fgroup__seg"
                labelledBy="mv-filter-category"
              />
            </section>
            <section className="mv-fgroup" aria-labelledby="mv-filter-gen">
              <h3 className="label mv-fgroup__head" id="mv-filter-gen">
                Introduced
              </h3>
              <GenerationSelect
                value={selectedGeneration}
                onChange={setSelectedGeneration}
                generations={generations}
                labelledBy="mv-filter-gen"
              />
            </section>
            <section className="mv-fgroup" aria-labelledby="mv-filter-priority">
              <h3 className="label mv-fgroup__head" id="mv-filter-priority">
                Priority
              </h3>
              <button
                type="button"
                className="btn mv-fgroup__toggle"
                aria-pressed={priorityOnly}
                onClick={() => setPriorityOnly((value) => !value)}
              >
                Only moves that go first (+1 or higher)
              </button>
            </section>
          </div>
          <div className="popsheet__foot">
            <button type="button" className="btn btn--quiet" onClick={clearFilters} disabled={activeFilterCount === 0}>
              Clear filters
            </button>
            <button type="button" className="btn btn--primary" onClick={closeFilters}>
              Show {resultLabel}
            </button>
          </div>
        </Sheet>
      </div>

      <div className="mv-split">
        <nav className="mv-list" aria-label="Moves">
          <div className="mv-list__scroll" ref={listScrollRef}>
            <div className="mv-list__head">
              <p className="mv-list__count" aria-live="polite">
                {loading ? (
                  "Loading moves…"
                ) : moveData.error ? (
                  "Moves unavailable"
                ) : (
                  <>
                    <span className="num">{groups.length.toLocaleString()}</span> {groups.length === 1 ? "move" : "moves"}
                  </>
                )}
              </p>
              <span className="mv-list__col" aria-hidden="true">
                Pwr
              </span>
              <span className="mv-list__col" aria-hidden="true">
                Acc
              </span>
              <span className="mv-list__col" aria-hidden="true">
                PP
              </span>
            </div>
            {moveData.error ? (
              <div className="empty mv-list__empty" role="alert">
                <p className="empty__title">Couldn&rsquo;t load moves</p>
                <p>Check your connection, then try again.</p>
                <button type="button" className="btn" onClick={() => setDataAttempt((attempt) => attempt + 1)}>
                  Try again
                </button>
              </div>
            ) : loading ? (
              <ol className="mv-rows" aria-hidden="true">
                {Array.from({ length: 14 }, (_, index) => (
                  <li key={index}>
                    <span className="mv-row mv-row--ghost">
                      <span className="mv-row__name skeleton" />
                      <span className="mv-row__meta skeleton" />
                    </span>
                  </li>
                ))}
              </ol>
            ) : groups.length === 0 ? (
              <div className="empty mv-list__empty">
                <p className="empty__title">No moves match</p>
                <p>
                  {query && activeFilterCount
                    ? `Nothing called “${query}” with these filters.`
                    : query
                    ? `No move called “${query}”.`
                    : "No move has all of these filters."}
                </p>
                <button type="button" className="btn" onClick={resetAll}>
                  {query && activeFilterCount ? "Clear search and filters" : query ? "Clear search" : "Clear filters"}
                </button>
              </div>
            ) : (
              <ol className="mv-rows" onKeyDown={onListKeyDown}>
                {groups.map(({ key, primary }) => {
                  const isSelected = selectedGroupKey === key;
                  return (
                    <li key={key}>
                      <a
                        href={moveHref(primary.name)}
                        className={`mv-row${isSelected ? " is-selected" : ""}`}
                        aria-current={isSelected ? "true" : undefined}
                        data-key={key}
                        onClick={(event) => {
                          if (!isPlainLeftClick(event)) return;
                          event.preventDefault();
                          openFromList(primary.name);
                        }}
                      >
                        <Cursor className="mv-row__cursor" />
                        <span className="mv-row__no" aria-hidden="true">
                          {formatMoveNo(primary.no)}
                        </span>
                        <span className="mv-row__name">{formatMoveName(key)}</span>
                        <span className="mv-row__meta">
                          <MoveType type={primary.type} />
                          <CategoryIcon category={primary.damage_class} />
                          {primary.priority ? (
                            <span className="stamp mv-row__prio" title={`Priority ${formatPriority(primary.priority)}`}>
                              <span className="sr-only">Priority </span>
                              {formatPriority(primary.priority)}
                            </span>
                          ) : null}
                        </span>
                        <span className="mv-row__stat mv-row__stat--pwr">
                          <span className="sr-only">Power </span>
                          {primary.power ?? "—"}
                        </span>
                        <span className="mv-row__stat mv-row__stat--acc">
                          <span className="sr-only">Accuracy </span>
                          {primary.accuracy ?? "—"}
                        </span>
                        <span className="mv-row__stat mv-row__stat--pp">
                          <span className="sr-only">PP </span>
                          {primary.pp ?? "—"}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </nav>

        <div className="mv-detail">
          {selectedMove ? (
            <MoveEntry
              move={selectedMove}
              moveData={moveData.data}
              shortEffect={moveEffects.data?.[selectedMove.name] || ""}
              detail={detail}
              variants={variantsForSelected}
              onSelectVariant={selectMove}
              onBack={backToList}
              onRetry={retryDetail}
              pokemonById={pokemonById}
              pokemonListPending={!pokemonList.data && !pokemonList.error}
            />
          ) : selectedName && loading ? (
            <EntryGhost onBack={backToList} />
          ) : selectedName && !moveData.error ? (
            <article className="mv-entry" aria-labelledby="mv-missing-title">
              <EntryBar onBack={backToList} />
              <div className="win">
                <div className="empty">
                  <h2 className="empty__title" id="mv-missing-title">
                    No move called &ldquo;{selectedName}&rdquo;
                  </h2>
                  <p>The link may be misspelled. Search the list for the move instead.</p>
                </div>
              </div>
            </article>
          ) : (
            <div className="win mv-detail__empty">
              <div className="empty">
                <p className="empty__title">Pick a move</p>
                <p>See its effect, how it changed between games and which Pokémon learn it.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- Detail */

function EntryBar({ onBack }) {
  return (
    <div className="mv-entry__bar">
      <button type="button" className="btn btn--quiet mv-entry__back" onClick={onBack}>
        <Icon name="left" />
        Moves
      </button>
    </div>
  );
}

function EntryGhost({ onBack }) {
  return (
    <div className="mv-entry" role="status">
      <EntryBar onBack={onBack} />
      <span className="sr-only">Loading move…</span>
      <div className="mv-ghost" aria-hidden="true">
        <span className="skeleton mv-ghost__title" />
        <span className="skeleton mv-ghost__tags" />
        <span className="skeleton mv-ghost__figures" />
        <span className="skeleton mv-ghost__block" />
      </div>
    </div>
  );
}

function MoveEntry({
  move,
  moveData,
  shortEffect,
  detail,
  variants,
  onSelectVariant,
  onBack,
  onRetry,
  pokemonById,
  pokemonListPending,
}) {
  const longEffect = useMemo(() => getEnglishEffect(detail.data), [detail.data]);
  const effectLines = useMemo(() => toEffectLines(longEffect, shortEffect), [longEffect, shortEffect]);
  const showStageInfo = useMemo(() => mentionsStatStages(`${shortEffect} ${longEffect}`), [shortEffect, longEffect]);
  const history = useMemo(() => buildMoveHistory(moveData, move.name), [moveData, move]);
  const flavorEntries = useMemo(
    () => groupFlavorText(detail.data?.flavor_text_entries, moveData?.versionGroups),
    [detail.data, moveData]
  );

  const showEffect = Boolean(shortEffect) || effectLines.length > 0 || detail.loading;
  const showFlavor = detail.loading || Boolean(detail.error) || flavorEntries.length > 0;

  return (
    <article className="mv-entry" aria-labelledby="mv-entry-title">
      <EntryBar onBack={onBack} />

      <header className="mv-id">
        <h2 className="mv-id__name" id="mv-entry-title">
          {formatMoveName(move.name)}
        </h2>
        <div className="mv-id__tags">
          <MoveType type={move.type} size="lg" icon />
          <CategoryChip category={move.damage_class} />
        </div>
        <p className="mv-id__meta">
          <span className="mv-id__no">No.{formatMoveNo(move.no)}</span>
          {move.generation ? <span>Introduced in Gen {move.generation}</span> : null}
        </p>
      </header>

      <div className="mv-facts">
        <dl className="mv-figures">
          <div className="mv-figure">
            <dt>Power</dt>
            <dd>{move.power ?? "—"}</dd>
          </div>
          <div className="mv-figure">
            <dt>Accuracy</dt>
            <dd>{formatAccuracy(move.accuracy)}</dd>
          </div>
          <div className="mv-figure">
            <dt>PP</dt>
            <dd>{move.pp ?? "—"}</dd>
          </div>
          <div className="mv-figure">
            <dt>Priority</dt>
            <dd>{formatPriority(move.priority)}</dd>
          </div>
        </dl>
        {history ? (
          <p className="mv-muted mv-facts__note">Values in the latest games. Older games differ: see Changes by generation.</p>
        ) : null}
        {variants.length > 1 ? (
          <div className="mv-variants">
            <span className="label" id="mv-variant-label">
              Form
            </span>
            <div className="seg" role="group" aria-labelledby="mv-variant-label">
              {variants.map((variant) => {
                const suffix = variant.name.split("--")[1];
                return (
                  <button
                    key={variant.name}
                    type="button"
                    className="seg__btn"
                    aria-pressed={variant.name === move.name}
                    onClick={() => onSelectVariant(variant.name)}
                  >
                    {suffix ? titleCaseSlug(suffix) : formatMoveName(variant.name)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mv-entry__body">
        <div className="mv-entry__main">
          {showEffect ? (
            <section className="win mv-sec" aria-labelledby="mv-effect-title">
              <div className="win__head">
                <h3 className="win__title" id="mv-effect-title">
                  Effect
                </h3>
              </div>
              <div className="win__body mv-effect">
                {shortEffect ? <p className="mv-effect__summary">{shortEffect}</p> : null}
                {effectLines.length > 0 ? (
                  <ul className="mv-effect__lines">
                    {effectLines.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                ) : detail.loading ? (
                  <SkeletonLines count={shortEffect ? 2 : 3} />
                ) : null}
              </div>
            </section>
          ) : null}

          {showStageInfo ? <StageInfo /> : null}

          {history ? (
            <section className="win mv-sec" aria-labelledby="mv-history-title">
              <div className="win__head">
                <h3 className="win__title" id="mv-history-title">
                  Changes by generation
                </h3>
              </div>
              <div className="win__body">
                <div className="mv-scroll">
                  <table className="mv-table mv-history">
                    <thead>
                      <tr>
                        <th scope="col">Games</th>
                        {history.fields.map((field) => (
                          <th scope="col" key={field}>
                            {HISTORY_LABELS[field]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.rows.map((row, idx) => (
                        <tr key={idx}>
                          <th scope="row">
                            <span className="mv-history__gen">{formatGenerationRange(row.fromGen, row.toGen)}</span>
                            {row.games ? (
                              <span className="mv-history__games">{row.games.map(formatVersionGroup).join(", ")}</span>
                            ) : null}
                          </th>
                          {history.fields.map((field) => (
                            <td key={field}>
                              <HistoryValue field={field} value={row.stats[field]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {history.categoryFromType ? (
                  <p className="mv-muted mv-history__note">
                    Before Gen 4, a damaging move&rsquo;s category came from its type rather than the move itself.
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {showFlavor ? (
            <section className="win mv-sec" aria-labelledby="mv-flavor-title">
              <div className="win__head">
                <h3 className="win__title" id="mv-flavor-title">
                  In-game description
                </h3>
              </div>
              <div className="win__body">
                {detail.loading ? (
                  <div role="status">
                    <span className="sr-only">Loading game descriptions…</span>
                    <SkeletonLines count={3} />
                  </div>
                ) : detail.error ? (
                  <div className="mv-error" role="alert">
                    <p>Couldn&rsquo;t load game descriptions from PokeAPI.</p>
                    <button type="button" className="btn btn--sm" onClick={onRetry}>
                      Try again
                    </button>
                  </div>
                ) : (
                  <dl className="mv-flavor">
                    {flavorEntries.map((entry) => (
                      <div key={entry.newest} className="mv-flavor__row">
                        <dt>
                          {entry.oldest === entry.newest
                            ? formatVersionGroup(entry.newest)
                            : `${formatVersionGroup(entry.oldest)} – ${formatVersionGroup(entry.newest)}`}
                        </dt>
                        <dd>{entry.text}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </section>
          ) : null}
        </div>

        <MoveLearners
          key={move.name}
          detail={detail}
          onRetry={onRetry}
          pokemonById={pokemonById}
          pokemonListPending={pokemonListPending}
        />
      </div>
    </article>
  );
}

const goToPokemon = (slug) => {
  if (slug) updatePokemonLocation(slug, { pruneKeys: ["i", "m", "a", "p"] });
};

function MoveLearners({ detail, onRetry, pokemonById, pokemonListPending }) {
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

  const loading = detail.loading || (pokemonListPending && learners.length > 0);
  const visible = learners.slice(0, visibleCount);
  const remaining = learners.length - visible.length;

  return (
    <section className="win mv-sec mv-learners" aria-labelledby="mv-learners-title">
      <div className="win__head">
        <h3 className="win__title" id="mv-learners-title">
          Learnt by
        </h3>
        {!loading && learners.length > 0 ? <span className="mv-count num">{learners.length.toLocaleString()}</span> : null}
      </div>
      <div className="win__body">
        {loading ? (
          <div role="status">
            <span className="sr-only">Loading Pokémon…</span>
            <ul className="mv-mons" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <li key={index}>
                  <span className="mv-mon mv-mon--ghost">
                    <span className="skeleton mv-mon__sprite" />
                    <span className="skeleton mv-mon__name" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : detail.error ? (
          <div className="mv-error" role="alert">
            <p>Couldn&rsquo;t load which Pokémon learn this move.</p>
            <button type="button" className="btn btn--sm" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : learners.length === 0 ? (
          <p className="mv-muted">No Pokémon learn this move.</p>
        ) : (
          <>
            <p className="mv-muted mv-learners__note">In at least one game.</p>
            <ul className="mv-mons">
              {visible.map((pokemon) => (
                <li key={pokemon.id}>
                  <a
                    className="mv-mon"
                    href={buildPokemonPath(pokemon.slug)}
                    onClick={(event) => {
                      if (!isPlainLeftClick(event)) return;
                      event.preventDefault();
                      goToPokemon(pokemon.slug);
                    }}
                  >
                    <img
                      className="mv-mon__sprite"
                      src={`${SPRITE_BASE}/${pokemon.id}.png`}
                      alt=""
                      width="48"
                      height="48"
                      loading="lazy"
                      decoding="async"
                      onError={hideBrokenSprite}
                    />
                    <span className="mv-mon__name">{formatLearnerName(pokemon.slug)}</span>
                    <span className="mv-mon__types">
                      {pokemon.types.map((type) => (
                        <TypeTag key={type} typeName={type} icon={false} />
                      ))}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {remaining > 0 ? (
              <button
                type="button"
                className="btn mv-more"
                onClick={() => setVisibleCount((count) => count + LEARNERS_PAGE_SIZE)}
              >
                Show {Math.min(LEARNERS_PAGE_SIZE, remaining)} more ({remaining.toLocaleString()} left)
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
