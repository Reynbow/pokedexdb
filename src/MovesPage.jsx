import React, { useMemo, useState, useEffect, useCallback } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";
import { updatePokemonLocation } from "./utils/url.js";
import { getTypeIconUrl } from "./utils/typeIcons.js";

export default function MovesPage() {
  const [query, setQuery] = useState("");
  const [moves, setMoves] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMove, setSelectedMove] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedDamageClass, setSelectedDamageClass] = useState(null); // 'physical' | 'special' | 'status'
  const [priorityOnly, setPriorityOnly] = useState(false); // true => priority > 0
  const [typeMovesMap, setTypeMovesMap] = useState(() => new Map());
  const [typeLoading, setTypeLoading] = useState(() => new Map());
  const [typeError, setTypeError] = useState(() => new Map());
  const [moveTypeMap, setMoveTypeMap] = useState(() => new Map());
  const [moveMetaMap, setMoveMetaMap] = useState(() => new Map()); // name -> {power, accuracy, pp, priority, damage_class}

  useEffect(() => {
    // On mount, ensure URL only carries the Moves param
    try {
      const u = new URL(window.location.href);
      ["p", "i", "a"].forEach((k) => u.searchParams.delete(k));
      window.history.replaceState({}, "", u);
    } catch {}

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
    const needsMeta = !!(selectedDamageClass || priorityOnly);
    let afterMeta = result;
    if (needsMeta) {
      afterMeta = result.filter((m) => {
        const meta = moveMetaMap.get(m.name);
        if (!meta) return false;
        if (selectedDamageClass && meta.damage_class !== selectedDamageClass) return false;
        if (priorityOnly && (meta.priority ?? 0) <= 0) return false;
        return true;
      });
    }
    return [...afterMeta].sort((a, b) => a.name.localeCompare(b.name));
  }, [moves, query, selectedType, activeTypeSet, selectedDamageClass, priorityOnly, moveMetaMap]);

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

  // Background-load metadata when meta filters are active
  useEffect(() => {
    const needsMeta = !!(selectedDamageClass || priorityOnly);
    if (!needsMeta) return;
    const q = query.trim().toLowerCase();
    const base = selectedType && activeTypeSet ? moves.filter((m) => activeTypeSet.has(m.name)) : moves;
    const result = q ? base.filter((m) => m.name.includes(q)) : base;
    const toFetch = [];
    for (const m of result) {
      if (!moveMetaMap.has(m.name)) toFetch.push(m.name);
      if (toFetch.length >= 200) break;
    }
    if (toFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const chunks = [];
        for (let i = 0; i < toFetch.length; i += 25) chunks.push(toFetch.slice(i, i + 25));
        for (const names of chunks) {
          const results = await Promise.all(names.map(async (name) => {
            try {
              const j = await fetch(`https://pokeapi.co/api/v2/move/${name}`).then((r) => r.json());
              return { name, power: j?.power ?? null, accuracy: j?.accuracy ?? null, pp: j?.pp ?? null, priority: j?.priority ?? 0, damage_class: j?.damage_class?.name || null };
            } catch {
              return { name, power: null, accuracy: null, pp: null, priority: 0, damage_class: null };
            }
          }));
          if (cancelled) return;
          setMoveMetaMap((prev) => {
            const next = new Map(prev);
            for (const m of results) next.set(m.name, m);
            return next;
          });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [selectedDamageClass, priorityOnly, query, selectedType, activeTypeSet, moves, moveMetaMap]);

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

  // Function to read URL and select move
  const resolveMoveFromUrl = useCallback(() => {
    const u = new URL(window.location.href);
    const name = u.searchParams.get("m");
    if (!name) {
      setSelectedMove(null);
      return;
    }
    const found = moves.find((mv) => mv.name === name);
    if (found) {
      setSelectedMove(found);
    }
  }, [moves]);

  // Check URL on mount and when moves load
  useEffect(() => {
    if (moves.length > 0) {
      resolveMoveFromUrl();
    }
  }, [moves, resolveMoveFromUrl]);

  // Listen for back/forward navigation and location changes
  useEffect(() => {
    const onPop = () => {
      resolveMoveFromUrl();
    };
    const onLocationChange = () => {
      resolveMoveFromUrl();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("locationchange", onLocationChange);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("locationchange", onLocationChange);
    };
  }, [resolveMoveFromUrl]);

  function selectMove(mv) {
    const u = new URL(window.location.href);
    ["p", "i", "a"].forEach((k) => u.searchParams.delete(k));
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
          <div className="filters-desktop">
            <div className="filters-row moves-filters">
              {/* Type group */}
              <div className="filter-box-wrap">
                <div className="filter-box-title">Type</div>
                <div className="filter-box type-filters">
                  {(() => {
                    const isOn = selectedType == null;
                    return (
                      <button
                        key="all"
                        type="button"
                        className={`neutral-chip${isOn ? " is-on" : ""}`}
                        aria-pressed={isOn}
                        onClick={onClickAll}
                      >
                        All
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
                        className={`type-chip ${`type-${t}`}${isOn ? " is-on" : ""}`}
                        aria-pressed={isOn}
                        onClick={() => onClickType(t)}
                        title={isLoading ? "Loading…" : undefined}
                      >
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
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category group */}
              <div className="filter-box-wrap">
                <div className="filter-box-title">Category</div>
                <div className="filter-box special-filters">
                  {['physical','special','status'].map((c) => {
                    const isOn = selectedDamageClass === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`special-filter-chip${isOn ? ' is-on' : ''}`}
                        aria-pressed={isOn}
                        onClick={() => setSelectedDamageClass(isOn ? null : c)}
                      >
                        {c}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`special-filter-chip${priorityOnly ? ' is-on' : ''}`}
                    aria-pressed={priorityOnly}
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
                        {typeForGroup ? (
                          <img
                            src={getTypeIconUrl(typeForGroup)}
                            alt=""
                            className="type-icon type-icon-bg"
                            loading="lazy"
                            aria-hidden="true"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : null}
                        <span className="item-name">{g.key.replaceAll("-", " ")}</span>
                        {typeForGroup ? (
                          <img
                            src={getTypeIconUrl(typeForGroup)}
                            alt={typeForGroup}
                            className="type-icon item-type-icon"
                            loading="lazy"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
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
                  onClose={clearSelection}
                  variants={variantsForSelected}
                  onSelectVariant={(name) => {
                    const found = moves.find((mv) => mv.name === name);
                    if (found) selectMove(found);
                  }}
                />
                <MoveLearnersPanel move={selectedMove} />
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

  const mentionsStages = useMemo(() => {
    const text = String(englishEffect || "").toLowerCase();
    if (!text.includes("stage")) return false;
    return /(raise|raises|boost|boosts|increase|increases|lower|lowers|decrease|decreases|drop|drops)/.test(text);
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

  return (
    <div className="move-detail-frame">
      <div className="detail-title detail-title-top">
        <h2>{move.name.replaceAll("-", " ")}</h2>
      </div>
      <div className="move-hero-container">
        <div className="detail-hero single-col">
        <div className="hero-right">
          {loading ? (
            <div className="list-empty">Loading</div>
          ) : error ? (
            <div className="list-empty">Failed to load move.</div>
          ) : (
            <div className="main-col">
                <section className="about">
                  <h3 className="list-subheading" style={{ textAlign: "left" }}>Overview</h3>
                  <div className="about-list" style={{padding: 0}}>
                    <div className="about-row">
                      <div className="label">Type</div>
                      <div className="value">
                        {data?.type?.name ? (
                          <span className={`type-chip type-${data.type.name}`}>
                            <img 
                              src={getTypeIconUrl(data.type.name)} 
                              alt={data.type.name} 
                              className="type-icon"
                              loading="lazy"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                            <span className="type-name">{humanize(data.type.name)}</span>
                          </span>
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
                                <img className="move-meta-icon" src={src} alt="" aria-hidden="true" loading="lazy" />
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

                {englishEffect ? (
                  <div className="effect-window">
                    {effectLines.length > 0 ? (
                      <ul className="effect-list">
                        {effectLines.map((line, idx) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {mentionsStages ? (
                  <div className="effect-window stage-info-panel">
                    <div className="stage-info-header">
                      <h3 className="stage-info-title">Understanding Stat Stages</h3>
                      <p className="stage-info-intro">
                        When moves mention "stages," they're referring to stat modifiers that change your Pokémon's effectiveness. 
                        Stages range from <strong>−6</strong> (lowest) to <strong>+6</strong> (highest), with each stage representing a multiplier.
                      </p>
                    </div>
                    
                    <div className="stage-info-section">
                      <h4 className="stage-info-subtitle">Battle Stats</h4>
                      <p className="stage-info-description">
                        Attack, Defense, Special Attack, Special Defense, and Speed:
                      </p>
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
                      <h4 className="stage-info-subtitle">Accuracy & Evasion</h4>
                      <p className="stage-info-description">
                        These stats use different multipliers and cap at ±3 stages:
                      </p>
                      <div className="stage-info-chips">
                        <div className="stage-info-chip-group">
                          <span className="stage-info-label">Boosts:</span>
                          <div className="stage-info-chip-row">
                            <span className="move-stat-chip positive">+1 stage = 1.33×</span>
                            <span className="move-stat-chip positive">+2 stages = 1.67×</span>
                            <span className="move-stat-chip positive">+3 stages = 2×</span>
                          </div>
                        </div>
                        <div className="stage-info-chip-group">
                          <span className="stage-info-label">Drops:</span>
                          <div className="stage-info-chip-row">
                            <span className="move-stat-chip negative">−1 stage = 0.75×</span>
                            <span className="move-stat-chip negative">−2 stages = 0.6×</span>
                            <span className="move-stat-chip negative">−3 stages = 0.5×</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {Array.isArray(data?.flavor_text_entries) && data.flavor_text_entries.length > 0 ? (
                  <section className="about">
                    <div className="flavor-window">
                      {data.flavor_text_entries
                        .filter((e) => e?.language?.name === "en" && (e.text || e.flavor_text))
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
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function MoveLearnersPanel({ move }) {
  const [data, setData] = useState(null);
  const [learners, setLearners] = useState([]);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [learnersError, setLearnersError] = useState(null);
  const [typesMap, setTypesMap] = useState(() => new Map());

  const humanize = (s) => String(s || "").replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!move) {
        setData(null);
        setLearners([]);
        return;
      }
      setLearnersLoading(true);
      setLearnersError(null);
      try {
        const url = `https://pokeapi.co/api/v2/move/${move.name}`;
        const j = await fetch(url).then((r) => r.json());
        if (!cancelled) {
          setData(j);
          const list = Array.isArray(j?.learned_by_pokemon) ? j.learned_by_pokemon : [];
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
          setLearners(objs);
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
  }, [move]);

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

  if (!move) {
    return <aside className="learners-panel" style={{ display: 'none' }} />;
  }

  return (
    <aside className="learners-panel">
      <h4 className="learners-title">Learnt By</h4>
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

