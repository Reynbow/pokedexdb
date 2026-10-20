import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import GamePicker, { CartLogos } from "./GamePicker.jsx";
import FilterSheet from "./FilterSheet.jsx";
import { regionLabel, useDexCounts } from "./games.js";
import { GAME_LOOKUP } from "../constants/games.js";

/**
 * The context strip under the device bar: which game you're in, search within its Pokédex,
 * filters, what's active and how many entries match.
 */
export default function DexStrip({
  selectedGame,
  onPickGame,
  query,
  setQuery,
  availableTypes,
  selectedTypes,
  setSelectedTypes,
  availableTags,
  selectedTags,
  setSelectedTags,
  generationCap,
  resultCount,
  formCount = 0,
  loading,
  parts,
  activePart = null,
  onPart,
}) {
  const stripRef = useRef(null);
  const cartRef = useRef(null);
  const filterRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const counts = useDexCounts();
  const game = selectedGame ? GAME_LOOKUP.get(selectedGame) : null;
  const total = counts?.get(game ? game.key : "national");
  const activeCount = selectedTypes.size + selectedTags.size;

  // The list beside an open entry sticks under the strip, so publish the strip's height:
  // before the first paint, on every render (the strip gains a row of tokens or parts) and on resize
  const publishHeight = () => {
    const node = stripRef.current;
    if (node && node.offsetHeight > 0) {
      document.documentElement.style.setProperty("--strip-h", `${node.offsetHeight}px`);
    }
  };
  useLayoutEffect(publishHeight);
  useEffect(() => {
    const node = stripRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(publishHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const clearFilters = () => {
    setSelectedTypes(new Set());
    setSelectedTags(new Set());
  };
  const removeFrom = (setter, value) =>
    setter((prev) => {
      const next = new Set(prev);
      next.delete(value);
      return next;
    });

  const cartSub = game
    ? [regionLabel(game), total ? `${total.toLocaleString("en-US")} Pokémon` : null].filter(Boolean).join(" · ")
    : total
    ? `Every game · ${total.toLocaleString("en-US")} Pokémon`
    : "Every game";

  return (
    <div className="strip" ref={stripRef}>
      <div className="strip__row">
        <button
          ref={cartRef}
          type="button"
          className="cart"
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen(true)}
        >
          <CartLogos game={game} />
          <span className="cart__text">
            <span className="cart__title">{game ? game.label : "National Pokédex"}</span>
            <span className="cart__sub">{cartSub}</span>
          </span>
          <Icon name="down" className="cart__chevron" />
          <span className="sr-only">Change game</span>
        </button>

        <label className="field strip__search">
          <span className="sr-only">Search this Pokédex</span>
          <Icon name="search" />
          <input
            className="field__input"
            type="search"
            inputMode="search"
            autoComplete="off"
            spellCheck="false"
            placeholder="Name or number"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.stopPropagation();
                setQuery("");
              }
            }}
          />
          {query ? (
            <button type="button" className="btn btn--quiet btn--icon btn--sm field__clear" onClick={() => setQuery("")} aria-label="Clear search">
              <Icon name="close" />
            </button>
          ) : null}
        </label>

        <button
          ref={filterRef}
          type="button"
          className={`btn strip__filters${activeCount ? " is-active" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(true)}
        >
          <Icon name="filter" />
          <span className="strip__filters-label">Filters</span>
          {activeCount ? <span className="strip__badge">{activeCount}</span> : null}
        </button>

        <p className="strip__count" aria-live="polite">
          {loading ? (
            "Loading…"
          ) : (
            <>
              <span className="num">{resultCount.toLocaleString("en-US")}</span> {resultCount === 1 ? "entry" : "entries"}
              {formCount > 0 ? (
                <span className="strip__count-note">
                  incl. {formCount.toLocaleString("en-US")} {formCount === 1 ? "form" : "forms"}
                </span>
              ) : null}
            </>
          )}
        </p>
      </div>

      {activeCount > 0 || (parts && parts.length > 1) ? (
        <div className="strip__row strip__row--sub">
          {activeCount > 0 ? (
            <ul className="strip__tokens" aria-label="Active filters">
              {[...selectedTypes].map((type) => (
                <li key={type}>
                  <button type="button" className={`tag t-${type} token`} onClick={() => removeFrom(setSelectedTypes, type)}>
                    {type}
                    <Icon name="close" />
                    <span className="sr-only">Remove filter</span>
                  </button>
                </li>
              ))}
              {[...selectedTags].map((tag) => (
                <li key={tag}>
                  <button type="button" className="btn btn--sm token token--tag" onClick={() => removeFrom(setSelectedTags, tag)}>
                    {tag}
                    <Icon name="close" />
                    <span className="sr-only">Remove filter</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="btn btn--quiet btn--sm" onClick={clearFilters}>
                  Clear all
                </button>
              </li>
            </ul>
          ) : null}
          {parts && parts.length > 1 ? (
            <div className="strip__parts" role="group" aria-label="Show part of this Pokédex">
              <button type="button" className="btn btn--sm strip__part" aria-pressed={!activePart} onClick={() => onPart?.(null)}>
                All
              </button>
              {parts.map((part) => (
                <button
                  key={part.key}
                  type="button"
                  className="btn btn--sm strip__part"
                  aria-pressed={activePart === part.key}
                  onClick={() => onPart?.(activePart === part.key ? null : part.key)}
                >
                  {part.label}
                  <span className="num">{part.count.toLocaleString("en-US")}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <GamePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        anchorRef={cartRef}
        selectedGame={selectedGame}
        counts={counts}
        onPick={onPickGame}
      />
      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        anchorRef={filterRef}
        availableTypes={availableTypes}
        selectedTypes={selectedTypes}
        setSelectedTypes={setSelectedTypes}
        availableTags={availableTags}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        generationCap={generationCap}
        resultCount={resultCount}
        onClear={clearFilters}
      />
    </div>
  );
}
