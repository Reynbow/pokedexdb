import React, { memo } from "react";
import CategoryToggle from "../CategoryToggle.jsx";

function HeaderSection({
  title = "Pokedex",
  subtitle = "Search and explore every Pokemon",
  showFilters,
  setShowFilters,
  query,
  setQuery,
  onReset,
  FilterTabsComponent,
  filterTabsProps,
}) {
  return (
    <header className={`app-header${showFilters ? " has-filters" : ""}`}>
      <div className="container">
        <h1 className="title logo">
          <span className="logo-accent">Pokedex</span>
          <div className="logo-dot"></div>
          <span className="logo-db">DB</span>
        </h1>
        <CategoryToggle />
        <div className="search-row">
          {!showFilters ? (
            <button
              type="button"
              className="filters-show-fab"
              aria-label="Show filters"
              onClick={() => setShowFilters(true)}
              title="Show filters"
            >
              ▼ Show filters
            </button>
          ) : null}
          <input
            className="search"
            placeholder="Search Pokemon"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="reset-button" onClick={onReset}>
            Reset
          </button>
        </div>
        {showFilters && FilterTabsComponent ? (
          <FilterTabsComponent {...filterTabsProps} />
        ) : null}
      </div>
    </header>
  );
}

export default memo(HeaderSection);


