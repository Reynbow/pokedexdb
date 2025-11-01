import React, { useCallback, useEffect, useMemo, useState } from "react";
import SpriteImage from "./components/SpriteImage.jsx";
import "./HomePage.css";

const FALLBACK_TOTAL_POKEMON = 1025;
const SLOTS_PER_PAGE = 30;
const NATIONAL_DEX_URL = "https://pokeapi.co/api/v2/pokedex/national";
const POKEAPI_BASE = "https://pokeapi.co/api/v2";

const FORM_PAGES = [
  { key: "alolan", label: "Alolan Forms" },
  { key: "galarian", label: "Galarian Forms" },
  { key: "hisuian", label: "Hisuian Forms" },
  { key: "paldean", label: "Paldean Forms" },
  { key: "unown", label: "Unown Box" },
];

// Known Pokemon with regional forms (by national dex number)
const REGIONAL_FORMS_MAP = {
  alolan: [19, 20, 26, 27, 28, 37, 38, 50, 51, 52, 53, 74, 75, 76, 88, 89, 103, 105],
  galarian: [52, 77, 78, 79, 80, 83, 110, 122, 144, 145, 146, 222, 263, 264, 554, 555, 562, 618, 859, 860, 861, 865, 866, 867, 868, 869],
  hisuian: [58, 59, 100, 101, 157, 211, 215, 503, 549, 550, 570, 571, 628, 705, 706, 713, 724],
  paldean: [194, 128, 1029, 1030, 1031, 1032],
};

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
  const [currentFormPage, setCurrentFormPage] = useState(null);
  const [formEntries, setFormEntries] = useState(new Map());
  const [formLoading, setFormLoading] = useState(false);

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
            if (number > 1025) {
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
    // Cap at 1025 to ensure last regular page shows 1021-1025
    if (entries.length > 0) {
      const max = entries[entries.length - 1].number;
      return Math.min(max, 1025);
    }
    return FALLBACK_TOTAL_POKEMON;
  }, [entries]);

  const regularTotalPages = useMemo(
    () => Math.max(1, Math.ceil(maxDexNumber / SLOTS_PER_PAGE)),
    [maxDexNumber]
  );

  const totalPages = useMemo(() => {
    // Regular pages + forms pages
    return regularTotalPages + FORM_PAGES.length;
  }, [regularTotalPages]);

  useEffect(() => {
    setPage((current) => {
      if (current < 1) return 1;
      if (current > totalPages) return totalPages;
      return current;
    });
  }, [totalPages]);

  // Update currentFormPage when page changes
  useEffect(() => {
    if (page > regularTotalPages) {
      const formPageIndex = page - regularTotalPages - 1;
      const formPage = FORM_PAGES[formPageIndex];
      setCurrentFormPage(formPage?.key || null);
    } else {
      setCurrentFormPage(null);
    }
  }, [page, regularTotalPages]);

  // Fetch forms when on a forms page
  useEffect(() => {
    if (!currentFormPage) {
      return;
    }

    let ignore = false;
    setFormLoading(true);

    const fetchForms = async () => {
      try {
        let formsData = [];

        if (currentFormPage === "unown") {
          // Fetch all Unown forms (A-Z, !, ?)
          const unownSpeciesUrl = `${POKEAPI_BASE}/pokemon-species/201`;
          const speciesResponse = await fetch(unownSpeciesUrl);
          if (!speciesResponse?.ok) throw new Error("Failed to fetch Unown species");
          const speciesData = await speciesResponse.json();
          
          // Unown's base dex number is 201
          const baseDexNumber = 201;
          
          // Get all varieties
          const varieties = Array.isArray(speciesData.varieties) ? speciesData.varieties : [];
          for (const variety of varieties) {
            if (variety.pokemon?.url) {
              try {
                const pokemonResponse = await fetch(variety.pokemon.url);
                if (!pokemonResponse?.ok) continue;
                const pokemonData = await pokemonResponse.json();
                const formName = pokemonData.name || "";
                // Extract the letter/symbol from "unown-a", "unown-b", etc.
                let displayName = formName.replace(/^unown-?/i, "").toUpperCase();
                // Handle special cases
                if (displayName === "EXCLAMATION") displayName = "!";
                if (displayName === "QUESTION") displayName = "?";
                formsData.push({
                  id: pokemonData.id,
                  name: formName,
                  displayName,
                  spriteId: pokemonData.id,
                  url: variety.pokemon.url,
                  baseDexNumber: baseDexNumber,
                  baseSpeciesName: "Unown",
                });
              } catch (err) {
                console.warn(`Failed to fetch Unown form ${variety.pokemon?.url}:`, err);
                continue;
              }
            }
          }
          
          // Sort Unown forms: A-Z first, then !, then ?
          formsData.sort((a, b) => {
            const aChar = a.displayName;
            const bChar = b.displayName;
            if (aChar === "!" && bChar === "?") return -1;
            if (aChar === "?" && bChar === "!") return 1;
            if (aChar === "!") return 1;
            if (aChar === "?") return 1;
            if (bChar === "!") return -1;
            if (bChar === "?") return -1;
            return aChar.localeCompare(bChar);
          });
        } else {
          // Fetch regional forms using known list of Pokemon with regional forms
          const regionMap = {
            alolan: "alola",
            galarian: "galar",
            hisuian: "hisui",
            paldean: "paldea",
          };
          const regionKey = regionMap[currentFormPage];
          if (!regionKey) {
            setFormLoading(false);
            return;
          }

          const pokemonWithForms = REGIONAL_FORMS_MAP[currentFormPage] || [];
          
          // Fetch each Pokemon species that has regional forms
          for (const dexNumber of pokemonWithForms) {
            if (ignore) break;
            
            try {
              const speciesUrl = `${POKEAPI_BASE}/pokemon-species/${dexNumber}`;
              const speciesResponse = await fetch(speciesUrl);
              if (!speciesResponse?.ok) continue;
              const speciesData = await speciesResponse.json();
              
              // Get the base species national dex number (species ID)
              const baseDexNumber = speciesData?.id || null;
              if (!baseDexNumber) continue;

              const varieties = Array.isArray(speciesData.varieties) ? speciesData.varieties : [];
              
              // Check if this species has a regional form for the requested region
              for (const variety of varieties) {
                if (!variety.pokemon?.url) continue;

                try {
                  const pokemonResponse = await fetch(variety.pokemon.url);
                  if (!pokemonResponse?.ok) continue;
                  const pokemonData = await pokemonResponse.json();

                  const formName = pokemonData.name || "";
                  const lowerName = formName.toLowerCase();
                  
                  // Check if this is a regional form of the requested region
                  // Regional forms typically have the region in their name (e.g., "raichu-alola", "meowth-galar")
                  const tokens = lowerName.split("-");
                  const hasRegionToken = tokens.includes(regionKey) || tokens.includes(currentFormPage);
                  
                  if (hasRegionToken) {
                    formsData.push({
                      id: pokemonData.id,
                      name: formName,
                      displayName: toTitleCase(formName),
                      spriteId: pokemonData.id,
                      url: variety.pokemon.url,
                      baseDexNumber: baseDexNumber,
                      baseSpeciesName: toTitleCase(speciesData?.name || ""),
                    });
                    // Found the regional form, break to move to next Pokemon
                    break;
                  }
                } catch (err) {
                  console.warn(`Failed to fetch Pokemon form ${variety.pokemon?.url}:`, err);
                  continue;
                }
              }
            } catch (err) {
              console.warn(`Failed to fetch species ${dexNumber}:`, err);
              continue;
            }
          }
          
          // Sort forms by base species national dex number
          formsData.sort((a, b) => (a.baseDexNumber || 0) - (b.baseDexNumber || 0));
        }

        if (!ignore) {
          console.log(`Loaded ${formsData.length} forms for ${currentFormPage}`);
          setFormEntries((prev) => {
            const next = new Map(prev);
            next.set(currentFormPage, formsData);
            return next;
          });
          setFormLoading(false);
          setError(null);
        }
      } catch (fetchError) {
        if (!ignore) {
          console.error(`Failed to fetch ${currentFormPage} forms:`, fetchError);
          setError(`Failed to load ${currentFormPage} forms: ${fetchError.message}`);
          setFormLoading(false);
        }
      }
    };

    // Check if we already have this form page cached
    const cached = formEntries.get(currentFormPage);
    if (cached && cached.length > 0) {
      setFormLoading(false);
      return;
    }

    fetchForms();

    return () => {
      ignore = true;
    };
  }, [currentFormPage, formEntries]);

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
    const isFormPage = clampedPage > regularTotalPages;
    
    if (isFormPage) {
      const formPageIndex = clampedPage - regularTotalPages - 1;
      const formPage = FORM_PAGES[formPageIndex];
      const currentForms = formEntries.get(formPage?.key || "") || [];
      return {
        page: clampedPage,
        start: 1,
        end: currentForms.length,
        slots: currentForms.map((form, index) => ({
          dexNumber: index + 1,
          entry: form,
          isForm: true,
        })),
        hasPrevious: clampedPage > 1,
        hasNext: clampedPage < totalPages,
        rangeLabel: formPage?.label || "Forms",
        totalPages,
        isFormPage: true,
      };
    }

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
      isFormPage: false,
    };
  }, [page, totalPages, entryMap, maxDexNumber, regularTotalPages, formEntries]);

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
        {formLoading && pagination.isFormPage ? (
          <div className="home-status home-status-loading">Loading forms…</div>
        ) : null}
        {!formLoading && pagination.isFormPage && pagination.slots.length === 0 ? (
          <div className="home-status">No forms found.</div>
        ) : null}

        <div className="home-grid-wrapper">
          <div className="home-grid">
            {pagination.slots.map((slot) => {
              const hasEntry = Boolean(slot.entry);
              const isHighlighted = highlightedPokemon === slot.dexNumber;
              const className = `home-slot${hasEntry ? " has-entry" : " is-empty"}${isHighlighted ? " is-highlighted" : ""}`;
              const entry = slot.entry;
              const displayName = entry?.displayName || "";
              const spriteId = entry?.spriteId || entry?.id || null;
              
              return (
                <div key={slot.dexNumber} className="home-card">
                  <div id={`pokemon-slot-${slot.dexNumber}`} className={className}>
                    {hasEntry ? (
                      <span className="home-slot-name">{displayName}</span>
                    ) : null}
                    {hasEntry && spriteId ? (
                      <div className="home-slot-sprite">
                        <SpriteImage
                          id={spriteId}
                          alt={displayName}
                          variant="home"
                          width={120}
                          height={120}
                          loading="lazy"
                        />
                      </div>
                    ) : hasEntry ? (
                      <span className="home-slot-placeholder">Loading…</span>
                    ) : (
                      <span className="home-slot-placeholder">Empty Slot</span>
                    )}
                    {pagination.isFormPage ? (
                      slot.entry?.baseDexNumber ? (
                        <span className="home-slot-number">#{formatDexNumber(slot.entry.baseDexNumber)}</span>
                      ) : null
                    ) : (
                      <span className="home-slot-number">#{formatDexNumber(slot.dexNumber)}</span>
                    )}
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



