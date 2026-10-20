import React, { useState } from "react";
import { ALL_TYPES } from "../constants/types.js";
import { SPECIAL_FILTERS, SPECIAL_TAG_META } from "../constants/tags.js";
import { DEX_FILTERS } from "../constants/dex.js";
import { getTypeIconUrl } from "../utils/typeIcons.js";

const toggleInSet = (setter, value) =>
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });

const hideBrokenIcon = (e) => {
  e.target.style.display = "none";
};

function TypeChips({ types, selectedTypes, setSelectedTypes }) {
  return (
    <div className="type-filters">
      {types.map((t) => {
        const isOn = selectedTypes.has(t);
        return (
          <button
            key={t}
            type="button"
            className={`type-chip type-${t}${isOn ? "" : " off"}`}
            aria-pressed={isOn}
            title={`Toggle ${t}`}
            onClick={() => toggleInSet(setSelectedTypes, t)}
          >
            {/* Left, in-button icon */}
            <img
              src={getTypeIconUrl(t)}
              alt=""
              aria-hidden="true"
              className="type-icon type-icon--left"
              loading="lazy"
              decoding="async"
              onError={hideBrokenIcon}
            />
            <span className="type-name">{t}</span>
            {/* Right, oversized decorative icon */}
            <img
              src={getTypeIconUrl(t)}
              alt=""
              aria-hidden="true"
              className="type-icon type-icon--right"
              loading="lazy"
              decoding="async"
              onError={hideBrokenIcon}
            />
          </button>
        );
      })}
    </div>
  );
}

function SpecialChips({ selectedTags, setSelectedTags }) {
  return (
    <div className="special-filters">
      {SPECIAL_FILTERS.map((tag) => {
        const isOn = selectedTags.has(tag);
        const meta = SPECIAL_TAG_META.get(tag);
        const classNames = ["type-chip", "special-filter-chip"];
        if (meta?.className) classNames.push(meta.className);
        if (isOn) classNames.push("is-on");
        return (
          <button
            key={tag}
            type="button"
            className={classNames.join(" ")}
            onClick={() => toggleInSet(setSelectedTags, tag)}
            aria-pressed={isOn}
            title={`Toggle ${tag}`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

function DexChips({ selectedDex, setSelectedDex, setSelectedGame, clearSelection }) {
  return (
    <div className="dex-filters">
      {DEX_FILTERS.map((dex) => {
        const isActive = dex.key === selectedDex;
        return (
          <button
            key={dex.key}
            type="button"
            className={`type-chip special-filter-chip ${dex.key}${isActive ? " is-on" : ""}`}
            onClick={() => {
              setSelectedGame(dex.games?.[0]?.key ?? null);
              setSelectedDex(dex.key);
              clearSelection();
            }}
            aria-pressed={isActive}
            title={`Use ${dex.label} Pokedex`}
          >
            {dex.label}
          </button>
        );
      })}
    </div>
  );
}

export default function FilterTabs({
  availableTypes = ALL_TYPES,
  selectedTypes,
  setSelectedTypes,
  selectedTags,
  setSelectedTags,
  selectedDex,
  setSelectedGame,
  setSelectedDex,
  clearSelection,
  setShowFilters,
}) {
  const [activeTab, setActiveTab] = useState("types");
  const typeChips = (
    <TypeChips types={availableTypes} selectedTypes={selectedTypes} setSelectedTypes={setSelectedTypes} />
  );
  const specialChips = <SpecialChips selectedTags={selectedTags} setSelectedTags={setSelectedTags} />;
  const dexChips = (
    <DexChips
      selectedDex={selectedDex}
      setSelectedDex={setSelectedDex}
      setSelectedGame={setSelectedGame}
      clearSelection={clearSelection}
    />
  );

  return (
    <div className="filter-tabs-container">
      <div className="filters-stack">
        {/* Desktop: Show all filters */}
        <div className="filters-desktop">
          <div className="filters-row">
            <div className="filter-box-wrap has-hide-control">
              <div className="filter-box-title">Types</div>
              {setShowFilters ? (
                <button
                  type="button"
                  className="filters-hide-affix"
                  aria-label="Hide filters"
                  onClick={() => setShowFilters(false)}
                  title="Hide filters"
                >
                  ▲ Hide filters
                </button>
              ) : null}
              <div className="filter-box">{typeChips}</div>
            </div>
            <div className="filter-box-wrap">
              <div className="filter-box-title">Special</div>
              <div className="filter-box">{specialChips}</div>
            </div>
            <div className="filter-box-wrap">
              <div className="filter-box-title">Regional</div>
              <div className="filter-box">{dexChips}</div>
            </div>
          </div>
        </div>

        {/* Mobile: Tabbed interface */}
        <div className="filters-mobile">
          <div className="filter-tabs-header" role="tablist" aria-label="Filter categories">
            {[
              ["types", "Types"],
              ["special", "Special"],
              ["dex", "Dex"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                className={`filter-tab-button ${activeTab === key ? "is-active" : ""}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="filter-tabs-content">
            {activeTab === "types" && typeChips}
            {activeTab === "special" && specialChips}
            {activeTab === "dex" && dexChips}
          </div>
        </div>
      </div>
    </div>
  );
}
