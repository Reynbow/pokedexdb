import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import CategoryToggle from "./CategoryToggle.jsx";
import SpriteImage from "./components/SpriteImage.jsx";
import { ALT_FORM_HIDE_FLAGS } from "./constants/forms.js";
import { NATIONAL_ID_TO_SLUG } from "./data/pokemonSpeciesMap.js";
import { loadPokemonList } from "./data/staticData.js";
import { formatPokemonName } from "./utils/pokemonNames.js";
import "./HomePage.css";

const MAX_DEX_NUMBER = 1025;
const FIRST_FORM_ID = 10000; // PokeAPI ids >= 10000 are alternate forms
const SLOTS_PER_PAGE = 30;

// Regional variants are named "<species>-<region>[-<form>]" in PokeAPI ("rattata-alola",
// "darmanitan-galar-zen", "tauros-paldea-aqua-breed").
const REGIONAL_TOKENS = new Set(["alola", "galar", "hisui", "paldea"]);
// These carry a region token but aren't regional forms ("pikachu-alola-cap", "raticate-totem-alola").
const NON_REGIONAL_TOKENS = new Set(["cap", "totem"]);

const formatDexNumber = (value) => String(value).padStart(4, "0");

const normalizeSearchText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const getIdFromUrl = (url) => {
  const match = /\/(\d+)\/?$/.exec(String(url || ""));
  return match ? Number.parseInt(match[1], 10) : null;
};

const isRegionalFormName = (name) => {
  const tokens = String(name || "").toLowerCase().split("-");
  return tokens.some((token) => REGIONAL_TOKENS.has(token)) && !tokens.some((token) => NON_REGIONAL_TOKENS.has(token));
};

const makeEntry = ({ id, slug, dexNumber, isForm }) => {
  const displayName = formatPokemonName(slug) || `#${formatDexNumber(dexNumber)}`;
  return {
    entryKey: `${isForm ? "form" : "dex"}-${id}`,
    id,
    name: slug,
    displayName,
    dexNumber,
    isForm,
    searchText: normalizeSearchText(`${displayName} ${slug.replace(/-/g, " ")}`),
  };
};

// National Dex #1-#1025 in order, each species followed by its regional forms (in PokeAPI order).
const buildDisplayEntries = (pokemonList) => {
  const bases = [];
  const formsBySpecies = new Map();
  for (const raw of pokemonList) {
    const id = Number.isFinite(raw?.id) ? raw.id : getIdFromUrl(raw?.url);
    if (!Number.isFinite(id) || !raw?.name) continue;
    if (id < FIRST_FORM_ID) {
      if (id >= 1 && id <= MAX_DEX_NUMBER) bases.push({ id, name: raw.name });
      continue;
    }
    const speciesId = raw.speciesId;
    if (!Number.isFinite(speciesId) || ALT_FORM_HIDE_FLAGS.has(speciesId) || !isRegionalFormName(raw.name)) continue;
    const forms = formsBySpecies.get(speciesId) || [];
    forms.push({ id, name: raw.name });
    formsBySpecies.set(speciesId, forms);
  }

  bases.sort((a, b) => a.id - b.id);
  const entries = [];
  for (const base of bases) {
    // Species slug, not the default form's ("deoxys" rather than "deoxys-normal").
    const slug = NATIONAL_ID_TO_SLUG[base.id] || base.name;
    entries.push(makeEntry({ id: base.id, slug, dexNumber: base.id, isForm: false }));
    const forms = (formsBySpecies.get(base.id) || []).sort((a, b) => a.id - b.id);
    for (const form of forms) {
      entries.push(makeEntry({ id: form.id, slug: form.name, dexNumber: base.id, isForm: true }));
    }
  }
  return entries;
};

export default function HomePage() {
  const [page, setPage] = useState(1);
  const [displayEntries, setDisplayEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedEntryKey, setHighlightedEntryKey] = useState(null);

  useEffect(() => {
    let ignore = false;
    loadPokemonList()
      .then((list) => {
        if (!ignore) setDisplayEntries(buildDisplayEntries(Array.isArray(list) ? list : []));
      })
      .catch((loadError) => {
        if (!ignore) setError(loadError?.message || "Unable to load Pokémon data.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(displayEntries.length / SLOTS_PER_PAGE));

  useEffect(() => {
    setPage((current) => Math.min(Math.max(current, 1), totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!highlightedEntryKey) return undefined;
    const timeoutId = setTimeout(() => {
      const element = document.getElementById(`pokemon-slot-${highlightedEntryKey}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }, 100);
    const clearHighlightTimeout = setTimeout(() => {
      setHighlightedEntryKey(null);
    }, 3000);
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(clearHighlightTimeout);
    };
  }, [highlightedEntryKey, page]);

  const pagination = useMemo(() => {
    const clampedPage = Math.min(Math.max(page, 1), totalPages);
    const startIndex = (clampedPage - 1) * SLOTS_PER_PAGE;
    const slots = displayEntries.slice(startIndex, startIndex + SLOTS_PER_PAGE);
    const firstDex = slots.length > 0 ? slots[0].dexNumber : null;
    const lastDex = slots.length > 0 ? slots[slots.length - 1].dexNumber : null;
    const rangeLabel =
      firstDex != null && lastDex != null
        ? `#${formatDexNumber(firstDex)} - #${formatDexNumber(lastDex)}`
        : "Entries";

    return {
      page: clampedPage,
      slots,
      hasPrevious: clampedPage > 1,
      hasNext: clampedPage < totalPages,
      rangeLabel,
      totalPages,
    };
  }, [displayEntries, page, totalPages]);

  const focusEntryByIndex = useCallback(
    (index) => {
      if (index < 0 || index >= displayEntries.length) return;
      setPage(Math.floor(index / SLOTS_PER_PAGE) + 1);
      setHighlightedEntryKey(displayEntries[index].entryKey);
    },
    [displayEntries]
  );

  const handleSelectDexNumber = useCallback(
    (dexNumber) => {
      if (!Number.isFinite(dexNumber) || dexNumber <= 0) return;
      focusEntryByIndex(displayEntries.findIndex((entry) => !entry.isForm && entry.dexNumber === dexNumber));
    },
    [displayEntries, focusEntryByIndex]
  );

  const focusEntry = useCallback(
    (entry) => {
      if (!entry) return;
      focusEntryByIndex(displayEntries.findIndex((candidate) => candidate.entryKey === entry.entryKey));
    },
    [displayEntries, focusEntryByIndex]
  );

  const handlePrevious = () => {
    if (!pagination.hasPrevious) return;
    setPage((current) => Math.max(1, current - 1));
    setHighlightedEntryKey(null);
  };

  const handleNext = () => {
    if (!pagination.hasNext) return;
    setPage((current) => Math.min(totalPages, current + 1));
    setHighlightedEntryKey(null);
  };

  const normalizedSearch = useMemo(() => normalizeSearchText(searchTerm.trim()), [searchTerm]);

  const suggestions = useMemo(() => {
    if (!normalizedSearch) return [];
    const limit = 8;
    const matches = [];
    for (const entry of displayEntries) {
      if (matches.length >= limit) break;
      const nameMatch = entry.searchText.includes(normalizedSearch);
      const dexMatch =
        formatDexNumber(entry.dexNumber).includes(normalizedSearch) || String(entry.dexNumber).includes(normalizedSearch);
      if (nameMatch || dexMatch) {
        matches.push(entry);
      }
    }
    return matches;
  }, [displayEntries, normalizedSearch]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (!normalizedSearch) return;
    if (suggestions.length > 0) {
      focusEntry(suggestions[0]);
      return;
    }
    const valueAsNumber = Number.parseInt(normalizedSearch, 10);
    if (Number.isFinite(valueAsNumber) && valueAsNumber > 0 && valueAsNumber <= MAX_DEX_NUMBER) {
      handleSelectDexNumber(valueAsNumber);
      clearSearch();
    }
  };

  return (
    <div className="home-page">
      <div className="home-container">
        <CategoryToggle />

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
                  <li key={entry.entryKey}>
                    <button
                      type="button"
                      className="home-search-suggestion"
                      onClick={() => focusEntry(entry)}
                      role="option"
                    >
                      <span className="home-search-suggestion-name">{entry.displayName}</span>
                      <span className="home-search-suggestion-number">#{formatDexNumber(entry.dexNumber)}</span>
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
        {loading ? <div className="home-status home-status-loading">Loading Pokémon…</div> : null}

        <div className="home-grid-wrapper">
          <div className="home-grid">
            {pagination.slots.map((entry) => {
              const isHighlighted = highlightedEntryKey === entry.entryKey;
              return (
                <div key={entry.entryKey} className="home-card">
                  <div
                    id={`pokemon-slot-${entry.entryKey}`}
                    className={`home-slot has-entry${isHighlighted ? " is-highlighted" : ""}`}
                  >
                    <span className="home-slot-name">{entry.displayName}</span>
                    <div className="home-slot-sprite">
                      <SpriteImage
                        id={entry.id}
                        alt={entry.displayName}
                        variant="home"
                        width={120}
                        height={120}
                        loading="lazy"
                      />
                    </div>
                    <span className="home-slot-number">#{formatDexNumber(entry.dexNumber)}</span>
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
