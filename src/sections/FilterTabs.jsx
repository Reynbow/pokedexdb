import React, { useState } from "react";
import { ALL_TYPES } from "../constants/types.js";
import { SPECIAL_FILTERS, SPECIAL_TAG_META } from "../constants/tags.js";
import { DEX_FILTERS } from "../constants/dex.js";
import { getTypeIconUrl } from "../utils/typeIcons.js";

export default function FilterTabs({
  selectedTypes,
  setSelectedTypes,
  typeIndexRef,
  selectedTags,
  setSelectedTags,
  selectedDex,
  setSelectedGame,
  setSelectedDex,
  clearSelection,
}) {
  const [activeTab, setActiveTab] = useState("types");

  return (
    <div className="filter-tabs-container">
      <div className="filters-stack">
        {/* Desktop: Show all filters */}
        <div className="filters-desktop">
          <div className="filters-row">
            <div className="filter-box-wrap">
              <div className="filter-box-title">Types</div>
              <div className="filter-box">
                <div className="type-filters">
                  {ALL_TYPES.map((t) => (
                    <span
                      key={t}
                      className={`type-chip type-${t}${selectedTypes.has(t) ? "" : " off"}`}
                      role="button"
                      title={`Toggle ${t}`}
                      onClick={() => {
                        setSelectedTypes((prev) => {
                          const next = new Set(prev);
                          if (next.has(t)) {
                            next.delete(t);
                          } else {
                            if (!typeIndexRef.current.get(t)) {
                              fetch(`https://pokeapi.co/api/v2/type/${t}`)
                                .then((r) => r.json())
                                .then((data) => {
                                  const items = new Set((data.pokemon || []).map((x) => x.pokemon.name));
                                  typeIndexRef.current.set(t, items);
                                })
                                .catch(() => {});
                            }
                            next.add(t);
                          }
                          return next;
                        });
                      }}
                    >
                      <img 
                        src={getTypeIconUrl(t)} 
                        alt={t} 
                        className="type-icon"
                        onError={(e) => {
                          // Hide icon if it fails to load
                          e.target.style.display = 'none';
                        }}
                      />
                      <span className="type-name">{t}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="filter-box-wrap">
              <div className="filter-box-title">Special</div>
              <div className="filter-box">
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
                        onClick={() => {
                          setSelectedTags((prev) => {
                            const next = new Set(prev);
                            if (next.has(tag)) {
                              next.delete(tag);
                            } else {
                              next.add(tag);
                            }
                            return next;
                          });
                        }}
                        aria-pressed={isOn}
                        title={`Toggle ${tag}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="filter-box-wrap">
              <div className="filter-box-title">Regional</div>
              <div className="filter-box">
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
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Tabbed interface */}
        <div className="filters-mobile">
          <div className="filter-tabs-header">
            <button
              type="button"
              className={`filter-tab-button ${activeTab === "types" ? "is-active" : ""}`}
              onClick={() => setActiveTab("types")}
            >
              Types
            </button>
            <button
              type="button"
              className={`filter-tab-button ${activeTab === "special" ? "is-active" : ""}`}
              onClick={() => setActiveTab("special")}
            >
              Special
            </button>
            <button
              type="button"
              className={`filter-tab-button ${activeTab === "dex" ? "is-active" : ""}`}
              onClick={() => setActiveTab("dex")}
            >
              Dex
            </button>
          </div>

          <div className="filter-tabs-content">
            {activeTab === "types" && (
              <div className="type-filters">
                {ALL_TYPES.map((t) => (
                  <span
                    key={t}
                    className={`type-chip type-${t}${selectedTypes.has(t) ? "" : " off"}`}
                    role="button"
                    title={`Toggle ${t}`}
                    onClick={() => {
                      setSelectedTypes((prev) => {
                        const next = new Set(prev);
                        if (next.has(t)) {
                          next.delete(t);
                        } else {
                          if (!typeIndexRef.current.get(t)) {
                            fetch(`https://pokeapi.co/api/v2/type/${t}`)
                              .then((r) => r.json())
                              .then((data) => {
                                const items = new Set((data.pokemon || []).map((x) => x.pokemon.name));
                                typeIndexRef.current.set(t, items);
                              })
                              .catch(() => {});
                          }
                          next.add(t);
                        }
                        return next;
                      });
                    }}
                  >
                    <img 
                      src={getTypeIconUrl(t)} 
                      alt={t} 
                      className="type-icon"
                      onError={(e) => {
                        // Hide icon if it fails to load
                        e.target.style.display = 'none';
                      }}
                    />
                    <span className="type-name">{t}</span>
                  </span>
                ))}
              </div>
            )}

            {activeTab === "special" && (
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
                      onClick={() => {
                        setSelectedTags((prev) => {
                          const next = new Set(prev);
                          if (next.has(tag)) {
                            next.delete(tag);
                          } else {
                            next.add(tag);
                          }
                          return next;
                        });
                      }}
                      aria-pressed={isOn}
                      title={`Toggle ${tag}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === "dex" && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}










