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
    <header className="app-header">
      <div className="container">
        <h1 className="title">{title}</h1>
        <p className="subtitle">{subtitle}</p>
        <CategoryToggle />
        <div className="search-row">
          <div className="filters-toggle" aria-label="Filters visibility">
            <span className="filters-toggle-label">Filters</span>
            <button
              type="button"
              className={`ios-switch${showFilters ? " is-on" : ""}`}
              role="switch"
              aria-checked={showFilters}
              aria-label={showFilters ? "Hide filters" : "Show filters"}
              onClick={() => setShowFilters((v) => !v)}
            >
              <span className="ios-switch-track" aria-hidden="true"></span>
              <span className="ios-switch-thumb" aria-hidden="true"></span>
            </button>
          </div>
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


