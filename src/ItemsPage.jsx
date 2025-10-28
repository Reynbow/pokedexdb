import React, { useMemo, useState, useEffect, useRef } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";

export default function ItemsPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [filterItemsMap, setFilterItemsMap] = useState(() => new Map());
  const [filterLoading, setFilterLoading] = useState(() => new Map());
  const [filterError, setFilterError] = useState(() => new Map());
  const [filterIconMap, setFilterIconMap] = useState(() => new Map());
  const [selectedItem, setSelectedItem] = useState(null);
  const loadGuard = useRef(new Set());

  const EV_KNOWN_ITEMS = [
    // Vitamins
    "hp-up", "protein", "iron", "calcium", "zinc", "carbos",
    // Feathers
    "health-feather", "muscle-feather", "resist-feather", "genius-feather", "clever-feather", "swift-feather",
    // Power items and brace
    "macho-brace", "power-weight", "power-bracer", "power-belt", "power-lens", "power-band", "power-anklet",
  ];

  const FILTERS = [
    { key: "medicines", label: "Medicines", kind: "pocket", name: "medicine" },
    { key: "pokeballs", label: "Poke Balls", kind: "pocket", name: "pokeballs" },
    { key: "berries", label: "Berries", kind: "pocket", name: "berries" },
    { key: "tms", label: "TMs", kind: "pocket", name: "machines" },
    { key: "evtraining", label: "EV Training", kind: "custom-ev" },
    { key: "megastones", label: "Mega Stones", kind: "category", name: "mega-stones" },
    { key: "treasures", label: "Treasures", kind: "category", name: "treasures" },
    { key: "keyitems", label: "Key Items", kind: "pocket", name: "key-items" },
    { key: "other", label: "Other Items", kind: "other" },
  ];

  useEffect(() => {
    // On mount, ensure URL only carries the Items param
    try {
      const u = new URL(window.location.href);
      ["p", "m", "a"].forEach((k) => u.searchParams.delete(k));
      window.history.replaceState({}, "", u);
    } catch {}

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("https://pokeapi.co/api/v2/item?limit=20000");
        const j = await r.json();
        if (!cancelled) setItems(Array.isArray(j.results) ? j.results : []);
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

  // Preload filter sets/icons in the background so icons exist before click and grouped view is ready
  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;
    FILTERS.filter((f) => f.kind !== "other").forEach((f) => {
      ensureFilterLoaded(f.key);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const activeFilterSet = useMemo(() => {
    if (!selectedFilter) return null;
    return filterItemsMap.get(selectedFilter) || null;
  }, [selectedFilter, filterItemsMap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // If a filter is selected but not yet loaded, show nothing until ready
    if (selectedFilter && !activeFilterSet) return [];
    const base = activeFilterSet ? items.filter((i) => activeFilterSet.has(i.name)) : items;
    const result = q ? base.filter((i) => i.name.includes(q)) : base;
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query, activeFilterSet, selectedFilter]);

  useEffect(() => {
    const onPop = () => {
      const u = new URL(window.location.href);
      const name = u.searchParams.get("i");
      if (!name) {
        setSelectedItem(null);
        return;
      }
      const found = items.find((it) => it.name === name);
      if (found) setSelectedItem(found);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [items]);

  function selectItem(it) {
    const u = new URL(window.location.href);
    ["p", "m", "a"].forEach((k) => u.searchParams.delete(k));
    u.searchParams.set("i", it.name);
    window.history.pushState({}, "", u);
    setSelectedItem(it);
  }

  function clearSelection() {
    const u = new URL(window.location.href);
    u.searchParams.delete("i");
    window.history.pushState({}, "", u);
    setSelectedItem(null);
  }

  async function loadPocketItems(pocketName) {
    const pocketUrl = `https://pokeapi.co/api/v2/item-pocket/${pocketName}`;
    const pocket = await fetch(pocketUrl).then((r) => r.json());
    const categories = Array.isArray(pocket?.categories) ? pocket.categories : [];
    const allItems = new Set();
    for (const cat of categories) {
      try {
        const catData = await fetch(cat.url).then((r) => r.json());
        const catItems = Array.isArray(catData?.items) ? catData.items : [];
        for (const it of catItems) allItems.add(it.name);
      } catch {}
    }
    return allItems;
  }

  async function loadCategoryItems(categoryName) {
    const url = `https://pokeapi.co/api/v2/item-category/${categoryName}`;
    const data = await fetch(url).then((r) => r.json());
    const list = Array.isArray(data?.items) ? data.items : [];
    return new Set(list.map((i) => i.name));
  }

  function getItemSpriteUrl(name) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`;
  }

  function getIconOverride(key) {
    switch (key) {
      case "medicines": return getItemSpriteUrl("potion");
      case "pokeballs": return getItemSpriteUrl("poke-ball");
      case "berries": return getItemSpriteUrl("oran-berry");
      case "tms": return getItemSpriteUrl("tm-normal");
      case "evtraining": return getItemSpriteUrl("carbos");
      case "megastones": return getItemSpriteUrl("venusaurite");
      case "treasures": return getItemSpriteUrl("nugget");
      case "keyitems": return getItemSpriteUrl("bicycle");
      case "other": return getItemSpriteUrl("rare-candy");
      default: return null;
    }
  }

  async function ensureFilterLoaded(key) {
    if (filterItemsMap.has(key) || loadGuard.current.has(key)) return;
    loadGuard.current.add(key);
    setFilterLoading((m) => new Map(m).set(key, true));
    setFilterError((m) => new Map(m).set(key, null));
    try {
      const def = FILTERS.find((f) => f.key === key);
      let set = new Set();
      async function buildEvSet() {
        try {
          const [vit, wing] = await Promise.all([
            loadCategoryItems("vitamins"),
            loadCategoryItems("wing"),
          ]);
          const s = new Set([...(vit || []), ...(wing || [])]);
          [
            "power-weight",
            "power-bracer",
            "power-belt",
            "power-lens",
            "power-band",
            "power-anklet",
            "macho-brace",
          ].forEach((n) => s.add(n));
          // Ensure presence even if API categories are unavailable
          EV_KNOWN_ITEMS.forEach((n) => s.add(n));
          return s;
        } catch {
          return new Set(EV_KNOWN_ITEMS);
        }
      }
      if (def?.kind === "pocket") {
        set = await loadPocketItems(def.name);
        // Exclude EV items from Medicines pocket so they only appear under EV Training
        if (def.name === "medicine") {
          const evSet = filterItemsMap.get("evtraining") || await buildEvSet();
          evSet.forEach((n) => set.delete(n));
        }
      } else if (def?.kind === "category") {
        set = await loadCategoryItems(def.name);
      } else if (def?.kind === "custom-ev") {
        set = await buildEvSet();
      } else if (def?.kind === "other") {
        // Load all other categories first
        const keysToLoad = FILTERS.filter((f) => f.kind !== "other").map((f) => f.key);
        await Promise.all(keysToLoad.map((k) => ensureFilterLoaded(k)));
        // Compute complement
        const union = new Set();
        for (const k of keysToLoad) {
          const s = filterItemsMap.get(k);
          if (s) for (const n of s) union.add(n);
        }
        for (const it of items) {
          if (!union.has(it.name)) set.add(it.name);
        }
      }
      setFilterItemsMap((m) => new Map(m).set(key, set));
      // Determine icon: override or first item in set
      let icon = getIconOverride(key);
      if (!icon) {
        const first = set.values().next().value;
        if (first) icon = getItemSpriteUrl(first);
      }
      if (icon) setFilterIconMap((m) => new Map(m).set(key, icon));
    } catch (e) {
      setFilterError((m) => new Map(m).set(key, e));
    } finally {
      setFilterLoading((m) => new Map(m).set(key, false));
    }
  }

  function onClickFilter(key) {
    if (selectedFilter === key) {
      setSelectedFilter(null);
      return;
    }
    setSelectedFilter(key);
    // Ensure only this filter's set is considered fresh; no sticky union across filters
    ensureFilterLoaded(key);
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
          <h1 className="title">Items</h1>
          <p className="subtitle">Search and explore held items and consumables</p>
          <CategoryToggle />
          <div className="search-row">
            <input
              className="search"
              placeholder="Search Items"
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
          <div className="items-filter-row" role="tablist" aria-label="Item categories">
            {FILTERS.map((f) => {
              const isOn = selectedFilter === f.key;
              const isLoading = filterLoading.get(f.key);
              const icon = getIconOverride(f.key) || filterIconMap.get(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`filter-chip items-chip${isOn ? " is-on" : ""}`}
                  aria-pressed={isOn}
                  onClick={() => onClickFilter(f.key)}
                >
                  {icon ? <img className="filter-icon" src={icon} alt="" aria-hidden="true" /> : null}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>
      <main className="container">
        {error ? (
          <div className="list-empty">Failed to load items.</div>
        ) : loading ? (
          <div className="list-empty">Loading items</div>
        ) : filtered.length === 0 ? (
          <div className="list-empty">No items found.</div>
        ) : (
          <section className="content split">
            <div className="list-panel">
              <div className="list-scroll">
                {selectedFilter ? (
                  <div className="list items-list">
                    {filtered.map((i) => (
                      <button
                        key={i.name}
                        type="button"
                        className={`item-row${selectedItem?.name === i.name ? " is-selected" : ""}`}
                        onClick={() => selectItem(i)}
                        aria-pressed={selectedItem?.name === i.name}
                      >
                        <img className="item-icon" alt="" src={getItemSpriteUrl(i.name)} />
                        <span className="item-name">{i.name.replaceAll("-", " ")}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="list items-list">
                    {filtered.map((i) => (
                      <button
                        key={i.name}
                        type="button"
                        className={`item-row${selectedItem?.name === i.name ? " is-selected" : ""}`}
                        onClick={() => selectItem(i)}
                        aria-pressed={selectedItem?.name === i.name}
                      >
                        <img className="item-icon" alt="" src={getItemSpriteUrl(i.name)} />
                        <span className="item-name">{i.name.replaceAll("-", " ")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <aside className="detail-panel">
              <div className="detail-inner">
                <ItemDetailPanel item={selectedItem} onClose={clearSelection} />
              </div>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}

function ItemDetailPanel({ item, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [machines, setMachines] = useState([]);
  const [machinesLoading, setMachinesLoading] = useState(false);
  const [machinesError, setMachinesError] = useState(null);

  const englishEffect = useMemo(() => {
    const entries = Array.isArray(data?.effect_entries) ? data.effect_entries : [];
    const en = entries.find((e) => e?.language?.name === "en");
    return en ? (en.effect || en.short_effect || "") : "";
  }, [data]);
  const englishFlavour = useMemo(() => {
    const entries = Array.isArray(data?.flavor_text_entries) ? data.flavor_text_entries : [];
    const en = entries.find((e) => e?.language?.name === "en");
    return en ? (en.text || en.flavor_text || "") : "";
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
    const parts = cleaned
      .split(/(?<=[.!?])\s+|;\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts;
  }, [englishEffect]);

  const humanize = (s) => String(s || "").replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!item) return;
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const url = `https://pokeapi.co/api/v2/item/${item.name}`;
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
  }, [item]);

  // Category fetch removed since meta panel is hidden

  useEffect(() => {
    let cancelled = false;
    async function loadMachines() {
      const entries = Array.isArray(data?.machines) ? data.machines : [];
      if (entries.length === 0) { setMachines([]); return; }
      setMachinesLoading(true);
      setMachinesError(null);
      try {
        const results = await Promise.all(entries.map(async (m) => {
          try {
            const j = await fetch(m.machine.url).then((r) => r.json());
            return { move: j?.move?.name, version_group: j?.version_group?.name };
          } catch {
            return null;
          }
        }));
        if (!cancelled) setMachines(results.filter(Boolean));
      } catch (e) {
        if (!cancelled) setMachinesError(e);
      } finally {
        if (!cancelled) setMachinesLoading(false);
      }
    }
    loadMachines();
    return () => { cancelled = true; };
  }, [data?.machines]);

  if (!item) return <div />;

  return (
    <>
      <div className="detail-title detail-title-top">
        <h2>{item.name.replaceAll("-", " ")}</h2>
      </div>
      <div className="detail-hero item-hero">
        <div className="hero-left">
          <div className="detail-art-wrap item-art-wrap">
            <img
              className="detail-art is-static"
              src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.name}.png`}
              alt=""
              style={{ width: 60, height: 60, transform: "none" }}
            />
          </div>
        </div>
        <div className="hero-right">
          {loading ? (
            <div className="list-empty">Loading</div>
          ) : error ? (
            <div className="list-empty">Failed to load item.</div>
          ) : (
            <>
              {/* Meta panel (category/pocket/cost/fling) removed as requested */}

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


              {Array.isArray(data?.held_by_pokemon) && data.held_by_pokemon.length > 0 ? (
                <section className="about">
                  <h3 className="list-subheading" style={{ textAlign: "left" }}>Held By Pokémon</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {data.held_by_pokemon.slice(0, 20).map((h) => (
                      <li key={h.pokemon?.name}>
                        {humanize(h.pokemon?.name)}
                        {Array.isArray(h.version_details) && h.version_details[0]?.rarity != null ? ` · Rarity: ${h.version_details[0].rarity}` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {machinesLoading ? (
                <section className="about"><h3 className="list-subheading" style={{ textAlign: "left" }}>Machines</h3><div>Loading</div></section>
              ) : machinesError ? null : machines.length > 0 ? (
                <section className="about">
                  <h3 className="list-subheading" style={{ textAlign: "left" }}>Machines</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {machines.map((m, idx) => (
                      <li key={idx}>{humanize(m.move)}{m.version_group ? ` · ${humanize(m.version_group)}` : ""}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
        {Array.isArray(data?.flavor_text_entries) && data.flavor_text_entries.length > 0 ? (
          <div className="hero-wide-section">
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
          </div>
        ) : null}
      </div>
    </>
  );
}


