import React, { useCallback, useEffect, useMemo, useState } from "react";
import SpriteImage from "./components/SpriteImage.jsx";
import { ALT_FORM_HIDE_FLAGS } from "./constants/forms.js";
import "./HomePage.css";

const FALLBACK_TOTAL_POKEMON = 1025;
const SLOTS_PER_PAGE = 30;
const NATIONAL_DEX_URL = "https://pokeapi.co/api/v2/pokedex/national";
const POKEAPI_BASE = "https://pokeapi.co/api/v2";

// Known Pokemon with regional forms (by national dex number)
const REGIONAL_FORMS_MAP = {
  alolan: [19, 20, 26, 27, 28, 37, 38, 50, 51, 52, 53, 74, 75, 76, 88, 89, 103, 105],
  galarian: [52, 77, 78, 79, 80, 83, 110, 122, 144, 145, 146, 222, 263, 264, 554, 555, 562, 618, 859, 860, 861, 865, 866, 867, 868, 869],
  hisuian: [58, 59, 100, 101, 157, 211, 215, 503, 549, 550, 570, 571, 628, 705, 706, 713, 724],
  paldean: [194, 128, 1029, 1030, 1031, 1032],
};
const REGIONAL_FORM_KEYS = ["alolan", "galarian", "hisuian", "paldean"];
const FORM_FETCH_KEYS = ["unown", ...REGIONAL_FORM_KEYS];

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

const getDexNumber = (entry) => {
  if (!entry) return null;
  if (Number.isFinite(entry.dexNumber)) return entry.dexNumber;
  if (Number.isFinite(entry.number)) return entry.number;
  if (Number.isFinite(entry.baseDexNumber)) return entry.baseDexNumber;
  return null;
};

const createEntryKey = (entry) => {
  const dexNumber = getDexNumber(entry) ?? "unknown";
  const baseToken = entry?.name || entry?.displayName || entry?.id || entry?.spriteId || "entry";
  const prefix = entry?.isForm ? "form" : "dex";
  return String(`${prefix}-${dexNumber}-${baseToken}`).replace(/[^a-z0-9-]/gi, "-");
};

export default function HomePage() {
  const [page, setPage] = useState(1);
  const [baseEntries, setBaseEntries] = useState([]);
  const [altFormEntries, setAltFormEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedEntryKey, setHighlightedEntryKey] = useState(null);

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
        setBaseEntries(normalized);
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError?.message || "Unable to load National Dex data.");
          setBaseEntries([]);
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
    baseEntries.forEach((entry) => {
      map.set(entry.number, entry);
    });
    return map;
  }, [baseEntries]);

  const maxDexNumber = useMemo(() => {
    // Cap at 1025 to ensure last regular page shows 1021-1025
    if (baseEntries.length > 0) {
      const max = baseEntries[baseEntries.length - 1].number;
      return Math.min(max, 1025);
    }
    return FALLBACK_TOTAL_POKEMON;
  }, [baseEntries]);

  useEffect(() => {
    let ignore = false;
    const loadForms = async () => {
      setFormLoading(true);
      setFormError(null);
      const collected = [];
      const failures = [];

      const fetchFormsForKey = async (formKey) => {
        if (formKey === "unown") {
          const forms = [];
          try {
            const unownSpeciesUrl = `${POKEAPI_BASE}/pokemon-species/201`;
            const speciesResponse = await fetch(unownSpeciesUrl);
            if (!speciesResponse?.ok) throw new Error("Failed to fetch Unown species");
            const speciesData = await speciesResponse.json();
            const baseDexNumber = 201;
            const varieties = Array.isArray(speciesData.varieties) ? speciesData.varieties : [];
            for (const variety of varieties) {
              if (!variety.pokemon?.url) continue;
              try {
                const pokemonResponse = await fetch(variety.pokemon.url);
                if (!pokemonResponse?.ok) continue;
                const pokemonData = await pokemonResponse.json();
                const formName = pokemonData.name || "";
                let displayName = formName.replace(/^unown-?/i, "").toUpperCase();
                if (displayName === "EXCLAMATION") displayName = "!";
                if (displayName === "QUESTION") displayName = "?";
                forms.push({
                  id: pokemonData.id,
                  name: formName,
                  displayName,
                  spriteId: pokemonData.id,
                  url: variety.pokemon.url,
                  baseDexNumber,
                  baseSpeciesName: "Unown",
                });
              } catch (err) {
                console.warn(`Failed to fetch Unown form ${variety.pokemon?.url}:`, err);
              }
            }
            forms.sort((a, b) => {
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
          } catch (err) {
            failures.push(formKey);
          }
          return forms;
        }

        const regionMap = {
          alolan: "alola",
          galarian: "galar",
          hisuian: "hisui",
          paldean: "paldea",
        };
        const regionKey = regionMap[formKey];
        if (!regionKey) return [];

        const regionForms = [];
        const pokemonWithForms = REGIONAL_FORMS_MAP[formKey] || [];

        for (const dexNumber of pokemonWithForms) {
          if (ignore) break;
          try {
            const speciesUrl = `${POKEAPI_BASE}/pokemon-species/${dexNumber}`;
            const speciesResponse = await fetch(speciesUrl);
            if (!speciesResponse?.ok) continue;
            const speciesData = await speciesResponse.json();
            const baseDexNumber = speciesData?.id || null;
            if (!baseDexNumber) continue;
            const varieties = Array.isArray(speciesData.varieties) ? speciesData.varieties : [];
            for (const variety of varieties) {
              if (!variety.pokemon?.url) continue;
              try {
                const pokemonResponse = await fetch(variety.pokemon.url);
                if (!pokemonResponse?.ok) continue;
                const pokemonData = await pokemonResponse.json();
                const formName = pokemonData.name || "";
                const lowerName = formName.toLowerCase();
                const tokens = lowerName.split("-");
                const hasRegionToken = tokens.includes(regionKey) || tokens.includes(formKey);
                if (hasRegionToken) {
                  regionForms.push({
                    id: pokemonData.id,
                    name: formName,
                    displayName: toTitleCase(formName),
                    spriteId: pokemonData.id,
                    url: variety.pokemon.url,
                    baseDexNumber,
                    baseSpeciesName: toTitleCase(speciesData?.name || ""),
                  });
                }
              } catch (err) {
                console.warn(`Failed to fetch Pokemon form ${variety.pokemon?.url}:`, err);
              }
            }
          } catch (err) {
            console.warn(`Failed to fetch species ${dexNumber}:`, err);
          }
        }
        regionForms.sort((a, b) => (a.baseDexNumber || 0) - (b.baseDexNumber || 0));
        return regionForms;
      };

      for (const formKey of FORM_FETCH_KEYS) {
        const forms = await fetchFormsForKey(formKey);
        if (forms && forms.length) {
          collected.push(...forms);
        }
      }

      if (ignore) return;
      const filtered = collected.filter((form) => {
        const baseDexNumber = getDexNumber(form);
        return baseDexNumber == null || !ALT_FORM_HIDE_FLAGS.has(baseDexNumber);
      });
      setAltFormEntries(filtered);
      if (failures.length > 0) {
        setFormError(`Failed to load ${failures.join(", ")} form data.`);
      }
      setFormLoading(false);
    };

    loadForms();
    return () => {
      ignore = true;
    };
  }, []);

  const altFormsByBaseDex = useMemo(() => {
    const map = new Map();
    altFormEntries.forEach((form) => {
      const baseDexNumber = getDexNumber(form);
      if (baseDexNumber == null || ALT_FORM_HIDE_FLAGS.has(baseDexNumber)) {
        return;
      }
      const list = map.get(baseDexNumber) || [];
      list.push({
        ...form,
        dexNumber: baseDexNumber,
        isForm: true,
      });
      map.set(baseDexNumber, list);
    });
    map.forEach((list) => list.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "")));
    return map;
  }, [altFormEntries]);

  const displayEntries = useMemo(() => {
    const combined = [];
    const seenKeys = new Set();
    const pushEntry = (entry) => {
      const entryWithKey = entry.entryKey ? entry : { ...entry, entryKey: createEntryKey(entry) };
      const key = entryWithKey.entryKey;
      if (!key || seenKeys.has(key)) return;
      seenKeys.add(key);
      combined.push(entryWithKey);
    };

    baseEntries.forEach((entry) => {
      const baseEntry = { ...entry, dexNumber: entry.number, isForm: false };
      pushEntry(baseEntry);
      const forms = altFormsByBaseDex.get(entry.number) || [];
      forms.forEach((form) => pushEntry(form));
    });

    // Ensure forms with missing base entries still render.
    altFormEntries.forEach((form) => {
      const dexNumber = getDexNumber(form);
      if (dexNumber == null) return;
      pushEntry({ ...form, dexNumber, isForm: true });
    });

    return combined;
  }, [altFormEntries, altFormsByBaseDex, baseEntries]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(displayEntries.length / SLOTS_PER_PAGE)),
    [displayEntries]
  );

  useEffect(() => {
    setPage((current) => {
      if (current < 1) return 1;
      if (current > totalPages) return totalPages;
      return current;
    });
  }, [totalPages]);

  useEffect(() => {
    if (!highlightedEntryKey) return;
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
    const endIndex = Math.min(startIndex + SLOTS_PER_PAGE, displayEntries.length);
    const slots = displayEntries.slice(startIndex, endIndex).map((entry) => {
      const dexNumber = getDexNumber(entry) || 0;
      const key = entry.entryKey || createEntryKey(entry);
      return { dexNumber, entry, key };
    });
    const firstDex = slots.length > 0 ? slots[0].dexNumber : null;
    const lastDex = slots.length > 0 ? slots[slots.length - 1].dexNumber : firstDex;
    const rangeLabel =
      firstDex != null && lastDex != null
        ? `#${formatDexNumber(firstDex)} - #${formatDexNumber(lastDex)}`
        : "Entries";

    return {
      page: clampedPage,
      start: startIndex + 1,
      end: endIndex,
      slots,
      hasPrevious: clampedPage > 1,
      hasNext: clampedPage < totalPages,
      rangeLabel,
      totalPages,
      isFormPage: false,
    };
  }, [displayEntries, page, totalPages]);

  const focusEntryByIndex = useCallback(
    (index) => {
      if (index < 0 || index >= displayEntries.length) return;
      const entry = displayEntries[index];
      const key = entry.entryKey || createEntryKey(entry);
      const targetPage = Math.floor(index / SLOTS_PER_PAGE) + 1;
      setPage(targetPage);
      setHighlightedEntryKey(key);
    },
    [displayEntries]
  );

  const handleSelectDexNumber = useCallback(
    (dexNumber) => {
      if (!Number.isFinite(dexNumber) || dexNumber <= 0) return;
      const baseIndex = displayEntries.findIndex(
        (entry) => !entry.isForm && getDexNumber(entry) === dexNumber
      );
      const fallbackIndex =
        baseIndex !== -1 ? baseIndex : displayEntries.findIndex((entry) => getDexNumber(entry) === dexNumber);
      if (fallbackIndex === -1) return;
      focusEntryByIndex(fallbackIndex);
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

  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  const suggestions = useMemo(() => {
    if (!normalizedSearch) return [];
    const limit = 8;
    const matches = [];
    for (const entry of displayEntries) {
      if (matches.length >= limit) break;
      const nameMatch = String(entry.displayName || "").toLowerCase().includes(normalizedSearch);
      const dexNumber = getDexNumber(entry);
      const dexMatch =
        (dexNumber != null && formatDexNumber(dexNumber).includes(normalizedSearch)) ||
        String(dexNumber ?? "").includes(normalizedSearch);
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

  const focusEntry = useCallback(
    (entry) => {
      if (!entry) return;
      const key = entry.entryKey || createEntryKey(entry);
      const index = displayEntries.findIndex(
        (candidate) => (candidate.entryKey || createEntryKey(candidate)) === key
      );
      if (index === -1) return;
      focusEntryByIndex(index);
    },
    [displayEntries, focusEntryByIndex]
  );

  const handleGridNameClick = (entry) => {
    focusEntry(entry);
    clearSearch();
  };

  const handleSuggestionSelect = (entry) => {
    focusEntry(entry);
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
                  <li key={entry.entryKey || createEntryKey(entry)}>
                    <button
                      type="button"
                      className="home-search-suggestion"
                      onClick={() => handleSuggestionSelect(entry)}
                      role="option"
                    >
                      <span className="home-search-suggestion-name">{entry.displayName}</span>
                      {Number.isFinite(getDexNumber(entry)) ? (
                        <span className="home-search-suggestion-number">#{formatDexNumber(getDexNumber(entry))}</span>
                      ) : null}
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
        {formError ? (
          <div className="home-status home-status-error" role="alert">
            {formError}
          </div>
        ) : null}
        {loading && !baseEntries.length ? (
          <div className="home-status home-status-loading">Loading Pokémon…</div>
        ) : null}
        {formLoading ? <div className="home-status home-status-loading">Loading alternate forms…</div> : null}

        <div className="home-grid-wrapper">
          <div className="home-grid">
            {pagination.slots.map((slot) => {
              const hasEntry = Boolean(slot.entry);
              const isHighlighted = highlightedEntryKey === slot.key;
              const className = `home-slot${hasEntry ? " has-entry" : " is-empty"}${isHighlighted ? " is-highlighted" : ""}`;
              const entry = slot.entry;
              const displayName = entry?.displayName || "";
              const spriteId = entry?.spriteId || entry?.id || null;
              const dexLabel = Number.isFinite(slot.dexNumber) ? `#${formatDexNumber(slot.dexNumber)}` : null;
              
              return (
                <div key={slot.key} className="home-card">
                  <div id={`pokemon-slot-${slot.key}`} className={className}>
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
                    {dexLabel ? <span className="home-slot-number">{dexLabel}</span> : null}
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



