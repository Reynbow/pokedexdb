import React, { useMemo, useState, useEffect, useRef } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";

export default function ItemsPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [localItemsDb, setLocalItemsDb] = useState(null);
  
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
        // Prefer local database only
        try {
          const localResp = await fetch("/items/items.json", { cache: "no-store" });
          if (!cancelled && localResp?.ok) {
            const localData = await localResp.json();
            if (localData && typeof localData === "object") {
              setLocalItemsDb(localData);
              const keys = Object.keys(localData);
              const list = keys.map((k) => ({ name: k }));
              setItems(list);
              return;
            }
          }
          // If local DB missing or invalid, surface empty state
          if (!cancelled) {
            setItems([]);
            setError(new Error("Local items database not found"));
          }
        } catch (e) {
          if (!cancelled) {
            setItems([]);
            setError(e);
          }
        }
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

  // No preloading of filters; we no longer render filter chips
  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;
    // intentionally no-op
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const activeFilterSet = null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = Array.isArray(items) ? items : [];
    const constrained = localItemsDb ? base.filter((i) => !!localItemsDb[i.name]) : base;
    const result = q ? constrained.filter((i) => i.name.includes(q)) : constrained;
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query, localItemsDb]);

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
    // Use local image if available
    try {
      const entry = localItemsDb && localItemsDb[name];
      const imgRel = Array.isArray(entry?.images) ? entry.images[0] : null;
      if (imgRel) return `/items/${imgRel}`;
    } catch {}
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`;
  }

  function humanizeName(raw) {
    const s = String(raw || "").replace(/[-_]+/g, " ").trim();
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function getDisplayName(name) {
    const local = localItemsDb && localItemsDb[name];
    if (local && local.name) return String(local.name);
    return humanizeName(name);
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
                      <span className="item-name">{getDisplayName(i.name)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <aside className="detail-panel">
              <div className="detail-inner">
                <ItemDetailPanel item={selectedItem} onClose={clearSelection} localDb={localItemsDb} />
              </div>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}

function ItemDetailPanel({ item, onClose, localDb }) {
  const [loading, setLoading] = useState(false);
  const [itemSpriteSrc, setItemSpriteSrc] = useState(null);
  const [availableGames, setAvailableGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState("");
  

  // Local helper to infer generation from game text
  const inferGenerationFromGameText = (text) => {
    const t = String(text || "").toLowerCase();
    if (t.includes("red") || t.includes("blue") || t.includes("yellow")) return 1;
    if (t.includes("gold") || t.includes("silver") || t.includes("crystal")) return 2;
    if (t.includes("ruby") || t.includes("sapphire") || t.includes("emerald") || t.includes("firered") || t.includes("leafgreen")) return 3;
    if (t.includes("diamond") || t.includes("pearl") || t.includes("platinum") || t.includes("heartgold") || t.includes("soulsilver")) return 4;
    if (t.includes("black 2") || t.includes("white 2") || (/\bblack\b/.test(t) && !t.includes("blackberry")) || /\bwhite\b/.test(t)) return 5;
    if (t.includes("x ") || t.startsWith("x") || t.includes(" y ") || t.endsWith(" y") || t.startsWith("y ") || t.includes("omega ruby") || t.includes("alpha sapphire")) return 6;
    if (t.includes("sun") || t.includes("moon") || t.includes("ultra sun") || t.includes("ultra moon") || t.includes("let's go, pikachu") || t.includes("let's go, eevee")) return 7;
    if (t.includes("sword") || t.includes("shield") || t.includes("brilliant diamond") || t.includes("shining pearl") || t.includes("legends: arceus") || t.includes("legends arceus") || t.includes("isle of armor") || t.includes("crown tundra")) return 8;
    if (t.includes("scarlet") || t.includes("violet") || t.includes("the teal mask") || t.includes("the indigo disk") || t.includes("legends: z-a")) return 9;
    return null;
  };

  const humanize = (s) => String(s || "").replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const entry = useMemo(() => (localDb && item ? localDb[item.name] : null), [localDb, item]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!item) return;
      setLoading(true);
      // Prefer local image
      try {
        const entry = localDb && localDb[item.name];
        const imgRel = Array.isArray(entry?.images) ? entry.images[0] : null;
        if (imgRel) {
          setItemSpriteSrc(`/items/${imgRel}`);
        } else {
          setItemSpriteSrc(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.name}.png`);
        }
      } catch {
        setItemSpriteSrc(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.name}.png`);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [item, localDb]);

  // Build available games from local DB and default-select latest
  useEffect(() => {
    if (!entry) { setAvailableGames([]); setSelectedGame(""); return; }
    const gameSet = new Set();
    const groups = Array.isArray(entry.effect_flavour_by_group) ? entry.effect_flavour_by_group : [];
    groups.forEach((g) => {
      (Array.isArray(g?.games) ? g.games : []).forEach((name) => {
        const n = String(name || "").trim();
        if (n) gameSet.add(n);
      });
    });
    const acquisitions = Array.isArray(entry.acquisition) ? entry.acquisition : [];
    acquisitions.forEach((a) => {
      const scope = String(a?.scope || "");
      scope.split(/,|\band\b|\/|\+|·/i).forEach((part) => {
        const n = String(part || "").trim();
        if (n) gameSet.add(n);
      });
    });
    const games = Array.from(gameSet);
    const withGen = games.map((g) => ({ name: g, gen: inferGenerationFromGameText(g) || 0 }));
    withGen.sort((a, b) => (a.gen !== b.gen ? a.gen - b.gen : a.name.localeCompare(b.name)));
    setAvailableGames(withGen.map((x) => x.name));
    const latest = withGen.length > 0 ? withGen[withGen.length - 1].name : "";
    setSelectedGame(latest);
  }, [entry]);

  // No pocket/category fetch; we do not query PokeAPI

  const selectFlavorText = useMemo(() => {
    if (!entry) return "";
    const groups = Array.isArray(entry?.effect_flavour_by_group) ? entry.effect_flavour_by_group : [];
    const direct = groups.find((g) => Array.isArray(g?.games) && g.games.some((n) => String(n).trim() === selectedGame));
    if (direct && direct.text) return direct.text;
    let best = null;
    let bestGen = -1;
    for (const g of groups) {
      const gen = Math.max(...(Array.isArray(g?.games) ? g.games.map((n) => inferGenerationFromGameText(String(n))) : []).filter((x) => typeof x === "number"));
      if (Number.isFinite(gen) && gen >= bestGen && g.text) {
        bestGen = gen;
        best = g.text;
      }
    }
    return best || "";
  }, [entry, selectedGame]);

  const selectAcquisitionText = useMemo(() => {
    if (!entry) return "";
    const acquisitions = Array.isArray(entry?.acquisition) ? entry.acquisition : [];
    const direct = acquisitions.find((a) => String(a?.scope || "").split(/,|\band\b|\/|\+|·/i).some((p) => String(p).trim() === selectedGame));
    if (direct && direct.text) return direct.text;
    let best = null;
    let bestGen = -1;
    for (const a of acquisitions) {
      const scope = String(a?.scope || "");
      const gens = scope.split(/,|\band\b|\/|\+|·/i).map((p) => inferGenerationFromGameText(String(p))).filter((x) => typeof x === "number");
      const gen = gens.length > 0 ? Math.max(...gens) : -1;
      if (gen >= bestGen && a.text) {
        bestGen = gen;
        best = a.text;
      }
    }
    return best || "";
  }, [entry, selectedGame]);

  const selectShoppingDetails = useMemo(() => {
    if (!entry) return [];
    const groups = Array.isArray(entry?.shopping_by_group) ? entry.shopping_by_group : [];
    const direct = groups.find((g) => Array.isArray(g?.games) && g.games.some((n) => String(n).trim() === selectedGame));
    if (direct) {
      const lines = [];
      // Support both free-text and structured fields in group entries
      const locs = Array.isArray(direct.locations) ? direct.locations :
        (direct.location ? [direct.location] : []);
      const buy = direct.buy_price != null ? direct.buy_price : (direct.price?.buy ?? null);
      const sell = direct.sell_price != null ? direct.sell_price : (direct.price?.sell ?? null);
      if (locs.length > 0) lines.push(`Location: ${locs.join(", ")}`);
      if (buy != null) lines.push(`Buy: ${buy}`);
      if (sell != null) lines.push(`Sell: ${sell}`);
      if (direct.text && lines.length === 0) return [direct.text];
      if (lines.length > 0) return lines;
    }
    const lines = [];
    if (entry.cost != null) lines.push(`Cost: ${entry.cost}`);
    if (entry.buy_price != null) lines.push(`Buy: ${entry.buy_price}`);
    if (entry.sell_price != null) lines.push(`Sell: ${entry.sell_price}`);
    // Derive shopping location from common fields
    const entryLocs =
      (Array.isArray(entry.shop_locations) ? entry.shop_locations : null) ||
      (Array.isArray(entry.purchase_locations) ? entry.purchase_locations : null) ||
      (Array.isArray(entry.buy_locations) ? entry.buy_locations : null) ||
      (Array.isArray(entry.locations) ? entry.locations : null) ||
      (Array.isArray(entry.shops) ? entry.shops : null);
    if (Array.isArray(entryLocs) && entryLocs.length > 0) lines.push(`Location: ${entryLocs.join(", ")}`);
    if (Array.isArray(entry.attributes) && entry.attributes.length > 0) lines.push(`Attributes: ${entry.attributes.join(", ")}`);
    if (lines.length > 0) return lines;
    let best = null; let bestGen = -1;
    for (const g of groups) {
      const gen = Math.max(...(Array.isArray(g?.games) ? g.games.map((n) => inferGenerationFromGameText(String(n))) : []).filter((x) => typeof x === "number"));
      if (Number.isFinite(gen) && gen >= bestGen && g.text) { bestGen = gen; best = g.text; }
    }
    return best ? [best] : [];
  }, [entry, selectedGame]);

  const selectPocketCategory = useMemo(() => {
    if (!entry) return { pocket: null, category: null };
    const pocketGroups = Array.isArray(entry?.pocket_by_group) ? entry.pocket_by_group : [];
    const direct = pocketGroups.find((g) => Array.isArray(g?.games) && g.games.some((n) => String(n).trim() === selectedGame));
    const pocket = direct?.pocket || entry.pocket || null;
    const category = entry.category || null;
    return { pocket, category };
  }, [entry, selectedGame]);

  // No machine data fetch; we use only local JSON

  if (!item) return <div />;

  return (
    <>
      <div className="detail-title detail-title-top">
        <h2>{(localDb && localDb[item.name] && localDb[item.name].name) ? localDb[item.name].name : humanize(item.name)}</h2>
      </div>
      <div className="detail-hero item-hero">
        <div className="hero-left">
          <div className="detail-art-wrap item-art-wrap">
            <img
              className="detail-art is-static"
              src={itemSpriteSrc || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.name}.png`}
              alt=""
              style={{ width: 60, height: 60, transform: "none" }}
              loading="lazy"
            />
          </div>
        </div>
        <div className="hero-right">
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            {availableGames.length > 0 ? (
              <select
                className="game-select"
                aria-label="Select game variant"
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value)}
              >
                {availableGames.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            ) : null}
          </div>
          {loading ? (
            <div className="list-empty">Loading</div>
          ) : (
            <>
              {selectFlavorText ? (
                <section className="about">
                  <h3 className="list-subheading" style={{ textAlign: "left" }}>Flavour Text</h3>
                  <div>{selectFlavorText}</div>
                </section>
              ) : null}

              {selectAcquisitionText ? (
                <section className="about">
                  <h3 className="list-subheading" style={{ textAlign: "left" }}>Location</h3>
                  <div>{selectAcquisitionText}</div>
                </section>
              ) : null}

              <section className="about">
                <h3 className="list-subheading" style={{ textAlign: "left" }}>Shopping Details</h3>
                {selectShoppingDetails.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {selectShoppingDetails.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <div>—</div>
                )}
              </section>

              <section className="about">
                <h3 className="list-subheading" style={{ textAlign: "left" }}>Pocket</h3>
                {selectPocketCategory.pocket || selectPocketCategory.category ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {selectPocketCategory.pocket ? <li>Pocket: {selectPocketCategory.pocket}</li> : null}
                    {selectPocketCategory.category ? <li>Category: {selectPocketCategory.category}</li> : null}
                  </ul>
                ) : (
                  <div>—</div>
                )}
              </section>
            </>
          )}
        </div>
        {/* Panels above handle content; removed legacy wide flavor list */}
      </div>
    </>
  );
}


