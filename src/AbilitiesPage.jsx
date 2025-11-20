import React, { useMemo, useState, useEffect, useCallback } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";
import { updatePokemonLocation } from "./utils/url.js";
import { getTypeIconUrl } from "./utils/typeIcons.js";

// Abilities to exclude (no description and no pokemon data)
const EXCLUDED_ABILITIES = new Set([
  "as-one-glastrier",
  "as-one-spectrier",
  // Pokemon Conquest abilities
  "aqua-boost",
  "black-hole",
  "bodyguard",
  "bonanza",
  "calming",
  "celebrate",
  "climber",
  "confidence",
  "conqueror",
  "daze",
  "decoy",
  "deep-sleep",
  "disgust",
  "dodge",
  "explode",
  "flame-boost",
  "fortune",
  "frighten",
  "frostbite",
  "grass-cloak",
  "gulp",
  "herbivore",
  "hero",
  "high-rise",
  "hot-blooded",
  "instinct",
  "interference",
  "jagged-edge",
  "last-bastion",
  "life-force",
  "lunchbox",
  "lullaby",
  "medic",
  "melee",
  "mood-maker",
  "mountaineer",
  "omnipotent",
  "parry",
  "perception",
  "power-nap",
  "pride",
  "run-up",
  "sandpit",
  "sequence",
  "shackle",
  "shadow-dash",
  "share",
  "shield",
  "skater",
  "spirit",
  "sponge",
  "sprint",
  "stealth",
  "tenacity",
  "thrust",
  "vanguard",
  "warm-blanket",
  "wave-rider",
]);

export default function AbilitiesPage() {
  const [query, setQuery] = useState("");
  const [abilities, setAbilities] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedAbility, setSelectedAbility] = useState(null);

  useEffect(() => {
    // On mount, ensure URL only carries the Abilities param
    try {
      const u = new URL(window.location.href);
      ["p", "i", "m"].forEach((k) => u.searchParams.delete(k));
      window.history.replaceState({}, "", u);
    } catch {}

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("https://pokeapi.co/api/v2/ability?limit=20000");
        const j = await r.json();
        const allAbilities = Array.isArray(j.results) ? j.results : [];
        // Filter out excluded abilities
        const filteredAbilities = allAbilities.filter((a) => !EXCLUDED_ABILITIES.has(a.name));
        if (!cancelled) setAbilities(filteredAbilities);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = q ? abilities.filter((a) => a.name.includes(q)) : abilities;
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [abilities, query]);

  // Function to read URL and select ability
  const resolveAbilityFromUrl = useCallback(() => {
    const u = new URL(window.location.href);
    const name = u.searchParams.get("a");
    if (!name) {
      setSelectedAbility(null);
      return;
    }
    const found = abilities.find((ab) => ab.name === name);
    if (found) {
      setSelectedAbility(found);
    }
  }, [abilities]);

  // Check URL on mount and when abilities load
  useEffect(() => {
    if (abilities.length > 0) {
      resolveAbilityFromUrl();
    }
  }, [abilities, resolveAbilityFromUrl]);

  // Listen for back/forward navigation and location changes
  useEffect(() => {
    const onPop = () => {
      resolveAbilityFromUrl();
    };
    const onLocationChange = () => {
      resolveAbilityFromUrl();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("locationchange", onLocationChange);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("locationchange", onLocationChange);
    };
  }, [resolveAbilityFromUrl]);

  function selectAbility(ab) {
    const u = new URL(window.location.href);
    ["p", "i", "m"].forEach((k) => u.searchParams.delete(k));
    u.searchParams.set("a", ab.name);
    window.history.pushState({}, "", u);
    setSelectedAbility(ab);
  }

  function clearSelection() {
    const u = new URL(window.location.href);
    u.searchParams.delete("a");
    window.history.pushState({}, "", u);
    setSelectedAbility(null);
  }

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
          <h1 className="title">Abilities</h1>
          <p className="subtitle">Search and explore Pokemon abilities</p>
          <CategoryToggle />
          <div className="search-row">
            <input
              className="search"
              placeholder="Search Abilities"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="reset-button"
              onClick={() => setQuery("")}
            >
              Reset
            </button>
          </div>
        </div>
      </header>
      <main className="container">
        {error ? (
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
                  {filtered.map((a) => (
                    <button
                      key={a.name}
                      type="button"
                      className={`item-row${selectedAbility?.name === a.name ? " is-selected" : ""}`}
                      onClick={() => selectAbility(a)}
                      aria-pressed={selectedAbility?.name === a.name}
                    >
                      <span className="item-name">{a.name.replaceAll("-", " ")}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <aside className="detail-panel">
              <div className="detail-inner moves-detail-inner">
                <AbilityDetailPanel ability={selectedAbility} onClose={clearSelection} />
                <AbilityLearnersPanel ability={selectedAbility} />
              </div>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}


function AbilityDetailPanel({ ability, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const englishEffect = useMemo(() => {
    const entries = Array.isArray(data?.effect_entries) ? data.effect_entries : [];
    const en = entries.find((e) => e?.language?.name === "en");
    return en ? (en.effect || en.short_effect || "") : "";
  }, [data]);

  const englishShortEffect = useMemo(() => {
    const entries = Array.isArray(data?.effect_entries) ? data.effect_entries : [];
    const en = entries.find((e) => e?.language?.name === "en");
    return en ? (en.short_effect || "") : "";
  }, [data]);

  const effectLines = useMemo(() => {
    const raw = String(englishEffect || "");
    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (!cleaned) return [];
    const shortEffectCleaned = String(englishShortEffect || "").replace(/\s+/g, " ").trim();
    // If the full effect is the same as the short effect, don't show lines (to avoid duplication)
    if (cleaned === shortEffectCleaned && shortEffectCleaned) return [];
    return cleaned
      .split(/(?<=[.!?])\s+|;\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [englishEffect, englishShortEffect]);

  const humanize = (s) => String(s || "").replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!ability) return;
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const url = `https://pokeapi.co/api/v2/ability/${ability.name}`;
        const j = await fetch(url).then((r) => r.json());
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ability]);

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
        <h2>{ability.name.replaceAll("-", " ")}</h2>
      </div>
      <div className="move-hero-container">
        <div className="detail-hero single-col">
          <div className="hero-right">
            {loading ? (
              <div className="list-empty">Loading</div>
            ) : error ? (
              <div className="list-empty">Failed to load ability.</div>
            ) : (
              <div className="main-col">
                {englishShortEffect || englishEffect ? (
                  <div className="effect-window">
                    {englishShortEffect ? <div className="effect-summary">{englishShortEffect}</div> : null}
                    {effectLines.length > 0 ? (
                      <ul className="effect-list">
                        {effectLines.map((line, idx) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AbilityLearnersPanel({ ability }) {
  const [data, setData] = useState(null);
  const [learners, setLearners] = useState([]);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [learnersError, setLearnersError] = useState(null);
  const [typesMap, setTypesMap] = useState(() => new Map());

  const humanize = (s) => String(s || "").replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!ability) {
        setData(null);
        setLearners([]);
        return;
      }
      setLearnersLoading(true);
      setLearnersError(null);
      try {
        const url = `https://pokeapi.co/api/v2/ability/${ability.name}`;
        const j = await fetch(url).then((r) => r.json());
        if (!cancelled) {
          setData(j);
          const entries = Array.isArray(j?.pokemon) ? j.pokemon : [];
          const list = entries
            .map((entry) => {
              const name = entry?.pokemon?.name;
              const url = entry?.pokemon?.url;
              if (!name || !url) return null;
              const parts = String(url).split("/").filter(Boolean);
              const id = parts[parts.length - 1];
              return id ? { name, id, url } : null;
            })
            .filter(Boolean)
            .slice(0, 60);
          setLearners(list);
        }
      } catch (e) {
        if (!cancelled) setLearnersError(e);
      } finally {
        if (!cancelled) setLearnersLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ability]);

  const goToPokemon = useCallback((pokemon) => {
    if (!pokemon) return;
    const slug = pokemon.name || String(pokemon.id || "").trim();
    if (!slug) return;
    updatePokemonLocation(slug, { pruneKeys: ["i", "m", "a", "p"] });
    try {
      window.location.hash = "";
    } catch {}
  }, []);

  // Load types for learners to render type pills
  useEffect(() => {
    let cancelled = false;
    async function loadTypes() {
      const pending = learners.filter((p) => p && !typesMap.has(p.id));
      if (pending.length === 0) return;
      try {
        const results = await Promise.all(
          pending.map(async (p) => {
            try {
              const j = await fetch(p.url).then((r) => r.json());
              const types = Array.isArray(j?.types)
                ? j.types.map((t) => t?.type?.name).filter(Boolean)
                : [];
              return { id: p.id, types };
            } catch {
              return { id: p.id, types: [] };
            }
          })
        );
        if (!cancelled) {
          setTypesMap((prev) => {
            const next = new Map(prev);
            for (const res of results) next.set(res.id, res.types);
            return next;
          });
        }
      } catch {}
    }
    loadTypes();
    return () => { cancelled = true; };
  }, [learners, typesMap]);

  if (!ability) {
    return <aside className="learners-panel" style={{ display: 'none' }} />;
  }

  return (
    <aside className="learners-panel">
      <h4 className="learners-title">Has Ability</h4>
      {learnersLoading ? (
        <div className="learners-empty">Loading</div>
      ) : learnersError ? (
        <div className="learners-empty">Failed to load</div>
      ) : learners.length === 0 ? (
        <div className="learners-empty">No data</div>
      ) : (
        <ul className="learners-list" role="list">
          {learners.map((p) => {
            const types = typesMap.get(p.id) || [];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className="learners-poke-button"
                  onClick={() => goToPokemon(p)}
                  title={`Open ${humanize(p.name)}`}
                >
                  <img
                    className="learners-poke-sprite"
                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`}
                    alt=""
                    loading="lazy"
                  />
                  <span className="label">{humanize(p.name)}</span>
                  <span className="types-vertical">
                    {types.map((t) => (
                      <span key={t} className={`type-chip type-${t}`}>
                        <img 
                          src={getTypeIconUrl(t)} 
                          alt={t} 
                          className="type-icon"
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                        <span className="type-name">{t}</span>
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

