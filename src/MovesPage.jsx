import React, { useMemo, useState, useEffect } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";

export default function MovesPage() {
  const [query, setQuery] = useState("");
  const [moves, setMoves] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMove, setSelectedMove] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [typeMovesMap, setTypeMovesMap] = useState(() => new Map());
  const [typeLoading, setTypeLoading] = useState(() => new Map());
  const [typeError, setTypeError] = useState(() => new Map());
  const [moveTypeMap, setMoveTypeMap] = useState(() => new Map());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("https://pokeapi.co/api/v2/move?limit=20000");
        const j = await r.json();
        if (!cancelled) setMoves(Array.isArray(j.results) ? j.results : []);
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

  const MOVE_TYPES = [
    "normal","fire","water","electric","grass","ice","fighting","poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"
  ];

  function normalizeMoveGroupName(name) {
    const n = String(name || "").toLowerCase();
    // Group Z-move variants like "breakneck-blitz--physical" and "--special"
    if (n.includes("--")) {
      return n.split("--")[0];
    }
    return n;
  }

  const activeTypeSet = useMemo(() => {
    if (!selectedType) return null;
    return typeMovesMap.get(selectedType) || null;
  }, [selectedType, typeMovesMap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (selectedType && !activeTypeSet) return [];
    const base = selectedType ? moves.filter((m) => activeTypeSet.has(m.name)) : moves;
    const result = q ? base.filter((m) => m.name.includes(q)) : base;
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [moves, query, selectedType, activeTypeSet]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const m of filtered) {
      const key = normalizeMoveGroupName(m.name);
      const existing = map.get(key);
      if (existing) {
        existing.variants.push(m);
      } else {
        map.set(key, { key, variants: [m] });
      }
    }
    const groups = Array.from(map.values());
    groups.forEach((g) => g.variants.sort((a, b) => a.name.localeCompare(b.name)));
    return groups.sort((a, b) => a.key.localeCompare(b.key));
  }, [filtered]);

  const selectedGroupKey = useMemo(() => selectedMove ? normalizeMoveGroupName(selectedMove.name) : null, [selectedMove]);

  const variantsForSelected = useMemo(() => {
    if (!selectedMove) return [];
    const key = normalizeMoveGroupName(selectedMove.name);
    return [...moves.filter((m) => normalizeMoveGroupName(m.name) === key)].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedMove, moves]);

  async function ensureTypeLoaded(typeName) {
    if (typeMovesMap.has(typeName) || typeLoading.get(typeName)) return;
    setTypeLoading((m) => new Map(m).set(typeName, true));
    setTypeError((m) => new Map(m).set(typeName, null));
    try {
      const url = `https://pokeapi.co/api/v2/type/${typeName}`;
      const j = await fetch(url).then((r) => r.json());
      const list = Array.isArray(j?.moves) ? j.moves : [];
      const set = new Set(list.map((x) => x.name));
      setTypeMovesMap((m) => new Map(m).set(typeName, set));
      setMoveTypeMap((m) => {
        const nm = new Map(m);
        for (const n of set) if (!nm.has(n)) nm.set(n, typeName);
        return nm;
      });
    } catch (e) {
      setTypeError((m) => new Map(m).set(typeName, e));
    } finally {
      setTypeLoading((m) => new Map(m).set(typeName, false));
    }
  }

  function onClickType(typeName) {
    if (selectedType === typeName) {
      setSelectedType(null);
      return;
    }
    setSelectedType(typeName);
    ensureTypeLoaded(typeName);
  }

  function onClickAll() {
    setSelectedType(null);
  }

  // Preload all types in the background to color-code move list
  useEffect(() => {
    MOVE_TYPES.forEach((t) => ensureTypeLoaded(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPrimaryVariant(variants) {
    if (!Array.isArray(variants) || variants.length === 0) return null;
    // Prefer a variant without explicit form suffix; else first alphabetically
    const noSuffix = variants.find((v) => !/--(physical|special)$/.test(v.name));
    return noSuffix || variants[0];
  }

  useEffect(() => {
    const onPop = () => {
      const u = new URL(window.location.href);
      const name = u.searchParams.get("m");
      if (!name) {
        setSelectedMove(null);
        return;
      }
      const found = moves.find((mv) => mv.name === name);
      if (found) setSelectedMove(found);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [moves]);

  function selectMove(mv) {
    const u = new URL(window.location.href);
    u.searchParams.set("m", mv.name);
    window.history.pushState({}, "", u);
    setSelectedMove(mv);
  }

  function clearSelection() {
    const u = new URL(window.location.href);
    u.searchParams.delete("m");
    window.history.pushState({}, "", u);
    setSelectedMove(null);
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
          <h1 className="title">Moves</h1>
          <p className="subtitle">Search and explore all Pokemon moves</p>
          <CategoryToggle />
          <div className="search-row">
            <input
              className="search"
              placeholder="Search Moves"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="reset-button"
              onClick={() => {
                setQuery("");
                setSelectedType(null);
              }}
            >
              Reset
            </button>
          </div>
          <div className="items-filter-row" role="tablist" aria-label="Move types">
            {/* All Moves default filter */}
            {(() => {
              const isOn = selectedType == null;
              return (
                <button
                  key="all"
                  type="button"
                  className={`filter-chip${isOn ? " is-on" : ""}`}
                  aria-pressed={isOn}
                  onClick={onClickAll}
                >
                  All Moves
                </button>
              );
            })()}
            {MOVE_TYPES.map((t) => {
              const isOn = selectedType === t;
              const isLoading = typeLoading.get(t);
              return (
                <button
                  key={t}
                  type="button"
                  className={`filter-chip ${`type-${t}`}${isOn ? " is-on" : ""}`}
                  aria-pressed={isOn}
                  onClick={() => onClickType(t)}
                  title={isLoading ? "Loading…" : undefined}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </header>
      <main className="container">
        {error ? (
          <div className="list-empty">Failed to load moves.</div>
        ) : loading ? (
          <div className="list-empty">Loading moves…</div>
        ) : filtered.length === 0 ? (
          <div className="list-empty">No moves found.</div>
        ) : (
          <section className="content split">
            <div className="list-panel">
              <div className="list-scroll">
                <div className="list items-list">
                  {grouped.map((g) => {
                    const primary = getPrimaryVariant(g.variants);
                    const isSelected = selectedGroupKey === g.key;
                    const typeForGroup = primary ? moveTypeMap.get(primary.name) : null;
                    return (
                      <button
                        key={g.key}
                        type="button"
                        className={`item-row${isSelected ? " is-selected" : ""}${typeForGroup ? ` move-type-${typeForGroup}` : ""}`}
                        onClick={() => primary && selectMove(primary)}
                        aria-pressed={isSelected}
                      >
                        <span className="item-name">{g.key.replaceAll("-", " ")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <aside className="detail-panel">
              <div className="detail-inner">
                <MoveDetailPanel
                  move={selectedMove}
                  onClose={clearSelection}
                  variants={variantsForSelected}
                  onSelectVariant={(name) => {
                    const found = moves.find((mv) => mv.name === name);
                    if (found) selectMove(found);
                  }}
                />
              </div>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}


function MoveDetailPanel({ move, onClose, variants = [], onSelectVariant }) {
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

  const englishFlavor = useMemo(() => {
    const entries = Array.isArray(data?.flavor_text_entries) ? data.flavor_text_entries : [];
    const en = entries.find((e) => e?.language?.name === "en");
    return en ? (en.text || en.flavor_text || "") : "";
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
      if (!move) return;
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const url = `https://pokeapi.co/api/v2/move/${move.name}`;
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
  }, [move]);

  useEffect(() => {
    let cancelled = false;
    async function loadLearners() {
      if (!data?.learned_by_pokemon) { setLearners([]); return; }
      setLearnersLoading(true);
      setLearnersError(null);
      try {
        const list = Array.isArray(data.learned_by_pokemon) ? data.learned_by_pokemon : [];
        const objs = list
          .map((p) => {
            const name = p?.name;
            const url = p?.url;
            if (!name || !url) return null;
            const parts = String(url).split("/").filter(Boolean);
            const id = parts[parts.length - 1];
            return id ? { name, id, url } : null;
          })
          .filter(Boolean)
          .slice(0, 60);
        if (!cancelled) setLearners(objs);
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
  }, [data?.learned_by_pokemon]);

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

  if (!move) return <div />;

  return (
    <>
      <button className="close" onClick={onClose} aria-label="Close">
        <span className="close-icon" aria-hidden="true" />
      </button>
      <div className="detail-title detail-title-top">
        <h2>{move.name.replaceAll("-", " ")}</h2>
      </div>
      <div className="detail-hero single-col">
        <div className="hero-right hero-right-split">
          {loading ? (
            <div className="list-empty">Loading</div>
          ) : error ? (
            <div className="list-empty">Failed to load move.</div>
          ) : (
            <>
              <div className="main-col">
                <section className="about">
                  <h3 className="list-subheading" style={{ textAlign: "left" }}>Overview</h3>
                  <div className="about-list" style={{padding: 0}}>
                    <div className="about-row">
                      <div className="label">Type</div>
                      <div className="value">
                        {data?.type?.name ? (
                          <span className={`type-chip type-${data.type.name}`}>{humanize(data.type.name)}</span>
                        ) : (
                          <span>Unknown</span>
                        )}
                      </div>
                    </div>

                    <div className="about-row">
                      <div className="label">Category</div>
                      <div className="value">
                        {(() => {
                          const cat = data?.damage_class?.name || null;
                          const cls = cat ? `move-category-chip move-category-${cat}` : 'move-category-chip';
                          const src = cat ? `/moves/${cat}.png` : null;
                          return (
                            <span className={cls}>
                              {src ? (
                                <img className="move-meta-icon" src={src} alt="" aria-hidden="true" />
                              ) : null}
                              {cat ? humanize(cat) : 'Unknown'}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="about-row">
                      <div className="label">Stats</div>
                      <div className="value move-stats-group">
                        <span className="move-stat-chip">Power: {data?.power ?? '—'}</span>
                        <span className="move-stat-chip">Accuracy: {data?.accuracy ?? '—'}</span>
                        <span className="move-stat-chip">PP: {data?.pp ?? '—'}</span>
                        <span className="move-stat-chip">Priority: {data?.priority ?? 0}</span>
                      </div>
                    </div>
                  </div>
                  {Array.isArray(variants) && variants.length > 1 ? (
                    <div style={{ marginTop: 10 }}>
                      <h3 className="list-subheading" style={{ textAlign: "left" }}>Alternate Forms</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {variants
                          .filter((v) => v.name !== move.name)
                          .map((v) => (
                            <button
                              key={v.name}
                              type="button"
                              className="neutral-chip"
                              onClick={() => onSelectVariant && onSelectVariant(v.name)}
                            >
                              {humanize(v.name)}
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </section>

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

                {Array.isArray(data?.flavor_text_entries) && data.flavor_text_entries.length > 0 ? (
                  <section className="about">
                    <div className="flavor-window">
                      {data.flavor_text_entries
                        .filter((e) => e?.language?.name === "en")
                        .slice(0, 6)
                        .map((e, idx) => (
                          <div key={idx} className="flavor-row">
                            <div className="flavor-meta">{humanize(e.version_group?.name || e.version?.name || "")}</div>
                            <div className="flavor-text">{e.text || e.flavor_text}</div>
                          </div>
                        ))}
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="side-col">
                <h4 className="side-title">Learnt By</h4>
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

