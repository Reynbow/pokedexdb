import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";
import { updatePokemonLocation } from "./utils/url.js";
import { getTypeIconUrl } from "./utils/typeIcons.js";
import { formatPokemonName } from "./utils/pokemonNames.js";
import { loadAbilityData, loadPokemonList } from "./data/staticData.js";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const LEARNERS_PAGE_SIZE = 60;

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

function useAbilityDetail(name) {
  const [result, setResult] = useState({ name: null, data: null, error: null });
  useEffect(() => {
    if (!name) return undefined;
    let cancelled = false;
    fetchAbilityDetail(name).then(
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

/* ---------------------------------------------------------------- Page */

export default function AbilitiesPage() {
  const abilityData = useStaticResource(loadAbilityData);
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState(() => readSearchParam("a"));

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

  const abilitiesByName = useMemo(() => new Map(abilities.map((ability) => [ability.name, ability])), [abilities]);
  const selectedAbility = (selectedName && abilitiesByName.get(selectedName)) || null;

  const filtered = useMemo(() => {
    const search = toSearchKey(query);
    return search ? abilities.filter((ability) => ability.searchKey.includes(search)) : abilities;
  }, [abilities, query]);

  const detail = useAbilityDetail(selectedAbility ? selectedAbility.name : null);
  const pokemonList = useStaticResource(selectedAbility ? loadPokemonList : null);
  const pokemonById = useMemo(
    () => new Map((pokemonList.data || []).filter((pokemon) => pokemon.id != null).map((pokemon) => [pokemon.id, pokemon])),
    [pokemonList.data]
  );

  const selectAbility = useCallback((name) => {
    const url = new URL(window.location.href);
    ["p", "i", "m"].forEach((key) => url.searchParams.delete(key));
    if (url.searchParams.get("a") !== name) {
      url.searchParams.set("a", name);
      window.history.pushState({}, "", url);
    }
    setSelectedName(name);
  }, []);

  const loading = !abilityData.data && !abilityData.error;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container">
          <h1 className="title">Abilities</h1>
          <p className="subtitle">Search and explore Pokemon abilities</p>
          <CategoryToggle />
          <div className="search-row">
            <input
              className="search"
              placeholder="Search Abilities"
              aria-label="Search abilities"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="reset-button" onClick={() => setQuery("")}>
              Reset
            </button>
          </div>
        </div>
      </header>
      <main className="container">
        {abilityData.error ? (
          <div className="list-empty">Failed to load abilities.</div>
        ) : loading ? (
          <div className="list-empty">Loading abilities…</div>
        ) : filtered.length === 0 ? (
          <div className="list-empty">No abilities found.</div>
        ) : (
          <section className="content split">
            <div className="list-panel">
              <div className="list-scroll">
                <div className="list items-list">
                  {filtered.map((ability) => {
                    const isSelected = selectedAbility?.name === ability.name;
                    return (
                      <button
                        key={ability.name}
                        type="button"
                        className={`item-row${isSelected ? " is-selected" : ""}`}
                        onClick={() => selectAbility(ability.name)}
                        aria-pressed={isSelected}
                      >
                        <span className="item-name proper-name">{ability.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <aside className="detail-panel">
              <div className="detail-inner moves-detail-inner">
                <AbilityDetailPanel ability={selectedAbility} detail={detail} />
                <AbilityLearnersPanel
                  key={selectedAbility?.name || "none"}
                  ability={selectedAbility}
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

function AbilityDetailPanel({ ability, detail }) {
  const summary = ability?.effect || "";
  const longEffect = useMemo(() => getEnglishEffect(detail.data), [detail.data]);
  const effectLines = useMemo(() => toEffectLines(longEffect, summary), [longEffect, summary]);

  if (!ability) {
    return (
      <div className="move-detail-frame">
        <div className="detail-title detail-title-top" style={{ display: "none" }} />
        <div className="move-hero-container" style={{ display: "none" }}>
          <div className="detail-hero single-col" />
        </div>
      </div>
    );
  }

  return (
    <div className="move-detail-frame">
      <div className="detail-title detail-title-top">
        <h2 className="proper-name">{ability.label}</h2>
      </div>
      <div className="move-hero-container">
        <div className="detail-hero single-col">
          <div className="hero-right">
            <div className="main-col">
              {summary || effectLines.length > 0 ? (
                <div className="effect-window">
                  {summary ? <div className="effect-summary">{summary}</div> : null}
                  {effectLines.length > 0 ? (
                    <ul className="effect-list">
                      {effectLines.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {ability.generation ? (
                <section className="about">
                  <div className="about-list" style={{ padding: 0 }}>
                    <div className="about-row">
                      <div className="label">Introduced</div>
                      <div className="value">Gen {ability.generation}</div>
                    </div>
                  </div>
                </section>
              ) : null}
              {detail.loading ? (
                <p className="moves-inline-status">Loading full description…</p>
              ) : detail.error ? (
                <p className="moves-inline-status">Couldn&rsquo;t load the full description from PokeAPI.</p>
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

function AbilityLearnersPanel({ ability, pokemonById, pokemonListPending }) {
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

  if (!ability) {
    return <aside className="learners-panel" style={{ display: "none" }} />;
  }

  const loading = pokemonListPending && holders.length > 0;
  const visible = holders.slice(0, visibleCount);
  const remaining = holders.length - visible.length;

  return (
    <aside className="learners-panel">
      <h4 className="learners-title">
        Has Ability
        {!loading && holders.length > 0 ? (
          <span className="learners-count">({holders.length.toLocaleString()})</span>
        ) : null}
      </h4>
      {loading ? (
        <div className="learners-empty">Loading</div>
      ) : holders.length === 0 ? (
        <div className="learners-empty">No Pokémon listed</div>
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
                  title={`Open ${name}${pokemon.hidden ? " (Hidden Ability)" : ""}`}
                >
                  <img
                    className="learners-poke-sprite"
                    src={`${SPRITE_BASE}/${pokemon.id}.png`}
                    alt=""
                    loading="lazy"
                    onError={hideBrokenSprite}
                  />
                  <span className="label proper-name">
                    {name}
                    {pokemon.hidden ? <span className="learners-hidden-tag">Hidden</span> : null}
                  </span>
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
