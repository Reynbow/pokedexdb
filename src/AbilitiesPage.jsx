import React, { useMemo, useState, useEffect } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";

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
        if (!cancelled) setAbilities(Array.isArray(j.results) ? j.results : []);
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

  useEffect(() => {
    const onPop = () => {
      const u = new URL(window.location.href);
      const name = u.searchParams.get("a");
      if (!name) {
        setSelectedAbility(null);
        return;
      }
      const found = abilities.find((ab) => ab.name === name);
      if (found) setSelectedAbility(found);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [abilities]);

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
              <div className="detail-inner">
                <AbilityDetailPanel ability={selectedAbility} onClose={clearSelection} />
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
  const [learners, setLearners] = useState([]);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [learnersError, setLearnersError] = useState(null);
  const [typesMap, setTypesMap] = useState(() => new Map()); // id -> [types]

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
    return cleaned
      .split(/(?<=[.!?])\s+|;\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [englishEffect]);

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

  useEffect(() => {
    let cancelled = false;
    async function loadLearners() {
      const entries = Array.isArray(data?.pokemon) ? data.pokemon : [];
      if (entries.length === 0) { setLearners([]); return; }
      setLearnersLoading(true);
      setLearnersError(null);
      try {
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
        if (!cancelled) setLearners(list);
      } catch (e) {
        if (!cancelled) setLearnersError(e);
      } finally {
        if (!cancelled) setLearnersLoading(false);
      }
    }
  function goToPokemonById(id) {
    const u = new URL(window.location.href);
    u.searchParams.set("p", String(id));
    window.history.replaceState({}, "", u);
    window.location.hash = ""; // navigate to main Pokemon page
  }
    loadLearners();
    return () => { cancelled = true; };
  }, [data?.pokemon]);

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

  if (!ability) return <div />;

  return (
    <>
      <div className="detail-title detail-title-top">
        <h2>{ability.name.replaceAll("-", " ")}</h2>
      </div>
      <div className="detail-hero single-col">
        <div className="hero-right hero-right-split">
          {loading ? (
            <div className="list-empty">Loading</div>
          ) : error ? (
            <div className="list-empty">Failed to load ability.</div>
          ) : (
            <>
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

                {/* Removed Known Pokémon section as requested */}
              </div>

              <aside className="side-col">
                <h4 className="side-title">Has Ability</h4>
                {learnersLoading ? (
                  <div className="list-empty">Loading</div>
                ) : learnersError ? (
                  <div className="list-empty">Failed to load</div>
                ) : learners.length === 0 ? (
                  <div className="list-empty">No data</div>
                ) : (
                  <ul className="side-list" role="list">
                    {learners.map((p) => {
                      const types = typesMap.get(p.id) || [];
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="side-poke-button"
                            onClick={() => goToPokemonById(p.id)}
                            title={`Open ${humanize(p.name)}`}
                          >
                            <img
                              className="side-poke-sprite"
                              src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`}
                              alt=""
                              loading="lazy"
                            />
                            <span className="label">{humanize(p.name)}</span>
                            <span className="types-vertical">
                              {types.map((t) => (
                                <span key={t} className={`type-chip type-${t}`}>{t}</span>
                              ))}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </aside>
            </>
          )}
        </div>
      </div>
    </>
  );
}

