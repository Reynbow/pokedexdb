import React, { useCallback, useEffect, useMemo, useState } from "react";
import SpriteImage from "./components/SpriteImage.jsx";
import "./HomePage.css";

const FALLBACK_TOTAL_POKEMON = 1010;
const SLOTS_PER_PAGE = 30;
const NATIONAL_DEX_URL = "https://pokeapi.co/api/v2/pokedex/national";

const formatDexNumber = (value) => String(value).padStart(4, "0");

const toTitleCase = (value) =>
  String(value || "")
    .toLowerCase()
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getIdFromUrl = (url) => {
  if (!url) return null;
  const parts = String(url)
    .split("/")
    .filter(Boolean);
  const last = parts[parts.length - 1];
  const numeric = Number.parseInt(last, 10);
  return Number.isFinite(numeric) ? numeric : null;
};

export default function HomePage() {
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedPokemon, setHighlightedPokemon] = useState(null);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(NATIONAL_DEX_URL);
        if (!response?.ok) {
          throw new Error(`Failed to load National Dex (${response?.status || "unknown"})`);
        }
        const json = await response.json();
        if (ignore) return;
        const rawEntries = Array.isArray(json?.pokemon_entries) ? json.pokemon_entries : [];
        const normalized = rawEntries
          .map((entry) => {
            const number = Number(entry?.entry_number);
            const name = entry?.pokemon_species?.name;
            const speciesUrl = entry?.pokemon_species?.url || null;
            if (!Number.isFinite(number) || number <= 0 || !name) {
              return null;
            }
            if (number > FALLBACK_TOTAL_POKEMON) {
              return null;
            }
            const spriteId = getIdFromUrl(speciesUrl) ?? number;
            return {
              number,
              name,
              displayName: toTitleCase(name),
              speciesUrl,
              spriteId,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.number - b.number);
        setEntries(normalized);
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError?.message || "Unable to load National Dex data.");
          setEntries([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      ignore = true;
    };
  }, []);

  const entryMap = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => {
      map.set(entry.number, entry);
    });
    return map;
  }, [entries]);

  const maxDexNumber = useMemo(() => {
    if (entries.length > 0) {
      return entries[entries.length - 1].number;
    }
    return FALLBACK_TOTAL_POKEMON;
  }, [entries]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(maxDexNumber / SLOTS_PER_PAGE)),
    [maxDexNumber]
  );

  useEffect(() => {
    setPage((current) => {
      if (current < 1) return 1;
      if (current > totalPages) return totalPages;
      return current;
    });
  }, [totalPages]);

  useEffect(() => {
    if (highlightedPokemon == null) return;
    
    const timeoutId = setTimeout(() => {
      const element = document.getElementById(`pokemon-slot-${highlightedPokemon}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }, 100);

    const clearHighlightTimeout = setTimeout(() => {
      setHighlightedPokemon(null);
    }, 3000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(clearHighlightTimeout);
    };
  }, [highlightedPokemon, page]);

  const pagination = useMemo(() => {
    const clampedPage = Math.min(Math.max(page, 1), totalPages);
    const start = (clampedPage - 1) * SLOTS_PER_PAGE + 1;
    const end = Math.min(start + SLOTS_PER_PAGE - 1, maxDexNumber);
    const slots = Array.from({ length: SLOTS_PER_PAGE }, (_, index) => {
      const dexNumber = start + index;
      const entry = dexNumber <= maxDexNumber ? entryMap.get(dexNumber) || null : null;
      return { dexNumber, entry };
    });
    return {
      page: clampedPage,
      start,
      end,
      slots,
      hasPrevious: clampedPage > 1,
      hasNext: clampedPage < totalPages,
      rangeLabel: `${formatDexNumber(start)} - ${formatDexNumber(Math.min(end, maxDexNumber))}`,
      totalPages,
    };
  }, [page, totalPages, entryMap, maxDexNumber]);

  const handleSelectDexNumber = useCallback(
    (dexNumber) => {
      if (!Number.isFinite(dexNumber) || dexNumber <= 0) return;
      const targetPage = Math.floor((dexNumber - 1) / SLOTS_PER_PAGE) + 1;
      setPage(targetPage);
      setHighlightedPokemon(dexNumber);
    },
    []
  );

  const handlePrevious = () => {
    if (!pagination.hasPrevious) return;
    setPage((current) => Math.max(1, current - 1));
    setHighlightedPokemon(null);
  };

  const handleNext = () => {
    if (!pagination.hasNext) return;
    setPage((current) => Math.min(totalPages, current + 1));
    setHighlightedPokemon(null);
  };

  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  const suggestions = useMemo(() => {
    if (!normalizedSearch) return [];
    const limit = 8;
    const matches = [];
    for (const entry of entries) {
      if (matches.length >= limit) break;
      const nameMatch = entry.displayName.toLowerCase().includes(normalizedSearch);
      const dexMatch = formatDexNumber(entry.number).includes(normalizedSearch) || String(entry.number).includes(normalizedSearch);
      if (nameMatch || dexMatch) {
        matches.push(entry);
      }
    }
    return matches;
  }, [entries, normalizedSearch]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const handleGridNameClick = (entry) => {
    if (!entry) return;
    handleSelectDexNumber(entry.number);
    clearSearch();
  };

  const handleSuggestionSelect = (entry) => {
    handleGridNameClick(entry);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (!normalizedSearch) return;
    if (suggestions.length > 0) {
      handleSuggestionSelect(suggestions[0]);
      return;
    }
    const valueAsNumber = Number.parseInt(normalizedSearch, 10);
    if (Number.isFinite(valueAsNumber) && valueAsNumber > 0 && valueAsNumber <= maxDexNumber) {
      handleSelectDexNumber(valueAsNumber);
      clearSearch();
    }
  };

  return (
    <div className="home-page">
      <div className="home-container">
        <form className="home-search" onSubmit={handleSearchSubmit} role="search">
          <div className="home-search-input-wrapper">
            <input
              type="text"
              className="home-search-input"
              placeholder="Search Pokémon or Dex #"
              value={searchTerm}
              onChange={handleSearchChange}
              aria-label="Search Pokémon by name or number"
            />
            {searchTerm ? (
              <button type="button" className="home-search-clear" onClick={clearSearch} aria-label="Clear search">
                ×
              </button>
            ) : null}
            {normalizedSearch && suggestions.length > 0 ? (
              <ul className="home-search-suggestions" role="listbox">
                {suggestions.map((entry) => (
                  <li key={entry.number}>
                    <button
                      type="button"
                      className="home-search-suggestion"
                      onClick={() => handleSuggestionSelect(entry)}
                      role="option"
                    >
                      <span className="home-search-suggestion-name">{entry.displayName}</span>
                      <span className="home-search-suggestion-number">#{formatDexNumber(entry.number)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </form>

        <header className="home-header">
          <button
            type="button"
            className="home-nav-button"
            onClick={handlePrevious}
            disabled={!pagination.hasPrevious}
            aria-label="Previous page"
          >
            Previous
          </button>
          <div className="home-header-title" aria-live="polite">
            <h1 className="home-header-range">{pagination.rangeLabel}</h1>
            <span className="home-header-page">
              Page {pagination.page} of {pagination.totalPages}
            </span>
          </div>
          <button
            type="button"
            className="home-nav-button"
            onClick={handleNext}
            disabled={!pagination.hasNext}
            aria-label="Next page"
          >
            Next
          </button>
        </header>

        {error ? (
          <div className="home-status home-status-error" role="alert">
            {error}
          </div>
        ) : null}
        {loading && !entries.length ? (
          <div className="home-status home-status-loading">Loading Pokémon…</div>
        ) : null}

        <div className="home-grid-wrapper">
          <div className="home-grid">
            {pagination.slots.map((slot) => {
              const hasEntry = Boolean(slot.entry);
              const isHighlighted = highlightedPokemon === slot.dexNumber;
              const className = `home-slot${hasEntry ? " has-entry" : " is-empty"}${isHighlighted ? " is-highlighted" : ""}`;
              return (
                <div key={slot.dexNumber} className="home-card">
                  <div id={`pokemon-slot-${slot.dexNumber}`} className={className}>
                    {hasEntry ? (
                      <span className="home-slot-name">{slot.entry.displayName}</span>
                    ) : null}
                    {hasEntry ? (
                      <div className="home-slot-sprite">
                        <SpriteImage
                          id={slot.entry.spriteId}
                          alt={slot.entry.displayName}
                          variant="home"
                          width={120}
                          height={120}
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <span className="home-slot-placeholder">Empty Slot</span>
                    )}
                    <span className="home-slot-number">#{formatDexNumber(slot.dexNumber)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}



