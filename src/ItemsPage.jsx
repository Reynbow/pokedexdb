import { useEffect, useMemo, useRef, useState } from "react";
import Icon, { Cursor } from "./components/Icon.jsx";
import { getBasePath } from "./utils/url.js";
import "./styles/pokedex.css";
import "./styles/pages/items.css";

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
// Categories: items.json's item_type values ("Hold Item Evolutionary", "Decorations Mat", …)
// folded into the groups a player looks for. First match wins, so order matters.
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: "balls", label: "Poké Balls", test: (t) => t === "pokeball" },
  { key: "medicine", label: "Medicine", test: (t) => t.includes("recovery") },
  { key: "berries", label: "Berries", test: (t) => t.includes("berry") },
  { key: "evolution", label: "Evolution", test: (t) => t.includes("evolutionary") },
  { key: "zcrystals", label: "Z-Crystals", test: (t) => t.startsWith("z crystal") },
  { key: "megastones", label: "Mega Stones", test: (t) => t === "mega stone" },
  { key: "held", label: "Held items", test: (t) => t.includes("hold item") },
  { key: "battle", label: "Battle items", test: (t) => t === "battle effect" },
  { key: "training", label: "Training", test: (t) => t.startsWith("vitamins") },
  { key: "fossils", label: "Fossils", test: (t) => t === "fossil" },
  { key: "key", label: "Key items", test: (t) => t.startsWith("key item") || t === "category" },
  { key: "mail", label: "Mail", test: (t) => t === "mail" },
  { key: "decorations", label: "Decorations", test: (t) => t.startsWith("decorations") },
  { key: "other", label: "Other", test: () => true },
];
const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.key, c.label]));

const categoryOf = (itemType) => {
  const t = String(itemType || "").trim().toLowerCase();
  return (CATEGORIES.find((c) => c.test(t)) || CATEGORIES[CATEGORIES.length - 1]).key;
};

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
              category: categoryOf(entry?.item_type),
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

const isPlainLeftClick = (event) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

const listScrolls = (node) => Boolean(node) && /(auto|scroll)/.test(window.getComputedStyle(node).overflowY);

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
  // Hidden until it has loaded, so a failing source never flashes the broken-image icon
  const [loadedSrc, setLoadedSrc] = useState(null);

  if (failed >= sources.length) {
    return (
      <span className={`${className} it-icon--none`} style={{ width: size, height: size }} aria-hidden="true">
        <Icon name="bag" />
      </span>
    );
  }
  // PokeAPI fallbacks are small pixel sprites: scale them crisp; local sprites are large renders
  const pixel = sources[failed].startsWith(POKEAPI_ITEM_SPRITES);
  return (
    <img
      className={pixel ? `${className} it-icon--pixel` : className}
      src={sources[failed]}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={loadedSrc === sources[failed] ? undefined : { visibility: "hidden" }}
      onLoad={() => setLoadedSrc(sources[failed])}
      onError={() => setFailed((n) => n + 1)}
    />
  );
}

// Up/Down moves the cursor between rows like the device's menu
const onListKeyDown = (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const current = event.target.closest?.(".it-row");
  if (!current) return;
  const rows = Array.from(event.currentTarget.querySelectorAll(".it-row"));
  const index = rows.indexOf(current);
  const next = rows[index + (event.key === "ArrowDown" ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
};

export default function ItemsPage() {
  const [data, setData] = useState(itemsCache);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selectedKey, setSelectedKey] = useState(readItemParam);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  // The row to bring into view after the next render: the selection when it comes from the URL
  // (deep link, back/forward), or the last open item when returning to the list on a phone.
  const scrollTargetRef = useRef(selectedKey);
  const lastKeyRef = useRef(selectedKey);

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
      const key = readItemParam();
      scrollTargetRef.current = key || lastKeyRef.current;
      if (key) lastKeyRef.current = key;
      setSelectedKey(key);
    };
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("locationchange", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("locationchange", syncFromUrl);
    };
  }, []);

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    for (const it of data?.list ?? []) counts.set(it.category, (counts.get(it.category) || 0) + 1);
    return counts;
  }, [data]);

  const filtered = useMemo(() => {
    const list = data?.list ?? [];
    const q = query.trim().toLowerCase();
    if (!q && !category) return list;
    const compact = toItemKey(q);
    return list.filter(
      (it) =>
        (!category || it.category === category) &&
        (!q || it.lower.includes(q) || (compact && it.key.includes(compact)))
    );
  }, [data, query, category]);

  const selectedItem = useMemo(
    () => (data && selectedKey && data.db[selectedKey] ? data.list.find((it) => it.key === selectedKey) || null : null),
    [data, selectedKey]
  );
  const selectedIndex = useMemo(
    () => (selectedKey ? filtered.findIndex((it) => it.key === selectedKey) : -1),
    [filtered, selectedKey]
  );

  const renderCount = SUPPORTS_INTERSECTION_OBSERVER
    ? Math.min(filtered.length, Math.max(visibleCount, selectedIndex + 1, filtered.findIndex((it) => it.key === lastKeyRef.current) + 1))
    : filtered.length;
  const hasMore = renderCount < filtered.length;

  // Render the list incrementally: load the next page when the sentinel nears the viewport.
  // Re-created after every page (and on new results) so a sentinel that is still visible keeps loading.
  // The list window scrolls on its own on desktop; on phones it scrolls with the page.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || !sentinel) return undefined;
    const container = scrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisibleCount(renderCount + PAGE_SIZE);
      },
      { root: listScrolls(container) ? container : null, rootMargin: "600px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, renderCount, filtered]);

  useEffect(() => {
    const key = scrollTargetRef.current;
    if (!key || !data) return;
    const container = scrollRef.current;
    if (!container) return;
    scrollTargetRef.current = null;
    const row = container.querySelector(`[data-item-key="${key}"]`);
    if (!row || row.offsetParent === null) return;
    if (listScrolls(container)) {
      const offset = row.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTop += offset - (container.clientHeight - row.offsetHeight) / 2;
    } else {
      row.scrollIntoView({ block: "center" });
    }
  }, [data, selectedKey]);

  const selectItem = (key) => {
    scrollTargetRef.current = null;
    if (key === selectedKey) return;
    lastKeyRef.current = key;
    writeItemParam(key);
    setSelectedKey(key);
    // The entry starts at its top: on phones it replaces the list, on desktop the page may be scrolled down
    if (window.scrollY > 0) window.scrollTo({ top: 0 });
  };

  const closeItem = () => {
    scrollTargetRef.current = lastKeyRef.current;
    writeItemParam(null);
    setSelectedKey(null);
  };

  const resetListScroll = () => {
    setVisibleCount(PAGE_SIZE);
    const container = scrollRef.current;
    if (!container) return;
    if (listScrolls(container)) container.scrollTop = 0;
    else if (container.getBoundingClientRect().top < 0) window.scrollTo({ top: 0 });
  };

  const updateQuery = (value) => {
    setQuery(value);
    resetListScroll();
  };

  const updateCategory = (value) => {
    setCategory(value);
    resetListScroll();
  };

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  const open = Boolean(selectedItem);
  const categoryLabel = category ? CATEGORY_LABEL.get(category) : "";

  let list;
  if (!data) {
    list = (
      <>
        <p className="sr-only" role="status">
          Loading items…
        </p>
        <ul className="it-rows" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <li key={index} className="it-row it-row--ghost">
              <span />
              <span className="it-row__icon skeleton" />
              <span className="it-row__text">
                <span className="it-row__name skeleton" />
                <span className="it-row__cat skeleton" />
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  } else if (filtered.length === 0) {
    list = (
      <div className="empty" role="status">
        <p className="empty__title">No items match</p>
        <p>
          {query.trim()
            ? `Nothing called “${query.trim()}”${categoryLabel ? ` in ${categoryLabel}` : ""}.`
            : `Nothing in ${categoryLabel}.`}
        </p>
        <div className="empty__actions">
          {query.trim() ? (
            <button type="button" className="btn" onClick={() => updateQuery("")}>
              Clear search
            </button>
          ) : null}
          {category ? (
            <button type="button" className="btn" onClick={() => updateCategory("")}>
              Search every category
            </button>
          ) : null}
        </div>
      </div>
    );
  } else {
    list = (
      <>
        <p className="it-list__count" aria-live="polite">
          <span className="num">{filtered.length.toLocaleString("en-US")}</span> {filtered.length === 1 ? "item" : "items"}
          {categoryLabel ? <span className="it-list__scope"> in {categoryLabel}</span> : null}
        </p>
        <ul className="it-rows" onKeyDown={onListKeyDown}>
          {filtered.slice(0, renderCount).map((it) => {
            const isSelected = it.key === selectedKey;
            return (
              <li key={it.key}>
                <a
                  href={`?i=${it.key}`}
                  data-item-key={it.key}
                  className={`it-row${isSelected ? " is-selected" : ""}`}
                  aria-current={isSelected ? "true" : undefined}
                  onClick={(event) => {
                    if (!isPlainLeftClick(event)) return;
                    event.preventDefault();
                    selectItem(it.key);
                  }}
                >
                  <Cursor className="it-row__cursor" />
                  <ItemIcon item={it} className="it-row__icon" size={ROW_ICON_SIZE} />
                  <span className="it-row__text">
                    <span className="it-row__name">{it.name}</span>
                    <span className="it-row__cat">{CATEGORY_LABEL.get(it.category)}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        {hasMore ? <div ref={sentinelRef} className="it-list__sentinel" aria-hidden="true" /> : null}
      </>
    );
  }

  let detail;
  if (!data && selectedKey) {
    detail = (
      <div className="it-entry" aria-hidden="true">
        <div className="win it-hero">
          <span className="it-hero__screen skeleton" />
          <div className="it-hero__id">
            <span className="it-ghost it-ghost--title skeleton" />
            <span className="it-ghost skeleton" />
          </div>
        </div>
        <div className="it-ghost it-ghost--box skeleton" />
      </div>
    );
  } else {
    detail = (
      <ItemDetailPanel
        item={selectedItem}
        entry={selectedItem ? data.db[selectedItem.key] : null}
        onBack={closeItem}
      />
    );
  }

  return (
    <main className={`it${!error && (open || (!data && selectedKey)) ? " it--open" : ""}`}>
      <h1 className="sr-only">Items</h1>
      <div className="strip it-strip">
        <div className="strip__row">
          <label className="field strip__search it-strip__search">
            <span className="sr-only">Search items</span>
            <Icon name="search" />
            <input
              className="field__input"
              type="search"
              inputMode="search"
              autoComplete="off"
              spellCheck="false"
              placeholder="Search items"
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && query) {
                  event.stopPropagation();
                  updateQuery("");
                }
              }}
            />
            {query ? (
              <button
                type="button"
                className="btn btn--quiet btn--icon btn--sm field__clear"
                onClick={() => updateQuery("")}
                aria-label="Clear search"
              >
                <Icon name="close" />
              </button>
            ) : null}
          </label>
          <label className={`field it-strip__cat${category ? " is-active" : ""}`}>
            <span className="sr-only">Category</span>
            <select className="field__input" value={category} onChange={(e) => updateCategory(e.target.value)} disabled={!data}>
              <option value="">All categories</option>
              {CATEGORIES.filter((c) => categoryCounts.get(c.key)).map((c) => (
                <option key={c.key} value={c.key}>
                  {`${c.label} · ${categoryCounts.get(c.key)}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="empty it-error" role="alert">
          <p className="empty__title">The item list didn't load</p>
          <p>Check your connection, then try again.</p>
          <button type="button" className="btn" onClick={retry}>
            Try again
          </button>
        </div>
      ) : (
        <div className="it-split">
          <nav className="it-list" ref={scrollRef} aria-label="Items">
            {list}
          </nav>
          <div className="it-detail">{detail}</div>
        </div>
      )}
    </main>
  );
}

function GameSelect({ title, section, selectedGame, onSelectGame }) {
  const optionGroups = useMemo(() => {
    const groups = new Map();
    for (const name of section.options) {
      const gen = resolveGame(name)?.gen ?? 0;
      if (!groups.has(gen)) groups.set(gen, []);
      groups.get(gen).push(name);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [section.options]);

  if (section.options.length === 0) return null;
  return (
    <select
      className="field__input it-game"
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
  );
}

// "Town A (detail, more), Town B" -> ["Town A (detail, more)", "Town B"]: commas inside brackets stay
const splitPlaces = (value) => {
  const parts = [];
  let depth = 0;
  let buffer = "";
  for (const char of String(value || "")) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      if (buffer.trim()) parts.push(buffer.trim());
      buffer = "";
      continue;
    }
    buffer += char;
  }
  if (buffer.trim()) parts.push(buffer.trim());
  return parts;
};

/** One per-game list of the entry. `dialog` renders it as the Game Boy text box (the flavour text). */
function GameSection({ title, section, selectedGame, onSelectGame, showAll = false, dialog = false }) {
  const matches = section.rows.filter((row) => row.games.includes(selectedGame));
  const shown = showAll ? matches : matches.slice(0, 1);
  const select = <GameSelect title={title} section={section} selectedGame={selectedGame} onSelectGame={onSelectGame} />;
  const headingId = `it-sec-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;

  let body;
  if (shown.length === 0) {
    body = <p className="it-sec__none">Not recorded for this item.</p>;
  } else if (shown.length === 1 && (dialog || splitPlaces(shown[0].value).length < 2)) {
    body = <p className={dialog ? "dialog__text it-sec__dialog-text" : "it-sec__text"}>{shown[0].value}</p>;
  } else if (shown.length === 1) {
    body = (
      <ul className="it-places">
        {splitPlaces(shown[0].value).map((place, idx) => (
          <li key={idx}>{place}</li>
        ))}
      </ul>
    );
  } else {
    body = (
      <ul className="it-lines">
        {shown.map((row, idx) => (
          <li key={`${row.label}-${idx}`} className="it-lines__row">
            <span className="it-lines__scope">{row.label}</span>
            <span className="it-lines__value">{row.value}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (dialog) {
    return (
      <section className="dialog it-sec it-sec--dialog" aria-labelledby={headingId}>
        <div className="it-sec__head">
          <h3 className="label" id={headingId}>
            {title}
          </h3>
          {select}
        </div>
        {body}
      </section>
    );
  }
  return (
    <section className="win it-sec" aria-labelledby={headingId}>
      <div className="win__head">
        <h3 className="win__title" id={headingId}>
          {title}
        </h3>
        {select}
      </div>
      <div className="win__body">{body}</div>
    </section>
  );
}

function ItemDetailPanel({ item, entry, onBack }) {
  // One preferred game shared by all sections; each falls back to its latest game.
  const [preferredGame, setPreferredGame] = useState("");
  const sections = useMemo(() => buildSections(entry), [entry]);

  if (!item || !entry) {
    return (
      <div className="win it-pick">
        <div className="empty">
          <p className="empty__title">Pick an item</p>
          <p>Search or scroll the list, then pick an item to see what it does, where to find it and what it costs in each game.</p>
        </div>
      </div>
    );
  }

  const gameFor = ({ options }) =>
    options.includes(preferredGame) ? preferredGame : options[options.length - 1] || "";
  const sectionProps = (section) => ({ section, selectedGame: gameFor(section), onSelectGame: setPreferredGame });

  return (
    <article className="it-entry" aria-labelledby="it-entry-title">
      <div className="it-entry__bar">
        <button type="button" className="btn btn--quiet it-entry__back" onClick={onBack}>
          <Icon name="left" />
          Items
        </button>
      </div>
      <header className="win it-hero">
        <div className="it-hero__screen">
          <ItemIcon key={item.key} item={item} className="it-hero__art" size={DETAIL_ICON_SIZE} />
        </div>
        <div className="it-hero__id">
          <h2 className="it-hero__name" id="it-entry-title">
            {item.name}
          </h2>
          <p className="it-hero__cat">{CATEGORY_LABEL.get(item.category)}</p>
          <dl className="kv it-facts">
            <div className="it-facts__cell">
              <dt>Type</dt>
              <dd>{entry.item_type || "—"}</dd>
            </div>
            <div className="it-facts__cell">
              <dt>Buy</dt>
              <dd className="it-facts__num">{formatPrice(entry.purchase_price)}</dd>
            </div>
            <div className="it-facts__cell">
              <dt>Sell</dt>
              <dd className="it-facts__num">{formatPrice(entry.sell_price)}</dd>
            </div>
          </dl>
        </div>
      </header>
      <GameSection title="Flavour Text" dialog {...sectionProps(sections.flavour)} />
      <div className="it-entry__grid">
        <GameSection title="Locations" showAll {...sectionProps(sections.locations)} />
        <GameSection title="Shops" showAll {...sectionProps(sections.shopping)} />
        <GameSection title="Pocket" {...sectionProps(sections.pocket)} />
      </div>
    </article>
  );
}
