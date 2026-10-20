import Sheet from "../components/Sheet.jsx";
import Icon from "../components/Icon.jsx";
import { getTypeIconUrl } from "../utils/typeIcons.js";
import { ROMAN } from "./games.js";

const toggle = (setter, value) =>
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });

const hideBrokenIcon = (event) => {
  event.currentTarget.style.display = "none";
};

export function TypeToggle({ type, on, onToggle }) {
  return (
    <button type="button" className={`tag tag--lg t-${type}${on ? "" : " tag--off"}`} aria-pressed={on} onClick={onToggle}>
      <img src={getTypeIconUrl(type)} alt="" loading="lazy" decoding="async" onError={hideBrokenIcon} />
      {type}
    </button>
  );
}

/** Type and category filters for the current Pokédex. */
export default function FilterSheet({
  open,
  onClose,
  anchorRef,
  availableTypes,
  selectedTypes,
  setSelectedTypes,
  availableTags,
  selectedTags,
  setSelectedTags,
  generationCap,
  resultCount,
  onClear,
}) {
  const active = selectedTypes.size + selectedTags.size;
  return (
    <Sheet open={open} onClose={onClose} anchorRef={anchorRef} label="Filters" width={440} align="end" className="filter-sheet">
      <div className="popsheet__head">
        <h2 className="popsheet__title">Filters</h2>
        <button type="button" className="btn btn--quiet btn--icon btn--sm" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="popsheet__body">
        <section className="filter-group" aria-labelledby="filter-type">
          <div className="filter-group__head">
            <h3 className="label" id="filter-type">
              Type
            </h3>
            <p className="filter-group__hint">
              {generationCap ? `As of Gen ${ROMAN[generationCap]}. ` : ""}Pick two for a dual type.
            </p>
          </div>
          <div className="filter-types">
            {availableTypes.map((type) => (
              <TypeToggle key={type} type={type} on={selectedTypes.has(type)} onToggle={() => toggle(setSelectedTypes, type)} />
            ))}
          </div>
        </section>
        <section className="filter-group" aria-labelledby="filter-category">
          <div className="filter-group__head">
            <h3 className="label" id="filter-category">
              Category
            </h3>
          </div>
          <div className="filter-cats">
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="btn btn--sm"
                aria-pressed={selectedTags.has(tag)}
                onClick={() => toggle(setSelectedTags, tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="popsheet__foot">
        <button type="button" className="btn btn--quiet" onClick={onClear} disabled={active === 0}>
          Clear filters
        </button>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Show {resultCount} Pokémon
        </button>
      </div>
    </Sheet>
  );
}
