import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon, { Cursor } from "./components/Icon.jsx";
import { TypeTag } from "./pokedex/EntryParts.jsx";
import { buildPokemonPath, updatePokemonLocation } from "./utils/url.js";
import { formatPokemonName } from "./utils/pokemonNames.js";
import { loadAbilityData, loadPokemonList } from "./data/staticData.js";
import "./styles/pages/abilities.css";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const LEARNERS_PAGE_SIZE = 60;

// Same breakpoint as the shell and Sheet: below it the list and the open ability take turns.
const PHONE_QUERY = "(max-width: 900px)";
const isPhoneLayout = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(PHONE_QUERY).matches);

// History entries this page pushes remember how many steps back the plain list is.
const BACK_STATE_KEY = "abBack";

const isPlainLeftClick = (event) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/* ---------------------------------------------------------------- Names */

// Official English names that title-casing the PokeAPI slug gets wrong (checked against PokeAPI's names).
// Both As One variants are called "As One" in game; the partner Pokémon tells them apart here.
const ABILITY_NAME_OVERRIDES = new Map([
  ["soul-heart", "Soul-Heart"],
  ["rks-system", "RKS System"],
  ["dragons-maw", "Dragon’s Maw"],
  ["well-baked-body", "Well-Baked Body"],
  ["minds-eye", "Mind’s Eye"],
  ["as-one-glastrier", "As One (Glastrier)"],
  ["as-one-spectrier", "As One (Spectrier)"],
]);
const LOWERCASE_WORDS = new Set(["of", "the", "or", "and", "to", "as"]);

const titleCaseSlug = (slug) =>
  String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && LOWERCASE_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");

/** "good-as-gold" → "Good as Gold", "dragons-maw" → "Dragon’s Maw" */
const formatAbilityName = (name) => ABILITY_NAME_OVERRIDES.get(name) ?? titleCaseSlug(name);

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

const hideBrokenSprite = (event) => {
  event.currentTarget.style.visibility = "hidden";
};

const readSearchParam = (key) => new URLSearchParams(window.location.search).get(key);
const abilityHref = (name) => `?a=${encodeURIComponent(name)}`;

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

// `/ability/{name}` responses (full effect text). Concurrent callers share one in-flight request;
// failures are evicted so a later visit retries.
const abilityDetailCache = new Map(); // name -> { promise, data }

function fetchAbilityDetail(name) {
  let entry = abilityDetailCache.get(name);
  if (!entry) {
    entry = { promise: null, data: null };
    const cacheEntry = entry;
    cacheEntry.promise = fetch(`${POKEAPI_BASE}/ability/${encodeURIComponent(name)}/`)
      .then((response) => {
        if (!response.ok) throw new Error(`PokeAPI responded with ${response.status}`);
        return response.json();
      })
      .then((data) => {
        cacheEntry.data = data;
        return data;
      })
      .catch((error) => {
        abilityDetailCache.delete(name);
        throw error;
      });
    abilityDetailCache.set(name, cacheEntry);
  }
  return entry.promise;
}

const IDLE_DETAIL = { data: null, loading: false, error: null };

function useAbilityDetail(name, attempt = 0) {
  const [result, setResult] = useState({ name: null, attempt: 0, data: null, error: null });
  useEffect(() => {
    if (!name) return undefined;
    let cancelled = false;
    fetchAbilityDetail(name).then(
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
  const cached = abilityDetailCache.get(name)?.data;
  if (cached) return { data: cached, loading: false, error: null };
  return { data: null, loading: true, error: null };
}

const cleanGameText = (text) =>
  String(text || "")
    .replace(/\xad\s*/g, "") // soft hyphens from line-wrapped game text
    // PokeAPI markup such as "[HP]{mechanic:hp}" or "[]{move:protect}"
    .replace(/\[([^\]]*)\]\{[^}:]*:([^}]*)\}/g, (_, label, slug) => label || titleCaseSlug(slug))
    .replace(/\s+/g, " ")
    .trim();

/** Full English effect text from an `/ability/{name}` response (paragraphs kept). */
const getEnglishEffect = (data) => {
  const entries = Array.isArray(data?.effect_entries) ? data.effect_entries : [];
  const entry = entries.find((e) => e?.language?.name === "en");
  return entry?.effect || entry?.short_effect || "";
};

const looseTextKey = (text) =>
  String(text || "")
    .toLowerCase()
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

function SkeletonLines({ count = 3 }) {
  return (
    <span className="ab-lines" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="skeleton ab-lines__line" />
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- Page */

export default function AbilitiesPage() {
  const [dataAttempt, setDataAttempt] = useState(0);
  const abilityData = useStaticResource(loadAbilityData, dataAttempt);
  const [query, setQuery] = useState("");
  const [selectedGeneration, setSelectedGeneration] = useState(null); // generation the ability was introduced in
  const [selectedName, setSelectedName] = useState(() => readSearchParam("a"));
  const [detailAttempt, setDetailAttempt] = useState(0);

  const pageRef = useRef(null);
  const stripRef = useRef(null);
  const listScrollRef = useRef(null);
  const searchRef = useRef(null);
  const listScrollYRef = useRef(null); // phone: where the list was when an ability opened
  const lastNameRef = useRef(null);
  const previousSelectedRef = useRef(selectedName);

  useEffect(() => {
    // The Abilities page only carries its own `?a=` param.
    const url = new URL(window.location.href);
    const foreignKeys = ["p", "i", "m"].filter((key) => url.searchParams.has(key));
    if (foreignKeys.length > 0) {
      foreignKeys.forEach((key) => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, "", url);
    }
    // Back/forward and in-app navigation update the selection from the URL.
    const syncFromUrl = () => setSelectedName(readSearchParam("a"));
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
      if (strip.offsetHeight > 0) page.style.setProperty("--ab-strip-h", `${strip.offsetHeight}px`);
    });
    observer.observe(strip);
    return () => observer.disconnect();
  }, []);

  // abilities.json holds main-series abilities only, so Conquest-only entries never appear.
  const abilities = useMemo(
    () =>
      (abilityData.data?.abilities || [])
        .map((ability) => ({
          name: ability.n,
          label: formatAbilityName(ability.n),
          generation: ability.g ?? null,
          effect: ability.e || "",
          pokemon: Array.isArray(ability.p) ? ability.p : [],
          searchKey: `${toSearchKey(ability.n)} ${toSearchKey(formatAbilityName(ability.n))}`,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [abilityData.data]
  );

  const generations = useMemo(
    () => [...new Set(abilities.map((ability) => ability.generation).filter(Boolean))].sort((a, b) => a - b),
    [abilities]
  );

  const abilitiesByName = useMemo(() => new Map(abilities.map((ability) => [ability.name, ability])), [abilities]);
  const selectedAbility = (selectedName && abilitiesByName.get(selectedName)) || null;

  const filtered = useMemo(() => {
    const search = toSearchKey(query);
    return abilities.filter(
      (ability) =>
        (!selectedGeneration || ability.generation === selectedGeneration) && (!search || ability.searchKey.includes(search))
    );
  }, [abilities, query, selectedGeneration]);

  const detail = useAbilityDetail(selectedAbility ? selectedAbility.name : null, detailAttempt);
  const pokemonList = useStaticResource(selectedAbility ? loadPokemonList : null);
  const pokemonById = useMemo(
    () => new Map((pokemonList.data || []).filter((pokemon) => pokemon.id != null).map((pokemon) => [pokemon.id, pokemon])),
    [pokemonList.data]
  );

  const selectAbility = useCallback((name) => {
    const url = new URL(window.location.href);
    ["p", "i", "m"].forEach((key) => url.searchParams.delete(key));
    if (url.searchParams.get("a") !== name) {
      // Count the steps back to the plain list, so "back" can return there instead of stacking entries.
      const depth = url.searchParams.has("a") ? window.history.state?.[BACK_STATE_KEY] : 0;
      url.searchParams.set("a", name);
      window.history.pushState(typeof depth === "number" ? { [BACK_STATE_KEY]: depth + 1 } : {}, "", url);
    }
    setSelectedName(name);
  }, []);

  const openFromList = useCallback(
    (name) => {
      if (isPhoneLayout()) listScrollYRef.current = window.scrollY;
      selectAbility(name);
    },
    [selectAbility]
  );

  const backToList = useCallback(() => {
    const depth = window.history.state?.[BACK_STATE_KEY];
    if (typeof depth === "number" && depth > 0 && readSearchParam("a")) {
      window.history.go(-depth);
      return;
    }
    // Opened from a link: there's no list entry behind this one, so add one.
    const url = new URL(window.location.href);
    url.searchParams.delete("a");
    window.history.pushState({}, "", url);
    setSelectedName(null);
  }, []);

  // An ability opening starts at the top; on phones, closing it returns to where the list was.
  useLayoutEffect(() => {
    const previous = previousSelectedRef.current;
    previousSelectedRef.current = selectedName;
    if (previous === selectedName) return;
    if (previous) lastNameRef.current = previous;
    if (selectedName) {
      if (window.scrollY > 0) window.scrollTo(0, 0);
      return;
    }
    if (!isPhoneLayout()) return;
    if (listScrollYRef.current != null) {
      window.scrollTo(0, listScrollYRef.current);
    } else if (lastNameRef.current) {
      const row = listScrollRef.current?.querySelector(`[data-key="${CSS.escape(lastNameRef.current)}"]`);
      row?.scrollIntoView({ block: "center" });
    }
  }, [selectedName]);

  // Desktop: keep the open ability's row in view inside the list (deep links, back/forward).
  const selectedKey = selectedAbility?.name ?? null;
  const listReady = filtered.length > 0;
  useEffect(() => {
    const list = listScrollRef.current;
    if (!list || !selectedKey || !listReady) return;
    if (list.scrollHeight <= list.clientHeight + 1) return; // phones: the page scrolls, not the list
    const row = list.querySelector(`[data-key="${CSS.escape(selectedKey)}"]`);
    if (!row) return;
    const listBox = list.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    if (rowBox.top >= listBox.top && rowBox.bottom <= listBox.bottom) return;
    list.scrollTop += rowBox.top - listBox.top - (list.clientHeight - rowBox.height) / 2;
  }, [selectedKey, listReady]);

  const resetAll = () => {
    setQuery("");
    setSelectedGeneration(null);
  };
  const retryDetail = useCallback(() => setDetailAttempt((attempt) => attempt + 1), []);

  const loading = !abilityData.data && !abilityData.error;
  // If the ability data failed to load there is nothing to open; the list shows the error instead.
  const open = Boolean(selectedName) && !abilityData.error;

  const onSearchKeyDown = (event) => {
    if (event.key === "Escape" && query) {
      event.stopPropagation();
      setQuery("");
    } else if (event.key === "Enter") {
      event.preventDefault();
      // Phones: the search key just puts the keyboard away. Desktop: open the top match.
      if (isPhoneLayout()) event.currentTarget.blur();
      else if (filtered.length > 0) openFromList(filtered[0].name);
    } else if (event.key === "ArrowDown") {
      const first = listScrollRef.current?.querySelector("a.ab-row");
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
    const link = next?.querySelector("a.ab-row") || (event.key === "ArrowUp" ? searchRef.current : null);
    if (!link) return;
    event.preventDefault();
    link.focus();
  };

  return (
    <main ref={pageRef} className={`ab${open ? " ab--open" : ""}`}>
      <div className="ab-strip" ref={stripRef}>
        <div className="ab-strip__row">
          <h1 className="ab-strip__title">Abilities</h1>

          <label className="field ab-strip__search">
            <span className="sr-only">Search abilities</span>
            <Icon name="search" />
            <input
              ref={searchRef}
              className="field__input"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck="false"
              placeholder="Search abilities"
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

          <select
            className={`field__input ab-gen${selectedGeneration ? " is-active" : ""}`}
            value={selectedGeneration ?? ""}
            aria-label="Introduced in"
            onChange={(event) => setSelectedGeneration(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Any gen</option>
            {generations.map((generation) => (
              <option key={generation} value={generation}>
                New in Gen {generation}
              </option>
            ))}
          </select>

          {query || selectedGeneration ? (
            <button type="button" className="btn btn--quiet btn--sm ab-strip__reset" onClick={resetAll}>
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <div className="ab-split">
        <nav className="ab-list" aria-label="Abilities">
          <div className="ab-list__scroll" ref={listScrollRef}>
            <div className="ab-list__head">
              <p className="ab-list__count" aria-live="polite">
                {loading ? (
                  "Loading abilities…"
                ) : abilityData.error ? (
                  "Abilities unavailable"
                ) : (
                  <>
                    <span className="num">{filtered.length.toLocaleString()}</span>{" "}
                    {filtered.length === 1 ? "ability" : "abilities"}
                  </>
                )}
              </p>
              <span className="ab-list__col" aria-hidden="true">
                Gen
              </span>
            </div>
            {abilityData.error ? (
              <div className="empty ab-list__empty" role="alert">
                <p className="empty__title">Couldn&rsquo;t load abilities</p>
                <p>Check your connection, then try again.</p>
                <button type="button" className="btn" onClick={() => setDataAttempt((attempt) => attempt + 1)}>
                  Try again
                </button>
              </div>
            ) : loading ? (
              <ol className="ab-rows" aria-hidden="true">
                {Array.from({ length: 14 }, (_, index) => (
                  <li key={index}>
                    <span className="ab-row ab-row--ghost">
                      <span className="ab-row__name skeleton" />
                      <span className="ab-row__effect skeleton" />
                    </span>
                  </li>
                ))}
              </ol>
            ) : filtered.length === 0 ? (
              <div className="empty ab-list__empty">
                <p className="empty__title">No abilities match</p>
                <p>
                  {query && selectedGeneration
                    ? `Nothing called “${query}” new in Gen ${selectedGeneration}.`
                    : query
                    ? `No ability called “${query}”.`
                    : `No abilities new in Gen ${selectedGeneration}.`}
                </p>
                <button type="button" className="btn" onClick={resetAll}>
                  {query && selectedGeneration ? "Clear search and filter" : query ? "Clear search" : "Clear filter"}
                </button>
              </div>
            ) : (
              <ol className="ab-rows" onKeyDown={onListKeyDown}>
                {filtered.map((ability) => {
                  const isSelected = selectedAbility?.name === ability.name;
                  return (
                    <li key={ability.name}>
                      <a
                        href={abilityHref(ability.name)}
                        className={`ab-row${isSelected ? " is-selected" : ""}`}
                        aria-current={isSelected ? "true" : undefined}
                        data-key={ability.name}
                        onClick={(event) => {
                          if (!isPlainLeftClick(event)) return;
                          event.preventDefault();
                          openFromList(ability.name);
                        }}
                      >
                        <Cursor className="ab-row__cursor" />
                        <span className="ab-row__name">{ability.label}</span>
                        {ability.effect ? <span className="ab-row__effect">{ability.effect}</span> : null}
                        <span className="ab-row__gen">
                          <span className="sr-only">Introduced in Gen </span>
                          {ability.generation ?? "—"}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </nav>

        <div className="ab-detail">
          {selectedAbility ? (
            <AbilityEntry
              ability={selectedAbility}
              detail={detail}
              onBack={backToList}
              onRetry={retryDetail}
              pokemonById={pokemonById}
              pokemonListPending={!pokemonList.data && !pokemonList.error}
            />
          ) : selectedName && loading ? (
            <EntryGhost onBack={backToList} />
          ) : selectedName && !abilityData.error ? (
            <article className="ab-entry" aria-labelledby="ab-missing-title">
              <EntryBar onBack={backToList} />
              <div className="win">
                <div className="empty">
                  <h2 className="empty__title" id="ab-missing-title">
                    No ability called &ldquo;{selectedName}&rdquo;
                  </h2>
                  <p>The link may be misspelled. Search the list for the ability instead.</p>
                </div>
              </div>
            </article>
          ) : (
            <div className="win ab-detail__empty">
              <div className="empty">
                <p className="empty__title">Pick an ability</p>
                <p>See exactly what it does and which Pokémon can have it, including as a Hidden Ability.</p>
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
    <div className="ab-entry__bar">
      <button type="button" className="btn btn--quiet ab-entry__back" onClick={onBack}>
        <Icon name="left" />
        Abilities
      </button>
    </div>
  );
}

function EntryGhost({ onBack }) {
  return (
    <div className="ab-entry" role="status">
      <EntryBar onBack={onBack} />
      <span className="sr-only">Loading ability…</span>
      <div className="ab-ghost" aria-hidden="true">
        <span className="skeleton ab-ghost__title" />
        <span className="skeleton ab-ghost__meta" />
        <span className="skeleton ab-ghost__block" />
      </div>
    </div>
  );
}

function AbilityEntry({ ability, detail, onBack, onRetry, pokemonById, pokemonListPending }) {
  const summary = ability.effect || "";
  const longEffect = useMemo(() => getEnglishEffect(detail.data), [detail.data]);
  const effectLines = useMemo(() => toEffectLines(longEffect, summary), [longEffect, summary]);

  return (
    <article className="ab-entry" aria-labelledby="ab-entry-title">
      <EntryBar onBack={onBack} />

      <header className="ab-id">
        <h2 className="ab-id__name" id="ab-entry-title">
          {ability.label}
        </h2>
        {ability.generation ? <p className="ab-id__meta">Introduced in Gen {ability.generation}</p> : null}
      </header>

      <div className="ab-entry__body">
        <section className="win ab-sec" aria-labelledby="ab-effect-title">
          <div className="win__head">
            <h3 className="win__title" id="ab-effect-title">
              Effect
            </h3>
          </div>
          <div className="win__body ab-effect">
            {summary ? <p className="ab-effect__summary">{summary}</p> : null}
            {effectLines.length > 0 ? (
              <ul className="ab-effect__lines">
                {effectLines.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            ) : null}
            {detail.loading ? (
              <div role="status">
                <span className="sr-only">Loading full description…</span>
                <SkeletonLines count={summary ? 2 : 3} />
              </div>
            ) : detail.error ? (
              <div className="ab-error" role="alert">
                <p>Couldn&rsquo;t load the full description from PokeAPI.</p>
                <button type="button" className="btn btn--sm" onClick={onRetry}>
                  Try again
                </button>
              </div>
            ) : !summary && effectLines.length === 0 ? (
              <p className="ab-muted">No description on record.</p>
            ) : null}
          </div>
        </section>

        <AbilityHolders
          key={ability.name}
          ability={ability}
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

function AbilityHolders({ ability, pokemonById, pokemonListPending }) {
  const [visibleCount, setVisibleCount] = useState(LEARNERS_PAGE_SIZE);

  const holders = useMemo(() => {
    const byId = new Map();
    for (const [id, isHidden] of ability?.pokemon || []) {
      // A few Pokémon list the same ability in a regular and the hidden slot; that's not hidden-only.
      const hidden = isHidden === 1 && byId.get(id)?.hidden !== false;
      const known = pokemonById.get(id);
      byId.set(id, {
        id,
        slug: known?.name || String(id),
        speciesId: known?.speciesId ?? id,
        types: known?.types || [],
        hidden,
      });
    }
    // National Dex order, with each species' forms right after it.
    return [...byId.values()].sort((a, b) => a.speciesId - b.speciesId || a.id - b.id);
  }, [ability, pokemonById]);

  const loading = pokemonListPending && holders.length > 0;
  const visible = holders.slice(0, visibleCount);
  const remaining = holders.length - visible.length;
  const hiddenCount = holders.filter((pokemon) => pokemon.hidden).length;

  return (
    <section className="win ab-sec ab-holders" aria-labelledby="ab-holders-title">
      <div className="win__head">
        <h3 className="win__title" id="ab-holders-title">
          Pokémon with this ability
        </h3>
        {!loading && holders.length > 0 ? <span className="ab-count num">{holders.length.toLocaleString()}</span> : null}
      </div>
      <div className="win__body">
        {loading ? (
          <div role="status">
            <span className="sr-only">Loading Pokémon…</span>
            <ul className="ab-mons" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <li key={index}>
                  <span className="ab-mon ab-mon--ghost">
                    <span className="skeleton ab-mon__sprite" />
                    <span className="skeleton ab-mon__name" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : holders.length === 0 ? (
          <p className="ab-muted">No Pokémon listed.</p>
        ) : (
          <>
            {hiddenCount > 0 ? (
              <p className="ab-muted ab-holders__note">
                <span className="stamp" aria-hidden="true">
                  Hidden
                </span>
                {hiddenCount === holders.length ? "Every Pokémon here has it as a Hidden Ability." : "Only as a Hidden Ability."}
              </p>
            ) : null}
            <ul className="ab-mons">
              {visible.map((pokemon) => (
                <li key={pokemon.id}>
                  <a
                    className="ab-mon"
                    href={buildPokemonPath(pokemon.slug)}
                    onClick={(event) => {
                      if (!isPlainLeftClick(event)) return;
                      event.preventDefault();
                      goToPokemon(pokemon.slug);
                    }}
                  >
                    <img
                      className="ab-mon__sprite"
                      src={`${SPRITE_BASE}/${pokemon.id}.png`}
                      alt=""
                      width="48"
                      height="48"
                      loading="lazy"
                      decoding="async"
                      onError={hideBrokenSprite}
                    />
                    <span className="ab-mon__name">{formatLearnerName(pokemon.slug)}</span>
                    <span className="ab-mon__types">
                      {pokemon.types.map((type) => (
                        <TypeTag key={type} typeName={type} icon={false} />
                      ))}
                      {pokemon.hidden ? (
                        <span className="stamp ab-mon__hidden" title="Hidden Ability">
                          <span aria-hidden="true">Hidden</span>
                          <span className="sr-only">(Hidden Ability)</span>
                        </span>
                      ) : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {remaining > 0 ? (
              <button
                type="button"
                className="btn ab-more"
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
