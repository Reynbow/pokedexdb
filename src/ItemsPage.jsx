import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";
import { getBasePath } from "./utils/url.js";

const BASE_PATH = getBasePath();
const ITEMS_URL = `${BASE_PATH}item-data/items.json`;
const POKEAPI_ITEM_SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/";
const PAGE_SIZE = 150;
const ROW_ICON_SIZE = 32;
const DETAIL_ICON_SIZE = 64;
const SUPPORTS_INTERSECTION_OBSERVER = typeof window !== "undefined" && "IntersectionObserver" in window;

/** "King's Rock" / "kings-rock" / "Poké Ball" -> "kingsrock" / "pokeball" (the items.json key format). */
const toItemKey = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]/g, "");

/** PokeAPI sprite slug from a display name: "King's Rock" -> "kings-rock". */
const toPokeApiSlug = (name) =>
  String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ---------------------------------------------------------------------------
// Data loading: fetched and parsed once per page load, shared across mounts.
// ---------------------------------------------------------------------------

let itemsPromise = null;
let itemsCache = null;

function loadItems() {
  if (!itemsPromise) {
    itemsPromise = fetch(ITEMS_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Items database request failed (${response.status})`);
        return response.json();
      })
      .then((db) => {
        if (!db || typeof db !== "object" || Array.isArray(db)) throw new Error("Items database is invalid");
        const list = Object.entries(db)
          .map(([key, entry]) => {
            const name = String(entry?.name || key);
            return {
              key,
              name,
              lower: name.toLowerCase(),
              image: Array.isArray(entry?.images) ? entry.images[0] || null : null,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        itemsCache = { db, list };
        return itemsCache;
      })
      .catch((error) => {
        itemsPromise = null; // allow a retry on the next attempt
        throw error;
      });
  }
  return itemsPromise;
}

// ---------------------------------------------------------------------------
// Games: every game name used in items.json, in release order, with generation.
// ---------------------------------------------------------------------------

const GAMES = [
  ["Red", 1], ["Green", 1], ["Blue", 1], ["Yellow", 1],
  ["Gold", 2], ["Silver", 2], ["Crystal", 2],
  ["Ruby", 3], ["Sapphire", 3], ["Colosseum", 3], ["FireRed", 3], ["LeafGreen", 3], ["Emerald", 3], ["XD", 3],
  ["Diamond", 4], ["Pearl", 4], ["Battle Revolution", 4], ["Platinum", 4], ["HeartGold", 4], ["SoulSilver", 4], ["PokéWalker", 4],
  ["Black", 5], ["White", 5], ["Black 2", 5], ["White 2", 5],
  ["X", 6], ["Y", 6], ["Omega Ruby", 6], ["Alpha Sapphire", 6],
  ["Sun", 7], ["Moon", 7], ["Ultra Sun", 7], ["Ultra Moon", 7], ["Let's Go, Pikachu!", 7], ["Let's Go, Eevee!", 7],
  ["Sword", 8], ["Shield", 8], ["Isle of Armor", 8], ["The Crown Tundra", 8], ["Brilliant Diamond", 8], ["Shining Pearl", 8], ["Legends: Arceus", 8],
  ["Scarlet", 9], ["Violet", 9], ["The Teal Mask", 9], ["The Indigo Disk", 9], ["Legends: Z-A", 9], ["Mega Dimension", 9],
];

// Keyed by toItemKey(name) so spelling variants in the data ("Legends Arceus",
// "Let's Go, Eevee", "Pokewalker") resolve to the same game.
const GAME_INFO = new Map(GAMES.map(([name, gen], order) => [toItemKey(name), { name, gen, order }]));

const resolveGame = (raw) => GAME_INFO.get(toItemKey(raw)) || null;
const gameName = (raw) => resolveGame(raw)?.name || String(raw || "").trim();
const gameOrder = (name) => resolveGame(name)?.order ?? -1;

/** "Let's Go, Pikachu!, Let's Go, Eevee!" -> ["Let's Go, Pikachu!", "Let's Go, Eevee!"] */
function parseScope(scope) {
  const parts = String(scope || "").split(",").map((p) => p.trim()).filter(Boolean);
  const games = [];
  for (let i = 0; i < parts.length; i++) {
    const pair = i + 1 < parts.length ? resolveGame(`${parts[i]}, ${parts[i + 1]}`) : null;
    if (pair) {
      games.push(pair.name);
      i++;
    } else {
      games.push(gameName(parts[i]));
    }
  }
  return games;
}

/** Normalises one of the per-game lists of an entry into rows plus sorted game options. */
function buildSection(list, getGames, getValue) {
  const rows = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const value = String(getValue(raw) || "").trim();
    const games = getGames(raw).filter(Boolean);
    if (value && games.length > 0) rows.push({ games, label: games.join(", "), value });
  }
  const options = [...new Set(rows.flatMap((row) => row.games))].sort((a, b) => gameOrder(a) - gameOrder(b));
  return { rows, options };
}

const groupGames = (group) => (Array.isArray(group?.games) ? group.games.map(gameName) : []);

function buildSections(entry) {
  return {
    flavour: buildSection(entry?.effect_flavour_by_group, groupGames, (g) => g?.text),
    locations: buildSection(entry?.acquisition, (a) => parseScope(a?.scope), (a) => a?.text),
    shopping: buildSection(entry?.shopping_details, (s) => parseScope(s?.scope), (s) => s?.shops),
    pocket: buildSection(entry?.pocket_by_group, groupGames, (g) => g?.pocket),
  };
}

const formatPrice = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value.toLocaleString("en-US") : "—";

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const readItemParam = () => {
  try {
    return toItemKey(new URL(window.location.href).searchParams.get("i")) || null;
  } catch {
    return null;
  }
};

function writeItemParam(key) {
  const url = new URL(window.location.href);
  ["p", "m", "a"].forEach((k) => url.searchParams.delete(k));
  if (key) url.searchParams.set("i", key);
  else url.searchParams.delete("i");
  window.history.pushState({}, "", url);
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Local sprite first, then the PokeAPI sprite; keeps its box (no broken-image icon) if both fail. */
function ItemIcon({ item, className, size }) {
  const sources = useMemo(() => {
    const list = [];
    if (item.image) list.push(`${BASE_PATH}item-data/${item.image}`);
    const slug = toPokeApiSlug(item.name);
    if (slug) list.push(`${POKEAPI_ITEM_SPRITES}${slug}.png`);
    return list;
  }, [item]);
  const [failed, setFailed] = useState(0);

  if (failed >= sources.length) {
    return <span className={className} style={{ display: "inline-block", width: size, height: size }} aria-hidden="true" />;
  }
  return (
    <img
      className={className}
      src={sources[failed]}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed((n) => n + 1)}
    />
  );
}

export default function ItemsPage() {
  const [data, setData] = useState(itemsCache);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(readItemParam);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  // Scroll the selected row into view when the selection comes from the URL (deep link, back/forward).
  const scrollToSelectionRef = useRef(true);

  useEffect(() => {
    // The Items page only carries its own query param.
    try {
      const url = new URL(window.location.href);
      if (["p", "m", "a"].some((k) => url.searchParams.has(k))) {
        ["p", "m", "a"].forEach((k) => url.searchParams.delete(k));
        window.history.replaceState(window.history.state, "", url);
      }
    } catch {
      // Non-fatal: leave the URL as it is.
    }
  }, []);

  useEffect(() => {
    if (data) return undefined;
    let cancelled = false;
    loadItems().then(
      (result) => {
        if (!cancelled) setData(result);
      },
      (err) => {
        if (!cancelled) setError(err);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [data, attempt]);

  // Back/forward and in-app navigation keep the selection in sync with ?i=
  useEffect(() => {
    const syncFromUrl = () => {
      scrollToSelectionRef.current = true;
      setSelectedKey(readItemParam());
    };
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("locationchange", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("locationchange", syncFromUrl);
    };
  }, []);

  const filtered = useMemo(() => {
    const list = data?.list ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    const compact = toItemKey(q);
    return list.filter((it) => it.lower.includes(q) || (compact && it.key.includes(compact)));
  }, [data, query]);

  const selectedItem = useMemo(
    () => (data && selectedKey && data.db[selectedKey] ? data.list.find((it) => it.key === selectedKey) || null : null),
    [data, selectedKey]
  );
  const selectedIndex = useMemo(
    () => (selectedKey ? filtered.findIndex((it) => it.key === selectedKey) : -1),
    [filtered, selectedKey]
  );

  const renderCount = SUPPORTS_INTERSECTION_OBSERVER
    ? Math.min(filtered.length, Math.max(visibleCount, selectedIndex + 1))
    : filtered.length;
  const hasMore = renderCount < filtered.length;

  // Render the list incrementally: load the next page when the sentinel nears the viewport.
  // Re-created after every page (and on new results) so a sentinel that is still visible keeps loading.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || !sentinel) return undefined;
    const container = scrollRef.current;
    const scrolls = container && /(auto|scroll)/.test(window.getComputedStyle(container).overflowY);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisibleCount(renderCount + PAGE_SIZE);
      },
      { root: scrolls ? container : null, rootMargin: "600px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, renderCount, filtered]);

  useEffect(() => {
    if (!scrollToSelectionRef.current || !data) return;
    scrollToSelectionRef.current = false;
    const container = scrollRef.current;
    if (!container || !selectedKey) return;
    const row = container.querySelector(`[data-item-key="${selectedKey}"]`);
    if (row) container.scrollTop = row.offsetTop - (container.clientHeight - row.offsetHeight) / 2;
  }, [data, selectedKey]);

  const selectItem = (key) => {
    scrollToSelectionRef.current = false;
    if (key === selectedKey) return;
    writeItemParam(key);
    setSelectedKey(key);
  };

  const updateQuery = (value) => {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  let body;
  if (error) {
    body = (
      <div className="list-empty">
        Failed to load items.{" "}
        <button type="button" className="reset-button" onClick={retry}>
          Retry
        </button>
      </div>
    );
  } else if (!data) {
    body = <div className="list-empty">Loading items…</div>;
  } else {
    body = (
      <section className="content split">
        <div className="list-panel">
          <div className="list-scroll" ref={scrollRef}>
            {filtered.length === 0 ? (
              <div className="list-empty">No items found.</div>
            ) : (
              <div className="list items-list">
                {filtered.slice(0, renderCount).map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    data-item-key={it.key}
                    className={`item-row${it.key === selectedKey ? " is-selected" : ""}`}
                    onClick={() => selectItem(it.key)}
                    aria-pressed={it.key === selectedKey}
                  >
                    <ItemIcon item={it} className="item-icon" size={ROW_ICON_SIZE} />
                    <span className="item-name">{it.name}</span>
                  </button>
                ))}
                {hasMore ? <div ref={sentinelRef} className="items-list-sentinel" aria-hidden="true" /> : null}
              </div>
            )}
          </div>
        </div>
        <aside className="detail-panel">
          <div className="detail-inner">
            <ItemDetailPanel item={selectedItem} entry={selectedItem ? data.db[selectedItem.key] : null} />
          </div>
        </aside>
      </section>
    );
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
              aria-label="Search items"
              autoComplete="off"
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
            />
            <button type="button" className="reset-button" onClick={() => updateQuery("")}>
              Reset
            </button>
          </div>
        </div>
      </header>
      <main className="container">{body}</main>
    </div>
  );
}

function GameSection({ title, section, selectedGame, onSelectGame, showAll = false }) {
  const matches = section.rows.filter((row) => row.games.includes(selectedGame));
  const shown = showAll ? matches : matches.slice(0, 1);
  const optionGroups = useMemo(() => {
    const groups = new Map();
    for (const name of section.options) {
      const gen = resolveGame(name)?.gen ?? 0;
      if (!groups.has(gen)) groups.set(gen, []);
      groups.get(gen).push(name);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [section.options]);

  return (
    <section className="about items-section">
      <div className="items-section-head">
        <h3 className="list-subheading">{title}</h3>
        {section.options.length > 0 ? (
          <select
            aria-label={`Game for ${title.toLowerCase()}`}
            value={selectedGame}
            onChange={(e) => onSelectGame(e.target.value)}
          >
            {optionGroups.map(([gen, names]) => (
              <optgroup key={gen} label={gen > 0 ? `Generation ${gen}` : "Other"}>
                {names.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <p className="items-section-text">—</p>
      ) : (
        shown.map((row, idx) => (
          <p key={`${row.label}-${idx}`} className="items-section-text">
            {shown.length > 1 ? <span className="items-scope-label">{row.label}: </span> : null}
            {row.value}
          </p>
        ))
      )}
    </section>
  );
}

function ItemDetailPanel({ item, entry }) {
  // One preferred game shared by all sections; each falls back to its latest game.
  const [preferredGame, setPreferredGame] = useState("");
  const sections = useMemo(() => buildSections(entry), [entry]);

  if (!item || !entry) {
    return <div className="list-empty items-detail-empty">Select an item to see its details.</div>;
  }

  const gameFor = ({ options }) =>
    options.includes(preferredGame) ? preferredGame : options[options.length - 1] || "";
  const sectionProps = (section) => ({ section, selectedGame: gameFor(section), onSelectGame: setPreferredGame });

  return (
    <>
      <div className="detail-title detail-title-top">
        <h2>{item.name}</h2>
      </div>
      <div className="detail-hero item-hero single-col items-detail-body">
        <div className="items-summary">
          <div className="detail-art-wrap item-art-wrap">
            <ItemIcon key={item.key} item={item} className="detail-art is-static" size={DETAIL_ICON_SIZE} />
          </div>
          <dl className="items-facts">
            <dt>Type</dt>
            <dd>{entry.item_type || "—"}</dd>
            <dt>Buy</dt>
            <dd>{formatPrice(entry.purchase_price)}</dd>
            <dt>Sell</dt>
            <dd>{formatPrice(entry.sell_price)}</dd>
          </dl>
        </div>
        <GameSection title="Flavour Text" {...sectionProps(sections.flavour)} />
        <GameSection title="Locations" showAll {...sectionProps(sections.locations)} />
        <GameSection title="Shops" showAll {...sectionProps(sections.shopping)} />
        <GameSection title="Pocket" {...sectionProps(sections.pocket)} />
      </div>
    </>
  );
}
